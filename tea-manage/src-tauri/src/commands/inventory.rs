//! 库存相关 Tauri Commands
//! 
//! 提供库存查询、入库、出库、调整等操作的接口

use crate::db::Database;
use crate::models::{
    InventoryItem, InventoryDetail, InventoryBatch, StockFlow, FlowType,
    PurchaseInput, PurchaseOrder, PurchaseOrderItem, PurchaseOrderListItem,
    AdjustInput, DamageOutInput, StockChangeResult,
};
use crate::models::PageResult;
use chrono::{Local, NaiveDate};
use rusqlite::{params, Connection};
use uuid::Uuid;

/// 获取库存列表（分页）
#[tauri::command]
pub async fn get_inventory(
    db: tauri::State<'_, Database>,
    page: Option<i64>,
    page_size: Option<i64>,
    category_id: Option<String>,
) -> Result<PageResult<InventoryItem>, String> {
    let conn = db.get_conn()?;
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    // 构建查询
    let mut sql = String::from(
        "SELECT p.id, p.name, c.name, p.product_type, p.stock_grams, p.stock_units
         FROM products p
         LEFT JOIN product_categories c ON p.category_id = c.id
         WHERE 1=1"
    );
    let mut count_sql = String::from(
        "SELECT COUNT(*) FROM products p WHERE 1=1"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if category_id.is_some() {
        sql.push_str(" AND p.category_id = ?");
        count_sql.push_str(" AND p.category_id = ?");
        params_vec.push(Box::new(category_id.clone().unwrap()));
    }

    // 添加分页（使用参数化占位符，避免 SQL 注入风险）
    sql.push_str(" ORDER BY p.name LIMIT ? OFFSET ?");

    // 查询总数
    let total: i64 = {
        let count_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        conn.query_row(&count_sql, count_params.as_slice(), |row| row.get(0))
            .map_err(|e| e.to_string())?
    };

    // 追加分页参数
    params_vec.push(Box::new(page_size));
    params_vec.push(Box::new(offset));

    // 查询列表
    let mut stmt = conn.prepare(&sql)
        .map_err(|e| e.to_string())?;

    let params_slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let items = stmt.query_map(params_slice.as_slice(), |row| {
        let product_type: String = row.get(3)?;
        let stock_grams: i64 = row.get(4)?;
        let stock_units: i64 = row.get(5)?;
        
        // 计算显示库存
        let display_stock = if product_type == "weight" {
            format_stock_grams(stock_grams)
        } else {
            format!("{} 件", stock_units)
        };

        Ok(InventoryItem {
            product_id: row.get(0)?,
            product_name: row.get(1)?,
            category_name: row.get(2)?,
            product_type,
            stock_grams,
            stock_units,
            display_stock,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(PageResult {
        list: items,
        total: total as u32,
        page: page as u32,
        page_size: page_size as u32,
    })
}

/// 获取商品库存详情
#[tauri::command]
pub async fn get_inventory_detail(
    db: tauri::State<'_, Database>,
    product_id: String,
) -> Result<InventoryDetail, String> {
    let conn = db.get_conn()?;

    // 查询商品信息
    let (name, category_name, product_type, stock_grams, stock_units): (
        String, Option<String>, String, i64, i64
    ) = conn.query_row(
        "SELECT p.name, c.name, p.product_type, p.stock_grams, p.stock_units
         FROM products p
         LEFT JOIN product_categories c ON p.category_id = c.id
         WHERE p.id = ?",
        [&product_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    ).map_err(|e| e.to_string())?;

    // 查询批次列表
    let mut stmt = conn.prepare(
        "SELECT id, batch_code, purchase_price, total_grams, remaining_grams,
                supplier_id, produced_date, expire_date, created_at
         FROM inventory_batches
         WHERE product_id = ? AND remaining_grams > 0
         ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let batches = stmt.query_map([&product_id], |row| {
        Ok(InventoryBatch {
            id: row.get(0)?,
            product_id: product_id.clone(),
            batch_code: row.get(1)?,
            purchase_price: row.get(2)?,
            total_grams: row.get(3)?,
            remaining_grams: row.get(4)?,
            supplier_id: row.get(5)?,
            produced_date: row.get(6)?,
            expire_date: row.get(7)?,
            created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    // 查询近期流水（最近20条）
    let mut stmt = conn.prepare(
        "SELECT id, product_id, batch_id, flow_type, change_grams, balance_grams,
                order_id, remark, created_at
         FROM stock_flow
         WHERE product_id = ?
         ORDER BY created_at DESC
         LIMIT 20"
    ).map_err(|e| e.to_string())?;

    let recent_flows = stmt.query_map([&product_id], |row| {
        let flow_type_str: String = row.get(3)?;
        let flow_type = match flow_type_str.as_str() {
            "purchase_in" => FlowType::PurchaseIn,
            "sale_out" => FlowType::SaleOut,
            "damage_out" => FlowType::DamageOut,
            "return_out" => FlowType::ReturnOut,
            "adjust_in" => FlowType::AdjustIn,
            "adjust_out" => FlowType::AdjustOut,
            _ => FlowType::SaleOut,
        };
        Ok(StockFlow {
            id: row.get(0)?,
            product_id: row.get(1)?,
            batch_id: row.get(2)?,
            flow_type,
            change_grams: row.get(4)?,
            balance_grams: row.get(5)?,
            order_id: row.get(6)?,
            remark: row.get(7)?,
            created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(InventoryDetail {
        product_id,
        product_name: name,
        category_name,
        product_type,
        stock_grams,
        stock_units,
        batches,
        recent_flows,
    })
}

/// 获取库存流水记录
#[tauri::command]
pub async fn get_stock_flows(
    db: tauri::State<'_, Database>,
    product_id: String,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PageResult<StockFlow>, String> {
    let conn = db.get_conn()?;
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM stock_flow WHERE product_id = ?",
        [&product_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, product_id, batch_id, flow_type, change_grams, balance_grams,
                order_id, remark, created_at
         FROM stock_flow
         WHERE product_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?"
    ).map_err(|e| e.to_string())?;

    let items = stmt.query_map(params![product_id, page_size, offset], |row| {
        let flow_type_str: String = row.get(3)?;
        let flow_type = match flow_type_str.as_str() {
            "purchase_in" => FlowType::PurchaseIn,
            "sale_out" => FlowType::SaleOut,
            "damage_out" => FlowType::DamageOut,
            "return_out" => FlowType::ReturnOut,
            "adjust_in" => FlowType::AdjustIn,
            "adjust_out" => FlowType::AdjustOut,
            _ => FlowType::SaleOut,
        };
        Ok(StockFlow {
            id: row.get(0)?,
            product_id: row.get(1)?,
            batch_id: row.get(2)?,
            flow_type,
            change_grams: row.get(4)?,
            balance_grams: row.get(5)?,
            order_id: row.get(6)?,
            remark: row.get(7)?,
            created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(PageResult {
        list: items,
        total: total as u32,
        page: page as u32,
        page_size: page_size as u32,
    })
}

/// 采购入库业务实现（可在测试中直接调用）
///
/// v0.3.0 重构：
/// - CR-PO-01: 排他事务包裹整个流程
/// - CR-PO-02: 校验 supplier 存在且启用
/// - CR-PO-03: 插入 purchase_items 明细
/// - CR-PO-04: 插入 purchase_orders 主单（含付款状态）
/// - 任意步骤失败 → 全部回滚
///
/// 提取此函数是为了便于单元测试：测试中可直接传入 `&Connection`，
/// 无需构造 Tauri State。
pub fn purchase_in_impl(
    conn: &Connection,
    input: PurchaseInput,
) -> Result<PurchaseOrder, String> {
    // 1. 输入校验
    if input.items.is_empty() {
        return Err("入库明细不能为空".to_string());
    }
    let supplier_id_str = match &input.supplier_id {
        Some(s) if !s.trim().is_empty() => s.clone(),
        _ => return Err("请选择供应商".to_string()),
    };

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let order_id = Uuid::new_v4().to_string();
    let ts = Local::now();
    // 单号格式：RK + 时间戳（秒级，6位）+ 3位毫秒 + 4位随机后缀
    // 加随机后缀是为了防止同一毫秒内多次入库时主单号冲突
    let random_suffix: u16 = (ts.timestamp_nanos_opt().unwrap_or(0).abs() % 10000) as u16;
    let order_no = format!(
        "RK{}{:03}{:04}",
        ts.format("%Y%m%d%H%M%S"),
        (ts.timestamp_millis() % 1000) as u16,
        random_suffix
    );

    // 2. 排他事务
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    // 辅助闭包：出错时回滚
    let rollback = |e: String, conn: &Connection| -> String {
        let _ = conn.execute("ROLLBACK", []);
        e
    };

    // 3. 校验供应商存在且启用
    let supplier_name: String = conn.query_row(
        "SELECT name FROM suppliers WHERE id = ? AND is_active = 1",
        [&supplier_id_str],
        |row| row.get(0),
    ).map_err(|e| rollback(format!("供应商不存在或已停用: {}", e), conn))?;

    // 4. 校验付款状态合法性
    let payment_status = input.payment_status.as_deref().unwrap_or("unpaid");
    if !["unpaid", "partial", "paid"].contains(&payment_status) {
        return Err(rollback(format!("无效的付款状态: {}", payment_status), conn));
    }

    let mut total_amount = 0.0;
    let mut items = Vec::new();

    for item in &input.items {
        // 4.1 获取商品信息
        let (product_name, product_type): (String, String) = conn.query_row(
            "SELECT name, product_type FROM products WHERE id = ?",
            [&item.product_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| rollback(format!("商品不存在: {}", e), conn))?;

        // 4.2 获取单位换算 + 名称
        let (unit_name, conversion): (String, i64) = conn.query_row(
            "SELECT name, conversion_to_base FROM sales_units WHERE id = ?",
            [&item.unit_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| rollback(format!("单位不存在: {}", e), conn))?;

        // 4.3 计算入库克数和小计
        let grams = item.quantity * conversion;
        let subtotal = item.unit_price * item.quantity as f64;
        total_amount += subtotal;

        // 4.4 生成批次号
        let batch_id = Uuid::new_v4().to_string();
        let batch_code = format!("RK{}{}", Local::now().format("%Y%m%d"), &batch_id[..8]);

        // 4.5 插入批次记录
        conn.execute(
            "INSERT INTO inventory_batches (id, product_id, batch_code, purchase_price,
             total_grams, remaining_grams, supplier_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                batch_id,
                item.product_id,
                batch_code,
                item.unit_price,
                grams,
                grams,
                &supplier_id_str,
                now
            ],
        ).map_err(|e| rollback(format!("插入批次失败: {}", e), conn))?;

        // 4.6 更新商品库存
        let stock_field = if product_type == "weight" { "stock_grams" } else { "stock_units" };
        conn.execute(
            &format!("UPDATE products SET {} = {} + ? WHERE id = ?", stock_field, stock_field),
            params![grams, item.product_id],
        ).map_err(|e| rollback(format!("更新库存失败: {}", e), conn))?;

        // 4.7 记录流水
        let new_balance: i64 = conn.query_row(
            &format!("SELECT {} FROM products WHERE id = ?", stock_field),
            [&item.product_id],
            |row| row.get(0),
        ).map_err(|e| rollback(format!("查询结余失败: {}", e), conn))?;

        let flow_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_flow (id, product_id, batch_id, flow_type, change_grams,
             balance_grams, order_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                flow_id,
                item.product_id,
                batch_id,
                "purchase_in",
                grams,
                new_balance,
                order_id,
                now
            ],
        ).map_err(|e| rollback(format!("记录流水失败: {}", e), conn))?;

        items.push(PurchaseOrderItem {
            product_id: item.product_id.clone(),
            product_name,
            unit_id: item.unit_id.clone(),
            unit_name,
            quantity: item.quantity,
            grams,
            unit_price: item.unit_price,
            subtotal,
            batch_id: batch_id.clone(),
            batch_code: batch_code.clone(),
        });
    }

    // 5. ✨ v0.3.0 新增：先插入 purchase_orders 主单（必须先于 purchase_items，因外键约束）
    conn.execute(
        "INSERT INTO purchase_orders
            (id, order_no, supplier_id, handler, total_amount, payment_status, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            order_id, order_no, supplier_id_str, input.handler,
            total_amount, payment_status,
            input.remark.clone().unwrap_or_default(), now
        ],
    ).map_err(|e| rollback(format!("创建主单失败: {}", e), conn))?;

    // 6. ✨ v0.3.0 新增：再插入 purchase_items 明细（依赖主单 order_id 外键）
    // 注：purchase_items 的 product_name/unit_name/grams/subtotal/batch_id/batch_code
    // 不在 PurchaseItemInput 中，由循环内的 items 集合提供。
    for pi in &items {
        let pi_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO purchase_items
                (id, order_id, product_id, product_name, unit_id, unit_name,
                 quantity, grams, unit_price, subtotal, batch_id, batch_code, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                pi_id, order_id, pi.product_id, pi.product_name,
                pi.unit_id, pi.unit_name,
                pi.quantity, pi.grams, pi.unit_price, pi.subtotal,
                pi.batch_id, pi.batch_code, now
            ],
        ).map_err(|e| rollback(format!("插入明细失败: {}", e), conn))?;
    }

    // 7. 提交事务
    conn.execute("COMMIT", [])
        .map_err(|e| e.to_string())?;

    Ok(PurchaseOrder {
        id: order_id,
        order_no,
        supplier_id: Some(supplier_id_str),
        supplier_name,
        handler: input.handler,
        total_amount,
        payment_status: payment_status.to_string(),
        remark: input.remark,
        items,
        created_at: now,
    })
}

/// 采购入库（Tauri Command）
///
/// 委托给 `purchase_in_impl` 执行实际业务逻辑。
#[tauri::command]
pub async fn purchase_in(
    db: tauri::State<'_, Database>,
    input: PurchaseInput,
) -> Result<PurchaseOrder, String> {
    let conn = db.get_conn()?;
    purchase_in_impl(&conn, input)
}

/// 报损出库
#[tauri::command]
pub async fn damage_out(
    db: tauri::State<'_, Database>,
    input: DamageOutInput,
) -> Result<StockChangeResult, String> {
    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // 开启排他事务
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    // 检查库存
    let (stock_grams, product_type): (i64, String) = conn.query_row(
        "SELECT stock_grams, product_type FROM products WHERE id = ?",
        [&input.product_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    if stock_grams < input.grams {
        conn.execute("ROLLBACK", []).map_err(|e| e.to_string())?;
        return Err(format!("库存不足，当前库存 {}g，需要 {}g", stock_grams, input.grams));
    }

    // 扣减库存
    conn.execute(
        "UPDATE products SET stock_grams = stock_grams - ? WHERE id = ?",
        params![input.grams, input.product_id],
    ).map_err(|e| e.to_string())?;

    // FIFO 批次扣减
    deduct_from_batches(&conn, &input.product_id, input.grams)?;

    // 记录流水
    let new_balance: i64 = conn.query_row(
        "SELECT stock_grams FROM products WHERE id = ?",
        [&input.product_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let flow_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO stock_flow (id, product_id, flow_type, change_grams, balance_grams, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            flow_id,
            input.product_id,
            "damage_out",
            -input.grams,
            new_balance,
            input.remark,
            now
        ],
    ).map_err(|e| e.to_string())?;

    // 提交事务
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(StockChangeResult {
        success: true,
        product_id: input.product_id,
        change_grams: -input.grams,
        new_balance,
        flow_id,
    })
}

/// 盘点调整
#[tauri::command]
pub async fn adjust_stock(
    db: tauri::State<'_, Database>,
    input: AdjustInput,
) -> Result<StockChangeResult, String> {
    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // 开启事务
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    // 检查商品存在
    let (stock_grams,): (i64,) = conn.query_row(
        "SELECT stock_grams FROM products WHERE id = ?",
        [&input.product_id],
        |row| Ok((row.get(0)?,)),
    ).map_err(|e| e.to_string())?;

    let new_balance = stock_grams + input.grams;

    // 检查调整后不为负
    if new_balance < 0 {
        conn.execute("ROLLBACK", []).map_err(|e| e.to_string())?;
        return Err(format!("调整后库存不能为负数，当前 {}g，调整 {}g", stock_grams, input.grams));
    }

    // 更新库存
    conn.execute(
        "UPDATE products SET stock_grams = ? WHERE id = ?",
        params![new_balance, input.product_id],
    ).map_err(|e| e.to_string())?;

    // 记录流水
    let flow_id = Uuid::new_v4().to_string();
    let flow_type = if input.grams > 0 { "adjust_in" } else { "adjust_out" };
    conn.execute(
        "INSERT INTO stock_flow (id, product_id, flow_type, change_grams, balance_grams, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            flow_id,
            input.product_id,
            flow_type,
            input.grams,
            new_balance,
            input.remark,
            now
        ],
    ).map_err(|e| e.to_string())?;

    // 提交事务
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(StockChangeResult {
        success: true,
        product_id: input.product_id,
        change_grams: input.grams,
        new_balance,
        flow_id,
    })
}

/// FIFO 批次扣减
fn deduct_from_batches(conn: &Connection, product_id: &str, grams: i64) -> Result<(), String> {
    let mut remaining = grams;

    let mut stmt = conn.prepare(
        "SELECT id, remaining_grams FROM inventory_batches
         WHERE product_id = ? AND remaining_grams > 0
         ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let batches: Vec<(String, i64)> = stmt.query_map([product_id], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    for (batch_id, batch_remaining) in batches {
        if remaining <= 0 { break; }

        let deduct = remaining.min(batch_remaining);
        conn.execute(
            "UPDATE inventory_batches SET remaining_grams = remaining_grams - ? WHERE id = ?",
            params![deduct, batch_id],
        ).map_err(|e| e.to_string())?;

        remaining -= deduct;
    }

    Ok(())
}

/// 格式化库存克数为可读字符串
fn format_stock_grams(grams: i64) -> String {
    if grams >= 5000 {
        let cases = grams / 5000;
        let remaining = grams % 5000;
        if remaining == 0 {
            format!("{} 件", cases)
        } else {
            format!("{} 件 + {}g", cases, remaining)
        }
    } else {
        format!("{}g", grams)
    }
}

/// 辅助函数：日期加 1 天（YYYY-MM-DD → YYYY-MM-DD）
fn add_one_day(date_str: &str) -> String {
    match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(d) => d.succ_opt()
            .map(|nd| nd.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| date_str.to_string()),
        Err(_) => date_str.to_string(),
    }
}

/// 获取采购入库单列表（业务实现，可在测试中直接调用）
///
/// v0.3.0 M04 采购单持久化
pub fn query_purchase_orders(
    conn: &Connection,
    page: Option<i64>,
    page_size: Option<i64>,
    supplier_id: Option<String>,
    payment_status: Option<String>,
    date_start: Option<String>,  // YYYY-MM-DD（含）
    date_end: Option<String>,    // YYYY-MM-DD（含）
) -> Result<PageResult<PurchaseOrderListItem>, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    // 构建动态 SQL
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref sid) = supplier_id {
        if !sid.trim().is_empty() {
            where_clauses.push("po.supplier_id = ?".to_string());
            params_vec.push(Box::new(sid.clone()));
        }
    }
    if let Some(ref ps) = payment_status {
        if !ps.trim().is_empty() {
            where_clauses.push("po.payment_status = ?".to_string());
            params_vec.push(Box::new(ps.clone()));
        }
    }
    if let Some(ref ds) = date_start {
        if !ds.trim().is_empty() {
            where_clauses.push("po.created_at >= ?".to_string());
            params_vec.push(Box::new(ds.clone()));
        }
    }
    if let Some(ref de) = date_end {
        if !de.trim().is_empty() {
            // 截止日期包含当天，使用 < next_day
            let next_day = add_one_day(de);
            where_clauses.push("po.created_at < ?".to_string());
            params_vec.push(Box::new(next_day));
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // 查询总数
    let count_sql = format!(
        "SELECT COUNT(*) FROM purchase_orders po {}",
        where_sql
    );
    let count_params: Vec<&dyn rusqlite::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, count_params.as_slice(), |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // 查询列表
    // 注意：列顺序必须与下方 row.get(N) 索引一致
    // 0:id, 1:order_no, 2:supplier_id, 3:supplier_name, 4:handler,
    // 5:total_amount, 6:payment_status, 7:item_count, 8:remark, 9:created_at
    let list_sql = format!(
        "SELECT po.id, po.order_no, po.supplier_id, s.name AS supplier_name,
                po.handler, po.total_amount, po.payment_status,
                COUNT(pi.id) AS item_count, po.remark, po.created_at
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         LEFT JOIN purchase_items pi ON pi.order_id = po.id
         {}
         GROUP BY po.id
         ORDER BY po.created_at DESC
         LIMIT ? OFFSET ?",
        where_sql
    );
    params_vec.push(Box::new(page_size));
    params_vec.push(Box::new(offset));
    let list_params: Vec<&dyn rusqlite::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;
    let orders: Vec<PurchaseOrderListItem> = stmt.query_map(list_params.as_slice(), |row| {
        Ok(PurchaseOrderListItem {
            id: row.get(0)?,
            order_no: row.get(1)?,
            supplier_id: row.get(2)?,
            supplier_name: row.get(3)?,
            handler: row.get(4)?,
            total_amount: row.get(5)?,
            payment_status: row.get(6)?,
            item_count: row.get(7)?,
            remark: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(PageResult {
        list: orders,
        total: total as u32,
        page: page as u32,
        page_size: page_size as u32,
    })
}

/// 获取采购入库单列表（分页 + 筛选：日期/供应商/付款状态）
///
/// 委托给 `query_purchase_orders` 执行实际业务逻辑。
#[tauri::command]
pub async fn get_purchase_orders(
    db: tauri::State<'_, Database>,
    page: Option<i64>,
    page_size: Option<i64>,
    supplier_id: Option<String>,
    payment_status: Option<String>,
    date_start: Option<String>,
    date_end: Option<String>,
) -> Result<PageResult<PurchaseOrderListItem>, String> {
    let conn = db.get_conn()?;
    query_purchase_orders(&conn, page, page_size, supplier_id, payment_status, date_start, date_end)
}

/// 获取采购入库单详情（业务实现，可在测试中直接调用）
///
/// v0.3.0 M04 采购单持久化
pub fn query_purchase_order_detail(
    conn: &Connection,
    order_id: String,
) -> Result<PurchaseOrder, String> {
    // 查询主单 + 供应商名称
    let (order_no, supplier_id, supplier_name, handler, total_amount, payment_status, remark, created_at):
        (String, String, String, Option<String>, f64, String, String, String) = conn.query_row(
        "SELECT po.order_no, po.supplier_id, s.name, po.handler, po.total_amount,
                po.payment_status, po.remark, po.created_at
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE po.id = ?",
        [&order_id],
        |row| Ok((
            row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
            row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?,
        )),
    ).map_err(|e| format!("采购单不存在: {}", e))?;

    // 查询明细
    let mut stmt = conn.prepare(
        "SELECT product_id, product_name, unit_id, unit_name,
                quantity, grams, unit_price, subtotal, batch_id, batch_code
         FROM purchase_items
         WHERE order_id = ?
         ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let items: Vec<PurchaseOrderItem> = stmt.query_map(
        [&order_id],
        |row| Ok(PurchaseOrderItem {
            product_id: row.get(0)?,
            product_name: row.get(1)?,
            unit_id: row.get(2)?,
            unit_name: row.get(3)?,
            quantity: row.get(4)?,
            grams: row.get(5)?,
            unit_price: row.get(6)?,
            subtotal: row.get(7)?,
            batch_id: row.get(8)?,
            batch_code: row.get(9)?,
        }),
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(PurchaseOrder {
        id: order_id,
        order_no,
        supplier_id: Some(supplier_id),
        supplier_name,
        handler,
        total_amount,
        payment_status,
        remark: if remark.is_empty() { None } else { Some(remark) },
        items,
        created_at,
    })
}

/// 获取采购入库单详情（含明细）
///
/// 委托给 `query_purchase_order_detail` 执行实际业务逻辑。
#[tauri::command]
pub async fn get_purchase_order_detail(
    db: tauri::State<'_, Database>,
    order_id: String,
) -> Result<PurchaseOrder, String> {
    let conn = db.get_conn()?;
    query_purchase_order_detail(&conn, order_id)
}

/// 更新采购入库单
///
/// 策略：事务包裹的"先删后建"
/// 1. 获取旧采购单详情（含明细和批次信息）
/// 2. BEGIN EXCLUSIVE TRANSACTION
/// 3. 遍历旧明细：删除旧批次 + 扣减商品库存（反向操作）
/// 4. 删除旧流水、旧明细、旧主单
/// 5. 用新 input 重新创建：生成新批次、更新库存、插入流水、插入明细、插入主单（复用原 id 和 order_no）
/// 6. COMMIT
/// 任意步骤失败则 ROLLBACK，保证原子性
#[tauri::command]
pub async fn update_purchase_order(
    db: tauri::State<'_, Database>,
    id: String,
    input: PurchaseInput,
) -> Result<PurchaseOrder, String> {
    let conn = db.get_conn()?;

    // 1. 输入校验
    if input.items.is_empty() {
        return Err("入库明细不能为空".to_string());
    }
    let supplier_id_str = match &input.supplier_id {
        Some(s) if !s.trim().is_empty() => s.clone(),
        _ => return Err("请选择供应商".to_string()),
    };

    // 2. 获取旧采购单信息（主单 order_no + 明细的批次和克数）
    let old_order = query_purchase_order_detail(&conn, id.clone())?;
    let old_order_no = old_order.order_no.clone();

    // 3. 排他事务
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    // 辅助闭包：出错时回滚
    let rollback = |e: String, conn: &Connection| -> String {
        let _ = conn.execute("ROLLBACK", []);
        e
    };

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // 4. 反向库存操作：遍历旧明细，删除旧批次 + 扣减商品库存
    for old_item in &old_order.items {
        // 4.1 删除旧批次
        conn.execute(
            "DELETE FROM inventory_batches WHERE id = ?",
            [&old_item.batch_id],
        ).map_err(|e| rollback(format!("删除旧批次失败: {}", e), &conn))?;

        // 4.2 扣减商品库存（反向操作：减去原先入库的量）
        conn.execute(
            "UPDATE products SET stock_grams = stock_grams - ? WHERE id = ?",
            params![old_item.grams, old_item.product_id],
        ).map_err(|e| rollback(format!("扣减库存失败: {}", e), &conn))?;
    }

    // 5. 删除旧流水
    conn.execute(
        "DELETE FROM stock_flow WHERE order_id = ?",
        [&id],
    ).map_err(|e| rollback(format!("删除旧流水失败: {}", e), &conn))?;

    // 6. 删除旧明细
    conn.execute(
        "DELETE FROM purchase_items WHERE order_id = ?",
        [&id],
    ).map_err(|e| rollback(format!("删除旧明细失败: {}", e), &conn))?;

    // 7. 删除旧主单
    conn.execute(
        "DELETE FROM purchase_orders WHERE id = ?",
        [&id],
    ).map_err(|e| rollback(format!("删除旧主单失败: {}", e), &conn))?;

    // 8. 用新 input 重新创建（复用原 id 和原 order_no）
    // 8.1 校验供应商存在且启用
    let supplier_name: String = conn.query_row(
        "SELECT name FROM suppliers WHERE id = ? AND is_active = 1",
        [&supplier_id_str],
        |row| row.get(0),
    ).map_err(|e| rollback(format!("供应商不存在或已停用: {}", e), &conn))?;

    // 8.2 校验付款状态合法性
    let payment_status = input.payment_status.as_deref().unwrap_or("unpaid");
    if !["unpaid", "partial", "paid"].contains(&payment_status) {
        return Err(rollback(format!("无效的付款状态: {}", payment_status), &conn));
    }

    let mut total_amount = 0.0;
    let mut items = Vec::new();

    for item in &input.items {
        // 查询商品信息
        let (product_name, product_type): (String, String) = conn.query_row(
            "SELECT name, product_type FROM products WHERE id = ?",
            [&item.product_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| rollback(format!("商品不存在: {}", e), &conn))?;

        // 查询单位换算
        let (unit_name, conversion): (String, i64) = conn.query_row(
            "SELECT name, conversion_to_base FROM sales_units WHERE id = ?",
            [&item.unit_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| rollback(format!("单位不存在: {}", e), &conn))?;

        // 计算入库克数和小计
        let grams = item.quantity * conversion;
        let subtotal = item.unit_price * item.quantity as f64;
        total_amount += subtotal;

        // 生成新批次
        let batch_id = Uuid::new_v4().to_string();
        let batch_code = format!("RK{}{}", Local::now().format("%Y%m%d"), &batch_id[..8]);

        // 插入批次记录
        conn.execute(
            "INSERT INTO inventory_batches (id, product_id, batch_code, purchase_price,
             total_grams, remaining_grams, supplier_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![batch_id, item.product_id, batch_code, item.unit_price,
                    grams, grams, &supplier_id_str, now],
        ).map_err(|e| rollback(format!("插入批次失败: {}", e), &conn))?;

        // 更新商品库存
        let stock_field = if product_type == "weight" { "stock_grams" } else { "stock_units" };
        conn.execute(
            &format!("UPDATE products SET {} = {} + ? WHERE id = ?", stock_field, stock_field),
            params![grams, item.product_id],
        ).map_err(|e| rollback(format!("更新库存失败: {}", e), &conn))?;

        // 记录流水
        let new_balance: i64 = conn.query_row(
            &format!("SELECT {} FROM products WHERE id = ?", stock_field),
            [&item.product_id],
            |row| row.get(0),
        ).map_err(|e| rollback(format!("查询结余失败: {}", e), &conn))?;

        let flow_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_flow (id, product_id, batch_id, flow_type, change_grams,
             balance_grams, order_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![flow_id, item.product_id, batch_id, "purchase_in",
                    grams, new_balance, &id, now],
        ).map_err(|e| rollback(format!("记录流水失败: {}", e), &conn))?;

        items.push(PurchaseOrderItem {
            product_id: item.product_id.clone(),
            product_name,
            unit_id: item.unit_id.clone(),
            unit_name,
            quantity: item.quantity,
            grams,
            unit_price: item.unit_price,
            subtotal,
            batch_id: batch_id.clone(),
            batch_code: batch_code.clone(),
        });
    }

    // 插入主单（复用原 id 和原 order_no）
    conn.execute(
        "INSERT INTO purchase_orders
            (id, order_no, supplier_id, handler, total_amount, payment_status, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, old_order_no, supplier_id_str, input.handler,
                total_amount, payment_status,
                input.remark.clone().unwrap_or_default(), now],
    ).map_err(|e| rollback(format!("创建主单失败: {}", e), &conn))?;

    // 插入明细
    for pi in &items {
        let pi_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO purchase_items
                (id, order_id, product_id, product_name, unit_id, unit_name,
                 quantity, grams, unit_price, subtotal, batch_id, batch_code, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![pi_id, id, pi.product_id, pi.product_name,
                    pi.unit_id, pi.unit_name,
                    pi.quantity, pi.grams, pi.unit_price, pi.subtotal,
                    pi.batch_id, pi.batch_code, now],
        ).map_err(|e| rollback(format!("插入明细失败: {}", e), &conn))?;
    }

    // 9. 提交事务
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(PurchaseOrder {
        id,
        order_no: old_order_no,
        supplier_id: Some(supplier_id_str),
        supplier_name,
        handler: input.handler,
        total_amount,
        payment_status: payment_status.to_string(),
        remark: input.remark,
        items,
        created_at: now,
    })
}

// ============================================================================
// 单元测试
// ============================================================================
//
// 覆盖 v0.3.0 采购单持久化（Task-13）的核心场景：
// - 成功路径：主单+明细+批次+库存+流水全部正确写入
// - 回滚路径：校验失败时事务回滚，无脏数据
// - 列表筛选：按供应商、付款状态、日期范围
// - 详情查询：单据完整还原
//
// 使用 :memory: SQLite 避免污染真实数据。

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{run_migrations, Database};
    use crate::models::PurchaseItemInput;

    /// 准备测试用内存数据库（运行迁移到 v3）
    fn setup_test_db() -> Database {
        let conn = Connection::open_in_memory().expect("无法打开内存数据库");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("无法启用外键约束");
        run_migrations(&conn).expect("运行迁移失败");
        Database::new_for_test(conn)
    }

    /// 插入测试供应商，返回 supplier_id
    fn insert_supplier(conn: &Connection, id: &str, name: &str, is_active: i32) {
        conn.execute(
            "INSERT INTO suppliers (id, name, is_active) VALUES (?, ?, ?)",
            rusqlite::params![id, name, is_active],
        )
        .expect("插入供应商失败");
    }

    /// 插入测试商品 + 销售单位，返回 (product_id, unit_id)
    fn insert_product_with_unit(
        conn: &Connection,
        product_id: &str,
        product_name: &str,
        unit_id: &str,
        unit_name: &str,
        conversion: i64,
    ) -> (String, String) {
        conn.execute(
            "INSERT INTO products (id, code, name, product_type, base_unit, stock_grams, stock_units, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                product_id,
                format!("CODE-{}", product_id),
                product_name,
                "weight",
                "g",
                0_i64,
                0_i64,
                1_i64
            ],
        )
        .expect("插入商品失败");
        conn.execute(
            "INSERT INTO sales_units (id, product_id, name, conversion_to_base, retail_price, member_price)
             VALUES (?, ?, ?, ?, ?, ?)",
            rusqlite::params![unit_id, product_id, unit_name, conversion, 100.0_f64, 90.0_f64],
        )
        .expect("插入销售单位失败");
        (product_id.to_string(), unit_id.to_string())
    }

    /// 构造 PurchaseInput 辅助函数
    fn make_purchase_input(
        supplier_id: &str,
        product_id: &str,
        unit_id: &str,
        quantity: i64,
        unit_price: f64,
        payment_status: Option<&str>,
    ) -> PurchaseInput {
        PurchaseInput {
            supplier_id: Some(supplier_id.to_string()),
            handler: Some("测试经手人".to_string()),
            items: vec![PurchaseItemInput {
                product_id: product_id.to_string(),
                unit_id: unit_id.to_string(),
                quantity,
                unit_price,
            }],
            remark: Some("测试采购".to_string()),
            payment_status: payment_status.map(|s| s.to_string()),
        }
    }

    /// 查询商品的当前库存（克数）
    fn get_stock_grams(conn: &Connection, product_id: &str) -> i64 {
        conn.query_row(
            "SELECT stock_grams FROM products WHERE id = ?",
            [product_id],
            |row| row.get(0),
        )
        .expect("查询库存失败")
    }

    /// 统计指定表的记录数
    fn count_rows(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| row.get(0))
            .expect("统计记录数失败")
    }

    // ----------------------------------------------------------------
    // 测试 1: purchase_in 成功路径
    // ----------------------------------------------------------------
    // 验证：
    // - 主单（purchase_orders）正确持久化
    // - 明细（purchase_items）正确持久化
    // - 库存（products.stock_grams）正确增加
    // - 批次（inventory_batches）正确创建
    // - 流水（stock_flow）正确记录
    // - 付款状态正确保存
    // - 返回的 PurchaseOrder 字段完整
    #[test]
    fn test_purchase_in_success() {
        let db = setup_test_db();
        let conn = db.get_conn().unwrap();

        // 准备数据
        insert_supplier(&conn, "sup-test-1", "测试供应商A", 1);
        let (product_id, unit_id) = insert_product_with_unit(
            &conn, "prod-test-1", "大红袍", "unit-test-1", "斤", 500
        );

        // 执行采购入库：2 斤 × 380 元
        let input = make_purchase_input(
            "sup-test-1", &product_id, &unit_id, 2, 380.0, Some("paid")
        );
        let result = purchase_in_impl(&conn, input).expect("采购入库失败");

        // 断言：返回结构
        assert_eq!(result.supplier_id.as_deref(), Some("sup-test-1"));
        assert_eq!(result.supplier_name, "测试供应商A");
        assert_eq!(result.payment_status, "paid");
        assert_eq!(result.total_amount, 760.0); // 2 × 380
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].product_name, "大红袍");
        assert_eq!(result.items[0].unit_name, "斤");
        assert_eq!(result.items[0].grams, 1000); // 2 × 500g
        assert_eq!(result.items[0].subtotal, 760.0);

        // 断言：主单持久化
        let main_count = count_rows(&conn, "purchase_orders");
        assert_eq!(main_count, 1, "purchase_orders 应有 1 条主单");

        // 断言：明细持久化
        let item_count = count_rows(&conn, "purchase_items");
        assert_eq!(item_count, 1, "purchase_items 应有 1 条明细");

        // 断言：库存增加
        let stock = get_stock_grams(&conn, &product_id);
        assert_eq!(stock, 1000, "库存应增加 1000g（2 斤）");

        // 断言：批次创建
        let batch_count = count_rows(&conn, "inventory_batches");
        assert_eq!(batch_count, 1, "inventory_batches 应有 1 条批次");

        // 断言：流水记录
        let flow_count = count_rows(&conn, "stock_flow");
        assert_eq!(flow_count, 1, "stock_flow 应有 1 条流水");

        // 断言：流水类型和数量
        let (flow_type, change_grams, balance_grams): (String, i64, i64) = conn
            .query_row(
                "SELECT flow_type, change_grams, balance_grams FROM stock_flow LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(flow_type, "purchase_in");
        assert_eq!(change_grams, 1000);
        assert_eq!(balance_grams, 1000);
    }

    // ----------------------------------------------------------------
    // 测试 2: purchase_in 在供应商无效时回滚
    // ----------------------------------------------------------------
    // 验证：
    // - 不存在的 supplier_id 应返回错误
    // - 已停用的 supplier（is_active=0）应返回错误
    // - 错误时 ROLLBACK：purchase_orders / purchase_items / inventory_batches / stock_flow 均无记录
    #[test]
    fn test_purchase_in_rollback_on_invalid_supplier() {
        let db = setup_test_db();
        let conn = db.get_conn().unwrap();

        // 准备商品和单位（不准备供应商）
        let (product_id, unit_id) = insert_product_with_unit(
            &conn, "prod-test-2", "铁观音", "unit-test-2", "斤", 500
        );

        // 场景 1: 不存在的 supplier_id
        let input = make_purchase_input(
            "sup-nonexistent", &product_id, &unit_id, 1, 100.0, Some("unpaid")
        );
        let result = purchase_in_impl(&conn, input);
        assert!(result.is_err(), "不存在供应商应报错");
        let err_msg = result.unwrap_err();
        assert!(err_msg.contains("供应商"), "错误信息应包含'供应商'，实际：{}", err_msg);

        // 断言：所有表均无记录（事务回滚）
        assert_eq!(count_rows(&conn, "purchase_orders"), 0);
        assert_eq!(count_rows(&conn, "purchase_items"), 0);
        assert_eq!(count_rows(&conn, "inventory_batches"), 0);
        assert_eq!(count_rows(&conn, "stock_flow"), 0);
        assert_eq!(get_stock_grams(&conn, &product_id), 0);

        // 场景 2: 已停用的 supplier
        insert_supplier(&conn, "sup-disabled", "已停用供应商", 0);
        let input = make_purchase_input(
            "sup-disabled", &product_id, &unit_id, 1, 100.0, Some("unpaid")
        );
        let result = purchase_in_impl(&conn, input);
        assert!(result.is_err(), "已停用供应商应报错");

        // 断言：仍然无任何记录
        assert_eq!(count_rows(&conn, "purchase_orders"), 0);
        assert_eq!(count_rows(&conn, "purchase_items"), 0);
        assert_eq!(count_rows(&conn, "inventory_batches"), 0);
        assert_eq!(count_rows(&conn, "stock_flow"), 0);
    }

    // ----------------------------------------------------------------
    // 测试 3: query_purchase_orders 按供应商筛选
    // ----------------------------------------------------------------
    // 验证：
    // - 创建 2 个供应商的入库单
    // - 筛选 A 供应商时只返回 A 的单据
    // - 筛选 B 供应商时只返回 B 的单据
    // - 不筛选时返回全部
    #[test]
    fn test_query_purchase_orders_filter_by_supplier() {
        let db = setup_test_db();
        let conn = db.get_conn().unwrap();

        // 准备 2 个供应商 + 各自 1 个商品
        insert_supplier(&conn, "sup-a", "供应商A", 1);
        insert_supplier(&conn, "sup-b", "供应商B", 1);
        let (prod_a, unit_a) = insert_product_with_unit(
            &conn, "prod-a", "商品A", "unit-a", "斤", 500
        );
        let (prod_b, unit_b) = insert_product_with_unit(
            &conn, "prod-b", "商品B", "unit-b", "斤", 500
        );

        // 供应商 A 入库 1 单
        let _ = purchase_in_impl(
            &conn,
            make_purchase_input("sup-a", &prod_a, &unit_a, 1, 100.0, Some("paid")),
        ).unwrap();

        // 供应商 B 入库 2 单
        let _ = purchase_in_impl(
            &conn,
            make_purchase_input("sup-b", &prod_b, &unit_b, 1, 200.0, Some("unpaid")),
        ).unwrap();
        let _ = purchase_in_impl(
            &conn,
            make_purchase_input("sup-b", &prod_b, &unit_b, 3, 200.0, Some("partial")),
        ).unwrap();

        // 测试 1: 不筛选 → 返回 3 条
        let result = query_purchase_orders(
            &conn, Some(1), Some(20), None, None, None, None
        ).unwrap();
        assert_eq!(result.total, 3, "无筛选应返回 3 条");
        assert_eq!(result.list.len(), 3);

        // 测试 2: 筛选 supplier-a → 返回 1 条
        let result = query_purchase_orders(
            &conn, Some(1), Some(20), Some("sup-a".to_string()), None, None, None
        ).unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.list[0].supplier_id, "sup-a");
        assert_eq!(result.list[0].supplier_name, "供应商A");
        assert_eq!(result.list[0].total_amount, 100.0);

        // 测试 3: 筛选 supplier-b → 返回 2 条
        let result = query_purchase_orders(
            &conn, Some(1), Some(20), Some("sup-b".to_string()), None, None, None
        ).unwrap();
        assert_eq!(result.total, 2);
        assert!(result.list.iter().all(|o| o.supplier_id == "sup-b"));

        // 测试 4: 筛选 supplier-b + 付款状态 partial → 返回 1 条
        let result = query_purchase_orders(
            &conn, Some(1), Some(20),
            Some("sup-b".to_string()),
            Some("partial".to_string()),
            None, None
        ).unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.list[0].payment_status, "partial");
    }

    // ----------------------------------------------------------------
    // 测试 4: query_purchase_orders 日期范围筛选
    // ----------------------------------------------------------------
    // 验证：
    // - date_start / date_end 限定 created_at 范围
    // - date_end 包含当天（< next_day 模式）
    // - 不传日期时返回全部
    #[test]
    fn test_query_purchase_orders_date_range() {
        let db = setup_test_db();
        let conn = db.get_conn().unwrap();

        insert_supplier(&conn, "sup-d", "日期测试供应商", 1);
        let (product_id, unit_id) = insert_product_with_unit(
            &conn, "prod-d", "日期测试商品", "unit-d", "斤", 500
        );

        // 创建 1 条入库单
        let _ = purchase_in_impl(
            &conn,
            make_purchase_input("sup-d", &product_id, &unit_id, 1, 100.0, Some("unpaid")),
        ).unwrap();

        // 拿到当前时间（YYYY-MM-DD）
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();

        // 测试 1: date_start = 今天, date_end = 今天 → 应返回 1 条
        let result = query_purchase_orders(
            &conn, Some(1), Some(20),
            None, None,
            Some(today.clone()), Some(today.clone())
        ).unwrap();
        assert_eq!(result.total, 1, "今天的入库单应被今天的日期范围检索到");

        // 测试 2: date_start = 明天 → 应返回 0 条
        let tomorrow = {
            let d = chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d").unwrap();
            d.succ_opt().unwrap().format("%Y-%m-%d").to_string()
        };
        let result = query_purchase_orders(
            &conn, Some(1), Some(20),
            None, None,
            Some(tomorrow.clone()), Some(tomorrow.clone())
        ).unwrap();
        assert_eq!(result.total, 0, "明天不应匹配今天的入库单");

        // 测试 3: date_start = 昨天 → 应返回 1 条
        let yesterday = {
            let d = chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d").unwrap();
            d.pred_opt().unwrap().format("%Y-%m-%d").to_string()
        };
        let result = query_purchase_orders(
            &conn, Some(1), Some(20),
            None, None,
            Some(yesterday), Some(today.clone())
        ).unwrap();
        assert_eq!(result.total, 1, "从昨天到今天的范围应包含今天");
    }

    // ----------------------------------------------------------------
    // 测试 5: query_purchase_order_detail 查询单据详情
    // ----------------------------------------------------------------
    // 验证：
    // - 正确返回主单字段（supplier_name、payment_status、handler 等）
    // - 正确返回明细列表（按 created_at ASC 排序）
    // - 不存在的 order_id 返回错误
    #[test]
    fn test_query_purchase_order_detail() {
        let db = setup_test_db();
        let conn = db.get_conn().unwrap();

        // 准备 1 个供应商 + 2 个商品
        insert_supplier(&conn, "sup-dt", "详情测试供应商", 1);
        let (prod_x, unit_x) = insert_product_with_unit(
            &conn, "prod-x", "商品X", "unit-x", "斤", 500
        );
        let (prod_y, unit_y) = insert_product_with_unit(
            &conn, "prod-y", "商品Y", "unit-y", "盒", 250
        );

        // 构造含 2 个明细的入库单
        let input = PurchaseInput {
            supplier_id: Some("sup-dt".to_string()),
            handler: Some("张三".to_string()),
            items: vec![
                PurchaseItemInput {
                    product_id: prod_x.clone(),
                    unit_id: unit_x.clone(),
                    quantity: 2,
                    unit_price: 100.0,
                },
                PurchaseItemInput {
                    product_id: prod_y.clone(),
                    unit_id: unit_y.clone(),
                    quantity: 1,
                    unit_price: 50.0,
                },
            ],
            remark: Some("混合采购".to_string()),
            payment_status: Some("partial".to_string()),
        };
        let order = purchase_in_impl(&conn, input).expect("采购入库失败");

        // 查询详情
        let detail = query_purchase_order_detail(&conn, order.id.clone())
            .expect("查询详情失败");

        // 断言：主单字段
        assert_eq!(detail.id, order.id);
        assert_eq!(detail.order_no, order.order_no);
        assert_eq!(detail.supplier_id.as_deref(), Some("sup-dt"));
        assert_eq!(detail.supplier_name, "详情测试供应商");
        assert_eq!(detail.handler.as_deref(), Some("张三"));
        assert_eq!(detail.payment_status, "partial");
        assert_eq!(detail.total_amount, 250.0); // 2×100 + 1×50
        assert_eq!(detail.remark.as_deref(), Some("混合采购"));

        // 断言：明细（2 条）
        assert_eq!(detail.items.len(), 2);
        // 第一条：商品 X
        assert_eq!(detail.items[0].product_name, "商品X");
        assert_eq!(detail.items[0].quantity, 2);
        assert_eq!(detail.items[0].grams, 1000);
        assert_eq!(detail.items[0].subtotal, 200.0);
        // 第二条：商品 Y
        assert_eq!(detail.items[1].product_name, "商品Y");
        assert_eq!(detail.items[1].quantity, 1);
        assert_eq!(detail.items[1].grams, 250);
        assert_eq!(detail.items[1].subtotal, 50.0);

        // 断言：不存在的 order_id 应报错
        let result = query_purchase_order_detail(&conn, "non-existent-id".to_string());
        assert!(result.is_err(), "不存在的 order_id 应返回错误");
        assert!(result.unwrap_err().contains("采购单不存在"));
    }
}
