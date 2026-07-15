/** @file 打印模板管理 - CRUD */
use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Clone)]
pub struct PrintTemplate {
    pub id: String, pub name: String, pub template_type: String,
    pub content: String, pub is_default: bool, pub created_at: String, pub updated_at: String,
}

#[derive(Deserialize)]
pub struct TemplateInput {
    pub name: String, pub template_type: String, pub content: String, pub is_default: Option<bool>,
}

#[tauri::command]
pub fn get_print_templates(db: State<'_, DbState>, token: String, template_type: Option<String>) -> Result<Vec<PrintTemplate>, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let (query, params_vec) = if let Some(ref tt) = template_type {
        ("SELECT id, name, type, content, is_default, created_at, updated_at FROM print_templates WHERE type = ?1 ORDER BY is_default DESC, created_at DESC", vec![tt.clone()])
    } else {
        ("SELECT id, name, type, content, is_default, created_at, updated_at FROM print_templates ORDER BY is_default DESC, created_at DESC", vec![])
    };
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let list: Vec<PrintTemplate> = stmt.query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
        Ok(PrintTemplate { id: row.get(0)?, name: row.get(1)?, template_type: row.get(2)?, content: row.get(3)?, is_default: row.get::<_,i32>(4)? != 0, created_at: row.get(5)?, updated_at: row.get(6)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(list)
}

#[tauri::command]
pub fn get_print_template(db: State<'_, DbState>, token: String, id: String) -> Result<PrintTemplate, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    conn.query_row("SELECT id, name, type, content, is_default, created_at, updated_at FROM print_templates WHERE id = ?1", params![id], |row| {
        Ok(PrintTemplate { id: row.get(0)?, name: row.get(1)?, template_type: row.get(2)?, content: row.get(3)?, is_default: row.get::<_,i32>(4)? != 0, created_at: row.get(5)?, updated_at: row.get(6)? })
    }).map_err(|e| format!("查询模板失败: {}", e))
}

#[tauri::command]
pub fn save_print_template(db: State<'_, DbState>, token: String, input: TemplateInput) -> Result<String, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let id = uuid::Uuid::new_v4().to_string();
    if input.is_default.unwrap_or(false) {
        conn.execute("UPDATE print_templates SET is_default = 0 WHERE type = ?1", params![input.template_type]).map_err(|e| e.to_string())?;
    }
    conn.execute("INSERT INTO print_templates (id, name, type, content, is_default) VALUES (?1,?2,?3,?4,?5)",
        params![id, input.name, input.template_type, input.content, input.is_default.unwrap_or(false) as i32]).map_err(|e| format!("保存模板失败: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub fn delete_print_template(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    conn.execute("DELETE FROM print_templates WHERE id = ?1 AND is_default = 0", params![id]).map_err(|e| format!("删除模板失败: {}", e))?;
    Ok(())
}
