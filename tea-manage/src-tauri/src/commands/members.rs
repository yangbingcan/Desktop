//! 会员储值余额 Tauri Commands
//!
//! 提供会员充值、退款、流水查询、最后一次支付方式等接口
//! v0.3.1 M06 储值余额功能

use crate::db::Database;
use crate::models::{
    BalanceLog, PageResult, RechargeInput, RechargeResult, RefundInput, RefundResult,
};
use chrono::Local;
use rusqlite::{params, Connection};
use uuid::Uuid;

// ==================== 校验函数 ====================

/// 校验支付方式合法性
///
/// 合法值：cash（现金）、wechat（微信）、alipay（支付宝）
/// 注：memberBalance 是收银台内部支付方式，不允许在充值/退款时使用
fn validate_payment_method(method: &str) -> Result<(), String> {
    if !["cash", "wechat", "alipay"].contains(&method) {
        return Err(format!("无效的支付方式: {}", method));
    }
    Ok(())
}

/// 校验充值金额必须 > 0
fn validate_recharge_amount(amount: f64) -> Result<(), String> {
    if amount <= 0.0 {
        return Err("充值金额必须大于 0".to_string());
    }
    if !amount.is_finite() {
        return Err("充值金额无效".to_string());
    }
    Ok(())
}

/// 校验退款金额合法（> 0 且 ≤ 当前余额）
fn validate_refund_amount(amount: f64, balance: f64) -> Result<(), String> {
    if amount <= 0.0 {
        return Err("退款金额必须大于 0".to_string());
    }
    if !amount.is_finite() {
        return Err("退款金额无效".to_string());
    }
    if amount > balance {
        return Err(format!(
            "退款金额 ¥{:.2} 不能超过当前余额 ¥{:.2}",
            amount, balance
        ));
    }
    Ok(())
}

/// 校验退款备注至少 5 个字符
fn validate_refund_remark(remark: &str) -> Result<(), String> {
    let char_count = remark.trim().chars().count();
    if char_count < 5 {
        return Err("退款原因至少 5 个字符".to_string());
    }
    Ok(())
}

// ==================== 充值 ====================

/// 会员充值业务实现（纯函数，便于单元测试）
///
/// 事务流程：
/// 1. 校验输入
/// 2. BEGIN EXCLUSIVE TRANSACTION
/// 3. 查询当前余额
/// 4. 更新余额 = 当前余额 + 充值金额
/// 5. 插入 recharge 流水
/// 6. COMMIT
pub fn recharge_member_balance_impl(
    conn: &Connection,
    input: RechargeInput,
) -> Result<RechargeResult, String> {
    // 1. 输入校验
    validate_recharge_amount(input.amount)?;
    validate_payment_method(&input.payment_method)?;

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let log_id = Uuid::new_v4().to_string();

    // 2. 排他事务
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    // 事务回滚辅助闭包
    let rollback = |e: String, conn: &Connection| -> String {
        let _ = conn.execute("ROLLBACK", []);
        e
    };

    // 3. 查询当前余额（必须在事务内，避免并发问题）
    let current_balance: f64 = conn
        .query_row(
            "SELECT balance FROM members WHERE id = ? AND is_active = 1",
            [&input.member_id],
            |row| row.get(0),
        )
        .map_err(|e| rollback(format!("会员不存在或已停用: {}", e), conn))?;

    // 4. 计算并更新余额
    let new_balance = current_balance + input.amount;
    conn.execute(
        "UPDATE members SET balance = ?, updated_at = ? WHERE id = ?",
        params![new_balance, now, &input.member_id],
    )
    .map_err(|e| rollback(format!("更新余额失败: {}", e), conn))?;

    // 5. 插入流水
    let remark_str = input.remark.clone().unwrap_or_default();
    conn.execute(
        "INSERT INTO member_balance_logs
            (id, member_id, change_type, change_amount, balance_after,
             payment_method, operator, related_order_id, bonus_amount, remark, created_at)
         VALUES (?, ?, 'recharge', ?, ?, ?, ?, NULL, ?, ?, ?)",
        params![
            log_id,
            input.member_id,
            input.amount,
            new_balance,
            input.payment_method,
            input.operator,
            input.bonus_amount,
            remark_str,
            now
        ],
    )
    .map_err(|e| rollback(format!("插入流水失败: {}", e), conn))?;

    // 6. 提交
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(RechargeResult {
        log_id,
        new_balance,
        created_at: now,
    })
}

/// 会员充值 Tauri Command
#[tauri::command]
pub async fn recharge_member_balance(
    db: tauri::State<'_, Database>,
    input: RechargeInput,
) -> Result<RechargeResult, String> {
    let conn = db.get_conn()?;
    recharge_member_balance_impl(&conn, input)
}

// ==================== 退款 ====================

/// 会员退款业务实现
///
/// 退款流程与充值类似，但：
/// - 余额减少而非增加
/// - 备注必填且 ≥ 5 字符
/// - 流水 change_amount 为负数
pub fn refund_member_balance_impl(
    conn: &Connection,
    input: RefundInput,
) -> Result<RefundResult, String> {
    // 1. 输入校验
    validate_payment_method(&input.payment_method)?;
    validate_refund_remark(&input.remark)?;

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let log_id = Uuid::new_v4().to_string();

    // 2. 排他事务
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    let rollback = |e: String, conn: &Connection| -> String {
        let _ = conn.execute("ROLLBACK", []);
        e
    };

    // 3. 查询当前余额
    let current_balance: f64 = conn
        .query_row(
            "SELECT balance FROM members WHERE id = ? AND is_active = 1",
            [&input.member_id],
            |row| row.get(0),
        )
        .map_err(|e| rollback(format!("会员不存在或已停用: {}", e), conn))?;

    // 4. 校验退款金额（在事务内校验，避免 TOCTOU 问题）
    validate_refund_amount(input.amount, current_balance).map_err(|e| rollback(e, conn))?;

    // 5. 扣减余额
    let new_balance = current_balance - input.amount;
    conn.execute(
        "UPDATE members SET balance = ?, updated_at = ? WHERE id = ?",
        params![new_balance, now, &input.member_id],
    )
    .map_err(|e| rollback(format!("扣减余额失败: {}", e), conn))?;

    // 6. 插入流水（change_amount 为负数表示扣减）
    conn.execute(
        "INSERT INTO member_balance_logs
            (id, member_id, change_type, change_amount, balance_after,
             payment_method, operator, related_order_id, remark, created_at)
         VALUES (?, ?, 'refund', ?, ?, ?, ?, NULL, ?, ?)",
        params![
            log_id,
            input.member_id,
            -input.amount,
            new_balance,
            input.payment_method,
            input.operator,
            input.remark,
            now
        ],
    )
    .map_err(|e| rollback(format!("插入退款流水失败: {}", e), conn))?;

    // 7. 提交
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(RefundResult {
        log_id,
        new_balance,
        created_at: now,
    })
}

/// 会员退款 Tauri Command
#[tauri::command]
pub async fn refund_member_balance(
    db: tauri::State<'_, Database>,
    input: RefundInput,
) -> Result<RefundResult, String> {
    let conn = db.get_conn()?;
    refund_member_balance_impl(&conn, input)
}

// ==================== 流水查询 ====================

/// 获取会员储值流水（分页 + 类型筛选）
///
/// 参数：
/// - member_id: 会员 ID
/// - page: 页码（从 1 开始，默认 1）
/// - page_size: 每页条数（默认 20）
/// - change_type: 可选筛选 recharge/consume/refund
pub fn get_member_balance_logs_impl(
    conn: &Connection,
    member_id: String,
    page: Option<i64>,
    page_size: Option<i64>,
    change_type: Option<String>,
) -> Result<PageResult<BalanceLog>, String> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * page_size;

    // 构建动态 WHERE 子句
    let mut where_clauses: Vec<String> = vec!["member_id = ?".to_string()];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(member_id.clone())];

    if let Some(ref ct) = change_type {
        if !ct.trim().is_empty() {
            where_clauses.push("change_type = ?".to_string());
            params_vec.push(Box::new(ct.clone()));
        }
    }

    let where_sql = format!("WHERE {}", where_clauses.join(" AND "));

    // 查询总数
    let count_sql = format!("SELECT COUNT(*) FROM member_balance_logs {}", where_sql);
    let count_params: Vec<&dyn rusqlite::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();
    let total: i64 = conn
        .query_row(&count_sql, count_params.as_slice(), |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // 查询列表
    let list_sql = format!(
        "SELECT id, member_id, change_type, change_amount, balance_after,
                payment_method, operator, related_order_id, bonus_amount,
                fee_amount, remark, created_at
         FROM member_balance_logs {}
         ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        where_sql
    );
    params_vec.push(Box::new(page_size));
    params_vec.push(Box::new(offset));
    let list_params: Vec<&dyn rusqlite::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;
    let logs: Vec<BalanceLog> = stmt
        .query_map(list_params.as_slice(), |row| {
            Ok(BalanceLog {
                id: row.get(0)?,
                member_id: row.get(1)?,
                change_type: row.get(2)?,
                change_amount: row.get(3)?,
                balance_after: row.get(4)?,
                payment_method: row.get(5)?,
                operator: row.get(6)?,
                related_order_id: row.get(7)?,
                bonus_amount: row.get(8)?,
                fee_amount: row.get(9)?,
                remark: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PageResult {
        list: logs,
        total: total as u32,
        page: page as u32,
        page_size: page_size as u32,
    })
}

/// 获取会员储值流水 Tauri Command
#[tauri::command]
pub async fn get_member_balance_logs(
    db: tauri::State<'_, Database>,
    member_id: String,
    page: Option<i64>,
    page_size: Option<i64>,
    change_type: Option<String>,
) -> Result<PageResult<BalanceLog>, String> {
    let conn = db.get_conn()?;
    get_member_balance_logs_impl(&conn, member_id, page, page_size, change_type)
}

// ==================== 最后一次充值方式 ====================

/// 获取会员最近一次充值的支付方式
///
/// 用于退款时默认选择退款方式（"退到原支付方式"业务规则）。
/// 找不到时返回 None（前端 fallback 到 cash）。
pub fn get_member_last_payment_method_impl(
    conn: &Connection,
    member_id: String,
) -> Result<Option<String>, String> {
    let result: Option<String> = conn
        .query_row(
            "SELECT payment_method FROM member_balance_logs
             WHERE member_id = ? AND change_type = 'recharge'
             ORDER BY created_at DESC, id DESC LIMIT 1",
            [&member_id],
            |row| row.get(0),
        )
        .ok();

    Ok(result)
}

/// 获取会员最近一次充值支付方式 Tauri Command
#[tauri::command]
pub async fn get_member_last_payment_method(
    db: tauri::State<'_, Database>,
    member_id: String,
) -> Result<Option<String>, String> {
    let conn = db.get_conn()?;
    get_member_last_payment_method_impl(&conn, member_id)
}

// ==================== 单元测试 ====================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;

    /// 创建测试用内存数据库（应用所有迁移）
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("无法打开内存数据库");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("无法启用外键约束");
        run_migrations(&conn).expect("运行迁移失败");

        // 插入测试用默认商品（外键依赖）
        conn.execute(
            "INSERT INTO product_categories (id, name, level, sort_order) VALUES ('cat-test', '测试分类', 1, 0)",
            [],
        ).expect("插入测试分类失败");

        conn
    }

    /// 插入测试会员
    fn insert_test_member(conn: &Connection, id: &str, name: &str, balance: f64) {
        conn.execute(
            "INSERT INTO members (id, name, phone, level, balance, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 'normal', ?, 1, datetime('now'), datetime('now'))",
            rusqlite::params![id, name, format!("138{:0>9}", id), balance],
        )
        .expect("插入测试会员失败");
    }

    /// 测试 1: 充值成功（余额增加 + 流水插入）
    #[test]
    fn test_recharge_success() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 100.0);

        let input = RechargeInput {
            member_id: "m001".to_string(),
            amount: 200.0,
            payment_method: "cash".to_string(),
            operator: "tester".to_string(),
            remark: Some("测试充值".to_string()),
            bonus_amount: 0.0,
        };
        let result = recharge_member_balance_impl(&conn, input).expect("充值失败");

        assert_eq!(result.new_balance, 300.0);

        // 验证数据库余额
        let balance: f64 = conn
            .query_row("SELECT balance FROM members WHERE id = 'm001'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(balance, 300.0);

        // 验证流水
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM member_balance_logs WHERE member_id = 'm001' AND change_type = 'recharge'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    /// 测试 2: 充值金额 ≤ 0 应失败
    #[test]
    fn test_recharge_invalid_amount() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 100.0);

        let input = RechargeInput {
            member_id: "m001".to_string(),
            amount: 0.0,
            payment_method: "cash".to_string(),
            operator: "tester".to_string(),
            remark: None,
            bonus_amount: 0.0,
        };
        let result = recharge_member_balance_impl(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("大于 0"));
    }

    /// 测试 3: 退款成功
    #[test]
    fn test_refund_success() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 200.0);

        let input = RefundInput {
            member_id: "m001".to_string(),
            amount: 80.0,
            payment_method: "wechat".to_string(),
            operator: "tester".to_string(),
            remark: "会员申请退款测试".to_string(),
        };
        let result = refund_member_balance_impl(&conn, input).expect("退款失败");

        assert_eq!(result.new_balance, 120.0);

        // 验证流水 change_amount 为负
        let change_amount: f64 = conn
            .query_row(
                "SELECT change_amount FROM member_balance_logs WHERE member_id = 'm001' AND change_type = 'refund'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(change_amount, -80.0);
    }

    /// 测试 4: 退款金额超过余额应失败
    #[test]
    fn test_refund_exceed_balance() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 100.0);

        let input = RefundInput {
            member_id: "m001".to_string(),
            amount: 200.0,
            payment_method: "cash".to_string(),
            operator: "tester".to_string(),
            remark: "超额退款测试".to_string(),
        };
        let result = refund_member_balance_impl(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不能超过"));
    }

    /// 测试 5: 退款备注 < 5 字符应失败
    #[test]
    fn test_refund_short_remark() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 100.0);

        let input = RefundInput {
            member_id: "m001".to_string(),
            amount: 50.0,
            payment_method: "cash".to_string(),
            operator: "tester".to_string(),
            remark: "短".to_string(),
        };
        let result = refund_member_balance_impl(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("5 个字符"));
    }

    /// 测试 6: 流水查询 + 类型筛选
    #[test]
    fn test_query_balance_logs_with_filter() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 0.0);

        // 插入 2 条 recharge + 1 条 refund
        recharge_member_balance_impl(
            &conn,
            RechargeInput {
                member_id: "m001".to_string(),
                amount: 100.0,
                payment_method: "cash".to_string(),
                operator: "t".to_string(),
                remark: None,
                bonus_amount: 0.0,
            },
        )
        .unwrap();
        recharge_member_balance_impl(
            &conn,
            RechargeInput {
                member_id: "m001".to_string(),
                amount: 50.0,
                payment_method: "wechat".to_string(),
                operator: "t".to_string(),
                remark: None,
                bonus_amount: 0.0,
            },
        )
        .unwrap();
        refund_member_balance_impl(
            &conn,
            RefundInput {
                member_id: "m001".to_string(),
                amount: 30.0,
                payment_method: "cash".to_string(),
                operator: "t".to_string(),
                remark: "测试退款原因".to_string(),
            },
        )
        .unwrap();

        // 全部查询
        let all =
            get_member_balance_logs_impl(&conn, "m001".to_string(), None, None, None).unwrap();
        assert_eq!(all.total, 3);
        assert_eq!(all.list.len(), 3);

        // 仅 recharge
        let recharge_only = get_member_balance_logs_impl(
            &conn,
            "m001".to_string(),
            None,
            None,
            Some("recharge".to_string()),
        )
        .unwrap();
        assert_eq!(recharge_only.total, 2);

        // 仅 refund
        let refund_only = get_member_balance_logs_impl(
            &conn,
            "m001".to_string(),
            None,
            None,
            Some("refund".to_string()),
        )
        .unwrap();
        assert_eq!(refund_only.total, 1);
    }

    /// 测试 7: 分页测试
    #[test]
    fn test_balance_logs_pagination() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 0.0);

        // 插入 5 条 recharge
        for i in 0..5 {
            recharge_member_balance_impl(
                &conn,
                RechargeInput {
                    member_id: "m001".to_string(),
                    amount: 10.0,
                    payment_method: "cash".to_string(),
                    operator: "t".to_string(),
                    remark: Some(format!("第 {} 次", i + 1)),
                    bonus_amount: 0.0,
                },
            )
            .unwrap();
        }

        // 第 1 页（page_size=2）
        let p1 =
            get_member_balance_logs_impl(&conn, "m001".to_string(), Some(1), Some(2), None)
                .unwrap();
        assert_eq!(p1.total, 5);
        assert_eq!(p1.list.len(), 2);

        // 第 3 页（page_size=2，最后一页只有 1 条）
        let p3 =
            get_member_balance_logs_impl(&conn, "m001".to_string(), Some(3), Some(2), None)
                .unwrap();
        assert_eq!(p3.total, 5);
        assert_eq!(p3.list.len(), 1);
    }

    /// 测试 8: 获取最近一次充值方式
    #[test]
    fn test_get_last_payment_method() {
        let conn = setup_test_db();
        insert_test_member(&conn, "m001", "张三", 0.0);

        // 没有充值时返回 None
        let none = get_member_last_payment_method_impl(&conn, "m001".to_string()).unwrap();
        assert!(none.is_none());

        // 充值 cash
        recharge_member_balance_impl(
            &conn,
            RechargeInput {
                member_id: "m001".to_string(),
                amount: 100.0,
                payment_method: "cash".to_string(),
                operator: "t".to_string(),
                remark: None,
                bonus_amount: 0.0,
            },
        )
        .unwrap();

        // 等待 1 秒以确保 created_at 不同（避免同一秒内顺序不确定）
        std::thread::sleep(std::time::Duration::from_millis(1100));

        // 充值 wechat
        recharge_member_balance_impl(
            &conn,
            RechargeInput {
                member_id: "m001".to_string(),
                amount: 200.0,
                payment_method: "wechat".to_string(),
                operator: "t".to_string(),
                remark: None,
                bonus_amount: 0.0,
            },
        )
        .unwrap();

        // 应该返回 wechat（最近一次）
        let last = get_member_last_payment_method_impl(&conn, "m001".to_string()).unwrap();
        assert_eq!(last, Some("wechat".to_string()));
    }
}
