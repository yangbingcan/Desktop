//! 管用GL核心库 - 模块声明与Tauri命令注册

mod database;
mod models;
mod error_util;
mod auth;
mod users;
mod roles;
mod operation_logs;
mod system_config;
#[cfg(feature = "server")]
mod server;
#[cfg(test)]
mod test_utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let db_path = get_db_path(app)?;
            let conn = database::init_database(&db_path)
                .map_err(|e| {
                    eprintln!("数据库初始化失败: {}", e);
                    e
                })?;
            let state = database::DbState::new(Some(conn));
            app.manage(state);

            // 生成随机Token签名密钥，每次启动不同，确保安全性
            let token_secret: database::TokenSecret = (0..32).map(|_| rand::random::<u8>()).collect();
            app.manage(token_secret);

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
            system_config::get_system_config,
            system_config::save_system_config,
            system_config::upload_company_logo,
            system_config::backup_database,
            system_config::restore_database,
            system_config::get_system_info,
            system_config::get_storage_info,
        ])
        .run(tauri::generate_context!())
        .expect("管用GL启动失败");
}

fn get_db_path(app: &tauri::App) -> Result<String, String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("创建应用数据目录失败: {}", e))?;
    Ok(app_dir.join("guanyong-gl.db").to_str()
        .ok_or_else(|| "数据库路径转换失败".to_string())?
        .to_string())
}
