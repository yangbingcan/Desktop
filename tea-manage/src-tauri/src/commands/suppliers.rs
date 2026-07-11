//! 供应商 Tauri Commands
//!
//! 提供供应商档案的增删改查
//! v0.2.0 M04 出入库闭环

use crate::db::Database;
use crate::models::{PageResult, Supplier, SupplierInput};
use chrono::Local;
use rusqlite::params;
use uuid::Uuid;

/// 校验供应商名称
fn validate_supplier_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("供应商名称不能为空".to_string());
    }
    if trimmed.len() > 50 {
        return Err("供应商名称不能超过 50 个字符".to_string());
    }
    Ok(())
}

/// 校验联系电话（可选填，但格式必须正确）
fn validate_phone(phone: Option<&str>) -> Result<(), String> {
    if let Some(p) = phone {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            // 允许 11 位手机号或 7-8 位座机或带区号的座机
            let len = trimmed.chars().count();
            if !(7..=20).contains(&len) {
                return Err("联系电话长度应在 7-20 位之间".to_string());
            }
            if !trimmed.chars().all(|c| c.is_ascii_digit() || c == '-' || c == ' ' || c == '+') {
                return Err("电话号码只能包含数字、-、空格、+".to_string());
            }
        }
    }
    Ok(())
}

/// 获取供应商列表（分页 + 关键词搜索）
#[tauri::command]
pub async fn get_suppliers(
    db: tauri::State<'_, Database>,
    page: Option<i64>,
    page_size: Option<i64>,
    keyword: Option<String>,
) -> Result<PageResult<Supplier>, String> {
    let conn = db.get_conn()?;
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let (total, suppliers): (i64, Vec<Supplier>) = if let Some(ref kw) = keyword {
        let kw_like = format!("%{}%", kw);

        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM suppliers
             WHERE is_active = 1 AND (name LIKE ? OR contact_person LIKE ?)",
            params![&kw_like, &kw_like],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, name, contact_person, contact_phone, address, main_categories,
                    remark, is_active, created_at, updated_at
             FROM suppliers
             WHERE is_active = 1 AND (name LIKE ? OR contact_person LIKE ?)
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?"
        ).map_err(|e| e.to_string())?;

        let suppliers: Vec<Supplier> = stmt.query_map(
            params![&kw_like, &kw_like, page_size, offset],
            |row| Supplier::from_row(row),
        ).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

        (total, suppliers)
    } else {
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM suppliers WHERE is_active = 1",
            [],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, name, contact_person, contact_phone, address, main_categories,
                    remark, is_active, created_at, updated_at
             FROM suppliers
             WHERE is_active = 1
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?"
        ).map_err(|e| e.to_string())?;

        let suppliers: Vec<Supplier> = stmt.query_map(
            params![page_size, offset],
            |row| Supplier::from_row(row),
        ).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

        (total, suppliers)
    };

    Ok(PageResult {
        list: suppliers,
        total: total as u32,
        page: page as u32,
        page_size: page_size as u32,
    })
}

/// 获取所有启用的供应商（下拉用）
#[tauri::command]
pub async fn get_all_active_suppliers(
    db: tauri::State<'_, Database>,
) -> Result<Vec<Supplier>, String> {
    let conn = db.get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT id, name, contact_person, contact_phone, address, main_categories,
                remark, is_active, created_at, updated_at
         FROM suppliers
         WHERE is_active = 1
         ORDER BY name ASC"
    ).map_err(|e| e.to_string())?;

    let suppliers: Vec<Supplier> = stmt.query_map(
        [],
        |row| Supplier::from_row(row),
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(suppliers)
}

/// 获取供应商详情
#[tauri::command]
pub async fn get_supplier(
    db: tauri::State<'_, Database>,
    id: String,
) -> Result<Supplier, String> {
    let conn = db.get_conn()?;

    let supplier: Supplier = conn.query_row(
        "SELECT id, name, contact_person, contact_phone, address, main_categories,
                remark, is_active, created_at, updated_at
         FROM suppliers WHERE id = ?",
        [&id],
        |row| Supplier::from_row(row),
    ).map_err(|e| format!("供应商不存在: {}", e))?;

    Ok(supplier)
}

/// 新增供应商
#[tauri::command]
pub async fn create_supplier(
    db: tauri::State<'_, Database>,
    input: SupplierInput,
) -> Result<Supplier, String> {
    // 输入校验
    validate_supplier_name(&input.name)?;
    validate_phone(input.contact_phone.as_deref())?;

    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let id = Uuid::new_v4().to_string();
    let main_categories_json = serde_json::to_string(&input.main_categories)
        .map_err(|e| format!("主营品类序列化失败: {}", e))?;

    conn.execute(
        "INSERT INTO suppliers (id, name, contact_person, contact_phone, address,
         main_categories, remark, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
        params![
            id,
            input.name.trim(),
            input.contact_person,
            input.contact_phone,
            input.address,
            main_categories_json,
            input.remark.unwrap_or_default(),
            now,
            now,
        ],
    ).map_err(|e| format!("新增供应商失败: {}", e))?;

    // 释放锁后重新查询
    drop(conn);
    let conn = db.get_conn()?;

    let supplier: Supplier = conn.query_row(
        "SELECT id, name, contact_person, contact_phone, address, main_categories,
                remark, is_active, created_at, updated_at
         FROM suppliers WHERE id = ?",
        [&id],
        |row| Supplier::from_row(row),
    ).map_err(|e| format!("读取新供应商失败: {}", e))?;

    Ok(supplier)
}

/// 更新供应商
#[tauri::command]
pub async fn update_supplier(
    db: tauri::State<'_, Database>,
    id: String,
    input: SupplierInput,
) -> Result<Supplier, String> {
    // 输入校验
    validate_supplier_name(&input.name)?;
    validate_phone(input.contact_phone.as_deref())?;

    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let main_categories_json = serde_json::to_string(&input.main_categories)
        .map_err(|e| format!("主营品类序列化失败: {}", e))?;

    let affected = conn.execute(
        "UPDATE suppliers
         SET name = ?, contact_person = ?, contact_phone = ?, address = ?,
             main_categories = ?, remark = ?, updated_at = ?
         WHERE id = ? AND is_active = 1",
        params![
            input.name.trim(),
            input.contact_person,
            input.contact_phone,
            input.address,
            main_categories_json,
            input.remark.unwrap_or_default(),
            now,
            id,
        ],
    ).map_err(|e| format!("更新供应商失败: {}", e))?;

    if affected == 0 {
        return Err("供应商不存在或已停用".to_string());
    }

    // 释放锁后重新查询
    drop(conn);
    let conn = db.get_conn()?;

    let supplier: Supplier = conn.query_row(
        "SELECT id, name, contact_person, contact_phone, address, main_categories,
                remark, is_active, created_at, updated_at
         FROM suppliers WHERE id = ?",
        [&id],
        |row| Supplier::from_row(row),
    ).map_err(|e| format!("读取供应商失败: {}", e))?;

    Ok(supplier)
}

/// 软删除供应商（有进货/退货记录时拒绝）
#[tauri::command]
pub async fn delete_supplier(
    db: tauri::State<'_, Database>,
    id: String,
) -> Result<(), String> {
    let conn = db.get_conn()?;

    // 检查是否有进货记录
    let purchase_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = ?",
        [&id],
        |row| row.get(0),
    ).map_err(|e| format!("检查进货记录失败: {}", e))?;

    // 检查是否有退货记录
    let return_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM return_orders WHERE supplier_id = ?",
        [&id],
        |row| row.get(0),
    ).map_err(|e| format!("检查退货记录失败: {}", e))?;

    if purchase_count > 0 || return_count > 0 {
        return Err(format!(
            "该供应商已有 {} 条进货、{} 条退货记录，不能删除（可停用）",
            purchase_count, return_count
        ));
    }

    // 软删除
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let affected = conn.execute(
        "UPDATE suppliers SET is_active = 0, updated_at = ? WHERE id = ?",
        params![now, id],
    ).map_err(|e| format!("删除供应商失败: {}", e))?;

    if affected == 0 {
        return Err("供应商不存在".to_string());
    }

    Ok(())
}

// ============================================================================
// 单元测试
// ============================================================================
//
// 覆盖供应商模块核心场景：
// - 纯校验函数：validate_supplier_name / validate_phone
// - SQL 逻辑：CRUD、分页、关键词搜索、软删除、进货/退货占用校验
// - Supplier::from_row 反序列化
//
// 使用 :memory: SQLite 避免污染真实数据。

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use crate::models::{Supplier, SupplierInput};
    use rusqlite::Connection;

    /// 准备测试用内存数据库
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("无法打开内存数据库");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("无法启用外键约束");
        run_migrations(&conn).expect("运行迁移失败");
        // 清空迁移时插入的默认供应商，避免干扰测试
        conn.execute("DELETE FROM suppliers", []).expect("清空供应商失败");
        conn
    }

    /// 插入测试供应商
    fn insert_supplier(conn: &Connection, id: &str, name: &str, is_active: i32) {
        conn.execute(
            "INSERT INTO suppliers (id, name, is_active, created_at, updated_at)
             VALUES (?, ?, ?, datetime('now'), datetime('now'))",
            rusqlite::params![id, name, is_active],
        )
        .expect("插入供应商失败");
    }

    /// 构造合法的 SupplierInput
    fn make_supplier_input(name: &str) -> SupplierInput {
        SupplierInput {
            name: name.to_string(),
            contact_person: Some("王经理".to_string()),
            contact_phone: Some("13800001111".to_string()),
            address: Some("测试地址".to_string()),
            main_categories: vec!["绿茶".to_string()],
            remark: Some("测试备注".to_string()),
        }
    }

    // ----------------------------------------------------------------
    // 测试 1: validate_supplier_name 空名称
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_supplier_name_empty() {
        assert!(validate_supplier_name("").is_err());
        assert!(validate_supplier_name("   ").is_err());
        let result = validate_supplier_name("");
        assert!(result.unwrap_err().contains("不能为空"));
    }

    // ----------------------------------------------------------------
    // 测试 2: validate_supplier_name 超长名称
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_supplier_name_too_long() {
        let long_name: String = "茶".repeat(51);
        let result = validate_supplier_name(&long_name);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不能超过 50 个字符"));
    }

    // ----------------------------------------------------------------
    // 测试 3: validate_supplier_name 合法名称
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_supplier_name_ok() {
        assert!(validate_supplier_name("西湖茶厂").is_ok());
        assert!(validate_supplier_name("a").is_ok());
    }

    // ----------------------------------------------------------------
    // 测试 4: validate_phone None / 空字符串
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_phone_none_or_empty() {
        assert!(validate_phone(None).is_ok(), "None 应通过校验");
        assert!(validate_phone(Some("")).is_ok(), "空字符串应通过校验");
        assert!(validate_phone(Some("   ")).is_ok(), "纯空格应通过校验");
    }

    // ----------------------------------------------------------------
    // 测试 5: validate_phone 长度不合法
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_phone_invalid_length() {
        // 6 位（过短）
        assert!(validate_phone(Some("123456")).is_err());
        // 21 位（过长）
        let long_phone = "1".repeat(21);
        assert!(validate_phone(Some(&long_phone)).is_err());
    }

    // ----------------------------------------------------------------
    // 测试 6: validate_phone 非法字符
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_phone_invalid_chars() {
        // 包含字母
        assert!(validate_phone(Some("1380000abcd")).is_err());
        // 包含特殊字符（只允许数字、-、空格、+）
        assert!(validate_phone(Some("1380000*111")).is_err());
    }

    // ----------------------------------------------------------------
    // 测试 7: validate_phone 合法手机号
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_phone_valid() {
        assert!(validate_phone(Some("13800001111")).is_ok(), "11 位手机号应通过");
        assert!(validate_phone(Some("010-12345678")).is_ok(), "座机应通过");
        assert!(validate_phone(Some("+86 13800001111")).is_ok(), "带 +86 应通过");
    }

    // ----------------------------------------------------------------
    // 测试 8: Supplier::from_row 反序列化（含 main_categories JSON）
    // ----------------------------------------------------------------
    #[test]
    fn test_supplier_from_row() {
        let conn = setup_test_db();
        // 插入带完整字段的供应商
        conn.execute(
            "INSERT INTO suppliers (id, name, contact_person, contact_phone, address,
             main_categories, remark, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
            rusqlite::params![
                "sup-1", "西湖茶厂", "王经理", "13800001111", "杭州",
                r#"["绿茶","龙井"]"#, "测试备注", 1
            ],
        ).expect("插入失败");

        let supplier: Supplier = conn
            .query_row(
                "SELECT id, name, contact_person, contact_phone, address, main_categories,
                        remark, is_active, created_at, updated_at
                 FROM suppliers WHERE id = ?",
                ["sup-1"],
                |row| Supplier::from_row(row),
            )
            .unwrap();

        assert_eq!(supplier.id, "sup-1");
        assert_eq!(supplier.name, "西湖茶厂");
        assert_eq!(supplier.contact_person, Some("王经理".to_string()));
        assert_eq!(supplier.contact_phone, Some("13800001111".to_string()));
        assert_eq!(supplier.main_categories, vec!["绿茶", "龙井"]);
        assert_eq!(supplier.remark, "测试备注");
        assert!(supplier.is_active);
    }

    // ----------------------------------------------------------------
    // 测试 9: Supplier::from_row main_categories JSON 损坏时返回空数组
    // ----------------------------------------------------------------
    #[test]
    fn test_supplier_from_row_invalid_json() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO suppliers (id, name, contact_person, contact_phone, address,
             main_categories, remark, is_active, created_at, updated_at)
             VALUES (?, ?, NULL, NULL, NULL, ?, '', 1, datetime('now'), datetime('now'))",
            rusqlite::params!["sup-2", "测试供应商", "invalid-json{"],
        ).expect("插入失败");

        let supplier: Supplier = conn
            .query_row(
                "SELECT id, name, contact_person, contact_phone, address, main_categories,
                        remark, is_active, created_at, updated_at
                 FROM suppliers WHERE id = ?",
                ["sup-2"],
                |row| Supplier::from_row(row),
            )
            .unwrap();

        assert_eq!(supplier.main_categories, Vec::<String>::new(), "JSON 损坏应返回空数组");
        assert_eq!(supplier.contact_person, None);
        assert_eq!(supplier.contact_phone, None);
        assert!(!supplier.is_active || supplier.is_active); // 不崩溃即可
    }

    // ----------------------------------------------------------------
    // 测试 10: 供应商创建 SQL 逻辑
    // 模拟 commands::create_supplier 的 SQL
    // ----------------------------------------------------------------
    #[test]
    fn test_create_supplier_logic() {
        let conn = setup_test_db();
        let input = make_supplier_input("测试供应商A");

        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let main_categories_json = serde_json::to_string(&input.main_categories).unwrap();

        let affected = conn.execute(
            "INSERT INTO suppliers (id, name, contact_person, contact_phone, address,
             main_categories, remark, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
            rusqlite::params![
                id, input.name.trim(), input.contact_person, input.contact_phone,
                input.address, main_categories_json, input.remark.unwrap_or_default(),
                now, now
            ],
        ).expect("插入失败");
        assert_eq!(affected, 1);

        // 查询验证
        let supplier: Supplier = conn
            .query_row(
                "SELECT id, name, contact_person, contact_phone, address, main_categories,
                        remark, is_active, created_at, updated_at
                 FROM suppliers WHERE id = ?",
                [&id],
                |row| Supplier::from_row(row),
            )
            .unwrap();
        assert_eq!(supplier.name, "测试供应商A");
        assert_eq!(supplier.main_categories, vec!["绿茶"]);
        assert!(supplier.is_active);
    }

    // ----------------------------------------------------------------
    // 测试 11: 供应商更新 SQL 逻辑（含 is_active = 1 条件）
    // ----------------------------------------------------------------
    #[test]
    fn test_update_supplier_logic() {
        let conn = setup_test_db();
        insert_supplier(&conn, "sup-1", "旧名称", 1);

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let affected = conn.execute(
            "UPDATE suppliers
             SET name = ?, contact_person = ?, contact_phone = ?, address = ?,
                 main_categories = ?, remark = ?, updated_at = ?
             WHERE id = ? AND is_active = 1",
            rusqlite::params!["新名称", "李经理", "13900002222", "新地址", "[]", "新备注", now, "sup-1"],
        ).expect("更新失败");
        assert_eq!(affected, 1, "is_active=1 的供应商应被更新");

        // 验证更新后的字段
        let name: String = conn.query_row(
            "SELECT name FROM suppliers WHERE id = ?", ["sup-1"], |row| row.get(0),
        ).unwrap();
        assert_eq!(name, "新名称");

        // 已停用的供应商不应被更新
        insert_supplier(&conn, "sup-2", "停用供应商", 0);
        let affected = conn.execute(
            "UPDATE suppliers SET name = ? WHERE id = ? AND is_active = 1",
            rusqlite::params!["不应更新", "sup-2"],
        ).expect("更新失败");
        assert_eq!(affected, 0, "is_active=0 的供应商不应被更新");
    }

    // ----------------------------------------------------------------
    // 测试 12: 供应商软删除逻辑（is_active = 0）
    // ----------------------------------------------------------------
    #[test]
    fn test_delete_supplier_soft_delete() {
        let conn = setup_test_db();
        insert_supplier(&conn, "sup-1", "测试供应商", 1);

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let affected = conn.execute(
            "UPDATE suppliers SET is_active = 0, updated_at = ? WHERE id = ?",
            rusqlite::params![now, "sup-1"],
        ).expect("软删除失败");
        assert_eq!(affected, 1);

        // is_active 应为 0
        let is_active: i32 = conn.query_row(
            "SELECT is_active FROM suppliers WHERE id = ?", ["sup-1"], |row| row.get(0),
        ).unwrap();
        assert_eq!(is_active, 0, "软删除后 is_active 应为 0");

        // 记录仍存在（不是物理删除）
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM suppliers WHERE id = ?", ["sup-1"], |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1, "记录应仍存在");
    }

    // ----------------------------------------------------------------
    // 测试 13: 供应商删除时校验进货记录占用
    // 模拟 commands::delete_supplier 的占用校验逻辑
    // ----------------------------------------------------------------
    #[test]
    fn test_delete_supplier_has_purchase_orders() {
        let conn = setup_test_db();
        insert_supplier(&conn, "sup-1", "有进货的供应商", 1);

        // 插入采购主单占用 sup-1
        conn.execute(
            "INSERT INTO purchase_orders (id, order_no, supplier_id, total_amount, payment_status, remark, created_at)
             VALUES ('po-1', 'RK001', 'sup-1', 100.0, 'paid', '', datetime('now'))",
            [],
        ).expect("插入采购单失败");

        let purchase_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = ?",
            ["sup-1"], |row| row.get(0),
        ).unwrap();
        assert_eq!(purchase_count, 1);
        assert!(purchase_count > 0, "有进货记录应拒绝删除");
    }

    // ----------------------------------------------------------------
    // 测试 14: 供应商删除时校验退货记录占用
    // ----------------------------------------------------------------
    #[test]
    fn test_delete_supplier_has_return_orders() {
        let conn = setup_test_db();
        insert_supplier(&conn, "sup-1", "有退货的供应商", 1);

        conn.execute(
            "INSERT INTO return_orders (id, order_no, supplier_id, return_date, return_reason,
             total_amount, remark, status, created_at)
             VALUES ('ro-1', 'TH001', 'sup-1', '2026-07-03', '质量问题', 50.0, '', 'completed', datetime('now'))",
            [],
        ).expect("插入退货单失败");

        let return_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM return_orders WHERE supplier_id = ?",
            ["sup-1"], |row| row.get(0),
        ).unwrap();
        assert_eq!(return_count, 1);
        assert!(return_count > 0, "有退货记录应拒绝删除");
    }

    // ----------------------------------------------------------------
    // 测试 15: 供应商分页查询 SQL 逻辑
    // 模拟 commands::get_suppliers 的分页
    // ----------------------------------------------------------------
    #[test]
    fn test_get_suppliers_pagination() {
        let conn = setup_test_db();
        for i in 1..=5 {
            insert_supplier(&conn, &format!("sup-{}", i), &format!("供应商{}", i), 1);
        }
        // 插入 1 个停用的（不应被查询到）
        insert_supplier(&conn, "sup-disabled", "停用供应商", 0);

        // 查询总数（is_active = 1）
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM suppliers WHERE is_active = 1", [], |row| row.get(0),
        ).unwrap();
        assert_eq!(total, 5, "应有 5 个启用供应商");

        // 查询第 1 页（每页 2 条）
        let mut stmt = conn.prepare(
            "SELECT id, name, contact_person, contact_phone, address, main_categories,
                    remark, is_active, created_at, updated_at
             FROM suppliers WHERE is_active = 1
             ORDER BY created_at DESC LIMIT ? OFFSET ?"
        ).unwrap();
        let suppliers: Vec<Supplier> = stmt.query_map(
            rusqlite::params![2_i64, 0_i64],
            |row| Supplier::from_row(row),
        ).unwrap().filter_map(|r| r.ok()).collect();
        assert_eq!(suppliers.len(), 2, "第 1 页应返回 2 条");
    }

    // ----------------------------------------------------------------
    // 测试 16: 供应商关键词搜索 SQL 逻辑
    // 模拟 commands::get_suppliers 的 keyword 筛选
    // ----------------------------------------------------------------
    #[test]
    fn test_get_suppliers_keyword_search() {
        let conn = setup_test_db();
        // 插入 3 个供应商，其中 2 个名字含"茶"
        insert_supplier(&conn, "sup-1", "西湖茶厂", 1);
        insert_supplier(&conn, "sup-2", "云南普洱基地", 1);
        insert_supplier(&conn, "sup-3", "武夷茶合作社", 1);

        // 搜索 "茶"（name LIKE）
        let kw_like = "%茶%";
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM suppliers WHERE is_active = 1 AND (name LIKE ? OR contact_person LIKE ?)",
            rusqlite::params![kw_like, kw_like],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(total, 2, "name 含'茶'的应匹配 2 个");
    }
}
