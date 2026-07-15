/** @file 授权码生成工具 (license-gen)
 *
 * 用途：开发者离线生成机器绑定的授权码
 *
 * 使用方法：
 *   1. 获取机器指纹（用户在激活页看到的 16 位机器码）：
 *      cargo run --bin license-gen -- machine-id
 *
 *   2. 生成授权码（开发者在收到用户的机器码后执行）：
 *      cargo run --bin license-gen -- sign --machine-id <16位机器码> [--expiry 2026-12-31]
 *
 *   3. 生成永久授权码（不限有效期）：
 *      cargo run --bin license-gen -- sign --machine-id <16位机器码>
 *
 * 示例：
 *   cargo run --bin license-gen -- sign --machine-id a1b2c3d4e5f67890 --expiry 2026-12-31
 *   cargo run --bin license-gen -- sign --machine-id a1b2c3d4e5f67890
 *
 * 输出：完整的授权码字符串，将其发送给用户在激活页输入即可。
 */

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

const LICENSE_SIGNING_KEY: &[u8] = b"guanyong_gl_license_signing_key_v2_offline";

#[derive(Serialize, Deserialize, Clone)]
struct LicensePayload {
    machine_id: String,
    #[serde(default)]
    expiry: String,
    issued_at: String,
}

fn sign_payload(payload: &LicensePayload) -> String {
    let json = serde_json::to_string(payload).unwrap_or_default();
    let mut mac = HmacSha256::new_from_slice(LICENSE_SIGNING_KEY).expect("HMAC密钥长度错误");
    mac.update(json.as_bytes());
    let sig = mac.finalize().into_bytes();
    URL_SAFE_NO_PAD.encode(sig)
}

fn generate_license_code(payload: &LicensePayload) -> String {
    let json = serde_json::to_string(payload).unwrap_or_default();
    let payload_b64 = URL_SAFE_NO_PAD.encode(json.as_bytes());
    let sig = sign_payload(payload);
    format!("{}.{}", payload_b64, sig)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.is_empty() {
        print_usage();
        return;
    }

    match args[0].as_str() {
        "sign" => {
            let mut machine_id = String::new();
            let mut expiry = String::new();

            let mut i = 1;
            while i < args.len() {
                match args[i].as_str() {
                    "--machine-id" | "-m" => {
                        i += 1;
                        if i < args.len() {
                            machine_id = args[i].clone();
                        }
                    }
                    "--expiry" | "-e" => {
                        i += 1;
                        if i < args.len() {
                            expiry = args[i].clone();
                        }
                    }
                    _ => {}
                }
                i += 1;
            }

            if machine_id.is_empty() {
                eprintln!("错误：缺少 --machine-id 参数");
                eprintln!();
                print_usage();
                std::process::exit(1);
            }

            if machine_id.len() != 16 {
                eprintln!("警告：机器码通常为 16 位字符，当前为 {} 位", machine_id.len());
            }

            let payload = LicensePayload {
                machine_id: machine_id.clone(),
                expiry: expiry.clone(),
                issued_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            };

            let code = generate_license_code(&payload);

            println!("========== 授权码生成成功 ==========");
            println!("机器码: {}", machine_id);
            if expiry.is_empty() {
                println!("有效期: 永久");
            } else {
                println!("有效期: 至 {}", expiry);
            }
            println!("签发时间: {}", payload.issued_at);
            println!();
            println!("授权码（发送给用户）:");
            println!("{}", code);
            println!("====================================");
        }
        "machine-id" => {
            // 模拟获取机器 ID
            let mac = mac_address::get_mac_address()
                .map(|m| m.to_string().replace(':', ""))
                .unwrap_or_default();
            let hostname = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_default();
            let mut hasher = Sha256::new();
            hasher.update(format!("{}{}", mac, hostname).as_bytes());
            let machine_id = format!("{:x}", hasher.finalize())[..16].to_string();
            println!("当前机器码: {}", machine_id);
        }
        "--help" | "-h" | "help" => {
            print_usage();
        }
        _ => {
            eprintln!("未知命令: {}", args[0]);
            eprintln!();
            print_usage();
            std::process::exit(1);
        }
    }
}

fn print_usage() {
    println!("管用GL 授权码生成工具");
    println!();
    println!("用法:");
    println!("  license-gen machine-id                          获取当前机器码");
    println!("  license-gen sign --machine-id <ID> [--expiry D] 生成授权码");
    println!();
    println!("参数:");
    println!("  -m, --machine-id <ID>   机器码（16位十六进制字符）");
    println!("  -e, --expiry <DATE>     有效期（YYYY-MM-DD 格式，不填为永久）");
    println!();
    println!("示例:");
    println!("  license-gen sign --machine-id a1b2c3d4e5f67890 --expiry 2026-12-31");
    println!("  license-gen sign --machine-id a1b2c3d4e5f67890");
}
