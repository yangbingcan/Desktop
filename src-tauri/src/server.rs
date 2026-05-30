/** @file HTTP服务器 - Axum RPC路由、SSE事件推送 */

#[cfg(feature = "server")]
use axum::{
    extract::State as AxumState,
    http::Method,
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
use tower_http::cors::{Any, CorsLayer};

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

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

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

#[cfg(feature = "server")]
async fn handle_rpc(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<RpcRequest>,
) -> Json<RpcResponse> {
    let response = match req.cmd.as_str() {
        "ping" => RpcResponse::success(serde_json::json!({"message": "pong"})),
        _ => RpcResponse::error(&format!("未知命令: {}", req.cmd)),
    };

    if response.ok && is_write_command(&req.cmd) {
        let _ = state.tx.send(format!("data_updated:{}", req.cmd));
    }

    Json(response)
}

#[cfg(feature = "server")]
async fn sse_events(
    AxumState(state): AxumState<AppState>,
) -> Sse<Pin<Box<dyn Stream<Item = Result<axum::response::sse::Event, Infallible>> + Send>>> {
    let rx = state.tx.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx);
    let stream = stream.map(|result| match result {
        Ok(msg) => Some(Ok(axum::response::sse::Event::default().data(msg))),
        Err(_) => None,
    }).filter_map(|opt| async move { opt });
    Sse::new(Box::pin(stream))
}

#[cfg(feature = "server")]
fn is_write_command(cmd: &str) -> bool {
    cmd.starts_with("create_") || cmd.starts_with("update_") || cmd.starts_with("delete_") || cmd.starts_with("batch_")
}
