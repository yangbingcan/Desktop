/** @file 用户认证 - 登录、用户查询、密码管理、多角色权限、统一鉴权 */
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use crate::database::DbState;
use crate::error_util::translate_db_error;
use crate::models::{LoginResponse, UserInfo, RoleBrief};
use rusqlite::{params, Row};
use tauri::State;

type HmacSha256 = Hmac<Sha256>;

const TOKEN_SECRET: &[u8] = b"guanyong_gl_token_secret_key_2026";

const TOKEN_MAX_AGE_SECS: i64 = 24 * 60 * 60;

const ALL_PERMS: &[&str] = &["dashboard", "permission", "user_manage", "settings", "system_log"];

fn hash_password_with_salt(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", salt, password).as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn hash_password(password: &str) -> String {
    let salt = uuid::Uuid::new_v4().to_string().replace("-", "");
    let hash = hash_password_with_salt(password, &salt);
    format!("{}${}", salt, hash)
}

pub fn verify_password(password: &str, stored: &str) -> bool {
    let parts: Vec<&str> = stored.splitn(2, '$').collect();
    if parts.len() != 2 {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let legacy_hash = format!("{:x}", hasher.finalize());
        return legacy_hash == stored;
    }
    let salt = parts[0];
    let hash = parts[1];
    hash_password_with_salt(password, salt) == hash
}

fn generate_token(user_id: &str) -> String {
    let timestamp = chrono::Utc::now().timestamp();
    let message = format!("{}:{}", user_id, timestamp);
    let mut mac = HmacSha256::new_from_slice(TOKEN_SECRET)
        .expect("HMAC密钥长度错误");
    mac.update(message.as_bytes());
    let signature = mac.finalize().into_bytes();
    format!("token_{}_{}_{}", user_id, timestamp, hex::encode(signature))
}

pub fn verify_token(token: &str) -> Result<String, String> {
    let parts: Vec<&str> = token.splitn(4, '_').collect();
    if parts.len() != 4 || parts[0] != "token" {
        return Err("无效的Token格式".to_string());
    }
    let user_id = parts[1];
    let timestamp_str = parts[2];
    let signature = parts[3];

    let timestamp: i64 = timestamp_str.parse().map_err(|_| "Token时间戳无效".to_string())?;
    let now = chrono::Utc::now().timestamp();
    if now - timestamp > TOKEN_MAX_AGE_SECS {
        return Err("Token已过期，请重新登录".to_string());
    }

    let message = format!("{}:{}", user_id, timestamp_str);
    let mut mac = HmacSha256::new_from_slice(TOKEN_SECRET)
        .map_err(|e| format!("Token验证失败: {}", e))?;
    mac.update(message.as_bytes());
    let expected = mac.finalize().into_bytes();

    let sig_bytes = hex::decode(signature).map_err(|_| "Token签名解码失败".to_string())?;
    if expected.as_slice() == sig_bytes.as_slice() {
        Ok(user_id.to_string())
    } else {
        Err("Token签名验证失败".to_string())
    }
}

#[allow(dead_code)]
pub struct AuthContext {
    pub user_id: String,
    pub username: String,
    pub permissions: Vec<String>,
    pub is_super_admin: bool,
}

pub fn verify_and_get_context(conn: &rusqlite::Connection, token: &str) -> Result<AuthContext, String> {
    let user_id = verify_token(token)?;

    let username: String = conn
        .query_row(
            "SELECT username FROM users WHERE id = ?1 AND status = 1",
            params![user_id],
            |row| row.get(0),
        )
        .map_err(|_| "用户不存在或已被禁用".to_string())?;

    let is_super_admin = username == "admin";
    let permissions = if is_super_admin {
        ALL_PERMS.iter().map(|s| s.to_string()).collect()
    } else {
        load_user_permissions(conn, &user_id)
    };

    Ok(AuthContext {
        user_id,
        username,
        permissions,
        is_super_admin,
    })
}

impl AuthContext {
    pub fn require_permission(&self, perm: &str) -> Result<(), String> {
        if self.is_super_admin {
            return Ok(());
        }
        let perm_str = perm.to_string();
        if self.permissions.contains(&perm_str)
            || self.permissions.iter().any(|p| p.starts_with(&format!("{}:", perm)))
        {
            Ok(())
        } else {
            Err("您没有执行此操作的权限".to_string())
        }
    }
}

pub fn load_user_roles(conn: &rusqlite::Connection, user_id: &str) -> Vec<RoleBrief> {
    let mut stmt = match conn.prepare(
        "SELECT r.id, r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mapped = match stmt.query_map(params![user_id], |row: &Row| {
        Ok(RoleBrief {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    }) {
        Ok(m) => m,
        Err(_) => return vec![],
    };
    mapped.filter_map(|r| r.ok()).collect()
}

pub fn load_user_permissions(conn: &rusqlite::Connection, user_id: &str) -> Vec<String> {
    let mut stmt = match conn.prepare(
        "SELECT DISTINCT rp.permission_key FROM user_roles ur JOIN role_permissions rp ON ur.role_id = rp.role_id WHERE ur.user_id = ?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mapped = match stmt.query_map(params![user_id], |row: &Row| row.get(0)) {
        Ok(m) => m,
        Err(_) => return vec![],
    };
    mapped.filter_map(|r: Result<String, _>| r.ok()).collect()
}

#[tauri::command]
pub fn login(
    db: State<'_, DbState>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let (id, uname, password_hash, real_name, phone, email, avatar, status) = {
        let mut stmt = conn
            .prepare("SELECT id, username, password_hash, real_name, phone, email, avatar, status FROM users WHERE username = ?1")
            .map_err(|e| translate_db_error(e))?;

        stmt.query_row(params![username], |row: &Row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4).unwrap_or_default(),
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6).unwrap_or_default(),
                row.get::<_, i32>(7)?,
            ))
        }).map_err(|e: rusqlite::Error| {
            if e.to_string().contains("query returned no rows") {
                "用户名或密码错误".to_string()
            } else {
                translate_db_error(e)
            }
        })?
    };

    if status == 0 {
        return Err("账号已被禁用，请联系管理员".to_string());
    }

    if !verify_password(&password, &password_hash) {
        return Err("用户名或密码错误".to_string());
    }

    let is_super_admin = uname == "admin";
    let permissions = if is_super_admin {
        ALL_PERMS.iter().map(|s| s.to_string()).collect()
    } else {
        load_user_permissions(conn, &id)
    };
    let roles = load_user_roles(conn, &id);

    conn.execute(
        "UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?1",
        params![id],
    ).ok();

    let token = generate_token(&id);

    crate::operation_logs::record_operation_log(conn, &uname, "login", "登录系统", "认证", None);

    Ok(LoginResponse {
        token,
        user: UserInfo {
            id,
            username: uname,
            real_name,
            phone,
            email,
            avatar,
            status,
            permissions,
            roles,
            is_super_admin,
        },
    })
}

#[tauri::command]
pub fn get_current_user(db: State<'_, DbState>, token: String) -> Result<UserInfo, String> {
    let user_id = verify_token(&token)?;

    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let (id, username, real_name, phone, email, avatar, status) = conn
        .query_row(
            "SELECT id, username, real_name, phone, email, avatar, status FROM users WHERE id = ?1 AND status = 1",
            params![user_id],
            |row: &Row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3).unwrap_or_default(),
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5).unwrap_or_default(),
                    row.get::<_, i32>(6)?,
                ))
            },
        )
        .map_err(|e| translate_db_error(e))?;

    let is_super = username == "admin";
    let is_super_admin = is_super;
    let permissions = if is_super {
        ALL_PERMS.iter().map(|s| s.to_string()).collect()
    } else {
        load_user_permissions(conn, &id)
    };
    let roles = load_user_roles(conn, &id);

    Ok(UserInfo {
        id,
        username,
        real_name,
        phone,
        email,
        avatar,
        status,
        permissions,
        roles,
        is_super_admin,
    })
}

#[tauri::command]
pub fn update_password(
    db: State<'_, DbState>,
    token: String,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let user_id = verify_token(&token)?;

    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let stored_hash: String = conn
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1",
            params![user_id],
            |row| row.get(0),
        )
        .map_err(|e| translate_db_error(e))?;

    if !verify_password(&old_password, &stored_hash) {
        return Err("原密码错误".to_string());
    }

    let new_hash = hash_password(&new_password);
    conn.execute(
        "UPDATE users SET password_hash = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
        params![new_hash, user_id],
    )
    .map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(conn, &verify_token(&token)?, "update", "修改密码", "认证", None);

    Ok(())
}
