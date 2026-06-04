//! 用户管理 - 用户CRUD、状态管理、密码重置

use crate::auth::{hash_password, verify_and_get_context, load_user_roles, is_super_admin};
use crate::database::{DbState, TokenSecret};
use crate::error_util::translate_db_error;
use crate::models::{UserItem, RoleBrief};
use rusqlite::{params, Row};
use std::collections::HashMap;
use tauri::State;

/// 批量加载多个用户的角色列表，解决N+1查询问题
fn batch_load_user_roles(conn: &rusqlite::Connection, user_ids: &[String]) -> HashMap<String, Vec<RoleBrief>> {
    if user_ids.is_empty() {
        return HashMap::new();
    }
    let placeholders: Vec<&str> = user_ids.iter().map(|_| "?").collect();
    let sql = format!(
        "SELECT ur.user_id, r.id, r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id IN ({})",
        placeholders.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = user_ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    let mapped = match stmt.query_map(param_refs.as_slice(), |row: &Row| {
        Ok((
            row.get::<_, String>(0)?,
            RoleBrief {
                id: row.get(1)?,
                name: row.get(2)?,
            },
        ))
    }) {
        Ok(m) => m,
        Err(_) => return HashMap::new(),
    };
    let mut result: HashMap<String, Vec<RoleBrief>> = HashMap::new();
    for item in mapped.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()) {
        result.entry(item.0).or_default().push(item.1);
    }
    result
}

/// 将数据库行映射为UserItem（不含角色信息）
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
        must_change_password: row.get::<_, i32>(9).unwrap_or(0) != 0,
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

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UpdateUserParams {
    pub id: String,
    pub real_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub role_ids: Option<Vec<String>>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ToggleUserStatusParams {
    pub id: String,
    pub status: i32,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ResetPasswordParams {
    pub id: String,
    pub new_password: String,
}

// ========== 业务逻辑（供Tauri命令和server共用） ==========

/// 根据ID查询用户信息（含角色）
fn query_user_by_id(conn: &rusqlite::Connection, id: &str) -> Result<UserItem, String> {
    let mut item = conn.query_row(
        "SELECT u.id, u.username, u.real_name, u.phone, u.email, u.avatar, u.status, u.last_login_at, u.created_at, u.must_change_password FROM users u WHERE u.id = ?1",
        params![id],
        |row| row_to_user_item(row),
    ).map_err(|e| format!("查询用户失败: {}", e))?;

    item.roles = load_user_roles(conn, id);
    Ok(item)
}

/// 获取用户列表业务逻辑（分页+筛选）
fn get_users_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: GetUsersParams) -> Result<GetUsersResult, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
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

    let where_sql = if where_clauses.is_empty() { String::new() } else { format!("WHERE {}", where_clauses.join(" AND ")) };
    let count_sql = format!("SELECT COUNT(*) FROM users u {}", where_sql);
    let count_params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let total: i32 = conn.query_row(&count_sql, count_params.as_slice(), |row| row.get(0)).unwrap_or(0);

    let query_sql = format!(
        "SELECT u.id, u.username, u.real_name, u.phone, u.email, u.avatar, u.status, u.last_login_at, u.created_at, u.must_change_password FROM users u {} ORDER BY u.created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );
    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = param_values;
    all_params.push(Box::new(page_size));
    all_params.push(Box::new(offset));
    let query_params: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&query_sql).map_err(|e| translate_db_error(e))?;
    let items: Vec<UserItem> = stmt.query_map(query_params.as_slice(), |row| row_to_user_item(row))
        .map_err(|e| translate_db_error(e))?
        .filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()).collect();

    let user_ids: Vec<String> = items.iter().map(|u| u.id.clone()).collect();
    let roles_map = batch_load_user_roles(conn, &user_ids);
    let mut items = items;
    for item in &mut items { item.roles = roles_map.get(&item.id).cloned().unwrap_or_default(); }

    Ok(GetUsersResult { items, total })
}

/// 创建用户业务逻辑（INSERT用户+角色分配包裹在事务中）
fn create_user_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: CreateUserParams) -> Result<CreateUserResult, String> {
    let username = params.username.trim().to_string();
    if username.is_empty() { return Err("用户名不能为空".to_string()); }
    if params.real_name.trim().is_empty() { return Err("姓名不能为空".to_string()); }

    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("user_manage")?;

    let exists: bool = conn.query_row("SELECT COUNT(*) > 0 FROM users WHERE username = ?1", params![username], |row| row.get(0)).unwrap_or(false);
    if exists { return Err("用户名已存在".to_string()); }

    let id = uuid::Uuid::new_v4().to_string();
    let hashed_pwd = hash_password(&params.password)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO users (id, username, password_hash, real_name, phone, email, status, must_change_password) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 1)", params![id, username, hashed_pwd, params.real_name, params.phone, params.email]).map_err(|e| translate_db_error(e))?;
    if let Some(ref role_ids) = params.role_ids {
        for role_id in role_ids {
            let ur_id = uuid::Uuid::new_v4().to_string();
            tx.execute("INSERT INTO user_roles (id, user_id, role_id) VALUES (?1, ?2, ?3)", params![ur_id, id, role_id]).map_err(|e| translate_db_error(e))?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    let user = query_user_by_id(conn, &id)?;
    crate::operation_logs::record_operation_log(conn, &ctx.username, "create", "创建用户", "用户管理", Some(&format!("用户名: {}", username)));
    Ok(CreateUserResult { user, generated_password: None })
}

/// 更新用户信息业务逻辑（DELETE+INSERT角色包裹在事务中）
fn update_user_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: UpdateUserParams) -> Result<UserItem, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    let is_self = ctx.user_id == params.id;
    if !is_self { ctx.require_permission("user_manage")?; }
    if is_self && params.role_ids.is_some() { return Err("不能修改自己的角色".to_string()); }
    if is_super_admin(conn, &params.id) && params.role_ids.is_some() { return Err("系统管理员角色不可修改".to_string()); }

    conn.execute("UPDATE users SET real_name = COALESCE(?1, real_name), phone = COALESCE(?2, phone), email = COALESCE(?3, email), updated_at = datetime('now', 'localtime') WHERE id = ?4", params![params.real_name, params.phone, params.email, params.id]).map_err(|e| translate_db_error(e))?;

    if let Some(ref role_ids) = params.role_ids {
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM user_roles WHERE user_id = ?1", params![params.id]).map_err(|e| translate_db_error(e))?;
        for role_id in role_ids {
            let ur_id = uuid::Uuid::new_v4().to_string();
            tx.execute("INSERT INTO user_roles (id, user_id, role_id) VALUES (?1, ?2, ?3)", params![ur_id, params.id, role_id]).map_err(|e| translate_db_error(e))?;
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    let user = query_user_by_id(conn, &params.id)?;
    crate::operation_logs::record_operation_log(conn, &ctx.username, "update", "更新用户", "用户管理", Some(&format!("用户ID: {}", params.id)));
    Ok(user)
}

/// 删除用户业务逻辑
fn delete_user_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, id: &str) -> Result<(), String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("user_manage")?;
    if ctx.user_id == id { return Err("不能删除自己的账号".to_string()); }
    if is_super_admin(conn, id) { return Err("系统管理员不可删除".to_string()); }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM user_roles WHERE user_id = ?1", params![id]).map_err(|e| translate_db_error(e))?;
    tx.execute("DELETE FROM users WHERE id = ?1", params![id]).map_err(|e| translate_db_error(e))?;
    tx.commit().map_err(|e| e.to_string())?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "delete", "删除用户", "用户管理", Some(&format!("用户ID: {}", id)));
    Ok(())
}

/// 切换用户状态业务逻辑（启用/禁用），验证status只能为0或1
fn toggle_user_status_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: ToggleUserStatusParams) -> Result<(), String> {
    if params.status != 0 && params.status != 1 { return Err("状态值无效，只能为0（禁用）或1（启用）".to_string()); }
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("user_manage")?;
    if ctx.user_id == params.id { return Err("不能禁用自己的账号".to_string()); }
    if is_super_admin(conn, &params.id) { return Err("系统管理员不可禁用".to_string()); }

    conn.execute("UPDATE users SET status = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2", params![params.status, params.id]).map_err(|e| translate_db_error(e))?;
    crate::operation_logs::record_operation_log(conn, &ctx.username, "update", "切换用户状态", "用户管理", Some(&format!("用户ID: {}, 状态: {}", params.id, if params.status == 1 { "启用" } else { "禁用" })));
    Ok(())
}

/// 重置用户密码业务逻辑
fn reset_user_password_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: ResetPasswordParams) -> Result<(), String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("user_manage")?;
    let hashed = hash_password(&params.new_password)?;
    // 合并为单条UPDATE，避免多条独立UPDATE的事务风险
    conn.execute(
        "UPDATE users SET password_hash = ?1, must_change_password = 1, password_version = password_version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
        params![hashed, params.id],
    ).map_err(|e| format!("重置密码失败: {}", e))?;
    crate::operation_logs::record_operation_log(conn, &ctx.username, "update", "重置用户密码", "用户管理", Some(&format!("用户ID: {}", params.id)));
    Ok(())
}

// ========== Tauri命令（薄包装，调用_logic函数） ==========

/// 获取用户列表（分页+筛选）
#[tauri::command]
pub fn get_users(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: GetUsersParams) -> Result<GetUsersResult, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    get_users_logic(&conn, &token_secret, &token, params)
}

/// 创建用户（INSERT用户+角色分配包裹在事务中）
#[tauri::command]
pub fn create_user(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: CreateUserParams) -> Result<CreateUserResult, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    create_user_logic(&conn, &token_secret, &token, params)
}

/// 更新用户信息（DELETE+INSERT角色包裹在事务中）
#[tauri::command]
pub fn update_user(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: UpdateUserParams) -> Result<UserItem, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    update_user_logic(&conn, &token_secret, &token, params)
}

/// 删除用户
#[tauri::command]
pub fn delete_user(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, id: String) -> Result<(), String> {
    let conn = crate::database::get_conn_ref(&db)?;
    delete_user_logic(&conn, &token_secret, &token, &id)
}

/// 切换用户状态（启用/禁用），验证status只能为0或1
#[tauri::command]
pub fn toggle_user_status(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: ToggleUserStatusParams) -> Result<(), String> {
    let conn = crate::database::get_conn_ref(&db)?;
    toggle_user_status_logic(&conn, &token_secret, &token, params)
}

/// 重置用户密码
#[tauri::command]
pub fn reset_user_password(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: ResetPasswordParams) -> Result<(), String> {
    let conn = crate::database::get_conn_ref(&db)?;
    reset_user_password_logic(&conn, &token_secret, &token, params)
}

/// 生成随机密码（委托给database模块的统一实现）
#[tauri::command]
pub fn generate_random_password() -> String {
    crate::database::generate_random_password()
}

// ========== 服务端模式内部函数（不依赖Tauri State） ==========

/// 服务端模式：获取用户列表
#[cfg(feature = "server")]
pub fn get_users_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: GetUsersParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    let result = get_users_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：创建用户
#[cfg(feature = "server")]
pub fn create_user_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: CreateUserParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    let result = create_user_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：更新用户
#[cfg(feature = "server")]
pub fn update_user_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: UpdateUserParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    let result = update_user_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：删除用户
#[cfg(feature = "server")]
pub fn delete_user_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    delete_user_logic(conn, secret, &crate::error_util::arg_str(args, "token"), &crate::error_util::arg_str(args, "id"))?;
    Ok(serde_json::json!({"success": true}))
}

/// 服务端模式：切换用户状态
#[cfg(feature = "server")]
pub fn toggle_user_status_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: ToggleUserStatusParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    toggle_user_status_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    Ok(serde_json::json!({"success": true}))
}

/// 服务端模式：重置用户密码
#[cfg(feature = "server")]
pub fn reset_user_password_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: ResetPasswordParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    reset_user_password_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    Ok(serde_json::json!({"success": true}))
}

/// 服务端模式：生成随机密码
#[cfg(feature = "server")]
pub fn generate_random_password_inner() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({"password": generate_random_password()}))
}

// ========== 单元测试 ==========

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;

    #[test]
    fn test_批量加载用户角色_空列表() {
        let conn = test_utils::create_test_db();
        let result = batch_load_user_roles(&conn, &[]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_批量加载用户角色_存在的用户() {
        let conn = test_utils::create_test_db();

        // admin用户在迁移中已关联admin角色
        let admin_id: String = conn.query_row(
            "SELECT id FROM users WHERE username = 'admin'", [], |row| row.get(0)
        ).unwrap();

        let result = batch_load_user_roles(&conn, &[admin_id.clone()]);
        assert!(result.contains_key(&admin_id));
        let roles = &result[&admin_id];
        assert!(!roles.is_empty());
        // admin角色名应为"admin"
        assert!(roles.iter().any(|r| r.name == "admin"));
    }

    #[test]
    fn test_批量加载用户角色_不存在的用户() {
        let conn = test_utils::create_test_db();
        let fake_id = "non-existent-user-id".to_string();
        let result = batch_load_user_roles(&conn, &[fake_id.clone()]);
        // 不存在的用户应返回空角色列表
        assert!(result.get(&fake_id).is_none() || result[&fake_id].is_empty());
    }

    #[test]
    fn test_批量加载用户角色_多用户混合() {
        let conn = test_utils::create_test_db();

        let admin_id: String = conn.query_row(
            "SELECT id FROM users WHERE username = 'admin'", [], |row| row.get(0)
        ).unwrap();

        // 创建普通用户，不分配角色
        let normal_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, real_name, status) VALUES (?1, ?2, ?3, '普通用户', 1)",
            rusqlite::params![normal_id, "normal_user", crate::auth::hash_password("123456").unwrap()],
        ).unwrap();

        let result = batch_load_user_roles(&conn, &[admin_id.clone(), normal_id.clone()]);
        assert!(result.contains_key(&admin_id));
        assert!(!result[&admin_id].is_empty());
        // 普通用户没有角色
        assert!(result.get(&normal_id).is_none() || result[&normal_id].is_empty());
    }
}
