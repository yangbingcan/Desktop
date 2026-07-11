//! 商品数据模型
//! 
//! 包含商品、销售单位等相关数据结构

use serde::{Deserialize, Serialize};

/// 商品类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProductType {
    Weight, // 称重类
    Count,  // 计件类
}

/// 基准单位枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BaseUnit {
    #[serde(rename = "g")]
    Gram,    // 克
    #[serde(rename = "pcs")]
    Pieces,  // 个
}

/// 商品结构体
///
/// 🔧 v0.3.2 修复：添加 `#[serde(rename_all = "camelCase")]`，使前端可通过 `categoryId`、`baseUnit` 等
/// camelCase 字段访问。`product_type` 字段已用 `#[serde(rename = "type")]` 单独重命名为 `type`。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category_id: Option<String>,
    #[serde(rename = "type")]
    pub product_type: ProductType,
    pub base_unit: BaseUnit,
    pub origin: Option<String>,
    pub year: Option<String>,
    pub grade: Option<String>,
    pub fermentation_level: Option<String>,
    pub roast_level: Option<String>,
    pub image_url: Option<String>,
    pub default_unit_id: Option<String>,
    pub is_active: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// 商品详情（含销售单位）
///
/// `#[serde(flatten)]` 继承 `Product` 的 rename 规则，所有字段自动 camelCase。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductDetail {
    #[serde(flatten)]
    pub product: Product,
    pub units: Vec<SalesUnit>,
}

/// 销售单位结构体
///
/// 🔧 v0.3.2 修复：添加 `#[serde(rename_all = "camelCase")]`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesUnit {
    pub id: String,
    pub product_id: String,
    pub name: String,
    pub conversion_to_base: i64,
    pub retail_price: f64,
    pub member_price: f64,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// 分页结果
///
/// 🔧 v0.3.2 修复：添加 `#[serde(rename_all = "camelCase")]`，使前端可通过 `pageSize` 访问
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageResult<T> {
    pub list: Vec<T>,
    pub total: u32,
    pub page: u32,
    pub page_size: u32,
}

/// 商品输入（创建时）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductInput {
    pub name: String,
    pub category_id: Option<String>,
    #[serde(rename = "type")]
    pub product_type: ProductType,
    pub origin: Option<String>,
    pub year: Option<String>,
    pub grade: Option<String>,
    pub fermentation_level: Option<String>,
    pub roast_level: Option<String>,
    pub image_url: Option<String>,
    /// 销售单位列表，至少一个
    pub units: Vec<SalesUnitInput>,
}

/// 商品输入验证
impl ProductInput {
    /// 验证输入是否合法
    pub fn validate(&self) -> Result<(), String> {
        // 名称不能为空
        if self.name.trim().is_empty() {
            return Err("商品名称不能为空".to_string());
        }

        // 至少需要一个销售单位
        if self.units.is_empty() {
            return Err("至少需要添加一个销售单位".to_string());
        }

        // 验证每个销售单位
        for unit in &self.units {
            unit.validate()?;
        }

        Ok(())
    }
}

/// 商品更新输入
///
/// 🔧 v0.3.2 修复：添加 `#[serde(rename_all = "camelCase")]`
/// 修复前：前端传 `{ categoryId, fermentationLevel, roastLevel }`（camelCase），
/// 但后端字段是 `category_id, fermentation_level, roast_level`（snake_case），
/// 导致更新时这些字段被 serde 忽略，表现为"修改保存后无效果"。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductUpdate {
    pub name: Option<String>,
    pub category_id: Option<String>,
    /// 商品类型（称重/计件），前端字段名为 `type`
    #[serde(rename = "type")]
    pub product_type: Option<ProductType>,
    /// 基准单位（g/pcs）
    pub base_unit: Option<BaseUnit>,
    pub origin: Option<String>,
    pub year: Option<String>,
    pub grade: Option<String>,
    pub fermentation_level: Option<String>,
    pub roast_level: Option<String>,
    pub image_url: Option<String>,
    pub is_active: Option<bool>,
    /// 销售单位更新（如果提供则全量替换）
    pub units: Option<Vec<SalesUnitInput>>,
}

/// 销售单位输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesUnitInput {
    /// 编辑时存在，新建时为 None
    pub id: Option<String>,
    pub name: String,
    pub conversion_to_base: i64,
    pub retail_price: f64,
    pub member_price: f64,
}

/// 销售单位输入验证
impl SalesUnitInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("销售单位名称不能为空".to_string());
        }
        if self.conversion_to_base <= 0 {
            return Err("换算数量必须大于0".to_string());
        }
        if self.retail_price < 0.0 {
            return Err("零售价不能为负数".to_string());
        }
        if self.member_price < 0.0 {
            return Err("会员价不能为负数".to_string());
        }
        Ok(())
    }
}
