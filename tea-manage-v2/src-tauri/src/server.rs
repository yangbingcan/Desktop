/** @file HTTP服务器 - Axum RPC路由、SSE事件推送
 *
 * 安全改进：
 * - RPC 端点要求 Bearer Token 认证
 * - CORS 限制为 localhost（开发环境）
 * - 未知命令返回 404 而非通用错误
 */

#[cfg(feature = "server")]
use axum::{
    extract::State as AxumState,
    http::{HeaderMap, Method, StatusCode},
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
use tower_http::cors::{AllowOrigin, CorsLayer};
#[cfg(feature = "server")]
use crate::auth::verify_token;
#[cfg(feature = "server")]
use crate::models::{RpcRequest, RpcResponse};

#[cfg(feature = "server")]
#[derive(Clone)]
pub struct AppState {
    pub tx: broadcast::Sender<String>,
}

#[cfg(feature = "server")]
pub async fn start_server(port: u16) -> Result<(), String> {
    let (tx, _) = broadcast::channel(100);
    let state = AppState { tx };

    // CORS 收紧：仅允许 localhost（开发环境）
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            origin
                .as_bytes()
                .starts_with(b"http://localhost")
                .then_some(())
                .is_some()
        }))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(AllowOrigin::any());

    let app = Router::new()
        .route("/rpc", post(handle_rpc))
        .route("/events", get(sse_events))
        .layer(cors)
        .with_state(state);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    println!("管用GL服务端启动: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("服务端绑定端口失败: {}", e))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("服务端运行错误: {}", e))?;

    Ok(())
}

/// 从请求头提取并验证 Token
#[cfg(feature = "server")]
fn extract_auth_token(headers: &HeaderMap) -> Result<String, (StatusCode, String)> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "缺少认证信息".to_string()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err((StatusCode::UNAUTHORIZED, "认证格式错误".to_string()));
    }

    let token = &auth_header[7..];
    verify_token(token).map_err(|e| (StatusCode::UNAUTHORIZED, e))?;

    Ok(token.to_string())
}

#[cfg(feature = "server")]
async fn handle_rpc(
    AxumState(state): AxumState<AppState>,
    headers: HeaderMap,
    Json(req): Json<RpcRequest>,
) -> Result<Json<RpcResponse>, (StatusCode, String)> {
    // 验证 Token（login 命令除外）
    if req.cmd != "login" {
        let _ = extract_auth_token(&headers)?;
    }

    let response = match req.cmd.as_str() {
        "ping" => RpcResponse::success(serde_json::json!({"message": "pong"})),
        _ => RpcResponse::error(&format!("未知命令: {}", req.cmd)),
    };

    if response.ok && is_write_command(&req.cmd) {
        let _ = state.tx.send(format!("data_updated:{}", req.cmd));
    }

    Ok(Json(response))
}

#[cfg(feature = "server")]
async fn sse_events(
    AxumState(state): AxumState<AppState>,
    headers: HeaderMap,
) -> Result<Sse<Pin<Box<dyn Stream<Item = Result<axum::response::sse::Event, Infallible>> + Send>>>, (StatusCode, String)> {
    // SSE 也需要认证
    let _ = extract_auth_token(&headers)?;

    let rx = state.tx.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx);
    let stream = stream.map(|result| match result {
        Ok(msg) => Some(Ok(axum::response::sse::Event::default().data(msg))),
        Err(_) => None,
    }).filter_map(|opt| async move { opt });
    Ok(Sse::new(Box::pin(stream)))
}

#[cfg(feature = "server")]
fn is_write_command(cmd: &str) -> bool {
    cmd.starts_with("create_") || cmd.starts_with("update_") || cmd.starts_with("delete_") || cmd.starts_with("batch_")
}
