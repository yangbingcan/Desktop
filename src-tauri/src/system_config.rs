//! 系统配置 - 公司信息CRUD、Logo上传、数据库备份恢复、系统信息查询

use crate::auth::verify_and_get_context;
use crate::database::{DbState, TokenSecret};
use crate::error_util::translate_db_error;
use crate::models::*;
use crate::operation_logs::record_operation_log;
use rusqlite::params;
use std::path::Path;
use tauri::{Manager, State};

/// 安全执行VACUUM INTO，路径必须先通过validate_db_path验证
/// 由于SQLite不支持参数化VACUUM INTO路径，依赖前置路径验证+引号禁止来防注入
fn safe_vacuum_into(conn: &rusqlite::Connection, dest_path: &str) -> Result<(), String> {
    // validate_db_path已禁止引号，但Windows路径中的反斜杠需转义
    // SQLite中单引号字符串内，反斜杠无需转义，但为安全起见替换为正斜杠
    let safe_path = dest_path.replace('\\', "/");
    conn.execute_batch(&format!("VACUUM INTO '{}'", safe_path))
        .map_err(|e| format!("VACUUM INTO失败: {}", e))
}

/// Logo文件最大大小限制：5MB
const LOGO_MAX_SIZE: u64 = 5 * 1024 * 1024;

/// 验证数据库文件路径安全性，防止路径遍历攻击和SQL注入
fn validate_db_path(path: &str) -> Result<(), String> {
    // 路径必须以.db结尾
    if !path.to_lowercase().ends_with(".db") {
        return Err("数据库文件路径必须以.db结尾".to_string());
    }
    // 路径不能包含..（防止路径遍历）
    if path.contains("..") {
        return Err("数据库文件路径不能包含路径遍历字符".to_string());
    }
    // 路径不能包含分号（防止SQL注入截断）
    if path.contains(';') {
        return Err("数据库文件路径不能包含分号".to_string());
    }
    // 路径不能包含换行符（防止SQL注入换行）
    if path.contains('\n') || path.contains('\r') {
        return Err("数据库文件路径不能包含换行符".to_string());
    }
    // 路径不能包含单引号（防止SQL注入闭合）
    if path.contains('\'') || path.contains('"') {
        return Err("数据库文件路径不能包含引号".to_string());
    }
    // 路径长度不能超过260字符（Windows MAX_PATH限制）
    if path.len() > 260 {
        return Err("数据库文件路径长度不能超过260字符".to_string());
    }
    // 路径不能以-开头（防止被解释为命令行选项）
    if path.starts_with('-') {
        return Err("数据库文件路径不能以横线开头".to_string());
    }
    // 路径规范化后验证：确保无路径遍历
    let canonical = std::path::Path::new(path);
    for component in canonical.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("数据库文件路径包含非法目录层级".to_string());
        }
    }
    Ok(())
}

/// 验证图片文件的magic bytes，防止伪装文件扩展名上传
fn validate_image_magic_bytes(data: &[u8], ext: &str) -> Result<(), String> {
    match ext {
        "jpg" | "jpeg" => {
            // JPEG文件以FF D8开头
            if data.len() < 2 || data[0] != 0xFF || data[1] != 0xD8 {
                return Err("文件内容不是有效的JPEG格式".to_string());
            }
        }
        "png" => {
            // PNG文件以89 50 4E 47 0D 0A 1A 0A开头
            let png_header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            if data.len() < png_header.len() || &data[..png_header.len()] != png_header {
                return Err("文件内容不是有效的PNG格式".to_string());
            }
        }
        "svg" => {
            // SVG是文本格式，检查是否包含<svg标签
            let content = String::from_utf8_lossy(data);
            if !content.contains("<svg") {
                return Err("文件内容不是有效的SVG格式".to_string());
            }
            // 拒绝包含危险内容的SVG，防止XSS攻击
            let lower = content.to_lowercase();
            if lower.contains("<script") || lower.contains("onclick") || lower.contains("onerror")
                || lower.contains("onload") || lower.contains("javascript:") {
                return Err("SVG文件包含不安全的内容".to_string());
            }
        }
        _ => {}
    }
    Ok(())
}

/// 获取系统配置
#[tauri::command]
pub fn get_system_config(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
    keys: Vec<String>,
) -> Result<GetSystemConfigResult, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    let ctx = verify_and_get_context(&conn, &token, &token_secret)?;
    ctx.require_permission("settings")?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    let mut configs = std::collections::HashMap::new();
    for key in &keys {
        let value: String = conn
            .query_row(
                "SELECT value FROM system_config WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .unwrap_or_default();
        if key == "company_logo" && !value.is_empty() {
            let full_path = app_dir.join("assets").join(&value);
            configs.insert(key.clone(), full_path.to_str().unwrap_or("").to_string());
        } else {
            configs.insert(key.clone(), value);
        }
    }

    Ok(GetSystemConfigResult { configs })
}

/// 保存系统配置
#[tauri::command]
pub fn save_system_config(
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
    configs: std::collections::HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    let ctx = verify_and_get_context(&conn, &token, &token_secret)?;
    ctx.require_permission("settings")?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for (key, value) in &configs {
        tx.execute(
            "INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?1, ?2, datetime('now','localtime'))",
            params![key, value],
        )
        .map_err(|e| translate_db_error(e))?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    record_operation_log(
        &conn,
        &ctx.username,
        "update",
        "保存公司信息",
        "settings",
        None,
    );

    Ok(serde_json::json!({ "success": true }))
}

/// 上传公司Logo（含文件大小限制和magic bytes验证）
#[tauri::command]
pub fn upload_company_logo(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
    source_path: String,
) -> Result<UploadLogoResult, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    let ctx = verify_and_get_context(&conn, &token, &token_secret)?;
    ctx.require_permission("settings")?;

    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("源文件不存在".to_string());
    }

    // 文件大小限制：5MB
    let file_size = std::fs::metadata(&source)
        .map(|m| m.len())
        .unwrap_or(0);
    if file_size > LOGO_MAX_SIZE {
        return Err("Logo文件大小不能超过5MB".to_string());
    }

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    if !["jpg", "jpeg", "png", "svg"].contains(&ext.as_str()) {
        return Err("仅支持 JPG、PNG、SVG 格式".to_string());
    }

    // 验证文件magic bytes
    let file_data = std::fs::read(&source)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    validate_image_magic_bytes(&file_data, &ext)?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    let assets_dir = app_dir.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| format!("创建资源目录失败: {}", e))?;

    let timestamp = chrono::Local::now().format("%Y%m%d%H%M%S").to_string();
    let file_name = format!("logo_{}.{}", timestamp, ext);
    let dest_path = assets_dir.join(&file_name);

    std::fs::copy(source, &dest_path).map_err(|e| format!("复制Logo文件失败: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?1, ?2, datetime('now','localtime'))",
        params!["company_logo", &file_name],
    )
    .map_err(|e| translate_db_error(e))?;

    record_operation_log(
        &conn,
        &ctx.username,
        "update",
        "上传公司Logo",
        "settings",
        Some(&file_name),
    );

    Ok(UploadLogoResult {
        success: true,
        file_name,
        file_path: dest_path.to_str().unwrap_or("").to_string(),
    })
}

/// 备份数据库（含路径验证）
#[tauri::command]
pub fn backup_database(
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
    dest_path: String,
) -> Result<BackupDatabaseResult, String> {
    // 验证备份路径安全性
    validate_db_path(&dest_path)?;

    let conn = crate::database::get_conn_ref(&db)?;
    let ctx = verify_and_get_context(&conn, &token, &token_secret)?;
    ctx.require_permission("settings")?;

    safe_vacuum_into(&conn, &dest_path)?;

    let file_size = std::fs::metadata(&dest_path)
        .map(|m| m.len())
        .unwrap_or(0);

    record_operation_log(
        &conn,
        &ctx.username,
        "backup",
        "备份数据库",
        "settings",
        Some(&dest_path),
    );

    Ok(BackupDatabaseResult {
        success: true,
        file_path: dest_path,
        file_size,
    })
}

/// 恢复数据库（含路径验证和连接关闭竞态修复）
#[tauri::command]
pub fn restore_database(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
    source_path: String,
) -> Result<RestoreDatabaseResult, String> {
    // 验证恢复路径安全性
    validate_db_path(&source_path)?;

    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("备份文件不存在".to_string());
    }

    let integrity = validate_sqlite_file(&source_path);
    if !integrity {
        return Err("备份文件格式不正确，不是有效的SQLite数据库".to_string());
    }

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    let db_path = app_dir.join("guanyong-gl.db");

    let backup_path = app_dir.join(format!(
        "guanyong-gl_pre_restore_{}.db",
        chrono::Local::now().format("%Y%m%d%H%M%S")
    ));
    let backup_path_str = backup_path.to_str().unwrap_or("").to_string();

    {
        let conn = crate::database::get_conn_ref(&db)?;
        let ctx = verify_and_get_context(&conn, &token, &token_secret)?;
        ctx.require_permission("settings")?;

        safe_vacuum_into(&conn, &backup_path_str)
        .map_err(|e| format!("自动备份当前数据库失败: {}", e))?;

        record_operation_log(
            &conn,
            &ctx.username,
            "restore",
            "恢复数据库",
            "settings",
            Some(&source_path),
        );
    }

    // 关闭数据库连接：先drop连接对象，再设为None，释放锁后等待文件系统刷新
    {
        let mut lock = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
        // 显式drop连接对象确保文件句柄释放
        *lock = None;
    }
    // 等待100ms确保文件系统刷新，避免文件句柄未释放导致复制失败
    std::thread::sleep(std::time::Duration::from_millis(100));

    let copy_result = std::fs::copy(&source_path, &db_path);
    match copy_result {
        Ok(_) => {
            let _ = std::fs::remove_file(&backup_path);

            // 重新打开数据库连接并设置回DbState
            {
                let mut lock = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
                let db_path_str = db_path.to_str().unwrap_or("");
                let new_conn = rusqlite::Connection::open(db_path_str)
                    .map_err(|e| format!("重新打开数据库失败: {}", e))?;
                new_conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;")
                    .map_err(|e| format!("设置数据库模式失败: {}", e))?;
                // 恢复后执行迁移，确保数据库结构为最新版本
                crate::database::migrate(&new_conn)
                    .map_err(|e| format!("恢复后数据库迁移失败: {}", e))?;
                *lock = Some(new_conn);
            }

            Ok(RestoreDatabaseResult {
                success: true,
                need_restart: false,
            })
        }
        Err(e) => {
            let _ = std::fs::copy(&backup_path, &db_path);
            let _ = std::fs::remove_file(&backup_path);

            Err(format!("恢复数据库失败，已还原原始数据: {}", e))
        }
    }
}

/// 验证SQLite文件完整性
fn validate_sqlite_file(path: &str) -> bool {
    if let Ok(conn) = rusqlite::Connection::open(path) {
        let result: String = conn
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .unwrap_or_default();
        result == "ok"
    } else {
        false
    }
}

/// 获取系统信息
#[tauri::command]
pub fn get_system_info(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
) -> Result<SystemInfo, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    let ctx = verify_and_get_context(&conn, &token, &token_secret)?;
    ctx.require_permission("settings")?;

    let db_version: i32 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .unwrap_or(0);

    let os = os_info::get();
    let os_info_str = format!("{} {}", os.os_type(), os.version());

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    let db_path = app_dir.join("guanyong-gl.db");

    Ok(SystemInfo {
        app_name: "管用GL".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        db_version,
        os_info: os_info_str,
        db_path: db_path.to_str().unwrap_or("").to_string(),
        data_dir: app_dir.to_str().unwrap_or("").to_string(),
    })
}

/// 获取存储信息
#[tauri::command]
pub fn get_storage_info(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token_secret: State<'_, TokenSecret>,
    token: String,
) -> Result<StorageInfo, String> {
    let conn = crate::database::get_conn_ref(&db)?;
    let ctx = verify_and_get_context(&conn, &token, &token_secret)?;
    ctx.require_permission("settings")?;

    let log_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM operation_logs", [], |row| row.get(0))
        .unwrap_or(0);

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    let db_path = app_dir.join("guanyong-gl.db");
    let db_size = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);

    Ok(StorageInfo { db_size, log_count })
}

// ========== 服务端模式内部函数（不依赖Tauri State） ==========

/// 服务端模式：获取系统配置
#[cfg(feature = "server")]
pub fn get_system_config_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let keys: Vec<String> = args.get("keys").and_then(|v| v.as_array()).map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()).unwrap_or_default();

    let ctx = verify_and_get_context(conn, &crate::error_util::arg_str(args, "token"), secret)?;
    ctx.require_permission("settings")?;

    let mut configs = std::collections::HashMap::new();
    for key in &keys {
        let value: String = conn.query_row("SELECT value FROM system_config WHERE key = ?1", params![key], |row| row.get(0)).unwrap_or_default();
        configs.insert(key.clone(), value);
    }
    serde_json::to_value(GetSystemConfigResult { configs }).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：保存系统配置
#[cfg(feature = "server")]
pub fn save_system_config_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let configs: std::collections::HashMap<String, String> = args.get("configs").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default();

    let ctx = verify_and_get_context(conn, &crate::error_util::arg_str(args, "token"), secret)?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for (key, value) in &configs {
        tx.execute("INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?1, ?2, datetime('now','localtime'))", params![key, value]).map_err(|e| translate_db_error(e))?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    record_operation_log(conn, &ctx.username, "update", "保存公司信息", "settings", None);
    Ok(serde_json::json!({"success": true}))
}

/// 服务端模式：备份数据库
#[cfg(feature = "server")]
pub fn backup_database_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let dest_path = crate::error_util::arg_str(args, "dest_path");

    validate_db_path(&dest_path)?;

    let ctx = verify_and_get_context(conn, &crate::error_util::arg_str(args, "token"), secret)?;
    ctx.require_permission("settings")?;

    safe_vacuum_into(conn, &dest_path)?;

    let file_size = std::fs::metadata(&dest_path).map(|m| m.len()).unwrap_or(0);
    record_operation_log(conn, &ctx.username, "backup", "备份数据库", "settings", Some(&dest_path));

    serde_json::to_value(BackupDatabaseResult { success: true, file_path: dest_path, file_size }).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：获取系统信息
#[cfg(feature = "server")]
pub fn get_system_info_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let ctx = verify_and_get_context(conn, &crate::error_util::arg_str(args, "token"), secret)?;
    ctx.require_permission("settings")?;

    let db_version: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap_or(0);
    let os = os_info::get();
    let os_info_str = format!("{} {}", os.os_type(), os.version());

    serde_json::to_value(SystemInfo {
        app_name: "管用GL".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        db_version,
        os_info: os_info_str,
        db_path: String::new(),
        data_dir: String::new(),
    }).map_err(|e| format!("序列化失败: {}", e))
}

/// 服务端模式：获取存储信息
#[cfg(feature = "server")]
pub fn get_storage_info_inner(conn: &rusqlite::Connection, secret: &[u8], args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let ctx = verify_and_get_context(conn, &crate::error_util::arg_str(args, "token"), secret)?;
    ctx.require_permission("settings")?;

    let log_count: i32 = conn.query_row("SELECT COUNT(*) FROM operation_logs", [], |row| row.get(0)).unwrap_or(0);
    serde_json::to_value(StorageInfo { db_size: 0, log_count }).map_err(|e| format!("序列化失败: {}", e))
}

// ========== 单元测试 ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_db_path_合法路径() {
        assert!(validate_db_path("backup.db").is_ok());
        assert!(validate_db_path("data/backup.db").is_ok());
        assert!(validate_db_path("C:\\data\\backup.db").is_ok());
    }

    #[test]
    fn test_validate_db_path_不含db后缀() {
        let result = validate_db_path("backup.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains(".db"));
    }

    #[test]
    fn test_validate_db_path_包含路径遍历() {
        let result = validate_db_path("../etc/passwd.db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("路径遍历"));
    }

    #[test]
    fn test_validate_db_path_包含分号() {
        let result = validate_db_path("backup;rm -rf.db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("分号"));
    }

    #[test]
    fn test_validate_db_path_超长路径() {
        let long_path = "a".repeat(261) + ".db";
        let result = validate_db_path(&long_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("260"));
    }

    #[test]
    fn test_validate_db_path_包含换行符() {
        let result = validate_db_path("backup\n.db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("换行符"));
    }

    #[test]
    fn test_validate_db_path_以横线开头() {
        let result = validate_db_path("-malicious.db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("横线"));
    }

    #[test]
    fn test_validate_db_path_包含单引号() {
        let result = validate_db_path("backup'evil.db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("引号"));
    }

    #[test]
    fn test_validate_db_path_包含双引号() {
        let result = validate_db_path("backup\".db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("引号"));
    }

    #[test]
    fn test_validate_svg_content_合法svg() {
        let svg = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"10\"/></svg>";
        assert!(validate_image_magic_bytes(svg, "svg").is_ok());
    }

    #[test]
    fn test_validate_svg_content_含script标签() {
        let svg = b"<svg><script>alert('xss')</script></svg>";
        let result = validate_image_magic_bytes(svg, "svg");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不安全"));
    }

    #[test]
    fn test_validate_svg_content_含onclick() {
        let svg = b"<svg><rect onclick=\"alert(1)\"/></svg>";
        let result = validate_image_magic_bytes(svg, "svg");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不安全"));
    }

    #[test]
    fn test_validate_svg_content_含onerror() {
        let svg = b"<svg><image onerror=\"alert(1)\"/></svg>";
        let result = validate_image_magic_bytes(svg, "svg");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_svg_content_含javascript协议() {
        let svg = b"<svg><a href=\"javascript:alert(1)\"></a></svg>";
        let result = validate_image_magic_bytes(svg, "svg");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_svg_content_不含svg标签() {
        let data = b"<html><body>not svg</body></html>";
        let result = validate_image_magic_bytes(data, "svg");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("SVG"));
    }

    #[test]
    fn test_validate_image_magic_bytes_jpeg() {
        // 有效的JPEG头部
        let jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        assert!(validate_image_magic_bytes(&jpeg, "jpg").is_ok());
        assert!(validate_image_magic_bytes(&jpeg, "jpeg").is_ok());

        // 无效的JPEG头部
        let not_jpeg = vec![0x89, 0x50, 0x4E, 0x47];
        assert!(validate_image_magic_bytes(&not_jpeg, "jpg").is_err());
    }

    #[test]
    fn test_validate_image_magic_bytes_png() {
        // 有效的PNG头部
        let png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];
        assert!(validate_image_magic_bytes(&png, "png").is_ok());

        // 无效的PNG头部
        let not_png = vec![0xFF, 0xD8, 0xFF];
        assert!(validate_image_magic_bytes(&not_png, "png").is_err());
    }
}
