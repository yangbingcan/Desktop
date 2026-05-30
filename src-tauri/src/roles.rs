/** @file 角色管理 - 角色CRUD、权限分配（含鉴权） */

use crate::auth::verify_and_get_context;
use crate::database::DbState;
use crate::error_util::translate_db_error;
use crate::models::{PermissionItem, RoleItem};
use rusqlite::{params, Row};
use tauri::State;

fn all_permissions() -> Vec<PermissionItem> {
    vec![
        PermissionItem { key: "dashboard".into(), label: "仪表盘".into(), group: "功能权限".into() },
        PermissionItem { key: "form_designer".into(), label: "表单设计器".into(), group: "功能权限".into() },
        PermissionItem { key: "data_center".into(), label: "数据中心".into(), group: "功能权限".into() },
        PermissionItem { key: "workflow".into(), label: "流程管理".into(), group: "功能权限".into() },
        PermissionItem { key: "permission".into(), label: "权限管理".into(), group: "功能权限".into() },
        PermissionItem { key: "user_manage".into(), label: "用户管理".into(), group: "功能权限".into() },
        PermissionItem { key: "settings".into(), label: "系统设置".into(), group: "功能权限".into() },
    ]
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
pub fn get_roles(db: State<'_, DbState>, token: String, keyword: Option<String>) -> Result<Vec<RoleItem>, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
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

    let items = raws.into_iter().map(|raw| raw_to_role_item(conn, raw)).collect();
    Ok(items)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateRoleParams {
    pub name: String,
    pub description: Option<String>,
    pub permission_keys: Option<Vec<String>>,
}

#[tauri::command]
pub fn create_role(db: State<'_, DbState>, token: String, params: CreateRoleParams) -> Result<RoleItem, String> {
    let name = params.name.trim().to_string();
    if name.is_empty() {
        return Err("角色名称不能为空".to_string());
    }

    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
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
                "INSERT INTO role_permissions (id, role_id, permission_key) VALUES (?1, ?2, ?3)",
                params![perm_id, id, key],
            ).map_err(|e| translate_db_error(e))?;
        }
    }

    Ok(RoleItem {
        id,
        name,
        description: params.description.unwrap_or_default(),
        is_system: false,
        permissions: params.permission_keys.unwrap_or_default(),
        user_count: 0,
        created_at: String::new(),
    })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UpdateRoleParams {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub permission_keys: Option<Vec<String>>,
}

#[tauri::command]
pub fn update_role(db: State<'_, DbState>, token: String, params: UpdateRoleParams) -> Result<RoleItem, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
    ctx.require_permission("permission")?;

    let is_system: bool = conn.query_row(
        "SELECT is_system FROM roles WHERE id = ?1",
        params![params.id],
        |row| row.get::<_, i32>(0),
    ).map(|v| v != 0).unwrap_or(false);
    if is_system {
        return Err("系统角色不可修改".to_string());
    }

    if let Some(ref name) = params.name {
        let trimmed = name.trim().to_string();
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM roles WHERE name = ?1 AND id != ?2",
            params![trimmed, params.id],
            |row| row.get(0),
        ).unwrap_or(false);
        if exists {
            return Err("角色名称已存在".to_string());
        }
    }

    conn.execute(
        "UPDATE roles SET name = COALESCE(?1, name), description = COALESCE(?2, description), updated_at = datetime('now', 'localtime') WHERE id = ?3",
        params![params.name, params.description, params.id],
    ).map_err(|e| translate_db_error(e))?;

    if let Some(ref keys) = params.permission_keys {
        conn.execute("DELETE FROM role_permissions WHERE role_id = ?1", params![params.id])
            .map_err(|e| translate_db_error(e))?;
        for key in keys {
            let perm_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO role_permissions (id, role_id, permission_key) VALUES (?1, ?2, ?3)",
                params![perm_id, params.id, key],
            ).map_err(|e| translate_db_error(e))?;
        }
    }

    let raw = conn.query_row(
        "SELECT id, name, description, is_system, created_at FROM roles WHERE id = ?1",
        params![params.id],
        |row| row_to_role_raw(row),
    ).map_err(|e| translate_db_error(e))?;

    Ok(raw_to_role_item(conn, raw))
}

#[tauri::command]
pub fn delete_role(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = conn.as_ref().ok_or("数据库未初始化")?;

    let ctx = verify_and_get_context(conn, &token)?;
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

    Ok(())
}

#[tauri::command]
pub fn get_permissions() -> Vec<PermissionItem> {
    all_permissions()
}
