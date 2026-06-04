//! 数据库管理 - SQLite初始化、连接管理、版本化迁移

use rusqlite::Connection;
use std::sync::Mutex;

/// 数据库状态：Mutex包装的可选Connection
pub type DbState = Mutex<Option<Connection>>;

/// Token签名密钥类型，在应用启动时随机生成
pub type TokenSecret = Vec<u8>;

/// 获取数据库连接引用，直接返回可解引用的ConnRef，无需手动unwrap
/// 通过Deref实现自动解引用为&Connection，使用时需以&conn形式传参
pub struct ConnRef<'a> {
    guard: std::sync::MutexGuard<'a, Option<Connection>>,
}

impl<'a> std::ops::Deref for ConnRef<'a> {
    type Target = Connection;
    fn deref(&self) -> &Self::Target {
        self.guard.as_ref().unwrap()
    }
}

/// 获取数据库连接引用，直接返回可解引用的ConnRef，无需手动unwrap
pub fn get_conn_ref<'a>(db: &'a DbState) -> Result<ConnRef<'a>, String> {
    let guard = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    if guard.is_none() {
        return Err("数据库未初始化".to_string());
    }
    Ok(ConnRef { guard })
}

pub fn init_database(db_path: &str) -> Result<Connection, String> {
    // 一次性清理：删除旧数据库重建（密码哈希从SHA-256迁移到bcrypt）
    // 重建后新数据库版本为8，此条件不再触发
    if std::path::Path::new(db_path).exists() {
        let conn_check = Connection::open(db_path).ok();
        if let Some(conn) = conn_check {
            let version: i32 = conn
                .pragma_query_value(None, "user_version", |r| r.get(0))
                .unwrap_or(0);
            drop(conn);
            // 旧数据库（版本号小于8），删除重建
            if version < 8 {
                println!("检测到旧版本数据库(v{})，将重建数据库", version);
                if let Err(e) = std::fs::remove_file(db_path) {
                    return Err(format!("删除旧数据库失败，请手动删除后重启: {}", e));
                }
                // -shm和-wal文件可能不存在，忽略错误
                let _ = std::fs::remove_file(format!("{}-shm", db_path));
                let _ = std::fs::remove_file(format!("{}-wal", db_path));
            }
        }
    }

    let conn = Connection::open(db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("设置数据库模式失败: {}", e))?;

    migrate(&conn)?;

    Ok(conn)
}

pub fn migrate(conn: &Connection) -> Result<(), String> {
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
    // 注意：v4-v7版本号在早期开发中被推高但未实际执行迁移，
    // 因此直接跳到v8处理补全逻辑，详见migrate_v8注释
    if version < 8 {
        migrate_v8(conn)?;
    }
    if version < 9 {
        migrate_v9(conn)?;
    }
    if version < 10 {
        migrate_v10(conn)?;
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
            must_change_password INTEGER NOT NULL DEFAULT 0,
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
    // 生成随机默认密码，首次登录后强制修改
    let default_password = generate_random_password();
    let hashed_pwd = crate::auth::hash_password(&default_password).expect("默认密码哈希失败");
    tx.execute(
        "INSERT INTO users (id, username, password_hash, real_name, status, must_change_password) VALUES (?1, ?2, ?3, '系统管理员', 1, 1)",
        rusqlite::params![admin_id, "admin", hashed_pwd],
    ).map_err(|e| format!("创建默认用户失败: {}", e))?;

    // 将默认密码输出到控制台，管理员首次启动时可见
    println!("============================================");
    println!("  管用GL 初始管理员账号信息");
    println!("  用户名: admin");
    println!("  密码: {}", default_password);
    println!("  首次登录后必须修改密码");
    println!("============================================");

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

/// v9: 添加用户密码版本字段，用于Token主动注销
fn migrate_v9(conn: &Connection) -> Result<(), String> {
    let existing_cols = get_table_columns(conn, "users");
    if !existing_cols.contains(&"password_version".to_string()) {
        conn.execute_batch(
            "ALTER TABLE users ADD COLUMN password_version INTEGER NOT NULL DEFAULT 1;"
        ).map_err(|e| format!("v9迁移失败(添加password_version列): {}", e))?;
    }
    conn.pragma_update(None, "user_version", 9).map_err(|e| e.to_string())?;
    Ok(())
}

/// v10: 添加must_change_password字段，支持首次登录强制修改密码
fn migrate_v10(conn: &Connection) -> Result<(), String> {
    let existing_cols = get_table_columns(conn, "users");
    if !existing_cols.contains(&"must_change_password".to_string()) {
        conn.execute_batch(
            "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("v10迁移失败(添加must_change_password列): {}", e))?;
    }
    conn.pragma_update(None, "user_version", 10).map_err(|e| e.to_string())?;
    Ok(())
}

/// 生成8位随机密码（包含大小写字母和数字）
pub fn generate_random_password() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let uppercase = b"ABCDEFGHJKLMNPQRSTUVWXYZ"; // 25个大写（去掉I）
    let lowercase = b"abcdefghjkmnpqrstuvwxyz";   // 21个小写（去掉l）
    let digits = b"23456789";                     // 8个数字
    // 确保至少1个大写、1个小写、1个数字
    let mut chars: Vec<u8> = Vec::new();
    chars.push(uppercase[rng.gen_range(0..uppercase.len())]);
    chars.push(lowercase[rng.gen_range(0..lowercase.len())]);
    chars.push(digits[rng.gen_range(0..digits.len())]);
    // 剩余5位随机
    let all_chars: Vec<u8> = uppercase.iter().chain(lowercase.iter()).chain(digits.iter()).copied().collect();
    for _ in 0..5 {
        chars.push(all_chars[rng.gen_range(0..all_chars.len())]);
    }
    // 打乱顺序
    for i in (1..chars.len()).rev() {
        let j = rng.gen_range(0..=i);
        chars.swap(i, j);
    }
    String::from_utf8(chars).unwrap_or_else(|_| "Admin@123".to_string())
}

fn get_table_columns(conn: &rusqlite::Connection, table: &str) -> Vec<String> {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    stmt.query_map([], |row| row.get::<_, String>(1))
        .ok()
        .map(|rows| rows.filter_map(|r| r.map_err(|e| eprintln!("数据库行解析警告: {}", e)).ok()).collect())
        .unwrap_or_default()
}


