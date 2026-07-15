/** @file 错误工具 - Rust错误中文化翻译 */

use rusqlite::Error as SqliteError;

pub fn translate_db_error(e: SqliteError) -> String {
    let msg = e.to_string();
    if msg.contains("UNIQUE constraint failed") {
        if msg.contains("username") {
            return "用户名已存在".to_string();
        }
        return "数据重复，违反唯一约束".to_string();
    }
    if msg.contains("NOT NULL constraint failed") {
        return "必填字段不能为空".to_string();
    }
    if msg.contains("FOREIGN KEY constraint failed") {
        return "关联数据不存在".to_string();
    }
    if msg.contains("no such table") {
        return "数据库表不存在，请检查迁移".to_string();
    }
    format!("数据库错误: {}", msg)
}
