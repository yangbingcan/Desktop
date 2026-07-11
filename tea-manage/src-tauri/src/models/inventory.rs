//! 库存相关数据结构
//! 
//! 包含库存批次、库存流水、采购入库等数据模型

use serde::{Deserialize, Serialize};

/// 库存批次
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryBatch {
    pub id: String,
    pub product_id: String,
    pub batch_code: String,
    pub purchase_price: f64,
    pub total_grams: i64,
    pub remaining_grams: i64,
    pub supplier_id: Option<String>,
    pub produced_date: Option<String>,
    pub expire_date: Option<String>,
    pub created_at: String,
}

/// 库存流水
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockFlow {
    pub id: String,
    pub product_id: String,
    pub batch_id: Option<String>,
    pub flow_type: FlowType,
    pub change_grams: i64,
    pub balance_grams: i64,
    pub order_id: Option<String>,
    pub remark: Option<String>,
    pub created_at: String,
}

/// 流水类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlowType {
    PurchaseIn,   // 采购入库
    SaleOut,      // 销售出库
    DamageOut,    // 报损出库
    ReturnOut,    // 退货出库
    AdjustIn,     // 盘点盘盈
    AdjustOut,    // 盘点盘亏
}

impl FlowType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FlowType::PurchaseIn => "purchase_in",
            FlowType::SaleOut => "sale_out",
            FlowType::DamageOut => "damage_out",
            FlowType::ReturnOut => "return_out",
            FlowType::AdjustIn => "adjust_in",
            FlowType::AdjustOut => "adjust_out",
        }
    }
}

/// 库存概览（列表项）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItem {
    pub product_id: String,
    pub product_name: String,
    pub category_name: Option<String>,
    pub product_type: String,
    pub stock_grams: i64,
    pub stock_units: i64,
    pub display_stock: String,
}

/// 商品库存详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryDetail {
    pub product_id: String,
    pub product_name: String,
    pub category_name: Option<String>,
    pub product_type: String,
    pub stock_grams: i64,
    pub stock_units: i64,
    pub batches: Vec<InventoryBatch>,
    pub recent_flows: Vec<StockFlow>,
}

/// 采购入库输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseInput {
    pub supplier_id: Option<String>,
    pub handler: Option<String>,
    pub items: Vec<PurchaseItemInput>,
    pub remark: Option<String>,
    /// 付款状态：unpaid / partial / paid，默认为 unpaid
    pub payment_status: Option<String>,
}

/// 采购单据明细输入
///
/// 🔧 v0.3.3 修复：添加 `#[serde(rename_all = "camelCase")]`
/// 修复前：后端字段默认 snake_case（product_id/unit_id/unit_price），
/// 前端发送 camelCase（productId/unitId/unitPrice），导致反序列化失败。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseItemInput {
    pub product_id: String,
    pub unit_id: String,
    pub quantity: i64,
    pub unit_price: f64,
}

/// 采购单据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseOrder {
    pub id: String,
    pub order_no: String,
    pub supplier_id: Option<String>,
    /// 供应商名称（JOIN suppliers.name）
    pub supplier_name: String,
    pub handler: Option<String>,
    pub total_amount: f64,
    /// 付款状态：unpaid / partial / paid
    pub payment_status: String,
    pub remark: Option<String>,
    pub items: Vec<PurchaseOrderItem>,
    pub created_at: String,
}

/// 采购单据明细
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseOrderItem {
    pub product_id: String,
    pub product_name: String,
    pub unit_id: String,
    pub unit_name: String,
    pub quantity: i64,
    pub grams: i64,
    pub unit_price: f64,
    pub subtotal: f64,
    pub batch_id: String,
    pub batch_code: String,
}

/// 采购单列表项（包含 JOIN 后的展示字段）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseOrderListItem {
    pub id: String,
    pub order_no: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub handler: Option<String>,
    pub total_amount: f64,
    pub payment_status: String,
    /// 该采购单包含的商品行数
    pub item_count: i64,
    pub remark: String,
    pub created_at: String,
}

/// 盘点调整输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustInput {
    pub product_id: String,
    pub grams: i64,
    pub remark: String,
}

/// 报损出库输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DamageOutInput {
    pub product_id: String,
    pub grams: i64,
    pub remark: String,
}

/// 库存变更结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockChangeResult {
    pub success: bool,
    pub product_id: String,
    pub change_grams: i64,
    pub new_balance: i64,
    pub flow_id: String,
}
