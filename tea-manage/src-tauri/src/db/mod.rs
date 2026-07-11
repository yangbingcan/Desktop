//! 数据库模块
//! 
//! 管理数据库连接、初始化、迁移等核心功能

mod queries;
mod schema;

use rusqlite::Connection;
use std::sync::Mutex;

/// 数据库连接管理器
/// 
/// 使用 Mutex 确保线程安全，支持单写多读模式
pub struct Database {
    /// 数据库连接，使用互斥锁保护
    conn: Mutex<Connection>,
}

impl Database {
    /// 创建或打开数据库
    /// 
    /// # Arguments
    /// * `path` - 数据库文件路径
    /// 
    /// # Returns
    /// * `Result<Database, String>` - 成功返回 Database 实例，失败返回错误信息
    pub fn new(path: &str) -> Result<Self, String> {
        // 打开数据库连接
        let conn = Connection::open(path)
            .map_err(|e| format!("无法打开数据库: {}", e))?;
        
        // 启用外键约束
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| format!("无法启用外键约束: {}", e))?;

        // 启用 WAL 模式，提升并发读写性能
        conn.execute_batch("PRAGMA journal_mode = WAL;")
            .map_err(|e| format!("无法启用 WAL 模式: {}", e))?;
        
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    /// 获取数据库连接的只读引用
    ///
    /// # Returns
    /// * `Result<MutexGuard<Connection>, String>` - 成功返回连接锁guard，失败返回错误
    pub fn get_conn(&self) -> Result<std::sync::MutexGuard<Connection>, String> {
        self.conn.lock()
            .map_err(|e| format!("无法获取数据库连接: {}", e))
    }

    /// 创建测试用数据库（包装已有的 Connection）
    ///
    /// 仅用于单元测试，允许传入内存数据库或预填充数据的连接。
    /// 不启用 WAL 模式（in-memory 模式不支持），不启用外键约束（默认即为 OFF）。
    ///
    /// # Arguments
    /// * `conn` - 已初始化的 SQLite 连接
    ///
    /// # Returns
    /// * `Database` - 包装后的 Database 实例
    pub fn new_for_test(conn: Connection) -> Self {
        Database {
            conn: Mutex::new(conn),
        }
    }

    /// 初始化数据库（创建表、索引等）
    /// 
    /// # Returns
    /// * `Result<(), String>` - 成功返回空，失败返回错误
    pub fn init(&self) -> Result<(), String> {
        let conn = self.get_conn()?;
        schema::run_migrations(&conn).map_err(|e| e.to_string())?;
        schema::init_categories(&conn).map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// 重导出查询构建器
pub use queries::*;
/// 重导出建表语句
pub use schema::*;
