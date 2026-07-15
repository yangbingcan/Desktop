/** @file 角色管理 - 角色CRUD、权限分配（含鉴权） */

use crate::auth::verify_and_get_context;
use crate::database::{DbState, get_conn};
use crate::error_util::translate_db_error;
use crate::models::{PermissionItem, RoleItem, RoleBrief};
use rusqlite::{params, Row};

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
        ("dashboard", "仪表盘", "仪表盘"),
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

fn load_role_permissions(conn: &rusqlite::Connection, role_id: &str) -> Vec<String> {
    let mut stmt = match conn.prepare(
        "SELECT permission_key FROM role_permissions WHERE role_id = ?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mapped = match stmt.query_map(params![role_id], |row: &Row| row.get(0)) {
        Ok(m) => m,
        Err(_) => return vec![],
    };
    mapped.filter_map(|r: Result<String, _>| r.ok()).collect()
}

fn count_role_users(conn: &rusqlite::Connection, role_id: &str) -> i32 {
    conn.query_row(
        "SELECT COUNT(*) FROM user_roles WHERE role_id = ?1",
        params![role_id],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

struct RoleItemRaw {
    id: String,
    name: String,
    description: String,
    is_system: bool,
    created_at: String,
}

fn row_to_role_raw(row: &Row) -> Result<RoleItemRaw, rusqlite::Error> {
    Ok(RoleItemRaw {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2).unwrap_or_default(),
        is_system: row.get::<_, i32>(3)? != 0,
        created_at: row.get(4)?,
    })
}

fn raw_to_role_item(conn: &rusqlite::Connection, raw: RoleItemRaw) -> RoleItem {
    let perms = load_role_permissions(conn, &raw.id);
    let uc = count_role_users(conn, &raw.id);
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

#[tauri::command]
pub fn get_roles(db: tauri::State<'_, DbState>, token: String, keyword: Option<String>) -> Result<Vec<RoleItem>, String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
    ctx.require_permission("permission")?;

    let sql = if let Some(ref kw) = keyword {
        if !kw.is_empty() {
            "SELECT id, name, description, is_system, created_at FROM roles WHERE name LIKE ?1 ORDER BY created_at DESC"
        } else {
            "SELECT id, name, description, is_system, created_at FROM roles ORDER BY created_at DESC"
        }
    } else {
        "SELECT id, name, description, is_system, created_at FROM roles ORDER BY created_at DESC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| translate_db_error(e))?;

    let raws: Vec<RoleItemRaw> = if let Some(ref kw) = keyword {
        if !kw.is_empty() {
            let pattern = format!("%{}%", kw);
            let mapped = stmt.query_map(params![pattern], |row: &Row| row_to_role_raw(row))
                .map_err(|e| translate_db_error(e))?;
            mapped.filter_map(|r| r.ok()).collect()
        } else {
            let mapped = stmt.query_map([], |row: &Row| row_to_role_raw(row))
                .map_err(|e| translate_db_error(e))?;
            mapped.filter_map(|r| r.ok()).collect()
        }
    } else {
        let mapped = stmt.query_map([], |row: &Row| row_to_role_raw(row))
            .map_err(|e| translate_db_error(e))?;
        mapped.filter_map(|r| r.ok()).collect()
    };

    let items = raws.into_iter().map(|raw| raw_to_role_item(&conn, raw)).collect();

    Ok(items)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateRoleParams {
    pub name: String,
    pub description: Option<String>,
    pub permission_keys: Option<Vec<String>>,
}

#[tauri::command]
pub fn create_role(db: tauri::State<'_, DbState>, token: String, params: CreateRoleParams) -> Result<RoleItem, String> {
    let name = params.name.trim().to_string();
    if name.is_empty() {
        return Err("角色名称不能为空".to_string());
    }

    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
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
    conn.execute(
        "INSERT INTO roles (id, name, description) VALUES (?1, ?2, ?3)",
        params![id, name, desc],
    ).map_err(|e| translate_db_error(e))?;

    if let Some(ref keys) = params.permission_keys {
        for key in keys {
            let perm_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO role_permissions (id, role_id, role_name, permission_key) VALUES (?1, ?2, ?3, ?4)",
                params![perm_id, id, name, key],
            ).map_err(|e| translate_db_error(e))?;
        }
    }

    let raw = conn.query_row(
        "SELECT id, name, description, is_system, created_at FROM roles WHERE id = ?1",
        params![id],
        |row| row_to_role_raw(row),
    ).map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(&conn, &ctx.username, "create", "创建角色", "角色权限", Some(&format!("角色: {}", name)));

    Ok(raw_to_role_item(&conn, raw))
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UpdateRoleParams {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub permission_keys: Option<Vec<String>>,
}

#[tauri::command]
pub fn update_role(db: tauri::State<'_, DbState>, token: String, params: UpdateRoleParams) -> Result<RoleItem, String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
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
        conn.execute("DELETE FROM role_permissions WHERE role_id = ?1", params![params.id])
            .map_err(|e| translate_db_error(e))?;
        for key in keys {
            let perm_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO role_permissions (id, role_id, role_name, permission_key) VALUES (?1, ?2, ?3, ?4)",
                params![perm_id, params.id, effective_name, key],
            ).map_err(|e| translate_db_error(e))?;
        }
    }

    let raw = conn.query_row(
        "SELECT id, name, description, is_system, created_at FROM roles WHERE id = ?1",
        params![params.id],
        |row| row_to_role_raw(row),
    ).map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(&conn, &ctx.username, "update", "更新角色", "角色权限", Some(&format!("角色ID: {}", params.id)));

    Ok(raw_to_role_item(&conn, raw))
}

#[tauri::command]
pub fn delete_role(db: tauri::State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
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

    conn.execute("DELETE FROM user_roles WHERE role_id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;
    conn.execute("DELETE FROM role_permissions WHERE role_id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;
    conn.execute("DELETE FROM roles WHERE id = ?1", params![id])
        .map_err(|e| translate_db_error(e))?;

    crate::operation_logs::record_operation_log(&conn, &ctx.username, "delete", "删除角色", "角色权限", Some(&format!("角色ID: {}", id)));

    Ok(())
}

#[tauri::command]
pub fn get_role_options(db: tauri::State<'_, DbState>, token: String) -> Result<Vec<RoleBrief>, String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
    ctx.require_permission("user_manage")?;

    let mut stmt = conn.prepare("SELECT id, name FROM roles ORDER BY created_at DESC")
        .map_err(|e| translate_db_error(e))?;
    let items: Vec<RoleBrief> = stmt.query_map([], |row: &Row| {
        Ok(RoleBrief {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    }).map_err(|e| translate_db_error(e))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(items)
}

#[tauri::command]
pub fn get_permissions() -> Vec<PermissionItem> {
    all_permissions()
}
