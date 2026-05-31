/** @file 数据库管理 - SQLite初始化、连接管理、版本化迁移 */

use rusqlite::Connection;
use std::sync::Mutex;

pub type DbState = Mutex<Option<Connection>>;

pub fn init_database(db_path: &str) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("设置数据库模式失败: {}", e))?;

    migrate(&conn)?;

    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<(), String> {
    let version: i32 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .unwrap_or(0);

    if version < 1 {
        migrate_v1(conn)?;
    }
    if version < 2 {
        migrate_v2(conn)?;
    }
    if version < 3 {
        migrate_v3(conn)?;
    }
    if version < 8 {
        migrate_v8(conn)?;
    }

    Ok(())
}

fn migrate_v1(conn: &Connection) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            real_name TEXT NOT NULL DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT,
            avatar TEXT DEFAULT '',
            status INTEGER NOT NULL DEFAULT 1,
            last_login_at TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
            id TEXT PRIMARY KEY,
            role_name TEXT NOT NULL,
            permission_key TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            UNIQUE(role_name, permission_key)
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            action TEXT NOT NULL,
            module TEXT NOT NULL DEFAULT '',
            detail TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );"
    ).map_err(|e| format!("v1迁移失败: {}", e))?;

    let admin_id = uuid::Uuid::new_v4().to_string();
    let hashed_pwd = crate::auth::hash_password("admin123");
    tx.execute(
        "INSERT INTO users (id, username, password_hash, real_name, status) VALUES (?1, ?2, ?3, '系统管理员', 1)",
        rusqlite::params![admin_id, "admin", hashed_pwd],
    ).map_err(|e| format!("创建默认用户失败: {}", e))?;

    let perms = ["dashboard", "permission", "user_manage", "settings"];
    for perm in perms {
        let perm_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO role_permissions (id, role_name, permission_key) VALUES (?1, 'admin', ?2)",
            rusqlite::params![perm_id, perm],
        ).map_err(|e| format!("创建默认权限失败: {}", e))?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    conn.pragma_update(None, "user_version", 1).map_err(|e| e.to_string())?;
    Ok(())
}

fn migrate_v2(conn: &Connection) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            is_system INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS user_roles (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            UNIQUE(user_id, role_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);"
    ).map_err(|e| format!("v2迁移失败(建表): {}", e))?;

    let admin_role_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO roles (id, name, description, is_system) VALUES (?1, 'admin', '系统管理员', 1)",
        rusqlite::params![admin_role_id],
    ).map_err(|e| format!("v2迁移失败(创建admin角色): {}", e))?;

    let _ = tx.execute(
        "ALTER TABLE role_permissions ADD COLUMN role_id TEXT",
        rusqlite::params![],
    );

    tx.execute(
        "UPDATE role_permissions SET role_id = ?1 WHERE role_name = 'admin'",
        rusqlite::params![admin_role_id],
    ).map_err(|e| format!("v2迁移失败(迁移admin权限): {}", e))?;

    let user_role_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO user_roles (id, user_id, role_id) SELECT ?1, u.id, ?2 FROM users u WHERE u.username = 'admin'",
        rusqlite::params![user_role_id, admin_role_id],
    ).map_err(|e| format!("v2迁移失败(关联admin用户角色): {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    conn.pragma_update(None, "user_version", 2).map_err(|e| e.to_string())?;
    Ok(())
}

/// v3: 扩展 operation_logs 表，添加操作类型和客户端信息字段
fn migrate_v3(conn: &Connection) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let _ = tx.execute_batch(
        "ALTER TABLE operation_logs ADD COLUMN action_type TEXT NOT NULL DEFAULT '';
         ALTER TABLE operation_logs ADD COLUMN computer_name TEXT NOT NULL DEFAULT '';
         ALTER TABLE operation_logs ADD COLUMN ip_address TEXT NOT NULL DEFAULT '';
         ALTER TABLE operation_logs ADD COLUMN mac_address TEXT NOT NULL DEFAULT '';
         ALTER TABLE operation_logs ADD COLUMN os_info TEXT NOT NULL DEFAULT '';
         ALTER TABLE operation_logs ADD COLUMN app_version TEXT NOT NULL DEFAULT '';"
    );

    tx.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_logs_username ON operation_logs(username);
         CREATE INDEX IF NOT EXISTS idx_logs_action_type ON operation_logs(action_type);
         CREATE INDEX IF NOT EXISTS idx_logs_module ON operation_logs(module);
         CREATE INDEX IF NOT EXISTS idx_logs_created_at ON operation_logs(created_at);"
    ).map_err(|e| format!("v3迁移失败(索引): {}", e))?;

    let perm_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT OR IGNORE INTO role_permissions (id, role_name, permission_key) VALUES (?1, 'admin', 'system_log')",
        rusqlite::params![perm_id],
    ).map_err(|e| format!("v3迁移失败(权限): {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    conn.pragma_update(None, "user_version", 3).map_err(|e| e.to_string())?;
    Ok(())
}

/// v8: 补全 operation_logs 表缺失的字段（处理版本号跳跃的历史遗留问题）
/// 场景：数据库版本已为7（之前开发过程中版本号被推高），但 v3 迁移从未成功执行，
/// 导致 operation_logs 表缺少 action_type、computer_name 等字段和 system_log 权限。
/// 此迁移逐列检查并补全，确保表结构完整。
fn migrate_v8(conn: &Connection) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let existing_cols = get_table_columns(&tx, "operation_logs");

    let new_columns = [
        ("action_type", "TEXT NOT NULL DEFAULT ''"),
        ("computer_name", "TEXT NOT NULL DEFAULT ''"),
        ("ip_address", "TEXT NOT NULL DEFAULT ''"),
        ("mac_address", "TEXT NOT NULL DEFAULT ''"),
        ("os_info", "TEXT NOT NULL DEFAULT ''"),
        ("app_version", "TEXT NOT NULL DEFAULT ''"),
    ];

    for (col_name, col_type) in new_columns {
        if !existing_cols.contains(&col_name.to_string()) {
            let sql = format!("ALTER TABLE operation_logs ADD COLUMN {} {}", col_name, col_type);
            tx.execute_batch(&sql).map_err(|e| format!("v8迁移失败(添加{}列): {}", col_name, e))?;
        }
    }

    tx.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_logs_username ON operation_logs(username);
         CREATE INDEX IF NOT EXISTS idx_logs_action_type ON operation_logs(action_type);
         CREATE INDEX IF NOT EXISTS idx_logs_module ON operation_logs(module);
         CREATE INDEX IF NOT EXISTS idx_logs_created_at ON operation_logs(created_at);"
    ).map_err(|e| format!("v8迁移失败(索引): {}", e))?;

    let perm_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT OR IGNORE INTO role_permissions (id, role_name, permission_key) VALUES (?1, 'admin', 'system_log')",
        rusqlite::params![perm_id],
    ).map_err(|e| format!("v8迁移失败(权限): {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    conn.pragma_update(None, "user_version", 8).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_table_columns(conn: &rusqlite::Connection, table: &str) -> Vec<String> {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    stmt.query_map([], |row| row.get::<_, String>(1))
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}
