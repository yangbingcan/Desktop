//! 退货出库单数据模型
//!
//! 退给供应商场景：精确追溯到原批次
//! v0.2.0 M04 出入库闭环

use serde::{Deserialize, Serialize};

/// 退货明细输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnItemInput {
    pub product_id: String,
    pub unit_id: String,
    pub batch_id: String,
    pub quantity: i64,
}

/// 退货单输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnOrderInput {
    pub supplier_id: String,
    /// 退货日期 YYYY-MM-DD
    pub return_date: String,
    /// 退货原因：质量问题/数量超出/保质期/其他
    pub return_reason: String,
    #[serde(default)]
    pub remark: Option<String>,
    pub items: Vec<ReturnItemInput>,
}

/// 退货单明细（返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnOrderItem {
    pub id: String,
    pub order_id: String,
    pub product_id: String,
    pub product_name: String,
    pub unit_id: String,
    pub unit_name: String,
    pub batch_id: String,
    pub batch_code: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub grams: i64,
    pub subtotal: f64,
}

/// 退货单（返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnOrder {
    pub id: String,
    pub order_no: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub return_date: String,
    pub return_reason: String,
    pub total_amount: f64,
    pub remark: String,
    pub items: Vec<ReturnOrderItem>,
    pub created_at: String,
}

/// 退货单列表项（不含明细）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnOrderListItem {
    pub id: String,
    pub order_no: String,
    pub supplier_name: String,
    pub return_date: String,
    pub return_reason: String,
    pub total_amount: f64,
    pub item_count: i32,
    pub created_at: String,
}

/// 批次选项（退货选择原批次用）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchOption {
    pub id: String,
    pub batch_code: String,
    pub remaining_grams: i64,
    pub purchase_price: f64,
    pub created_at: String,
}
