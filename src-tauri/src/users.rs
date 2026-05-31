/** @file 用户管理 - 用户CRUD、状态管理、密码重置（含鉴权） */

use crate::auth::{hash_password, verify_and_get_context, load_user_roles};
use crate::database::DbState;
use crate::error_util::translate_db_error;
use crate::models::UserItem;
use rusqlite::{params, Row};
use tauri::State;

fn row_to_user_item(row: &Row) -> Result<UserItem, rusqlite::Error> {
    Ok(UserItem {
        id: row.get(0)?,
        username: row.get(1)?,
        real_name: row.get(2)?,
        phone: row.get(3).unwrap_or_default(),
        email: row.get(4)?,
        avatar: row.get(5).unwrap_or_default(),
        status: row.get(6)?,
        last_login_at: row.get(7)?,
        created_at: row.get(8)?,
        roles: vec![],
    })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct GetUsersParams {
    pub page: Option<i32>,
    pub page_size: Option<i32>,
    pub keyword: Option<String>,
    pub status: Option<i32>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct GetUsersResult {
    pub items: Vec<UserItem>,
    pub total: i32,
}

#[tauri::command]
pub fn get_users(db: State<'_, DbState>, token: String, params: GetUsersParams) -> Result<GetUsersResult, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
    ctx.require_permission("user_manage")?;

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let mut where_clauses = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref kw) = params.keyword {
        if !kw.is_empty() {
            where_clauses.push("(u.username LIKE ? OR u.real_name LIKE ?)".to_string());
            let pattern = format!("%{}%", kw);
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern));
        }
    }

    if let Some(s) = params.status {
        where_clauses.push("u.status = ?".to_string());
        param_values.push(Box::new(s));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM users u {}", where_sql);
    let count_params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let total: i32 = conn.query_row(&count_sql, count_params.as_slice(), |row| row.get(0)).unwrap_or(0);

    let query_sql = format!(
        "SELECT u.id, u.username, u.real_name, u.phone, u.email, u.avatar, u.status, u.last_login_at, u.created_at FROM users u {} ORDER BY u.created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );

    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = param_values;
    all_params.push(Box::new(page_size));
    all_params.push(Box::new(offset));
    let query_params: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&query_sql).map_err(|e| translate_db_error(e))?;
    let items: Vec<UserItem> = stmt
        .query_map(query_params.as_slice(), |row| row_to_user_item(row))
        .map_err(|e| translate_db_error(e))?
        .filter_map(|r| r.ok())
        .map(|mut item| {
            item.roles = load_user_roles(conn, &item.id);
            item
        })
        .collect();

    Ok(GetUsersResult { items, total })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateUserParams {
    pub username: String,
    pub real_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub password: String,
    pub role_ids: Option<Vec<String>>,
}

#[derive(serde::Serialize)]
pub struct CreateUserResult {
    pub user: UserItem,
    pub generated_password: Option<String>,
}

#[tauri::command]
pub fn create_user(db: State<'_, DbState>, token: String, params: CreateUserParams) -> Result<CreateUserResult, String> {
    let username = params.username.trim().to_string();
    if username.is_empty() {
        return Err("用户名不能为空".to_string());
    }
    if params.real_name.trim().is_empty() {
        return Err("姓名不能为空".to_string());
    }

    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
    ctx.require_permission("user_manage")?;

    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM users WHERE username = ?1",
        params![username],
        |row| row.get(0),
    ).unwrap_or(false);
    if exists {
        return Err("用户名已存在".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let hashed_pwd = hash_password(&params.password);

    conn.execute(
        "INSERT INTO users (id, username, password_hash, real_name, phone, email, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
        params![id, username, hashed_pwd, params.real_name, params.phone, params.email],
    ).map_err(|e| translate_db_error(e))?;

    if let Some(ref role_ids) = params.role_ids {
        for role_id in role_ids {
            let ur_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO user_roles (id, user_id, role_id) VALUES (?1, ?2, ?3)",
                params![ur_id, id, role_id],
            ).map_err(|e| translate_db_error(e))?;
        }
    }

    let user = query_user_by_id(conn, &id)?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "create", "创建用户", "用户管理", Some(&format!("用户名: {}", username)));

    Ok(CreateUserResult {
        user,
        generated_password: None,
    })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UpdateUserParams {
    pub id: String,
    pub real_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub role_ids: Option<Vec<String>>,
}

#[tauri::command]
pub fn update_user(db: State<'_, DbState>, token: String, params: UpdateUserParams) -> Result<UserItem, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;

    let is_self = ctx.user_id == params.id;

    if !is_self {
        ctx.require_permission("user_manage")?;
    }

    if is_self && params.role_ids.is_some() {
        return Err("不能修改自己的角色".to_string());
    }

    let is_admin: bool = conn.query_row(
        "SELECT username = 'admin' FROM users WHERE id = ?1",
        params![params.id],
        |row| row.get(0),
    ).unwrap_or(false);

    if is_admin && params.role_ids.is_some() {
        return Err("系统管理员角色不可修改".to_string());
    }

    conn.execute(
        "UPDATE users SET real_name = COALESCE(?1, real_name), phone = COALESCE(?2, phone), email = COALESCE(?3, email), updated_at = datetime('now', 'localtime') WHERE id = ?4",
        params![params.real_name, params.phone, params.email, params.id],
    ).map_err(|e| translate_db_error(e))?;

    if let Some(ref role_ids) = params.role_ids {
        conn.execute("DELETE FROM user_roles WHERE user_id = ?1", params![params.id])
            .map_err(|e| translate_db_error(e))?;
        for role_id in role_ids {
            let ur_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO user_roles (id, user_id, role_id) VALUES (?1, ?2, ?3)",
                params![ur_id, params.id, role_id],
            ).map_err(|e| translate_db_error(e))?;
        }
    }

    let user = query_user_by_id(conn, &params.id)?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "update", "更新用户", "用户管理", Some(&format!("用户ID: {}", params.id)));

    Ok(user)
}

#[tauri::command]
pub fn delete_user(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
    ctx.require_permission("user_manage")?;

    if ctx.user_id == id {
        return Err("不能删除自己的账号".to_string());
    }

    let is_admin: bool = conn.query_row(
        "SELECT username = 'admin' FROM users WHERE id = ?1",
        params![id],
        |row| row.get(0),
    ).unwrap_or(false);
    if is_admin {
        return Err("系统管理员不可删除".to_string());
    }

    conn.execute("DELETE FROM user_roles WHERE user_id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;
    conn.execute("DELETE FROM users WHERE id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "delete", "删除用户", "用户管理", Some(&format!("用户ID: {}", id)));

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ToggleUserStatusParams {
    pub id: String,
    pub status: i32,
}

#[tauri::command]
pub fn toggle_user_status(db: State<'_, DbState>, token: String, params: ToggleUserStatusParams) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
    ctx.require_permission("user_manage")?;

    if ctx.user_id == params.id {
        return Err("不能禁用自己的账号".to_string());
    }

    let is_admin: bool = conn.query_row(
        "SELECT username = 'admin' FROM users WHERE id = ?1",
        params![params.id],
        |row| row.get(0),
    ).unwrap_or(false);
    if is_admin {
        return Err("系统管理员不可禁用".to_string());
    }

    conn.execute(
        "UPDATE users SET status = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
        params![params.status, params.id],
    ).map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "update", "切换用户状态", "用户管理", Some(&format!("用户ID: {}, 状态: {}", params.id, if params.status == 1 { "启用" } else { "禁用" })));

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ResetPasswordParams {
    pub id: String,
    pub new_password: String,
}

#[tauri::command]
pub fn reset_user_password(db: State<'_, DbState>, token: String, params: ResetPasswordParams) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
    ctx.require_permission("user_manage")?;

    let hashed = hash_password(&params.new_password);
    conn.execute(
        "UPDATE users SET password_hash = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
        params![hashed, params.id],
    ).map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "update", "重置用户密码", "用户管理", Some(&format!("用户ID: {}", params.id)));

    Ok(())
}

#[tauri::command]
pub fn generate_random_password() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let mut rng = rand::thread_rng();
    (0..6).map(|_| CHARSET[rng.gen_range(0..CHARSET.len()) as usize] as char).collect()
}

fn query_user_by_id(conn: &rusqlite::Connection, id: &str) -> Result<UserItem, String> {
    let mut item = conn.query_row(
        "SELECT u.id, u.username, u.real_name, u.phone, u.email, u.avatar, u.status, u.last_login_at, u.created_at FROM users u WHERE u.id = ?1",
        params![id],
        |row| row_to_user_item(row),
    ).map_err(|e| format!("查询用户失败: {}", e))?;

    item.roles = load_user_roles(conn, id);
    Ok(item)
}
