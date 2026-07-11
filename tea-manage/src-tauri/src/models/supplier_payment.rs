//! 供应商付款与财务流水数据模型
//!
//! 供应商付款记录、财务流水条目、余额汇总等数据结构
//! v0.3.6 供应商付款管理

use serde::{Deserialize, Serialize};

/// 供应商付款记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierPayment {
    pub id: String,
    pub supplier_id: String,
    pub purchase_order_id: Option<String>,
    pub amount: f64,
    pub payment_method: String,
    pub payment_date: String,
    pub remark: String,
    pub created_at: String,
}

/// 财务流水条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialFlowItem {
    pub id: String,
    pub flow_type: String,
    pub flow_type_name: String,
    pub order_no: Option<String>,
    pub amount: f64,
    pub balance: Option<f64>,
    pub remark: String,
    pub created_at: String,
}

/// 供应商余额汇总
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierBalance {
    /// 采购总额
    pub total_purchase: f64,
    /// 已付总额
    pub total_paid: f64,
    /// 退货总额
    pub total_return: f64,
    /// 欠款余额 = total_purchase - total_paid - total_return
    pub balance: f64,
}

/// 创建付款输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentInput {
    pub supplier_id: String,
    #[serde(default)]
    pub purchase_order_id: Option<String>,
    pub amount: f64,
    pub payment_method: String,
    pub payment_date: String,
    #[serde(default)]
    pub remark: Option<String>,
}
