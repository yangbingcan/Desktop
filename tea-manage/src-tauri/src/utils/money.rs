//! 金额四舍五入辅助工具
//!
//! 统一浮点金额在「聚合 / 落库 / 返回前端」边界的精度处理，消除 f64 累加漂移。
//!
//! 设计取舍：保留 SQLite REAL 存储（不动 schema），仅在计算边界四舍五入。
//! 适用于单机 POS 场景——所有金额均为人工录入的 2 位小数，四舍五入后
//! 显示/存储/对账均稳定，避免 0.1+0.2 类浮点误差累积导致账目不平。

/// 四舍五入模式
#[derive(Debug, Clone, Copy)]
pub enum RoundMode {
    /// 四舍五入（0.5 进位），默认模式
    HalfUp,
    /// 四舍五入不进位（0.5 舍去，向零取整的半数情形）
    HalfDown,
    /// 始终向上进位（ceil）
    Up,
    /// 始终向下截断（floor）
    Down,
}

/// 对金额按指定位数四舍五入
///
/// # 参数
/// - `value`: 原始浮点值（非有限值按 0 处理）
/// - `decimals`: 保留小数位数（如 2 表示分）
/// - `mode`: 四舍五入模式，见 [`RoundMode`]
///
/// # 返回
/// 四舍五入后的 `f64`
pub fn round_money(value: f64, decimals: u32, mode: RoundMode) -> f64 {
    if !value.is_finite() {
        return 0.0;
    }
    let factor = 10f64.powi(decimals as i32);
    let scaled = value * factor;
    let rounded = match mode {
        // (x + 0.5) 向下取整：0.5 → 进位
        RoundMode::HalfUp => (scaled + 0.5).floor(),
        // (x - 0.5) 向上取整：0.5 → 舍去（不进位）
        RoundMode::HalfDown => (scaled - 0.5).ceil(),
        RoundMode::Up => scaled.ceil(),
        RoundMode::Down => scaled.floor(),
    };
    rounded / factor
}

/// 金额默认处理：保留 2 位小数，四舍五入（0.5 进位）
///
/// 绝大多数业务场景直接调用此函数即可。
pub fn round2(value: f64) -> f64 {
    round_money(value, 2, RoundMode::HalfUp)
}
