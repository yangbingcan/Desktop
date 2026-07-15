/** @file 库存管理 - 查询/采购入库/报损/盘点/批次 */

use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Clone)]
pub struct InventoryItem {
    pub product_id: String,
    pub product_name: String,
    pub category_name: Option<String>,
    pub product_type: String,
    pub stock_grams: i64,
    pub stock_units: i64,
    pub display_stock: String,
}

#[derive(Serialize, Clone)]
pub struct InventoryBatch {
    pub id: String,
    pub product_id: String,
    pub batch_code: String,
    pub purchase_price: f64,
    pub total_grams: i64,
    pub remaining_grams: i64,
    pub supplier_id: Option<String>,
    pub produced_date: Option<String>,
    pub expire_date: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
pub struct StockFlow {
    pub id: String,
    pub product_id: String,
    pub batch_id: Option<String>,
    pub flow_type: String,
    pub change_grams: i64,
    pub balance_grams: i64,
    pub order_id: Option<String>,
    pub remark: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct PurchaseInInput {
    pub product_id: String,
    pub unit_id: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub supplier_id: Option<String>,
    pub remark: Option<String>,
}

#[derive(Deserialize)]
pub struct DamageOutInput {
    pub product_id: String,
    pub grams: i64,
    pub remark: String,
}

#[derive(Deserialize)]
pub struct AdjustInput {
    pub product_id: String,
    pub grams: i64,
    pub remark: String,
}

fn format_stock(stock_grams: i64, stock_units: i64, ptype: &str) -> String {
    if ptype == "count" {
        format!("{} 个", stock_units)
    } else {
        format!("{} g", stock_grams)
    }
}

#[tauri::command]
pub fn get_inventory(db: State<'_, DbState>, token: String, page: Option<i32>, page_size: Option<i32>, keyword: Option<String>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let mut where_clause = String::from("WHERE 1=1");
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref kw) = keyword {
        if !kw.is_empty() {
            where_clause.push_str(" AND p.name LIKE ?");
            param_values.push(Box::new(format!("%{}%", kw)));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM products p {}", where_clause);
    let total: i32 = conn
        .query_row(&count_sql, rusqlite::params_from_iter(param_values.iter().map(|b| b.as_ref())), |r| r.get(0))
        .unwrap_or(0);

    let query_sql = format!(
        "SELECT p.id, p.name, c.name, p.product_type, p.stock_grams, p.stock_units
         FROM products p LEFT JOIN product_categories c ON p.category_id = c.id
         {} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?",
        where_clause
    );

    let mut param_refs: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|b| b.as_ref()).collect();
    param_refs.push(&page_size);
    param_refs.push(&offset);

    let mut stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
    let list: Vec<InventoryItem> = stmt
        .query_map(rusqlite::params_from_iter(param_refs.iter()), |row| {
            let ptype: String = row.get(3)?;
            let sg: i64 = row.get(4)?;
            let su: i64 = row.get(5)?;
            Ok(InventoryItem {
                product_id: row.get(0)?,
                product_name: row.get(1)?,
                category_name: row.get(2)?,
                product_type: ptype.clone(),
                stock_grams: sg,
                stock_units: su,
                display_stock: format_stock(sg, su, &ptype),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}

#[tauri::command]
pub fn get_inventory_detail(db: State<'_, DbState>, token: String, product_id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let product_info: (String, String, i64, i64) = conn
        .query_row("SELECT name, product_type, stock_grams, stock_units FROM products WHERE id = ?1", params![product_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .map_err(|e| format!("查询商品失败: {}", e))?;

    let mut stmt = conn.prepare("SELECT id, product_id, batch_code, purchase_price, total_grams, remaining_grams, supplier_id, produced_date, expire_date, created_at FROM inventory_batches WHERE product_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let batches: Vec<InventoryBatch> = stmt.query_map(params![product_id], |row| {
        Ok(InventoryBatch {
            id: row.get(0)?, product_id: row.get(1)?, batch_code: row.get(2)?,
            purchase_price: row.get(3)?, total_grams: row.get(4)?, remaining_grams: row.get(5)?,
            supplier_id: row.get(6)?, produced_date: row.get(7)?, expire_date: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    let mut stmt2 = conn.prepare("SELECT id, product_id, batch_id, flow_type, change_grams, balance_grams, order_id, remark, created_at FROM stock_flow WHERE product_id = ?1 ORDER BY created_at DESC LIMIT 50").map_err(|e| e.to_string())?;
    let flows: Vec<StockFlow> = stmt2.query_map(params![product_id], |row| {
        Ok(StockFlow {
            id: row.get(0)?, product_id: row.get(1)?, batch_id: row.get(2)?,
            flow_type: row.get(3)?, change_grams: row.get(4)?, balance_grams: row.get(5)?,
            order_id: row.get(6)?, remark: row.get(7)?, created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({
        "productId": product_id,
        "productName": product_info.0,
        "productType": product_info.1,
        "stockGrams": product_info.2,
        "stockUnits": product_info.3,
        "batches": batches,
        "recentFlows": flows
    }))
}

#[tauri::command]
pub fn get_stock_flows(db: State<'_, DbState>, token: String, product_id: String, page: Option<i32>, page_size: Option<i32>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let total: i32 = conn.query_row("SELECT COUNT(*) FROM stock_flow WHERE product_id = ?1", params![product_id], |r| r.get(0)).unwrap_or(0);

    let mut stmt = conn.prepare("SELECT id, product_id, batch_id, flow_type, change_grams, balance_grams, order_id, remark, created_at FROM stock_flow WHERE product_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3").map_err(|e| e.to_string())?;
    let list: Vec<StockFlow> = stmt.query_map(params![product_id, page_size, offset], |row| {
        Ok(StockFlow {
            id: row.get(0)?, product_id: row.get(1)?, batch_id: row.get(2)?,
            flow_type: row.get(3)?, change_grams: row.get(4)?, balance_grams: row.get(5)?,
            order_id: row.get(6)?, remark: row.get(7)?, created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}

#[tauri::command]
pub fn purchase_in(db: State<'_, DbState>, token: String, input: PurchaseInInput) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // 获取单位换算系数
    let (conversion, product_id, unit_name): (i64, String, String) = tx.query_row(
        "SELECT conversion_to_base, product_id, name FROM sales_units WHERE id = ?1",
        params![input.unit_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))
    ).map_err(|e| format!("查询销售单位失败: {}", e))?;

    // 计算入库克数
    let grams = conversion * input.quantity;

    // 生成批次号
    let date = chrono::Local::now().format("%Y%m%d").to_string();
    let batch_count: i32 = tx.query_row("SELECT COUNT(*) FROM inventory_batches WHERE batch_code LIKE ?", params![format!("RK{}%", date)], |r| r.get(0)).unwrap_or(0);
    let batch_code = format!("RK{}{:03}", date, batch_count + 1);
    let batch_id = uuid::Uuid::new_v4().to_string();

    // 插入批次
    tx.execute(
        "INSERT INTO inventory_batches (id, product_id, batch_code, purchase_price, total_grams, remaining_grams, supplier_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![batch_id, product_id, batch_code, input.unit_price, grams, grams, input.supplier_id],
    ).map_err(|e| format!("创建批次失败: {}", e))?;

    // 更新商品库存
    tx.execute(
        "UPDATE products SET stock_grams = stock_grams + ?1, updated_at = datetime('now') WHERE id = ?2",
        params![grams, product_id],
    ).map_err(|e| format!("更新库存失败: {}", e))?;

    // 查询更新后的库存
    let new_balance: i64 = tx.query_row("SELECT stock_grams FROM products WHERE id = ?1", params![product_id], |r| r.get(0)).map_err(|e| e.to_string())?;

    // 写入库存流水
    let flow_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO stock_flow (id, product_id, batch_id, flow_type, change_grams, balance_grams, remark)
         VALUES (?1, ?2, ?3, 'purchase_in', ?4, ?5, ?6)",
        params![flow_id, product_id, batch_id, grams, new_balance, input.remark.as_deref().unwrap_or("采购入库")],
    ).map_err(|e| format!("写入流水失败: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "batchId": batch_id, "batchCode": batch_code, "grams": grams, "newBalance": new_balance }))
}

#[tauri::command]
pub fn damage_out(db: State<'_, DbState>, token: String, input: DamageOutInput) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    if input.grams <= 0 {
        return Err("报损克数必须大于0".to_string());
    }

    let current: i64 = tx.query_row("SELECT stock_grams FROM products WHERE id = ?1", params![input.product_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if current < input.grams {
        return Err(format!("库存不足，当前库存 {}g", current));
    }

    tx.execute("UPDATE products SET stock_grams = stock_grams - ?1 WHERE id = ?2", params![input.grams, input.product_id]).map_err(|e| e.to_string())?;

    let new_balance: i64 = tx.query_row("SELECT stock_grams FROM products WHERE id = ?1", params![input.product_id], |r| r.get(0)).map_err(|e| e.to_string())?;

    let flow_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO stock_flow (id, product_id, flow_type, change_grams, balance_grams, remark)
         VALUES (?1, ?2, 'damage_out', ?3, ?4, ?5)",
        params![flow_id, input.product_id, -input.grams, new_balance, input.remark],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn adjust_stock(db: State<'_, DbState>, token: String, input: AdjustInput) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let current: i64 = tx.query_row("SELECT stock_grams FROM products WHERE id = ?1", params![input.product_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    let new_balance = current + input.grams;

    tx.execute("UPDATE products SET stock_grams = stock_grams + ?1 WHERE id = ?2", params![input.grams, input.product_id]).map_err(|e| e.to_string())?;

    let flow_type = if input.grams >= 0 { "adjust_in" } else { "adjust_out" };
    let flow_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO stock_flow (id, product_id, flow_type, change_grams, balance_grams, remark)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![flow_id, input.product_id, flow_type, input.grams, new_balance, input.remark],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_available_batches(db: State<'_, DbState>, token: String, product_id: String) -> Result<Vec<InventoryBatch>, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let mut stmt = conn.prepare("SELECT id, product_id, batch_code, purchase_price, total_grams, remaining_grams, supplier_id, produced_date, expire_date, created_at FROM inventory_batches WHERE product_id = ?1 AND remaining_grams > 0 ORDER BY created_at ASC").map_err(|e| e.to_string())?;
    let list: Vec<InventoryBatch> = stmt.query_map(params![product_id], |row| {
        Ok(InventoryBatch {
            id: row.get(0)?, product_id: row.get(1)?, batch_code: row.get(2)?,
            purchase_price: row.get(3)?, total_grams: row.get(4)?, remaining_grams: row.get(5)?,
            supplier_id: row.get(6)?, produced_date: row.get(7)?, expire_date: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(list)
}
