/** @file 退货管理 - 退货出库单 CRUD */
use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct ReturnOrderInput {
    pub supplier_id: String, pub return_date: String, pub return_reason: String,
    pub remark: Option<String>, pub items: Vec<ReturnItemInput>,
}
#[derive(Deserialize)]
pub struct ReturnItemInput {
    pub product_id: String, pub unit_id: String, pub batch_id: String, pub quantity: i64,
}

#[tauri::command]
pub fn create_return_order(db: State<'_, DbState>, token: String, input: ReturnOrderInput) -> Result<String, String> {
    let conn = get_conn(&db)?; let ctx = verify_and_get_context(&conn, &token)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let order_no = format!("TH{}", chrono::Local::now().format("%Y%m%d%H%M%S"));
    let mut total_amount = 0.0;
    for item in &input.items {
        let (product_name, unit_name, conversion, purchase_price): (String, String, i64, f64) = tx.query_row(
            "SELECT p.name, su.name, su.conversion_to_base, ib.purchase_price FROM inventory_batches ib JOIN products p ON ib.product_id = p.id JOIN sales_units su ON su.product_id = p.id AND su.id = ?1 WHERE ib.id = ?2",
            params![item.unit_id, item.batch_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        ).map_err(|e| format!("查询批次失败: {}", e))?;
        let grams = conversion * item.quantity;
        let subtotal = purchase_price * item.quantity as f64;
        total_amount += subtotal;
        tx.execute("UPDATE inventory_batches SET remaining_grams = remaining_grams - ?1 WHERE id = ?2", params![grams, item.batch_id]).map_err(|e| e.to_string())?;
        tx.execute("UPDATE products SET stock_grams = stock_grams - ?1 WHERE id = ?2", params![grams, item.product_id]).map_err(|e| e.to_string())?;
        let item_id = uuid::Uuid::new_v4().to_string();
        tx.execute("INSERT INTO return_items (id, order_id, product_id, product_name, unit_id, unit_name, batch_id, quantity, unit_price, grams, subtotal) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![item_id, id, item.product_id, product_name, item.unit_id, unit_name, item.batch_id, item.quantity, purchase_price, grams, subtotal]).map_err(|e| e.to_string())?;
    }
    tx.execute("INSERT INTO return_orders (id, order_no, supplier_id, return_date, return_reason, total_amount, remark) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, order_no, input.supplier_id, input.return_date, input.return_reason, total_amount, input.remark.unwrap_or_default()]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    let _ = ctx; Ok(id)
}

#[tauri::command]
pub fn get_return_orders(db: State<'_, DbState>, token: String, page: Option<i32>, page_size: Option<i32>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let page = page.unwrap_or(1).max(1); let page_size = page_size.unwrap_or(20).max(1); let offset = (page - 1) * page_size;
    let total: i32 = conn.query_row("SELECT COUNT(*) FROM return_orders", [], |r| r.get(0)).unwrap_or(0);
    let mut stmt = conn.prepare("SELECT ro.id, ro.order_no, s.name, ro.return_date, ro.return_reason, ro.total_amount, ro.created_at, (SELECT COUNT(*) FROM return_items ri WHERE ri.order_id = ro.id) as item_count FROM return_orders ro JOIN suppliers s ON ro.supplier_id = s.id ORDER BY ro.created_at DESC LIMIT ? OFFSET ?").map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = stmt.query_map(params![page_size, offset], |row| {
        Ok(serde_json::json!({ "id": row.get::<_,String>(0)?, "orderNo": row.get::<_,String>(1)?, "supplierName": row.get::<_,String>(2)?, "returnDate": row.get::<_,String>(3)?, "returnReason": row.get::<_,String>(4)?, "totalAmount": row.get::<_,f64>(5)?, "createdAt": row.get::<_,String>(6)?, "itemCount": row.get::<_,i32>(7)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}

#[tauri::command]
pub fn get_return_order_detail(db: State<'_, DbState>, token: String, id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let order = conn.query_row("SELECT ro.id, ro.order_no, ro.supplier_id, s.name, ro.return_date, ro.return_reason, ro.total_amount, ro.remark, ro.created_at FROM return_orders ro JOIN suppliers s ON ro.supplier_id = s.id WHERE ro.id = ?1", params![id], |row| {
        Ok(serde_json::json!({ "id": row.get::<_,String>(0)?, "orderNo": row.get::<_,String>(1)?, "supplierId": row.get::<_,String>(2)?, "supplierName": row.get::<_,String>(3)?, "returnDate": row.get::<_,String>(4)?, "returnReason": row.get::<_,String>(5)?, "totalAmount": row.get::<_,f64>(6)?, "remark": row.get::<_,String>(7)?, "createdAt": row.get::<_,String>(8)? }))
    }).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, product_id, product_name, unit_name, batch_id, quantity, unit_price, grams, subtotal FROM return_items WHERE order_id = ?1").map_err(|e| e.to_string())?;
    let items: Vec<serde_json::Value> = stmt.query_map(params![id], |row| {
        Ok(serde_json::json!({ "productId": row.get::<_,String>(1)?, "productName": row.get::<_,String>(2)?, "unitName": row.get::<_,String>(3)?, "quantity": row.get::<_,i64>(5)?, "unitPrice": row.get::<_,f64>(6)?, "grams": row.get::<_,i64>(7)?, "subtotal": row.get::<_,f64>(8)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "order": order, "items": items }))
}

#[tauri::command]
pub fn delete_return_order(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    conn.execute("DELETE FROM return_orders WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_return_order(db: State<'_, DbState>, token: String, id: String, remark: String) -> Result<(), String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    conn.execute("UPDATE return_orders SET remark = ?1 WHERE id = ?2", params![remark, id]).map_err(|e| e.to_string())?;
    Ok(())
}
