/** @file 供应商管理 - CRUD */
use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Clone)]
pub struct Supplier {
    pub id: String, pub name: String, pub contact_person: Option<String>,
    pub contact_phone: Option<String>, pub address: Option<String>,
    pub main_categories: String, pub remark: String, pub is_active: bool, pub created_at: String, pub updated_at: String,
}

#[derive(Deserialize)]
pub struct SupplierInput {
    pub name: String, pub contact_person: Option<String>, pub contact_phone: Option<String>,
    pub address: Option<String>, pub main_categories: String, pub remark: Option<String>,
}

fn map_supplier(row: &rusqlite::Row) -> rusqlite::Result<Supplier> {
    Ok(Supplier { id: row.get(0)?, name: row.get(1)?, contact_person: row.get(2)?, contact_phone: row.get(3)?, address: row.get(4)?, main_categories: row.get(5)?, remark: row.get(6)?, is_active: row.get::<_,i32>(7)? != 0, created_at: row.get(8)?, updated_at: row.get(9)? })
}
const SELECT: &str = "id, name, contact_person, contact_phone, address, main_categories, remark, is_active, created_at, updated_at FROM suppliers";

#[tauri::command]
pub fn get_suppliers(db: State<'_, DbState>, token: String, page: Option<i32>, page_size: Option<i32>, keyword: Option<String>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let page = page.unwrap_or(1).max(1); let page_size = page_size.unwrap_or(20).max(1); let offset = (page - 1) * page_size;
    let (where_clause, pv): (String, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref kw) = keyword {
        if kw.is_empty() { ("WHERE 1=1".to_string(), vec![]) } else { ("WHERE name LIKE ?1 OR contact_person LIKE ?1".to_string(), vec![Box::new(format!("%{}%", kw))]) }
    } else { ("WHERE 1=1".to_string(), vec![]) };
    let total: i32 = conn.query_row(&format!("SELECT COUNT(*) FROM suppliers {}", where_clause), rusqlite::params_from_iter(pv.iter().map(|b| b.as_ref())), |r| r.get(0)).unwrap_or(0);
    let mut pr: Vec<&dyn rusqlite::ToSql> = pv.iter().map(|b| b.as_ref()).collect(); pr.push(&page_size); pr.push(&offset);
    let mut stmt = conn.prepare(&format!("SELECT {} {} ORDER BY created_at DESC LIMIT ? OFFSET ?", SELECT, where_clause)).map_err(|e| e.to_string())?;
    let list: Vec<Supplier> = stmt.query_map(rusqlite::params_from_iter(pr.iter()), map_supplier).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}

#[tauri::command]
pub fn get_all_active_suppliers(db: State<'_, DbState>, token: String) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let mut stmt = conn.prepare("SELECT id, name FROM suppliers WHERE is_active = 1 ORDER BY name").map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = stmt.query_map([], |r| Ok(serde_json::json!({ "id": r.get::<_,String>(0)?, "name": r.get::<_,String>(1)? }))).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(list)
}

#[tauri::command]
pub fn get_supplier(db: State<'_, DbState>, token: String, id: String) -> Result<Supplier, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    conn.query_row(&format!("SELECT {} WHERE id = ?1", SELECT), params![id], map_supplier).map_err(|e| format!("查询供应商失败: {}", e))
}

#[tauri::command]
pub fn create_supplier(db: State<'_, DbState>, token: String, input: SupplierInput) -> Result<String, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let id = format!("sup-{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
    conn.execute("INSERT INTO suppliers (id, name, contact_person, contact_phone, address, main_categories, remark) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, input.name, input.contact_person, input.contact_phone, input.address, input.main_categories, input.remark.unwrap_or_default()]).map_err(|e| format!("创建供应商失败: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub fn update_supplier(db: State<'_, DbState>, token: String, id: String, input: SupplierInput) -> Result<(), String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    conn.execute("UPDATE suppliers SET name=?1, contact_person=?2, contact_phone=?3, address=?4, main_categories=?5, remark=?6, updated_at=datetime('now') WHERE id=?7",
        params![input.name, input.contact_person, input.contact_phone, input.address, input.main_categories, input.remark.unwrap_or_default(), id]).map_err(|e| format!("更新供应商失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_supplier(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    if id == "sup-default" || id == "sup-self" { return Err("系统内置供应商不可删除".to_string()); }
    conn.execute("DELETE FROM suppliers WHERE id = ?1 AND is_active = 1", params![id]).map_err(|e| format!("删除供应商失败: {}", e))?;
    Ok(())
}
