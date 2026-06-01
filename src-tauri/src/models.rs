/** @file 数据模型定义 - 用户权限管理相关结构体 */

use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub real_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub avatar: String,
    pub status: i32,
    pub last_login_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub avatar: String,
    pub status: i32,
    pub permissions: Vec<String>,
    pub roles: Vec<RoleBrief>,
    #[serde(default)]
    pub is_super_admin: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoleBrief {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserItem {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub avatar: String,
    pub status: i32,
    pub roles: Vec<RoleBrief>,
    pub last_login_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoleItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_system: bool,
    pub permissions: Vec<String>,
    pub user_count: i32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermissionItem {
    pub key: String,
    pub label: String,
    pub group: String,
    pub module: String,
    pub module_label: String,
    pub action: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct RpcRequest {
    pub cmd: String,
    pub args: serde_json::Value,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub real_name: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct RpcResponse {
    pub ok: bool,
    pub data: serde_json::Value,
    #[serde(default)]
    pub error: String,
}

#[allow(dead_code)]
impl RpcResponse {
    pub fn success(data: serde_json::Value) -> Self {
        RpcResponse { ok: true, data, error: String::new() }
    }

    pub fn error(msg: &str) -> Self {
        RpcResponse { ok: false, data: serde_json::Value::Null, error: msg.to_string() }
    }
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: String,
    pub username: String,
    pub action_type: String,
    pub action: String,
    pub module: String,
    pub detail: String,
    pub computer_name: String,
    pub ip_address: String,
    pub mac_address: String,
    pub os_info: String,
    pub app_version: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetOperationLogsParams {
    pub page: Option<i32>,
    pub page_size: Option<i32>,
    pub keyword: Option<String>,
    pub action_type: Option<String>,
    pub module: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetOperationLogsResult {
    pub items: Vec<OperationLog>,
    pub total: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetSystemConfigResult {
    pub configs: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupDatabaseResult {
    pub success: bool,
    pub file_path: String,
    pub file_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RestoreDatabaseResult {
    pub success: bool,
    pub need_restart: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub app_name: String,
    pub app_version: String,
    pub db_version: i32,
    pub os_info: String,
    pub db_path: String,
    pub data_dir: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageInfo {
    pub db_size: u64,
    pub log_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadLogoResult {
    pub success: bool,
    pub file_name: String,
    pub file_path: String,
}
