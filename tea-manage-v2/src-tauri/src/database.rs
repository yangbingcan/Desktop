/** @file 数据库管理 - SQLite初始化、r2d2连接池、版本化迁移 */

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::sync::Mutex;

/// 数据库状态：Mutex 包裹的可选连接池
/// - Mutex 仅在获取 Pool 引用时短暂持有，实际查询使用独立的 PooledConnection
/// - Option 用于数据库恢复流程（恢复时置为 None）
pub type DbState = Mutex<Option<DbPool>>;

/// 连接池类型
pub type DbPool = Pool<SqliteConnectionManager>;

/// 连接池中的连接（Deref 到 rusqlite::Connection）
pub type PooledConn = r2d2::PooledConnection<SqliteConnectionManager>;

/// 从 Tauri State 中获取一个连接池连接
/// Mutex 仅在此函数内短暂持有，返回的 PooledConn 是独立拥有的
pub fn get_conn(db: &tauri::State<'_, DbState>) -> Result<PooledConn, String> {
    let pool = db
        .lock()
        .map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let pool = pool.as_ref().ok_or("数据库未初始化")?;
    pool.get()
        .map_err(|e| format!("获取数据库连接失败: {}", e))
}

pub fn init_database(db_path: &str) -> Result<DbPool, String> {
    let manager = SqliteConnectionManager::file(db_path).with_init(|c| {
        c.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
        )
    });

    let pool = Pool::builder()
        .max_size(8)
        .build(manager)
        .map_err(|e| format!("创建连接池失败: {}", e))?;

    // 在连接池中获取一个连接来执行迁移
    let conn = pool
        .get()
        .map_err(|e| format!("获取连接失败: {}", e))?;
    migrate(&conn)?;

    Ok(pool)
}

/// 为已有路径创建新连接池（用于数据库恢复后重建）
pub fn recreate_pool(db_path: &str) -> Result<DbPool, String> {
    init_database(db_path)
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
    // V2: 茶叶店业务表
    if version < 9 {
        migrate_v9_tea_tables(conn)?;
    }
    if version < 10 {
        migrate_v10_v2_fields(conn)?;
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
///
/// 注意：版本号 3→8 的跳跃是历史遗留（开发过程中版本号曾被推高到7）。
/// v3 和 v8 的迁移逻辑互补：v3 尝试批量 ALTER，v8 逐列检查补全。
/// 对于全新数据库，v3 会成功执行；对于历史遗留数据库，v3 可能因列已存在而失败，
/// v8 会兜底补全。
fn migrate_v3(conn: &Connection) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // 逐条执行 ALTER TABLE，跳过已存在的列（避免静默吞掉其他错误）
    let alter_statements = [
        "ALTER TABLE operation_logs ADD COLUMN action_type TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE operation_logs ADD COLUMN computer_name TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE operation_logs ADD COLUMN ip_address TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE operation_logs ADD COLUMN mac_address TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE operation_logs ADD COLUMN os_info TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE operation_logs ADD COLUMN app_version TEXT NOT NULL DEFAULT '';",
    ];

    for sql in alter_statements {
        match tx.execute_batch(sql) {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                // "duplicate column name" 表示列已存在，安全跳过
                if !msg.contains("duplicate column name") {
                    return Err(format!("v3迁移失败(ALTER TABLE): {}", e));
                }
            }
        }
    }

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

/// v9: 创建茶叶店业务表（商品/库存/会员/销售/采购/退货/供应商/打印模板）
///
/// 此迁移创建 V1 茶叶店管理系统的全部业务表，确保 V2 从零开始可用。
/// 对于从 V1 升级的数据库，CREATE TABLE IF NOT EXISTS 会安全跳过已存在的表。
fn migrate_v9_tea_tables(conn: &Connection) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS product_categories (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            parent_id TEXT,
            level INTEGER NOT NULL CHECK (level IN (1, 2)),
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_category_level ON product_categories(level);
        CREATE INDEX IF NOT EXISTS idx_category_parent ON product_categories(parent_id);

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY NOT NULL,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            category_id TEXT,
            product_type TEXT NOT NULL CHECK (product_type IN ('weight', 'count')),
            base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'pcs')),
            origin TEXT,
            year TEXT,
            grade TEXT,
            fermentation_level TEXT,
            roast_level TEXT,
            image_url TEXT,
            default_unit_id TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            stock_grams INTEGER NOT NULL DEFAULT 0,
            stock_units INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_code ON products(code);
        CREATE INDEX IF NOT EXISTS idx_product_category ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_product_type ON products(product_type);
        CREATE INDEX IF NOT EXISTS idx_product_name ON products(name);

        CREATE TABLE IF NOT EXISTS sales_units (
            id TEXT PRIMARY KEY NOT NULL,
            product_id TEXT NOT NULL,
            name TEXT NOT NULL,
            conversion_to_base INTEGER NOT NULL CHECK (conversion_to_base > 0),
            retail_price REAL NOT NULL CHECK (retail_price >= 0),
            member_price REAL NOT NULL CHECK (member_price >= 0),
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_unit_product ON sales_units(product_id);

        CREATE TABLE IF NOT EXISTS inventory_batches (
            id TEXT PRIMARY KEY NOT NULL,
            product_id TEXT NOT NULL,
            batch_code TEXT NOT NULL UNIQUE,
            purchase_price REAL NOT NULL DEFAULT 0,
            total_grams INTEGER NOT NULL DEFAULT 0,
            remaining_grams INTEGER NOT NULL DEFAULT 0,
            supplier_id TEXT,
            produced_date TEXT,
            expire_date TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_batch_product ON inventory_batches(product_id);
        CREATE INDEX IF NOT EXISTS idx_batch_code ON inventory_batches(batch_code);
        CREATE INDEX IF NOT EXISTS idx_batch_remaining ON inventory_batches(remaining_grams);

        CREATE TABLE IF NOT EXISTS stock_flow (
            id TEXT PRIMARY KEY NOT NULL,
            product_id TEXT NOT NULL,
            batch_id TEXT,
            flow_type TEXT NOT NULL CHECK (flow_type IN (
                'purchase_in', 'sale_out', 'damage_out', 'return_out', 'adjust_in', 'adjust_out'
            )),
            change_grams INTEGER NOT NULL DEFAULT 0,
            balance_grams INTEGER NOT NULL DEFAULT 0,
            order_id TEXT,
            remark TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_flow_product ON stock_flow(product_id);
        CREATE INDEX IF NOT EXISTS idx_flow_type ON stock_flow(flow_type);
        CREATE INDEX IF NOT EXISTS idx_flow_created ON stock_flow(created_at);

        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            gender TEXT,
            birthday TEXT,
            level TEXT NOT NULL DEFAULT 'normal' CHECK (level IN ('normal', 'silver', 'gold')),
            points INTEGER NOT NULL DEFAULT 0,
            balance REAL NOT NULL DEFAULT 0,
            total_consume REAL NOT NULL DEFAULT 0,
            consume_count INTEGER NOT NULL DEFAULT 0,
            last_visit TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_member_phone ON members(phone);
        CREATE INDEX IF NOT EXISTS idx_member_level ON members(level);

        CREATE TABLE IF NOT EXISTS member_preferences (
            id TEXT PRIMARY KEY NOT NULL,
            member_id TEXT NOT NULL UNIQUE,
            preferred_teas TEXT DEFAULT '[]',
            taste_preferences TEXT DEFAULT '[]',
            taboos TEXT DEFAULT '',
            brew_habits TEXT DEFAULT '',
            consumption_scenario TEXT DEFAULT '[]',
            remark TEXT DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sales_orders (
            id TEXT PRIMARY KEY NOT NULL,
            order_no TEXT NOT NULL UNIQUE,
            member_id TEXT,
            member_name TEXT,
            total_amount REAL NOT NULL DEFAULT 0,
            discount_amount REAL NOT NULL DEFAULT 0,
            points_deduct INTEGER NOT NULL DEFAULT 0,
            points_earned INTEGER NOT NULL DEFAULT 0,
            actual_amount REAL NOT NULL DEFAULT 0,
            pay_method TEXT,
            pay_status TEXT NOT NULL DEFAULT 'unpaid',
            status TEXT NOT NULL DEFAULT 'pending',
            remark TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sales_order_no ON sales_orders(order_no);
        CREATE INDEX IF NOT EXISTS idx_sales_member ON sales_orders(member_id);
        CREATE INDEX IF NOT EXISTS idx_sales_status ON sales_orders(status);
        CREATE INDEX IF NOT EXISTS idx_sales_created ON sales_orders(created_at);

        CREATE TABLE IF NOT EXISTS sales_items (
            id TEXT PRIMARY KEY NOT NULL,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_id TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0,
            grams INTEGER NOT NULL DEFAULT 0,
            subtotal REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (unit_id) REFERENCES sales_units(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_sales_item_order ON sales_items(order_id);

        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            contact_person TEXT,
            contact_phone TEXT,
            address TEXT,
            main_categories TEXT NOT NULL DEFAULT '[]',
            remark TEXT NOT NULL DEFAULT '',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_supplier_name ON suppliers(name);
        CREATE INDEX IF NOT EXISTS idx_supplier_active ON suppliers(is_active);

        CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY NOT NULL,
            order_no TEXT NOT NULL UNIQUE,
            supplier_id TEXT NOT NULL,
            handler TEXT,
            total_amount REAL NOT NULL DEFAULT 0,
            payment_status TEXT NOT NULL DEFAULT 'unpaid'
                CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
            remark TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_order_no ON purchase_orders(order_no);
        CREATE INDEX IF NOT EXISTS idx_purchase_supplier ON purchase_orders(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_date ON purchase_orders(created_at);

        CREATE TABLE IF NOT EXISTS purchase_items (
            id TEXT PRIMARY KEY NOT NULL,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_id TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            grams INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL,
            batch_id TEXT NOT NULL,
            batch_code TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_purchase_item_order ON purchase_items(order_id);

        CREATE TABLE IF NOT EXISTS return_orders (
            id TEXT PRIMARY KEY NOT NULL,
            order_no TEXT NOT NULL UNIQUE,
            supplier_id TEXT NOT NULL,
            return_date TEXT NOT NULL,
            return_reason TEXT NOT NULL,
            total_amount REAL NOT NULL DEFAULT 0,
            remark TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'completed',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_return_order_no ON return_orders(order_no);
        CREATE INDEX IF NOT EXISTS idx_return_supplier ON return_orders(supplier_id);

        CREATE TABLE IF NOT EXISTS return_items (
            id TEXT PRIMARY KEY NOT NULL,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_id TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            grams INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES return_orders(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_return_item_order ON return_items(order_id);

        CREATE TABLE IF NOT EXISTS return_sale_orders (
            id TEXT PRIMARY KEY NOT NULL,
            order_no TEXT NOT NULL UNIQUE,
            original_order_id TEXT NOT NULL,
            member_id TEXT,
            member_name TEXT,
            total_amount REAL NOT NULL DEFAULT 0,
            refund_amount REAL NOT NULL DEFAULT 0,
            points_reversed INTEGER NOT NULL DEFAULT 0,
            remark TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_return_sale_order_no ON return_sale_orders(order_no);

        CREATE TABLE IF NOT EXISTS return_sale_items (
            id TEXT PRIMARY KEY NOT NULL,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_id TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0,
            subtotal REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (order_id) REFERENCES return_sale_orders(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_return_sale_item_order ON return_sale_items(order_id);

        CREATE TABLE IF NOT EXISTS member_balance_logs (
            id TEXT PRIMARY KEY NOT NULL,
            member_id TEXT NOT NULL,
            change_type TEXT NOT NULL CHECK (change_type IN ('recharge', 'consume', 'refund')),
            change_amount REAL NOT NULL,
            balance_after REAL NOT NULL,
            payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'wechat', 'alipay', 'memberBalance')),
            operator TEXT NOT NULL,
            related_order_id TEXT,
            bonus_amount REAL NOT NULL DEFAULT 0,
            fee_amount REAL NOT NULL DEFAULT 0,
            remark TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_balance_log_member ON member_balance_logs(member_id);
        CREATE INDEX IF NOT EXISTS idx_balance_log_type ON member_balance_logs(change_type);
        CREATE INDEX IF NOT EXISTS idx_balance_log_created ON member_balance_logs(created_at);

        CREATE TABLE IF NOT EXISTS supplier_payments (
            id TEXT PRIMARY KEY NOT NULL,
            supplier_id TEXT NOT NULL,
            purchase_order_id TEXT,
            amount REAL NOT NULL CHECK(amount > 0),
            payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'wechat', 'alipay', 'transfer', 'other')),
            payment_date TEXT NOT NULL,
            remark TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_payment_supplier ON supplier_payments(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_payment_order ON supplier_payments(purchase_order_id);
        CREATE INDEX IF NOT EXISTS idx_payment_date ON supplier_payments(payment_date);

        CREATE TABLE IF NOT EXISTS print_templates (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('receipt', 'purchase', 'damage', 'return')),
            content TEXT NOT NULL DEFAULT '',
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS barcode_rules (
            id TEXT PRIMARY KEY NOT NULL,
            product_id TEXT NOT NULL,
            unit_id TEXT,
            barcode_type TEXT NOT NULL DEFAULT 'code128' CHECK (barcode_type IN ('code128', 'qrcode')),
            rule_pattern TEXT NOT NULL,
            label_width INTEGER DEFAULT 40,
            label_height INTEGER DEFAULT 30,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );"
    ).map_err(|e| format!("v9迁移失败(建表): {}", e))?;

    // 初始化默认供应商
    tx.execute(
        "INSERT OR IGNORE INTO suppliers (id, name, remark) VALUES
            ('sup-default', '默认供应商', '系统自动创建'),
            ('sup-self', '自营采购', '无外部供应商的自营采购')",
        [],
    ).map_err(|e| format!("v9迁移失败(默认供应商): {}", e))?;

    // 初始化商品分类
    let cat_count: i32 = tx.query_row(
        "SELECT COUNT(*) FROM product_categories WHERE level = 1", [], |r| r.get(0)
    ).unwrap_or(0);
    if cat_count == 0 {
        tx.execute_batch(
            "INSERT INTO product_categories (id, name, level, sort_order) VALUES
                ('cat-qingcha', '青茶', 1, 1),
                ('cat-hongcha', '红茶', 1, 2),
                ('cat-puer', '普洱', 1, 3),
                ('cat-lvcha', '绿茶', 1, 4),
                ('cat-baicha', '白茶', 1, 5);
            INSERT INTO product_categories (id, name, parent_id, level, sort_order) VALUES
                ('cat-wuyiyan', '武夷岩茶', 'cat-qingcha', 2, 1),
                ('cat-tieguanyin', '铁观音', 'cat-qingcha', 2, 2),
                ('cat-dancong', '凤凰单丛', 'cat-qingcha', 2, 3),
                ('cat-zhengshan', '正山小种', 'cat-hongcha', 2, 1),
                ('cat-qimen', '祁门红茶', 'cat-hongcha', 2, 2),
                ('cat-shengpuer', '生普', 'cat-puer', 2, 1),
                ('cat-shoupuer', '熟普', 'cat-puer', 2, 2),
                ('cat-longjing', '龙井', 'cat-lvcha', 2, 1),
                ('cat-biluochun', '碧螺春', 'cat-lvcha', 2, 2),
                ('cat-baimudan', '白牡丹', 'cat-baicha', 2, 1),
                ('cat-baihaoyinzhen', '白毫银针', 'cat-baicha', 2, 2);"
        ).map_err(|e| format!("v9迁移失败(初始化分类): {}", e))?;
    }

    // 初始化默认打印模板
    tx.execute(
        r#"INSERT OR IGNORE INTO print_templates (id, name, type, content, is_default) VALUES
            ('tpl-receipt-default', '默认零售小票', 'receipt',
             '<div class="receipt"><h2>{{shopName}}</h2><p>{{shopAddress}}</p><p>电话: {{shopPhone}}</p><hr><table><thead><tr><th>商品</th><th>数量</th><th>金额</th></tr></thead><tbody>{{items}}</tbody><tfoot><tr><td colspan="2">合计</td><td>{{total}}</td></tr></tfoot></table><p>会员: {{memberName}}</p><p>支付: {{payMethod}} {{actualAmount}}</p><hr><p>感谢惠顾！</p></div>',
             1)"#,
        [],
    ).map_err(|e| format!("v9迁移失败(默认模板): {}", e))?;

    // 添加茶叶店业务权限到 admin 角色
    let tea_perms = [
        "product", "inventory", "sales", "member",
        "purchase", "return", "supplier", "report",
        "barcode", "print"
    ];
    for perm in tea_perms {
        let perm_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT OR IGNORE INTO role_permissions (id, role_name, permission_key) VALUES (?1, 'admin', ?2)",
            rusqlite::params![perm_id, perm],
        ).map_err(|e| format!("v9迁移失败(添加权限{}): {}", perm, e))?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    conn.pragma_update(None, "user_version", 9).map_err(|e| e.to_string())?;
    Ok(())
}

/// v10: V2 新增字段（商品描述/条码/存储条件/保质期等）
fn migrate_v10_v2_fields(conn: &Connection) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let existing_cols = get_table_columns(&tx, "products");
    let new_product_cols = [
        ("description", "TEXT"),
        ("barcode", "TEXT"),
        ("storage_condition", "TEXT"),
        ("shelf_life_days", "INTEGER"),
    ];
    for (col_name, col_type) in new_product_cols {
        if !existing_cols.contains(&col_name.to_string()) {
            let sql = format!("ALTER TABLE products ADD COLUMN {} {}", col_name, col_type);
            tx.execute_batch(&sql).map_err(|e| format!("v10迁移失败(添加{}列): {}", col_name, e))?;
        }
    }

    let existing_unit_cols = get_table_columns(&tx, "sales_units");
    let new_unit_cols = [
        ("is_quick_button", "INTEGER NOT NULL DEFAULT 1"),
        ("wholesale_price", "REAL DEFAULT 0"),
        ("promo_price", "REAL DEFAULT 0"),
    ];
    for (col_name, col_type) in new_unit_cols {
        if !existing_unit_cols.contains(&col_name.to_string()) {
            let sql = format!("ALTER TABLE sales_units ADD COLUMN {} {}", col_name, col_type);
            tx.execute_batch(&sql).map_err(|e| format!("v10迁移失败(添加{}列): {}", col_name, e))?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    conn.pragma_update(None, "user_version", 10).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db_path() -> String {
        format!("/tmp/gl_test_{}.db", uuid::Uuid::new_v4())
    }

    #[test]
    fn test_init_database_creates_tables() {
        let path = test_db_path();
        let pool = init_database(&path).expect("init should succeed");
        let conn = pool.get().unwrap();

        // 验证表存在
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('users','roles','role_permissions','user_roles','operation_logs','system_config')", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 6);

        // 验证版本号
        let version: i32 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, 10);

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn test_default_admin_exists() {
        let path = test_db_path();
        let pool = init_database(&path).expect("init should succeed");
        let conn = pool.get().unwrap();

        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM users WHERE username = 'admin'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);

        std::fs::remove_file(&path).ok();
    }
}
