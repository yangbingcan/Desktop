//! 用户认证 - 登录、用户查询、密码管理、多角色权限、统一鉴权

use hmac::{Hmac, Mac};
use sha2::Sha256;
use crate::database::{DbState, TokenSecret};
use crate::error_util::translate_db_error;
use crate::models::{LoginResponse, UserInfo, RoleBrief};
use rusqlite::{params, Row};
use tauri::State;

type HmacSha256 = Hmac<Sha256>;

/// Token最大有效期（秒），24小时
const TOKEN_MAX_AGE_SECS: i64 = 24 * 60 * 60;

/// 使用bcrypt哈希密码（cost=12）
pub fn hash_password(password: &str) -> Result<String, String> {
    bcrypt::hash(password, 12).map_err(|e| format!("密码哈希失败: {}", e))
}

/// 验证密码（bcrypt格式）
pub fn verify_password(password: &str, stored: &str) -> bool {
    bcrypt::verify(password, stored).unwrap_or(false)
}

/// 生成HMAC-SHA256签名的Token
fn generate_token(user_id: &str, secret: &[u8], password_version: i32) -> Result<String, String> {
    let timestamp = chrono::Utc::now().timestamp();
    let message = format!("{}:{}:{}", user_id, timestamp, password_version);
    let mut mac = HmacSha256::new_from_slice(secret)
        .map_err(|e| format!("HMAC初始化失败: {}", e))?;
    mac.update(message.as_bytes());
    let signature = mac.finalize().into_bytes();
    Ok(format!("token_{}_{}_{}_{}", user_id, timestamp, password_version, hex::encode(signature)))
}

/// 验证Token有效性，返回(user_id, password_version)
pub fn verify_token(token: &str, secret: &[u8]) -> Result<(String, i32), String> {
    let parts: Vec<&str> = token.splitn(5, '_').collect();
    if parts.len() != 5 || parts[0] != "token" {
        return Err("无效的Token格式".to_string());
    }
    let user_id = parts[1];
    let timestamp_str = parts[2];
    let version_str = parts[3];
    let signature = parts[4];

    let timestamp: i64 = timestamp_str.parse().map_err(|_| "Token时间戳无效".to_string())?;
    let _version: i32 = version_str.parse().map_err(|_| "Token版本无效".to_string())?;

    let now = chrono::Utc::now().timestamp();
    if now - timestamp > TOKEN_MAX_AGE_SECS {
        return Err("Token已过期，请重新登录".to_string());
    }

    let message = format!("{}:{}:{}", user_id, timestamp_str, version_str);
    let mut mac = HmacSha256::new_from_slice(secret)
        .map_err(|e| format!("Token验证失败: {}", e))?;
    mac.update(message.as_bytes());
    let expected = mac.finalize().into_bytes();

    let sig_bytes = hex::decode(signature).map_err(|_| "Token签名解码失败".to_string())?;
    if expected.as_slice() == sig_bytes.as_slice() {
        Ok((user_id.to_string(), _version))
    } else {
        Err("Token签名验证失败".to_string())
    }
}

/// 鉴权上下文，包含用户ID、用户名、权限列表和超级管理员标识
pub struct AuthContext {
    pub user_id: String,
    pub username: String,
    pub permissions: Vec<String>,
    pub is_super_admin: bool,
}

/// 判断用户是否为超级管理员（基于角色is_system=1）
pub fn is_super_admin(conn: &rusqlite::Connection, user_id: &str) -> bool {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?1 AND r.is_system = 1)",
        params![user_id],
        |row| row.get::<_, i32>(0),
    ).unwrap_or(0) != 0
}

/// 验证Token并获取完整鉴权上下文
pub fn verify_and_get_context(conn: &rusqlite::Connection, token: &str, secret: &[u8]) -> Result<AuthContext, String> {
    let (user_id, token_version) = verify_token(token, secret)?;

    // 检查密码版本，版本不匹配说明密码已修改，旧Token应失效
    // 用户不存在时query_row返回Err，必须显式处理，不能用unwrap_or(1)
    // 否则不存在的用户若token_version恰好为1，会通过验证
    let current_version: i32 = conn.query_row(
        "SELECT password_version FROM users WHERE id = ?1 AND status = 1",
        params![user_id],
        |row| row.get(0),
    ).map_err(|_| "用户不存在或已被禁用".to_string())?;
    if token_version != current_version {
        return Err("登录已失效，请重新登录".to_string());
    }

    let username: String = conn
        .query_row(
            "SELECT username FROM users WHERE id = ?1 AND status = 1",
            params![user_id],
            |row| row.get(0),
        )
        .map_err(|_| "用户不存在或已被禁用".to_string())?;

    let is_super = is_super_admin(conn, &user_id);
    let permissions = if is_super {
        crate::roles::all_module_keys()
    } else {
        load_user_permissions(conn, &user_id)
    };

    Ok(AuthContext {
        user_id,
        username,
        permissions,
        is_super_admin: is_super,
    })
}

impl AuthContext {
    /// 检查是否拥有指定权限，超级管理员自动通过
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

/// 用户登录业务逻辑
pub fn login_logic(conn: &rusqlite::Connection, secret: &[u8], username: &str, password: &str) -> Result<LoginResponse, String> {
    let (id, uname, password_hash, real_name, phone, email, avatar, status, must_change) = {
        let mut stmt = conn
            .prepare("SELECT id, username, password_hash, real_name, phone, email, avatar, status, must_change_password FROM users WHERE username = ?1")
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
                row.get::<_, i32>(8).unwrap_or(0),
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

    if !verify_password(password, &password_hash) {
        return Err("用户名或密码错误".to_string());
    }

    let is_super = is_super_admin(conn, &id);
    let permissions = if is_super {
        crate::roles::all_module_keys()
    } else {
        load_user_permissions(conn, &id)
    };
    let roles = load_user_roles(conn, &id);

    conn.execute(
        "UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?1",
        params![id],
    ).ok();

    let password_version: i32 = conn.query_row(
        "SELECT password_version FROM users WHERE id = ?1",
        params![id],
        |row| row.get(0),
    ).map_err(|e| translate_db_error(e))?;
    let token = generate_token(&id, secret, password_version)?;

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
            is_super_admin: is_super,
            must_change_password: must_change != 0,
        },
    })
}

/// 获取当前用户信息业务逻辑
pub fn get_current_user_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str) -> Result<UserInfo, String> {
    let (user_id, _) = verify_token(token, secret)?;

    let (id, username, real_name, phone, email, avatar, status, must_change) = conn
        .query_row(
            "SELECT id, username, real_name, phone, email, avatar, status, must_change_password FROM users WHERE id = ?1 AND status = 1",
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
                    row.get::<_, i32>(7).unwrap_or(0),
                ))
            },
        )
        .map_err(|e| translate_db_error(e))?;

    let is_super = is_super_admin(conn, &id);
    let permissions = if is_super {
        crate::roles::all_module_keys()
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
        is_super_admin: is_super,
        must_change_password: must_change != 0,
    })
}

/// 修改密码业务逻辑
pub fn update_password_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, old_password: &str, new_password: &str) -> Result<(), String> {
    let (user_id, _) = verify_token(token, secret)?;

    let stored_hash: String = conn
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1",
            params![user_id],
            |row| row.get(0),
        )
        .map_err(|e| translate_db_error(e))?;

    if !verify_password(old_password, &stored_hash) {
        return Err("原密码错误".to_string());
    }

    let new_hash = hash_password(new_password)?;
    // 合并为单条UPDATE，避免多条独立UPDATE的事务风险
    conn.execute(
        "UPDATE users SET password_hash = ?1, password_version = password_version + 1, must_change_password = 0, updated_at = datetime('now', 'localtime') WHERE id = ?2",
        params![new_hash, user_id],
    )
    .map_err(|e| format!("修改密码失败: {}", e))?;

    let username: String = conn
        .query_row("SELECT username FROM users WHERE id = ?1", params![user_id], |row| row.get(0))
        .unwrap_or_default();
    crate::operation_logs::record_operation_log(conn, &username, "update", "修改密码", "认证", None);

    Ok(())
}

/// 加载用户角色列表
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
    mapped.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()).collect()
}

/// 加载用户权限列表（通过角色关联）
pub fn load_user_permissions(conn: &rusqlite::Connection, user_id: &str) -> Vec<String> {
    let mut stmt = match conn.prepare(
        "SELECT DISTINCT rp.permission_key FROM user_roles ur JOIN role_permissions rp ON ur.role_id = rp.role_id WHERE ur.user_id = ?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mapped = match stmt.query_map(params![user_id], |row| row.get(0)) {
        Ok(m) => m,
        Err(_) => return vec![],
    };
    mapped.filter_map(|r: Result<String, _>| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()).collect()
}

/// 用户登录
#[tauri::command]
pub fn login(
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    login_logic(&conn, &token_secret, &username, &password)
}

/// 获取当前登录用户信息
#[tauri::command]
pub fn get_current_user(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String) -> Result<UserInfo, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    get_current_user_logic(&conn, &token_secret, &token)
}

/// 修改密码
#[tauri::command]
pub fn update_password(
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let conn = crate::database::get_conn_ref(&db)?;
    update_password_logic(&conn, &token_secret, &token, &old_password, &new_password)
}

// ========== 服务端模式内部函数（不依赖Tauri State） ==========

/// 服务端模式：用户登录
#[cfg(feature = "server")]
pub fn login_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let result = login_logic(conn, secret, &crate::error_util::arg_str(args, "username"), &crate::error_util::arg_str(args, "password"))?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：获取当前用户信息
#[cfg(feature = "server")]
pub fn get_current_user_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let result = get_current_user_logic(conn, secret, &crate::error_util::arg_str(args, "token"))?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：修改密码
#[cfg(feature = "server")]
pub fn update_password_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    update_password_logic(conn, secret, &crate::error_util::arg_str(args, "token"), &crate::error_util::arg_str(args, "old_password"), &crate::error_util::arg_str(args, "new_password"))?;
    Ok(serde_json::json!({"success": true}))
}

// ========== 单元测试 ==========

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;

    #[test]
    fn test_密码哈希与验证() {
        let password = "test_password_123";
        let hashed = hash_password(password).expect("哈希不应失败");

        // 哈希值不等于明文
        assert_ne!(password, hashed);
        // 验证正确密码
        assert!(verify_password(password, &hashed));
        // 验证错误密码
        assert!(!verify_password("wrong_password", &hashed));
    }

    #[test]
    fn test_密码哈希每次不同() {
        let password = "same_password";
        let hash1 = hash_password(password).expect("哈希不应失败");
        let hash2 = hash_password(password).expect("哈希不应失败");
        // bcrypt每次生成不同盐值，哈希结果应不同
        assert_ne!(hash1, hash2);
        // 但都能验证通过
        assert!(verify_password(password, &hash1));
        assert!(verify_password(password, &hash2));
    }

    #[test]
    fn test_验证无效哈希格式() {
        // 非bcrypt格式应返回false
        assert!(!verify_password("any_password", "not_a_bcrypt_hash"));
    }

    #[test]
    fn test_token生成与验证() {
        let user_id = "test-user-001";
        let secret = b"test_secret_key_32bytes_long!!";

        let token = generate_token(user_id, secret, 1).expect("Token生成不应失败");
        // Token格式：token_{user_id}_{timestamp}_{password_version}_{signature}
        assert!(token.starts_with("token_"));
        assert!(token.contains(user_id));

        // 验证Token
        let result = verify_token(&token, secret);
        assert!(result.is_ok());
        let (uid, version) = result.unwrap();
        assert_eq!(uid, user_id);
        assert_eq!(version, 1);
    }

    #[test]
    fn test_token无效格式() {
        let secret = b"test_secret_key_32bytes_long!!";

        // 完全无效的Token
        assert!(verify_token("invalid_token", secret).is_err());
        // 缺少部分的Token
        assert!(verify_token("token_only_two", secret).is_err());
    }

    #[test]
    fn test_token签名篡改() {
        let user_id = "test-user-002";
        let secret = b"test_secret_key_32bytes_long!!";
        let wrong_secret = b"wrong_secret_key_32bytes_long!";

        let token = generate_token(user_id, secret, 1).expect("Token生成不应失败");
        // 用错误的密钥验证
        let result = verify_token(&token, wrong_secret);
        assert!(result.is_err());
    }

    #[test]
    fn test_超级管理员权限动态获取() {
        let keys = crate::roles::all_module_keys();
        // 应包含5个模块key
        assert_eq!(keys.len(), 5);
        assert!(keys.contains(&"dashboard".to_string()));
        assert!(keys.contains(&"permission".to_string()));
        assert!(keys.contains(&"user_manage".to_string()));
        assert!(keys.contains(&"settings".to_string()));
        assert!(keys.contains(&"system_log".to_string()));
    }

    #[test]
    fn test_超级管理员判断() {
        let conn = test_utils::create_test_db();
        // 迁移默认创建admin用户并关联is_system=1的角色
        let admin_id: String = conn.query_row(
            "SELECT id FROM users WHERE username = 'admin'", [], |row| row.get(0)
        ).unwrap();

        assert!(is_super_admin(&conn, &admin_id));

        // 创建普通用户，不应是超级管理员
        let normal_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, real_name, status) VALUES (?1, ?2, ?3, '普通用户', 1)",
            rusqlite::params![normal_id, "normal_user", hash_password("123456").expect("哈希不应失败")],
        ).unwrap();

        assert!(!is_super_admin(&conn, &normal_id));
    }

    #[test]
    fn test_鉴权上下文权限检查() {
        let ctx = AuthContext {
            user_id: "test".to_string(),
            username: "test".to_string(),
            permissions: vec!["user_manage".to_string()],
            is_super_admin: false,
        };

        // 有权限
        assert!(ctx.require_permission("user_manage").is_ok());
        // 无权限
        assert!(ctx.require_permission("settings").is_err());
    }

    #[test]
    fn test_超级管理员自动通过权限检查() {
        let ctx = AuthContext {
            user_id: "admin".to_string(),
            username: "admin".to_string(),
            permissions: vec![],
            is_super_admin: true,
        };

        // 超级管理员即使permissions为空也通过
        assert!(ctx.require_permission("any_permission").is_ok());
    }
}
