/** @file 商品分类管理 - CRUD */

use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Clone)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub level: i64,
    pub sort_order: i64,
}

#[derive(Deserialize)]
pub struct CategoryInput {
    pub name: String,
    pub parent_id: Option<String>,
    pub level: i64,
    pub sort_order: Option<i64>,
}

#[tauri::command]
pub fn get_categories(db: State<'_, DbState>, token: String) -> Result<Vec<Category>, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let mut stmt = conn
        .prepare("SELECT id, name, parent_id, level, sort_order FROM product_categories ORDER BY level, sort_order")
        .map_err(|e| e.to_string())?;
    let list: Vec<Category> = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                level: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(list)
}

#[tauri::command]
pub fn create_category(db: State<'_, DbState>, token: String, input: CategoryInput) -> Result<String, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let id = format!("cat-{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
    conn.execute(
        "INSERT INTO product_categories (id, name, parent_id, level, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, input.name, input.parent_id, input.level, input.sort_order.unwrap_or(0)],
    )
    .map_err(|e| format!("创建分类失败: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub fn update_category(db: State<'_, DbState>, token: String, id: String, input: CategoryInput) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    conn.execute(
        "UPDATE product_categories SET name = ?1, parent_id = ?2, level = ?3, sort_order = ?4, updated_at = datetime('now') WHERE id = ?5",
        params![input.name, input.parent_id, input.level, input.sort_order.unwrap_or(0), id],
    )
    .map_err(|e| format!("更新分类失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_category(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    conn.execute("DELETE FROM product_categories WHERE id = ?1", params![id])
        .map_err(|e| format!("删除分类失败: {}", e))?;

    Ok(())
}
