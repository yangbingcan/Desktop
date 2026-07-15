/** @file 采购入库 - 采购单/付款/财务流水 */
use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct PurchaseInput {
    pub supplier_id: String, pub handler: Option<String>,
    pub items: Vec<crate::inventory::PurchaseInInput>,
    pub remark: Option<String>, pub payment_status: Option<String>,
}

#[derive(Deserialize)]
pub struct PaymentInput {
    pub supplier_id: String, pub purchase_order_id: Option<String>,
    pub amount: f64, pub payment_method: String,
    pub payment_date: String, pub remark: Option<String>,
}

#[tauri::command]
pub fn get_purchase_orders(db: State<'_, DbState>, token: String, page: Option<i32>, page_size: Option<i32>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let page = page.unwrap_or(1).max(1); let page_size = page_size.unwrap_or(20).max(1); let offset = (page - 1) * page_size;
    let total: i32 = conn.query_row("SELECT COUNT(*) FROM purchase_orders", [], |r| r.get(0)).unwrap_or(0);
    let mut stmt = conn.prepare("SELECT po.id, po.order_no, po.supplier_id, s.name, po.handler, po.total_amount, po.payment_status, po.remark, po.created_at, (SELECT COUNT(*) FROM purchase_items pi WHERE pi.order_id = po.id) as item_count FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id ORDER BY po.created_at DESC LIMIT ? OFFSET ?").map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = stmt.query_map(params![page_size, offset], |row| {
        Ok(serde_json::json!({ "id": row.get::<_,String>(0)?, "orderNo": row.get::<_,String>(1)?, "supplierId": row.get::<_,String>(2)?, "supplierName": row.get::<_,String>(3)?, "handler": row.get::<_,Option<String>>(4)?, "totalAmount": row.get::<_,f64>(5)?, "paymentStatus": row.get::<_,String>(6)?, "remark": row.get::<_,String>(7)?, "createdAt": row.get::<_,String>(8)?, "itemCount": row.get::<_,i32>(9)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}

#[tauri::command]
pub fn get_purchase_order_detail(db: State<'_, DbState>, token: String, id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let order = conn.query_row("SELECT po.id, po.order_no, po.supplier_id, s.name, po.handler, po.total_amount, po.payment_status, po.remark, po.created_at FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = ?1", params![id], |row| {
        Ok(serde_json::json!({ "id": row.get::<_,String>(0)?, "orderNo": row.get::<_,String>(1)?, "supplierId": row.get::<_,String>(2)?, "supplierName": row.get::<_,String>(3)?, "handler": row.get::<_,Option<String>>(4)?, "totalAmount": row.get::<_,f64>(5)?, "paymentStatus": row.get::<_,String>(6)?, "remark": row.get::<_,String>(7)?, "createdAt": row.get::<_,String>(8)? }))
    }).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, order_id, product_id, product_name, unit_id, unit_name, quantity, grams, unit_price, subtotal, batch_id, batch_code FROM purchase_items WHERE order_id = ?1").map_err(|e| e.to_string())?;
    let items: Vec<serde_json::Value> = stmt.query_map(params![id], |row| {
        Ok(serde_json::json!({ "id": row.get::<_,String>(0)?, "productId": row.get::<_,String>(2)?, "productName": row.get::<_,String>(3)?, "unitName": row.get::<_,String>(5)?, "quantity": row.get::<_,i64>(6)?, "grams": row.get::<_,i64>(7)?, "unitPrice": row.get::<_,f64>(8)?, "subtotal": row.get::<_,f64>(9)?, "batchCode": row.get::<_,String>(11)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(serde_json::json!({ "order": order, "items": items }))
}

#[tauri::command]
pub fn update_purchase_order(db: State<'_, DbState>, token: String, id: String, payment_status: String) -> Result<(), String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    conn.execute("UPDATE purchase_orders SET payment_status = ?1 WHERE id = ?2", params![payment_status, id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_supplier_payment(db: State<'_, DbState>, token: String, input: PaymentInput) -> Result<String, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute("INSERT INTO supplier_payments (id, supplier_id, purchase_order_id, amount, payment_method, payment_date, remark) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, input.supplier_id, input.purchase_order_id, input.amount, input.payment_method, input.payment_date, input.remark.unwrap_or_default()]).map_err(|e| format!("创建付款记录失败: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub fn get_supplier_payments(db: State<'_, DbState>, token: String, supplier_id: String) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let mut stmt = conn.prepare("SELECT id, supplier_id, purchase_order_id, amount, payment_method, payment_date, remark, created_at FROM supplier_payments WHERE supplier_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = stmt.query_map(params![supplier_id], |row| {
        Ok(serde_json::json!({ "id": row.get::<_,String>(0)?, "supplierId": row.get::<_,String>(1)?, "purchaseOrderId": row.get::<_,Option<String>>(2)?, "amount": row.get::<_,f64>(3)?, "paymentMethod": row.get::<_,String>(4)?, "paymentDate": row.get::<_,String>(5)?, "remark": row.get::<_,String>(6)?, "createdAt": row.get::<_,String>(7)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(list)
}

#[tauri::command]
pub fn get_supplier_financial_flow(db: State<'_, DbState>, token: String, supplier_id: String) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let mut stmt = conn.prepare("SELECT po.order_no, po.total_amount, po.created_at FROM purchase_orders po WHERE po.supplier_id = ?1 ORDER BY po.created_at DESC LIMIT 50").map_err(|e| e.to_string())?;
    let purchase_list: Vec<serde_json::Value> = stmt.query_map(params![supplier_id], |row| {
        Ok(serde_json::json!({ "flowType": "purchase", "orderNo": row.get::<_,String>(0)?, "amount": row.get::<_,f64>(1)?, "createdAt": row.get::<_,String>(2)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let mut stmt2 = conn.prepare("SELECT id, amount, payment_date FROM supplier_payments WHERE supplier_id = ?1 ORDER BY created_at DESC LIMIT 50").map_err(|e| e.to_string())?;
    let payment_list: Vec<serde_json::Value> = stmt2.query_map(params![supplier_id], |row| {
        Ok(serde_json::json!({ "flowType": "payment", "orderNo": row.get::<_,String>(0)?, "amount": row.get::<_,f64>(1)?, "createdAt": row.get::<_,String>(2)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let mut flow = purchase_list; flow.extend(payment_list); flow.sort_by(|a, b| b["createdAt"].as_str().unwrap_or("").cmp(a["createdAt"].as_str().unwrap_or("")));
    Ok(flow)
}

#[tauri::command]
pub fn get_supplier_balance(db: State<'_, DbState>, token: String, supplier_id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?; let _ctx = verify_and_get_context(&conn, &token)?;
    let total_purchase: f64 = conn.query_row("SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE supplier_id = ?1", params![supplier_id], |r| r.get(0)).unwrap_or(0.0);
    let total_paid: f64 = conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE supplier_id = ?1", params![supplier_id], |r| r.get(0)).unwrap_or(0.0);
    let total_return: f64 = conn.query_row("SELECT COALESCE(SUM(total_amount), 0) FROM return_orders WHERE supplier_id = ?1", params![supplier_id], |r| r.get(0)).unwrap_or(0.0);
    Ok(serde_json::json!({ "totalPurchase": total_purchase, "totalPaid": total_paid, "totalReturn": total_return, "balance": total_purchase - total_paid - total_return }))
}
