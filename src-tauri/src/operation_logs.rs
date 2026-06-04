//! 操作日志 - 日志记录辅助函数、日志查询与清理

use crate::auth::verify_and_get_context;
use crate::database::{DbState, TokenSecret};
use crate::error_util::translate_db_error;
use crate::models::{GetOperationLogsParams, GetOperationLogsResult, OperationLog};
use rusqlite::{params, Row};
use std::sync::OnceLock;
use tauri::State;

/// 批量删除操作日志的最大数量限制
const DELETE_BATCH_LIMIT: usize = 1000;

/// 缓存的计算机名
static COMPUTER_NAME: OnceLock<String> = OnceLock::new();

/// 缓存的IP地址
static IP_ADDRESS: OnceLock<String> = OnceLock::new();

/// 缓存的MAC地址
static MAC_ADDRESS: OnceLock<String> = OnceLock::new();

/// 缓存的操作系统信息
static OS_INFO: OnceLock<String> = OnceLock::new();

/// 获取计算机名（首次调用后缓存）
fn get_computer_name() -> String {
    COMPUTER_NAME.get_or_init(|| {
        hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_default()
    }).clone()
}

/// 获取本机IP地址（首次调用后缓存）
fn get_ip_address() -> String {
    IP_ADDRESS.get_or_init(|| {
        local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_default()
    }).clone()
}

/// 获取MAC地址（首次调用后缓存）
fn get_mac_address() -> String {
    MAC_ADDRESS.get_or_init(|| {
        mac_address::get_mac_address()
            .map(|m| m.to_string().replace(':', ""))
            .unwrap_or_default()
    }).clone()
}

/// 获取操作系统信息（首次调用后缓存）
fn get_os_info() -> String {
    OS_INFO.get_or_init(|| {
        let info = os_info::get();
        format!("{} {}", info.os_type(), info.version())
    }).clone()
}

/// 记录操作日志（辅助函数，各模块调用）
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

    if let Err(e) = conn.execute(
        "INSERT INTO operation_logs (id, username, action_type, action, module, detail, computer_name, ip_address, mac_address, os_info, app_version) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![id, username, action_type, action, module, detail_val, computer_name, ip_address, mac_address, os_info, app_version],
    ) {
        eprintln!("记录操作日志失败: {}", e);
    }
}

/// 将数据库行映射为OperationLog
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

// ========== 业务逻辑函数（Tauri命令和服务端模式共用） ==========

#[derive(serde::Serialize, serde::Deserialize)]
pub struct DeleteOperationLogsParams {
    pub ids: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CleanOperationLogsParams {
    pub start_date: String,
    pub end_date: String,
}

/// 获取操作日志列表业务逻辑（分页+筛选）
pub fn get_operation_logs_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: GetOperationLogsParams) -> Result<GetOperationLogsResult, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
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
        .filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok())
        .collect();

    Ok(GetOperationLogsResult { items, total })
}

/// 批量删除操作日志业务逻辑（限制最多1000条）
pub fn delete_operation_logs_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: DeleteOperationLogsParams) -> Result<serde_json::Value, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("system_log:delete")?;

    if params.ids.is_empty() {
        return Ok(serde_json::json!({ "deleted_count": 0 }));
    }

    // 批量删除上限检查
    if params.ids.len() > DELETE_BATCH_LIMIT {
        return Err(format!("单次删除数量不能超过{}条", DELETE_BATCH_LIMIT));
    }

    let placeholders: Vec<&str> = params.ids.iter().map(|_| "?").collect();
    let sql = format!("DELETE FROM operation_logs WHERE id IN ({})", placeholders.join(", "));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    let deleted = conn.execute(&sql, param_refs.as_slice()).map_err(|e| translate_db_error(e))?;

    Ok(serde_json::json!({ "deleted_count": deleted }))
}

/// 按日期范围清理操作日志业务逻辑
pub fn clean_operation_logs_logic(conn: &rusqlite::Connection, secret: &[u8], token: &str, params: CleanOperationLogsParams) -> Result<serde_json::Value, String> {
    let ctx = verify_and_get_context(conn, token, secret)?;
    ctx.require_permission("system_log:delete")?;

    let end_with_time = format!("{} 23:59:59", params.end_date);
    let deleted = conn.execute(
        "DELETE FROM operation_logs WHERE created_at >= ?1 AND created_at <= ?2",
        params![params.start_date, end_with_time],
    ).map_err(|e| translate_db_error(e))?;

    Ok(serde_json::json!({ "deleted_count": deleted }))
}

// ========== Tauri命令（薄包装，调用_logic函数） ==========

/// 获取操作日志列表（分页+筛选）
#[tauri::command]
pub fn get_operation_logs(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: GetOperationLogsParams) -> Result<GetOperationLogsResult, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    get_operation_logs_logic(&conn, &token_secret, &token, params)
}

/// 批量删除操作日志（限制最多1000条）
#[tauri::command]
pub fn delete_operation_logs(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: DeleteOperationLogsParams) -> Result<serde_json::Value, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    delete_operation_logs_logic(&conn, &token_secret, &token, params)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RecordPageViewParams {
    pub page_name: String,
    pub module: String,
}

/// 记录页面访问日志
#[tauri::command]
pub fn record_page_view(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: RecordPageViewParams) -> Result<(), String> {
    let conn = crate::database::get_conn_ref(&db)?;

    let ctx = verify_and_get_context(&conn, &token, &token_secret)?;

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

/// 按日期范围清理操作日志
#[tauri::command]
pub fn clean_operation_logs(db: State<'_, DbState>, token_secret: State<'_, TokenSecret>, token: String, params: CleanOperationLogsParams) -> Result<serde_json::Value, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    clean_operation_logs_logic(&conn, &token_secret, &token, params)
}

// ========== 服务端模式内部函数（不依赖Tauri State） ==========

/// 服务端模式：获取操作日志列表
#[cfg(feature = "server")]
pub fn get_operation_logs_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: GetOperationLogsParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    let result = get_operation_logs_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)?;
    serde_json::to_value(result).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：批量删除操作日志
#[cfg(feature = "server")]
pub fn delete_operation_logs_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: DeleteOperationLogsParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    delete_operation_logs_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)
}

/// 服务端模式：按日期范围清理操作日志
#[cfg(feature = "server")]
pub fn clean_operation_logs_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let params: CleanOperationLogsParams = serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))?;
    clean_operation_logs_logic(conn, secret, &crate::error_util::arg_str(args, "token"), params)
}

/// 服务端模式：记录页面访问日志
#[cfg(feature = "server")]
pub fn record_page_view_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let ctx = verify_and_get_context(conn, &crate::error_util::arg_str(args, "token"), secret)?;
    record_operation_log(conn, &ctx.username, "view", &format!("打开{}", crate::error_util::arg_str(args, "page_name")), &crate::error_util::arg_str(args, "module"), None);
    Ok(serde_json::json!({"success": true}))
}
