//! 单元测试辅助模块 - 提供内存SQLite数据库创建和初始化

use rusqlite::Connection;

/// 创建测试用内存数据库（复用database模块的初始化和迁移逻辑）
pub fn create_test_db() -> Connection {
    crate::database::init_database(":memory:").expect("测试数据库初始化失败")
}
