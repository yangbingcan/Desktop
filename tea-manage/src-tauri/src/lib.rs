//! 茶易管 - TeaManage
//!
//! 茶叶店管理系统 Rust 后端核心库
//!
//! 包含数据库管理、Tauri Commands、业务逻辑等

mod commands;
mod db;
mod models;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 获取应用数据目录
            let app_data_dir = app.path().app_data_dir()
                .expect("无法获取应用数据目录");

            // 确保目录存在
            std::fs::create_dir_all(&app_data_dir)
                .expect("无法创建应用数据目录");

            // 构建数据库路径
            let db_path = app_data_dir.join("tea_manage.db");
            let db_path_str = db_path.to_string_lossy().to_string();

            // 初始化数据库
            let db = Database::new(&db_path_str)
                .expect("无法创建数据库连接");
            db.init().expect("无法初始化数据库");

            // 关键修复：使用 .manage() 注入数据库状态，让 tauri::State<Database> 可用
            app.manage(db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 商品相关
            commands::get_products,
            commands::get_product,
            commands::create_product,
            commands::update_product,
            commands::delete_product,
            commands::get_product_units,
            // 分类相关
            commands::get_categories,
            commands::create_category,
            commands::update_category,
            commands::delete_category,
            // 库存相关
            commands::get_inventory,
            commands::get_inventory_detail,
            commands::get_stock_flows,
            commands::purchase_in,
            commands::damage_out,
            commands::adjust_stock,
            // 采购入库相关（v0.3.0 M04）
            commands::get_purchase_orders,
            commands::get_purchase_order_detail,
            commands::update_purchase_order,
            // 销售相关
            commands::get_member_by_phone,
            commands::create_member,
            commands::update_member,
            commands::get_members,
            commands::get_member_detail,
            commands::update_member_preference,
            commands::get_member_consumption,
            commands::create_sale_order,
            commands::hold_order,
            commands::get_held_orders,
            commands::get_held_order_detail,
            commands::delete_held_order,
            // 供应商相关（v0.2.0 M04 出入库闭环）
            commands::get_suppliers,
            commands::get_all_active_suppliers,
            commands::get_supplier,
            commands::create_supplier,
            commands::update_supplier,
            commands::delete_supplier,
            // 退货出库相关（v0.2.0 M04 出入库闭环）
            commands::get_available_batches,
            commands::create_return_order,
            commands::get_return_orders,
            commands::get_return_order_detail,
            commands::delete_return_order,
            commands::update_return_order,
            // 供应商付款管理（v0.3.6 应付管理+财务流水）
            commands::create_supplier_payment,
            commands::get_supplier_payments,
            commands::get_supplier_financial_flow,
            commands::get_supplier_balance,
            // 储值余额（v0.3.1 M06 储值余额功能）
            commands::recharge_member_balance,
            commands::refund_member_balance,
            commands::get_member_balance_logs,
            commands::get_member_last_payment_method,
            // 演示数据（开发辅助）
            commands::seed_demo_data,
            commands::clear_all_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
