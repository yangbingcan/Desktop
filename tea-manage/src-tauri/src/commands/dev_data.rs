//! 演示数据生成 + 一键清空
//!
//! 提供 seed_demo_data 和 clear_all_data 两个 Tauri Command，
//! 用于开发演示和回归测试。
//!
//! v0.5.3 扩充（v0.5.3 完成）：
//! - 商品 30 个（覆盖 8 大茶类、丰富产地/年份/等级）
//! - 供应商 12 个
//! - 会员 20 个（normal/silver/gold 三档各 ≥ 5 人，含生日/积分/消费）
//! - 库存批次 ≈ 40 个（每个商品 1-2 批次）
//! - 采购入库单 10 张（关联供应商，paid 状态）
//! - 销售单 20 张（覆盖现金/微信/支付宝/会员余额/储值扣款）
//! - 退货单 5 张（含质量/包装/客户原因等场景）
//! - 储值流水 30 条（充值/消费/退款，覆盖三种支付方式）
//! - 库存调整流水 5 条（通过 stock_flow 的 adjust_in / adjust_out）
//! - 供应商付款记录 8 条（覆盖 cash/wechat/alipay/transfer）

use crate::db::Database;
use rusqlite::{params, Connection};
use serde::Serialize;
use uuid::Uuid;

/// 演示数据固定规模常量（用于 SeedResult 计数，与下方数据数组保持一致）
const SUPPLIER_COUNT: u32 = 12;
const MEMBER_COUNT: u32 = 20;
const BALANCE_LOG_COUNT: u32 = 30;

/// 演示数据生成结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedResult {
    /// 插入的商品数量
    pub products: u32,
    /// 插入的供应商数量
    pub suppliers: u32,
    /// 插入的会员数量
    pub members: u32,
    /// 插入的储值流水数量
    pub balance_logs: u32,
    /// 插入的采购入库单数量
    pub purchases: u32,
    /// 插入的销售单数量
    pub sales: u32,
    /// 插入的退货单数量
    pub returns: u32,
    /// 插入的库存批次数量
    pub batches: u32,
    /// 插入的库存调整流水数量（adjust_in / adjust_out）
    pub adjustment_flows: u32,
    /// 插入的供应商付款记录数量
    pub supplier_payments: u32,
}

/// 一键清空结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearResult {
    /// 清除的业务表数量
    pub cleared_tables: u32,
}

/// 生成演示数据
///
/// 业务范围：
/// - 12 个供应商
/// - 30 个商品（覆盖 8 大茶类）
/// - 每个商品 1-2 库存批次（采购入库自动建批次）
/// - 20 个会员（含 3 种等级）
/// - 10 张采购入库单
/// - 20 张销售单（覆盖所有支付方式）
/// - 5 张退货单
/// - 30 条储值流水
/// - 5 条库存调整流水
/// - 8 条供应商付款记录
///
/// v0.5.4 修复：生成前先清空所有业务表，保证幂等性，
/// 避免重复点击导致 UNIQUE constraint failed: products.code 错误。
#[tauri::command]
pub async fn seed_demo_data(
    db: tauri::State<'_, Database>,
) -> Result<SeedResult, String> {
    let conn = db.get_conn()?;
    let now = chrono::Local::now();
    let now_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let today = now.format("%Y-%m-%d").to_string();
    let yest = (now - chrono::Duration::days(1)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d2 = (now - chrono::Duration::days(2)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d3 = (now - chrono::Duration::days(3)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d5 = (now - chrono::Duration::days(5)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d7 = (now - chrono::Duration::days(7)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d10 = (now - chrono::Duration::days(10)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d15 = (now - chrono::Duration::days(15)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d20 = (now - chrono::Duration::days(20)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d30 = (now - chrono::Duration::days(30)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d45 = (now - chrono::Duration::days(45)).format("%Y-%m-%d %H:%M:%S").to_string();
    let d60 = (now - chrono::Duration::days(60)).format("%Y-%m-%d %H:%M:%S").to_string();

    // 全部在一个大事务里，保证一致性
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;
    let rollback = |e: String, conn: &Connection| -> String {
        let _ = conn.execute("ROLLBACK", []);
        e
    };

    // ========== 0. 先清空所有业务表（保证幂等） ==========
    // v0.5.4 修复：原代码用 INSERT INTO products（非 OR IGNORE），
    // 重复点击会触发 UNIQUE constraint failed: products.code。
    // 这里复用 clear_all_data 的清空逻辑，保证多次点击都能成功。
    clear_business_tables(&conn, &rollback)?;

    // ========== 1. 商品分类 ==========
    let cat_lu: String = conn.query_row(
        "SELECT id FROM product_categories WHERE name = '绿茶' LIMIT 1",
        [],
        |row| row.get(0),
    ).map_err(|e| rollback(format!("未找到绿茶分类，请先初始化分类: {}", e), &conn))?;
    let cat_hong: String = conn.query_row(
        "SELECT id FROM product_categories WHERE name = '红茶' LIMIT 1",
        [],
        |row| row.get(0),
    ).map_err(|e| rollback(format!("未找到红茶分类: {}", e), &conn))?;
    let cat_pu: String = conn.query_row(
        "SELECT id FROM product_categories WHERE name = '普洱' LIMIT 1",
        [],
        |row| row.get(0),
    ).map_err(|e| rollback(format!("未找到普洱分类: {}", e), &conn))?;
    let cat_ou: String = conn.query_row(
        "SELECT id FROM product_categories WHERE name = '青茶' LIMIT 1",
        [],
        |row| row.get(0),
    ).map_err(|e| rollback(format!("未找到青茶（乌龙茶）分类: {}", e), &conn))?;
    let cat_bai: String = conn.query_row(
        "SELECT id FROM product_categories WHERE name = '白茶' LIMIT 1",
        [],
        |row| row.get(0),
    ).map_err(|e| rollback(format!("未找到白茶分类: {}", e), &conn))?;
    // 黄茶、黑茶、花茶（如不存在则跳过）
    let cat_optional: Vec<(&str, &str)> = vec![
        ("黄茶", "huang"),
        ("黑茶", "hei"),
        ("花茶", "hua"),
    ];
    let mut cat_huang: Option<String> = None;
    let mut cat_hei: Option<String> = None;
    let mut cat_hua: Option<String> = None;
    for (name, key) in &cat_optional {
        let result: rusqlite::Result<String> = conn.query_row(
            "SELECT id FROM product_categories WHERE name = ? LIMIT 1",
            params![name],
            |row| row.get(0),
        );
        if let Ok(id) = result {
            match *key {
                "huang" => cat_huang = Some(id),
                "hei" => cat_hei = Some(id),
                "hua" => cat_hua = Some(id),
                _ => {}
            }
        }
    }
    let cat_huang_ref = cat_huang.as_deref().unwrap_or(&cat_lu);
    let cat_hei_ref = cat_hei.as_deref().unwrap_or(&cat_pu);
    let cat_hua_ref = cat_hua.as_deref().unwrap_or(&cat_lu);

    // ========== 2. 供应商（12 个） ==========
    let suppliers = [
        ("sup-001", "西湖茶厂", "王经理", "13800001111", "杭州西湖区龙井路 88 号", r#"["绿茶"]"#),
        ("sup-002", "云南普洱基地", "李总", "13900002222", "云南西双版纳勐海县", r#"["普洱"]"#),
        ("sup-003", "武夷岩茶合作社", "陈师傅", "13700003333", "福建武夷山景区", r#"["乌龙茶","红茶"]"#),
        ("sup-004", "福鼎白茶园", "林总", "13600004444", "福建宁德福鼎市点头镇", r#"["白茶"]"#),
        ("sup-005", "安徽黄山毛峰茶业", "张总", "13500005555", "安徽黄山徽州区", r#"["绿茶"]"#),
        ("sup-006", "安溪铁观音集团", "吴总", "13400006666", "福建泉州安溪县", r#"["乌龙茶"]"#),
        ("sup-007", "云南滇红集团", "黄总", "13300007777", "云南临沧凤庆县", r#"["红茶"]"#),
        ("sup-008", "广西六堡茶厂", "刘总", "13200008888", "广西梧州苍梧县", r#"["黑茶"]"#),
        ("sup-009", "苏州碧螺春合作社", "徐经理", "13100009999", "江苏苏州吴中区", r#"["绿茶"]"#),
        ("sup-010", "信阳毛尖集团", "马总", "13000001111", "河南信阳浉河区", r#"["绿茶"]"#),
        ("sup-011", "潮州凤凰单丛", "蔡总", "18900002222", "广东潮州凤凰镇", r#"["乌龙茶"]"#),
        ("sup-012", "君山银针茶业", "何总", "18800003333", "湖南岳阳君山区", r#"["黄茶"]"#),
    ];
    for (id, name, contact, phone, addr, cats) in suppliers {
        conn.execute(
            "INSERT OR IGNORE INTO suppliers
                (id, name, contact_person, contact_phone, address, main_categories, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
            params![id, name, contact, phone, addr, cats, d60, now_str],
        ).map_err(|e| rollback(format!("插入供应商失败: {}", e), &conn))?;
    }

    // ========== 3. 商品（30 个） ==========
    let products: &[(&str, &str, &str, &str, &str, &str, &str, &str, &str, &str, f64, f64)] = &[
        // 绿茶 8 个
        ("P001", "西湖龙井", &cat_lu, "weight", "g", "浙江杭州", "2025", "明前特级", "none", "light", 88.0, 380.0),
        ("P002", "碧螺春", &cat_lu, "weight", "g", "江苏苏州", "2025", "一级", "none", "light", 68.0, 280.0),
        ("P003", "黄山毛峰", &cat_lu, "weight", "g", "安徽黄山", "2025", "特级", "none", "light", 78.0, 320.0),
        ("P004", "信阳毛尖", &cat_lu, "weight", "g", "河南信阳", "2025", "明前一级", "none", "light", 58.0, 240.0),
        ("P005", "太平猴魁", &cat_lu, "weight", "g", "安徽黄山", "2025", "特级", "none", "light", 128.0, 580.0),
        ("P006", "六安瓜片", &cat_lu, "weight", "g", "安徽六安", "2025", "一级", "none", "light", 48.0, 200.0),
        ("P007", "安吉白茶", &cat_lu, "weight", "g", "浙江安吉", "2025", "特级", "light", "light", 98.0, 420.0),
        ("P008", "径山茶", &cat_lu, "weight", "g", "浙江余杭", "2025", "一级", "none", "light", 38.0, 160.0),
        // 红茶 6 个
        ("P009", "正山小种", &cat_hong, "weight", "g", "福建武夷山", "2024", "特级", "full", "medium", 98.0, 420.0),
        ("P010", "金骏眉", &cat_hong, "weight", "g", "福建武夷山", "2024", "特级", "full", "medium", 128.0, 580.0),
        ("P011", "祁门红茶", &cat_hong, "weight", "g", "安徽祁门", "2024", "特级", "full", "light", 88.0, 380.0),
        ("P012", "滇红工夫", &cat_hong, "weight", "g", "云南凤庆", "2024", "一级", "full", "medium", 68.0, 280.0),
        ("P013", "川红工夫", &cat_hong, "weight", "g", "四川宜宾", "2024", "一级", "full", "medium", 58.0, 240.0),
        ("P014", "英德红茶", &cat_hong, "weight", "g", "广东英德", "2024", "特级", "full", "light", 48.0, 200.0),
        // 普洱 4 个
        ("P015", "古树普洱熟茶", &cat_pu, "weight", "g", "云南西双版纳", "2020", "古树", "full", "heavy", 68.0, 280.0),
        ("P016", "普洱生茶饼", &cat_pu, "weight", "g", "云南勐海", "2018", "古树", "none", "light", 98.0, 480.0),
        ("P017", "普洱熟茶砖", &cat_pu, "weight", "g", "云南昆明", "2015", "陈年", "full", "heavy", 88.0, 380.0),
        ("P018", "冰岛普洱", &cat_pu, "weight", "g", "云南临沧", "2019", "名山", "none", "light", 188.0, 880.0),
        // 乌龙茶 5 个
        ("P019", "铁观音", &cat_ou, "weight", "g", "福建安溪", "2024", "清香型", "half", "light", 58.0, 240.0),
        ("P020", "大红袍", &cat_ou, "weight", "g", "福建武夷山", "2023", "特级", "half", "medium", 108.0, 480.0),
        ("P021", "凤凰单丛", &cat_ou, "weight", "g", "广东潮州", "2024", "鸭屎香", "half", "medium", 88.0, 380.0),
        ("P022", "冻顶乌龙", &cat_ou, "weight", "g", "台湾南投", "2024", "特级", "half", "medium", 128.0, 580.0),
        ("P023", "肉桂乌龙", &cat_ou, "weight", "g", "福建武夷山", "2023", "特级", "half", "heavy", 138.0, 620.0),
        // 白茶 3 个
        ("P024", "白毫银针", &cat_bai, "weight", "g", "福建福鼎", "2024", "头采", "light", "light", 158.0, 680.0),
        ("P025", "白牡丹", &cat_bai, "weight", "g", "福建福鼎", "2023", "一级", "light", "light", 88.0, 380.0),
        ("P026", "寿眉", &cat_bai, "weight", "g", "福建政和", "2022", "陈年", "light", "light", 48.0, 200.0),
        // 黄茶 2 个
        ("P027", "君山银针", cat_huang_ref, "weight", "g", "湖南岳阳", "2024", "特级", "light", "light", 168.0, 720.0),
        ("P028", "蒙顶黄芽", cat_huang_ref, "weight", "g", "四川雅安", "2024", "一级", "light", "light", 98.0, 420.0),
        // 黑茶 2 个
        ("P029", "六堡茶", cat_hei_ref, "weight", "g", "广西梧州", "2018", "陈年", "full", "heavy", 98.0, 420.0),
        ("P030", "安化黑茶", cat_hei_ref, "weight", "g", "湖南益阳", "2017", "千两茶", "full", "heavy", 88.0, 380.0),
    ];
    let mut product_ids: Vec<(String, String, String, String)> = Vec::new(); // (id, code, base_unit, name)
    for (code, name, cat_id, ptype, base_unit, origin, year, grade, ferm, roast, p1, p2) in products {
        let pid = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO products
                (id, code, name, category_id, product_type, base_unit,
                 origin, year, grade, fermentation_level, roast_level,
                 is_active, stock_grams, stock_units, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)",
            params![pid, code, name, cat_id, ptype, base_unit,
                    origin, year, grade, ferm, roast, d30, now_str],
        ).map_err(|e| rollback(format!("插入商品 {} 失败: {}", name, e), &conn))?;

        // 每个商品插入 3 个销售单位（体验装 + 标准装 + 礼盒装）
        let units: Vec<(&str, i64, f64)> = vec![
            ("50g 体验装", 50, *p1),
            ("250g 标准装", 250, *p2),
            ("500g 礼盒装", 500, *p2 * 1.9),
        ];

        for (i, (unit_name, conv, price)) in units.iter().enumerate() {
            let unit_id = Uuid::new_v4().to_string();
            let member_price = price * 0.9; // 会员 9 折
            conn.execute(
                "INSERT INTO sales_units
                    (id, product_id, name, conversion_to_base, retail_price, member_price, sort_order, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![unit_id, &pid, unit_name, conv, price, member_price, i as i32, d30, now_str],
            ).map_err(|e| rollback(format!("插入销售单位失败: {}", e), &conn))?;

            if i == 0 {
                conn.execute(
                    "UPDATE products SET default_unit_id = ? WHERE id = ?",
                    params![&unit_id, &pid],
                ).map_err(|e| rollback(format!("设置默认单位失败: {}", e), &conn))?;
            }
        }

        product_ids.push((pid, code.to_string(), base_unit.to_string(), name.to_string()));
    }

    // ========== 4. 库存批次（每个商品 1-2 批次） ==========
    let mut batch_info: Vec<(String, String, String, i64, f64, String)> = Vec::new(); // (batch_id, product_id, code, qty, cost, supplier)
    for (idx, (pid, code, base_unit, name)) in product_ids.iter().enumerate() {
        let supplier_id = match idx % 4 {
            0 => "sup-001",
            1 => "sup-002",
            2 => "sup-003",
            _ => "sup-004",
        };
        let cost = match code.as_str() {
            "P001" => 4.5, "P002" => 3.5, "P003" => 3.8, "P004" => 2.8, "P005" => 6.0,
            "P006" => 2.5, "P007" => 5.0, "P008" => 2.0,
            "P009" => 5.0, "P010" => 6.5, "P011" => 4.0, "P012" => 3.5, "P013" => 3.0, "P014" => 2.5,
            "P015" => 2.5, "P016" => 4.5, "P017" => 3.8, "P018" => 9.0,
            "P019" => 2.5, "P020" => 5.0, "P021" => 3.8, "P022" => 6.0, "P023" => 6.5,
            "P024" => 7.5, "P025" => 4.0, "P026" => 2.0,
            "P027" => 8.0, "P028" => 4.5,
            "P029" => 4.5, "P030" => 4.0,
            _ => 4.0,
        };
        let batch_id = Uuid::new_v4().to_string();
        let batch_code = format!("B{:04}", idx + 1);
        let quantity: i64 = if base_unit == "g" { 5000 } else { 100 };
        let created_at = if idx % 3 == 0 { d15.clone() } else if idx % 3 == 1 { d7.clone() } else { d3.clone() };
        conn.execute(
            "INSERT INTO inventory_batches
                (id, product_id, batch_code, purchase_price, total_grams, remaining_grams, supplier_id, produced_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![batch_id, pid, batch_code, cost, quantity, quantity, supplier_id, &today, created_at],
        ).map_err(|e| rollback(format!("插入批次失败: {}", e), &conn))?;

        // 更新商品库存
        if base_unit == "g" {
            conn.execute(
                "UPDATE products SET stock_grams = ? WHERE id = ?",
                params![quantity, pid],
            ).map_err(|e| rollback(format!("更新库存失败: {}", e), &conn))?;
        } else {
            conn.execute(
                "UPDATE products SET stock_units = ? WHERE id = ?",
                params![quantity, pid],
            ).map_err(|e| rollback(format!("更新库存失败: {}", e), &conn))?;
        }

        // 记录库存流水
        let flow_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_flow
                (id, product_id, batch_id, flow_type, change_grams, balance_grams, order_id, remark, created_at)
             VALUES (?, ?, ?, 'purchase_in', ?, ?, NULL, '演示数据：采购入库', ?)",
            params![flow_id, pid, batch_id, quantity, quantity, created_at],
        ).map_err(|e| rollback(format!("插入库存流水失败: {}", e), &conn))?;

        batch_info.push((batch_id, pid.clone(), code.clone(), quantity, cost, supplier_id.to_string()));

        // 部分商品（idx % 3 == 0）加第二个批次
        if idx % 3 == 0 && idx < products.len() - 1 {
            let second_batch_id = Uuid::new_v4().to_string();
            let second_batch_code = format!("B{:04}B", idx + 1);
            let second_qty: i64 = if base_unit == "g" { 3000 } else { 60 };
            let second_created = d2.clone();
            conn.execute(
                "INSERT INTO inventory_batches
                    (id, product_id, batch_code, purchase_price, total_grams, remaining_grams, supplier_id, produced_date, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![second_batch_id, pid, second_batch_code, cost * 1.05, second_qty, second_qty, supplier_id, &today, second_created],
            ).map_err(|e| rollback(format!("插入第二批次失败: {}", e), &conn))?;
            // 增加库存
            if base_unit == "g" {
                conn.execute(
                    "UPDATE products SET stock_grams = stock_grams + ? WHERE id = ?",
                    params![second_qty, pid],
                ).map_err(|e| rollback(format!("更新库存失败: {}", e), &conn))?;
            } else {
                conn.execute(
                    "UPDATE products SET stock_units = stock_units + ? WHERE id = ?",
                    params![second_qty, pid],
                ).map_err(|e| rollback(format!("更新库存失败: {}", e), &conn))?;
            }
            let flow2_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO stock_flow
                    (id, product_id, batch_id, flow_type, change_grams, balance_grams, order_id, remark, created_at)
                 VALUES (?, ?, ?, 'purchase_in', ?, ?, NULL, '演示数据：第二批采购入库', ?)",
                params![flow2_id, pid, second_batch_id, second_qty, second_qty, second_created],
            ).map_err(|e| rollback(format!("插入第二批次流水失败: {}", e), &conn))?;
            // 也加入 batch_info 以便后续销售扣减可选用
            batch_info.push((second_batch_id, pid.clone(), code.clone(), second_qty, cost * 1.05, supplier_id.to_string()));
        }
    }

    // ========== 5. 采购入库单（10 张） ==========
    let purchase_groups: Vec<Vec<usize>> = vec![
        vec![0, 1, 2],        // 第一张：西湖龙井 + 碧螺春 + 黄山毛峰
        vec![3, 4, 5],        // 第二张：信阳毛尖 + 太平猴魁 + 正山小种
        vec![6, 7, 8, 9],     // 第三张：金骏眉 + 祁门红茶 + 滇红工夫 + 古树普洱
        vec![10, 11, 12],     // 第四张：普洱生茶 + 普洱熟茶 + 铁观音
        vec![13, 14, 15, 16], // 第五张：大红袍 + 凤凰单丛 + 冻顶乌龙 + 白毫银针
        vec![17, 18, 19],     // 第六张：白牡丹 + 君山银针 + 六堡茶
        vec![20, 21, 22],     // 第七张：安化黑茶 + 信阳毛尖补货 + 大红袍补货
        vec![23, 24, 25],     // 第八张：白毫银针 + 白牡丹 + 寿眉（白茶专项）
        vec![26, 27, 28],     // 第九张：君山银针 + 蒙顶黄芽 + 六堡茶（黄黑茶）
        vec![29],             // 第十张：安化黑茶补货
    ];
    let purchase_created = [
        d30.clone(), d30.clone(), d20.clone(), d20.clone(), d15.clone(),
        d15.clone(), d10.clone(), d7.clone(), d5.clone(), d3.clone(),
    ];
    let purchase_handlers = ["店员A", "店员A", "店员A", "店员B", "店员B", "店员B", "店员C", "店员C", "店员A", "店员B"];
    let mut purchase_count = 0u32;
    let mut purchase_order_ids: Vec<String> = Vec::new();
    for (i, group) in purchase_groups.iter().enumerate() {
        let order_id = Uuid::new_v4().to_string();
        let order_no = format!("PO{:04}{:02}", 2025, i + 1);
        let supplier = match i % 4 {
            0 => "sup-001",
            1 => "sup-002",
            2 => "sup-003",
            _ => "sup-004",
        };
        let mut total = 0.0_f64;
        for &idx in group {
            if idx >= batch_info.len() {
                continue;
            }
            let (_, _, _, qty, cost, _) = &batch_info[idx];
            total += (*qty as f64 / 1000.0) * cost; // 假设按 kg 计算
        }
        conn.execute(
            "INSERT INTO purchase_orders
                (id, order_no, supplier_id, handler, total_amount, payment_status, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, '演示数据：批量采购', ?)",
            params![order_id, order_no, supplier, purchase_handlers[i], total,
                    if i % 3 == 0 { "paid" } else { "unpaid" }, purchase_created[i]],
        ).map_err(|e| rollback(format!("插入采购单失败: {}", e), &conn))?;
        purchase_order_ids.push(order_id.clone());

        for &idx in group {
            if idx >= batch_info.len() {
                continue;
            }
            let (bid, pid, code, qty, cost, _) = &batch_info[idx];
            let item_id = Uuid::new_v4().to_string();
            let unit_grams = 50_i64; // 50g 体验装
            let unit_price = *cost;
            let subtotal = (*qty as f64 / unit_grams as f64) * unit_price;
            // 找到该商品的销售单位 ID
            let unit_id: String = conn.query_row(
                "SELECT id FROM sales_units WHERE product_id = ? AND conversion_to_base = ? LIMIT 1",
                params![pid, unit_grams],
                |row| row.get(0),
            ).unwrap_or_else(|_| Uuid::new_v4().to_string());
            let unit_name = format!("{}g 体验装", unit_grams);
            conn.execute(
                "INSERT INTO purchase_items
                    (id, order_id, product_id, product_name, unit_id, unit_name, quantity, grams, unit_price, subtotal, batch_id, batch_code, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![item_id, &order_id, pid, code, &unit_id, unit_name,
                        (*qty / unit_grams) as i64, *qty, unit_price, subtotal, bid, format!("B{:04}", idx + 1), purchase_created[i]],
            ).map_err(|e| rollback(format!("插入采购明细失败: {}", e), &conn))?;
        }
        purchase_count += 1;
    }

    // ========== 6. 会员（20 个） ==========
    // (id, name, phone, gender, birthday, balance, level, points, total_consume, count, last_visit)
    let members = [
        ("m001", "张三", "13800001111", "male", "2000-05-15", 500.0, "normal", 100, 0.0, 5, d7.clone()),
        ("m002", "李四", "13900002222", "female", "1995-08-22", 1500.0, "silver", 800, 3200.0, 12, d3.clone()),
        ("m003", "王五", "13700003333", "male", "1990-12-01", 800.0, "normal", 200, 580.0, 3, d7.clone()),
        ("m004", "赵六", "13600004444", "female", "1985-03-10", 3000.0, "gold", 2500, 12800.0, 28, d2.clone()),
        ("m005", "钱七", "13500005555", "male", "1998-07-20", 200.0, "normal", 50, 0.0, 2, d15.clone()),
        ("m006", "孙八", "13400006666", "female", "1992-11-08", 1200.0, "silver", 600, 4800.0, 18, d5.clone()),
        ("m007", "周九", "13300007777", "male", "1988-02-14", 0.0, "normal", 0, 0.0, 1, d30.clone()),
        ("m008", "吴十", "13200008888", "female", "1996-09-30", 5000.0, "gold", 5000, 35000.0, 45, d2.clone()),
        ("m009", "郑十一", "13100009999", "male", "1980-06-25", 0.0, "normal", 0, 0.0, 0, d60.clone()),
        ("m010", "王十二", "13000000000", "female", "2000-01-01", 600.0, "silver", 300, 1280.0, 7, d3.clone()),
        ("m011", "陈十三", "13900001111", "male", "1986-04-18", 800.0, "silver", 450, 2200.0, 9, d10.clone()),
        ("m012", "林十四", "13800002222", "female", "1993-10-25", 200.0, "normal", 80, 350.0, 2, d20.clone()),
        ("m013", "黄十五", "13700003344", "male", "1979-12-12", 1500.0, "gold", 1200, 8800.0, 21, d5.clone()),
        ("m014", "徐十六", "13600004455", "female", "2001-07-30", 300.0, "normal", 120, 280.0, 3, d15.clone()),
        ("m015", "胡十七", "13500005566", "male", "1995-02-08", 1000.0, "silver", 550, 3500.0, 14, d7.clone()),
        ("m016", "朱十八", "13400006677", "female", "1987-08-15", 0.0, "normal", 30, 180.0, 1, d45.clone()),
        ("m017", "高十九", "13300007788", "male", "1991-05-20", 2200.0, "gold", 1800, 9800.0, 25, d3.clone()),
        ("m018", "马二十", "13200008899", "female", "1997-11-03", 400.0, "normal", 150, 580.0, 4, d10.clone()),
        ("m019", "罗廿一", "13100009900", "male", "1984-03-28", 0.0, "normal", 0, 0.0, 0, d60.clone()),
        ("m020", "梁廿二", "13000001000", "female", "1999-09-09", 600.0, "silver", 280, 1280.0, 6, d5.clone()),
    ];
    for (id, name, phone, gender, birthday, balance, level, points, total_consume, count, last_visit) in members {
        conn.execute(
            "INSERT OR IGNORE INTO members
                (id, name, phone, gender, birthday, level, balance, points, total_consume, consume_count, last_visit, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
            params![id, name, phone, gender, birthday, level, balance, points, total_consume, count, last_visit, d30, now_str],
        ).map_err(|e| rollback(format!("插入会员失败: {}", e), &conn))?;

        // 偏好设置
        let pref_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR REPLACE INTO member_preferences
                (id, member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                pref_id, id,
                match id {
                    "m001" | "m012" | "m014" => r#"["绿茶"]"#,
                    "m002" | "m006" | "m011" | "m020" => r#"["普洱","红茶"]"#,
                    "m004" | "m013" | "m015" | "m017" => r#"["红茶","乌龙茶"]"#,
                    "m008" => r#"["普洱","黑茶"]"#,
                    "m016" | "m018" => r#"["白茶","绿茶"]"#,
                    _ => r#"["绿茶","红茶"]"#,
                },
                if id == "m002" || id == "m014" { r#"["清淡","花香"]"# } else { r#"["醇厚","回甘"]"# },
                if id == "m003" { "忌浓茶" } else { "" },
                if id == "m004" || id == "m008" { "紫砂壶 95℃" } else { "玻璃杯 80℃" },
                if id == "m001" || id == "m007" { r#"["自饮"]"# } else { r#"["自饮","送礼"]"# },
                now_str
            ],
        ).map_err(|e| rollback(format!("插入会员偏好失败: {}", e), &conn))?;
    }

    // ========== 7. 储值流水（30 条） ==========
    // (member_id, change_type, amount, balance_after, payment, operator, remark, created)
    let balance_logs: [(&str, &str, f64, f64, &str, &str, &str, String); 30] = [
        // m001 (新会员)
        ("m001", "recharge", 500.0, 500.0, "wechat", "店员A", "首次开卡充值", d30.clone()),
        ("m001", "consume", -180.0, 320.0, "memberBalance", "收银台", "购买西湖龙井 50g", d7.clone()),
        ("m001", "recharge", 200.0, 520.0, "cash", "店员A", "复购充值", d3.clone()),
        // m002 (银卡)
        ("m002", "recharge", 2000.0, 2000.0, "wechat", "店员A", "首次充值", d45.clone()),
        ("m002", "recharge", 500.0, 2500.0, "alipay", "店员B", "复购充值", d20.clone()),
        ("m002", "consume", -650.0, 1850.0, "memberBalance", "收银台", "购买金骏眉 250g", d10.clone()),
        ("m002", "consume", -350.0, 1500.0, "memberBalance", "收银台", "购买正山小种 250g", d3.clone()),
        // m003
        ("m003", "recharge", 1000.0, 1000.0, "cash", "店员A", "现金充值", d30.clone()),
        ("m003", "consume", -200.0, 800.0, "memberBalance", "收银台", "购买碧螺春 50g", d7.clone()),
        // m004 (金卡大客户)
        ("m004", "recharge", 5000.0, 5000.0, "alipay", "店员B", "大客户首次充值", d45.clone()),
        ("m004", "consume", -1500.0, 3500.0, "memberBalance", "收银台", "购买大红袍 250g", d20.clone()),
        ("m004", "recharge", 1000.0, 4500.0, "cash", "店员B", "复购充值", d10.clone()),
        ("m004", "consume", -1500.0, 3000.0, "memberBalance", "收银台", "购买古树普洱 250g", d2.clone()),
        // m005
        ("m005", "recharge", 200.0, 200.0, "wechat", "店员A", "小额充值", d20.clone()),
        // m006 (银卡)
        ("m006", "recharge", 1500.0, 1500.0, "wechat", "店员C", "首次充值", d30.clone()),
        ("m006", "consume", -300.0, 1200.0, "memberBalance", "收银台", "购买白毫银针 50g", d5.clone()),
        // m007
        ("m007", "consume", -80.0, 0.0, "memberBalance", "收银台", "购买安吉白茶 50g", d30.clone()),
        // m008 (金卡顶级)
        ("m008", "recharge", 10000.0, 10000.0, "alipay", "店员B", "VIP 客户首充", d60.clone()),
        ("m008", "consume", -2500.0, 7500.0, "memberBalance", "收银台", "购买冰岛普洱 250g", d30.clone()),
        ("m008", "consume", -1500.0, 6000.0, "memberBalance", "收银台", "购买白毫银针 250g", d15.clone()),
        ("m008", "consume", -1000.0, 5000.0, "memberBalance", "收银台", "购买陈年普洱", d2.clone()),
        // m010
        ("m010", "recharge", 800.0, 800.0, "alipay", "店员C", "开卡充值", d20.clone()),
        ("m010", "consume", -200.0, 600.0, "memberBalance", "收银台", "购买信阳毛尖 50g", d3.clone()),
        // m011 银卡
        ("m011", "recharge", 1000.0, 1000.0, "wechat", "店员B", "新会员充值", d30.clone()),
        ("m011", "consume", -200.0, 800.0, "memberBalance", "收银台", "购买铁观音 50g", d10.clone()),
        // m013 金卡
        ("m013", "recharge", 2000.0, 2000.0, "cash", "店员A", "首次充值", d45.clone()),
        ("m013", "consume", -500.0, 1500.0, "memberBalance", "收银台", "购买凤凰单丛 250g", d5.clone()),
        // m015 银卡
        ("m015", "recharge", 1500.0, 1500.0, "wechat", "店员B", "首次充值", d30.clone()),
        // m017 金卡
        ("m017", "recharge", 3000.0, 3000.0, "alipay", "店员B", "大客户首充", d30.clone()),
        ("m017", "consume", -800.0, 2200.0, "memberBalance", "收银台", "购买冻顶乌龙 250g", d3.clone()),
    ];
    for (member_id, change_type, amount, balance_after, payment, operator, remark, created) in balance_logs {
        let log_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO member_balance_logs
                (id, member_id, change_type, change_amount, balance_after,
                 payment_method, operator, related_order_id, bonus_amount, fee_amount, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, ?)",
            params![log_id, member_id, change_type, amount, balance_after, payment, operator, remark, created],
        ).map_err(|e| rollback(format!("插入储值流水失败: {}", e), &conn))?;
    }

    // ========== 8. 销售单（20 张） ==========
    // (member_id_or_null, items: [(product_idx, unit_idx, qty)], pay_method, status, pay_status, date, remark)
    let sales = [
        ("m002", vec![(0_usize, 1_usize, 1_i64)], "memberBalance", "completed", "paid", yest.clone(), "李四买金骏眉 250g"),
        ("m004", vec![(13_usize, 1_usize, 1_i64), (10_usize, 0_usize, 2_i64)], "memberBalance", "completed", "paid", d3.clone(), "赵六大红袍 + 普洱"),
        ("", vec![(0_usize, 0_usize, 1_i64)], "wechat", "completed", "paid", d7.clone(), "散客-西湖龙井"),
        ("m001", vec![(1_usize, 0_usize, 1_i64)], "memberBalance", "completed", "paid", d15.clone(), "张三买碧螺春"),
        ("m006", vec![(16_usize, 0_usize, 1_i64), (17_usize, 0_usize, 1_i64)], "memberBalance", "completed", "paid", d7.clone(), "孙八买白茶"),
        ("", vec![(2_usize, 0_usize, 1_i64)], "cash", "completed", "paid", d3.clone(), "散客现金"),
        ("m008", vec![(9_usize, 1_usize, 1_i64), (19_usize, 1_usize, 1_i64)], "alipay", "completed", "paid", d15.clone(), "吴十大客户"),
        ("m010", vec![(3_usize, 0_usize, 1_i64)], "memberBalance", "completed", "paid", d3.clone(), "王十二买毛尖"),
        ("m011", vec![(14_usize, 0_usize, 2_i64)], "wechat", "completed", "paid", d10.clone(), "陈十三铁观音"),
        ("m013", vec![(15_usize, 1_usize, 1_i64)], "cash", "completed", "paid", d5.clone(), "黄十五凤凰单丛"),
        ("m015", vec![(20_usize, 0_usize, 1_i64)], "alipay", "completed", "paid", d7.clone(), "胡十七白毫银针"),
        ("m017", vec![(12_usize, 1_usize, 1_i64), (23_usize, 0_usize, 1_i64)], "memberBalance", "completed", "paid", d3.clone(), "高十七冻顶乌龙+白牡丹"),
        ("m020", vec![(5_usize, 0_usize, 1_i64)], "wechat", "completed", "paid", d5.clone(), "梁廿二六安瓜片"),
        ("", vec![(7_usize, 0_usize, 1_i64)], "cash", "completed", "paid", d2.clone(), "散客径山茶"),
        ("m002", vec![(8_usize, 0_usize, 1_i64)], "memberBalance", "completed", "paid", d2.clone(), "李四再买正山小种"),
        ("m004", vec![(28_usize, 1_usize, 1_i64)], "memberBalance", "completed", "paid", d2.clone(), "赵六买六堡茶"),
        ("m008", vec![(29_usize, 1_usize, 1_i64)], "alipay", "completed", "paid", d2.clone(), "吴十买安化黑茶"),
        ("m006", vec![(18_usize, 0_usize, 1_i64)], "memberBalance", "completed", "paid", d2.clone(), "孙八买安吉白茶"),
        ("m012", vec![(3_usize, 0_usize, 1_i64)], "cash", "completed", "paid", d20.clone(), "林十四买信阳毛尖"),
        ("m018", vec![(24_usize, 0_usize, 1_i64)], "wechat", "completed", "paid", d10.clone(), "马二十买白牡丹"),
    ];
    let mut sales_count = 0u32;
    for (i, (member_id, items, pay_method, status, pay_status, created, remark)) in sales.iter().enumerate() {
        let order_id = Uuid::new_v4().to_string();
        let order_no = format!("SO{:04}{:02}", 2025, i + 1);
        let member_id_opt = if member_id.is_empty() { None } else { Some(*member_id) };
        let member_name_opt = if member_id.is_empty() { None } else { Some(*member_id) };

        // 计算金额（基于单位价格 + 会员价）
        let mut total = 0.0;
        for &(prod_idx, unit_idx, qty) in items {
            if prod_idx >= product_ids.len() {
                continue;
            }
            // 根据 member_id 决定价格
            let use_member = !member_id.is_empty();
            // 获取价格：取 product_ids 索引 prod_idx 的第二个销售单位价格
            let (pid, _code, _base_unit, _name) = &product_ids[prod_idx];
            let unit_id: String = conn.query_row(
                "SELECT id FROM sales_units WHERE product_id = ? ORDER BY sort_order LIMIT 1 OFFSET ?",
                params![pid, unit_idx as i64],
                |row| row.get(0),
            ).unwrap_or_else(|_| Uuid::new_v4().to_string());
            let price: f64 = conn.query_row(
                "SELECT CASE WHEN ? = 1 THEN member_price ELSE retail_price END FROM sales_units WHERE id = ?",
                params![if use_member { 1 } else { 0 }, &unit_id],
                |row| row.get(0),
            ).unwrap_or(100.0);
            total += price * qty as f64;
        }
        let actual = total;
        let points_earned = if member_id.is_empty() { 0 } else { (total / 10.0) as i32 };

        conn.execute(
            "INSERT INTO sales_orders
                (id, order_no, member_id, member_name, total_amount, discount_amount, points_deduct, points_earned, actual_amount, pay_method, pay_status, status, remark, created_at)
             VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)",
            params![order_id, order_no, member_id_opt, member_name_opt, total, points_earned, actual, pay_method, pay_status, status, remark, created],
        ).map_err(|e| rollback(format!("插入销售单失败: {}", e), &conn))?;

        // 插入销售明细
        for &(prod_idx, unit_idx, qty) in items {
            if prod_idx >= product_ids.len() || prod_idx >= batch_info.len() {
                continue;
            }
            let (pid, code, base_unit, name) = &product_ids[prod_idx];
            let unit_id: String = conn.query_row(
                "SELECT id FROM sales_units WHERE product_id = ? ORDER BY sort_order LIMIT 1 OFFSET ?",
                params![pid, unit_idx as i64],
                |row| row.get(0),
            ).unwrap_or_else(|_| Uuid::new_v4().to_string());
            let unit_name: String = conn.query_row(
                "SELECT name FROM sales_units WHERE id = ?",
                params![&unit_id],
                |row| row.get(0),
            ).unwrap_or_else(|_| "50g 体验装".to_string());
            let use_member = !member_id.is_empty();
            let price: f64 = conn.query_row(
                "SELECT CASE WHEN ? = 1 THEN member_price ELSE retail_price END FROM sales_units WHERE id = ?",
                params![if use_member { 1 } else { 0 }, &unit_id],
                |row| row.get(0),
            ).unwrap_or(100.0);
            let grams = unit_idx as i64 * 50 + 50; // 50g/250g 体验装
            let subtotal = price * qty as f64;
            let item_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO sales_items
                    (id, order_id, product_id, product_name, unit_id, unit_name, quantity, unit_price, grams, subtotal, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![item_id, order_id, pid, name, &unit_id, unit_name, qty, price, grams, subtotal, created],
            ).map_err(|e| rollback(format!("插入销售明细失败: {}", e), &conn))?;

            // 扣减库存
            let (bid, _, _, batch_qty, _, _) = &batch_info[prod_idx];
            let deducted = grams * qty;
            conn.execute(
                "UPDATE inventory_batches SET remaining_grams = MAX(0, remaining_grams - ?) WHERE id = ?",
                params![deducted, bid],
            ).map_err(|e| rollback(format!("扣减库存失败: {}", e), &conn))?;
            if base_unit == "g" {
                conn.execute(
                    "UPDATE products SET stock_grams = MAX(0, stock_grams - ?) WHERE id = ?",
                    params![deducted, pid],
                ).map_err(|e| rollback(format!("扣减商品库存失败: {}", e), &conn))?;
            } else {
                conn.execute(
                    "UPDATE products SET stock_units = MAX(0, stock_units - ?) WHERE id = ?",
                    params![qty, pid],
                ).map_err(|e| rollback(format!("扣减商品库存失败: {}", e), &conn))?;
            }

            // 销售出库流水
            let flow_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO stock_flow
                    (id, product_id, batch_id, flow_type, change_grams, balance_grams, order_id, remark, created_at)
                 VALUES (?, ?, ?, 'sale_out', ?, ?, ?, '演示数据：销售出库', ?)",
                params![flow_id, pid, bid, -deducted, deducted, order_id, created],
            ).map_err(|e| rollback(format!("插入销售出库流水失败: {}", e), &conn))?;
        }
        sales_count += 1;
    }

    // ========== 9. 退货单（5 张） ==========
    let returns = [
        (vec![(2_usize, 0_usize, 1_i64)], "sup-001", d7.clone(), "质量问题", "颜色异常", "completed"),
        (vec![(0_usize, 0_usize, 1_i64)], "sup-001", d3.clone(), "包装破损", "运输破损", "completed"),
        (vec![(9_usize, 0_usize, 2_i64)], "sup-003", d5.clone(), "数量超出", "客户多订", "completed"),
        (vec![(15_usize, 0_usize, 1_i64)], "sup-011", d2.clone(), "质量问题", "口感异常", "pending"),
        (vec![(20_usize, 0_usize, 1_i64), (21_usize, 0_usize, 1_i64)], "sup-004", d10.clone(), "其他", "客户临时取消", "completed"),
    ];
    let mut return_count = 0u32;
    for (i, (items, supplier_id, date, reason, remark, status)) in returns.iter().enumerate() {
        let order_id = Uuid::new_v4().to_string();
        let order_no = format!("RO{:04}{:02}", 2025, i + 1);
        let mut total = 0.0;
        for &(prod_idx, unit_idx, qty) in items {
            if prod_idx >= product_ids.len() {
                continue;
            }
            let price: f64 = conn.query_row(
                "SELECT retail_price FROM sales_units WHERE product_id = ? ORDER BY sort_order LIMIT 1 OFFSET ?",
                params![&product_ids[prod_idx].0, unit_idx as i64],
                |row| row.get(0),
            ).unwrap_or(50.0);
            total += price * qty as f64;
        }
        conn.execute(
            "INSERT INTO return_orders
                (id, order_no, supplier_id, return_date, return_reason, total_amount, remark, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![order_id, order_no, supplier_id, date, reason, total, remark, status, date],
        ).map_err(|e| rollback(format!("插入退货单失败: {}", e), &conn))?;

        for &(prod_idx, unit_idx, qty) in items {
            if prod_idx >= product_ids.len() || prod_idx >= batch_info.len() {
                continue;
            }
            let (pid, code, base_unit, name) = &product_ids[prod_idx];
            let unit_id: String = conn.query_row(
                "SELECT id FROM sales_units WHERE product_id = ? ORDER BY sort_order LIMIT 1 OFFSET ?",
                params![pid, unit_idx as i64],
                |row| row.get(0),
            ).unwrap_or_else(|_| Uuid::new_v4().to_string());
            let unit_name: String = conn.query_row(
                "SELECT name FROM sales_units WHERE id = ?",
                params![&unit_id],
                |row| row.get(0),
            ).unwrap_or_else(|_| "50g 体验装".to_string());
            let price: f64 = conn.query_row(
                "SELECT retail_price FROM sales_units WHERE id = ?",
                params![&unit_id],
                |row| row.get(0),
            ).unwrap_or(50.0);
            let grams = unit_idx as i64 * 50 + 50;
            let subtotal = price * qty as f64;
            let (bid, _, _, _, _, _) = &batch_info[prod_idx];
            let item_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO return_items
                    (id, order_id, product_id, product_name, unit_id, unit_name, batch_id, quantity, unit_price, grams, subtotal, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![item_id, order_id, pid, name, &unit_id, unit_name, bid, qty, price, grams, subtotal, date],
            ).map_err(|e| rollback(format!("插入退货明细失败: {}", e), &conn))?;
        }
        return_count += 1;
    }

    // ========== 10. 库存调整流水（5 条，adjust_in / adjust_out） ==========
    // 场景：盘点、报损、修正入库
    let adjustments: Vec<(usize, &str, i64, &str, String)> = vec![
        (5_usize, "adjust_out", -200_i64, "演示数据：盘点损耗", d20.clone()),  // 六安瓜片 损耗
        (12_usize, "adjust_in", 500_i64, "演示数据：盘点盈余", d15.clone()),   // 川红工夫 盘盈
        (18_usize, "adjust_out", -100_i64, "演示数据：报损出库", d10.clone()),  // 安吉白茶 报损
        (25_usize, "adjust_out", -300_i64, "演示数据：过期报损", d5.clone()),   // 白牡丹 过期
        (29_usize, "adjust_in", 1000_i64, "演示数据：盘点修正", d2.clone()),    // 安化黑茶 修正
    ];
    let mut adjustment_count = 0u32;
    for (prod_idx, flow_type, change_grams, remark, date) in adjustments {
        if prod_idx >= product_ids.len() || prod_idx >= batch_info.len() {
            continue;
        }
        let (pid, _code, base_unit, _name) = &product_ids[prod_idx];
        let (bid, _, _, _, _, _) = &batch_info[prod_idx];
        let new_balance: i64 = conn.query_row(
            "SELECT stock_grams FROM products WHERE id = ?",
            params![pid],
            |row| row.get(0),
        ).unwrap_or(0);
        let flow_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stock_flow
                (id, product_id, batch_id, flow_type, change_grams, balance_grams, order_id, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)",
            params![flow_id, pid, bid, flow_type, change_grams, new_balance, remark, date],
        ).map_err(|e| rollback(format!("插入库存调整流水失败: {}", e), &conn))?;
        if base_unit == "g" {
            conn.execute(
                "UPDATE products SET stock_grams = MAX(0, stock_grams + ?) WHERE id = ?",
                params![change_grams, pid],
            ).map_err(|e| rollback(format!("调整库存失败: {}", e), &conn))?;
        } else {
            conn.execute(
                "UPDATE products SET stock_units = MAX(0, stock_units + ?) WHERE id = ?",
                params![change_grams, pid],
            ).map_err(|e| rollback(format!("调整库存失败: {}", e), &conn))?;
        }
        adjustment_count += 1;
    }

    // ========== 11. 供应商付款记录（8 条） ==========
    // 覆盖 cash / wechat / alipay / transfer
    let supplier_payments = [
        ("sup-001", Some(purchase_order_ids[0].clone()), 8500.0_f64, "wechat", d20.clone(), "西湖茶厂首付款"),
        ("sup-002", Some(purchase_order_ids[2].clone()), 12000.0_f64, "alipay", d15.clone(), "普洱基地季度结算"),
        ("sup-003", Some(purchase_order_ids[4].clone()), 9800.0_f64, "transfer", d10.clone(), "武夷岩茶批量"),
        ("sup-004", Some(purchase_order_ids[5].clone()), 5600.0_f64, "cash", d10.clone(), "福鼎白茶"),
        ("sup-005", Some(purchase_order_ids[6].clone()), 7200.0_f64, "wechat", d7.clone(), "黄山毛峰补货"),
        ("sup-006", None, 3000.0_f64, "alipay", d5.clone(), "铁观音预付款"),
        ("sup-007", Some(purchase_order_ids[1].clone()), 4500.0_f64, "transfer", d3.clone(), "滇红集团"),
        ("sup-008", None, 2500.0_f64, "wechat", d2.clone(), "六堡茶订金"),
    ];
    let mut payment_count = 0u32;
    for (supplier_id, purchase_id, amount, method, date, remark) in supplier_payments {
        let pay_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO supplier_payments
                (id, supplier_id, purchase_order_id, amount, payment_method, payment_date, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![pay_id, supplier_id, purchase_id, amount, method, date, remark, date],
        ).map_err(|e| rollback(format!("插入供应商付款失败: {}", e), &conn))?;
        payment_count += 1;
    }

    // 提交事务
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(SeedResult {
        products: product_ids.len() as u32,
        suppliers: SUPPLIER_COUNT,
        members: MEMBER_COUNT,
        balance_logs: BALANCE_LOG_COUNT,
        purchases: purchase_count,
        sales: sales_count,
        returns: return_count,
        batches: batch_info.len() as u32,
        adjustment_flows: adjustment_count,
        supplier_payments: payment_count,
    })
}

/// 一键清空所有业务数据（保留数据库结构与默认分类）
///
/// 业务范围：商品/批次/流水/单位/会员/储值流水/采购单/退货单/销售单/库存调整/供应商付款
///
/// 实现策略：动态从 sqlite_master 读取存在的业务表，避免硬编码导致的
/// "no such table" 错误。保留 product_categories（系统初始化数据）。
#[tauri::command]
pub async fn clear_all_data(
    db: tauri::State<'_, Database>,
) -> Result<ClearResult, String> {
    // 安全门禁：清空全库仅允许在开发(debug)构建中执行，避免生产环境误清空
    if !cfg!(debug_assertions) {
        return Err("清空全库命令仅开发环境可用".into());
    }

    let conn = db.get_conn()?;

    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;
    let rollback = |e: String, conn: &Connection| -> String {
        let _ = conn.execute("ROLLBACK", []);
        e
    };

    // 调用内部清空函数（已提取，供 seed_demo_data 复用）
    let count = clear_business_tables(&conn, &rollback)?;

    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(ClearResult { cleared_tables: count })
}

/// 内部清空业务表函数（不开事务，由调用方负责事务边界）
///
/// v0.5.4 提取：供 seed_demo_data 在生成前调用，保证幂等性。
/// 调用方必须已开启事务，本函数只负责执行 DELETE 语句。
///
/// @param conn 已开启事务的数据库连接
/// @param rollback 回滚辅助闭包
/// @return 已清空的业务表数量
fn clear_business_tables(
    conn: &Connection,
    rollback: &dyn Fn(String, &Connection) -> String,
) -> Result<u32, String> {
    // 1. 动态获取所有业务表名
    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%'
           AND name != 'product_categories'
         ORDER BY name"
    ).map_err(|e| rollback(e.to_string(), conn))?;

    let table_names: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| rollback(e.to_string(), conn))?
        .filter_map(|r| r.ok())
        .collect();

    // 2. 按表名长度倒序（依赖表优先删除），同时按业务依赖关系排序
    //    业务依赖顺序（先删依赖表）：
    //    member_balance_logs → member_preferences → sales_items → sales_orders →
    //    held_orders → purchase_items → purchase_orders → return_items → return_orders →
    //    supplier_payments → stock_flow → inventory_batches → sales_units →
    //    products → members → suppliers
    let priority_order = [
        "member_balance_logs",
        "member_preferences",
        "sales_items",
        "sales_orders",
        "held_orders",
        "purchase_items",
        "purchase_orders",
        "return_items",
        "return_orders",
        "supplier_payments",
        "stock_flow",
        "inventory_batches",
        "sales_units",
        "products",
        "members",
        "suppliers",
    ];

    // 3. 按优先级排序后再清空（先清依赖表）
    let mut sorted_tables: Vec<String> = priority_order
        .iter()
        .filter(|n| table_names.contains(&n.to_string()))
        .map(|n| n.to_string())
        .collect();

    // 4. 加上任何未在 priority_order 中但实际存在的业务表
    for t in &table_names {
        if !sorted_tables.contains(t) {
            sorted_tables.push(t.clone());
        }
    }

    // 5. 执行清空
    let mut count = 0u32;
    for table in &sorted_tables {
        let sql = format!("DELETE FROM {}", table);
        conn.execute(&sql, [])
            .map_err(|e| rollback(format!("清空表 {} 失败: {}", table, e), conn))?;
        count += 1;
    }

    Ok(count)
}
