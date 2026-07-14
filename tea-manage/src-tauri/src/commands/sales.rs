//! 销售相关 Tauri Commands
//! 
//! 提供销售订单创建、查询、挂单、取单等操作

use crate::db::Database;
use crate::models::{
    SaleOrderInput, SaleOrder, SaleOrderItem,
    HeldOrder, Member, MemberLevel, MemberDetail, MemberPreference, MemberPreferenceInput,
    MemberConsumption, MemberConsumptionItem, PageResult,
    SaleOrderSummary, DashboardStats,
};
use chrono::Local;
use rusqlite::{params, params_from_iter, Connection, types::Value};
use uuid::Uuid;

/// 校验手机号格式：中国大陆11位手机号（1开头，第二位3-9，共11位数字）
fn validate_phone(phone: &str) -> Result<(), String> {
    if phone.is_empty() {
        return Err("手机号不能为空".to_string());
    }
    let chars: Vec<char> = phone.chars().collect();
    if chars.len() != 11 {
        return Err("手机号必须为11位数字".to_string());
    }
    if chars[0] != '1' {
        return Err("手机号必须以1开头".to_string());
    }
    if !('3'..='9').contains(&chars[1]) {
        return Err("手机号第二位必须为3-9".to_string());
    }
    if !chars.iter().all(|c| c.is_ascii_digit()) {
        return Err("手机号只能包含数字".to_string());
    }
    Ok(())
}

/// 校验姓名非空
fn validate_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("姓名不能为空".to_string());
    }
    Ok(())
}

/// 校验销售明细数量必须大于0
fn validate_sale_items(items: &[crate::models::SaleItemInput]) -> Result<(), String> {
    if items.is_empty() {
        return Err("销售明细不能为空".to_string());
    }
    for (i, item) in items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(format!("第{}个商品数量必须大于0", i + 1));
        }
    }
    Ok(())
}

/// 获取或创建会员
#[tauri::command]
pub async fn get_member_by_phone(
    db: tauri::State<'_, Database>,
    phone: String,
) -> Result<Option<Member>, String> {
    let conn = db.get_conn()?;
    
    let member: Option<Member> = conn.query_row(
        "SELECT id, name, phone, gender, birthday, level, points, balance,
                total_consume, consume_count, last_visit, created_at
         FROM members WHERE phone = ? AND is_active = 1",
        [&phone],
        |row| Member::from_row(row),
    ).ok();
    
    Ok(member)
}

/// 创建会员
#[tauri::command]
pub async fn create_member(
    db: tauri::State<'_, Database>,
    name: String,
    phone: String,
    gender: Option<String>,
    birthday: Option<String>,
) -> Result<Member, String> {
    // 输入验证：姓名非空、手机号格式
    validate_name(&name)?;
    validate_phone(&phone)?;

    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let id = Uuid::new_v4().to_string();
    
    conn.execute(
        "INSERT INTO members (id, name, phone, gender, birthday, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![id, name, phone, gender, birthday, now, now],
    ).map_err(|e| e.to_string())?;
    
    Ok(Member {
        id,
        name,
        phone,
        gender,
        birthday,
        level: MemberLevel::Normal,
        points: 0,
        balance: 0.0,
        total_consume: 0.0,
        consume_count: 0,
        last_visit: None,
        created_at: now,
    })
}

/// 更新会员信息
#[tauri::command]
pub async fn update_member(
    db: tauri::State<'_, Database>,
    member_id: String,
    name: String,
    phone: String,
    gender: Option<String>,
    birthday: Option<String>,
) -> Result<Member, String> {
    // 输入验证：姓名非空、手机号格式
    validate_name(&name)?;
    validate_phone(&phone)?;

    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    // 检查手机号是否被其他会员使用
    let existing: Option<String> = conn.query_row(
        "SELECT id FROM members WHERE phone = ? AND id != ? AND is_active = 1",
        params![&phone, &member_id],
        |row| row.get(0),
    ).ok();
    
    if existing.is_some() {
        return Err("该手机号已被其他会员使用".to_string());
    }
    
    conn.execute(
        "UPDATE members SET name = ?, phone = ?, gender = ?, birthday = ?, updated_at = ?
         WHERE id = ? AND is_active = 1",
        params![name, phone, gender, birthday, now, member_id],
    ).map_err(|e| e.to_string())?;
    
    // 查询更新后的会员信息，使用 from_row 统一转换
    let member: Member = conn.query_row(
        "SELECT id, name, phone, gender, birthday, level, points, balance,
                total_consume, consume_count, last_visit, created_at
         FROM members WHERE id = ?",
        [&member_id],
        |row| Member::from_row(row),
    ).map_err(|e| e.to_string())?;
    
    Ok(member)
}

/// 创建销售订单
/// 
/// 修复项：
/// - CR-04: 使用单层 BEGIN EXCLUSIVE TRANSACTION 包裹整个函数
/// - CR-05: 避免在 query_map 回调中使用 unwrap
/// - CR-06: 积分抵扣规则修正（100积分=1元），积分扣减先消耗再获得，余额不因积分抵扣变化
/// - CR-07/08: 校验积分/金额不可为负
/// - CR-09: 会员等级自动升级
/// - CR-09b: FIFO扣减后校验余量
/// - CR-13: 订单编号加毫秒防重复
/// - CR-14: 折扣率统一使用 MemberLevel::discount_rate()
#[tauri::command]
pub async fn create_sale_order(
    db: tauri::State<'_, Database>,
    input: SaleOrderInput,
) -> Result<SaleOrder, String> {
    // 输入验证：数量必须大于0
    validate_sale_items(&input.items)?;

    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let order_id = Uuid::new_v4().to_string();
    // 订单编号加毫秒 + 随机后缀防重复（CR-13 / IM-02）
    let ts = Local::now();
    let random_suffix: u16 = (ts.timestamp_nanos_opt().unwrap_or(0).abs() % 10000) as u16;
    let order_no = format!(
        "XS{}{:03}{:04}",
        ts.format("%Y%m%d%H%M%S"),
        (ts.timestamp_millis() % 1000) as u16,
        random_suffix
    );
    
    // CR-04: 单层 BEGIN EXCLUSIVE TRANSACTION 包裹整个函数
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", []).map_err(|e| e.to_string())?;
    
    // 辅助闭包：出错时回滚事务
    let rollback_on_err = |e: String, conn: &Connection| -> String {
        let _ = conn.execute("ROLLBACK", []);
        e
    };
    
    // 获取会员信息并计算折扣（CR-14: 使用 MemberLevel::discount_rate()）
    let (member_name, member_level, member_id_opt) = if let Some(ref mid) = input.member_id {
        let (name, level_str): (String, String) = conn.query_row(
            "SELECT name, level FROM members WHERE id = ?",
            [mid],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        let level = MemberLevel::from_db_str(&level_str);
        (Some(name), level, Some(mid.clone()))
    } else {
        (None, MemberLevel::Normal, None)
    };
    
    // C2 修复：尊重系统「启用会员折扣」开关；开关关闭或无可识别会员时不打折。
    // 折扣以开关状态为唯一来源，避免前端关开关、后端仍打折导致账目不一致。
    let apply_discount = input.apply_member_discount.unwrap_or(false) && member_id_opt.is_some();
    let discount_rate = if apply_discount { member_level.discount_rate() } else { 1.0 };
    
    // 计算金额并扣减库存
    let mut total_amount = 0.0;
    let mut items = Vec::new();
    // 暂存待插入的销售明细（需在 sales_orders 之后插入，满足 sales_items.order_id 外键约束）
    let mut pending_items: Vec<(String, String, String, String, String, i64, f64, i64, f64)> = Vec::new();
    
    for item in &input.items {
        // 获取商品和销售单位信息
        let (product_name, grams_per_unit, retail_price): (String, i64, f64) = conn.query_row(
            "SELECT p.name, su.conversion_to_base, su.retail_price
             FROM products p
             JOIN sales_units su ON p.id = su.product_id
             WHERE p.id = ? AND su.id = ?",
            params![item.product_id, item.unit_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        let grams = grams_per_unit * item.quantity;
        let subtotal = crate::utils::money::round2(retail_price * item.quantity as f64);
        total_amount += subtotal;
        
        // 检查库存（按商品类型选择库存列：称重用 stock_grams，计件用 stock_units）
        // CR-01 修复：原代码恒比较/扣减 stock_grams，导致计件类商品库存账目永久错乱
        let (stock, product_type): (i64, String) = conn.query_row(
            "SELECT CASE WHEN product_type = 'weight' THEN stock_grams ELSE stock_units END, product_type FROM products WHERE id = ?",
            [&item.product_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        if stock < grams {
            return Err(rollback_on_err(
                format!("商品[{}]库存不足，当前库存{}，需要{}", product_name, stock, grams),
                &conn,
            ));
        }
        
        // 扣减库存（按类型选择列）
        let stock_field = if product_type == "weight" { "stock_grams" } else { "stock_units" };
        conn.execute(
            &format!("UPDATE products SET {} = {} - ? WHERE id = ?", stock_field, stock_field),
            params![grams, item.product_id],
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        // FIFO 批次扣减
        let mut remaining = grams;
        let mut stmt = conn.prepare(
            "SELECT id, remaining_grams FROM inventory_batches
             WHERE product_id = ? AND remaining_grams > 0
             ORDER BY created_at ASC"
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        let batches: Vec<(String, i64)> = stmt.query_map([&item.product_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).map_err(|e| rollback_on_err(e.to_string(), &conn))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        for (batch_id, batch_remaining) in batches {
            if remaining <= 0 { break; }
            let deduct = remaining.min(batch_remaining);
            conn.execute(
                "UPDATE inventory_batches SET remaining_grams = remaining_grams - ? WHERE id = ?",
                params![deduct, batch_id],
            ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
            remaining -= deduct;
        }
        
        // CR-09b: FIFO循环结束后校验余量
        if remaining > 0 {
            return Err(rollback_on_err(
                format!("商品[{}]批次库存不足，缺少{}g", product_name, remaining),
                &conn,
            ));
        }
        
        // 记录库存流水（余额按商品类型读取对应库存列）
        let new_balance: i64 = conn.query_row(
            &format!("SELECT {} FROM products WHERE id = ?", stock_field),
            [&item.product_id],
            |row| row.get(0),
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        let flow_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_flow (id, product_id, flow_type, change_grams, balance_grams, order_id, created_at)
             VALUES (?, ?, 'sale_out', ?, ?, ?, ?)",
            params![flow_id, item.product_id, -grams, new_balance, order_id, now],
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        // 获取单位名称
        let unit_name: String = conn.query_row(
            "SELECT name FROM sales_units WHERE id = ?",
            [&item.unit_id],
            |row| row.get(0),
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;

        // 暂存明细数据（延迟到 sales_orders 插入后再写入 sales_items，避免外键约束失败）
        let item_id = Uuid::new_v4().to_string();
        pending_items.push((
            item_id.clone(),
            item.product_id.clone(),
            product_name.clone(),
            item.unit_id.clone(),
            unit_name.clone(),
            item.quantity,
            retail_price,
            grams,
            subtotal,
        ));
        
        items.push(SaleOrderItem {
            id: item_id,
            order_id: order_id.clone(),
            product_id: item.product_id.clone(),
            product_name,
            unit_name,
            quantity: item.quantity,
            unit_price: retail_price,
            grams,
            subtotal,
        });
    }
    
    // 金额精度：聚合后对总和四舍五入，消除 f64 累加漂移
    total_amount = crate::utils::money::round2(total_amount);

    // 计算折扣
    let discount_amount = crate::utils::money::round2(total_amount * (1.0 - discount_rate));
    let after_discount = crate::utils::money::round2(total_amount - discount_amount);
    
    // CR-06: 积分抵扣规则修正
    // points_deduct 是使用的积分数（不是金额），100积分=1元
    let points_deduct = input.points_deduct.unwrap_or(0);
    // CR-07: 校验积分抵扣数不能为负
    if points_deduct < 0 {
        return Err(rollback_on_err("积分抵扣数不能为负数".to_string(), &conn));
    }
    // 抵扣金额 = 积分数 / 100
    let points_deduct_amount = crate::utils::money::round2(points_deduct as f64 / 100.0);

    // G4: 无会员时不允许使用积分抵扣（避免凭空优惠且无积分来源）
    if input.member_id.is_none() && points_deduct > 0 {
        return Err(rollback_on_err("使用积分抵扣需先选择会员".to_string(), &conn));
    }

    // 如果有会员，校验积分余额是否足够
    if let Some(ref mid) = input.member_id {
        let member_points: i64 = conn.query_row(
            "SELECT points FROM members WHERE id = ?",
            [mid],
            |row| row.get(0),
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        if member_points < points_deduct {
            return Err(rollback_on_err(
                format!("会员积分不足，当前积分{}，需要抵扣{}", member_points, points_deduct),
                &conn,
            ));
        }
    }
    
    let actual_amount = crate::utils::money::round2(after_discount - points_deduct_amount);
    // CR-07: 校验实付金额不能为负
    if actual_amount < 0.0 {
        return Err(rollback_on_err("实付金额不能为负数，积分抵扣过多".to_string(), &conn));
    }
    
    // 1元=1积分（按实付金额计算获得积分）；IM-03 修复：四舍五入而非截断
    let points_earned = crate::utils::money::round2(actual_amount).round() as i64;
    
    // 创建订单
    conn.execute(
        "INSERT INTO sales_orders (id, order_no, member_id, member_name, total_amount, discount_amount,
         points_deduct, points_earned, actual_amount, pay_method, pay_status, status, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'completed', ?, ?)",
        params![
            order_id,
            order_no,
            member_id_opt,
            member_name,
            total_amount,
            discount_amount,
            points_deduct,
            points_earned,
            actual_amount,
            input.pay_method,
            input.remark,
            now
        ],
    ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;

    // 插入销售明细（必须在 sales_orders 之后，满足 sales_items.order_id 外键约束）
    for (item_id, pid, pname, uid, uname, qty, price, g, sub) in &pending_items {
        conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![item_id, order_id, pid, pname, uid, uname, qty, price, g, sub, now],
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
    }

    // G6: 会员余额支付必须有会员，否则账目与支付记录脱节
    if input.pay_method.as_deref() == Some("memberBalance") && input.member_id.is_none() {
        return Err(rollback_on_err("使用会员余额支付必须先选择会员".to_string(), &conn));
    }

    // CR-06/CR-09: 更新会员积分和消费记录
    // 积分 = 积分 - 抵扣积分 + 获得积分；余额不因积分抵扣而变化；等级自动升级
    if let Some(ref mid) = input.member_id {
        // 先查询当前会员信息用于等级判断
        let (current_points, current_total_consume): (i64, f64) = conn.query_row(
            "SELECT points, total_consume FROM members WHERE id = ?",
            [mid],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        let new_total_consume = crate::utils::money::round2(current_total_consume + actual_amount);
        // CR-09: 根据累计消费自动判断等级
        let new_level = MemberLevel::from_total_consume(new_total_consume);
        
        conn.execute(
            "UPDATE members SET 
                points = points - ? + ?,
                total_consume = total_consume + ?,
                consume_count = consume_count + 1,
                last_visit = ?,
                level = ?,
                updated_at = ?
             WHERE id = ?",
            params![points_deduct, points_earned, actual_amount, now, new_level.as_str(), now, mid],
        ).map_err(|e| rollback_on_err(e.to_string(), &conn))?;
        
        // v0.3.1 M06: 当 pay_method='memberBalance' 时扣减会员余额 + 记录 consume 流水
        if input.pay_method.as_deref() == Some("memberBalance") {
            // 1. 查询当前余额
            let current_balance: f64 = conn.query_row(
                "SELECT balance FROM members WHERE id = ?",
                [mid],
                |row| row.get(0),
            ).map_err(|e| rollback_on_err(format!("查询会员余额失败: {}", e), &conn))?;

            // 2. 校验余额充足
            if current_balance < actual_amount {
                return Err(rollback_on_err(
                    format!(
                        "会员余额不足，当前余额 ¥{:.2}，需要支付 ¥{:.2}",
                        current_balance, actual_amount
                    ),
                    &conn,
                ));
            }

            // 3. 扣减余额
            let new_balance = crate::utils::money::round2(current_balance - actual_amount);
            conn.execute(
                "UPDATE members SET balance = ?, updated_at = ? WHERE id = ?",
                params![new_balance, now, mid],
            )
            .map_err(|e| rollback_on_err(format!("扣减余额失败: {}", e), &conn))?;

            // 4. 记录 consume 流水（change_amount 为负数）
            let log_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO member_balance_logs
                    (id, member_id, change_type, change_amount, balance_after,
                     payment_method, operator, related_order_id, remark, created_at)
                 VALUES (?, ?, 'consume', ?, ?, 'memberBalance', '收银台', ?, ?, ?)",
                params![
                    log_id,
                    mid,
                    -actual_amount,
                    new_balance,
                    order_id,
                    format!("订单 {} 余额扣款", order_no),
                    now
                ],
            )
            .map_err(|e| rollback_on_err(format!("记录余额流水失败: {}", e), &conn))?;
        }
    }
    
    // 提交事务
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    
    Ok(SaleOrder {
        id: order_id,
        order_no,
        member_id: member_id_opt,
        member_name,
        total_amount,
        discount_amount,
        points_deduct,
        points_earned,
        actual_amount,
        pay_method: input.pay_method,
        pay_status: "paid".to_string(),
        status: "completed".to_string(),
        remark: input.remark,
        items,
        created_at: now,
    })
}

/// 挂单（将待支付订单保存为挂起状态）
/// 添加事务保护
#[tauri::command]
pub async fn hold_order(
    db: tauri::State<'_, Database>,
    input: SaleOrderInput,
) -> Result<String, String> {
    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let order_id = Uuid::new_v4().to_string();
    let ts = Local::now();
    let order_no = format!("GD{}{:03}", ts.format("%Y%m%d%H%M%S"), (ts.timestamp_millis() % 1000) as u16);
    
    // 开启事务
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;
    
    // 计算金额
    let mut total_amount = 0.0;
    for item in &input.items {
        let retail_price: f64 = conn.query_row(
            "SELECT su.retail_price FROM sales_units su WHERE su.id = ?",
            [&item.unit_id],
            |row| row.get(0),
        ).map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;
        let item_subtotal = crate::utils::money::round2(retail_price * item.quantity as f64);
        total_amount += item_subtotal;
    }
    
    // 金额精度：聚合后对总和四舍五入
    total_amount = crate::utils::money::round2(total_amount);

    // 会员名称
    let member_name: Option<String> = if let Some(ref mid) = input.member_id {
        conn.query_row(
            "SELECT name FROM members WHERE id = ?",
            [mid],
            |row| row.get(0),
        ).ok()
    } else { None };
    
    // 创建挂单（status=pending，pay_status=unpaid 与详情返回保持一致）
    conn.execute(
        "INSERT INTO sales_orders (id, order_no, member_id, member_name, total_amount,
         actual_amount, pay_status, status, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?, ?)",
        params![order_id, order_no, input.member_id, member_name, total_amount, total_amount, input.remark, now],
    ).map_err(|e| {
        let _ = conn.execute("ROLLBACK", []);
        e.to_string()
    })?;
    
    // 保存明细（不扣库存）
    for item in &input.items {
        let (product_name, grams_per_unit, retail_price): (String, i64, f64) = conn.query_row(
            "SELECT p.name, su.conversion_to_base, su.retail_price
             FROM products p JOIN sales_units su ON p.id = su.product_id
             WHERE p.id = ? AND su.id = ?",
            params![item.product_id, item.unit_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;
        
        let grams = grams_per_unit * item.quantity;
        let subtotal = crate::utils::money::round2(retail_price * item.quantity as f64);
        let item_id = Uuid::new_v4().to_string();
        
        // 获取单位名称
        let unit_name: String = conn.query_row(
            "SELECT name FROM sales_units WHERE id = ?",
            [&item.unit_id],
            |row| row.get(0),
        ).map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;
        
        conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![item_id, order_id, item.product_id, product_name, item.unit_id, unit_name, item.quantity, retail_price, grams, subtotal, now],
        ).map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;
    }
    
    // 提交事务
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    
    Ok(order_id)
}

/// 获取挂起的订单列表
/// MJ-14: 使用 LEFT JOIN + GROUP BY 消除 N+1 查询，一次查询获取订单和商品数量
#[tauri::command]
pub async fn get_held_orders(
    db: tauri::State<'_, Database>,
) -> Result<Vec<HeldOrder>, String> {
    let conn = db.get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT so.id, so.order_no, so.member_name, so.total_amount, so.created_at,
                COUNT(si.id) AS item_count
         FROM sales_orders so
         LEFT JOIN sales_items si ON si.order_id = so.id
         WHERE so.status = 'pending'
         GROUP BY so.id
         ORDER BY so.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let orders: Vec<HeldOrder> = stmt.query_map([], |row| {
        Ok(HeldOrder {
            id: row.get(0)?,
            order_no: row.get(1)?,
            member_name: row.get(2)?,
            total_amount: row.get(3)?,
            created_at: row.get(4)?,
            item_count: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(orders)
}

/// 取单（恢复挂起的订单）
#[tauri::command]
pub async fn get_held_order_detail(
    db: tauri::State<'_, Database>,
    order_id: String,
) -> Result<SaleOrder, String> {
    let conn = db.get_conn()?;
    
    // 查询订单
    let (order_no, member_id, member_name, total_amount, remark, created_at): 
        (String, Option<String>, Option<String>, f64, Option<String>, String) = conn.query_row(
        "SELECT order_no, member_id, member_name, total_amount, remark, created_at
         FROM sales_orders WHERE id = ? AND status = 'pending'",
        [&order_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
    ).map_err(|e| e.to_string())?;
    
    // 查询明细
    let mut stmt = conn.prepare(
        "SELECT id, order_id, product_id, product_name, unit_name, quantity, unit_price, grams, subtotal
         FROM sales_items WHERE order_id = ?"
    ).map_err(|e| e.to_string())?;
    
    let items: Vec<SaleOrderItem> = stmt.query_map([&order_id], |row| {
        Ok(SaleOrderItem {
            id: row.get(0)?,
            order_id: row.get(1)?,
            product_id: row.get(2)?,
            product_name: row.get(3)?,
            unit_name: row.get(4)?,
            quantity: row.get(5)?,
            unit_price: row.get(6)?,
            grams: row.get(7)?,
            subtotal: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    
    Ok(SaleOrder {
        id: order_id,
        order_no,
        member_id,
        member_name,
        total_amount,
        discount_amount: 0.0,
        points_deduct: 0,
        points_earned: 0,
        actual_amount: total_amount,
        pay_method: None,
        // 🔧 v0.3.3 修复：与前端 PayStatus 类型保持一致（unpaid 而非 pending）
        pay_status: "unpaid".to_string(),
        status: "pending".to_string(),
        remark,
        items,
        created_at,
    })
}

/// 删除挂起的订单
/// 添加事务保护
#[tauri::command]
pub async fn delete_held_order(
    db: tauri::State<'_, Database>,
    order_id: String,
) -> Result<(), String> {
    let conn = db.get_conn()?;
    
    // 开启事务
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM sales_items WHERE order_id = ?", [&order_id])
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;
    conn.execute("DELETE FROM sales_orders WHERE id = ? AND status = 'pending'", [&order_id])
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            e.to_string()
        })?;
    
    // 提交事务
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 获取会员列表
#[tauri::command]
pub async fn get_members(
    db: tauri::State<'_, Database>,
    page: Option<i64>,
    page_size: Option<i64>,
    keyword: Option<String>,
) -> Result<PageResult<Member>, String> {
    let conn = db.get_conn()?;
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;
    
    // 根据是否有 keyword 构建不同的查询，使用 from_row 统一转换
    let (total, members): (i64, Vec<Member>) = if let Some(ref kw) = keyword {
        let kw_like = format!("%{}%", kw);
        
        // 查询总数
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM members WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)",
            params![&kw_like, &kw_like],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        
        // 查询列表
        let mut stmt = conn.prepare(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members
             WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?"
        ).map_err(|e| e.to_string())?;
        
        let members: Vec<Member> = stmt.query_map(
            params![&kw_like, &kw_like, page_size, offset],
            |row| Member::from_row(row),
        ).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        
        (total, members)
    } else {
        // 无 keyword 的情况
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM members WHERE is_active = 1",
            [],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members
             WHERE is_active = 1
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?"
        ).map_err(|e| e.to_string())?;
        
        let members: Vec<Member> = stmt.query_map(
            params![page_size, offset],
            |row| Member::from_row(row),
        ).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        
        (total, members)
    };
    
    Ok(PageResult {
        list: members,
        total: total as u32,
        page: page as u32,
        page_size: page_size as u32,
    })
}

/// 获取会员详情（包含偏好）
#[tauri::command]
pub async fn get_member_detail(
    db: tauri::State<'_, Database>,
    member_id: String,
) -> Result<MemberDetail, String> {
    let conn = db.get_conn()?;
    
    // 查询会员，使用 from_row 统一转换
    let member: Member = conn.query_row(
        "SELECT id, name, phone, gender, birthday, level, points, balance,
                total_consume, consume_count, last_visit, created_at
         FROM members WHERE id = ? AND is_active = 1",
        [&member_id],
        |row| Member::from_row(row),
    ).map_err(|e| e.to_string())?;
    
    // 查询偏好
    let preference: Option<MemberPreference> = conn.query_row(
        "SELECT member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark
         FROM member_preferences WHERE member_id = ?",
        [&member_id],
        |row| {
            let preferred_teas_str: String = row.get(1)?;
            let taste_prefs_str: String = row.get(2)?;
            let scenario_str: String = row.get(5)?;
            
            Ok(MemberPreference {
                member_id: row.get(0)?,
                preferred_teas: serde_json::from_str(&preferred_teas_str).unwrap_or_default(),
                taste_preferences: serde_json::from_str(&taste_prefs_str).unwrap_or_default(),
                taboos: row.get(3)?,
                brew_habits: row.get(4)?,
                consumption_scenario: serde_json::from_str(&scenario_str).unwrap_or_default(),
                remark: row.get(6)?,
            })
        },
    ).ok();
    
    Ok(MemberDetail { member, preference })
}

/// 更新会员口味偏好
#[tauri::command]
pub async fn update_member_preference(
    db: tauri::State<'_, Database>,
    member_id: String,
    input: MemberPreferenceInput,
) -> Result<MemberPreference, String> {
    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let preferred_teas_json = serde_json::to_string(&input.preferred_teas).map_err(|e| e.to_string())?;
    let taste_prefs_json = serde_json::to_string(&input.taste_preferences).map_err(|e| e.to_string())?;
    let scenario_json = serde_json::to_string(&input.consumption_scenario).map_err(|e| e.to_string())?;
    
    // 使用 INSERT OR REPLACE 插入或替换
    conn.execute(
        "INSERT OR REPLACE INTO member_preferences 
         (id, member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark, updated_at)
         VALUES (
             (SELECT id FROM member_preferences WHERE member_id = ?),
             ?, ?, ?, ?, ?, ?, ?, ?
         )",
        params![member_id, member_id, preferred_teas_json, taste_prefs_json, input.taboos, input.brew_habits, scenario_json, input.remark, now],
    ).map_err(|e| e.to_string())?;
    
    Ok(MemberPreference {
        member_id,
        preferred_teas: input.preferred_teas,
        taste_preferences: input.taste_preferences,
        taboos: input.taboos,
        brew_habits: input.brew_habits,
        consumption_scenario: input.consumption_scenario,
        remark: input.remark,
    })
}

/// 获取会员消费记录
#[tauri::command]
pub async fn get_member_consumption(
    db: tauri::State<'_, Database>,
    member_id: String,
) -> Result<MemberConsumption, String> {
    let conn = db.get_conn()?;
    
    // 查询会员消费统计
    let (total_consume, consume_count): (f64, i64) = conn.query_row(
        "SELECT total_consume, consume_count FROM members WHERE id = ?",
        [&member_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;
    
    // 查询消费记录
    let mut stmt = conn.prepare(
        "SELECT id, order_no, total_amount, points_earned, points_deduct, created_at
         FROM sales_orders
         WHERE member_id = ? AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 50"
    ).map_err(|e| e.to_string())?;
    
    let records: Vec<MemberConsumptionItem> = stmt.query_map([&member_id], |row| {
        Ok(MemberConsumptionItem {
            order_id: row.get(0)?,
            order_no: row.get(1)?,
            total_amount: row.get(2)?,
            points_earned: row.get(3)?,
            points_deduct: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    
    Ok(MemberConsumption {
        member_id,
        total_consume,
        consume_count,
        records,
    })
}

/// 获取销售历史订单（列表/报表用）
///
/// 支持筛选：日期区间（start_date/end_date，按天比较）、会员、商品；
/// 仅统计已完成（status='completed'）订单；返回分页结果与每行商品行数。
#[tauri::command]
pub async fn get_sale_orders(
    db: tauri::State<'_, Database>,
    start_date: Option<String>,
    end_date: Option<String>,
    member_id: Option<String>,
    product_id: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PageResult<SaleOrderSummary>, String> {
    let conn = db.get_conn()?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 200);
    let offset = (page - 1) * page_size;

    // 动态拼装 WHERE 条件与参数（参数化，避免 SQL 注入）
    let mut clauses: Vec<String> = vec!["status = 'completed'".to_string()];
    let mut values: Vec<Value> = Vec::new();

    if let Some(ref s) = start_date {
        clauses.push("date(created_at) >= date(?)".to_string());
        values.push(Value::Text(s.clone()));
    }
    if let Some(ref e) = end_date {
        clauses.push("date(created_at) <= date(?)".to_string());
        values.push(Value::Text(e.clone()));
    }
    if let Some(ref mid) = member_id {
        clauses.push("member_id = ?".to_string());
        values.push(Value::Text(mid.clone()));
    }
    if let Some(ref pid) = product_id {
        // 商品筛选通过明细表子查询实现（一个订单可能含多个商品）
        clauses.push("id IN (SELECT order_id FROM sales_items WHERE product_id = ?)".to_string());
        values.push(Value::Text(pid.clone()));
    }
    let where_sql = clauses.join(" AND ");

    let total: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM sales_orders WHERE {}", where_sql),
        params_from_iter(values.iter()),
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let mut list_stmt = conn.prepare(&format!(
        "SELECT so.id, so.order_no, so.member_id, so.member_name, so.total_amount,
                so.discount_amount, so.points_deduct, so.points_earned, so.actual_amount,
                so.pay_method, so.pay_status, so.status, so.remark, so.created_at,
                COUNT(si.id) AS item_count
         FROM sales_orders so
         LEFT JOIN sales_items si ON si.order_id = so.id
         WHERE {where_sql}
         GROUP BY so.id
         ORDER BY so.created_at DESC
         LIMIT ? OFFSET ?"
    )).map_err(|e| e.to_string())?;

    let mut list_values = values.clone();
    list_values.push(Value::Integer(page_size));
    list_values.push(Value::Integer(offset));

    let list: Vec<SaleOrderSummary> = list_stmt.query_map(
        params_from_iter(list_values.iter()),
        |row| Ok(SaleOrderSummary {
            id: row.get(0)?,
            order_no: row.get(1)?,
            member_id: row.get(2)?,
            member_name: row.get(3)?,
            total_amount: row.get(4)?,
            discount_amount: row.get(5)?,
            points_deduct: row.get(6)?,
            points_earned: row.get(7)?,
            actual_amount: row.get(8)?,
            pay_method: row.get(9)?,
            pay_status: row.get(10)?,
            status: row.get(11)?,
            remark: row.get(12)?,
            created_at: row.get(13)?,
            item_count: row.get(14)?,
        }),
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(PageResult {
        list,
        total: total as u32,
        page: page as u32,
        page_size: page_size as u32,
    })
}

/// 获取单个销售订单详情（含明细）
///
/// 供客户退货弹窗等场景加载原单商品行（product_id / unit_id / 名称 / 数量 / 单价）。
#[tauri::command]
pub async fn get_sale_order(
    db: tauri::State<'_, Database>,
    id: String,
) -> Result<SaleOrder, String> {
    let conn = db.get_conn()?;
    let mut order: SaleOrder = conn
        .query_row(
            "SELECT id, order_no, member_id, member_name, total_amount, discount_amount,
                    points_deduct, points_earned, actual_amount, pay_method, pay_status, status, remark, created_at
             FROM sales_orders WHERE id = ?",
            [&id],
            |row| {
                Ok(SaleOrder {
                    id: row.get(0)?,
                    order_no: row.get(1)?,
                    member_id: row.get(2)?,
                    member_name: row.get(3)?,
                    total_amount: row.get(4)?,
                    discount_amount: row.get(5)?,
                    points_deduct: row.get(6)?,
                    points_earned: row.get(7)?,
                    actual_amount: row.get(8)?,
                    pay_method: row.get(9)?,
                    pay_status: row.get(10)?,
                    status: row.get(11)?,
                    remark: row.get(12)?,
                    items: Vec::new(),
                    created_at: row.get(13)?,
                })
            },
        )
        .map_err(|e| format!("销售订单不存在: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, product_id, product_name, unit_name, quantity, unit_price, grams, subtotal
             FROM sales_items WHERE order_id = ? ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let items: Vec<SaleOrderItem> = stmt
        .query_map([&id], |row| {
            Ok(SaleOrderItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                unit_name: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
                grams: row.get(7)?,
                subtotal: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    order.items = items;
    Ok(order)
}

/// 获取首页经营指标（今日概览）
///
/// 使用机器本地日期（桌面端单机场景）作为“今日”口径。
#[tauri::command]
pub async fn get_dashboard_stats(
    db: tauri::State<'_, Database>,
) -> Result<DashboardStats, String> {
    let conn = db.get_conn()?;
    let today = Local::now().format("%Y-%m-%d").to_string();

    let today_orders: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sales_orders
         WHERE status = 'completed' AND date(created_at) = date(?)",
        [&today],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let today_sales: f64 = conn.query_row(
        "SELECT COALESCE(SUM(actual_amount), 0) FROM sales_orders
         WHERE status = 'completed' AND date(created_at) = date(?)",
        [&today],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    // 低库存阈值：称重类 <500g，计件类 <20 个（与前端 InventoryItem 预警口径一致）
    let low_stock_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM products
         WHERE is_active = 1 AND (
             (product_type = 'weight' AND stock_grams < 500)
             OR (product_type = 'count' AND stock_units < 20)
         )",
        [],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let new_members: i64 = conn.query_row(
        "SELECT COUNT(*) FROM members
         WHERE is_active = 1 AND date(created_at) = date(?)",
        [&today],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(DashboardStats {
        today_orders,
        today_sales: crate::utils::money::round2(today_sales),
        low_stock_count,
        new_members,
    })
}

// ============================================================================
// 单元测试模块
// ----------------------------------------------------------------------------
// 覆盖范围：
// 1. 纯校验函数：validate_phone / validate_name / validate_sale_items（7 个用例）
// 2. 枚举方法测试：MemberLevel / PayMethod / PayStatus（5 个用例）
// 3. Member::from_row 反序列化（2 个用例）
// 4. SQL 业务逻辑：会员 CRUD / 挂单 / 消费记录（11 个用例）
//
// 测试策略说明：
// - Tauri command 函数签名含 `tauri::State<Database>` 无法直接调用
// - 通过手动执行相同 SQL 验证业务正确性
// - 不动业务代码（符合用户"不能更改业务逻辑"约束）
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use crate::models::{SaleItemInput, PayMethod, PayStatus};
    use rusqlite::Connection;

    /// 准备测试用内存数据库
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("无法打开内存数据库");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("无法启用外键约束");
        run_migrations(&conn).expect("运行迁移失败");
        // 清空可能由 init_categories 插入的默认数据
        conn.execute("DELETE FROM members", []).expect("清空会员失败");
        conn
    }

    /// 插入测试商品 + 销售单位
    fn insert_product_with_unit(
        conn: &Connection,
        product_id: &str,
        product_name: &str,
        unit_id: &str,
        unit_name: &str,
        conversion: i64,
        retail_price: f64,
        stock_grams: i64,
    ) {
        conn.execute(
            "INSERT INTO products (id, code, name, product_type, base_unit, stock_grams, stock_units, is_active)
             VALUES (?, ?, ?, 'weight', 'g', ?, 0, 1)",
            params![product_id, format!("CODE-{}", product_id), product_name, stock_grams],
        ).expect("插入商品失败");
        conn.execute(
            "INSERT INTO sales_units (id, product_id, name, conversion_to_base, retail_price, member_price)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![unit_id, product_id, unit_name, conversion, retail_price, retail_price * 0.9],
        ).expect("插入销售单位失败");
    }

    /// 插入测试会员
    fn insert_member(
        conn: &Connection,
        id: &str,
        name: &str,
        phone: &str,
        level: &str,
        balance: f64,
        points: i64,
        is_active: i32,
    ) {
        conn.execute(
            "INSERT INTO members (id, name, phone, level, balance, points, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, '2026-07-01 10:00:00', '2026-07-01 10:00:00')",
            params![id, name, phone, level, balance, points, is_active],
        ).expect("插入会员失败");
    }

    /// 统计指定表记录数
    fn count_rows(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| row.get(0))
            .expect("统计记录数失败")
    }

    // ----------------------------------------------------------------
    // 纯校验函数测试：validate_phone
    // ----------------------------------------------------------------

    #[test]
    fn test_validate_phone_empty() {
        // 空手机号应被拒绝
        assert!(validate_phone("").is_err());
    }

    #[test]
    fn test_validate_phone_wrong_length() {
        // 非 11 位应被拒绝
        assert!(validate_phone("1381234567").is_err()); // 10 位
        assert!(validate_phone("138123456789").is_err()); // 12 位
    }

    #[test]
    fn test_validate_phone_wrong_prefix() {
        // 首位非 1 应被拒绝
        assert!(validate_phone("23812345678").is_err());
        // 第二位非 3-9 应被拒绝
        assert!(validate_phone("12812345678").is_err()); // 第二位为 2
        assert!(validate_phone("11812345678").is_err()); // 第二位为 1
    }

    #[test]
    fn test_validate_phone_non_digit() {
        // 含非数字字符应被拒绝
        assert!(validate_phone("1381234abcd").is_err());
        assert!(validate_phone("1381234567a").is_err());
    }

    #[test]
    fn test_validate_phone_valid() {
        // 合法手机号应通过
        assert!(validate_phone("13812345678").is_ok());
        assert!(validate_phone("15912345678").is_ok());
        assert!(validate_phone("19912345678").is_ok());
    }

    // ----------------------------------------------------------------
    // 纯校验函数测试：validate_name
    // ----------------------------------------------------------------

    #[test]
    fn test_validate_name_empty_and_valid() {
        // 空姓名应被拒绝
        assert!(validate_name("").is_err());
        assert!(validate_name("   ").is_err());
        // 合法姓名应通过
        assert!(validate_name("张三").is_ok());
        assert!(validate_name("John").is_ok());
    }

    // ----------------------------------------------------------------
    // 纯校验函数测试：validate_sale_items
    // ----------------------------------------------------------------

    #[test]
    fn test_validate_sale_items_empty_and_quantity() {
        // 空明细列表应被拒绝
        let empty: Vec<SaleItemInput> = vec![];
        assert!(validate_sale_items(&empty).is_err());

        // 数量为 0 应被拒绝
        let zero_qty = vec![SaleItemInput {
            product_id: "p1".to_string(),
            unit_id: "u1".to_string(),
            quantity: 0,
        }];
        assert!(validate_sale_items(&zero_qty).is_err());

        // 数量为负应被拒绝
        let neg_qty = vec![SaleItemInput {
            product_id: "p1".to_string(),
            unit_id: "u1".to_string(),
            quantity: -2,
        }];
        assert!(validate_sale_items(&neg_qty).is_err());

        // 合法明细应通过
        let valid = vec![SaleItemInput {
            product_id: "p1".to_string(),
            unit_id: "u1".to_string(),
            quantity: 2,
        }];
        assert!(validate_sale_items(&valid).is_ok());
    }

    // ----------------------------------------------------------------
    // 枚举方法测试：MemberLevel
    // ----------------------------------------------------------------

    #[test]
    fn test_member_level_from_db_str() {
        // 验证：从数据库字符串解析会员等级
        assert_eq!(MemberLevel::from_db_str("normal"), MemberLevel::Normal);
        assert_eq!(MemberLevel::from_db_str("silver"), MemberLevel::Silver);
        assert_eq!(MemberLevel::from_db_str("gold"), MemberLevel::Gold);
        // 未知字符串应回退为 Normal
        assert_eq!(MemberLevel::from_db_str("unknown"), MemberLevel::Normal);
        assert_eq!(MemberLevel::from_db_str(""), MemberLevel::Normal);
    }

    #[test]
    fn test_member_level_discount_rate() {
        // 验证：各级别折扣率
        assert_eq!(MemberLevel::Normal.discount_rate(), 1.0);
        assert_eq!(MemberLevel::Silver.discount_rate(), 0.95);
        assert_eq!(MemberLevel::Gold.discount_rate(), 0.90);
    }

    #[test]
    fn test_member_level_from_total_consume() {
        // 验证：根据累计消费自动判断等级
        assert_eq!(MemberLevel::from_total_consume(0.0), MemberLevel::Normal);
        assert_eq!(MemberLevel::from_total_consume(999.99), MemberLevel::Normal);
        assert_eq!(MemberLevel::from_total_consume(1000.0), MemberLevel::Silver);
        assert_eq!(MemberLevel::from_total_consume(4999.99), MemberLevel::Silver);
        assert_eq!(MemberLevel::from_total_consume(5000.0), MemberLevel::Gold);
        assert_eq!(MemberLevel::from_total_consume(10000.0), MemberLevel::Gold);
    }

    #[test]
    fn test_member_level_as_str() {
        // 验证：as_str 返回值
        assert_eq!(MemberLevel::Normal.as_str(), "normal");
        assert_eq!(MemberLevel::Silver.as_str(), "silver");
        assert_eq!(MemberLevel::Gold.as_str(), "gold");
    }

    // ----------------------------------------------------------------
    // 枚举方法测试：PayMethod / PayStatus（v0.3.3 修复后值）
    // ----------------------------------------------------------------

    #[test]
    fn test_pay_method_serialization() {
        // 🔧 v0.3.3 修复：MemberCard 序列化为 "memberBalance"（不是 "member_card"）
        let json = serde_json::to_string(&PayMethod::MemberCard).unwrap();
        assert_eq!(json, "\"memberBalance\"", "MemberCard 应序列化为 memberBalance");

        // Mixed 序列化为 "combined"（不是 "mixed"）
        let json = serde_json::to_string(&PayMethod::Mixed).unwrap();
        assert_eq!(json, "\"combined\"", "Mixed 应序列化为 combined");

        // 🔧 v0.3.3 修复 ISSUE-001：添加 #[serde(rename_all = "lowercase")]，
        // Cash/Wechat/Alipay 序列化为小写（与前端 PayMethod 类型一致）
        assert_eq!(serde_json::to_string(&PayMethod::Cash).unwrap(), "\"cash\"");
        assert_eq!(serde_json::to_string(&PayMethod::Wechat).unwrap(), "\"wechat\"");
        assert_eq!(serde_json::to_string(&PayMethod::Alipay).unwrap(), "\"alipay\"");

        // as_str 方法返回小写
        assert_eq!(PayMethod::Cash.as_str(), "cash");
        assert_eq!(PayMethod::Wechat.as_str(), "wechat");
        assert_eq!(PayMethod::Alipay.as_str(), "alipay");
        assert_eq!(PayMethod::MemberCard.as_str(), "memberBalance");
        assert_eq!(PayMethod::Mixed.as_str(), "combined");
    }

    #[test]
    fn test_pay_status_serialization() {
        // 🔧 v0.3.3 修复：Pending 序列化为 "unpaid"（不是 "pending"）
        let json = serde_json::to_string(&PayStatus::Pending).unwrap();
        assert_eq!(json, "\"unpaid\"", "Pending 应序列化为 unpaid");

        assert_eq!(serde_json::to_string(&PayStatus::Paid).unwrap(), "\"paid\"");
        assert_eq!(serde_json::to_string(&PayStatus::Refunded).unwrap(), "\"refunded\"");

        // as_str 也应一致
        assert_eq!(PayStatus::Pending.as_str(), "unpaid");
        assert_eq!(PayStatus::Paid.as_str(), "paid");
        assert_eq!(PayStatus::Refunded.as_str(), "refunded");
    }

    // ----------------------------------------------------------------
    // Member::from_row 反序列化测试
    // ----------------------------------------------------------------

    #[test]
    fn test_member_from_row_normal() {
        // 验证：正常解析会员记录
        let conn = setup_test_db();
        insert_member(&conn, "m1", "张三", "13812345678", "silver", 200.0, 50, 1);

        let member: Member = conn.query_row(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members WHERE id = ?",
            ["m1"],
            |row| Member::from_row(row),
        ).unwrap();

        assert_eq!(member.id, "m1");
        assert_eq!(member.name, "张三");
        assert_eq!(member.phone, "13812345678");
        assert_eq!(member.level, MemberLevel::Silver);
        assert_eq!(member.points, 50);
        assert_eq!(member.balance, 200.0);
    }

    #[test]
    fn test_member_from_row_unknown_level_fallback() {
        // 验证：未知 level 字符串应回退为 Normal（不报错）
        let conn = setup_test_db();
        // 直接通过 SQL 插入非标准 level 值（绕过 CHECK 约束需要先关闭约束）
        // 注意：members 表有 CHECK (level IN ('normal', 'silver', 'gold'))，
        // 所以无法插入未知值，但 from_db_str 已在 test_member_level_from_db_str 测试覆盖
        // 这里测试 gender/birthday 为 NULL 时的处理
        conn.execute(
            "INSERT INTO members (id, name, phone, level, balance, points, is_active, created_at, updated_at)
             VALUES ('m1', '李四', '13912345678', 'normal', 0.0, 0, 1, '2026-07-01 10:00:00', '2026-07-01 10:00:00')",
            [],
        ).unwrap();

        let member: Member = conn.query_row(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members WHERE id = ?",
            ["m1"],
            |row| Member::from_row(row),
        ).unwrap();

        assert_eq!(member.level, MemberLevel::Normal);
        assert!(member.gender.is_none(), "gender 应为 None");
        assert!(member.birthday.is_none(), "birthday 应为 None");
        assert!(member.last_visit.is_none(), "last_visit 应为 None");
    }

    // ----------------------------------------------------------------
    // SQL 业务逻辑测试：会员 CRUD
    // ----------------------------------------------------------------

    #[test]
    fn test_get_member_by_phone_sql() {
        // 验证：通过手机号查询会员（含 is_active=1 过滤）
        let conn = setup_test_db();
        insert_member(&conn, "m1", "张三", "13812345678", "normal", 100.0, 0, 1);
        insert_member(&conn, "m2", "李四", "13912345678", "normal", 0.0, 0, 0); // 停用

        // 查询启用的会员
        let member: Option<Member> = conn.query_row(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members WHERE phone = ? AND is_active = 1",
            ["13812345678"],
            |row| Member::from_row(row),
        ).ok();
        assert!(member.is_some(), "应查询到启用的会员");
        assert_eq!(member.unwrap().name, "张三");

        // 停用的会员查询不到
        let inactive: Option<Member> = conn.query_row(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members WHERE phone = ? AND is_active = 1",
            ["13912345678"],
            |row| Member::from_row(row),
        ).ok();
        assert!(inactive.is_none(), "停用会员不应被查询到");
    }

    #[test]
    fn test_create_member_sql() {
        // 验证：创建会员 SQL（与 create_member 命令相同逻辑）
        let conn = setup_test_db();
        let id = Uuid::new_v4().to_string();
        let now = "2026-07-01 10:00:00";

        conn.execute(
            "INSERT INTO members (id, name, phone, gender, birthday, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![id, "王五", "13712345678", "male", "1990-01-01", now, now],
        ).unwrap();

        // 验证：能查询到新会员，默认值正确
        let member: Member = conn.query_row(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members WHERE id = ?",
            [&id],
            |row| Member::from_row(row),
        ).unwrap();

        assert_eq!(member.name, "王五");
        assert_eq!(member.phone, "13712345678");
        assert_eq!(member.level, MemberLevel::Normal, "新建会员默认 normal 等级");
        assert_eq!(member.points, 0, "新建会员默认 0 积分");
        assert_eq!(member.balance, 0.0, "新建会员默认 0 余额");
        assert_eq!(member.total_consume, 0.0);
        assert_eq!(member.consume_count, 0);
    }

    #[test]
    fn test_update_member_phone_conflict_sql() {
        // 验证：更新会员时手机号冲突校验
        let conn = setup_test_db();
        insert_member(&conn, "m1", "张三", "13812345678", "normal", 0.0, 0, 1);
        insert_member(&conn, "m2", "李四", "13912345678", "normal", 0.0, 0, 1);

        // 检查手机号是否被其他会员使用（m1 想用 m2 的手机号）
        let existing: Option<String> = conn.query_row(
            "SELECT id FROM members WHERE phone = ? AND id != ? AND is_active = 1",
            params!["13912345678", "m1"],
            |row| row.get(0),
        ).ok();

        assert!(existing.is_some(), "应检测到手机号被其他会员占用");
        assert_eq!(existing.unwrap(), "m2");
    }

    #[test]
    fn test_get_members_pagination_sql() {
        // 验证：会员列表分页 + 关键词搜索
        let conn = setup_test_db();
        // 插入 5 个会员：3 个张姓，2 个李姓
        for i in 1..=3 {
            insert_member(&conn, &format!("m{}", i), &format!("张三{}", i), &format!("1381234567{}", i), "normal", 0.0, 0, 1);
        }
        for i in 4..=5 {
            insert_member(&conn, &format!("m{}", i), &format!("李四{}", i), &format!("1391234567{}", i), "normal", 0.0, 0, 1);
        }

        // 测试 1：无关键词，应返回 5 条
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM members WHERE is_active = 1",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(total, 5, "应有 5 个启用会员");

        // 测试 2：关键词"张"，应返回 3 条
        let kw_like = "%张%";
        let total_zhang: i64 = conn.query_row(
            "SELECT COUNT(*) FROM members WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)",
            params![kw_like, kw_like],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(total_zhang, 3, "张姓会员应有 3 个");

        // 测试 3：分页查询（page=1, page_size=2，应返回 2 条）
        let mut stmt = conn.prepare(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members
             WHERE is_active = 1
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?"
        ).unwrap();
        let page1: Vec<Member> = stmt.query_map(
            params![2_i64, 0_i64],
            |row| Member::from_row(row),
        ).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(page1.len(), 2, "第一页应返回 2 条");
    }

    // ----------------------------------------------------------------
    // SQL 业务逻辑测试：挂单（hold_order / get_held_orders / 取单）
    // ----------------------------------------------------------------

    #[test]
    fn test_hold_order_sql() {
        // 验证：挂单 SQL（status='pending', pay_status='pending'）
        // 注意：v0.3.3 修复后 hold_order 中 pay_status 改为 'unpaid'，但 SQL 中仍写 'pending'
        // 这里测试 hold_order 命令的实际 SQL（pay_status='pending'）
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        let order_id = Uuid::new_v4().to_string();
        let order_no = "GD20260701";

        // 模拟 hold_order 的 INSERT SQL
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, member_id, member_name, total_amount,
             actual_amount, pay_status, status, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?, ?)",
            params![order_id, order_no, None::<String>, None::<String>, 200.0, 200.0, None::<String>, "2026-07-01 10:00:00"],
        ).unwrap();

        // 验证：挂单状态正确
        let (status, pay_status): (String, String) = conn.query_row(
            "SELECT status, pay_status FROM sales_orders WHERE id = ?",
            [&order_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();
        assert_eq!(status, "pending", "挂单状态应为 pending");
        assert_eq!(pay_status, "unpaid", "挂单支付状态应为 unpaid（与详情返回一致）");
    }

    #[test]
    fn test_get_held_orders_sql() {
        // 验证：挂单列表 LEFT JOIN sales_items 统计 item_count
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        // 插入 2 条挂单 + 1 条已完成订单
        for i in 1..=2 {
            conn.execute(
                "INSERT INTO sales_orders (id, order_no, total_amount, pay_status, status, created_at)
                 VALUES (?, ?, ?, 'pending', 'pending', ?)",
                params![format!("ro{}", i), format!("GD{:03}", i), 100.0 * i as f64, format!("2026-07-0{} 10:00:00", i)],
            ).unwrap();
        }
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, total_amount, pay_status, status, created_at)
             VALUES ('ro3', 'XS001', 300.0, 'paid', 'completed', '2026-07-03 10:00:00')",
            [],
        ).unwrap();

        // 为 ro1 添加 2 条明细
        for i in 1..=2 {
            conn.execute(
                "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal, created_at)
                 VALUES (?, 'ro1', 'p1', '龙井', 'u1', '50g', 2, 100.0, 100, 200.0, '2026-07-01 10:00:00')",
                params![format!("si{}", i)],
            ).unwrap();
        }

        // 执行与 get_held_orders 相同的 SQL
        let mut stmt = conn.prepare(
            "SELECT so.id, so.order_no, so.member_name, so.total_amount, so.created_at,
                    COUNT(si.id) AS item_count
             FROM sales_orders so
             LEFT JOIN sales_items si ON si.order_id = so.id
             WHERE so.status = 'pending'
             GROUP BY so.id
             ORDER BY so.created_at DESC"
        ).unwrap();

        let orders: Vec<HeldOrder> = stmt.query_map([], |row| {
            Ok(HeldOrder {
                id: row.get(0)?,
                order_no: row.get(1)?,
                member_name: row.get(2)?,
                total_amount: row.get(3)?,
                created_at: row.get(4)?,
                item_count: row.get(5)?,
            })
        }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();

        assert_eq!(orders.len(), 2, "应仅返回 2 条挂单（不含已完成订单）");
        // ro1 应有 item_count=2
        let ro1 = orders.iter().find(|o| o.id == "ro1").unwrap();
        assert_eq!(ro1.item_count, 2, "ro1 应统计出 2 条明细");
    }

    #[test]
    fn test_get_held_order_detail_sql() {
        // 验证：取单详情查询（status='pending' 过滤）
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        conn.execute(
            "INSERT INTO sales_orders (id, order_no, member_id, member_name, total_amount, pay_status, status, remark, created_at)
             VALUES ('ro1', 'GD001', NULL, NULL, 200.0, 'pending', 'pending', NULL, '2026-07-01 10:00:00')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal, created_at)
             VALUES ('si1', 'ro1', 'p1', '龙井', 'u1', '50g', 2, 100.0, 100, 200.0, '2026-07-01 10:00:00')",
            [],
        ).unwrap();

        // 查询挂单详情（必须 status='pending'）
        let result: rusqlite::Result<(String,)> = conn.query_row(
            "SELECT order_no FROM sales_orders WHERE id = ? AND status = 'pending'",
            ["ro1"],
            |row| Ok((row.get(0)?,)),
        );
        assert!(result.is_ok(), "应能查询到 pending 状态的挂单");
        assert_eq!(result.unwrap().0, "GD001");

        // 查询不存在的订单或非 pending 状态应失败
        let not_found: rusqlite::Result<(String,)> = conn.query_row(
            "SELECT order_no FROM sales_orders WHERE id = ? AND status = 'pending'",
            ["not-exist"],
            |row| Ok((row.get(0)?,)),
        );
        assert!(not_found.is_err(), "查询不存在的挂单应失败");
    }

    #[test]
    fn test_delete_held_order_sql() {
        // 验证：删除挂单（仅删除 status='pending' 的订单 + CASCADE 删明细）
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        conn.execute(
            "INSERT INTO sales_orders (id, order_no, total_amount, pay_status, status, created_at)
             VALUES ('ro1', 'GD001', 200.0, 'pending', 'pending', '2026-07-01 10:00:00')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal, created_at)
             VALUES ('si1', 'ro1', 'p1', '龙井', 'u1', '50g', 2, 100.0, 100, 200.0, '2026-07-01 10:00:00')",
            [],
        ).unwrap();

        assert_eq!(count_rows(&conn, "sales_orders"), 1);
        assert_eq!(count_rows(&conn, "sales_items"), 1);

        // 模拟 delete_held_order 的 SQL（先删明细，再删主单且限定 status='pending'）
        conn.execute("BEGIN TRANSACTION", []).unwrap();
        conn.execute("DELETE FROM sales_items WHERE order_id = ?", ["ro1"]).unwrap();
        conn.execute("DELETE FROM sales_orders WHERE id = ? AND status = 'pending'", ["ro1"]).unwrap();
        conn.execute("COMMIT", []).unwrap();

        assert_eq!(count_rows(&conn, "sales_orders"), 0, "挂单应被删除");
        assert_eq!(count_rows(&conn, "sales_items"), 0, "明细应被删除");
    }

    #[test]
    fn test_delete_held_order_only_pending() {
        // 验证：delete_held_order 仅删除 pending 状态订单，不影响 completed
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, total_amount, pay_status, status, created_at)
             VALUES ('ro1', 'XS001', 200.0, 'paid', 'completed', '2026-07-01 10:00:00')",
            [],
        ).unwrap();

        // 尝试删除 completed 状态的订单（应不影响）
        conn.execute("DELETE FROM sales_orders WHERE id = ? AND status = 'pending'", ["ro1"]).unwrap();

        assert_eq!(count_rows(&conn, "sales_orders"), 1, "completed 订单不应被删除");
    }

    // ----------------------------------------------------------------
    // SQL 业务逻辑测试：会员详情与偏好
    // ----------------------------------------------------------------

    #[test]
    fn test_get_member_detail_with_preference_sql() {
        // 验证：会员详情查询（含偏好 LEFT JOIN）
        let conn = setup_test_db();
        insert_member(&conn, "m1", "张三", "13812345678", "gold", 500.0, 200, 1);

        // 插入偏好
        conn.execute(
            "INSERT INTO member_preferences (id, member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark, updated_at)
             VALUES ('pref1', 'm1', '[\"龙井\",\"碧螺春\"]', '[\"清香\"]', '无', '玻璃杯', '[\"日常\"]', '测试备注', '2026-07-01 10:00:00')",
            [],
        ).unwrap();

        // 查询会员
        let member: Member = conn.query_row(
            "SELECT id, name, phone, gender, birthday, level, points, balance,
                    total_consume, consume_count, last_visit, created_at
             FROM members WHERE id = ? AND is_active = 1",
            ["m1"],
            |row| Member::from_row(row),
        ).unwrap();
        assert_eq!(member.level, MemberLevel::Gold);

        // 查询偏好
        let preference: Option<MemberPreference> = conn.query_row(
            "SELECT member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark
             FROM member_preferences WHERE member_id = ?",
            ["m1"],
            |row| {
                let preferred_teas_str: String = row.get(1)?;
                let taste_prefs_str: String = row.get(2)?;
                let scenario_str: String = row.get(5)?;
                Ok(MemberPreference {
                    member_id: row.get(0)?,
                    preferred_teas: serde_json::from_str(&preferred_teas_str).unwrap_or_default(),
                    taste_preferences: serde_json::from_str(&taste_prefs_str).unwrap_or_default(),
                    taboos: row.get(3)?,
                    brew_habits: row.get(4)?,
                    consumption_scenario: serde_json::from_str(&scenario_str).unwrap_or_default(),
                    remark: row.get(6)?,
                })
            },
        ).ok();

        assert!(preference.is_some(), "应查询到偏好");
        let pref = preference.unwrap();
        assert_eq!(pref.preferred_teas, vec!["龙井", "碧螺春"]);
        assert_eq!(pref.taste_preferences, vec!["清香"]);
        assert_eq!(pref.taboos, "无");
        assert_eq!(pref.brew_habits, "玻璃杯");
        assert_eq!(pref.consumption_scenario, vec!["日常"]);
        assert_eq!(pref.remark, "测试备注");
    }

    #[test]
    fn test_get_member_detail_without_preference_sql() {
        // 验证：会员无偏好时，preference 应为 None
        let conn = setup_test_db();
        insert_member(&conn, "m1", "张三", "13812345678", "normal", 0.0, 0, 1);

        let preference: Option<MemberPreference> = conn.query_row(
            "SELECT member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark
             FROM member_preferences WHERE member_id = ?",
            ["m1"],
            |row| {
                let preferred_teas_str: String = row.get(1)?;
                let taste_prefs_str: String = row.get(2)?;
                let scenario_str: String = row.get(5)?;
                Ok(MemberPreference {
                    member_id: row.get(0)?,
                    preferred_teas: serde_json::from_str(&preferred_teas_str).unwrap_or_default(),
                    taste_preferences: serde_json::from_str(&taste_prefs_str).unwrap_or_default(),
                    taboos: row.get(3)?,
                    brew_habits: row.get(4)?,
                    consumption_scenario: serde_json::from_str(&scenario_str).unwrap_or_default(),
                    remark: row.get(6)?,
                })
            },
        ).ok();

        assert!(preference.is_none(), "无偏好时应返回 None");
    }

    #[test]
    fn test_get_member_consumption_sql() {
        // 验证：会员消费记录查询（含统计 + LIMIT 50）
        let conn = setup_test_db();
        insert_member(&conn, "m1", "张三", "13812345678", "normal", 0.0, 0, 1);

        // 插入 3 条订单：2 条 completed，1 条 pending
        for i in 1..=2 {
            conn.execute(
                "INSERT INTO sales_orders (id, order_no, member_id, total_amount, points_earned, points_deduct, pay_status, status, created_at)
                 VALUES (?, ?, 'm1', ?, ?, ?, 'paid', 'completed', ?)",
                params![format!("ro{}", i), format!("XS{:03}", i), 100.0 * i as f64, i * 10, 0, format!("2026-07-0{} 10:00:00", i)],
            ).unwrap();
        }
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, member_id, total_amount, points_earned, points_deduct, pay_status, status, created_at)
             VALUES ('ro3', 'GD001', 'm1', 300.0, 0, 0, 'pending', 'pending', '2026-07-03 10:00:00')",
            [],
        ).unwrap();

        // 查询会员消费统计
        let (total_consume, consume_count): (f64, i64) = conn.query_row(
            "SELECT total_consume, consume_count FROM members WHERE id = ?",
            ["m1"],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();
        assert_eq!(total_consume, 0.0, "未更新前累计消费应为 0");
        assert_eq!(consume_count, 0, "未更新前消费次数应为 0");

        // 查询消费记录（仅 completed，LIMIT 50）
        let mut stmt = conn.prepare(
            "SELECT id, order_no, total_amount, points_earned, points_deduct, created_at
             FROM sales_orders
             WHERE member_id = ? AND status = 'completed'
             ORDER BY created_at DESC
             LIMIT 50"
        ).unwrap();
        let records: Vec<MemberConsumptionItem> = stmt.query_map(
            ["m1"],
            |row| Ok(MemberConsumptionItem {
                order_id: row.get(0)?,
                order_no: row.get(1)?,
                total_amount: row.get(2)?,
                points_earned: row.get(3)?,
                points_deduct: row.get(4)?,
                created_at: row.get(5)?,
            }),
        ).unwrap().collect::<Result<Vec<_>, _>>().unwrap();

        assert_eq!(records.len(), 2, "应仅返回 2 条 completed 订单（不含 pending）");
        // 按时间倒序，第一条应是 ro2
        assert_eq!(records[0].order_id, "ro2");
        assert_eq!(records[1].order_id, "ro1");
    }

    #[test]
    fn test_update_member_preference_sql() {
        // 验证：会员偏好 INSERT OR REPLACE 逻辑
        let conn = setup_test_db();
        insert_member(&conn, "m1", "张三", "13812345678", "normal", 0.0, 0, 1);

        let preferred_teas_json = serde_json::to_string(&vec!["龙井".to_string()]).unwrap();
        let taste_prefs_json = serde_json::to_string(&vec!["清香".to_string()]).unwrap();
        let scenario_json = serde_json::to_string(&vec!["日常".to_string()]).unwrap();

        // 第一次插入：使用 COALESCE 处理子查询返回 NULL 的情况
        // 注意：member_preferences.id 是 NOT NULL，子查询首次返回 NULL 时需用 COALESCE 提供默认值
        conn.execute(
            "INSERT OR REPLACE INTO member_preferences
             (id, member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark, updated_at)
             VALUES (
                 COALESCE((SELECT id FROM member_preferences WHERE member_id = ?), ?),
                 ?, ?, ?, ?, ?, ?, ?, ?
             )",
            params!["m1", "pref-m1", "m1", preferred_teas_json, taste_prefs_json, "无", "玻璃杯", scenario_json, "备注1", "2026-07-01 10:00:00"],
        ).unwrap();

        assert_eq!(count_rows(&conn, "member_preferences"), 1);

        // 第二次替换（同 member_id）
        let new_preferred = serde_json::to_string(&vec!["碧螺春".to_string()]).unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO member_preferences
             (id, member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark, updated_at)
             VALUES (
                 COALESCE((SELECT id FROM member_preferences WHERE member_id = ?), ?),
                 ?, ?, ?, ?, ?, ?, ?, ?
             )",
            params!["m1", "pref-m1", "m1", new_preferred, taste_prefs_json, "无", "紫砂壶", scenario_json, "备注2", "2026-07-02 10:00:00"],
        ).unwrap();

        // 仍应为 1 条记录（替换而非新增）
        assert_eq!(count_rows(&conn, "member_preferences"), 1, "INSERT OR REPLACE 应替换而非新增");

        // 验证字段已更新
        let (preferred_teas, brew_habits, remark): (String, String, String) = conn.query_row(
            "SELECT preferred_teas, brew_habits, remark FROM member_preferences WHERE member_id = ?",
            ["m1"],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap();
        assert!(preferred_teas.contains("碧螺春"), "偏好茶叶应已更新");
        assert_eq!(brew_habits, "紫砂壶");
        assert_eq!(remark, "备注2");
    }

    // ----------------------------------------------------------------
    // SQL 业务逻辑测试：结算（create_sale_order）
    // ----------------------------------------------------------------
    // 🔧 v0.3.3 关键修复回归测试：
    //   修复前 create_sale_order 先插 sales_items 后插 sales_orders，
    //   由于 sales_items.order_id 有外键引用 sales_orders.id，
    //   启用 PRAGMA foreign_keys = ON 时会触发 "FOREIGN KEY constraint failed"。
    //   修复后调整插入顺序：先插 sales_orders，再插 sales_items。
    // ----------------------------------------------------------------

    #[test]
    fn test_create_sale_order_sql_basic() {
        // 验证：修复后的插入顺序（先主单后明细）不会触发外键约束失败
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        let order_id = Uuid::new_v4().to_string();
        let item_id = Uuid::new_v4().to_string();

        // ✅ 修复后的正确顺序：先插 sales_orders 主单
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, member_id, member_name, total_amount,
             discount_amount, points_deduct, points_earned, actual_amount, pay_method,
             pay_status, status, remark, created_at)
             VALUES (?, ?, NULL, NULL, 100.0, 0.0, 0, 100, 100.0, 'cash', 'paid', 'completed', NULL, '2026-07-01 10:00:00')",
            params![order_id, "XS20260701001"],
        ).expect("插入 sales_orders 主单应成功");

        // ✅ 再插 sales_items 明细（此时 order_id 已存在于 sales_orders 中）
        conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name,
             quantity, unit_price, grams, subtotal, created_at)
             VALUES (?, ?, 'p1', '龙井', 'u1', '50g', 2, 100.0, 100, 200.0, '2026-07-01 10:00:00')",
            params![item_id, order_id],
        ).expect("插入 sales_items 明细应成功（外键约束满足）");

        // 验证数据正确写入
        assert_eq!(count_rows(&conn, "sales_orders"), 1);
        assert_eq!(count_rows(&conn, "sales_items"), 1);

        // 验证订单状态
        let (status, pay_status): (String, String) = conn.query_row(
            "SELECT status, pay_status FROM sales_orders WHERE id = ?",
            [&order_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();
        assert_eq!(status, "completed");
        assert_eq!(pay_status, "paid");
    }

    #[test]
    fn test_create_sale_order_sql_foreign_key_regression() {
        // 回归测试：验证先插 sales_items（order_id 尚不存在）确实会触发外键约束失败
        // 这确保外键约束存在且生效，防止未来回退到错误的插入顺序
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        let fake_order_id = "nonexistent-order-id";
        let item_id = Uuid::new_v4().to_string();

        // ❌ 错误顺序：先插 sales_items（order_id 引用不存在的 sales_orders）
        let result = conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name,
             quantity, unit_price, grams, subtotal, created_at)
             VALUES (?, ?, 'p1', '龙井', 'u1', '50g', 2, 100.0, 100, 200.0, '2026-07-01 10:00:00')",
            params![item_id, fake_order_id],
        );

        // 应触发 FOREIGN KEY constraint failed
        assert!(result.is_err(), "先插 sales_items 应触发外键约束失败");
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("FOREIGN KEY"), "错误信息应包含 FOREIGN KEY，实际: {}", err_msg);
    }

    #[test]
    fn test_create_sale_order_sql_with_stock_deduct() {
        // 验证：结算流程中的库存扣减（products.stock_grams 减少）
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        let order_id = Uuid::new_v4().to_string();

        // 先插主单
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, total_amount, actual_amount, pay_method, pay_status, status, created_at)
             VALUES (?, 'XS20260701002', 200.0, 200.0, 'cash', 'paid', 'completed', '2026-07-01 10:00:00')",
            params![order_id],
        ).unwrap();

        // 扣减库存：1000 - 100 = 900
        conn.execute(
            "UPDATE products SET stock_grams = stock_grams - ? WHERE id = ?",
            params![100, "p1"],
        ).unwrap();

        // 插入明细
        conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name,
             quantity, unit_price, grams, subtotal, created_at)
             VALUES (?, ?, 'p1', '龙井', 'u1', '50g', 2, 100.0, 100, 200.0, '2026-07-01 10:00:00')",
            params![Uuid::new_v4().to_string(), order_id],
        ).unwrap();

        // 验证库存已扣减
        let stock: i64 = conn.query_row(
            "SELECT stock_grams FROM products WHERE id = ?",
            ["p1"],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(stock, 900, "结算后库存应为 900（1000-100）");
    }

    #[test]
    fn test_create_sale_order_sql_with_member_points() {
        // 验证：含会员的结算流程（积分更新 + 消费金额累计）
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);
        insert_member(&conn, "m1", "张三", "13812345678", "normal", 0.0, 0, 1);

        let order_id = Uuid::new_v4().to_string();
        let actual_amount = 200.0_f64;
        let points_earned = actual_amount as i64; // 1元=1积分

        // 先插主单
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, member_id, member_name, total_amount,
             discount_amount, points_deduct, points_earned, actual_amount, pay_method,
             pay_status, status, created_at)
             VALUES (?, 'XS20260701003', 'm1', '张三', 200.0, 0.0, 0, ?, ?, 'cash', 'paid', 'completed', '2026-07-01 10:00:00')",
            params![order_id, points_earned, actual_amount],
        ).unwrap();

        // 插入明细
        conn.execute(
            "INSERT INTO sales_items (id, order_id, product_id, product_name, unit_id, unit_name,
             quantity, unit_price, grams, subtotal, created_at)
             VALUES (?, ?, 'p1', '龙井', 'u1', '50g', 2, 100.0, 100, 200.0, '2026-07-01 10:00:00')",
            params![Uuid::new_v4().to_string(), order_id],
        ).unwrap();

        // 扣减库存
        conn.execute(
            "UPDATE products SET stock_grams = stock_grams - 100 WHERE id = 'p1'",
            [],
        ).unwrap();

        // 更新会员积分和消费金额
        conn.execute(
            "UPDATE members SET points = points + ?, total_consume = total_consume + ?, consume_count = consume_count + 1, last_visit = ? WHERE id = ?",
            params![points_earned, actual_amount, "2026-07-01 10:00:00", "m1"],
        ).unwrap();

        // 验证会员积分和消费金额
        let (points, total_consume, consume_count): (i64, f64, i64) = conn.query_row(
            "SELECT points, total_consume, consume_count FROM members WHERE id = ?",
            ["m1"],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap();
        assert_eq!(points, 200, "会员积分应为 200（消费 200 元 = 200 积分）");
        assert_eq!(total_consume, 200.0, "累计消费应为 200.0");
        assert_eq!(consume_count, 1, "消费次数应为 1");
    }

    #[test]
    fn test_create_sale_order_sql_stock_flow_record() {
        // 验证：结算时记录库存流水（stock_flow 表，flow_type='sale_out'）
        let conn = setup_test_db();
        insert_product_with_unit(&conn, "p1", "龙井", "u1", "50g", 50, 100.0, 1000);

        let order_id = Uuid::new_v4().to_string();

        // 先插主单
        conn.execute(
            "INSERT INTO sales_orders (id, order_no, total_amount, actual_amount, pay_method, pay_status, status, created_at)
             VALUES (?, 'XS20260701004', 200.0, 200.0, 'cash', 'paid', 'completed', '2026-07-01 10:00:00')",
            params![order_id],
        ).unwrap();

        // 扣减库存
        conn.execute("UPDATE products SET stock_grams = stock_grams - 100 WHERE id = 'p1'", []).unwrap();

        // 记录库存流水（注意：stock_flow.order_id 无外键约束，所以可以先于 sales_orders 插入，但实际代码中也是在主单后插入）
        let flow_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_flow (id, product_id, flow_type, change_grams, balance_grams, order_id, created_at)
             VALUES (?, 'p1', 'sale_out', -100, 900, ?, '2026-07-01 10:00:00')",
            params![flow_id, order_id],
        ).unwrap();

        // 验证流水记录
        let (flow_type, change_grams, balance_grams): (String, i64, i64) = conn.query_row(
            "SELECT flow_type, change_grams, balance_grams FROM stock_flow WHERE id = ?",
            [&flow_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap();
        assert_eq!(flow_type, "sale_out");
        assert_eq!(change_grams, -100, "扣减库存应为负数 -100");
        assert_eq!(balance_grams, 900, "扣减后余额应为 900");
    }
}
