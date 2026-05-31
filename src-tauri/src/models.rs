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
