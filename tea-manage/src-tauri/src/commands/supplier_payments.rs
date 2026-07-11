//! 供应商付款与财务流水 Tauri Commands
//!
//! 提供供应商付款记录的增查、财务流水查询、余额汇总等功能
//! v0.3.6 供应商付款管理

use crate::db::Database;
use crate::models::{
    CreatePaymentInput, FinancialFlowItem, PageResult, SupplierBalance, SupplierPayment,
};
use chrono::Local;
use rusqlite::params;
use uuid::Uuid;

/// 合法的付款方式列表
const VALID_PAYMENT_METHODS: &[&str] = &["cash", "wechat", "alipay", "transfer", "other"];

/// 校验付款方式
fn validate_payment_method(method: &str) -> Result<(), String> {
    if VALID_PAYMENT_METHODS.contains(&method) {
        Ok(())
    } else {
        Err(format!(
            "不支持的付款方式: {}，仅支持 cash/wechat/alipay/transfer/other",
            method
        ))
    }
}

/// 校验付款金额
fn validate_amount(amount: f64) -> Result<(), String> {
    if amount <= 0.0 {
        return Err("付款金额必须大于 0".to_string());
    }
    if amount > 1_000_000_000.0 {
        return Err("付款金额不能超过 10 亿".to_string());
    }
    Ok(())
}

/// 创建供应商付款记录
///
/// 1. 开启事务
/// 2. 插入付款记录
/// 3. 若关联采购单，重新计算其已付总额并更新 payment_status
/// 4. 提交事务
#[tauri::command]
pub async fn create_supplier_payment(
    db: tauri::State<'_, Database>,
    input: CreatePaymentInput,
) -> Result<SupplierPayment, String> {
    // 输入校验
    validate_payment_method(&input.payment_method)?;
    validate_amount(input.amount)?;

    let conn = db.get_conn()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let id = Uuid::new_v4().to_string();
    let remark = input.remark.unwrap_or_default();

    // 开启事务
    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| format!("开启事务失败: {}", e))?;

    let tx_result = (|| -> Result<(), String> {
        // 1. 插入付款记录
        conn.execute(
            "INSERT INTO supplier_payments (id, supplier_id, purchase_order_id, amount, payment_method, payment_date, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                id,
                input.supplier_id,
                input.purchase_order_id,
                input.amount,
                input.payment_method,
                input.payment_date,
                remark,
                now,
            ],
        )
        .map_err(|e| format!("创建付款记录失败: {}", e))?;

        // 2. 若关联采购单，重新计算 payment_status
        if let Some(ref order_id) = input.purchase_order_id {
            // 查询采购单总额
            let total_amount: f64 = conn
                .query_row(
                    "SELECT total_amount FROM purchase_orders WHERE id = ?",
                    params![order_id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("查询采购单失败: {}", e))?;

            // 查询该采购单的已付总额
            let paid_amount: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE purchase_order_id = ?",
                    params![order_id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("查询已付总额失败: {}", e))?;

            // 计算 payment_status
            let payment_status = if paid_amount >= total_amount {
                "paid"
            } else if paid_amount > 0.0 {
                "partial"
            } else {
                "unpaid"
            };

            conn.execute(
                "UPDATE purchase_orders SET payment_status = ? WHERE id = ?",
                params![payment_status, order_id],
            )
            .map_err(|e| format!("更新采购单付款状态失败: {}", e))?;
        }

        Ok(())
    })();

    // 根据事务结果提交或回滚
    match tx_result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("提交事务失败: {}", e))?;
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK")
                .map_err(|_| format!("回滚事务失败（原错误: {}）", e))?;
            return Err(e);
        }
    }

    // 释放连接锁后重新查询刚插入的记录
    drop(conn);
    let conn = db.get_conn()?;
    let payment = query_supplier_payment_by_id(&conn, &id)?;

    Ok(payment)
}

/// 查询供应商付款记录列表（分页，按创建时间倒序）
#[tauri::command]
pub async fn get_supplier_payments(
    db: tauri::State<'_, Database>,
    supplier_id: String,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<PageResult<SupplierPayment>, String> {
    let conn = db.get_conn()?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    // 查询总数
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM supplier_payments WHERE supplier_id = ?",
            params![supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // 查询列表
    let mut stmt = conn
        .prepare(
            "SELECT id, supplier_id, purchase_order_id, amount, payment_method,
                    payment_date, remark, created_at
             FROM supplier_payments
             WHERE supplier_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?",
        )
        .map_err(|e| e.to_string())?;

    let payments: Vec<SupplierPayment> = stmt
        .query_map(params![supplier_id, page_size, offset], |row| {
            Ok(SupplierPayment {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                purchase_order_id: row.get(2)?,
                amount: row.get(3)?,
                payment_method: row.get(4)?,
                payment_date: row.get(5)?,
                remark: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PageResult {
        list: payments,
        total: total as u32,
        page,
        page_size,
    })
}

/// 查询供应商财务流水（分页，按时间倒序）
///
/// 使用 UNION ALL 合并三类记录：
/// - purchase: 采购入库（正数）
/// - return: 退货冲抵（负数）
/// - payment: 付款支出（负数）
#[tauri::command]
pub async fn get_supplier_financial_flow(
    db: tauri::State<'_, Database>,
    supplier_id: String,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<PageResult<FinancialFlowItem>, String> {
    let conn = db.get_conn()?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    // 查询合并后的总数
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM (
                SELECT id FROM purchase_orders WHERE supplier_id = ?
                UNION ALL
                SELECT id FROM return_orders WHERE supplier_id = ?
                UNION ALL
                SELECT id FROM supplier_payments WHERE supplier_id = ?
            )",
            params![supplier_id, supplier_id, supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // 查询合并列表（按时间倒序，分页）
    let mut stmt = conn
        .prepare(
            "SELECT id, flow_type, order_no, amount, remark, created_at FROM (
                SELECT
                    id,
                    'purchase' AS flow_type,
                    order_no,
                    total_amount AS amount,
                    remark,
                    created_at
                FROM purchase_orders
                WHERE supplier_id = ?
                UNION ALL
                SELECT
                    id,
                    'return' AS flow_type,
                    order_no,
                    -total_amount AS amount,
                    remark,
                    created_at
                FROM return_orders
                WHERE supplier_id = ?
                UNION ALL
                SELECT
                    id,
                    'payment' AS flow_type,
                    purchase_order_id AS order_no,
                    -amount AS amount,
                    remark,
                    payment_date AS created_at
                FROM supplier_payments
                WHERE supplier_id = ?
            ) AS combined
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?",
        )
        .map_err(|e| e.to_string())?;

    let items: Vec<FinancialFlowItem> = stmt
        .query_map(
            params![supplier_id, supplier_id, supplier_id, page_size, offset],
            |row| {
                let flow_type: String = row.get(1)?;
                let flow_type_name = match flow_type.as_str() {
                    "purchase" => "采购入库".to_string(),
                    "return" => "退货冲抵".to_string(),
                    "payment" => "付款".to_string(),
                    _ => flow_type.clone(),
                };
                let amount: f64 = row.get(3)?;

                Ok(FinancialFlowItem {
                    id: row.get(0)?,
                    flow_type,
                    flow_type_name,
                    order_no: row.get(2)?,
                    amount,
                    balance: None,
                    remark: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PageResult {
        list: items,
        total: total as u32,
        page,
        page_size,
    })
}

/// 查询供应商余额汇总
///
/// 返回采购总额、已付总额、退货总额、欠款余额
/// balance = total_purchase - total_paid - total_return
#[tauri::command]
pub async fn get_supplier_balance(
    db: tauri::State<'_, Database>,
    supplier_id: String,
) -> Result<SupplierBalance, String> {
    let conn = db.get_conn()?;

    // 在一句 SQL 中查询三项总额
    let (total_purchase, total_paid, total_return): (f64, f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE supplier_id = ?), 0),
                COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = ?), 0),
                COALESCE((SELECT SUM(total_amount) FROM return_orders WHERE supplier_id = ?), 0)",
            params![supplier_id, supplier_id, supplier_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    // 欠款余额 = 采购总额 - 已付总额 - 退货冲抵
    let balance = total_purchase - total_paid - total_return;

    Ok(SupplierBalance {
        total_purchase,
        total_paid,
        total_return,
        balance,
    })
}

/// 根据 ID 查询单条付款记录
fn query_supplier_payment_by_id(conn: &rusqlite::Connection, id: &str) -> Result<SupplierPayment, String> {
    conn.query_row(
        "SELECT id, supplier_id, purchase_order_id, amount, payment_method,
                payment_date, remark, created_at
         FROM supplier_payments WHERE id = ?",
        params![id],
        |row| {
            Ok(SupplierPayment {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                purchase_order_id: row.get(2)?,
                amount: row.get(3)?,
                payment_method: row.get(4)?,
                payment_date: row.get(5)?,
                remark: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| format!("查询付款记录失败: {}", e))
}

// ============================================================================
// 单元测试
// ============================================================================
//
// 覆盖供应商付款模块核心场景：
// - 校验函数：validate_payment_method / validate_amount
// - SQL 逻辑：创建付款、付款记录分页、财务流水合并、余额汇总
// - 采购单 payment_status 自动更新

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use rusqlite::Connection;

    /// 准备测试用内存数据库
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("无法打开内存数据库");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("无法启用外键约束");
        run_migrations(&conn).expect("运行迁移失败");
        conn
    }

    /// 插入测试供应商
    fn insert_test_supplier(conn: &Connection, id: &str, name: &str) {
        conn.execute(
            "INSERT INTO suppliers (id, name, is_active, created_at, updated_at)
             VALUES (?, ?, 1, datetime('now'), datetime('now'))",
            params![id, name],
        )
        .expect("插入供应商失败");
    }

    /// 插入测试采购单
    fn insert_test_purchase_order(
        conn: &Connection,
        id: &str,
        order_no: &str,
        supplier_id: &str,
        total_amount: f64,
        payment_status: &str,
    ) {
        conn.execute(
            "INSERT INTO purchase_orders (id, order_no, supplier_id, total_amount, payment_status, remark, created_at)
             VALUES (?, ?, ?, ?, ?, '', datetime('now'))",
            params![id, order_no, supplier_id, total_amount, payment_status],
        )
        .expect("插入采购单失败");
    }

    /// 插入测试退货单
    fn insert_test_return_order(
        conn: &Connection,
        id: &str,
        order_no: &str,
        supplier_id: &str,
        total_amount: f64,
    ) {
        conn.execute(
            "INSERT INTO return_orders (id, order_no, supplier_id, return_date, return_reason, total_amount, remark, status, created_at)
             VALUES (?, ?, ?, '2026-07-04', '质量问题测试', ?, '', 'completed', datetime('now'))",
            params![id, order_no, supplier_id, total_amount],
        )
        .expect("插入退货单失败");
    }

    /// 插入测试付款记录
    fn insert_test_payment(
        conn: &Connection,
        id: &str,
        supplier_id: &str,
        purchase_order_id: Option<&str>,
        amount: f64,
        payment_method: &str,
        payment_date: &str,
    ) {
        conn.execute(
            "INSERT INTO supplier_payments (id, supplier_id, purchase_order_id, amount, payment_method, payment_date, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, '', datetime('now'))",
            params![id, supplier_id, purchase_order_id, amount, payment_method, payment_date],
        )
        .expect("插入付款记录失败");
    }

    // ----------------------------------------------------------------
    // 测试 1: validate_payment_method 合法方式
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_payment_method_valid() {
        for method in &["cash", "wechat", "alipay", "transfer", "other"] {
            assert!(
                validate_payment_method(method).is_ok(),
                "付款方式 {} 应通过校验",
                method
            );
        }
    }

    // ----------------------------------------------------------------
    // 测试 2: validate_payment_method 非法方式
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_payment_method_invalid() {
        assert!(validate_payment_method("credit_card").is_err());
        assert!(validate_payment_method("").is_err());
        assert!(validate_payment_method("bank").is_err());
    }

    // ----------------------------------------------------------------
    // 测试 3: validate_amount 合法
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_amount_valid() {
        assert!(validate_amount(1.0).is_ok());
        assert!(validate_amount(100.0).is_ok());
        assert!(validate_amount(0.01).is_ok());
        assert!(validate_amount(999_999_999.0).is_ok());
    }

    // ----------------------------------------------------------------
    // 测试 4: validate_amount 非法
    // ----------------------------------------------------------------
    #[test]
    fn test_validate_amount_invalid() {
        assert!(validate_amount(0.0).is_err(), "0 元应不通过");
        assert!(validate_amount(-100.0).is_err(), "负数应不通过");
        assert!(validate_amount(1_000_000_001.0).is_err(), "超过 10 亿应不通过");
    }

    // ----------------------------------------------------------------
    // 测试 5: 创建付款记录 + 采购单 payment_status 自动更新（付清）
    // ----------------------------------------------------------------
    #[test]
    fn test_create_payment_updates_order_status_paid() {
        let conn = setup_test_db();
        insert_test_supplier(&conn, "sup-1", "测试供应商");
        insert_test_purchase_order(&conn, "po-1", "RK001", "sup-1", 1000.0, "unpaid");

        // 付清
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute_batch("BEGIN TRANSACTION").unwrap();
        conn.execute(
            "INSERT INTO supplier_payments (id, supplier_id, purchase_order_id, amount, payment_method, payment_date, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, '', ?)",
            params![
                uuid::Uuid::new_v4().to_string(),
                "sup-1",
                "po-1",
                1000.0,
                "cash",
                "2026-07-04",
                now,
            ],
        )
        .unwrap();

        let paid: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE purchase_order_id = ?",
                ["po-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(paid, 1000.0);

        let total: f64 = conn
            .query_row(
                "SELECT total_amount FROM purchase_orders WHERE id = ?",
                ["po-1"],
                |row| row.get(0),
            )
            .unwrap();

        let status = if paid >= total {
            "paid"
        } else if paid > 0.0 {
            "partial"
        } else {
            "unpaid"
        };
        conn.execute(
            "UPDATE purchase_orders SET payment_status = ? WHERE id = ?",
            params![status, "po-1"],
        )
        .unwrap();
        conn.execute_batch("COMMIT").unwrap();

        let saved_status: String = conn
            .query_row(
                "SELECT payment_status FROM purchase_orders WHERE id = ?",
                ["po-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(saved_status, "paid", "付清后状态应为 paid");
    }

    // ----------------------------------------------------------------
    // 测试 6: 创建付款记录 + 采购单 payment_status 自动更新（部分付款）
    // ----------------------------------------------------------------
    #[test]
    fn test_create_payment_updates_order_status_partial() {
        let conn = setup_test_db();
        insert_test_supplier(&conn, "sup-1", "测试供应商");
        insert_test_purchase_order(&conn, "po-1", "RK001", "sup-1", 1000.0, "unpaid");

        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute_batch("BEGIN TRANSACTION").unwrap();
        conn.execute(
            "INSERT INTO supplier_payments (id, supplier_id, purchase_order_id, amount, payment_method, payment_date, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, '', ?)",
            params![
                uuid::Uuid::new_v4().to_string(),
                "sup-1",
                "po-1",
                300.0,
                "wechat",
                "2026-07-04",
                now,
            ],
        )
        .unwrap();

        let paid: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE purchase_order_id = ?",
                ["po-1"],
                |row| row.get(0),
            )
            .unwrap();
        let total: f64 = conn
            .query_row(
                "SELECT total_amount FROM purchase_orders WHERE id = ?",
                ["po-1"],
                |row| row.get(0),
            )
            .unwrap();

        let status = if paid >= total {
            "paid"
        } else if paid > 0.0 {
            "partial"
        } else {
            "unpaid"
        };
        conn.execute(
            "UPDATE purchase_orders SET payment_status = ? WHERE id = ?",
            params![status, "po-1"],
        )
        .unwrap();
        conn.execute_batch("COMMIT").unwrap();

        assert_eq!(status, "partial", "部分支付后状态应为 partial");
    }

    // ----------------------------------------------------------------
    // 测试 7: 付款记录分页查询
    // ----------------------------------------------------------------
    #[test]
    fn test_get_supplier_payments_pagination() {
        let conn = setup_test_db();
        insert_test_supplier(&conn, "sup-1", "测试供应商");

        // 插入 3 条付款记录
        for i in 1..=3 {
            insert_test_payment(
                &conn,
                &format!("pmt-{}", i),
                "sup-1",
                None,
                (i * 100) as f64,
                "cash",
                "2026-07-04",
            );
        }

        // 查询总数
        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM supplier_payments WHERE supplier_id = ?",
                ["sup-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(total, 3);

        // 分页查询第 1 页（每页 2 条）
        let mut stmt = conn
            .prepare(
                "SELECT id, supplier_id, purchase_order_id, amount, payment_method,
                        payment_date, remark, created_at
                 FROM supplier_payments
                 WHERE supplier_id = ?
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?",
            )
            .unwrap();
        let payments: Vec<SupplierPayment> = stmt
            .query_map(params!["sup-1", 2_i64, 0_i64], |row| {
                Ok(SupplierPayment {
                    id: row.get(0)?,
                    supplier_id: row.get(1)?,
                    purchase_order_id: row.get(2)?,
                    amount: row.get(3)?,
                    payment_method: row.get(4)?,
                    payment_date: row.get(5)?,
                    remark: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(payments.len(), 2, "第 1 页应返回 2 条");
    }

    // ----------------------------------------------------------------
    // 测试 8: 财务流水中包含采购、退货、付款三类记录
    // ----------------------------------------------------------------
    #[test]
    fn test_financial_flow_contains_all_types() {
        let conn = setup_test_db();
        insert_test_supplier(&conn, "sup-1", "测试供应商");
        insert_test_purchase_order(&conn, "po-1", "RK001", "sup-1", 1000.0, "unpaid");
        insert_test_return_order(&conn, "ro-1", "TH001", "sup-1", 200.0);
        insert_test_payment(&conn, "pmt-1", "sup-1", Some("po-1"), 300.0, "cash", "2026-07-04");

        // 合并查询
        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM (
                    SELECT id FROM purchase_orders WHERE supplier_id = ?
                    UNION ALL
                    SELECT id FROM return_orders WHERE supplier_id = ?
                    UNION ALL
                    SELECT id FROM supplier_payments WHERE supplier_id = ?
                )",
                params!["sup-1", "sup-1", "sup-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(total, 3, "应包含 3 条记录（采购 + 退货 + 付款）");

        // 验证每条记录的类型和符号
        let mut stmt = conn
            .prepare(
                "SELECT flow_type, amount FROM (
                    SELECT 'purchase' AS flow_type, total_amount AS amount, created_at
                    FROM purchase_orders WHERE supplier_id = ?
                    UNION ALL
                    SELECT 'return' AS flow_type, -total_amount AS amount, created_at
                    FROM return_orders WHERE supplier_id = ?
                    UNION ALL
                    SELECT 'payment' AS flow_type, -amount AS amount, payment_date AS created_at
                    FROM supplier_payments WHERE supplier_id = ?
                ) ORDER BY created_at DESC",
            )
            .unwrap();

        let rows: Vec<(String, f64)> = stmt
            .query_map(params!["sup-1", "sup-1", "sup-1"], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        // 找到 purchase 记录
        let purchase = rows.iter().find(|(t, _)| t == "purchase").unwrap();
        assert!(purchase.1 > 0.0, "采购金额应为正数");

        // 找到 return 记录
        let return_item = rows.iter().find(|(t, _)| t == "return").unwrap();
        assert!(return_item.1 < 0.0, "退货金额应为负数");

        // 找到 payment 记录
        let payment = rows.iter().find(|(t, _)| t == "payment").unwrap();
        assert!(payment.1 < 0.0, "付款金额应为负数");
    }

    // ----------------------------------------------------------------
    // 测试 9: 供应商余额汇总计算
    // ----------------------------------------------------------------
    #[test]
    fn test_supplier_balance_calculation() {
        let conn = setup_test_db();
        insert_test_supplier(&conn, "sup-1", "测试供应商");
        insert_test_purchase_order(&conn, "po-1", "RK001", "sup-1", 1000.0, "unpaid");
        insert_test_purchase_order(&conn, "po-2", "RK002", "sup-1", 500.0, "unpaid");
        insert_test_return_order(&conn, "ro-1", "TH001", "sup-1", 200.0);
        insert_test_payment(&conn, "pmt-1", "sup-1", None, 300.0, "cash", "2026-07-04");

        // 查询三项总额
        let (total_purchase, total_paid, total_return): (f64, f64, f64) = conn
            .query_row(
                "SELECT
                    COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE supplier_id = ?), 0),
                    COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = ?), 0),
                    COALESCE((SELECT SUM(total_amount) FROM return_orders WHERE supplier_id = ?), 0)",
                params!["sup-1", "sup-1", "sup-1"],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();

        assert_eq!(total_purchase, 1500.0, "采购总额应为 1500");
        assert_eq!(total_paid, 300.0, "已付总额应为 300");
        assert_eq!(total_return, 200.0, "退货总额应为 200");

        let balance = total_purchase - total_paid - total_return;
        assert!((balance - 1000.0).abs() < f64::EPSILON, "欠款余额应为 1000");
    }

    // ----------------------------------------------------------------
    // 测试 10: 无任何记录时余额全为零
    // ----------------------------------------------------------------
    #[test]
    fn test_supplier_balance_empty() {
        let conn = setup_test_db();
        insert_test_supplier(&conn, "sup-empty", "无交易供应商");

        let (total_purchase, total_paid, total_return): (f64, f64, f64) = conn
            .query_row(
                "SELECT
                    COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE supplier_id = ?), 0),
                    COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = ?), 0),
                    COALESCE((SELECT SUM(total_amount) FROM return_orders WHERE supplier_id = ?), 0)",
                params!["sup-empty", "sup-empty", "sup-empty"],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();

        assert_eq!(total_purchase, 0.0);
        assert_eq!(total_paid, 0.0);
        assert_eq!(total_return, 0.0);
    }
}
