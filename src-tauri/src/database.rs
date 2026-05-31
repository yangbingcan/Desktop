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
    }

    if version < 2 {
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
    }

    Ok(())
}
