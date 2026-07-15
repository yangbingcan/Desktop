/** @file 销售收银 - 开单/挂单/取单/查询/退货 */

use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Deserialize)]
pub struct SaleItemInput {
    pub product_id: String,
    pub unit_id: String,
    pub quantity: i64,
}

#[derive(Deserialize)]
pub struct SaleOrderInput {
    pub items: Vec<SaleItemInput>,
    pub member_id: Option<String>,
    pub apply_member_discount: Option<bool>,
    pub points_deduct: Option<i64>,
    pub pay_method: Option<String>,
    pub remark: Option<String>,
}

#[derive(Deserialize)]
pub struct ReturnSaleItemInput {
    pub product_id: String,
    pub unit_id: String,
    pub quantity: i64,
}

#[derive(Deserialize)]
pub struct ReturnSaleOrderInput {
    pub original_order_id: String,
    pub items: Vec<ReturnSaleItemInput>,
    pub remark: Option<String>,
}

fn gen_order_no(prefix: &str) -> String {
    let now = chrono::Local::now();
    let date = now.format("%Y%m%d%H%M%S").to_string();
    let rand_suffix: u16 = rand::random::<u16>() % 1000;
    format!("{}{}{:03}", prefix, date, rand_suffix)
}

#[tauri::command]
pub fn create_sale_order(db: State<'_, DbState>, token: String, input: SaleOrderInput) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let ctx = verify_and_get_context(&conn, &token)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let order_id = uuid::Uuid::new_v4().to_string();
    let order_no = gen_order_no("XS");

    // 获取会员信息
    let (member_name, member_discount, member_points): (Option<String>, Option<f64>, i64) = if let Some(ref mid) = input.member_id {
        let row: (Option<String>, String, i64) = tx.query_row(
            "SELECT name, level, points FROM members WHERE id = ?1", params![mid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        ).map_err(|e| format!("查询会员失败: {}", e))?;
        let discount = match row.1.as_str() { "gold" => 0.95, "silver" => 0.97, _ => 1.0 };
        (row.0, Some(discount), row.2)
    } else { (None, None, 0) };

    let mut total_amount = 0.0;
    let mut discount_amount = 0.0;
    let mut sale_items_data: Vec<(String, String, String, i64, f64, i64, f64)> = Vec::new();

    for item in &input.items {
        // 获取单位和商品信息
        let (unit_name, conversion, retail_price, member_price, product_id, product_name, ptype): (String, i64, f64, f64, String, String, String) = tx.query_row(
            "SELECT su.name, su.conversion_to_base, su.retail_price, su.member_price, su.product_id, p.name, p.product_type
             FROM sales_units su JOIN products p ON su.product_id = p.id
             WHERE su.id = ?1",
            params![item.unit_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?))
        ).map_err(|e| format!("查询商品单位失败: {}", e))?;

        let price = if input.apply_member_discount.unwrap_or(false) && input.member_id.is_some() { member_price } else { retail_price };
        let grams = conversion * item.quantity;
        let subtotal = (price * item.quantity as f64 * 100.0).round() / 100.0;

        // 库存校验和扣减
        if ptype == "weight" {
            let current: i64 = tx.query_row("SELECT stock_grams FROM products WHERE id = ?1", params![product_id], |r| r.get(0)).map_err(|e| e.to_string())?;
            if current < grams { return Err(format!("商品 {} 库存不足，当前 {}g", product_name, current)); }
            tx.execute("UPDATE products SET stock_grams = stock_grams - ?1 WHERE id = ?2", params![grams, product_id]).map_err(|e| e.to_string())?;
        } else {
            let current: i64 = tx.query_row("SELECT stock_units FROM products WHERE id = ?1", params![product_id], |r| r.get(0)).map_err(|e| e.to_string())?;
            if current < item.quantity { return Err(format!("商品 {} 库存不足，当前 {} 个", product_name, current)); }
            tx.execute("UPDATE products SET stock_units = stock_units - ?1 WHERE id = ?2", params![item.quantity, product_id]).map_err(|e| e.to_string())?;
        }

        // FIFO 批次扣减
        if ptype == "weight" && grams > 0 {
            let mut remaining_to_deduct = grams;
            let mut stmt = tx.prepare("SELECT id, remaining_grams FROM inventory_batches WHERE product_id = ?1 AND remaining_grams > 0 ORDER BY created_at ASC").map_err(|e| e.to_string())?;
            let batches: Vec<(String, i64)> = stmt.query_map(params![product_id], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
            drop(stmt);

            for (batch_id, batch_remaining) in batches {
                if remaining_to_deduct <= 0 { break; }
                let deduct = std::cmp::min(remaining_to_deduct, batch_remaining);
                tx.execute("UPDATE inventory_batches SET remaining_grams = remaining_grams - ?1 WHERE id = ?2", params![deduct, batch_id]).map_err(|e| e.to_string())?;
                let new_balance: i64 = tx.query_row("SELECT stock_grams FROM products WHERE id = ?1", params![product_id], |r| r.get(0)).unwrap_or(0);
                let flow_id = uuid::Uuid::new_v4().to_string();
                tx.execute("INSERT INTO stock_flow (id, product_id, batch_id, flow_type, change_grams, balance_grams, order_id) VALUES (?1, ?2, ?3, 'sale_out', ?4, ?5, ?6)", params![flow_id, product_id, batch_id, -deduct, new_balance, order_id]).map_err(|e| e.to_string())?;
                remaining_to_deduct -= deduct;
            }
        }

        total_amount += subtotal;
        sale_items_data.push((uuid::Uuid::new_v4().to_string(), product_id, product_name, item.quantity, price, grams, subtotal));
    }

    // 计算会员折扣
    if let Some(disc) = member_discount {
        if input.apply_member_discount.unwrap_or(false) {
            discount_amount = (total_amount * (1.0 - disc) * 100.0).round() / 100.0;
        }
    }

    let points_deduct = input.points_deduct.unwrap_or(0);
    let actual_amount = (total_amount - discount_amount - points_deduct as f64 * 100.0).max(0.0);
    let points_earned = (actual_amount as i64).max(0);

    // 创建销售单
    tx.execute(
        "INSERT INTO sales_orders (id, order_no, member_id, member_name, total_amount, discount_amount, points_deduct, points_earned, actual_amount, pay_method, pay_status, status, remark)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'paid', 'completed', ?11)",
        params![order_id, order_no, input.member_id, member_name, total_amount, discount_amount, points_deduct, points_earned, actual_amount, input.pay_method.as_deref().unwrap_or("cash"), input.remark.as_deref().unwrap_or("")],
    ).map_err(|e| format!("创建销售单失败: {}", e))?;

    // 创建销售明细
    for (item_id, product_id, product_name, quantity, unit_price, grams, subtotal) in &sale_items_data {
        tx.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal)
             VALUES (?1, ?2, ?3, ?4, ?5, ?, ?6, ?7, ?8, ?9)",
            params![item_id, order_id, product_id, product_name, input.items.iter().find(|i| i.product_id == *product_id).map(|i| i.unit_id.as_str()).unwrap_or(""), quantity, unit_price, grams, subtotal],
        ).map_err(|e| format!("创建明细失败: {}", e))?;
    }

    // 更新会员积分和消费记录
    if let Some(ref mid) = input.member_id {
        tx.execute(
            "UPDATE members SET points = points + ?1, total_consume = total_consume + ?2, consume_count = consume_count + 1, last_visit = datetime('now') WHERE id = ?3",
            params![points_earned, actual_amount, mid],
        ).map_err(|e| e.to_string())?;

        // 如果使用积分抵扣
        if points_deduct > 0 {
            tx.execute("UPDATE members SET points = points - ?1 WHERE id = ?2", params![points_deduct, mid]).map_err(|e| e.to_string())?;
        }

        // 如果使用余额支付
        if input.pay_method.as_deref() == Some("memberBalance") {
            tx.execute("UPDATE members SET balance = balance - ?1 WHERE id = ?2", params![actual_amount, mid]).map_err(|e| e.to_string())?;
            let log_id = uuid::Uuid::new_v4().to_string();
            tx.execute("INSERT INTO member_balance_logs (id, member_id, change_type, change_amount, balance_after, payment_method, operator, related_order_id) VALUES (?1, ?2, 'consume', ?3, 0, 'memberBalance', ?4, ?5)",
                params![log_id, mid, -actual_amount, ctx.username, order_id]).map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "orderId": order_id, "orderNo": order_no, "totalAmount": total_amount, "actualAmount": actual_amount, "pointsEarned": points_earned }))
}

#[tauri::command]
pub fn hold_order(db: State<'_, DbState>, token: String, input: SaleOrderInput) -> Result<String, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let order_id = uuid::Uuid::new_v4().to_string();
    let order_no = gen_order_no("HD");

    let total: f64 = input.items.iter().map(|_| 0.0).sum();

    conn.execute(
        "INSERT INTO sales_orders (id, order_no, member_id, total_amount, status, pay_status, remark)
         VALUES (?1, ?2, ?3, ?4, 'pending', 'unpaid', ?5)",
        params![order_id, order_no, input.member_id, total, input.remark.as_deref().unwrap_or("挂单")],
    ).map_err(|e| format!("挂单失败: {}", e))?;

    Ok(order_id)
}

#[tauri::command]
pub fn get_held_orders(db: State<'_, DbState>, token: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let mut stmt = conn.prepare("SELECT id, order_no, member_name, total_amount, created_at FROM sales_orders WHERE status = 'pending' ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = stmt.query_map([], |row| {
        Ok(serde_json::json!({ "id": row.get::<_, String>(0)?, "orderNo": row.get::<_, String>(1)?, "memberName": row.get::<_, Option<String>>(2)?, "totalAmount": row.get::<_, f64>(3)?, "createdAt": row.get::<_, String>(4)? }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({ "list": list }))
}

#[tauri::command]
pub fn get_held_order_detail(db: State<'_, DbState>, token: String, id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let order = conn.query_row("SELECT id, order_no, member_id, member_name, total_amount, remark FROM sales_orders WHERE id = ?1 AND status = 'pending'", params![id], |row| {
        Ok(serde_json::json!({ "id": row.get::<_, String>(0)?, "orderNo": row.get::<_, String>(1)?, "memberId": row.get::<_, Option<String>>(2)?, "memberName": row.get::<_, Option<String>>(3)?, "totalAmount": row.get::<_, f64>(4)?, "remark": row.get::<_, String>(5)? }))
    }).map_err(|e| e.to_string())?;

    Ok(order)
}

#[tauri::command]
pub fn delete_held_order(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    conn.execute("DELETE FROM sales_orders WHERE id = ?1 AND status = 'pending'", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_sale_orders(db: State<'_, DbState>, token: String, page: Option<i32>, page_size: Option<i32>, start_date: Option<String>, end_date: Option<String>, member_id: Option<String>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let mut where_clause = String::from("WHERE status = 'completed'");
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref sd) = start_date { where_clause.push_str(" AND created_at >= ?"); param_values.push(Box::new(sd.clone())); }
    if let Some(ref ed) = end_date { where_clause.push_str(" AND created_at <= ?"); param_values.push(Box::new(ed.clone())); }
    if let Some(ref mid) = member_id { where_clause.push_str(" AND member_id = ?"); param_values.push(Box::new(mid.clone())); }

    let total: i32 = conn.query_row(&format!("SELECT COUNT(*) FROM sales_orders {}", where_clause), rusqlite::params_from_iter(param_values.iter().map(|b| b.as_ref())), |r| r.get(0)).unwrap_or(0);

    let mut param_refs: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|b| b.as_ref()).collect();
    param_refs.push(&page_size);
    param_refs.push(&offset);

    let mut stmt = conn.prepare(&format!("SELECT id, order_no, member_id, member_name, total_amount, discount_amount, actual_amount, pay_method, pay_status, status, created_at, (SELECT COUNT(*) FROM sales_items si WHERE si.order_id = sales_orders.id) as item_count FROM sales_orders {} ORDER BY created_at DESC LIMIT ? OFFSET ?", where_clause)).map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = stmt.query_map(rusqlite::params_from_iter(param_refs.iter()), |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "orderNo": row.get::<_, String>(1)?,
            "memberId": row.get::<_, Option<String>>(2)?, "memberName": row.get::<_, Option<String>>(3)?,
            "totalAmount": row.get::<_, f64>(4)?, "discountAmount": row.get::<_, f64>(5)?,
            "actualAmount": row.get::<_, f64>(6)?, "payMethod": row.get::<_, Option<String>>(7)?,
            "payStatus": row.get::<_, String>(8)?, "status": row.get::<_, String>(9)?,
            "createdAt": row.get::<_, String>(10)?, "itemCount": row.get::<_, i32>(11)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}

#[tauri::command]
pub fn get_sale_order(db: State<'_, DbState>, token: String, id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let order = conn.query_row("SELECT id, order_no, member_id, member_name, total_amount, discount_amount, points_deduct, points_earned, actual_amount, pay_method, pay_status, status, remark, created_at FROM sales_orders WHERE id = ?1", params![id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "orderNo": row.get::<_, String>(1)?,
            "memberId": row.get::<_, Option<String>>(2)?, "memberName": row.get::<_, Option<String>>(3)?,
            "totalAmount": row.get::<_, f64>(4)?, "discountAmount": row.get::<_, f64>(5)?,
            "pointsDeduct": row.get::<_, i64>(6)?, "pointsEarned": row.get::<_, i64>(7)?,
            "actualAmount": row.get::<_, f64>(8)?, "payMethod": row.get::<_, Option<String>>(9)?,
            "payStatus": row.get::<_, String>(10)?, "status": row.get::<_, String>(11)?,
            "remark": row.get::<_, String>(12)?, "createdAt": row.get::<_, String>(13)?,
        }))
    }).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal FROM sales_items WHERE order_id = ?1").map_err(|e| e.to_string())?;
    let items: Vec<serde_json::Value> = stmt.query_map(params![id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "orderId": row.get::<_, String>(1)?,
            "productId": row.get::<_, String>(2)?, "productName": row.get::<_, String>(3)?,
            "unitId": row.get::<_, String>(4)?, "unitName": row.get::<_, String>(5)?,
            "quantity": row.get::<_, i64>(6)?, "unitPrice": row.get::<_, f64>(7)?,
            "grams": row.get::<_, i64>(8)?, "subtotal": row.get::<_, f64>(9)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({ "order": order, "items": items }))
}

#[tauri::command]
pub fn get_dashboard_stats(db: State<'_, DbState>, token: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let today_orders: i32 = conn.query_row("SELECT COUNT(*) FROM sales_orders WHERE status = 'completed' AND created_at >= ?1", params![format!("{} 00:00:00", today)], |r| r.get(0)).unwrap_or(0);
    let today_sales: f64 = conn.query_row("SELECT COALESCE(SUM(actual_amount), 0) FROM sales_orders WHERE status = 'completed' AND created_at >= ?1", params![format!("{} 00:00:00", today)], |r| r.get(0)).unwrap_or(0.0);
    let low_stock: i32 = conn.query_row("SELECT COUNT(*) FROM products WHERE is_active = 1 AND stock_grams < 500", [], |r| r.get(0)).unwrap_or(0);
    let new_members: i32 = conn.query_row("SELECT COUNT(*) FROM members WHERE created_at >= ?1", params![format!("{} 00:00:00", today)], |r| r.get(0)).unwrap_or(0);

    Ok(serde_json::json!({ "todayOrders": today_orders, "todaySales": today_sales, "lowStockCount": low_stock, "newMembers": new_members }))
}

#[tauri::command]
pub fn return_sale_order(db: State<'_, DbState>, token: String, input: ReturnSaleOrderInput) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let ctx = verify_and_get_context(&conn, &token)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let return_id = uuid::Uuid::new_v4().to_string();
    let return_no = gen_order_no("TH");

    // 获取原订单信息
    let (member_id, member_name): (Option<String>, Option<String>) = tx.query_row(
        "SELECT member_id, member_name FROM sales_orders WHERE id = ?1", params![input.original_order_id], |r| Ok((r.get(0)?, r.get(1)?))
    ).map_err(|e| format!("查询原订单失败: {}", e))?;

    let mut total_refund = 0.0;
    let mut items_data: Vec<(String, String, i64, f64, f64)> = Vec::new();

    for item in &input.items {
        let (product_name, unit_name, unit_price): (String, String, f64) = tx.query_row(
            "SELECT si.product_name, si.unit_name, si.unit_price FROM sales_items si WHERE si.order_id = ?1 AND si.product_id = ?2 AND si.unit_id = ?3",
            params![input.original_order_id, item.product_id, item.unit_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        ).map_err(|e| format!("查询原订单明细失败: {}", e))?;

        let subtotal = unit_price * item.quantity as f64;
        total_refund += subtotal;

        // 库存回滚
        let ptype: String = tx.query_row("SELECT product_type FROM products WHERE id = ?1", params![item.product_id], |r| r.get(0)).unwrap_or("weight".to_string());
        if ptype == "weight" {
            tx.execute("UPDATE products SET stock_grams = stock_grams + ?1 WHERE id = ?2", params![item.quantity, item.product_id]).map_err(|e| e.to_string())?;
        } else {
            tx.execute("UPDATE products SET stock_units = stock_units + ?1 WHERE id = ?2", params![item.quantity, item.product_id]).map_err(|e| e.to_string())?;
        }

        items_data.push((uuid::Uuid::new_v4().to_string(), product_name, item.quantity, unit_price, subtotal));
    }

    // 创建退货单
    tx.execute(
        "INSERT INTO return_sale_orders (id, order_no, original_order_id, member_id, member_name, total_amount, refund_amount, remark)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![return_id, return_no, input.original_order_id, member_id, member_name, total_refund, total_refund, input.remark.as_deref().unwrap_or("")],
    ).map_err(|e| format!("创建退货单失败: {}", e))?;

    for (item_id, product_name, quantity, unit_price, subtotal) in &items_data {
        tx.execute(
            "INSERT INTO return_sale_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, subtotal)
             VALUES (?1, ?2, ?, ?, ?, ?, ?, ?)",
            params![item_id, return_id, "", product_name, "", "", quantity, unit_price, subtotal],
        ).map_err(|e| format!("创建退货明细失败: {}", e))?;
    }

    // 回滚会员积分和消费
    if let Some(ref mid) = member_id {
        let points_earned: i64 = tx.query_row("SELECT points_earned FROM sales_orders WHERE id = ?1", params![input.original_order_id], |r| r.get(0)).unwrap_or(0);
        tx.execute("UPDATE members SET points = MAX(0, points - ?1), total_consume = MAX(0, total_consume - ?2) WHERE id = ?3", params![points_earned, total_refund, mid]).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    let _ = ctx;
    Ok(serde_json::json!({ "returnId": return_id, "returnNo": return_no, "refundAmount": total_refund }))
}
