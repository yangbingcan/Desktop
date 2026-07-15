/** @file 茶易管V2核心库 - 模块声明与Tauri命令注册 */

mod database;
mod models;
mod error_util;
mod auth;
mod users;
mod roles;
mod operation_logs;
mod system_config;
mod license;
// 茶叶店业务模块
mod products;
mod categories;
mod inventory;
mod members;
mod sales;
mod suppliers;
mod purchases;
mod returns;
mod print_templates;
#[cfg(feature = "server")]
mod server;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let db_path = get_db_path(app);
            let pool = database::init_database(&db_path)
                .expect("数据库初始化失败");
            let state = database::DbState::new(Some(pool));
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ===== 认证与用户管理 =====
            auth::login,
            auth::get_current_user,
            auth::update_password,
            users::get_users,
            users::create_user,
            users::update_user,
            users::delete_user,
            users::toggle_user_status,
            users::reset_user_password,
            users::generate_random_password,
            // ===== 角色权限 =====
            roles::get_roles,
            roles::create_role,
            roles::update_role,
            roles::delete_role,
            roles::get_permissions,
            roles::get_role_options,
            // ===== 操作日志 =====
            operation_logs::get_operation_logs,
            operation_logs::delete_operation_logs,
            operation_logs::clean_operation_logs,
            operation_logs::record_page_view,
            // ===== 系统配置 =====
            system_config::get_system_config,
            system_config::save_system_config,
            system_config::upload_company_logo,
            system_config::backup_database,
            system_config::restore_database,
            system_config::get_system_info,
            system_config::get_storage_info,
            // ===== 授权码管理 =====
            license::verify_license,
            license::get_license_status,
            license::revoke_license,
            license::get_license_logs,
            license::get_machine_id,
            // ===== 商品档案 =====
            products::get_products,
            products::get_product,
            products::create_product,
            products::update_product,
            products::delete_product,
            products::get_product_units,
            // ===== 商品分类 =====
            categories::get_categories,
            categories::create_category,
            categories::update_category,
            categories::delete_category,
            // ===== 库存管理 =====
            inventory::get_inventory,
            inventory::get_inventory_detail,
            inventory::get_stock_flows,
            inventory::purchase_in,
            inventory::damage_out,
            inventory::adjust_stock,
            inventory::get_available_batches,
            // ===== 会员管理 =====
            members::get_members,
            members::get_member_detail,
            members::create_member,
            members::update_member,
            members::update_member_preference,
            members::get_member_by_phone,
            members::get_member_consumption,
            members::recharge_member_balance,
            members::refund_member_balance,
            members::get_member_balance_logs,
            // ===== 销售收银 =====
            sales::create_sale_order,
            sales::hold_order,
            sales::get_held_orders,
            sales::get_held_order_detail,
            sales::delete_held_order,
            sales::get_sale_orders,
            sales::get_sale_order,
            sales::get_dashboard_stats,
            sales::return_sale_order,
            // ===== 供应商 =====
            suppliers::get_suppliers,
            suppliers::get_all_active_suppliers,
            suppliers::get_supplier,
            suppliers::create_supplier,
            suppliers::update_supplier,
            suppliers::delete_supplier,
            // ===== 采购入库 =====
            purchases::get_purchase_orders,
            purchases::get_purchase_order_detail,
            purchases::update_purchase_order,
            purchases::create_supplier_payment,
            purchases::get_supplier_payments,
            purchases::get_supplier_financial_flow,
            purchases::get_supplier_balance,
            // ===== 退货管理 =====
            returns::create_return_order,
            returns::get_return_orders,
            returns::get_return_order_detail,
            returns::delete_return_order,
            returns::update_return_order,
            // ===== 打印模板 =====
            print_templates::get_print_templates,
            print_templates::save_print_template,
            print_templates::delete_print_template,
            print_templates::get_print_template,
        ])
        .run(tauri::generate_context!())
        .expect("茶易管V2启动失败");
}

fn get_db_path(app: &tauri::App) -> String {
    let app_dir = app.path().app_data_dir()
        .expect("无法获取应用数据目录");
    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("tea_manage_v2.db").to_str().unwrap().to_string()
}
