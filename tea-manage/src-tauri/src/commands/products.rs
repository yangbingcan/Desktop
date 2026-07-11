//! 商品相关 Tauri Commands
//! 
//! 提供商品 CRUD 操作的接口

use crate::db::{Database, query_products, query_product_detail, query_sales_units, 
                 insert_product, insert_sales_units, update_default_unit,
                 check_product_has_stock};
use crate::models::{ProductDetail, SalesUnit, Product, ProductInput, ProductUpdate};
use crate::models::PageResult;

/// 获取商品列表（支持分页、筛选）
#[tauri::command]
pub async fn get_products(
    db: tauri::State<'_, Database>,
    page: Option<u32>,
    page_size: Option<u32>,
    category_id: Option<String>,
    product_type: Option<String>,
    keyword: Option<String>,
) -> Result<PageResult<Product>, String> {
    let conn = db.get_conn()?;
    query_products(
        &conn,
        page,
        page_size,
        category_id.as_deref(),
        product_type.as_deref(),
        keyword.as_deref(),
    )
}

/// 获取单个商品详情（含销售单位）
#[tauri::command]
pub async fn get_product(
    db: tauri::State<'_, Database>,
    id: String,
) -> Result<Option<ProductDetail>, String> {
    let conn = db.get_conn()?;
    query_product_detail(&conn, &id)
}

/// 创建商品
#[tauri::command]
pub async fn create_product(
    db: tauri::State<'_, Database>,
    product: ProductInput,
) -> Result<Product, String> {
    // 验证输入
    product.validate()?;

    let conn = db.get_conn()?;
    
    // 开启事务
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    let result: Result<Product, String> = (|| {
        // 插入商品
        let product_id = insert_product(&conn, &product)?;

        // 插入销售单位
        let now = chrono::Local::now().to_rfc3339();
        let default_unit_id = insert_sales_units(&conn, &product_id, &product.units, &now)?;

        // 更新默认单位
        if !default_unit_id.is_empty() {
            update_default_unit(&conn, &product_id, &default_unit_id)?;
        }

        // 查询返回完整商品
        let detail = query_product_detail(&conn, &product_id)?
            .ok_or("商品创建成功但查询失败")?;

        Ok(detail.product)
    })();

    match result {
        Ok(product) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(product)
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).map_err(|_| e.to_string())?;
            Err(e)
        }
    }
}

/// 更新商品
#[tauri::command]
pub async fn update_product(
    db: tauri::State<'_, Database>,
    id: String,
    update: ProductUpdate,
) -> Result<Product, String> {
    let conn = db.get_conn()?;
    let now = chrono::Local::now().to_rfc3339();

    // 开启事务
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    let result: Result<Product, String> = (|| {
        // 检查商品是否存在
        let existing = conn
            .query_row(
                "SELECT id, is_active FROM products WHERE id = ?",
                [&id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?)),
            )
            .map_err(|_| "商品不存在".to_string())?;

        // 构建更新语句
        let mut updates = vec!["updated_at = ?".to_string()];
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.clone())];

        if let Some(name) = &update.name {
            updates.push("name = ?".to_string());
            params.push(Box::new(name.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(category_id) = &update.category_id {
            updates.push("category_id = ?".to_string());
            params.push(Box::new(category_id.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(product_type) = &update.product_type {
            updates.push("product_type = ?".to_string());
            let pt_str = match product_type {
                crate::models::ProductType::Weight => "weight",
                crate::models::ProductType::Count => "count",
            };
            params.push(Box::new(pt_str.to_string()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(base_unit) = &update.base_unit {
            updates.push("base_unit = ?".to_string());
            let bu_str = match base_unit {
                crate::models::BaseUnit::Gram => "g",
                crate::models::BaseUnit::Pieces => "pcs",
            };
            params.push(Box::new(bu_str.to_string()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(origin) = &update.origin {
            updates.push("origin = ?".to_string());
            params.push(Box::new(origin.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(year) = &update.year {
            updates.push("year = ?".to_string());
            params.push(Box::new(year.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(grade) = &update.grade {
            updates.push("grade = ?".to_string());
            params.push(Box::new(grade.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(fermentation) = &update.fermentation_level {
            updates.push("fermentation_level = ?".to_string());
            params.push(Box::new(fermentation.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(roast) = &update.roast_level {
            updates.push("roast_level = ?".to_string());
            params.push(Box::new(roast.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(image_url) = &update.image_url {
            updates.push("image_url = ?".to_string());
            params.push(Box::new(image_url.clone()) as Box<dyn rusqlite::ToSql>);
        }

        if let Some(is_active) = update.is_active {
            updates.push("is_active = ?".to_string());
            params.push(Box::new(if is_active { 1 } else { 0 }) as Box<dyn rusqlite::ToSql>);
        }

        params.push(Box::new(id.clone()));
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let sql = format!("UPDATE products SET {} WHERE id = ?", updates.join(", "));
        conn.execute(&sql, params_refs.as_slice())
            .map_err(|e| e.to_string())?;

        // 如果提供了新的销售单位，先删除旧的再插入新的
        if let Some(units) = &update.units {
            // 验证
            for unit in units {
                unit.validate()?;
            }

            // 删除旧的
            conn.execute("DELETE FROM sales_units WHERE product_id = ?", [&id])
                .map_err(|e| e.to_string())?;

            // 插入新的
            let default_unit_id = insert_sales_units(&conn, &id, units.as_slice(), &now)?;
            if !default_unit_id.is_empty() {
                update_default_unit(&conn, &id, &default_unit_id)?;
            }
        }

        // 返回更新后的商品
        let detail = query_product_detail(&conn, &id)?
            .ok_or("商品更新成功但查询失败")?;

        Ok(detail.product)
    })();

    match result {
        Ok(product) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(product)
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).map_err(|_| e.to_string())?;
            Err(e)
        }
    }
}

/// 删除商品
#[tauri::command]
pub async fn delete_product(
    db: tauri::State<'_, Database>,
    id: String,
) -> Result<(), String> {
    let conn = db.get_conn()?;

    // 检查是否有库存
    if check_product_has_stock(&conn, &id)? {
        return Err("该商品存在库存记录，无法删除".to_string());
    }

    // 删除商品（销售单位会级联删除）
    conn.execute("DELETE FROM products WHERE id = ?", [&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取商品的销售单位列表
#[tauri::command]
pub async fn get_product_units(
    db: tauri::State<'_, Database>,
    product_id: String,
) -> Result<Vec<SalesUnit>, String> {
    let conn = db.get_conn()?;
    query_sales_units(&conn, &product_id)
}

// ============================================================================
// 单元测试
// ============================================================================
//
// 覆盖商品模块核心场景：
// - db 层函数：query_products / query_product_detail / insert_product / check_product_has_stock
// - 校验函数：ProductInput::validate / SalesUnitInput::validate
// - SQL 逻辑：分页、筛选、关键词搜索（直接验证 commands::delete_product 等内部 SQL）
//
// 使用 :memory: SQLite 避免污染真实数据。

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use crate::db::{query_product_by_id, generate_product_code};
    use crate::models::{ProductInput, ProductType, SalesUnitInput, ProductUpdate};
    use rusqlite::Connection;

    /// 准备测试用内存数据库（应用所有迁移）
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("无法打开内存数据库");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("无法启用外键约束");
        run_migrations(&conn).expect("运行迁移失败");
        conn
    }

    /// 插入测试分类，返回 category_id
    fn insert_category(conn: &Connection, id: &str, name: &str) {
        conn.execute(
            "INSERT INTO product_categories (id, name, level, sort_order) VALUES (?, ?, 1, 0)",
            rusqlite::params![id, name],
        )
        .expect("插入分类失败");
    }

    /// 构造合法的 SalesUnitInput
    fn make_unit(name: &str, conv: i64, retail: f64, member: f64) -> SalesUnitInput {
        SalesUnitInput {
            id: None,
            name: name.to_string(),
            conversion_to_base: conv,
            retail_price: retail,
            member_price: member,
        }
    }

    /// 构造合法的 ProductInput
    fn make_product_input(name: &str, category_id: Option<&str>) -> ProductInput {
        ProductInput {
            name: name.to_string(),
            category_id: category_id.map(|s| s.to_string()),
            product_type: ProductType::Weight,
            origin: Some("测试产地".to_string()),
            year: Some("2025".to_string()),
            grade: Some("特级".to_string()),
            fermentation_level: None,
            roast_level: None,
            image_url: None,
            units: vec![make_unit("50g", 50, 88.0, 79.2)],
        }
    }

    // ----------------------------------------------------------------
    // 测试 1: query_products 空表查询
    // ----------------------------------------------------------------
    #[test]
    fn test_query_products_empty() {
        let conn = setup_test_db();
        let result = query_products(&conn, None, None, None, None, None).expect("查询失败");
        assert_eq!(result.total, 0);
        assert!(result.list.is_empty());
        // 默认分页参数
        assert_eq!(result.page, 1);
        assert_eq!(result.page_size, 20);
    }

    // ----------------------------------------------------------------
    // 测试 2: insert_product + query_product_by_id 完整流程
    // ----------------------------------------------------------------
    #[test]
    fn test_insert_and_query_product() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-1", "绿茶");

        let input = make_product_input("西湖龙井", Some("cat-1"));
        let product_id = insert_product(&conn, &input).expect("插入商品失败");

        // 查询验证
        let product = query_product_by_id(&conn, &product_id)
            .expect("查询失败")
            .expect("商品应存在");
        assert_eq!(product.name, "西湖龙井");
        assert_eq!(product.code, format!("SP{}001", chrono::Local::now().format("%Y%m%d")));
        assert_eq!(product.product_type, ProductType::Weight);
        assert_eq!(product.category_id, Some("cat-1".to_string()));
        assert_eq!(product.is_active, 1);
    }

    // ----------------------------------------------------------------
    // 测试 3: query_product_by_id 查询不存在的商品
    // ----------------------------------------------------------------
    #[test]
    fn test_query_product_by_id_not_found() {
        let conn = setup_test_db();
        let result = query_product_by_id(&conn, "non-existent-id").expect("查询失败");
        assert!(result.is_none(), "不存在的 ID 应返回 None");
    }

    // ----------------------------------------------------------------
    // 测试 4: query_product_detail 含销售单位
    // ----------------------------------------------------------------
    #[test]
    fn test_query_product_detail_with_units() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-1", "绿茶");

        let input = ProductInput {
            name: "碧螺春".to_string(),
            category_id: Some("cat-1".to_string()),
            product_type: ProductType::Weight,
            origin: None,
            year: None,
            grade: None,
            fermentation_level: None,
            roast_level: None,
            image_url: None,
            units: vec![
                make_unit("50g", 50, 68.0, 61.2),
                make_unit("250g", 250, 320.0, 288.0),
            ],
        };
        let product_id = insert_product(&conn, &input).expect("插入失败");
        let now = chrono::Local::now().to_rfc3339();
        let default_unit = insert_sales_units(&conn, &product_id, &input.units, &now)
            .expect("插入单位失败");
        update_default_unit(&conn, &product_id, &default_unit).expect("更新默认单位失败");

        let detail = query_product_detail(&conn, &product_id)
            .expect("查询失败")
            .expect("商品应存在");
        assert_eq!(detail.product.name, "碧螺春");
        assert_eq!(detail.units.len(), 2, "应有 2 个销售单位");
        // 按 sort_order 升序，第一个是 50g
        assert_eq!(detail.units[0].name, "50g");
        assert_eq!(detail.units[0].conversion_to_base, 50);
        assert_eq!(detail.units[1].name, "250g");
        assert_eq!(detail.units[1].conversion_to_base, 250);
    }

    // ----------------------------------------------------------------
    // 测试 5: check_product_has_stock 无库存
    // ----------------------------------------------------------------
    #[test]
    fn test_check_product_has_stock_no_stock() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-1", "绿茶");
        let input = make_product_input("大红袍", Some("cat-1"));
        let product_id = insert_product(&conn, &input).expect("插入失败");

        let has_stock = check_product_has_stock(&conn, &product_id).expect("查询失败");
        assert!(!has_stock, "无批次库存应返回 false");
    }

    // ----------------------------------------------------------------
    // 测试 6: check_product_has_stock 有库存
    // ----------------------------------------------------------------
    #[test]
    fn test_check_product_has_stock_with_stock() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-1", "绿茶");
        let input = make_product_input("铁观音", Some("cat-1"));
        let product_id = insert_product(&conn, &input).expect("插入失败");

        // 直接插入批次记录（remaining_grams > 0）
        conn.execute(
            "INSERT INTO inventory_batches (id, product_id, batch_code, purchase_price,
             total_grams, remaining_grams, supplier_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                "batch-1", &product_id, "B001", 50.0, 1000, 800, "sup-test", "2026-07-03 10:00:00"
            ],
        ).expect("插入批次失败");

        let has_stock = check_product_has_stock(&conn, &product_id).expect("查询失败");
        assert!(has_stock, "有批次库存应返回 true");
    }

    // ----------------------------------------------------------------
    // 测试 7: generate_product_code 首次生成（应为 SP{今天}001）
    // ----------------------------------------------------------------
    #[test]
    fn test_generate_product_code_first() {
        let conn = setup_test_db();
        let code = generate_product_code(&conn).expect("生成编码失败");
        let expected_prefix = format!("SP{}", chrono::Local::now().format("%Y%m%d"));
        assert!(code.starts_with(&expected_prefix), "编码应以 {} 开头", expected_prefix);
        assert_eq!(code.len(), expected_prefix.len() + 3, "应有 3 位序号");
        assert_eq!(&code[expected_prefix.len()..], "001", "首次应为 001");
    }

    // ----------------------------------------------------------------
    // 测试 8: generate_product_code 序号递增
    // ----------------------------------------------------------------
    #[test]
    fn test_generate_product_code_increment() {
        let conn = setup_test_db();
        let today = chrono::Local::now().format("%Y%m%d").to_string();
        let prefix = format!("SP{}", today);

        // 插入一个已存在编码 SP{today}005
        conn.execute(
            "INSERT INTO products (id, code, name, product_type, base_unit, is_active, created_at, updated_at)
             VALUES ('p1', ?, '测试', 'weight', 'g', 1, datetime('now'), datetime('now'))",
            [&format!("{}005", prefix)],
        ).expect("插入失败");

        let code = generate_product_code(&conn).expect("生成编码失败");
        assert_eq!(code, format!("{}006", prefix), "已存在 005 时应生成 006");
    }

    // ----------------------------------------------------------------
    // 测试 9: query_products 分页
    // ----------------------------------------------------------------
    #[test]
    fn test_query_products_pagination() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-1", "绿茶");

        // 插入 5 个商品
        for i in 1..=5 {
            let input = ProductInput {
                name: format!("商品{}", i),
                category_id: Some("cat-1".to_string()),
                product_type: ProductType::Weight,
                origin: None, year: None, grade: None,
                fermentation_level: None, roast_level: None, image_url: None,
                units: vec![make_unit("50g", 50, 100.0, 90.0)],
            };
            let pid = insert_product(&conn, &input).expect("插入失败");
            let now = chrono::Local::now().to_rfc3339();
            let _ = insert_sales_units(&conn, &pid, &input.units, &now).expect("插入单位失败");
        }

        // 第 1 页，每页 2 条
        let p1 = query_products(&conn, Some(1), Some(2), None, None, None).expect("查询失败");
        assert_eq!(p1.total, 5, "总数应为 5");
        assert_eq!(p1.list.len(), 2, "第 1 页应返回 2 条");
        assert_eq!(p1.page, 1);
        assert_eq!(p1.page_size, 2);

        // 第 3 页，每页 2 条（最后一页只有 1 条）
        let p3 = query_products(&conn, Some(3), Some(2), None, None, None).expect("查询失败");
        assert_eq!(p3.list.len(), 1, "第 3 页应返回 1 条");
    }

    // ----------------------------------------------------------------
    // 测试 10: query_products 按分类筛选
    // ----------------------------------------------------------------
    #[test]
    fn test_query_products_filter_by_category() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-lu", "绿茶");
        insert_category(&conn, "cat-hong", "红茶");

        for (cat, name) in [("cat-lu", "龙井"), ("cat-hong", "正山小种"), ("cat-lu", "碧螺春")] {
            let input = ProductInput {
                name: name.to_string(),
                category_id: Some(cat.to_string()),
                product_type: ProductType::Weight,
                origin: None, year: None, grade: None,
                fermentation_level: None, roast_level: None, image_url: None,
                units: vec![make_unit("50g", 50, 100.0, 90.0)],
            };
            let pid = insert_product(&conn, &input).expect("插入失败");
            let now = chrono::Local::now().to_rfc3339();
            let _ = insert_sales_units(&conn, &pid, &input.units, &now).expect("插入单位失败");
        }

        // 筛选绿茶分类
        let lu_products = query_products(&conn, None, None, Some("cat-lu"), None, None).expect("查询失败");
        assert_eq!(lu_products.total, 2, "绿茶分类应有 2 个商品");
        assert!(lu_products.list.iter().all(|p| p.category_id == Some("cat-lu".to_string())));

        // 筛选红茶分类
        let hong_products = query_products(&conn, None, None, Some("cat-hong"), None, None).expect("查询失败");
        assert_eq!(hong_products.total, 1, "红茶分类应有 1 个商品");
    }

    // ----------------------------------------------------------------
    // 测试 11: query_products 关键词搜索
    // ----------------------------------------------------------------
    #[test]
    fn test_query_products_keyword_search() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-1", "绿茶");

        for name in ["西湖龙井", "碧螺春", "龙井红茶"] {
            let input = ProductInput {
                name: name.to_string(),
                category_id: Some("cat-1".to_string()),
                product_type: ProductType::Weight,
                origin: None, year: None, grade: None,
                fermentation_level: None, roast_level: None, image_url: None,
                units: vec![make_unit("50g", 50, 100.0, 90.0)],
            };
            let pid = insert_product(&conn, &input).expect("插入失败");
            let now = chrono::Local::now().to_rfc3339();
            let _ = insert_sales_units(&conn, &pid, &input.units, &now).expect("插入单位失败");
        }

        // 搜索 "龙井" 应匹配 2 个（西湖龙井、龙井红茶）
        let result = query_products(&conn, None, None, None, None, Some("龙井")).expect("查询失败");
        assert_eq!(result.total, 2, "关键词'龙井'应匹配 2 个商品");
    }

    // ----------------------------------------------------------------
    // 测试 12: ProductInput::validate 名称不能为空
    // ----------------------------------------------------------------
    #[test]
    fn test_product_input_validate_empty_name() {
        let input = ProductInput {
            name: "   ".to_string(),
            category_id: None,
            product_type: ProductType::Weight,
            origin: None, year: None, grade: None,
            fermentation_level: None, roast_level: None, image_url: None,
            units: vec![make_unit("50g", 50, 100.0, 90.0)],
        };
        let result = input.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("商品名称不能为空"));
    }

    // ----------------------------------------------------------------
    // 测试 13: ProductInput::validate 无销售单位
    // ----------------------------------------------------------------
    #[test]
    fn test_product_input_validate_no_units() {
        let input = ProductInput {
            name: "测试商品".to_string(),
            category_id: None,
            product_type: ProductType::Weight,
            origin: None, year: None, grade: None,
            fermentation_level: None, roast_level: None, image_url: None,
            units: vec![],
        };
        let result = input.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("销售单位"));
    }

    // ----------------------------------------------------------------
    // 测试 14: SalesUnitInput::validate 各字段校验
    // ----------------------------------------------------------------
    #[test]
    fn test_sales_unit_input_validate() {
        // 空名称
        let unit = SalesUnitInput {
            id: None, name: "".to_string(),
            conversion_to_base: 50, retail_price: 100.0, member_price: 90.0,
        };
        assert!(unit.validate().is_err());

        // 换算数量 ≤ 0
        let unit = SalesUnitInput {
            id: None, name: "50g".to_string(),
            conversion_to_base: 0, retail_price: 100.0, member_price: 90.0,
        };
        assert!(unit.validate().is_err());

        // 零售价为负
        let unit = SalesUnitInput {
            id: None, name: "50g".to_string(),
            conversion_to_base: 50, retail_price: -10.0, member_price: 90.0,
        };
        assert!(unit.validate().is_err());

        // 会员价为负
        let unit = SalesUnitInput {
            id: None, name: "50g".to_string(),
            conversion_to_base: 50, retail_price: 100.0, member_price: -5.0,
        };
        assert!(unit.validate().is_err());

        // 合法输入
        let unit = SalesUnitInput {
            id: None, name: "50g".to_string(),
            conversion_to_base: 50, retail_price: 100.0, member_price: 90.0,
        };
        assert!(unit.validate().is_ok());
    }

    // ----------------------------------------------------------------
    // 测试 15: 商品删除逻辑（有库存时拒绝，无库存时成功）
    // 模拟 commands::delete_product 的 SQL 逻辑
    // ----------------------------------------------------------------
    #[test]
    fn test_delete_product_logic() {
        let conn = setup_test_db();
        insert_category(&conn, "cat-1", "绿茶");

        let input = make_product_input("测试商品", Some("cat-1"));
        let product_id = insert_product(&conn, &input).expect("插入失败");

        // 无库存时：删除应成功
        let has_stock_before = check_product_has_stock(&conn, &product_id).expect("查询失败");
        assert!(!has_stock_before);
        conn.execute("DELETE FROM products WHERE id = ?", [&product_id])
            .expect("删除失败");
        let after_delete = query_product_by_id(&conn, &product_id).expect("查询失败");
        assert!(after_delete.is_none(), "删除后应查询不到");

        // 重新插入商品 + 批次库存
        let input2 = make_product_input("测试商品2", Some("cat-1"));
        let product_id2 = insert_product(&conn, &input2).expect("插入失败");
        conn.execute(
            "INSERT INTO inventory_batches (id, product_id, batch_code, purchase_price,
             total_grams, remaining_grams, supplier_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                "batch-test", &product_id2, "B002", 50.0, 1000, 500, "sup-test", "2026-07-03 10:00:00"
            ],
        ).expect("插入批次失败");

        // 有库存时：check_product_has_stock 返回 true（commands::delete_product 会拒绝）
        let has_stock = check_product_has_stock(&conn, &product_id2).expect("查询失败");
        assert!(has_stock, "有库存应返回 true");
    }
}
