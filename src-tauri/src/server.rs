//! HTTP服务器 - Axum RPC路由、SSE事件推送

#[cfg(feature = "server")]
use axum::{
    extract::State as AxumState,
    http::{HeaderMap, Method},
    response::{Json, Sse},
    routing::{get, post},
    Router,
};
#[cfg(feature = "server")]
use futures::{Stream, StreamExt};
#[cfg(feature = "server")]
use std::convert::Infallible;
#[cfg(feature = "server")]
use std::pin::Pin;
#[cfg(feature = "server")]
use tokio::sync::broadcast;
#[cfg(feature = "server")]
use tower_http::cors::CorsLayer;
#[cfg(feature = "server")]
use axum::http::header::{CONTENT_TYPE, AUTHORIZATION};

#[cfg(feature = "server")]
use crate::models::{RpcRequest, RpcResponse};

/// 服务端全局状态，包含SSE广播通道、数据库连接和Token签名密钥
#[cfg(feature = "server")]
#[derive(Clone)]
pub struct AppState {
    pub tx: broadcast::Sender<String>,
    pub db: std::sync::Arc<std::sync::Mutex<Option<rusqlite::Connection>>>,
    pub token_secret: std::sync::Arc<Vec<u8>>,
}

/// 启动HTTP服务器，接收db连接和token_secret用于RPC命令处理
#[cfg(feature = "server")]
pub async fn start_server(
    port: u16,
    db: std::sync::Arc<std::sync::Mutex<Option<rusqlite::Connection>>>,
    token_secret: Vec<u8>,
) -> Result<(), String> {
    let (tx, _) = broadcast::channel(100);
    let state = AppState {
        tx,
        db,
        token_secret: std::sync::Arc::new(token_secret),
    };

    let allowed_origins = [
        "http://localhost:1420".parse::<axum::http::HeaderValue>().unwrap(),
        "http://localhost:9520".parse::<axum::http::HeaderValue>().unwrap(),
        "tauri://localhost".parse::<axum::http::HeaderValue>().unwrap(),
        "https://tauri.localhost".parse::<axum::http::HeaderValue>().unwrap(),
    ];
    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE, AUTHORIZATION]);

    let app = Router::new()
        .route("/rpc", post(handle_rpc))
        .route("/events", get(sse_events))
        .layer(cors)
        .with_state(state);

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    println!("管用GL服务端启动: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("服务端绑定端口失败: {}", e))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("服务端运行错误: {}", e))?;

    Ok(())
}

/// RPC命令分发处理，从Authorization header提取token注入args，将命令路由到对应业务函数
#[cfg(feature = "server")]
async fn handle_rpc(
    AxumState(state): AxumState<AppState>,
    headers: HeaderMap,
    Json(mut req): Json<RpcRequest>,
) -> Json<RpcResponse> {
    // 从Authorization header提取token，优先使用header中的token
    // 确保鉴权链路完整：将header中的token注入到args中供_inner函数读取
    if let Some(auth_header) = headers.get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                match req.args.as_object_mut() {
                    Some(obj) => {
                        obj.insert("token".to_string(), serde_json::Value::String(token.to_string()));
                    }
                    None => {
                        return Json(RpcResponse::error("请求参数格式错误：args 必须为 JSON 对象"));
                    }
                }
            }
        }
    }

    let response = dispatch_command(&state, &req);

    if response.ok && is_write_command(&req.cmd) {
        let _ = state.tx.send(format!("data_updated:{}", req.cmd));
    }

    Json(response)
}

/// 根据命令名分发到对应业务函数
#[cfg(feature = "server")]
fn dispatch_command(state: &AppState, req: &RpcRequest) -> RpcResponse {
    // 获取数据库连接
    let guard = match state.db.lock() {
        Ok(g) => g,
        Err(e) => return RpcResponse::error(&format!("数据库锁获取失败: {}", e)),
    };
    let conn = match guard.as_ref() {
        Some(c) => c,
        None => return RpcResponse::error("数据库未初始化"),
    };
    let secret: &[u8] = state.token_secret.as_ref();

    match req.cmd.as_str() {
        "ping" => RpcResponse::success(serde_json::json!({"message": "pong"})),

        // 认证相关
        "login" => run_command(|| crate::auth::login_inner(conn, secret, &req.args)),
        "get_current_user" => run_command(|| crate::auth::get_current_user_inner(conn, secret, &req.args)),
        "update_password" => run_command(|| crate::auth::update_password_inner(conn, secret, &req.args)),

        // 用户管理
        "get_users" => run_command(|| crate::users::get_users_inner(conn, secret, &req.args)),
        "create_user" => run_command(|| crate::users::create_user_inner(conn, secret, &req.args)),
        "update_user" => run_command(|| crate::users::update_user_inner(conn, secret, &req.args)),
        "delete_user" => run_command(|| crate::users::delete_user_inner(conn, secret, &req.args)),
        "toggle_user_status" => run_command(|| crate::users::toggle_user_status_inner(conn, secret, &req.args)),
        "reset_user_password" => run_command(|| crate::users::reset_user_password_inner(conn, secret, &req.args)),
        "generate_random_password" => run_command(|| crate::users::generate_random_password_inner()),

        // 角色管理
        "get_roles" => run_command(|| crate::roles::get_roles_inner(conn, secret, &req.args)),
        "create_role" => run_command(|| crate::roles::create_role_inner(conn, secret, &req.args)),
        "update_role" => run_command(|| crate::roles::update_role_inner(conn, secret, &req.args)),
        "delete_role" => run_command(|| crate::roles::delete_role_inner(conn, secret, &req.args)),
        "get_permissions" => run_command(|| crate::roles::get_permissions_inner()),
        "get_role_options" => run_command(|| crate::roles::get_role_options_inner(conn, secret, &req.args)),

        // 操作日志
        "get_operation_logs" => run_command(|| crate::operation_logs::get_operation_logs_inner(conn, secret, &req.args)),
        "delete_operation_logs" => run_command(|| crate::operation_logs::delete_operation_logs_inner(conn, secret, &req.args)),
        "clean_operation_logs" => run_command(|| crate::operation_logs::clean_operation_logs_inner(conn, secret, &req.args)),
        "record_page_view" => run_command(|| crate::operation_logs::record_page_view_inner(conn, secret, &req.args)),

        // 系统配置
        "get_system_config" => run_command(|| crate::system_config::get_system_config_inner(conn, secret, &req.args)),
        "save_system_config" => run_command(|| crate::system_config::save_system_config_inner(conn, secret, &req.args)),
        "upload_company_logo" => RpcResponse::error("文件上传请使用Tauri客户端"),
        "backup_database" => run_command(|| crate::system_config::backup_database_inner(conn, secret, &req.args)),
        "restore_database" => RpcResponse::error("数据库恢复请使用Tauri客户端"),
        "get_system_info" => run_command(|| crate::system_config::get_system_info_inner(conn, secret, &req.args)),
        "get_storage_info" => run_command(|| crate::system_config::get_storage_info_inner(conn, secret, &req.args)),

        _ => RpcResponse::error(&format!("未知命令: {}", req.cmd)),
    }
}

/// 统一执行命令并序列化结果为RpcResponse
#[cfg(feature = "server")]
fn run_command<F>(f: F) -> RpcResponse
where
    F: FnOnce() -> Result<serde_json::Value, String>,
{
    match f() {
        Ok(data) => RpcResponse::success(data),
        Err(e) => RpcResponse::error(&e),
    }
}

#[cfg(feature = "server")]
async fn sse_events(
    AxumState(state): AxumState<AppState>,
    headers: HeaderMap,
) -> Result<Sse<Pin<Box<dyn Stream<Item = Result<axum::response::sse::Event, Infallible>> + Send>>>, axum::http::StatusCode> {
    // SSE端点需要认证，防止未授权用户订阅数据变更事件
    let token = headers.get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));
    let token = match token {
        Some(t) if !t.is_empty() => t,
        _ => return Err(axum::http::StatusCode::UNAUTHORIZED),
    };

    // 验证Token有效性
    let guard = state.db.lock().map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let conn = match guard.as_ref() {
        Some(c) => c,
        None => return Err(axum::http::StatusCode::SERVICE_UNAVAILABLE),
    };
    if crate::auth::verify_and_get_context(conn, token, &state.token_secret).is_err() {
        return Err(axum::http::StatusCode::UNAUTHORIZED);
    }
    // 释放数据库锁后再订阅，避免长时间持锁
    drop(guard);

    let rx = state.tx.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx);
    let stream = stream.map(|result| match result {
        Ok(msg) => Some(Ok(axum::response::sse::Event::default().data(msg))),
        Err(_) => None,
    }).filter_map(|opt| async move { opt });
    Ok(Sse::new(Box::pin(stream)))
}

/// 判断是否为写操作命令，用于SSE事件推送
#[cfg(feature = "server")]
fn is_write_command(cmd: &str) -> bool {
    cmd.starts_with("create_") || cmd.starts_with("update_") || cmd.starts_with("delete_")
        || cmd.starts_with("batch_") || cmd.starts_with("reset_") || cmd.starts_with("toggle_")
        || cmd.starts_with("clean_") || cmd.starts_with("save_") || cmd.starts_with("backup_")
        || cmd.starts_with("restore_") || cmd.starts_with("upload_")
}
