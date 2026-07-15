/** @file 授权码管理 - 离线 HMAC 签名验证 + 机器绑定 + 有效期
 *
 * 架构设计：
 * 1. 开发者使用 license-gen 工具生成授权码（离线，无需网络）
 * 2. 授权码格式：BASE64URL(payload_json).BASE64URL(hmac_signature)
 * 3. Payload 包含：machine_id（机器指纹）、expiry（有效期）、issued_at（签发时间）
 * 4. 应用使用编译内置的 HMAC 密钥验证签名
 * 5. 验证通过后，本地持久化激活状态（license.json）
 * 6. 每次启动检查本地状态 + 重新验证有效期
 *
 * 安全特性：
 * - 机器绑定：授权码绑定到特定机器，不可跨机器共享
 * - 有效期：支持过期时间，到期自动失效
 * - 离线验证：无需网络，不依赖任何第三方服务
 * - 签名防伪：HMAC-SHA256 签名，防止篡改
 * - 本地不存储明文授权码，仅存储签名后的 payload
 *
 * 与旧方案对比：
 * - 旧方案：Gitee Releases 存储 64 位明文授权码 → 依赖网络 + 仓库可见性
 * - 新方案：离线 HMAC 签名 → 无网络依赖 + 机器绑定 + 有效期
 */

use crate::database::{DbState, get_conn};
use crate::operation_logs::record_operation_log;
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use hmac::{Hmac, Mac};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use tauri::{Manager, State};

type HmacSha256 = Hmac<Sha256>;

/// HMAC 签名密钥（用于授权码签名验证）
/// 注意：此密钥编译到二进制中，理论上可被逆向提取。
/// 如需更高安全性，可改用 Ed25519/RSA 非对称签名方案。
const LICENSE_SIGNING_KEY: &[u8] = b"guanyong_gl_license_signing_key_v2_offline";

/// 本地激活状态文件名
const LOCAL_LICENSE_FILE: &str = "license.json";

// ==================== 数据结构 ====================

/// 授权码 Payload（签名前的明文数据）
#[derive(Serialize, Deserialize, Clone)]
struct LicensePayload {
    /// 机器指纹（SHA256(MAC + hostname) 前16位十六进制）
    machine_id: String,
    /// 授权有效期（ISO 日期 YYYY-MM-DD，空字符串表示永久）
    #[serde(default)]
    expiry: String,
    /// 签发时间（ISO 日期时间）
    issued_at: String,
}

/// 本地激活状态（持久化到 license.json）
#[derive(Serialize, Deserialize)]
struct LicenseState {
    activated: bool,
    /// 完整的授权码（用于重新验证）
    license_code: String,
    /// 机器指纹
    machine_id: String,
    /// 激活时间
    activated_at: String,
    /// 激活时的应用版本
    app_version: String,
}

/// 前端查询激活状态的返回
#[derive(Serialize)]
pub struct LicenseStatus {
    pub activated: bool,
    pub activated_at: Option<String>,
    pub app_version: Option<String>,
    pub machine_id: String,
    pub expiry: Option<String>,
    pub license_code: Option<String>,
}

/// 验证成功的返回
#[derive(Serialize)]
pub struct LicenseVerifyResult {
    pub activated_at: String,
    pub expiry: String,
    pub machine_id: String,
}

// ==================== 机器指纹 ====================

/// 获取当前机器指纹：SHA256(MAC + hostname) 前16位十六进制
fn compute_machine_id() -> String {
    let mac = mac_address::get_mac_address()
        .map(|m| m.to_string().replace(':', ""))
        .unwrap_or_default();

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", mac, hostname).as_bytes());
    format!("{:x}", hasher.finalize())[..16].to_string()
}

// ==================== 签名与验证 ====================

/// 计算 payload 的 HMAC-SHA256 签名
fn sign_payload(payload: &LicensePayload) -> String {
    let json = serde_json::to_string(payload).unwrap_or_default();
    let mut mac = HmacSha256::new_from_slice(LICENSE_SIGNING_KEY)
        .expect("HMAC密钥长度错误");
    mac.update(json.as_bytes());
    let sig = mac.finalize().into_bytes();
    URL_SAFE_NO_PAD.encode(sig)
}

/// 生成完整授权码：BASE64URL(payload_json).BASE64URL(hmac_signature)
#[allow(dead_code)] // 在 license_gen 二进制中使用
fn generate_license_code(payload: &LicensePayload) -> String {
    let json = serde_json::to_string(payload).unwrap_or_default();
    let payload_b64 = URL_SAFE_NO_PAD.encode(json.as_bytes());
    let sig = sign_payload(payload);
    format!("{}.{}", payload_b64, sig)
}

/// 解析并验证授权码
/// 返回解析出的 Payload，验证失败返回 Err
fn parse_and_verify_license(code: &str) -> Result<LicensePayload, String> {
    let parts: Vec<&str> = code.splitn(2, '.').collect();
    if parts.len() != 2 {
        return Err("授权码格式错误".to_string());
    }

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(parts[0])
        .map_err(|_| "授权码解析失败".to_string())?;
    let sig_bytes = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|_| "授权码签名解码失败".to_string())?;

    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|_| "授权码数据解析失败".to_string())?;

    // 验证签名
    let expected_sig = sign_payload(&payload);
    let expected_bytes = URL_SAFE_NO_PAD
        .decode(&expected_sig)
        .map_err(|_| "签名验证内部错误".to_string())?;

    // 常数时间比较
    let mut mac = HmacSha256::new_from_slice(LICENSE_SIGNING_KEY)
        .map_err(|e| format!("签名验证失败: {}", e))?;
    let json = serde_json::to_string(&payload).unwrap_or_default();
    mac.update(json.as_bytes());

    if mac.verify_slice(&sig_bytes).is_err() {
        return Err("授权码签名验证失败".to_string());
    }

    let _ = expected_bytes; // suppress unused warning

    Ok(payload)
}

/// 检查有效期是否仍然有效
fn check_expiry(expiry: &str) -> Result<(), String> {
    if expiry.is_empty() {
        return Ok(()); // 永久授权
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    if today.as_str() > expiry {
        return Err(format!("授权已过期（到期日：{}）", expiry));
    }

    Ok(())
}

// ==================== 存储模块 ====================

fn get_license_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    Ok(app_dir.join(LOCAL_LICENSE_FILE))
}

fn save_license_state(app: &tauri::AppHandle, state: &LicenseState) -> Result<(), String> {
    let path = get_license_file_path(app)?;
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("序列化授权状态失败: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("保存授权状态失败: {}", e))?;
    Ok(())
}

fn load_license_state(app: &tauri::AppHandle) -> Result<LicenseState, String> {
    let path = get_license_file_path(app)?;
    if !path.exists() {
        return Err("授权状态文件不存在".to_string());
    }
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取授权状态失败: {}", e))?;
    let state: LicenseState = serde_json::from_str(&json)
        .map_err(|e| format!("解析授权状态失败: {}", e))?;
    Ok(state)
}

fn delete_license_state(app: &tauri::AppHandle) -> Result<(), String> {
    let path = get_license_file_path(app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("删除授权状态失败: {}", e))?;
    }
    Ok(())
}

// ==================== 日志模块 ====================

fn record_license_log(
    conn: &rusqlite::Connection,
    action_type: &str,
    action: &str,
    detail: Option<&str>,
) {
    record_operation_log(conn, "system", action_type, action, "授权管理", detail);
}

// ==================== Tauri 命令 ====================

/// 获取当前机器指纹（激活前调用，无需鉴权）
#[tauri::command]
pub fn get_machine_id() -> String {
    compute_machine_id()
}

/// 验证授权码（离线验证，无需网络）
///
/// 流程：
/// 1. 解析授权码格式
/// 2. 验证 HMAC 签名
/// 3. 检查 machine_id 是否匹配当前机器
/// 4. 检查有效期
/// 5. 验证通过 → 保存激活状态到本地 + 记录日志
#[tauri::command]
pub fn verify_license(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    code: String,
) -> Result<LicenseVerifyResult, String> {
    let code = code.trim().to_string();

    if code.is_empty() {
        return Err("请输入授权码".to_string());
    }

    // 解析并验证签名
    let payload = parse_and_verify_license(&code)?;

    // 检查机器绑定
    let current_machine_id = compute_machine_id();
    if payload.machine_id != current_machine_id {
        return Err(format!(
            "授权码与当前机器不匹配（期望: {}...，当前: {}...）",
            &payload.machine_id[..4.min(payload.machine_id.len())],
            &current_machine_id[..4.min(current_machine_id.len())]
        ));
    }

    // 检查有效期
    check_expiry(&payload.expiry)?;

    // 验证成功：保存激活状态
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let version = env!("CARGO_PKG_VERSION").to_string();

    let state = LicenseState {
        activated: true,
        license_code: code,
        machine_id: current_machine_id.clone(),
        activated_at: now.clone(),
        app_version: version,
    };

    save_license_state(&app, &state)?;

    // 记录激活成功日志
    let conn = get_conn(&db)?;
    record_license_log(
        &conn,
        "license_activate",
        "授权激活成功",
        Some(&format!("机器: {}", &current_machine_id)),
    );

    Ok(LicenseVerifyResult {
        activated_at: now,
        expiry: payload.expiry,
        machine_id: current_machine_id,
    })
}

/// 查询本地激活状态（仅读取本地文件，不发起网络请求）
///
/// 每次启动时调用，检查本地激活状态并重新验证有效期
#[tauri::command]
pub fn get_license_status(app: tauri::AppHandle) -> Result<LicenseStatus, String> {
    match load_license_state(&app) {
        Ok(state) if state.activated => {
            // 重新验证授权码（检查是否过期、机器是否匹配）
            match parse_and_verify_license(&state.license_code) {
                Ok(payload) => {
                    // 检查机器是否变化
                    let current_machine_id = compute_machine_id();
                    if payload.machine_id != current_machine_id {
                        // 机器不匹配，清除激活状态
                        let _ = delete_license_state(&app);
                        return Ok(LicenseStatus {
                            activated: false,
                            activated_at: None,
                            app_version: None,
                            machine_id: current_machine_id,
                            expiry: None,
                            license_code: None,
                        });
                    }

                    // 检查有效期
                    if check_expiry(&payload.expiry).is_err() {
                        let _ = delete_license_state(&app);
                        return Ok(LicenseStatus {
                            activated: false,
                            activated_at: None,
                            app_version: None,
                            machine_id: current_machine_id,
                            expiry: Some(payload.expiry),
                            license_code: None,
                        });
                    }

                    Ok(LicenseStatus {
                        activated: true,
                        activated_at: Some(state.activated_at),
                        app_version: Some(state.app_version),
                        machine_id: current_machine_id,
                        expiry: Some(payload.expiry),
                        license_code: Some(state.license_code),
                    })
                }
                Err(_) => {
                    // 授权码验证失败，清除激活状态
                    let _ = delete_license_state(&app);
                    Ok(LicenseStatus {
                        activated: false,
                        activated_at: None,
                        app_version: None,
                        machine_id: compute_machine_id(),
                        expiry: None,
                        license_code: None,
                    })
                }
            }
        }
        _ => Ok(LicenseStatus {
            activated: false,
            activated_at: None,
            app_version: None,
            machine_id: compute_machine_id(),
            expiry: None,
            license_code: None,
        }),
    }
}

/// 注销授权（需要登录鉴权）
#[tauri::command]
pub fn revoke_license(app: tauri::AppHandle, db: State<'_, DbState>, token: String) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    delete_license_state(&app)?;

    record_license_log(&conn, "license_revoke", "授权已注销", None);

    Ok(())
}

/// 获取授权验证日志（需要鉴权）
#[derive(Deserialize)]
pub struct GetLicenseLogsParams {
    pub page: Option<i32>,
    pub page_size: Option<i32>,
}

#[derive(Serialize)]
pub struct LicenseLogItem {
    pub id: String,
    pub action_type: String,
    pub action: String,
    pub detail: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct GetLicenseLogsResult {
    pub items: Vec<LicenseLogItem>,
    pub total: i32,
}

#[tauri::command]
pub fn get_license_logs(
    db: State<'_, DbState>,
    token: String,
    params: GetLicenseLogsParams,
) -> Result<GetLicenseLogsResult, String> {
    let conn = get_conn(&db)?;

    // 鉴权：需要登录且有系统日志或设置权限
    let ctx = verify_and_get_context(&conn, &token)?;
    let has_perm = ctx.is_super_admin
        || ctx.require_permission("system_log").is_ok()
        || ctx.require_permission("settings").is_ok();
    if !has_perm {
        return Err("您没有执行此操作的权限".to_string());
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let total: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM operation_logs WHERE module = '授权管理'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let mut stmt = conn
        .prepare(
            "SELECT id, action_type, action, detail, created_at FROM operation_logs WHERE module = '授权管理' ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| format!("查询日志失败: {}", e))?;

    let items: Vec<LicenseLogItem> = stmt
        .query_map(params![page_size, offset], |row| {
            Ok(LicenseLogItem {
                id: row.get(0)?,
                action_type: row.get(1).unwrap_or_default(),
                action: row.get(2)?,
                detail: row.get(3).unwrap_or_default(),
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("映射日志失败: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(GetLicenseLogsResult { items, total })
}

// ==================== 测试 ====================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_machine_id_consistency() {
        let id1 = compute_machine_id();
        let id2 = compute_machine_id();
        assert_eq!(id1, id2);
        assert_eq!(id1.len(), 16);
    }

    #[test]
    fn test_license_sign_and_verify() {
        let payload = LicensePayload {
            machine_id: "test_machine_1234".to_string(),
            expiry: "2099-12-31".to_string(),
            issued_at: "2025-07-15".to_string(),
        };

        let code = generate_license_code(&payload);
        let parsed = parse_and_verify_license(&code).expect("verification should succeed");

        assert_eq!(parsed.machine_id, payload.machine_id);
        assert_eq!(parsed.expiry, payload.expiry);
        assert_eq!(parsed.issued_at, payload.issued_at);
    }

    #[test]
    fn test_license_tamper_detection() {
        let payload = LicensePayload {
            machine_id: "test_machine_1234".to_string(),
            expiry: "2099-12-31".to_string(),
            issued_at: "2025-07-15".to_string(),
        };

        let code = generate_license_code(&payload);

        // 篡改 payload 部分
        let parts: Vec<&str> = code.splitn(2, '.').collect();
        let tampered_code = format!("e30=.{}", parts[1]); // e30= = "{}"
        assert!(parse_and_verify_license(&tampered_code).is_err());

        // 篡改签名部分
        let tampered_code2 = format!("{}.aaaaaaaaaaaaaaa", parts[0]);
        assert!(parse_and_verify_license(&tampered_code2).is_err());
    }

    #[test]
    fn test_expiry_check() {
        // 永久授权
        assert!(check_expiry("").is_ok());

        // 未来日期
        assert!(check_expiry("2099-12-31").is_ok());

        // 过去日期
        assert!(check_expiry("2020-01-01").is_err());
    }

    #[test]
    fn test_invalid_code_format() {
        assert!(parse_and_verify_license("invalid").is_err());
        assert!(parse_and_verify_license("only_one_part").is_err());
        assert!(parse_and_verify_license("a.b.c").is_err());
    }
}
