//! 销售相关数据结构
//! 
//! 包含销售订单、销售明细、会员等数据模型

use rusqlite::Row;
use serde::{Deserialize, Serialize};

/// 会员等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemberLevel {
    Normal,  // 普通
    Silver,  // 银卡
    Gold,    // 金卡
}

impl MemberLevel {
    /// 从数据库字符串解析会员等级
    pub fn from_db_str(s: &str) -> Self {
        match s {
            "silver" => MemberLevel::Silver,
            "gold" => MemberLevel::Gold,
            _ => MemberLevel::Normal,
        }
    }

    /// 获取折扣率
    pub fn discount_rate(&self) -> f64 {
        match self {
            MemberLevel::Normal => 1.0,   // 100%
            MemberLevel::Silver => 0.95,  // 95%
            MemberLevel::Gold => 0.90,    // 90%
        }
    }
    
    pub fn as_str(&self) -> &'static str {
        match self {
            MemberLevel::Normal => "normal",
            MemberLevel::Silver => "silver",
            MemberLevel::Gold => "gold",
        }
    }

    /// 根据累计消费金额自动判断会员等级
    pub fn from_total_consume(total_consume: f64) -> Self {
        if total_consume >= 5000.0 {
            MemberLevel::Gold
        } else if total_consume >= 1000.0 {
            MemberLevel::Silver
        } else {
            MemberLevel::Normal
        }
    }
}

/// 会员
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub gender: Option<String>,
    pub birthday: Option<String>,
    pub level: MemberLevel,
    pub points: i64,
    pub balance: f64,
    pub total_consume: f64,
    pub consume_count: i64,
    pub last_visit: Option<String>,
    pub created_at: String,
}

impl Member {
    /// 从数据库行构造 Member，统一转换逻辑避免重复代码
    pub fn from_row(row: &Row) -> Result<Self, rusqlite::Error> {
        let level_str: String = row.get(5)?;
        let level = MemberLevel::from_db_str(&level_str);
        Ok(Member {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            gender: row.get(3)?,
            birthday: row.get(4)?,
            level,
            points: row.get(6)?,
            balance: row.get(7)?,
            total_consume: row.get(8)?,
            consume_count: row.get(9)?,
            last_visit: row.get(10)?,
            created_at: row.get(11)?,
        })
    }
}

/// 会员输入（创建）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberInput {
    pub name: String,
    pub phone: String,
    pub gender: Option<String>,
    pub birthday: Option<String>,
}

/// 会员更新输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberUpdate {
    pub name: Option<String>,
    pub gender: Option<String>,
    pub birthday: Option<String>,
    pub level: Option<MemberLevel>,
}

/// 销售订单输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleOrderInput {
    pub items: Vec<SaleItemInput>,
    pub member_id: Option<String>,
    /// 是否应用会员折扣（受系统「启用会员折扣」开关控制，由前端按开关状态传入）
    pub apply_member_discount: Option<bool>,
    pub points_deduct: Option<i64>,
    pub pay_method: Option<String>,
    pub remark: Option<String>,
}

/// 销售明细输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleItemInput {
    pub product_id: String,
    pub unit_id: String,
    pub quantity: i64,
}

/// 销售订单
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleOrder {
    pub id: String,
    pub order_no: String,
    pub member_id: Option<String>,
    pub member_name: Option<String>,
    pub total_amount: f64,
    pub discount_amount: f64,
    pub points_deduct: i64,
    pub points_earned: i64,
    pub actual_amount: f64,
    pub pay_method: Option<String>,
    pub pay_status: String,
    pub status: String,
    pub remark: Option<String>,
    pub items: Vec<SaleOrderItem>,
    pub created_at: String,
}

/// 销售明细
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleOrderItem {
    pub id: String,
    pub order_id: String,
    pub product_id: String,
    pub product_name: String,
    pub unit_name: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub grams: i64,
    pub subtotal: f64,
}

/// 支付方式
///
/// 🔧 v0.3.3 修复：枚举值统一为前端字面量
/// - Cash/Wechat/Alipay 通过 rename_all="lowercase" 序列化为小写（与前端一致）
/// - MemberCard 序列化为 "memberBalance"（覆盖 rename_all，与前端 PayMethod 类型一致）
/// - Mixed 序列化为 "combined"（覆盖 rename_all，与前端 PayMethod 类型一致）
/// 业务逻辑不变，仅修改 serde 序列化值。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PayMethod {
    Cash,        // 现金
    Wechat,      // 微信
    Alipay,      // 支付宝
    #[serde(rename = "memberBalance")]
    MemberCard,  // 会员卡（用会员余额支付）
    #[serde(rename = "combined")]
    Mixed,       // 组合支付
}

impl PayMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            PayMethod::Cash => "cash",
            PayMethod::Wechat => "wechat",
            PayMethod::Alipay => "alipay",
            PayMethod::MemberCard => "memberBalance",
            PayMethod::Mixed => "combined",
        }
    }
}

/// 支付状态
///
/// 🔧 v0.3.3 修复：Pending 序列化为 "unpaid"（与前端 PayStatus 类型一致）
/// 业务逻辑不变，仅修改 serde 序列化值和 as_str() 返回值。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PayStatus {
    #[serde(rename = "unpaid")]
    Pending,  // 待支付
    #[serde(rename = "paid")]
    Paid,     // 已支付
    #[serde(rename = "refunded")]
    Refunded, // 已退款
}

impl PayStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            PayStatus::Pending => "unpaid",
            PayStatus::Paid => "paid",
            PayStatus::Refunded => "refunded",
        }
    }
}

/// 订单状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Pending,    // 待支付（挂单）
    Completed,  // 已完成
    Cancelled,  // 已取消
}

impl OrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderStatus::Pending => "pending",
            OrderStatus::Completed => "completed",
            OrderStatus::Cancelled => "cancelled",
        }
    }
}

/// 挂单订单（简化版，仅用于列表）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeldOrder {
    pub id: String,
    pub order_no: String,
    pub member_name: Option<String>,
    pub item_count: i64,
    pub total_amount: f64,
    pub created_at: String,
}

/// 会员口味偏好
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberPreference {
    pub member_id: String,
    pub preferred_teas: Vec<String>,
    pub taste_preferences: Vec<String>,
    pub taboos: String,
    pub brew_habits: String,
    pub consumption_scenario: Vec<String>,
    pub remark: String,
}

/// 会员偏好更新输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberPreferenceInput {
    pub preferred_teas: Vec<String>,
    pub taste_preferences: Vec<String>,
    pub taboos: String,
    pub brew_habits: String,
    pub consumption_scenario: Vec<String>,
    pub remark: String,
}

/// 会员详情（包含偏好）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberDetail {
    pub member: Member,
    pub preference: Option<MemberPreference>,
}

/// 会员消费记录项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberConsumptionItem {
    pub order_id: String,
    pub order_no: String,
    pub total_amount: f64,
    pub points_earned: i64,
    pub points_deduct: i64,
    pub created_at: String,
}

/// 会员消费记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberConsumption {
    pub member_id: String,
    pub total_consume: f64,
    pub consume_count: i64,
    pub records: Vec<MemberConsumptionItem>,
}

/// 销售订单汇总（列表/报表用，不含明细，带商品行数）
///
/// 用于销售历史查询与报表页，避免一次性返回所有明细造成网络/内存浪费。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleOrderSummary {
    pub id: String,
    pub order_no: String,
    pub member_id: Option<String>,
    pub member_name: Option<String>,
    pub total_amount: f64,
    pub discount_amount: f64,
    pub points_deduct: i64,
    pub points_earned: i64,
    pub actual_amount: f64,
    pub pay_method: Option<String>,
    pub pay_status: String,
    pub status: String,
    pub remark: Option<String>,
    /// 该订单包含的商品明细行数（LEFT JOIN sales_items 统计）
    pub item_count: i64,
    pub created_at: String,
}

/// 首页经营指标汇总
///
/// 用真实经营数据替换原 Dashboard 的 Mock：
/// - 今日订单：当日已完成（status='completed'）订单数
/// - 今日销售额：当日已完成订单实付金额合计（actual_amount）
/// - 库存预警：低于阈值的在售商品数（称重 <500g / 计件 <20 个）
/// - 新增会员：当日新建会员数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub today_orders: i64,
    pub today_sales: f64,
    pub low_stock_count: i64,
    pub new_members: i64,
}

/// 客户销售退货明细输入（CR-02）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnSaleItemInput {
    pub product_id: String,
    pub unit_id: String,
    /// 退货数量（必须 > 0 且不超过原单该商品已售数量）
    pub quantity: i64,
}

/// 客户销售退货输入（CR-02）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnSaleOrderInput {
    /// 原销售订单 id
    pub original_order_id: String,
    pub items: Vec<ReturnSaleItemInput>,
    pub remark: Option<String>,
}

/// 客户销售退货明细（CR-02）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnSaleItem {
    pub id: String,
    pub order_id: String,
    pub product_id: String,
    pub product_name: String,
    pub unit_id: String,
    pub unit_name: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub subtotal: f64,
}

/// 客户销售退货单（CR-02）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnSaleOrder {
    pub id: String,
    pub order_no: String,
    pub original_order_id: String,
    pub member_id: Option<String>,
    pub member_name: Option<String>,
    pub total_amount: f64,
    pub refund_amount: f64,
    pub points_reversed: i64,
    pub remark: Option<String>,
    pub items: Vec<ReturnSaleItem>,
    pub created_at: String,
}
