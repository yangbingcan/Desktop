//! 供应商数据模型
//!
//! 供应商档案：采购入库和退货出库时使用
//! v0.2.0 M04 出入库闭环

use rusqlite::Row;
use serde::{Deserialize, Serialize};

/// 供应商
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Supplier {
    pub id: String,
    pub name: String,
    pub contact_person: Option<String>,
    pub contact_phone: Option<String>,
    pub address: Option<String>,
    pub main_categories: Vec<String>,
    pub remark: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl Supplier {
    /// 从 SQLite Row 解析供应商记录
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        let main_categories_str: String = row.get(5)?;
        let main_categories = serde_json::from_str(&main_categories_str).unwrap_or_default();
        let is_active_int: i64 = row.get(7)?;
        Ok(Supplier {
            id: row.get(0)?,
            name: row.get(1)?,
            contact_person: row.get(2)?,
            contact_phone: row.get(3)?,
            address: row.get(4)?,
            main_categories,
            remark: row.get(6)?,
            is_active: is_active_int != 0,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }
}

/// 供应商输入（新增/编辑）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierInput {
    pub name: String,
    #[serde(default)]
    pub contact_person: Option<String>,
    #[serde(default)]
    pub contact_phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub main_categories: Vec<String>,
    #[serde(default)]
    pub remark: Option<String>,
}
