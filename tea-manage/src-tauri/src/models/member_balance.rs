//! 会员储值余额数据模型
//!
//! 定义储值流水、充值输入、退款输入等结构体
//! v0.3.1 M06 储值余额功能

use serde::{Deserialize, Serialize};

/// 储值流水类型枚举
///
/// 数据库存储使用小写字符串（recharge/consume/refund），
/// serde 通过 rename_all = "lowercase" 自动转换。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BalanceChangeType {
    /// 充值
    Recharge,
    /// 消费扣款
    Consume,
    /// 退款
    Refund,
}

impl BalanceChangeType {
    /// 转换为数据库存储字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Recharge => "recharge",
            Self::Consume => "consume",
            Self::Refund => "refund",
        }
    }
}

/// 储值流水记录
///
/// 一条记录对应一次余额变动（充值/扣款/退款），
/// 通过 change_amount 正负区分加款/减款。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BalanceLog {
    /// 流水 ID（UUID）
    pub id: String,
    /// 会员 ID
    pub member_id: String,
    /// 变动类型：recharge | consume | refund
    pub change_type: String,
    /// 变动金额（正数=加款，负数=扣款/退款）
    pub change_amount: f64,
    /// 变动后余额
    pub balance_after: f64,
    /// 支付方式：cash | wechat | alipay | memberBalance
    pub payment_method: String,
    /// 操作人
    pub operator: String,
    /// 关联订单 ID（消费扣款时为销售订单 ID）
    pub related_order_id: Option<String>,
    /// 赠送金额（v0.3.1 预留字段，暂未启用）
    pub bonus_amount: f64,
    /// 手续费（v0.3.1 预留字段，暂未启用）
    pub fee_amount: f64,
    /// 备注
    pub remark: String,
    /// 创建时间（ISO8601 格式）
    pub created_at: String,
}

/// 会员充值输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RechargeInput {
    /// 会员 ID
    pub member_id: String,
    /// 充值金额，必须 > 0
    pub amount: f64,
    /// 支付方式：cash | wechat | alipay
    pub payment_method: String,
    /// 操作人
    pub operator: String,
    /// 备注（可选）
    #[serde(default)]
    pub remark: Option<String>,
    /// 赠送金额（v0.3.1 预留，暂不启用）
    #[serde(default)]
    pub bonus_amount: f64,
}

/// 会员充值结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RechargeResult {
    /// 流水 ID
    pub log_id: String,
    /// 充值后新余额
    pub new_balance: f64,
    /// 充值时间
    pub created_at: String,
}

/// 会员退款输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundInput {
    /// 会员 ID
    pub member_id: String,
    /// 退款金额，必须 > 0 且 ≤ 当前余额
    pub amount: f64,
    /// 退款支付方式：cash | wechat | alipay
    pub payment_method: String,
    /// 操作人
    pub operator: String,
    /// 退款原因（必填，至少 5 个字符）
    pub remark: String,
}

/// 会员退款结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundResult {
    /// 流水 ID
    pub log_id: String,
    /// 退款后剩余余额
    pub new_balance: f64,
    /// 退款时间
    pub created_at: String,
}
