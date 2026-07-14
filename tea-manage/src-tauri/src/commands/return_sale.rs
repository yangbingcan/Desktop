//! 客户销售退货 Tauri Commands（CR-02 客户退货闭环）
//!
//! v0.7.0 新增：支持对已完成销售订单发起客户退货，自动回滚库存（按称重/计件类型）、
//! 冲减会员积分与累计消费、记录库存流水与退货单。整流程包裹于单层 BEGIN EXCLUSIVE 事务。

use crate::db::Database;
use crate::models::{
    ReturnSaleItem, ReturnSaleOrder, ReturnSaleOrderInput,
};
use chrono::Local;
use rusqlite::{params, Connection};
use uuid::Uuid;

/// 根据商品类型返回库存列名（称重 stock_grams / 计件 stock_units）
fn stock_field_of(conn: &Connection, product_id: &str) -> Result<String, String> {
    let pt: String = conn
        .query_row(
            "SELECT product_type FROM products WHERE id = ?",
            [product_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询商品类型失败: {}", e))?;
    Ok(if pt == "weight" {
        "stock_grams".to_string()
    } else {
        "stock_units".to_string()
    })
}

#[tauri::command]
pub async fn return_sale_order(
    db: tauri::State<'_, Database>,
    input: ReturnSaleOrderInput,
) -> Result<ReturnSaleOrder, String> {
    if input.original_order_id.trim().is_empty() {
        return Err("请指定原销售订单".to_string());
    }
    if input.items.is_empty() {
        return Err("退货明细不能为空".to_string());
    }
    for (i, item) in input.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(format!("第 {} 行退货数量必须大于 0", i + 1));
        }
        if item.product_id.trim().is_empty() || item.unit_id.trim().is_empty() {
            return Err(format!("第 {} 行商品或单位不能为空", i + 1));
        }
    }

    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    // 查询原订单是否存在及其会员信息
    let original: (Option<String>, Option<String>, String) = conn
        .query_row(
            "SELECT member_id, member_name, status FROM sales_orders WHERE id = ?",
            [&input.original_order_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            format!("原销售订单不存在: {}", e)
        })?;

    let ts = Local::now();
    let random_suffix: u16 = (ts.timestamp_nanos_opt().unwrap_or(0).abs() % 10000) as u16;
    let order_no = format!(
        "RT{}{:03}{:04}",
        ts.format("%Y%m%d%H%M%S"),
        (ts.timestamp_millis() % 1000) as u16,
        random_suffix
    );
    let return_id = Uuid::new_v4().to_string();

    let mut total_refund: f64 = 0.0;
    let mut points_reversed: i64 = 0;
    let mut return_items: Vec<ReturnSaleItem> = Vec::new();

    for item in &input.items {
        // 取原单该商品行的售价与名称（用于退款金额计算与流水记录）
        let orig: (String, String, i64, f64) = conn
            .query_row(
                "SELECT product_name, unit_name, quantity, unit_price
                 FROM sales_items WHERE order_id = ? AND product_id = ? AND unit_id = ?
                 LIMIT 1",
                params![&input.original_order_id, &item.product_id, &item.unit_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| {
                let _ = conn.execute("ROLLBACK", []);
                format!("未在原单中找到该商品行: {}", e)
            })?;

        if item.quantity > orig.2 {
            let _ = conn.execute("ROLLBACK", []);
            return Err(format!(
                "商品[{}]退货数量 {} 超过原单已售数量 {}",
                orig.0, item.quantity, orig.2
            ));
        }

        let stock_field = stock_field_of(&conn, &item.product_id)?;
        let subtotal = crate::utils::money::round2(orig.3 * item.quantity as f64);

        // 回滚库存（按类型）
        conn.execute(
            &format!(
                "UPDATE products SET {} = {} + ? WHERE id = ?",
                stock_field, stock_field
            ),
            params![item.quantity, &item.product_id],
        )
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;

        // 退货商品作为新批次重新入库（FIFO 后续可正常售出）
        let batch_code = format!("RET-{}", Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO inventory_batches (id, product_id, batch_code, purchase_price, total_grams, remaining_grams, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                Uuid::new_v4().to_string(),
                &item.product_id,
                batch_code,
                orig.3,
                item.quantity,
                item.quantity,
                now
            ],
        )
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;

        // 库存流水
        let new_balance: i64 = conn
            .query_row(
                &format!("SELECT {} FROM products WHERE id = ?", stock_field),
                [&item.product_id],
                |row| row.get(0),
            )
            .map_err(|e| {
                let _ = conn.execute("ROLLBACK", []);
                e.to_string()
            })?;

        let flow_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_flow (id, product_id, flow_type, change_grams, balance_grams, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                flow_id,
                &item.product_id,
                "sale_return",
                item.quantity,
                new_balance,
                input.remark.clone().unwrap_or_else(|| "客户退货".to_string()),
                now
            ],
        )
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;

        // 记录退货明细
        let return_item_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO return_sale_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                return_item_id,
                &return_id,
                &item.product_id,
                orig.0,
                &item.unit_id,
                orig.1,
                item.quantity,
                orig.3,
                subtotal
            ],
        )
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;

        return_items.push(ReturnSaleItem {
            id: return_item_id,
            order_id: return_id.clone(),
            product_id: item.product_id.clone(),
            product_name: orig.0.clone(),
            unit_id: item.unit_id.clone(),
            unit_name: orig.1.clone(),
            quantity: item.quantity,
            unit_price: orig.3,
            subtotal,
        });

        total_refund = crate::utils::money::round2(total_refund + subtotal);
        points_reversed += crate::utils::money::round2(subtotal).round() as i64;
    }

    // 冲减会员积分与累计消费（不破坏既有等级逻辑，仅回滚本次贡献）
    if let (Some(mid), _, _) = &original {
        let mid = mid.clone();
        let (current_points, current_consume): (i64, f64) = conn
            .query_row(
                "SELECT points, total_consume FROM members WHERE id = ?",
                [&mid],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| {
                let _ = conn.execute("ROLLBACK", []);
                format!("查询会员失败: {}", e)
            })?;
        let new_points = (current_points - points_reversed).max(0);
        let new_consume = crate::utils::money::round2((current_consume - total_refund).max(0.0));
        conn.execute(
            "UPDATE members SET points = ?, total_consume = ? WHERE id = ?",
            params![new_points, new_consume, mid],
        )
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;
    }

    // 写入退货单
    conn.execute(
        "INSERT INTO return_sale_orders (id, order_no, original_order_id, member_id, member_name, total_amount, refund_amount, points_reversed, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            &return_id,
            &order_no,
            &input.original_order_id,
            original.0.clone(),
            original.1.clone(),
            total_refund,
            total_refund,
            points_reversed,
            input.remark.clone(),
            now
        ],
    )
    .map_err(|e| {
        let _ = conn.execute("ROLLBACK", []);
        e.to_string()
    })?;

    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(ReturnSaleOrder {
        id: return_id,
        order_no,
        original_order_id: input.original_order_id,
        member_id: original.0,
        member_name: original.1,
        total_amount: total_refund,
        refund_amount: total_refund,
        points_reversed,
        remark: input.remark,
        items: return_items,
        created_at: now,
    })
}
