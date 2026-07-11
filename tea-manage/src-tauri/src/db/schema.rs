//! 数据库 Schema 定义
//! 
//! 包含所有表的建表语句、索引定义、初始化数据等

use rusqlite::Connection;
use rusqlite::Result as SqliteResult;

/// 当前数据库 Schema 版本号
/// 每次涉及表结构变更时递增，迁移逻辑据此判断需要执行哪些变更
///
/// 版本历史：
/// - v1: 初始版本（商品/库存/会员/销售）
/// - v2: 新增供应商表、退货出库单表、退货出库明细表（M04 出入库闭环）
/// - v3: 新增采购入库主单表 + 采购明细表（M04 出入库闭环完善）
/// - v4: 新增会员储值余额流水表（M06 储值余额功能）
/// - v5: 修复 products / suppliers / members 等表的缺失字段（兼容 v0 老库）
/// - v6: 新增供应商付款记录表 supplier_payments（应付管理 + 付款流水）
const SCHEMA_VERSION: u32 = 6;

/// 执行数据库迁移
///
/// 通过 user_version PRAGMA 追踪已应用的版本，仅执行增量迁移。
/// 新数据库会从版本 0 迁移到最新版本；已有数据库仅执行未执行的迁移步骤。
pub fn run_migrations(conn: &Connection) -> SqliteResult<()> {
    let current_version: u32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

    if current_version < 1 {
        // v1: 初始版本 - 创建所有表
        create_tables(conn)?;
    }

    if current_version < 2 {
        // v2: M04 出入库闭环 - 供应商表 + 退货出库单 + 退货出库明细
        migrate_v2_suppliers_and_return(conn)?;
    }

    if current_version < 3 {
        // v3: M04 出入库闭环完善 - 采购入库主单 + 采购明细
        migrate_v3_purchase_orders(conn)?;
    }

    if current_version < 4 {
        // v4: M06 储值余额功能 - 会员储值流水表
        migrate_v4_member_balance_logs(conn)?;
    }

    if current_version < 5 {
        // v5: 修复老库缺失字段（兼容 v0 数据库）
        migrate_v5_fix_missing_columns(conn)?;
    }

    if current_version < 6 {
        // v6: 新增供应商付款记录表
        migrate_v6_supplier_payments(conn)?;
    }

    if current_version < SCHEMA_VERSION {
        // 创建复合索引（v1 已建，此处兼容后续 v0 升级到 v1 场景）
        create_composite_indexes(conn)?;
        // 标记为最新版本
        conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    }

    Ok(())
}

/// v2 迁移：新增供应商表 + 退货出库单 + 退货出库明细
/// 
/// M04 出入库闭环需要：
/// 1. suppliers - 供应商档案（采购/退货时选择）
/// 2. return_orders - 退货出库单
/// 3. return_items - 退货出库明细
/// 
/// 数据迁移：将 v1 时期 supplier_id 为空的采购单补「默认供应商」
pub fn migrate_v2_suppliers_and_return(conn: &Connection) -> SqliteResult<()> {
    // 1. 供应商表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS suppliers (
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
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_supplier_name ON suppliers(name)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_supplier_active ON suppliers(is_active)",
        [],
    )?;

    // 2. 初始默认供应商（用于兼容历史数据）
    conn.execute(
        "INSERT OR IGNORE INTO suppliers (id, name, remark) VALUES
            ('sup-default', '默认供应商', '系统自动创建，用于兼容历史采购单'),
            ('sup-self', '自营采购', '无外部供应商的自营采购')",
        [],
    )?;

    // 3. 退货出库单表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS return_orders (
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
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_return_order_no ON return_orders(order_no)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_return_supplier ON return_orders(supplier_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_return_date ON return_orders(return_date)",
        [],
    )?;

    // 4. 退货出库明细表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS return_items (
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
            FOREIGN KEY (order_id) REFERENCES return_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
            FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_return_item_order ON return_items(order_id)",
        [],
    )?;

    // 5. 数据迁移：v1 时期 supplier_id 为空的采购单补「默认供应商」
    // 仅在 purchase_orders 表存在时执行（v0 升级到 v1 时该表不存在）
    let purchase_table_exists: i32 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='purchase_orders'",
        [],
        |row| row.get(0),
    )?;
    if purchase_table_exists > 0 {
        conn.execute(
            "UPDATE purchase_orders
             SET supplier_id = 'sup-default'
             WHERE supplier_id IS NULL OR supplier_id = ''",
            [],
        )?;
    }

    Ok(())
}

/// v3 迁移：新增采购入库主单 + 采购入库明细
///
/// M04 出入库闭环完善需要：
/// 1. purchase_orders - 采购入库主单（持久化主单+付款状态）
/// 2. purchase_items - 采购入库明细（持久化商品行）
///
/// 数据迁移策略：v0/v1/v2 时期的采购入库没有主单，不回填
pub fn migrate_v3_purchase_orders(conn: &Connection) -> SqliteResult<()> {
    // 1. 采购主单表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS purchase_orders (
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
        )",
        [],
    )?;

    // 主单索引
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_order_no ON purchase_orders(order_no)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_purchase_supplier ON purchase_orders(supplier_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_purchase_date ON purchase_orders(created_at)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_purchase_payment_status ON purchase_orders(payment_status)",
        [],
    )?;

    // 2. 采购明细表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS purchase_items (
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
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
            FOREIGN KEY (unit_id) REFERENCES sales_units(id) ON DELETE RESTRICT,
            FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_purchase_item_order ON purchase_items(order_id)",
        [],
    )?;

    Ok(())
}

/// v4 迁移：新增会员储值余额流水表
///
/// M06 储值余额功能需要：
/// 1. member_balance_logs - 储值/扣款/退款流水记录
///
/// 字段设计要点：
/// - change_type 使用 CHECK 约束限定 3 种类型（recharge/consume/refund）
/// - change_amount 正数=加款，负数=扣款/退款
/// - payment_method 使用 CHECK 限定合法支付方式
/// - 预留 bonus_amount / fee_amount 字段便于后续扩展
/// - related_order_id 关联消费订单（consume 类型时必填）
///
/// 数据迁移策略：全新表，无需回填
pub fn migrate_v4_member_balance_logs(conn: &Connection) -> SqliteResult<()> {
    // 1. 储值流水表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS member_balance_logs (
            id TEXT PRIMARY KEY NOT NULL,
            member_id TEXT NOT NULL,
            change_type TEXT NOT NULL
                CHECK (change_type IN ('recharge', 'consume', 'refund')),
            change_amount REAL NOT NULL,
            balance_after REAL NOT NULL,
            payment_method TEXT NOT NULL
                CHECK (payment_method IN ('cash', 'wechat', 'alipay', 'memberBalance')),
            operator TEXT NOT NULL,
            related_order_id TEXT,
            bonus_amount REAL NOT NULL DEFAULT 0,
            fee_amount REAL NOT NULL DEFAULT 0,
            remark TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
            FOREIGN KEY (related_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // 2. 索引：会员维度查询
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_balance_log_member ON member_balance_logs(member_id)",
        [],
    )?;

    // 3. 索引：流水类型筛选
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_balance_log_type ON member_balance_logs(change_type)",
        [],
    )?;

    // 4. 索引：时间排序（最新流水在前）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_balance_log_created ON member_balance_logs(created_at)",
        [],
    )?;

    // 5. 索引：关联订单查询（消费扣款场景）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_balance_log_order ON member_balance_logs(related_order_id)",
        [],
    )?;

    Ok(())
}

/// v5 迁移：修复老库缺失字段
///
/// 解决 v0 时期 products / suppliers / members / sales_orders 等表缺少字段的问题。
/// 业务代码（inventory.rs, sales.rs 等）大量使用 stock_grams / stock_units /
/// fermentation_level / roast_level / image_url / main_categories 等字段，
/// 但老库 CREATE TABLE IF NOT EXISTS 不会给已存在的表加列。
///
/// 处理策略：使用 PRAGMA table_info 检测列是否存在，仅对缺失列执行 ALTER TABLE ADD COLUMN。
pub fn migrate_v5_fix_missing_columns(conn: &Connection) -> SqliteResult<()> {
    // ========== 辅助函数：检测表是否存在 ==========
    fn table_exists(conn: &Connection, name: &str) -> bool {
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
                [name],
                |row| row.get(0),
            )
            .unwrap_or(0);
        count > 0
    }

    // ========== 辅助函数：获取表的所有列名 ==========
    fn get_columns(conn: &Connection, table: &str) -> Vec<String> {
        let mut stmt = match conn.prepare(&format!("PRAGMA table_info({})", table)) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };
        stmt.query_map([], |row| row.get::<_, String>(1))
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default()
    }

    // ========== 辅助函数：添加列（如果不存在） ==========
    fn add_column_if_missing(
        conn: &Connection,
        table: &str,
        columns: &[String],
        col_name: &str,
        col_def: &str,
    ) -> SqliteResult<bool> {
        if !columns.iter().any(|c| c == col_name) {
            let sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, col_name, col_def);
            conn.execute(&sql, [])?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    // ========== 1. 修复 products 表 ==========
    if table_exists(conn, "products") {
        let cols = get_columns(conn, "products");
        add_column_if_missing(conn, "products", &cols, "origin", "TEXT")?;
        add_column_if_missing(conn, "products", &cols, "year", "TEXT")?;
        add_column_if_missing(conn, "products", &cols, "grade", "TEXT")?;
        add_column_if_missing(conn, "products", &cols, "fermentation_level", "TEXT")?;
        add_column_if_missing(conn, "products", &cols, "roast_level", "TEXT")?;
        add_column_if_missing(conn, "products", &cols, "image_url", "TEXT")?;
        add_column_if_missing(conn, "products", &cols, "default_unit_id", "TEXT")?;
        add_column_if_missing(conn, "products", &cols, "stock_grams", "INTEGER NOT NULL DEFAULT 0")?;
        add_column_if_missing(conn, "products", &cols, "stock_units", "INTEGER NOT NULL DEFAULT 0")?;
    }

    // ========== 2. 修复 suppliers 表 ==========
    if table_exists(conn, "suppliers") {
        let cols = get_columns(conn, "suppliers");
        add_column_if_missing(conn, "suppliers", &cols, "contact_person", "TEXT")?;
        add_column_if_missing(conn, "suppliers", &cols, "contact_phone", "TEXT")?;
        add_column_if_missing(conn, "suppliers", &cols, "address", "TEXT")?;
        add_column_if_missing(
            conn,
            "suppliers",
            &cols,
            "main_categories",
            "TEXT NOT NULL DEFAULT '[]'",
        )?;
    }

    // ========== 3. 修复 members 表 ==========
    if table_exists(conn, "members") {
        let cols = get_columns(conn, "members");
        add_column_if_missing(conn, "members", &cols, "gender", "TEXT")?;
        add_column_if_missing(conn, "members", &cols, "birthday", "TEXT")?;
        add_column_if_missing(
            conn,
            "members",
            &cols,
            "level",
            "TEXT NOT NULL DEFAULT 'normal'",
        )?;
        add_column_if_missing(
            conn,
            "members",
            &cols,
            "points",
            "INTEGER NOT NULL DEFAULT 0",
        )?;
        add_column_if_missing(
            conn,
            "members",
            &cols,
            "balance",
            "REAL NOT NULL DEFAULT 0",
        )?;
        add_column_if_missing(
            conn,
            "members",
            &cols,
            "total_consume",
            "REAL NOT NULL DEFAULT 0",
        )?;
        add_column_if_missing(
            conn,
            "members",
            &cols,
            "consume_count",
            "INTEGER NOT NULL DEFAULT 0",
        )?;
        add_column_if_missing(conn, "members", &cols, "last_visit", "TEXT")?;
    }

    // ========== 4. 修复 sales_orders 表（仅添加必要字段） ==========
    if table_exists(conn, "sales_orders") {
        let cols = get_columns(conn, "sales_orders");
        add_column_if_missing(conn, "sales_orders", &cols, "member_id", "TEXT")?;
        add_column_if_missing(conn, "sales_orders", &cols, "member_name", "TEXT")?;
        add_column_if_missing(
            conn,
            "sales_orders",
            &cols,
            "points_earned",
            "INTEGER NOT NULL DEFAULT 0",
        )?;
        add_column_if_missing(
            conn,
            "sales_orders",
            &cols,
            "points_deduct",
            "INTEGER NOT NULL DEFAULT 0",
        )?;
    }

    // ========== 5. 修复 inventory_batches 表 ==========
    if table_exists(conn, "inventory_batches") {
        let cols = get_columns(conn, "inventory_batches");
        add_column_if_missing(conn, "inventory_batches", &cols, "supplier_id", "TEXT")?;
        add_column_if_missing(conn, "inventory_batches", &cols, "produced_date", "TEXT")?;
        add_column_if_missing(conn, "inventory_batches", &cols, "expire_date", "TEXT")?;
    }

    Ok(())
}

/// 创建所有数据库表
/// 
/// 执行顺序：
/// 1. 商品分类表（无依赖）
/// 2. 商品表（依赖分类表）
/// 3. 销售单位表（依赖商品表）
/// 4. 库存批次表（依赖商品表）
/// 5. 库存流水表（依赖商品表、批次表）
pub fn create_tables(conn: &Connection) -> SqliteResult<()> {
    // ========== 商品分类表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS product_categories (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            parent_id TEXT,
            level INTEGER NOT NULL CHECK (level IN (1, 2)),
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // 分类层级索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_category_level ON product_categories(level)",
        [],
    )?;

    // 父级分类索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_category_parent ON product_categories(parent_id)",
        [],
    )?;

    // ========== 商品表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS products (
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
        )",
        [],
    )?;

    // 商品编码唯一索引
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_product_code ON products(code)",
        [],
    )?;

    // 分类索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_category ON products(category_id)",
        [],
    )?;

    // 类型索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_type ON products(product_type)",
        [],
    )?;

    // 名称搜索索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_name ON products(name)",
        [],
    )?;

    // ========== 销售单位表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sales_units (
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
        )",
        [],
    )?;

    // 商品索引（级联删除）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_unit_product ON sales_units(product_id)",
        [],
    )?;

    // ========== 库存批次表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS inventory_batches (
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
        )",
        [],
    )?;

    // 批次索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_batch_product ON inventory_batches(product_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_batch_code ON inventory_batches(batch_code)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_batch_remaining ON inventory_batches(remaining_grams)",
        [],
    )?;

    // ========== 库存流水表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS stock_flow (
            id TEXT PRIMARY KEY NOT NULL,
            product_id TEXT NOT NULL,
            batch_id TEXT,
            flow_type TEXT NOT NULL CHECK (flow_type IN (
                'purchase_in',
                'sale_out',
                'damage_out',
                'return_out',
                'adjust_in',
                'adjust_out'
            )),
            change_grams INTEGER NOT NULL DEFAULT 0,
            balance_grams INTEGER NOT NULL DEFAULT 0,
            order_id TEXT,
            remark TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // 流水索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_flow_product ON stock_flow(product_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_flow_type ON stock_flow(flow_type)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_flow_created ON stock_flow(created_at)",
        [],
    )?;

    // ========== 会员表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS members (
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
        )",
        [],
    )?;

    // 会员索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_member_phone ON members(phone)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_member_level ON members(level)",
        [],
    )?;

    // ========== 会员口味偏好表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS member_preferences (
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
        )",
        [],
    )?;

    // ========== 销售单据表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sales_orders (
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
            -- 🔧 v0.3.3 修复：与前端 PayStatus 类型保持一致（unpaid 而非 pending）
            pay_status TEXT NOT NULL DEFAULT 'unpaid',
            status TEXT NOT NULL DEFAULT 'pending',
            remark TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // 销售单据索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sales_order_no ON sales_orders(order_no)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sales_member ON sales_orders(member_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sales_status ON sales_orders(status)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sales_created ON sales_orders(created_at)",
        [],
    )?;

    // ========== 销售明细表 ==========
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sales_items (
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
        )",
        [],
    )?;

    // 销售明细索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sales_item_order ON sales_items(order_id)",
        [],
    )?;

    Ok(())
}

/// v6 迁移：新增供应商付款记录表
///
/// 应付管理流程需要：
/// 1. supplier_payments - 供应商付款记录（支持分次付款）
/// 2. 通过付款记录自动计算：欠款 = 采购总额 - 已付金额 - 退货冲抵
///
/// 数据迁移策略：全新表，无需回填
pub fn migrate_v6_supplier_payments(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS supplier_payments (
            id TEXT PRIMARY KEY NOT NULL,
            supplier_id TEXT NOT NULL,
            purchase_order_id TEXT,
            amount REAL NOT NULL CHECK(amount > 0),
            payment_method TEXT NOT NULL
                CHECK (payment_method IN ('cash', 'wechat', 'alipay', 'transfer', 'other')),
            payment_date TEXT NOT NULL,
            remark TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
            FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_payment_supplier ON supplier_payments(supplier_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_payment_order ON supplier_payments(purchase_order_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_payment_date ON supplier_payments(payment_date)",
        [],
    )?;

    Ok(())
}

/// 初始化商品分类数据
/// 
/// 插入茶叶行业常用分类：
/// - 一级分类：青茶、红茶、普洱、绿茶、白茶
/// - 二级分类：各主要品种
pub fn init_categories(conn: &Connection) -> SqliteResult<()> {
    // 检查是否已有数据
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM product_categories WHERE level = 1",
        [],
        |row| row.get(0),
    )?;

    if count > 0 {
        return Ok(()); // 已有数据，跳过
    }

    // 一级分类
    let categories = vec![
        ("cat-qingcha", "青茶", 1),
        ("cat-hongcha", "红茶", 2),
        ("cat-puer", "普洱", 3),
        ("cat-lvcha", "绿茶", 4),
        ("cat-baicha", "白茶", 5),
    ];

    for (id, name, order) in categories {
        conn.execute(
            "INSERT OR IGNORE INTO product_categories (id, name, level, sort_order) VALUES (?, ?, 1, ?)",
            [id, name, &order.to_string()],
        )?;
    }

    // 二级分类
    let sub_categories = vec![
        ("cat-wuyiyan", "武夷岩茶", "cat-qingcha", 1),
        ("cat-tieguanyin", "铁观音", "cat-qingcha", 2),
        ("cat-dancong", "凤凰单丛", "cat-qingcha", 3),
        ("cat-zhengshan", "正山小种", "cat-hongcha", 1),
        ("cat-qimen", "祁门红茶", "cat-hongcha", 2),
        ("cat-shengpuer", "生普", "cat-puer", 1),
        ("cat-shoupuer", "熟普", "cat-puer", 2),
        ("cat-longjing", "龙井", "cat-lvcha", 1),
        ("cat-biluochun", "碧螺春", "cat-lvcha", 2),
        ("cat-baimudan", "白牡丹", "cat-baicha", 1),
        ("cat-baihaoyinzhen", "白毫银针", "cat-baicha", 2),
    ];

    for (id, name, parent_id, order) in sub_categories {
        conn.execute(
            "INSERT OR IGNORE INTO product_categories (id, name, parent_id, level, sort_order) VALUES (?, ?, ?, 2, ?)",
            [id, name, parent_id, &order.to_string()],
        )?;
    }

    Ok(())
}

/// 创建复合索引
/// 
/// 针对高频查询场景添加的复合索引，提升多条件筛选性能：
/// - inventory_batches(product_id, remaining_grams)：按商品查找可用批次
/// - stock_flow(product_id, created_at)：按商品查询流水并按时间排序
/// - sales_orders(member_id, status)：按会员查询挂单
pub fn create_composite_indexes(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_batch_product_remaining
         ON inventory_batches(product_id, remaining_grams)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_flow_product_created
         ON stock_flow(product_id, created_at)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sales_member_status
         ON sales_orders(member_id, status)",
        [],
    )?;

    Ok(())
}
