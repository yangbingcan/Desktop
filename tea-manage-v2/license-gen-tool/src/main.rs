#![windows_subsystem = "windows"]

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::NaiveDate;
use eframe::egui;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

const LICENSE_SIGNING_KEY: &[u8] = b"guanyong_gl_license_signing_key_v2_offline";

// ==================== 主题 ====================

#[derive(Clone, Copy)]
struct Theme {
    bg: egui::Color32,
    card_bg: egui::Color32,
    primary: egui::Color32,
    success: egui::Color32,
    danger: egui::Color32,
    warning: egui::Color32,
    text: egui::Color32,
    text_dim: egui::Color32,
    border: egui::Color32,
    input_bg: egui::Color32,
}

impl Theme {
    fn light() -> Self {
        Self {
            bg: egui::Color32::from_rgb(245, 247, 250),
            card_bg: egui::Color32::from_rgb(255, 255, 255),
            primary: egui::Color32::from_rgb(64, 120, 242),
            success: egui::Color32::from_rgb(34, 170, 100),
            danger: egui::Color32::from_rgb(230, 80, 80),
            warning: egui::Color32::from_rgb(200, 140, 0),
            text: egui::Color32::from_rgb(32, 36, 48),
            text_dim: egui::Color32::from_rgb(120, 128, 140),
            border: egui::Color32::from_rgb(225, 230, 238),
            input_bg: egui::Color32::from_rgb(250, 251, 253),
        }
    }
}

// ==================== 授权码数据结构 ====================

/// 授权码 Payload（编码在授权码中的明文数据）
/// 授权码 = BASE64URL(payload_json).BASE64URL(hmac_signature)
/// 授权码是自包含的：从授权码可解析出 machine_id、expiry、issued_at
#[derive(Serialize, Deserialize, Clone)]
struct LicensePayload {
    machine_id: String,
    #[serde(default)]
    expiry: String,
    issued_at: String,
}

fn sign_payload(payload: &LicensePayload) -> String {
    let json = serde_json::to_string(payload).unwrap_or_default();
    let mut mac = HmacSha256::new_from_slice(LICENSE_SIGNING_KEY).expect("HMAC key error");
    mac.update(json.as_bytes());
    URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
}

/// 生成授权码：机器码 + 有效期 → 授权码
fn generate_license_code(payload: &LicensePayload) -> String {
    let json = serde_json::to_string(payload).unwrap_or_default();
    let payload_b64 = URL_SAFE_NO_PAD.encode(json.as_bytes());
    format!("{}.{}", payload_b64, sign_payload(payload))
}

/// 解析授权码：授权码 → (Payload, 签名是否有效)
fn parse_license_code(code: &str) -> Result<(LicensePayload, bool), String> {
    let parts: Vec<&str> = code.splitn(2, '.').collect();
    if parts.len() != 2 {
        return Err("格式错误（缺少签名部分）".into());
    }
    let payload_bytes = URL_SAFE_NO_PAD
        .decode(parts[0])
        .map_err(|_| "Base64 解码失败".to_string())?;
    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|_| "JSON 解析失败".to_string())?;

    let mut mac = HmacSha256::new_from_slice(LICENSE_SIGNING_KEY).unwrap();
    let json = serde_json::to_string(&payload).unwrap_or_default();
    mac.update(json.as_bytes());
    let sig_bytes = URL_SAFE_NO_PAD.decode(parts[1]).unwrap_or_default();
    let sig_valid = mac.verify_slice(&sig_bytes).is_ok();

    Ok((payload, sig_valid))
}

fn validate_date(date: &str) -> bool {
    date.is_empty() || NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok()
}

fn is_expired(expiry: &str) -> bool {
    if expiry.is_empty() { return false; }
    chrono::Local::now().format("%Y-%m-%d").to_string().as_str() > expiry
}

/// 判断输入是授权码还是机器码
/// - 含 `.` 且长度 > 30 → 授权码
/// - 否则 → 机器码
fn detect_input_type(input: &str) -> InputType {
    if input.contains('.') && input.len() > 30 {
        InputType::LicenseCode
    } else {
        InputType::MachineId
    }
}

#[derive(PartialEq, Clone, Copy)]
enum InputType { LicenseCode, MachineId }

// ==================== 解析结果 ====================

/// 统一的解析结果：不管是授权码还是机器码，都返回这些字段
#[derive(Clone)]
struct ParseResult {
    /// 输入类型
    input_type: InputType,
    /// 机器码（两种输入都能得到）
    machine_id: String,
    /// 有效期（机器码输入时为 None）
    expiry: Option<String>,
    /// 签发时间（机器码输入时为 None）
    issued_at: Option<String>,
    /// 签名是否有效（机器码输入时为 None）
    sig_valid: Option<bool>,
    /// 是否过期（机器码输入时为 None）
    expired: Option<bool>,
}

// ==================== 标签页 ====================

#[derive(PartialEq, Clone, Copy)]
enum Tab { Generate, Batch, Parse, Help }

struct App {
    theme: Theme,
    tab: Tab,
    // 生成
    machine_id: String,
    expiry: String,
    permanent: bool,
    generated_code: String,
    gen_message: String,
    gen_success: bool,
    // 解析
    parse_input: String,
    parse_result: Option<ParseResult>,
    parse_message: String,
    // 批量生成
    batch_input: String,
    batch_expiry: String,
    batch_permanent: bool,
    batch_results: Vec<(String, String)>, // (machine_id, license_code)
    batch_message: String,
    batch_success: bool,
    // 剪贴板
    clipboard_msg: String,
    clipboard_timer: f32,
}

impl App {
    fn new() -> Self {
        Self {
            theme: Theme::light(),
            tab: Tab::Generate,
            machine_id: String::new(),
            expiry: String::new(),
            permanent: true,
            generated_code: String::new(),
            gen_message: String::new(),
            gen_success: false,
            parse_input: String::new(),
            parse_result: None,
            parse_message: String::new(),
            batch_input: String::new(),
            batch_expiry: String::new(),
            batch_permanent: true,
            batch_results: Vec::new(),
            batch_message: String::new(),
            batch_success: false,
            clipboard_msg: String::new(),
            clipboard_timer: 0.0,
        }
    }

    fn do_generate(&mut self) {
        let mid = self.machine_id.trim().to_string();
        if mid.is_empty() {
            self.gen_message = "❌ 请输入机器码".into();
            self.gen_success = false;
            self.generated_code.clear();
            return;
        }
        if mid.len() != 16 {
            self.gen_message = format!("⚠️ 机器码通常为 16 位，当前为 {} 位，仍可继续生成", mid.len());
            self.gen_success = false;
        } else {
            self.gen_message.clear();
        }
        let exp = if self.permanent {
            String::new()
        } else {
            let e = self.expiry.trim().to_string();
            if !validate_date(&e) {
                self.gen_message = "❌ 日期格式错误，请使用 YYYY-MM-DD".into();
                self.gen_success = false;
                self.generated_code.clear();
                return;
            }
            e
        };
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let payload = LicensePayload {
            machine_id: mid,
            expiry: exp,
            issued_at: now,
        };
        self.generated_code = generate_license_code(&payload);
        if self.gen_message.is_empty() {
            self.gen_message = "✅ 授权码生成成功！".into();
            self.gen_success = true;
        }
    }

    /// 智能解析：自动识别输入是授权码还是机器码
    fn do_parse(&mut self) {
        let input = self.parse_input.trim().to_string();
        if input.is_empty() {
            self.parse_message = "❌ 请输入授权码或机器码".into();
            self.parse_result = None;
            return;
        }

        let input_type = detect_input_type(&input);

        match input_type {
            InputType::LicenseCode => {
                // 按授权码解析
                match parse_license_code(&input) {
                    Ok((payload, sig_valid)) => {
                        let expired = is_expired(&payload.expiry);
                        self.parse_result = Some(ParseResult {
                            input_type: InputType::LicenseCode,
                            machine_id: payload.machine_id,
                            expiry: Some(payload.expiry),
                            issued_at: Some(payload.issued_at),
                            sig_valid: Some(sig_valid),
                            expired: Some(expired),
                        });
                        self.parse_message.clear();
                    }
                    Err(e) => {
                        // 解析失败，可能是格式不对，尝试当机器码处理
                        self.parse_result = Some(ParseResult {
                            input_type: InputType::MachineId,
                            machine_id: input.clone(),
                            expiry: None,
                            issued_at: None,
                            sig_valid: None,
                            expired: None,
                        });
                        self.parse_message = format!("⚠️ 授权码解析失败（{}），已按机器码处理", e);
                    }
                }
            }
            InputType::MachineId => {
                // 按机器码处理
                self.parse_result = Some(ParseResult {
                    input_type: InputType::MachineId,
                    machine_id: input.clone(),
                    expiry: None,
                    issued_at: None,
                    sig_valid: None,
                    expired: None,
                });
                self.parse_message.clear();
            }
        }
    }

    /// 批量生成：分行解析机器码，统一有效期，批量生成
    fn do_batch_generate(&mut self) {
        let exp = if self.batch_permanent {
            String::new()
        } else {
            let e = self.batch_expiry.trim().to_string();
            if !validate_date(&e) {
                self.batch_message = "❌ 日期格式错误，请使用 YYYY-MM-DD".into();
                self.batch_success = false;
                self.batch_results.clear();
                return;
            }
            e
        };

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let ids: Vec<String> = self.batch_input
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();

        if ids.is_empty() {
            self.batch_message = "❌ 请输入至少一个机器码（每行一个）".into();
            self.batch_success = false;
            self.batch_results.clear();
            return;
        }

        self.batch_results.clear();
        for mid in &ids {
            let payload = LicensePayload {
                machine_id: mid.clone(),
                expiry: exp.clone(),
                issued_at: now.clone(),
            };
            self.batch_results.push((mid.clone(), generate_license_code(&payload)));
        }

        let total = self.batch_results.len();
        self.batch_message = format!("✅ 批量生成完成！共 {} 个授权码", total);
        self.batch_success = true;
    }

    fn copy_to_clipboard(&mut self, text: &str, ctx: &egui::Context) {
        ctx.copy_text(text.to_string());
        self.clipboard_msg = "✅ 已复制到剪贴板".into();
        self.clipboard_timer = 2.0;
    }

    fn card_frame(theme: Theme) -> egui::Frame {
        egui::Frame::group(&egui::Style::default())
            .fill(theme.card_bg)
            .stroke(egui::Stroke::new(1.0, theme.border))
            .rounding(egui::Rounding::same(12.0))
            .inner_margin(egui::Margin::same(20.0))
    }

    fn code_frame(theme: Theme) -> egui::Frame {
        egui::Frame::group(&egui::Style::default())
            .fill(egui::Color32::from_rgb(248, 250, 252))
            .stroke(egui::Stroke::new(1.0, theme.border))
            .rounding(egui::Rounding::same(8.0))
            .inner_margin(egui::Margin::same(16.0))
    }

    fn tab_button(&mut self, ui: &mut egui::Ui, tab: Tab, label: &str) {
        let active = self.tab == tab;
        let (bg, fg) = if active { (self.theme.primary, egui::Color32::WHITE) } else { (egui::Color32::TRANSPARENT, self.theme.text_dim) };
        let mut text = egui::RichText::new(label).size(14.0).color(fg);
        if active { text = text.strong(); }
        let btn = egui::Button::new(text).fill(bg).frame(true).rounding(egui::Rounding::same(8.0)).min_size(egui::vec2(130.0, 30.0));
        if ui.add(btn).clicked() { self.tab = tab; }
        ui.add_space(4.0);
    }

    fn card(ui: &mut egui::Ui, title: &str, theme: Theme, content: impl FnOnce(&mut egui::Ui)) {
        let frame = Self::card_frame(theme);
        frame.show(ui, |ui| {
            ui.set_min_width(580.0);
            ui.set_max_width(580.0);
            ui.label(egui::RichText::new(title).size(17.0).color(theme.text).strong());
            ui.add_space(12.0);
            ui.separator();
            ui.add_space(4.0);
            content(ui);
        });
    }

    fn help_section(&self, ui: &mut egui::Ui, title: &str, content: impl FnOnce(&mut egui::Ui)) {
        ui.label(egui::RichText::new(title).size(15.0).color(self.theme.primary).strong());
        ui.add_space(6.0);
        content(ui);
    }

    fn help_item(&self, ui: &mut egui::Ui, num: &str, text: &str) {
        ui.horizontal(|ui| {
            ui.add_space(8.0);
            ui.label(egui::RichText::new(format!("{:>2}", num)).size(13.0).color(self.theme.primary).strong().monospace());
            ui.add_space(8.0);
            ui.label(egui::RichText::new(text).size(13.0).color(self.theme.text));
        });
        ui.add_space(2.0);
    }

    // ==================== 生成标签页 ====================

    fn render_generate_tab(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        ui.add_space(16.0);
        ui.vertical_centered(|ui| {
            ui.set_max_width(640.0);
            ui.horizontal(|ui| {
                ui.add_space(16.0);
                ui.vertical(|ui| {
                    Self::card(ui, "生成授权码（机器码 → 授权码）", self.theme, |ui| {
                        ui.add_space(8.0);
                        ui.label(egui::RichText::new("机器码").size(14.0).color(self.theme.text).strong());
                        ui.add_space(4.0);
                        let mid_resp = ui.add(
                            egui::TextEdit::singleline(&mut self.machine_id)
                                .hint_text("请输入用户提供的 16 位机器码")
                                .desired_width(560.0)
                                .min_size(egui::vec2(560.0, 40.0))
                                .font(egui::TextStyle::Monospace),
                        );
                        ui.add_space(16.0);
                        ui.label(egui::RichText::new("有效期").size(14.0).color(self.theme.text).strong());
                        ui.add_space(6.0);
                        ui.horizontal(|ui| {
                            let perm_cb = ui.checkbox(&mut self.permanent, "永久授权");
                            if perm_cb.clicked() && self.permanent { self.expiry.clear(); }
                            ui.add_space(20.0);
                            ui.label(egui::RichText::new("到期日期").size(13.0).color(self.theme.text_dim));
                            ui.add_enabled_ui(!self.permanent, |ui| {
                                ui.add(
                                    egui::TextEdit::singleline(&mut self.expiry)
                                        .hint_text("YYYY-MM-DD")
                                        .desired_width(160.0)
                                        .min_size(egui::vec2(160.0, 30.0)),
                                );
                            });
                            if ui.button("📅 +1年").clicked() {
                                self.expiry = (chrono::Local::now().naive_local() + chrono::Duration::days(365)).format("%Y-%m-%d").to_string();
                                self.permanent = false;
                            }
                            if ui.button("📅 +2年").clicked() {
                                self.expiry = (chrono::Local::now().naive_local() + chrono::Duration::days(730)).format("%Y-%m-%d").to_string();
                                self.permanent = false;
                            }
                        });
                        ui.add_space(20.0);
                        let gen_btn = egui::Button::new(
                            egui::RichText::new("  🔑  生成授权码  ").size(16.0).color(egui::Color32::WHITE).strong(),
                        )
                        .fill(self.theme.primary)
                        .rounding(egui::Rounding::same(8.0))
                        .min_size(egui::vec2(600.0, 44.0));
                        if ui.add(gen_btn).clicked() { self.do_generate(); }
                        if mid_resp.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) { self.do_generate(); }
                        ui.add_space(16.0);

                        if !self.gen_message.is_empty() {
                            let color = if self.gen_success { self.theme.success }
                                else if self.gen_message.starts_with('⚠') { self.theme.warning }
                                else { self.theme.danger };
                            ui.label(egui::RichText::new(&self.gen_message).size(14.0).color(color));
                            ui.add_space(8.0);
                        }

                        if !self.generated_code.is_empty() {
                            let frame = Self::code_frame(self.theme);
                            frame.show(ui, |ui| {
                                ui.label(egui::RichText::new("授权码：").size(13.0).color(self.theme.text_dim));
                                ui.add_space(6.0);
                                let mut code = self.generated_code.clone();
                                ui.add(
                                    egui::TextEdit::multiline(&mut code)
                                        .desired_width(560.0)
                                        .desired_rows(3)
                                        .font(egui::TextStyle::Monospace)
                                        .interactive(false),
                                );
                                ui.add_space(12.0);
                                ui.horizontal(|ui| {
                                    let copy_btn = egui::Button::new(
                                        egui::RichText::new("📋  复制授权码").size(14.0).color(egui::Color32::WHITE),
                                    )
                                    .fill(self.theme.success)
                                    .rounding(egui::Rounding::same(6.0))
                                    .min_size(egui::vec2(140.0, 36.0));
                                    if ui.add(copy_btn).clicked() {
                                        let code = self.generated_code.clone();
                                        self.copy_to_clipboard(&code, ctx);
                                    }
                                    ui.add_space(8.0);
                                    let save_btn = egui::Button::new(
                                        egui::RichText::new("💾  保存到文件").size(14.0).color(self.theme.text),
                                    )
                                    .fill(egui::Color32::TRANSPARENT)
                                    .stroke(egui::Stroke::new(1.0, self.theme.border))
                                    .rounding(egui::Rounding::same(6.0))
                                    .min_size(egui::vec2(140.0, 36.0));
                                    if ui.add(save_btn).clicked() {
                                        let filename = format!("license_{}.txt", self.machine_id.trim());
                                        match std::fs::write(&filename, &self.generated_code) {
                                            Ok(_) => { self.gen_message = format!("✅ 已保存到: {}", filename); self.gen_success = true; }
                                            Err(e) => { self.gen_message = format!("❌ 保存失败: {}", e); self.gen_success = false; }
                                        }
                                    }
                                });
                            });
                        }
                    });
                    ui.add_space(16.0);
                });
            });
        });
        ui.add_space(16.0);
    }

    // ==================== 批量生成标签页 ====================

    fn render_batch_tab(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        ui.add_space(16.0);
        ui.vertical_centered(|ui| {
            ui.set_max_width(640.0);
            ui.horizontal(|ui| {
                ui.add_space(16.0);
                ui.vertical(|ui| {
                    Self::card(ui, "批量生成授权码（多个机器码 → 多个授权码）", self.theme, |ui| {
                        ui.add_space(8.0);
                        ui.label(egui::RichText::new(
                            "每行输入一个机器码，统一设置有效期后一键批量生成"
                        ).size(12.0).color(self.theme.text_dim));
                        ui.add_space(12.0);
                        ui.label(egui::RichText::new("机器码列表（每行一个）").size(14.0).color(self.theme.text).strong());
                        ui.add_space(4.0);
                        let batch_resp = ui.add(
                            egui::TextEdit::multiline(&mut self.batch_input)
                                .hint_text("粘贴多个机器码，每行一个\n例如:\nA1B2C3D4E5F6G7H8\n16位机器码...")
                                .desired_width(560.0)
                                .desired_rows(6)
                                .font(egui::TextStyle::Monospace),
                        );
                        ui.add_space(16.0);
                        ui.label(egui::RichText::new("有效期（统一设置）").size(14.0).color(self.theme.text).strong());
                        ui.add_space(6.0);
                        ui.horizontal(|ui| {
                            let perm_cb = ui.checkbox(&mut self.batch_permanent, "永久授权");
                            if perm_cb.clicked() && self.batch_permanent { self.batch_expiry.clear(); }
                            ui.add_space(20.0);
                            ui.label(egui::RichText::new("到期日期").size(13.0).color(self.theme.text_dim));
                            ui.add_enabled_ui(!self.batch_permanent, |ui| {
                                ui.add(
                                    egui::TextEdit::singleline(&mut self.batch_expiry)
                                        .hint_text("YYYY-MM-DD")
                                        .desired_width(160.0)
                                        .min_size(egui::vec2(160.0, 30.0)),
                                );
                            });
                            if ui.button("📅 +1年").clicked() {
                                self.batch_expiry = (chrono::Local::now().naive_local() + chrono::Duration::days(365)).format("%Y-%m-%d").to_string();
                                self.batch_permanent = false;
                            }
                            if ui.button("📅 +2年").clicked() {
                                self.batch_expiry = (chrono::Local::now().naive_local() + chrono::Duration::days(730)).format("%Y-%m-%d").to_string();
                                self.batch_permanent = false;
                            }
                        });
                        ui.add_space(20.0);

                        // 统计行数提示
                        let line_count = self.batch_input.lines().filter(|l| !l.trim().is_empty()).count();
                        if line_count > 0 {
                            ui.label(egui::RichText::new(format!("📊 检测到 {} 个机器码", line_count)).size(12.0).color(self.theme.text_dim));
                            ui.add_space(4.0);
                        }

                        let batch_btn = egui::Button::new(
                            egui::RichText::new("  🔑  批量生成授权码  ").size(16.0).color(egui::Color32::WHITE).strong(),
                        )
                        .fill(self.theme.primary)
                        .rounding(egui::Rounding::same(8.0))
                        .min_size(egui::vec2(600.0, 44.0));
                        if ui.add(batch_btn).clicked() { self.do_batch_generate(); }
                        if batch_resp.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) && ui.input(|i| i.modifiers.ctrl) {
                            self.do_batch_generate();
                        }
                        ui.add_space(16.0);

                        if !self.batch_message.is_empty() {
                            let color = if self.batch_success { self.theme.success } else { self.theme.danger };
                            ui.label(egui::RichText::new(&self.batch_message).size(14.0).color(color));
                            ui.add_space(8.0);
                        }

                        // 批量结果
                        if !self.batch_results.is_empty() {
                            let theme = self.theme;
                            let frame = Self::code_frame(theme);
                            frame.show(ui, |ui| {
                                ui.horizontal(|ui| {
                                    ui.label(egui::RichText::new(format!("📋 生成结果（共 {} 条）", self.batch_results.len())).size(14.0).color(theme.text).strong());
                                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                        // 复制全部
                                        let copy_all_btn = egui::Button::new(
                                            egui::RichText::new("📋  复制全部").size(13.0).color(egui::Color32::WHITE),
                                        )
                                        .fill(theme.success)
                                        .rounding(egui::Rounding::same(6.0))
                                        .min_size(egui::vec2(100.0, 30.0));
                                        if ui.add(copy_all_btn).clicked() {
                                            let all = self.batch_results.iter()
                                                .map(|(mid, code)| format!("{}\t{}", mid, code))
                                                .collect::<Vec<_>>()
                                                .join("\n");
                                            self.copy_to_clipboard(&all, ctx);
                                        }
                                        ui.add_space(8.0);
                                        // 保存全部
                                        let save_all_btn = egui::Button::new(
                                            egui::RichText::new("💾  保存到文件").size(13.0).color(theme.text),
                                        )
                                        .fill(egui::Color32::TRANSPARENT)
                                        .stroke(egui::Stroke::new(1.0, theme.border))
                                        .rounding(egui::Rounding::same(6.0))
                                        .min_size(egui::vec2(100.0, 30.0));
                                        if ui.add(save_all_btn).clicked() {
                                            let now = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
                                            let filename = format!("batch_licenses_{}.txt", now);
                                            let content = self.batch_results.iter()
                                                .map(|(mid, code)| format!("机器码: {}\n授权码: {}\n", mid, code))
                                                .collect::<Vec<_>>()
                                                .join("\n");
                                            match std::fs::write(&filename, &content) {
                                                Ok(_) => { self.batch_message = format!("✅ 已保存到: {}", filename); self.batch_success = true; }
                                                Err(e) => { self.batch_message = format!("❌ 保存失败: {}", e); self.batch_success = false; }
                                            }
                                        }
                                    });
                                });
                                ui.add_space(8.0);
                                ui.separator();
                                ui.add_space(4.0);

                                // 每条结果逐行展示
                                let results = self.batch_results.clone();
                                for (i, (mid, code)) in results.iter().enumerate() {
                                    let mut do_copy_mid = false;
                                    let mut do_copy_code = false;
                                    ui.horizontal(|ui| {
                                        ui.label(egui::RichText::new(format!("{}.", i + 1)).size(12.0).color(theme.text_dim).monospace());
                                        ui.add_space(4.0);
                                        ui.label(egui::RichText::new(mid).size(12.0).color(theme.text).strong().monospace());
                                        ui.add_space(4.0);
                                        ui.label(egui::RichText::new("→").size(12.0).color(theme.text_dim));
                                        ui.add_space(4.0);
                                        // 授权码太长，截断显示
                                        let short_code = if code.len() > 40 { format!("{}...", &code[..40]) } else { code.clone() };
                                        ui.label(egui::RichText::new(&short_code).size(11.0).color(theme.text_dim).monospace());
                                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                            if ui.button(egui::RichText::new("📋 复制授权码").size(10.0)).clicked() {
                                                do_copy_code = true;
                                            }
                                            ui.add_space(4.0);
                                            if ui.button(egui::RichText::new("📋 复制机器码").size(10.0)).clicked() {
                                                do_copy_mid = true;
                                            }
                                        });
                                    });
                                    if do_copy_mid { self.copy_to_clipboard(mid, ctx); }
                                    if do_copy_code { self.copy_to_clipboard(code, ctx); }
                                    ui.add_space(2.0);
                                }
                            });
                        }
                    });
                    ui.add_space(16.0);
                });
            });
        });
        ui.add_space(16.0);
    }

    // ==================== 解析标签页（授权码 / 机器码 智能识别）====================

    fn render_parse_tab(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        ui.add_space(16.0);
        ui.vertical_centered(|ui| {
            ui.set_max_width(640.0);
            ui.horizontal(|ui| {
                ui.add_space(16.0);
                ui.vertical(|ui| {
                    Self::card(ui, "智能解析（授权码 / 机器码 自动识别）", self.theme, |ui| {
                        ui.add_space(8.0);
                        ui.label(egui::RichText::new(
                            "输入授权码或机器码，自动识别并解析出完整信息"
                        ).size(12.0).color(self.theme.text_dim));
                        ui.add_space(4.0);
                        ui.label(egui::RichText::new(
                            "• 粘贴授权码 → 解析出机器码、有效期、签发时间、签名验证、过期状态\n• 粘贴机器码 → 识别为机器码，可直接跳转生成授权码"
                        ).size(11.0).color(self.theme.text_dim));
                        ui.add_space(12.0);
                        ui.label(egui::RichText::new("输入内容").size(14.0).color(self.theme.text).strong());
                        ui.add_space(4.0);
                        let parse_resp = ui.add(
                            egui::TextEdit::multiline(&mut self.parse_input)
                                .hint_text("粘贴授权码 或 机器码（自动识别）")
                                .desired_width(560.0)
                                .desired_rows(4)
                                .font(egui::TextStyle::Monospace),
                        );
                        ui.add_space(16.0);
                        let parse_btn = egui::Button::new(
                            egui::RichText::new("  🔍  解析  ").size(15.0).color(egui::Color32::WHITE).strong(),
                        )
                        .fill(self.theme.primary)
                        .rounding(egui::Rounding::same(8.0))
                        .min_size(egui::vec2(200.0, 40.0));
                        if ui.add(parse_btn).clicked() { self.do_parse(); }
                        if parse_resp.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) { self.do_parse(); }
                        ui.add_space(12.0);

                        if !self.parse_message.is_empty() {
                            let color = if self.parse_message.starts_with('⚠') { self.theme.warning } else { self.theme.danger };
                            ui.label(egui::RichText::new(&self.parse_message).size(14.0).color(color));
                        }

                        // 渲染解析结果
                        if let Some(result) = self.parse_result.clone() {
                            ui.add_space(8.0);
                            let theme = self.theme;

                            // 输入类型标签
                            let (type_label, type_color) = match result.input_type {
                                InputType::LicenseCode => ("📦 输入类型：授权码", theme.primary),
                                InputType::MachineId => ("🖥️ 输入类型：机器码", theme.success),
                            };

                            let frame = Self::code_frame(theme);
                            frame.show(ui, |ui| {
                                ui.label(egui::RichText::new(type_label).size(14.0).color(type_color).strong());
                                ui.add_space(8.0);

                                // 机器码（两种输入都有，可复制）
                                let mut copy_mid = false;
                                ui.horizontal(|ui| {
                                    ui.label(egui::RichText::new("机器码").size(13.0).color(theme.text_dim));
                                    ui.add_space(8.0);
                                    ui.label(egui::RichText::new(&result.machine_id).size(14.0).color(theme.text).strong().monospace());
                                    ui.add_space(6.0);
                                    if ui.button(egui::RichText::new("📋 复制").size(11.0)).clicked() {
                                        copy_mid = true;
                                    }
                                });
                                if copy_mid {
                                    self.copy_to_clipboard(&result.machine_id, ctx);
                                }

                                // 如果是授权码，显示更多信息
                                if result.input_type == InputType::LicenseCode {
                                    ui.add_space(6.0);

                                    // 签发时间
                                    if let Some(ref issued_at) = result.issued_at {
                                        ui.horizontal(|ui| {
                                            ui.label(egui::RichText::new("签发时间").size(13.0).color(theme.text_dim));
                                            ui.add_space(8.0);
                                            ui.label(egui::RichText::new(issued_at).size(14.0).color(theme.text).strong());
                                        });
                                    }
                                    ui.add_space(6.0);

                                    // 签名验证
                                    if let Some(sig_valid) = result.sig_valid {
                                        let (sc, st) = if sig_valid {
                                            (theme.success, "✅ 签名有效")
                                        } else {
                                            (theme.danger, "❌ 签名无效（被篡改或密钥不匹配）")
                                        };
                                        ui.horizontal(|ui| {
                                            ui.label(egui::RichText::new("签名验证").size(13.0).color(theme.text_dim));
                                            ui.add_space(8.0);
                                            ui.label(egui::RichText::new(st).size(14.0).color(sc).strong());
                                        });
                                    }
                                    ui.add_space(6.0);

                                    // 过期状态
                                    if let Some(ref expiry) = result.expiry {
                                        let et_owned = if expiry.is_empty() {
                                            "♾️ 永久授权".to_string()
                                        } else if result.expired == Some(true) {
                                            format!("❌ 已过期（到期日: {}）", expiry)
                                        } else {
                                            format!("✅ 未过期（到期日: {}）", expiry)
                                        };
                                        let ec = if expiry.is_empty() || result.expired == Some(false) {
                                            theme.success
                                        } else {
                                            theme.danger
                                        };
                                        ui.horizontal(|ui| {
                                            ui.label(egui::RichText::new("过期状态").size(13.0).color(theme.text_dim));
                                            ui.add_space(8.0);
                                            ui.label(egui::RichText::new(&et_owned).size(14.0).color(ec).strong());
                                        });
                                    }
                                } else {
                                    // 机器码输入：提示无法获取过期信息
                                    ui.add_space(6.0);
                                    ui.horizontal(|ui| {
                                        ui.label(egui::RichText::new("有效期").size(13.0).color(theme.text_dim));
                                        ui.add_space(8.0);
                                        ui.label(egui::RichText::new("—（机器码不含有效期信息，需通过授权码解析）").size(13.0).color(theme.text_dim));
                                    });
                                    ui.add_space(6.0);
                                    ui.horizontal(|ui| {
                                        ui.label(egui::RichText::new("过期状态").size(13.0).color(theme.text_dim));
                                        ui.add_space(8.0);
                                        ui.label(egui::RichText::new("—（需输入授权码才能查看）").size(13.0).color(theme.text_dim));
                                    });
                                }

                                // 操作按钮
                                ui.add_space(12.0);
                                let mut do_copy = false;
                                let mut do_gen = false;
                                ui.horizontal(|ui| {
                                    let copy_btn = egui::Button::new(
                                        egui::RichText::new("📋  复制机器码").size(13.0).color(egui::Color32::WHITE),
                                    )
                                    .fill(theme.success)
                                    .rounding(egui::Rounding::same(6.0))
                                    .min_size(egui::vec2(120.0, 32.0));
                                    if ui.add(copy_btn).clicked() { do_copy = true; }

                                    ui.add_space(8.0);

                                    let gen_btn = egui::Button::new(
                                        egui::RichText::new("🔑  用此机器码生成授权码").size(13.0).color(theme.text),
                                    )
                                    .fill(egui::Color32::TRANSPARENT)
                                    .stroke(egui::Stroke::new(1.0, theme.border))
                                    .rounding(egui::Rounding::same(6.0))
                                    .min_size(egui::vec2(200.0, 32.0));
                                    if ui.add(gen_btn).clicked() { do_gen = true; }
                                });
                                if do_copy {
                                    self.copy_to_clipboard(&result.machine_id, ctx);
                                }
                                if do_gen {
                                    self.machine_id = result.machine_id.clone();
                                    self.tab = Tab::Generate;
                                    self.generated_code.clear();
                                    self.gen_message.clear();
                                }
                            });
                        }
                    });
                    ui.add_space(16.0);
                });
            });
        });
        ui.add_space(16.0);
    }

    // ==================== 帮助标签页 ====================

    fn render_help_tab(&mut self, ui: &mut egui::Ui) {
        ui.add_space(16.0);
        ui.vertical_centered(|ui| {
            ui.set_max_width(640.0);
            ui.horizontal(|ui| {
                ui.add_space(16.0);
                ui.vertical(|ui| {
                    Self::card(ui, "使用说明", self.theme, |ui| {
                        ui.add_space(8.0);
                        self.help_section(ui, "📋 工作流程", |ui| {
                            self.help_item(ui, "1", "用户打开应用 → 进入激活页面");
                            self.help_item(ui, "2", "用户复制 16 位机器码并发送给你");
                            self.help_item(ui, "3", "你切换到「生成授权码」标签页");
                            self.help_item(ui, "4", "输入用户的机器码，选择有效期");
                            self.help_item(ui, "5", "点击「生成授权码」按钮");
                            self.help_item(ui, "6", "复制生成的授权码发送给用户");
                            self.help_item(ui, "7", "用户在激活页粘贴授权码 → 激活成功");
                        });
                        ui.add_space(12.0);
                        self.help_section(ui, "有效期说明", |ui| {
                            self.help_item(ui, "•", "勾选「永久授权」= 永不过期");
                            self.help_item(ui, "•", "输入日期 = 到指定日期自动失效");
                            self.help_item(ui, "•", "快捷按钮可一键填充 +1年 / +2年");
                            self.help_item(ui, "•", "日期格式：YYYY-MM-DD（如 2026-12-31）");
                        });
                        ui.add_space(12.0);
                        self.help_section(ui, "📑 批量生成", |ui| {
                            self.help_item(ui, "•", "切换到「批量生成」标签页");
                            self.help_item(ui, "•", "每行粘贴一个机器码，支持任意数量");
                            self.help_item(ui, "•", "统一设置有效期（永久 / 日期 / +1年 / +2年）");
                            self.help_item(ui, "•", "点击「批量生成授权码」一键全部生成");
                            self.help_item(ui, "•", "可复制全部结果或保存到文件");
                            self.help_item(ui, "•", "每条结果也可单独复制机器码或授权码");
                        });
                        ui.add_space(12.0);
                        self.help_section(ui, "智能解析（授权码 / 机器码）", |ui| {
                            self.help_item(ui, "•", "切换到「智能解析」标签页");
                            self.help_item(ui, "•", "粘贴授权码 → 自动解析出机器码、有效期、过期状态");
                            self.help_item(ui, "•", "粘贴机器码 → 识别为机器码，可直接生成授权码");
                            self.help_item(ui, "•", "工具会自动判断输入类型，无需手动选择");
                            self.help_item(ui, "•", "可一键复制机器码或跳转到生成页");
                        });
                        ui.add_space(12.0);
                        self.help_section(ui, "🔒 安全说明", |ui| {
                            self.help_item(ui, "•", "授权码使用 HMAC-SHA256 离线签名");
                            self.help_item(ui, "•", "签名密钥内置于此工具中，与主应用配对");
                            self.help_item(ui, "•", "授权码绑定机器指纹，不可跨机器使用");
                            self.help_item(ui, "•", "授权码自包含所有信息，无需本地存储");
                            self.help_item(ui, "•", "请妥善保管此工具，避免密钥泄露");
                        });
                    });
                    ui.add_space(16.0);
                });
            });
        });
        ui.add_space(16.0);
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if self.clipboard_timer > 0.0 {
            self.clipboard_timer -= ctx.input(|i| i.stable_dt);
            if self.clipboard_timer <= 0.0 { self.clipboard_msg.clear(); }
        }

        ctx.style_mut(|s| {
            s.visuals.extreme_bg_color = self.theme.input_bg;
            s.visuals.faint_bg_color = self.theme.card_bg;
        });

        egui::TopBottomPanel::top("top_bar")
            .exact_height(64.0)
            .frame(egui::Frame { fill: self.theme.primary, ..Default::default() })
            .show(ctx, |ui| {
                ui.horizontal_centered(|ui| {
                    ui.add_space(16.0);
                    ui.label(egui::RichText::new("🔐  授权码生成工具").size(20.0).color(egui::Color32::WHITE).strong());
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.add_space(16.0);
                        ui.label(egui::RichText::new("v3.0").size(12.0).color(egui::Color32::from_rgb(200, 215, 245)));
                    });
                });
            });

        egui::TopBottomPanel::bottom("bottom_bar")
            .exact_height(28.0)
            .frame(egui::Frame { fill: self.theme.card_bg, stroke: egui::Stroke::new(1.0, self.theme.border), ..Default::default() })
            .show(ctx, |ui| {
                ui.horizontal_centered(|ui| {
                    ui.add_space(12.0);
                    if !self.clipboard_msg.is_empty() {
                        ui.label(egui::RichText::new(&self.clipboard_msg).size(11.0).color(self.theme.success));
                    } else {
                        ui.label(egui::RichText::new("HMAC-SHA256 离线签名 · 机器绑定授权 · 授权码自包含").size(11.0).color(self.theme.text_dim));
                    }
                });
            });

        egui::TopBottomPanel::top("tab_bar")
            .exact_height(42.0)
            .frame(egui::Frame { fill: self.theme.card_bg, stroke: egui::Stroke::new(1.0, self.theme.border), ..Default::default() })
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.add_space(8.0);
                    self.tab_button(ui, Tab::Generate, "✏️  生成授权码");
                    self.tab_button(ui, Tab::Batch, "📑  批量生成");
                    self.tab_button(ui, Tab::Parse, "🔍  智能解析");
                    self.tab_button(ui, Tab::Help, "📖  使用说明");
                });
            });

        egui::CentralPanel::default()
            .frame(egui::Frame { fill: self.theme.bg, ..Default::default() })
            .show(ctx, |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| match self.tab {
                    Tab::Generate => self.render_generate_tab(ui, ctx),
                    Tab::Batch => self.render_batch_tab(ui, ctx),
                    Tab::Parse => self.render_parse_tab(ui, ctx),
                    Tab::Help => self.render_help_tab(ui),
                });
            });
    }
}

fn install_chinese_fonts(ctx: &egui::Context) {
    let font_paths = [
        "C:\\Windows\\Fonts\\msyh.ttc",
        "C:\\Windows\\Fonts\\msyh.ttf",
        "C:\\Windows\\Fonts\\simhei.ttf",
        "C:\\Windows\\Fonts\\simsun.ttc",
        "C:\\Windows\\Fonts\\Deng.ttf",
    ];

    let mut font_data: Option<Vec<u8>> = None;
    for path in &font_paths {
        if let Ok(data) = std::fs::read(path) {
            font_data = Some(data);
            break;
        }
    }

    let font_data = match font_data {
        Some(d) => d,
        None => return,
    };

    let mut fonts = egui::FontDefinitions::default();
    fonts.font_data.insert(
        "chinese".to_string(),
        egui::FontData::from_owned(font_data),
    );
    fonts.families.get_mut(&egui::FontFamily::Proportional).unwrap().insert(0, "chinese".to_string());
    fonts.families.get_mut(&egui::FontFamily::Monospace).unwrap().push("chinese".to_string());
    ctx.set_fonts(fonts);
}

fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([720.0, 640.0])
            .with_min_inner_size([600.0, 500.0])
            .with_title("授权码生成工具 v3.0"),
        ..Default::default()
    };
    eframe::run_native(
        "授权码生成工具",
        options,
        Box::new(|cc| {
            install_chinese_fonts(&cc.egui_ctx);
            Ok(Box::new(App::new()))
        }),
    )
}
