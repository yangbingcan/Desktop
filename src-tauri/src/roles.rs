//! 角色管理 - 角色CRUD、权限分配

use std::collections::HashMap;

use crate::auth::verify_and_get_context;
use crate::database::{DbState, TokenSecret};
use crate::error_util::translate_db_error;
use crate::models::{PermissionItem, RoleItem, RoleBrief};
use rusqlite::{params, Row};
use tauri::State;

/// 生成所有权限项（模块+动作组合）
fn all_permissions() -> Vec<PermissionItem> {
    let actions: &[(&str, &str)] = &[
        ("view", "查看"),
        ("add", "新增"),
        ("edit", "修改"),
        ("delete", "删除"),
        ("audit", "审核"),
        ("unaudit", "消审"),
        ("void", "冲单"),
        ("edit_date", "修改业务日期"),
        ("edit_other", "修改其他信息"),
        ("preview", "预览"),
        ("print", "打印"),
        ("design_report", "设计报表"),
        ("import", "导入"),
        ("export", "导出"),
        ("terminate", "终止"),
    ];

    let modules: &[(&str, &str, &str)] = &[
        ("dashboard", "工作台", "我的工作台"),
        ("permission", "权限管理", "系统管理"),
        ("user_manage", "用户管理", "系统管理"),
        ("settings", "系统设置", "系统管理"),
        ("system_log", "系统日志", "系统管理"),
    ];

    let mut result = Vec::new();
    for &(module, module_label, group) in modules {
        for &(action, action_label) in actions {
            result.push(PermissionItem {
                key: format!("{}:{}", module, action),
                label: format!("{}-{}", module_label, action_label),
                group: group.to_string(),
                module: module.to_string(),
                module_label: module_label.to_string(),
                action: action.to_string(),
            });
        }
    }
    result
}

/// 返回所有模块的key列表（去重），供超级管理员权限判断使用
pub fn all_module_keys() -> Vec<String> {
    let modules: &[&str] = &["dashboard", "permission", "user_manage", "settings", "system_log"];
    modules.iter().map(|s| s.to_string()).collect()
}

/// 批量加载多个角色的权限列表，解决N+1查询问题
fn batch_load_role_permissions(conn: &rusqlite::Connection, role_ids: &[String]) -> HashMap<String, Vec<String>> {
    if role_ids.is_empty() {
        return HashMap::new();
    }
    let placeholders: Vec<&str> = role_ids.iter().map(|_| "?").collect();
    let sql = format!(
        "SELECT role_id, permission_key FROM role_permissions WHERE role_id IN ({})",
        placeholders.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = role_ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    let mapped = match stmt.query_map(param_refs.as_slice(), |row: &Row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
        ))
    }) {
        Ok(m) => m,
        Err(_) => return HashMap::new(),
    };
    let mut result: HashMap<String, Vec<String>> = HashMap::new();
    for item in mapped.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()) {
        result.entry(item.0).or_default().push(item.1);
    }
    result
}

/// 批量统计多个角色的用户数，解决N+1查询问题
fn batch_count_role_users(conn: &rusqlite::Connection, role_ids: &[String]) -> HashMap<String, i32> {
    if role_ids.is_empty() {
        return HashMap::new();
    }
    let placeholders: Vec<&str> = role_ids.iter().map(|_| "?").collect();
    let sql = format!(
        "SELECT role_id, COUNT(*) FROM user_roles WHERE role_id IN ({}) GROUP BY role_id",
        placeholders.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = role_ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    let mapped = match stmt.query_map(param_refs.as_slice(), |row: &Row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i32>(1)?,
        ))
    }) {
        Ok(m) => m,
        Err(_) => return HashMap::new(),
    };
    let mut result: HashMap<String, i32> = HashMap::new();
    for item in mapped.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()) {
        result.insert(item.0, item.1);
    }
    result
}

/// 角色原始数据（不含权限和用户数）
struct RoleItemRaw {
    id: String,
    name: String,
    description: String,
    is_system: bool,
    created_at: String,
}

/// 将数据库行映射为RoleItemRaw
fn row_to_role_raw(row: &Row) -> Result<RoleItemRaw, rusqlite::Error> {
    Ok(RoleItemRaw {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2).unwrap_or_default(),
        is_system: row.get::<_, i32>(3)? != 0,
        created_at: row.get(4)?,
    })
}

/// 根据批量加载的权限和用户数构建完整RoleItem（统一构造逻辑，避免重复）
fn build_role_item(raw: RoleItemRaw, perms_map: &HashMap<String, Vec<String>>, users_map: &HashMap<String, i32>) -> RoleItem {
    let perms = perms_map.get(&raw.id).cloned().unwrap_or_default();
    let uc = users_map.get(&raw.id).copied().unwrap_or(0);
    RoleItem {
        id: raw.id,
        name: raw.name,
        description: raw.description,
        is_system: raw.is_system,
        permissions: perms,
        user_count: uc,
        created_at: raw.created_at,
    }
}

/// 将原始数据转为完整RoleItem（单条查询权限和用户数，用于创建/更新后返回）
fn raw_to_role_item(conn: &rusqlite::Connection, raw: RoleItemRaw) -> RoleItem {
    let role_ids = vec![raw.id.clone()];
    let perms_map = batch_load_role_permissions(conn, &role_ids);
    let users_map = batch_count_role_users(conn, &role_ids);
    build_role_item(raw, &perms_map, &users_map)
}

// ========== 业务逻辑函数（Tauri命令和服务端模式共用） ==========

/// 获取角色列表业务逻辑
pub fn get_roles_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, keyword: Option<String>) -> Result<Vec<RoleItem>, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("permission")?;

    // 根据是否有关键词选择SQL和参数
    let has_keyword = keyword.as_ref().map_or(false, |kw| !kw.is_empty());
    let sql = if has_keyword {
        "SELECT id, name, description, is_system, created_at FROM roles WHERE name LIKE ?1 ORDER BY created_at DESC"
    } else {
        "SELECT id, name, description, is_system, created_at FROM roles ORDER BY created_at DESC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| translate_db_error(e))?;

    let raws: Vec<RoleItemRaw> = if let Some(ref kw) = keyword {
        if !kw.is_empty() {
            let pattern = format!("%{}%", kw);
            let mapped = stmt.query_map(params![pattern], |row: &Row| row_to_role_raw(row))
                .map_err(|e| translate_db_error(e))?;
            mapped.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()).collect()
        } else {
            let mapped = stmt.query_map([], |row: &Row| row_to_role_raw(row))
                .map_err(|e| translate_db_error(e))?;
            mapped.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()).collect()
        }
    } else {
        let mapped = stmt.query_map([], |row: &Row| row_to_role_raw(row))
            .map_err(|e| translate_db_error(e))?;
        mapped.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()).collect()
    };

    // 批量加载权限和用户数，避免N+1查询
    let role_ids: Vec<String> = raws.iter().map(|r| r.id.clone()).collect();
    let perms_map = batch_load_role_permissions(conn, &role_ids);
    let users_map = batch_count_role_users(conn, &role_ids);

    let items: Vec<RoleItem> = raws.into_iter().map(|raw| build_role_item(raw, &perms_map, &users_map)).collect();
    Ok(items)
}

/// 创建角色业务逻辑
pub fn create_role_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: CreateRoleParams) -> Result<RoleItem, String> {
    let name = params.name.trim().to_string();
    if name.is_empty() {
        return Err("角色名称不能为空".to_string());
    }

    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("permission")?;

    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM roles WHERE name = ?1",
        params![name],
        |row| row.get(0),
    ).unwrap_or(false);
    if exists {
        return Err("角色名称已存在".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let desc = params.description.clone().unwrap_or_default();

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO roles (id, name, description) VALUES (?1, ?2, ?3)",
        params![id, name, desc],
    ).map_err(|e| translate_db_error(e))?;

    if let Some(ref keys) = params.permission_keys {
        for key in keys {
            let perm_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO role_permissions (id, role_id, role_name, permission_key) VALUES (?1, ?2, ?3, ?4)",
                params![perm_id, id, name, key],
            ).map_err(|e| translate_db_error(e))?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    let raw = conn.query_row(
        "SELECT id, name, description, is_system, created_at FROM roles WHERE id = ?1",
        params![id],
        |row| row_to_role_raw(row),
    ).map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "create", "创建角色", "角色权限", Some(&format!("角色: {}", name)));

    Ok(raw_to_role_item(conn, raw))
}

/// 更新角色业务逻辑
pub fn update_role_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: UpdateRoleParams) -> Result<RoleItem, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("permission")?;

    let is_system: bool = conn.query_row(
        "SELECT is_system FROM roles WHERE id = ?1",
        params![params.id],
        |row| row.get::<_, i32>(0),
    ).map(|v| v != 0).unwrap_or(false);
    if is_system {
        return Err("系统角色不可修改".to_string());
    }

    let current_name: String = conn.query_row(
        "SELECT name FROM roles WHERE id = ?1",
        params![params.id],
        |row| row.get(0),
    ).map_err(|e| translate_db_error(e))?;

    let new_name = params.name.as_deref().map(|n| n.trim()).filter(|n| !n.is_empty());
    if let Some(n) = new_name {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM roles WHERE name = ?1 AND id != ?2",
            params![n, params.id],
            |row| row.get(0),
        ).unwrap_or(false);
        if exists {
            return Err("角色名称已存在".to_string());
        }
    }

    let effective_name = new_name.unwrap_or(&current_name);

    conn.execute(
        "UPDATE roles SET name = ?1, description = COALESCE(?2, description), updated_at = datetime('now', 'localtime') WHERE id = ?3",
        params![effective_name, params.description, params.id],
    ).map_err(|e| translate_db_error(e))?;

    if let Some(ref keys) = params.permission_keys {
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM role_permissions WHERE role_id = ?1", params![params.id])
            .map_err(|e| translate_db_error(e))?;
        for key in keys {
            let perm_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO role_permissions (id, role_id, role_name, permission_key) VALUES (?1, ?2, ?3, ?4)",
                params![perm_id, params.id, effective_name, key],
            ).map_err(|e| translate_db_error(e))?;
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    let raw = conn.query_row(
        "SELECT id, name, description, is_system, created_at FROM roles WHERE id = ?1",
        params![params.id],
        |row| row_to_role_raw(row),
    ).map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "update", "更新角色", "角色权限", Some(&format!("角色ID: {}", params.id)));

    Ok(raw_to_role_item(conn, raw))
}

/// 删除角色业务逻辑（三表删除包裹在事务中，保证原子性）
pub fn delete_role_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, id: &str) -> Result<(), String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("permission")?;

    let is_system: bool = conn.query_row(
        "SELECT is_system FROM roles WHERE id = ?1",
        params![id],
        |row| row.get::<_, i32>(0),
    ).map(|v| v != 0).unwrap_or(false);
    if is_system {
        return Err("系统角色不可删除".to_string());
    }

    let user_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM user_roles WHERE role_id = ?1",
        params![id],
        |row| row.get(0),
    ).unwrap_or(0);
    if user_count > 0 {
        return Err(format!("该角色已分配给 {} 个用户，请先移除用户角色后再删除", user_count));
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM user_roles WHERE role_id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;
    tx.execute("DELETE FROM role_permissions WHERE role_id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;
    tx.execute("DELETE FROM roles WHERE id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;
    tx.commit().map_err(|e| e.to_string())?;

    crate::operation_logs::record_operation_log(conn, &ctx.username, "delete", "删除角色", "角色权限", Some(&format!("角色ID: {}", id)));

    Ok(())
}

/// 获取角色选项列表业务逻辑
pub fn get_role_options_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str) -> Result<Vec<RoleBrief>, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("user_manage")?;

    let mut stmt = conn.prepare("SELECT id, name FROM roles ORDER BY created_at DESC")
        .map_err(|e| translate_db_error(e))?;
    let items: Vec<RoleBrief> = stmt.query_map([], |row: &Row| {
        Ok(RoleBrief {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    }).map_err(|e| translate_db_error(e))?
    .filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok())
    .collect();

    Ok(items)
}

// ========== Tauri 命令（薄包装，调用 _logic 函数） ==========

/// 获取角色列表
#[tauri::command]
pub fn get_roles(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, keyword: Option<String>) -> Result<Vec<RoleItem>, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    get_roles_logic(&conn, &token_secret, &token, keyword)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateRoleParams {
    pub name: String,
    pub description: Option<String>,
    pub permission_keys: Option<Vec<String>>,
}

/// 创建角色
#[tauri::command]
pub fn create_role(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: CreateRoleParams) -> Result<RoleItem, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    create_role_logic(&conn, &token_secret, &token, params)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UpdateRoleParams {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub permission_keys: Option<Vec<String>>,
}

/// 更新角色
#[tauri::command]
pub fn update_role(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: UpdateRoleParams) -> Result<RoleItem, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    update_role_logic(&conn, &token_secret, &token, params)
}

/// 删除角色
#[tauri::command]
pub fn delete_role(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, id: String) -> Result<(), String> {
    let conn = crate::database::get_conn_ref(&db)?;
    delete_role_logic(&conn, &token_secret, &token, &id)
}

/// 获取角色选项列表（用于下拉选择）
#[tauri::command]
pub fn get_role_options(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String) -> Result<Vec<RoleBrief>, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    get_role_options_logic(&conn, &token_secret, &token)
}

/// 获取所有权限定义
#[tauri::command]
pub fn get_permissions() -> Vec<PermissionItem> {
    all_permissions()
}

// ========== 服务端模式内部函数（解析参数，调用 _logic，序列化结果） ==========

/// 服务端模式：获取角色列表
#[cfg(feature = "server")]
pub fn get_roles_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let keyword: Option<String> = args.get("keyword").and_then(|v| v.as_str()).map(|s| s.to_string());
    let result = get_roles_logic(conn, secret, &crate::error_util::arg_str(args, "token"), keyword)?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：创建角色
#[cfg(feature = "server")]
pub fn create_role_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: CreateRoleParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    let result = create_role_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：更新角色
#[cfg(feature = "server")]
pub fn update_role_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: UpdateRoleParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    let result = update_role_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：删除角色
#[cfg(feature = "server")]
pub fn delete_role_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    delete_role_logic(conn, secret, &crate::error_util::arg_str(args, "token"), &crate::error_util::arg_str(args, "id"))?;
    Ok(serde_json::json!({"success": true}))
}

/// 服务端模式：获取所有权限定义
#[cfg(feature = "server")]
pub fn get_permissions_inner() -> Result<serde_json::Value, String> {
    serde_json::to_value(all_permissions()).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：获取角色选项列表
#[cfg(feature = "server")]
pub fn get_role_options_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let result = get_role_options_logic(conn, secret, &crate::error_util::arg_str(args, "token"))?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

// ========== 单元测试 ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_module_keys返回值() {
        let keys = all_module_keys();
        // 应包含5个模块
        assert_eq!(keys.len(), 5);
        // 验证所有预期的模块key存在
        assert!(keys.contains(&"dashboard".to_string()));
        assert!(keys.contains(&"permission".to_string()));
        assert!(keys.contains(&"user_manage".to_string()));
        assert!(keys.contains(&"settings".to_string()));
        assert!(keys.contains(&"system_log".to_string()));
    }

    #[test]
    fn test_all_permissions返回值结构() {
        let perms = all_permissions();
        // 5个模块 × 15个动作 = 75个权限项
        assert_eq!(perms.len(), 75);

        // 验证每个权限项结构完整
        for perm in &perms {
            assert!(!perm.key.is_empty(), "权限key不应为空");
            assert!(!perm.label.is_empty(), "权限label不应为空");
            assert!(!perm.group.is_empty(), "权限group不应为空");
            assert!(!perm.module.is_empty(), "权限module不应为空");
            assert!(!perm.module_label.is_empty(), "权限module_label不应为空");
            assert!(!perm.action.is_empty(), "权限action不应为空");
            // key格式应为 module:action
            assert!(perm.key.contains(':'), "权限key应包含冒号分隔符");
        }
    }

    #[test]
    fn test_all_permissions模块分组() {
        let perms = all_permissions();

        // 验证各模块的权限数量
        let dashboard_count = perms.iter().filter(|p| p.module == "dashboard").count();
        let permission_count = perms.iter().filter(|p| p.module == "permission").count();
        let user_manage_count = perms.iter().filter(|p| p.module == "user_manage").count();
        let settings_count = perms.iter().filter(|p| p.module == "settings").count();
        let system_log_count = perms.iter().filter(|p| p.module == "system_log").count();

        // 每个模块都应有15个动作权限
        assert_eq!(dashboard_count, 15);
        assert_eq!(permission_count, 15);
        assert_eq!(user_manage_count, 15);
        assert_eq!(settings_count, 15);
        assert_eq!(system_log_count, 15);
    }

    #[test]
    fn test_all_permissions包含基本动作() {
        let perms = all_permissions();
        let keys: Vec<&str> = perms.iter().map(|p| p.key.as_str()).collect();

        // 验证包含基本动作
        assert!(keys.iter().any(|k| k.ends_with(":view")), "应包含view动作");
        assert!(keys.iter().any(|k| k.ends_with(":add")), "应包含add动作");
        assert!(keys.iter().any(|k| k.ends_with(":edit")), "应包含edit动作");
        assert!(keys.iter().any(|k| k.ends_with(":delete")), "应包含delete动作");
    }
}
