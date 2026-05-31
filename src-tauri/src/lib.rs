/** @file 管用GL核心库 - 模块声明与Tauri命令注册 */

mod database;
mod models;
mod error_util;
mod auth;
mod users;
mod roles;
mod operation_logs;
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
            let conn = database::init_database(&db_path)
                .expect("数据库初始化失败");
            let state = database::DbState::new(Some(conn));
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
            roles::get_roles,
            roles::create_role,
            roles::update_role,
            roles::delete_role,
            roles::get_permissions,
            roles::get_role_options,
            operation_logs::get_operation_logs,
            operation_logs::delete_operation_logs,
            operation_logs::clean_operation_logs,
            operation_logs::record_page_view,
        ])
        .run(tauri::generate_context!())
        .expect("管用GL启动失败");
}

fn get_db_path(app: &tauri::App) -> String {
    let app_dir = app.path().app_data_dir()
        .expect("无法获取应用数据目录");
    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("guanyong-gl.db").to_str().unwrap().to_string()
}
