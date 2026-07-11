//! 分类数据模型
//! 
//! 包含商品分类相关数据结构

use serde::{Deserialize, Serialize};

/// 商品分类结构体
///
/// 🔧 v0.3.2 修复：添加 `#[serde(rename_all = "camelCase")]`
/// 修复前：`parent_id`、`sort_order` 序列化为 snake_case，前端 `parentId`、`sortOrder` 拿不到值
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub level: i32,
    pub sort_order: i32,
}

/// 商品分类（树形）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTree {
    pub id: String,
    pub name: String,
    pub level: i32,
    pub sort_order: i32,
    #[serde(default)]
    pub children: Vec<CategoryTree>,
}

/// 分类输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInput {
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: Option<i32>,
}

/// 分类输入验证
impl CategoryInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("分类名称不能为空".to_string());
        }

        // 二级分类必须有父级
        if self.parent_id.is_none() {
            // 新建一级分类，允许
            Ok(())
        } else {
            // 新建二级分类，验证父级存在且层级正确
            // 具体验证在 command 层处理
            Ok(())
        }
    }
}

/// 分类更新输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryUpdate {
    pub name: Option<String>,
    pub parent_id: Option<Option<String>>, // Some(None) 表示取消父级
    pub sort_order: Option<i32>,
}
