/** @file 操作日志 - 日志记录辅助函数、日志查询与清理（含鉴权） */

use crate::auth::verify_and_get_context;
use crate::database::{DbState, get_conn};
use crate::error_util::translate_db_error;
use crate::models::{GetOperationLogsParams, GetOperationLogsResult, OperationLog};
use rusqlite::{params, Row};

fn get_computer_name() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn get_ip_address() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_default()
}

fn get_mac_address() -> String {
    mac_address::get_mac_address()
        .map(|m| m.to_string().replace(':', ""))
        .unwrap_or_default()
}

fn get_os_info() -> String {
    let info = os_info::get();
    format!("{} {}", info.os_type(), info.version())
}

pub fn record_operation_log(
    conn: &rusqlite::Connection,
    username: &str,
    action_type: &str,
    action: &str,
    module: &str,
    detail: Option<&str>,
) {
    let id = uuid::Uuid::new_v4().to_string();
    let computer_name = get_computer_name();
    let ip_address = get_ip_address();
    let mac_address = get_mac_address();
    let os_info = get_os_info();
    let app_version = env!("CARGO_PKG_VERSION").to_string();
    let detail_val = detail.unwrap_or("");

    let _ = conn.execute(
        "INSERT INTO operation_logs (id, username, action_type, action, module, detail, computer_name, ip_address, mac_address, os_info, app_version) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![id, username, action_type, action, module, detail_val, computer_name, ip_address, mac_address, os_info, app_version],
    );
}

fn row_to_operation_log(row: &Row) -> Result<OperationLog, rusqlite::Error> {
    Ok(OperationLog {
        id: row.get(0)?,
        username: row.get(1)?,
        action_type: row.get(2).unwrap_or_default(),
        action: row.get(3)?,
        module: row.get(4).unwrap_or_default(),
        detail: row.get(5).unwrap_or_default(),
        computer_name: row.get(6).unwrap_or_default(),
        ip_address: row.get(7).unwrap_or_default(),
        mac_address: row.get(8).unwrap_or_default(),
        os_info: row.get(9).unwrap_or_default(),
        app_version: row.get(10).unwrap_or_default(),
        created_at: row.get(11)?,
    })
}

#[tauri::command]
pub fn get_operation_logs(db: tauri::State<'_, DbState>, token: String, params: GetOperationLogsParams) -> Result<GetOperationLogsResult, String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
    ctx.require_permission("system_log")?;

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let mut where_clauses = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref kw) = params.keyword {
        if !kw.is_empty() {
            where_clauses.push("username LIKE ?".to_string());
            let pattern = format!("%{}%", kw);
            param_values.push(Box::new(pattern));
        }
    }

    if let Some(ref at) = params.action_type {
        if !at.is_empty() {
            where_clauses.push("action_type = ?".to_string());
            param_values.push(Box::new(at.clone()));
        }
    }

    if let Some(ref m) = params.module {
        if !m.is_empty() {
            where_clauses.push("module = ?".to_string());
            param_values.push(Box::new(m.clone()));
        }
    }

    if let Some(ref sd) = params.start_date {
        if !sd.is_empty() {
            where_clauses.push("created_at >= ?".to_string());
            param_values.push(Box::new(sd.clone()));
        }
    }

    if let Some(ref ed) = params.end_date {
        if !ed.is_empty() {
            where_clauses.push("created_at <= ?".to_string());
            param_values.push(Box::new(format!("{} 23:59:59", ed)));
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM operation_logs {}", where_sql);
    let count_params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let total: i32 = conn.query_row(&count_sql, count_params.as_slice(), |row| row.get(0)).unwrap_or(0);

    let query_sql = format!(
        "SELECT id, username, action_type, action, module, detail, computer_name, ip_address, mac_address, os_info, app_version, created_at FROM operation_logs {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );

    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = param_values;
    all_params.push(Box::new(page_size));
    all_params.push(Box::new(offset));
    let query_params: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&query_sql).map_err(|e| translate_db_error(e))?;
    let items: Vec<OperationLog> = stmt
        .query_map(query_params.as_slice(), |row| row_to_operation_log(row))
        .map_err(|e| translate_db_error(e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(GetOperationLogsResult { items, total })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct DeleteOperationLogsParams {
    pub ids: Vec<String>,
}

#[tauri::command]
pub fn delete_operation_logs(db: tauri::State<'_, DbState>, token: String, params: DeleteOperationLogsParams) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
    ctx.require_permission("system_log:delete")?;

    if params.ids.is_empty() {
        return Ok(serde_json::json!({ "deleted_count": 0 }));
    }

    let placeholders: Vec<&str> = params.ids.iter().map(|_| "?").collect();
    let sql = format!("DELETE FROM operation_logs WHERE id IN ({})", placeholders.join(", "));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    let deleted = conn.execute(&sql, param_refs.as_slice()).map_err(|e| translate_db_error(e))?;

    Ok(serde_json::json!({ "deleted_count": deleted }))
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RecordPageViewParams {
    pub page_name: String,
    pub module: String,
}

#[tauri::command]
pub fn record_page_view(db: tauri::State<'_, DbState>, token: String, params: RecordPageViewParams) -> Result<(), String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;

    record_operation_log(
        &conn,
        &ctx.username,
        "view",
        &format!("打开{}", params.page_name),
        &params.module,
        None,
    );

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CleanOperationLogsParams {
    pub start_date: String,
    pub end_date: String,
}

#[tauri::command]
pub fn clean_operation_logs(db: tauri::State<'_, DbState>, token: String, params: CleanOperationLogsParams) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;

    let ctx = verify_and_get_context(&conn, &token)?;
    ctx.require_permission("system_log:delete")?;

    let end_with_time = format!("{} 23:59:59", params.end_date);
    let deleted = conn.execute(
        "DELETE FROM operation_logs WHERE created_at >= ?1 AND created_at <= ?2",
        params![params.start_date, end_with_time],
    ).map_err(|e| translate_db_error(e))?;

    Ok(serde_json::json!({ "deleted_count": deleted }))
}
