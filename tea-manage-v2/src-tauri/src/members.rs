/** @file 会员管理 - CRUD + 偏好 + 储值 + 消费记录 */

use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Clone)]
pub struct Member {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub gender: Option<String>,
    pub birthday: Option<String>,
    pub level: String,
    pub points: i64,
    pub balance: f64,
    pub total_consume: f64,
    pub consume_count: i64,
    pub last_visit: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
pub struct MemberPreference {
    pub member_id: String,
    pub preferred_teas: String,
    pub taste_preferences: String,
    pub taboos: String,
    pub brew_habits: String,
    pub consumption_scenario: String,
    pub remark: String,
}

#[derive(Deserialize)]
pub struct MemberInput {
    pub name: String,
    pub phone: String,
    pub gender: Option<String>,
    pub birthday: Option<String>,
    pub level: Option<String>,
}

#[derive(Deserialize)]
pub struct PreferenceInput {
    pub preferred_teas: String,
    pub taste_preferences: String,
    pub taboos: String,
    pub brew_habits: String,
    pub consumption_scenario: String,
    pub remark: String,
}

#[derive(Deserialize)]
pub struct RechargeInput {
    pub member_id: String,
    pub amount: f64,
    pub payment_method: String,
    pub operator: String,
    pub remark: Option<String>,
    pub bonus_amount: Option<f64>,
}

fn map_member(row: &rusqlite::Row) -> rusqlite::Result<Member> {
    Ok(Member {
        id: row.get(0)?,
        name: row.get(1)?,
        phone: row.get(2)?,
        gender: row.get(3)?,
        birthday: row.get(4)?,
        level: row.get(5)?,
        points: row.get(6)?,
        balance: row.get(7)?,
        total_consume: row.get(8)?,
        consume_count: row.get(9)?,
        last_visit: row.get(10)?,
        is_active: row.get::<_, i32>(11)? != 0,
        created_at: row.get(12)?,
    })
}

const MEMBER_SELECT: &str = "id, name, phone, gender, birthday, level, points, balance, total_consume, consume_count, last_visit, is_active, created_at FROM members";

#[tauri::command]
pub fn get_members(db: State<'_, DbState>, token: String, page: Option<i32>, page_size: Option<i32>, keyword: Option<String>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let (where_clause, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref kw) = keyword {
        if kw.is_empty() { (String::from("WHERE 1=1"), vec![]) }
        else { (String::from("WHERE name LIKE ?1 OR phone LIKE ?1"), vec![Box::new(format!("%{}%", kw))] ) }
    } else { (String::from("WHERE 1=1"), vec![]) };

    let total: i32 = conn.query_row(&format!("SELECT COUNT(*) FROM members {}", where_clause), rusqlite::params_from_iter(params_vec.iter().map(|b| b.as_ref())), |r| r.get(0)).unwrap_or(0);

    let query = format!("SELECT {} {} ORDER BY created_at DESC LIMIT ? OFFSET ?", MEMBER_SELECT, where_clause);
    let mut param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    param_refs.push(&page_size);
    param_refs.push(&offset);

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let list: Vec<Member> = stmt.query_map(rusqlite::params_from_iter(param_refs.iter()), map_member).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}

#[tauri::command]
pub fn get_member_detail(db: State<'_, DbState>, token: String, id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let member = conn.query_row(&format!("SELECT {} WHERE id = ?1", MEMBER_SELECT), params![id], map_member).map_err(|e| format!("查询会员失败: {}", e))?;

    let pref = conn.query_row("SELECT member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark FROM member_preferences WHERE member_id = ?1", params![id], |row| {
        Ok(MemberPreference {
            member_id: row.get(0)?, preferred_teas: row.get(1)?, taste_preferences: row.get(2)?,
            taboos: row.get(3)?, brew_habits: row.get(4)?, consumption_scenario: row.get(5)?, remark: row.get(6)?,
        })
    }).ok();

    Ok(serde_json::json!({ "member": member, "preference": pref }))
}

#[tauri::command]
pub fn create_member(db: State<'_, DbState>, token: String, input: MemberInput) -> Result<String, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO members (id, name, phone, gender, birthday, level) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, input.name, input.phone, input.gender, input.birthday, input.level.unwrap_or("normal".to_string())],
    ).map_err(|e| format!("创建会员失败: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub fn update_member(db: State<'_, DbState>, token: String, id: String, input: MemberInput) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    conn.execute(
        "UPDATE members SET name = ?1, phone = ?2, gender = ?3, birthday = ?4, level = ?5, updated_at = datetime('now') WHERE id = ?6",
        params![input.name, input.phone, input.gender, input.birthday, input.level.unwrap_or("normal".to_string()), id],
    ).map_err(|e| format!("更新会员失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn update_member_preference(db: State<'_, DbState>, token: String, member_id: String, input: PreferenceInput) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    conn.execute(
        "INSERT INTO member_preferences (id, member_id, preferred_teas, taste_preferences, taboos, brew_habits, consumption_scenario, remark)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(member_id) DO UPDATE SET
            preferred_teas = excluded.preferred_teas,
            taste_preferences = excluded.taste_preferences,
            taboos = excluded.taboos,
            brew_habits = excluded.brew_habits,
            consumption_scenario = excluded.consumption_scenario,
            remark = excluded.remark,
            updated_at = datetime('now')",
        params![uuid::Uuid::new_v4().to_string(), member_id, input.preferred_teas, input.taste_preferences, input.taboos, input.brew_habits, input.consumption_scenario, input.remark],
    ).map_err(|e| format!("更新偏好失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_member_by_phone(db: State<'_, DbState>, token: String, phone: String) -> Result<Option<Member>, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let member = conn.query_row(&format!("SELECT {} WHERE phone = ?1 AND is_active = 1", MEMBER_SELECT), params![phone], map_member).ok();
    Ok(member)
}

#[tauri::command]
pub fn get_member_consumption(db: State<'_, DbState>, token: String, member_id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let mut stmt = conn.prepare("SELECT id, order_no, total_amount, points_earned, points_deduct, created_at FROM sales_orders WHERE member_id = ?1 ORDER BY created_at DESC LIMIT 50").map_err(|e| e.to_string())?;
    let records: Vec<serde_json::Value> = stmt.query_map(params![member_id], |row| {
        Ok(serde_json::json!({
            "orderId": row.get::<_, String>(0)?,
            "orderNo": row.get::<_, String>(1)?,
            "totalAmount": row.get::<_, f64>(2)?,
            "pointsEarned": row.get::<_, i64>(3)?,
            "pointsDeduct": row.get::<_, i64>(4)?,
            "createdAt": row.get::<_, String>(5)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({ "memberId": member_id, "records": records }))
}

#[tauri::command]
pub fn recharge_member_balance(db: State<'_, DbState>, token: String, input: RechargeInput) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 { return Err("充值金额必须大于0".to_string()); }

    let current: f64 = tx.query_row("SELECT balance FROM members WHERE id = ?1", params![input.member_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    let new_balance = current + input.amount + input.bonus_amount.unwrap_or(0.0);

    tx.execute("UPDATE members SET balance = ?1, updated_at = datetime('now') WHERE id = ?2", params![new_balance, input.member_id]).map_err(|e| e.to_string())?;

    let log_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO member_balance_logs (id, member_id, change_type, change_amount, balance_after, payment_method, operator, bonus_amount, remark)
         VALUES (?1, ?2, 'recharge', ?3, ?4, ?5, ?6, ?7, ?8)",
        params![log_id, input.member_id, input.amount + input.bonus_amount.unwrap_or(0.0), new_balance, input.payment_method, input.operator, input.bonus_amount.unwrap_or(0.0), input.remark.as_deref().unwrap_or("")],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "logId": log_id, "newBalance": new_balance }))
}

#[tauri::command]
pub fn refund_member_balance(db: State<'_, DbState>, token: String, input: RechargeInput) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 { return Err("退款金额必须大于0".to_string()); }

    let current: f64 = tx.query_row("SELECT balance FROM members WHERE id = ?1", params![input.member_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if current < input.amount { return Err(format!("余额不足，当前余额 {:.2}", current)); }

    let new_balance = current - input.amount;
    tx.execute("UPDATE members SET balance = ?1, updated_at = datetime('now') WHERE id = ?2", params![new_balance, input.member_id]).map_err(|e| e.to_string())?;

    let log_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO member_balance_logs (id, member_id, change_type, change_amount, balance_after, payment_method, operator, remark)
         VALUES (?1, ?2, 'refund', ?3, ?4, ?5, ?6, ?7)",
        params![log_id, input.member_id, -input.amount, new_balance, input.payment_method, input.operator, input.remark.as_deref().unwrap_or("")],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "logId": log_id, "newBalance": new_balance }))
}

#[tauri::command]
pub fn get_member_balance_logs(db: State<'_, DbState>, token: String, member_id: String, page: Option<i32>, page_size: Option<i32>) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let total: i32 = conn.query_row("SELECT COUNT(*) FROM member_balance_logs WHERE member_id = ?1", params![member_id], |r| r.get(0)).unwrap_or(0);

    let mut stmt = conn.prepare("SELECT id, member_id, change_type, change_amount, balance_after, payment_method, operator, related_order_id, bonus_amount, fee_amount, remark, created_at FROM member_balance_logs WHERE member_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3").map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = stmt.query_map(params![member_id, page_size, offset], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "memberId": row.get::<_, String>(1)?,
            "changeType": row.get::<_, String>(2)?,
            "changeAmount": row.get::<_, f64>(3)?,
            "balanceAfter": row.get::<_, f64>(4)?,
            "paymentMethod": row.get::<_, String>(5)?,
            "operator": row.get::<_, String>(6)?,
            "relatedOrderId": row.get::<_, Option<String>>(7)?,
            "bonusAmount": row.get::<_, f64>(8)?,
            "feeAmount": row.get::<_, f64>(9)?,
            "remark": row.get::<_, String>(10)?,
            "createdAt": row.get::<_, String>(11)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({ "list": list, "total": total, "page": page, "pageSize": page_size }))
}
