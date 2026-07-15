/** @file 系统配置 - 公司信息CRUD、Logo上传、数据库备份恢复、系统信息查询 */
use crate::auth::verify_and_get_context;
use crate::database::{DbState, get_conn, recreate_pool};
use crate::error_util::translate_db_error;
use crate::models::*;
use crate::operation_logs::record_operation_log;
use rusqlite::params;
use std::path::Path;
use tauri::{Manager, State};

/// 验证路径安全性：防止 SQL 注入和路径遍历
/// VACUUM INTO 不支持参数化，必须手动校验路径
fn validate_db_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("路径不能为空".to_string());
    }

    let p = Path::new(path);

    // 必须有扩展名
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext.to_lowercase() != "db" {
        return Err("备份文件必须以 .db 为扩展名".to_string());
    }

    // 禁止路径遍历
    let canonical = p
        .canonicalize()
        .or_else(|_| {
            // 文件可能不存在（新建备份），尝试规范父目录
            if let Some(parent) = p.parent() {
                parent.canonicalize()
            } else {
                Err(std::io::Error::new(std::io::ErrorKind::NotFound, "parent"))
            }
        })
        .map_err(|e| format!("路径无效: {}", e))?;

    let _ = canonical;

    // 额外检查：路径中不应包含 SQL 特殊字符组合
    if path.contains('\0') {
        return Err("路径包含非法字符".to_string());
    }

    Ok(())
}

/// 安全执行 VACUUM INTO：路径经过验证后，用转义单引号
fn safe_vacuum_into(conn: &rusqlite::Connection, dest_path: &str) -> Result<(), String> {
    validate_db_path(dest_path)?;
    // SQLite 字符串中单引号通过双写转义
    let escaped = dest_path.replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}'", escaped))
        .map_err(|e| format!("备份失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_system_config(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token: String,
    keys: Vec<String>,
) -> Result<GetSystemConfigResult, String> {
    let conn = get_conn(&db)?;
    let ctx = verify_and_get_context(&conn, &token)?;
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

#[tauri::command]
pub fn save_system_config(
    db: State<'_, DbState>,
    token: String,
    configs: std::collections::HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let ctx = verify_and_get_context(&conn, &token)?;
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

#[tauri::command]
pub fn upload_company_logo(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token: String,
    source_path: String,
) -> Result<UploadLogoResult, String> {
    let conn = get_conn(&db)?;
    let ctx = verify_and_get_context(&conn, &token)?;
    ctx.require_permission("settings")?;

    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("源文件不存在".to_string());
    }

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    if !["jpg", "jpeg", "png", "svg"].contains(&ext.as_str()) {
        return Err("仅支持 JPG、PNG、SVG 格式".to_string());
    }

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

#[tauri::command]
pub fn backup_database(
    db: State<'_, DbState>,
    token: String,
    dest_path: String,
) -> Result<BackupDatabaseResult, String> {
    let conn = get_conn(&db)?;
    let ctx = verify_and_get_context(&conn, &token)?;
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

#[tauri::command]
pub fn restore_database(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token: String,
    source_path: String,
) -> Result<RestoreDatabaseResult, String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("备份文件不存在".to_string());
    }

    // 验证备份文件完整性
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

    // 第一阶段：鉴权 + 自动备份当前数据库
    {
        let conn = get_conn(&db)?;
        let ctx = verify_and_get_context(&conn, &token)?;
        ctx.require_permission("settings")?;

        safe_vacuum_into(&conn, &backup_path_str)?;

        record_operation_log(
            &conn,
            &ctx.username,
            "restore",
            "恢复数据库",
            "settings",
            Some(&source_path),
        );
    }
    // conn 在此处归还到连接池

    // 第二阶段：关闭连接池，替换数据库文件
    {
        let mut lock = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
        *lock = None; // 丢弃连接池，关闭所有空闲连接
    }

    let copy_result = std::fs::copy(&source_path, &db_path);
    match copy_result {
        Ok(_) => {
            let _ = std::fs::remove_file(&backup_path);

            // 第三阶段：重建连接池
            let new_pool = recreate_pool(db_path.to_str().unwrap_or(""))?;
            {
                let mut lock = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
                *lock = Some(new_pool);
            }

            Ok(RestoreDatabaseResult {
                success: true,
                need_restart: true,
            })
        }
        Err(e) => {
            // 恢复失败：从自动备份还原
            let _ = std::fs::copy(&backup_path, &db_path);
            let _ = std::fs::remove_file(&backup_path);

            // 重建连接池
            let new_pool = recreate_pool(db_path.to_str().unwrap_or(""))
                .unwrap_or_else(|_| {
                    // 如果重建也失败，至少让应用能启动
                    use r2d2::Pool;
                    use r2d2_sqlite::SqliteConnectionManager;
                    let manager = SqliteConnectionManager::file(&db_path);
                    Pool::builder().max_size(1).build(manager).unwrap()
                });
            {
                let mut lock = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
                *lock = Some(new_pool);
            }

            Err(format!("恢复数据库失败，已还原原始数据: {}", e))
        }
    }
}

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

#[tauri::command]
pub fn get_system_info(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token: String,
) -> Result<SystemInfo, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

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

#[tauri::command]
pub fn get_storage_info(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    token: String,
) -> Result<StorageInfo, String> {
    let conn = get_conn(&db)?;
    let ctx = verify_and_get_context(&conn, &token)?;
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
