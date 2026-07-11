//! 数据库查询构建器
//! 
//! 提供商品查询、分类查询等常用查询函数

use crate::models::{
    Category, CategoryTree, Product, ProductDetail, ProductType, BaseUnit,
    SalesUnit, ProductInput, SalesUnitInput,
};
use crate::models::PageResult;
use chrono::Local;
use rusqlite::{params, Connection};
use uuid::Uuid;

/// 生成商品编码
/// 
/// 格式：SP + 年月日 + 3位序号
/// 示例：SP20260701001
/// 
/// # Arguments
/// * `conn` - 数据库连接
/// 
/// # Returns
/// * `Result<String, String>` - 生成的编码
pub fn generate_product_code(conn: &Connection) -> Result<String, String> {
    let today = Local::now().format("%Y%m%d").to_string();
    let prefix = format!("SP{}", today);

    // 查找今天最大的序号
    let max_code: Option<String> = conn
        .query_row(
            "SELECT MAX(code) FROM products WHERE code LIKE ?",
            [&format!("{}%", prefix)],
            |row| row.get(0),
        )
        .ok();

    let sequence = match max_code {
        Some(code) => {
            let num: u32 = code[prefix.len()..].parse().unwrap_or(0);
            num + 1
        }
        None => 1,
    };

    Ok(format!("{}{:03}", prefix, sequence))
}

/// 插入商品记录
/// 
/// # Arguments
/// * `conn` - 数据库连接
/// * `product` - 商品数据
/// 
/// # Returns
/// * `Result<(), String>` - 成功返回空
pub fn insert_product(conn: &Connection, product: &ProductInput) -> Result<String, String> {
    let code = generate_product_code(conn)?;
    let product_id = Uuid::new_v4().to_string();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let base_unit = match product.product_type {
        ProductType::Weight => "g",
        ProductType::Count => "pcs",
    };
    
    let product_type_str = match product.product_type {
        ProductType::Weight => "weight",
        ProductType::Count => "count",
    };

    conn.execute(
        "INSERT INTO products (
            id, code, name, category_id, product_type, base_unit,
            origin, year, grade, fermentation_level, roast_level, image_url,
            is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
        params![
            product_id,
            code,
            product.name,
            product.category_id,
            product_type_str,
            base_unit,
            product.origin,
            product.year,
            product.grade,
            product.fermentation_level,
            product.roast_level,
            product.image_url,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(product_id)
}

/// 插入销售单位记录
/// 
/// # Arguments
/// * `conn` - 数据库连接
/// * `product_id` - 商品ID
/// * `units` - 销售单位列表
/// * `now` - 当前时间
/// 
/// # Returns
/// * `Result<String, String>` - 默认单位ID
pub fn insert_sales_units(
    conn: &Connection,
    product_id: &str,
    units: &[SalesUnitInput],
    now: &str,
) -> Result<String, String> {
    let mut default_unit_id = None;

    for (idx, unit) in units.iter().enumerate() {
        let unit_id = Uuid::new_v4().to_string();
        
        conn.execute(
            "INSERT INTO sales_units (
                id, product_id, name, conversion_to_base,
                retail_price, member_price, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                unit_id,
                product_id,
                unit.name,
                unit.conversion_to_base,
                unit.retail_price,
                unit.member_price,
                idx as i32,
                now,
                now
            ],
        )
        .map_err(|e| e.to_string())?;

        if idx == 0 {
            default_unit_id = Some(unit_id);
        }
    }

    Ok(default_unit_id.unwrap_or_default())
}

/// 更新商品默认单位
/// 
/// # Arguments
/// * `conn` - 数据库连接
/// * `product_id` - 商品ID
/// * `unit_id` - 单位ID
pub fn update_default_unit(conn: &Connection, product_id: &str, unit_id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE products SET default_unit_id = ?, updated_at = ? WHERE id = ?",
        params![unit_id, Local::now().format("%Y-%m-%d %H:%M:%S").to_string(), product_id],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 查询商品列表（分页）
/// 
/// # Arguments
/// * `conn` - 数据库连接
/// * `page` - 页码（从1开始）
/// * `page_size` - 每页数量
/// * `category_id` - 分类ID筛选
/// * `product_type` - 类型筛选
/// * `keyword` - 关键词搜索
/// 
/// # Returns
/// * `Result<PageResult<Product>, String>` - 分页结果
pub fn query_products(
    conn: &Connection,
    page: Option<u32>,
    page_size: Option<u32>,
    category_id: Option<&str>,
    product_type: Option<&str>,
    keyword: Option<&str>,
) -> Result<PageResult<Product>, String> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    // 构建 WHERE 条件
    let mut where_clauses = vec!["is_active = 1"];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(cid) = category_id {
        where_clauses.push("category_id = ?");
        params_vec.push(Box::new(cid.to_string()));
    }

    if let Some(pt) = product_type {
        where_clauses.push("product_type = ?");
        params_vec.push(Box::new(pt.to_string()));
    }

    if let Some(kw) = keyword {
        where_clauses.push("(name LIKE ? OR code LIKE ?)");
        let pattern = format!("%{}%", kw);
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern));
    }

    let where_clause = where_clauses.join(" AND ");
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    // 查询总数
    let count_sql = format!("SELECT COUNT(*) FROM products WHERE {}", where_clause);
    let total: i64 = conn
        .query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // 查询列表
    let list_sql = format!(
        "SELECT id, code, name, category_id, product_type, base_unit,
                origin, year, grade, fermentation_level, roast_level, image_url,
                default_unit_id, is_active, created_at, updated_at
         FROM products 
         WHERE {} 
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?",
        where_clause
    );

    let mut params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    params_refs.push(&page_size);
    params_refs.push(&offset);

    let mut stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;
    let products = stmt
        .query_map(params_refs.as_slice(), |row| {
            let product_type_str: String = row.get(4)?;
            let product_type = if product_type_str == "weight" {
                ProductType::Weight
            } else {
                ProductType::Count
            };

            let base_unit_str: String = row.get(5)?;
            let base_unit = if base_unit_str == "g" {
                BaseUnit::Gram
            } else {
                BaseUnit::Pieces
            };

            Ok(Product {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                category_id: row.get(3)?,
                product_type,
                base_unit,
                origin: row.get(6)?,
                year: row.get(7)?,
                grade: row.get(8)?,
                fermentation_level: row.get(9)?,
                roast_level: row.get(10)?,
                image_url: row.get(11)?,
                default_unit_id: row.get(12)?,
                is_active: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(PageResult {
        list: products,
        total: total as u32,
        page,
        page_size,
    })
}

/// 查询商品详情（含销售单位）
/// 
/// # Arguments
/// * `conn` - 数据库连接
/// * `id` - 商品ID
/// 
/// # Returns
/// * `Result<Option<ProductDetail>, String>` - 商品详情
pub fn query_product_detail(
    conn: &Connection,
    id: &str,
) -> Result<Option<ProductDetail>, String> {
    // 查询商品
    let product = query_product_by_id(conn, id)?;

    if let Some(mut p) = product {
        // 查询销售单位
        let units = query_sales_units(conn, &p.id)?;
        p.default_unit_id = units.first().map(|u| u.id.clone());
        
        // 设置分类名称
        if let Some(ref cat_id) = p.category_id {
            if let Ok(cat_name) = query_category_name(conn, cat_id) {
                // 通过另一种方式返回分类名称
            }
        }

        return Ok(Some(ProductDetail {
            product: p,
            units,
        }));
    }

    Ok(None)
}

/// 根据ID查询商品
pub fn query_product_by_id(conn: &Connection, id: &str) -> Result<Option<Product>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, code, name, category_id, product_type, base_unit,
                    origin, year, grade, fermentation_level, roast_level, image_url,
                    default_unit_id, is_active, created_at, updated_at
             FROM products WHERE id = ?",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([id], |row| {
            let product_type_str: String = row.get(4)?;
            let product_type = if product_type_str == "weight" {
                ProductType::Weight
            } else {
                ProductType::Count
            };

            let base_unit_str: String = row.get(5)?;
            let base_unit = if base_unit_str == "g" {
                BaseUnit::Gram
            } else {
                BaseUnit::Pieces
            };

            Ok(Product {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                category_id: row.get(3)?,
                product_type,
                base_unit,
                origin: row.get(6)?,
                year: row.get(7)?,
                grade: row.get(8)?,
                fermentation_level: row.get(9)?,
                roast_level: row.get(10)?,
                image_url: row.get(11)?,
                default_unit_id: row.get(12)?,
                is_active: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })
        .ok();

    Ok(result)
}

/// 查询销售单位列表
pub fn query_sales_units(conn: &Connection, product_id: &str) -> Result<Vec<SalesUnit>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, product_id, name, conversion_to_base,
                    retail_price, member_price, sort_order, created_at, updated_at
             FROM sales_units
             WHERE product_id = ?
             ORDER BY sort_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let units = stmt
        .query_map([product_id], |row| {
            Ok(SalesUnit {
                id: row.get(0)?,
                product_id: row.get(1)?,
                name: row.get(2)?,
                conversion_to_base: row.get(3)?,
                retail_price: row.get(4)?,
                member_price: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(units)
}

/// 查询分类列表（树形）
pub fn query_categories(conn: &Connection) -> Result<Vec<CategoryTree>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, parent_id, level, sort_order
             FROM product_categories
             ORDER BY level ASC, sort_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let categories: Vec<Category> = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                level: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // 构建树形结构
    let tree = build_category_tree(categories);
    Ok(tree)
}

/// 构建分类树
///
/// 🔧 v0.3.3 修复 BUG-LOGIC-001：clone 后修改 map 不影响 roots
/// 原问题：循环中根节点被 clone 后 push 到 roots，后续子节点添加到 map 中的
///        根节点（而非 roots 中的 clone），导致 roots 中根节点的 children 永远为空
/// 修复方案：用 root_ids 记录根节点 id，循环结束后从 map 中提取（此时 children 已被正确填充）
fn build_category_tree(categories: Vec<Category>) -> Vec<CategoryTree> {
    use std::collections::HashMap;

    let mut map: HashMap<String, CategoryTree> = HashMap::new();
    let mut root_ids: Vec<String> = Vec::new();

    // 第一步：创建所有节点并存入 map
    for cat in &categories {
        map.insert(
            cat.id.clone(),
            CategoryTree {
                id: cat.id.clone(),
                name: cat.name.clone(),
                level: cat.level,
                sort_order: cat.sort_order,
                children: Vec::new(),
            },
        );
    }

    // 第二步：构建父子关系
    // 用 map.remove 取出子节点（避免 clone），添加到父节点的 children 中
    // 根节点只记录 id，循环结束后再从 map 中提取（确保 children 已被填充）
    for cat in &categories {
        let node_id = cat.id.clone();
        let parent_id_opt = cat.parent_id.clone();

        if let Some(parent_id) = parent_id_opt {
            // 有父节点：从 map 中移除当前节点，添加到父节点的 children
            if let Some(node) = map.remove(&node_id) {
                if let Some(parent) = map.get_mut(&parent_id) {
                    parent.children.push(node);
                } else {
                    // 父节点不存在（数据异常），将节点放回 map 并作为根节点处理
                    map.insert(node_id.clone(), node);
                    root_ids.push(node_id);
                }
            }
        } else {
            // 根节点：只记录 id，稍后从 map 中提取（此时 children 已被子节点填充）
            root_ids.push(node_id);
        }
    }

    // 第三步：从 map 中提取根节点（此时根节点的 children 已被正确填充）
    let mut roots: Vec<CategoryTree> = Vec::new();
    for id in &root_ids {
        if let Some(node) = map.remove(id) {
            roots.push(node);
        }
    }

    // 兜底：如果没有根节点（只有一级分类的情况），返回所有节点
    if roots.is_empty() {
        roots = map.into_values().collect();
    }

    roots
}

/// 查询分类名称
fn query_category_name(conn: &Connection, id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT name FROM product_categories WHERE id = ?",
        [id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// 检查商品是否有库存
pub fn check_product_has_stock(conn: &Connection, product_id: &str) -> Result<bool, String> {
    // 检查库存批次表
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM inventory_batches WHERE product_id = ? AND remaining_grams > 0",
            [product_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}
