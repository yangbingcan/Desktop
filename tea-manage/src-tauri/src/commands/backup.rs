//! 数据库备份 Tauri Command
//!
//! v0.7.0 新增：将当前 SQLite 数据库文件复制为带时间戳的备份副本，
//! 存放于应用数据目录下的 backups/ 子目录，替换设置页原「备份功能开发中」占位。
//!
//! 说明：单用户桌面场景下采用文件快照复制，简单可靠；若需在写入高峰备份，
//! 可后续改用 SQLite Online Backup API。

use crate::db::Database;
use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn backup_database(db: tauri::State<'_, Database>) -> Result<String, String> {
    let conn = db.get_conn()?;
    let db_path_str = conn
        .path()
        .ok_or_else(|| "无法获取数据库文件路径".to_string())?;
    let db_path = Path::new(db_path_str);
    let backup_dir = db_path
        .parent()
        .ok_or_else(|| "无法获取数据库目录".to_string())?
        .join("backups");
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let ts = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let dest = backup_dir.join(format!("tea_manage_backup_{}.db", ts));
    fs::copy(db_path, &dest).map_err(|e| format!("备份失败: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}
