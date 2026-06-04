//! 错误工具 - Rust错误中文化翻译 + RPC公共辅助函数

use rusqlite::Error as SqliteError;
use rusqlite::ErrorCode;

/// 从RPC参数JSON中提取字符串字段（服务端模式共用）
#[cfg(feature = "server")]
pub fn arg_str(args: &serde_json::Value, key: &str) -> String {
    args.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string()
}

/// 将rusqlite错误翻译为中文，使用错误码匹配而非字符串匹配
pub fn translate_db_error(e: SqliteError) -> String {
    match &e {
        SqliteError::SqliteFailure(err, msg) => {
            match err.code {
                ErrorCode::ConstraintViolation => {
                    // 根据扩展码判断具体约束类型
                    // SQLite扩展码: 787=NOT NULL, 2067=UNIQUE, 2323=FOREIGN KEY
                    let extended = err.extended_code;
                    if extended == 787 {
                        return "必填字段不能为空".to_string();
                    }
                    if extended == 2067 {
                        let detail = msg.as_deref().unwrap_or("");
                        if detail.contains("username") {
                            return "用户名已存在".to_string();
                        }
                        return "数据重复，违反唯一约束".to_string();
                    }
                    if extended == 2323 {
                        return "关联数据不存在".to_string();
                    }
                    // 通用约束违反
                    let detail = msg.as_deref().unwrap_or("");
                    if detail.contains("username") {
                        return "用户名已存在".to_string();
                    }
                    "数据重复，违反唯一约束".to_string()
                }
                _ => format!("数据库错误: {}", e)
            }
        }
        SqliteError::InvalidColumnName(_) |
        SqliteError::InvalidParameterName(_) |
        SqliteError::InvalidColumnType(_, _, _) => {
            format!("数据库错误: {}", e)
        }
        _ => {
            // 检查是否为"表不存在"等特殊情况
            let msg = e.to_string();
            if msg.contains("no such table") {
                return "数据库表不存在，请检查迁移".to_string();
            }
            format!("数据库错误: {}", msg)
        }
    }
}

// ========== 单元测试 ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_约束违反_not_null() {
        // SQLite扩展码787 = NOT NULL约束违反
        let err = SqliteError::SqliteFailure(
            rusqlite::ffi::Error::new(787),
            Some("NOT NULL constraint failed".to_string()),
        );
        let msg = translate_db_error(err);
        assert!(msg.contains("必填字段"), "NOT NULL错误应翻译为'必填字段'，实际: {}", msg);
    }

    #[test]
    fn test_约束违反_unique用户名() {
        // SQLite扩展码2067 = UNIQUE约束违反，包含username
        let err = SqliteError::SqliteFailure(
            rusqlite::ffi::Error::new(2067),
            Some("UNIQUE constraint failed: users.username".to_string()),
        );
        let msg = translate_db_error(err);
        assert!(msg.contains("用户名已存在"), "UNIQUE+username应翻译为'用户名已存在'，实际: {}", msg);
    }

    #[test]
    fn test_约束违反_unique通用() {
        // SQLite扩展码2067 = UNIQUE约束违反，不含username
        let err = SqliteError::SqliteFailure(
            rusqlite::ffi::Error::new(2067),
            Some("UNIQUE constraint failed: roles.name".to_string()),
        );
        let msg = translate_db_error(err);
        assert!(msg.contains("唯一约束"), "通用UNIQUE错误应包含'唯一约束'，实际: {}", msg);
    }

    #[test]
    fn test_约束违反_外键() {
        // SQLite扩展码2323 = FOREIGN KEY约束违反
        let err = SqliteError::SqliteFailure(
            rusqlite::ffi::Error::new(2323),
            Some("FOREIGN KEY constraint failed".to_string()),
        );
        let msg = translate_db_error(err);
        assert!(msg.contains("关联数据不存在"), "外键错误应翻译为'关联数据不存在'，实际: {}", msg);
    }

    #[test]
    fn test_其他数据库错误() {
        // 非约束违反的错误码（DatabaseBusy = 5）
        let err = SqliteError::SqliteFailure(
            rusqlite::ffi::Error::new(5),
            None,
        );
        let msg = translate_db_error(err);
        assert!(msg.contains("数据库错误"), "其他错误应包含'数据库错误'前缀，实际: {}", msg);
    }

    #[test]
    fn test_无效列名错误() {
        let err = SqliteError::InvalidColumnName("nonexistent".to_string());
        let msg = translate_db_error(err);
        assert!(msg.contains("数据库错误"), "无效列名应翻译为数据库错误，实际: {}", msg);
    }

    #[test]
    fn test_无效列类型错误() {
        let err = SqliteError::InvalidColumnType(0, "col".to_string(), rusqlite::types::Type::Null);
        let msg = translate_db_error(err);
        assert!(msg.contains("数据库错误"), "无效列类型应翻译为数据库错误，实际: {}", msg);
    }
}
