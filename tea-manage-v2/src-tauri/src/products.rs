/** @file 商品档案管理 - CRUD + 多单位 + 分类 */

use crate::database::{DbState, get_conn};
use crate::auth::verify_and_get_context;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Clone)]
pub struct Product {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub product_type: String,
    pub base_unit: String,
    pub origin: Option<String>,
    pub year: Option<String>,
    pub grade: Option<String>,
    pub fermentation_level: Option<String>,
    pub roast_level: Option<String>,
    pub image_url: Option<String>,
    pub default_unit_id: Option<String>,
    pub is_active: bool,
    pub stock_grams: i64,
    pub stock_units: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Clone)]
pub struct SalesUnit {
    pub id: String,
    pub product_id: String,
    pub name: String,
    pub conversion_to_base: i64,
    pub retail_price: f64,
    pub member_price: f64,
    pub sort_order: i64,
}

#[derive(Deserialize)]
pub struct CreateProductInput {
    pub name: String,
    pub code: Option<String>,
    pub category_id: Option<String>,
    pub product_type: String,
    pub base_unit: String,
    pub origin: Option<String>,
    pub year: Option<String>,
    pub grade: Option<String>,
    pub fermentation_level: Option<String>,
    pub roast_level: Option<String>,
    pub image_url: Option<String>,
    pub units: Vec<UnitInput>,
}

#[derive(Deserialize)]
pub struct UpdateProductInput {
    pub name: Option<String>,
    pub code: Option<String>,
    pub category_id: Option<Option<String>>,
    pub product_type: Option<String>,
    pub base_unit: Option<String>,
    pub origin: Option<String>,
    pub year: Option<String>,
    pub grade: Option<String>,
    pub fermentation_level: Option<String>,
    pub roast_level: Option<String>,
    pub image_url: Option<String>,
    pub is_active: Option<bool>,
    pub units: Option<Vec<UnitInput>>,
}

#[derive(Deserialize)]
pub struct UnitInput {
    pub id: Option<String>,
    pub name: String,
    pub conversion_to_base: i64,
    pub retail_price: f64,
    pub member_price: f64,
}

fn gen_product_code(conn: &rusqlite::Connection) -> String {
    let date = chrono::Local::now().format("%Y%m%d").to_string();
    let prefix = format!("SP{}", date);
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE code LIKE ?1",
            params![format!("{}%", prefix)],
            |r| r.get(0),
        )
        .unwrap_or(0);
    format!("{}{:03}", prefix, count + 1)
}

#[tauri::command]
pub fn get_products(
    db: State<'_, DbState>,
    token: String,
    page: Option<i32>,
    page_size: Option<i32>,
    keyword: Option<String>,
    category_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let mut where_clause = String::from("WHERE 1=1");
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref kw) = keyword {
        if !kw.is_empty() {
            where_clause.push_str(" AND (p.name LIKE ?1 OR p.code LIKE ?1)");
            param_values.push(Box::new(format!("%{}%", kw)));
        }
    }
    if let Some(ref cat) = category_id {
        if !cat.is_empty() {
            where_clause.push_str(" AND p.category_id = ?");
            param_values.push(Box::new(cat.clone()));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM products p {}", where_clause);
    let total: i32 = conn
        .query_row(
            &count_sql,
            rusqlite::params_from_iter(param_values.iter().map(|b| b.as_ref())),
            |r| r.get(0),
        )
        .unwrap_or(0);

    let query_sql = format!(
        "SELECT p.id, p.code, p.name, p.category_id, c.name as category_name,
                p.product_type, p.base_unit, p.origin, p.year, p.grade,
                p.fermentation_level, p.roast_level, p.image_url, p.default_unit_id,
                p.is_active, p.stock_grams, p.stock_units, p.created_at, p.updated_at
         FROM products p
         LEFT JOIN product_categories c ON p.category_id = c.id
         {}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?",
        where_clause
    );

    let mut param_refs: Vec<&dyn rusqlite::ToSql> =
        param_values.iter().map(|b| b.as_ref()).collect();
    param_refs.push(&page_size);
    param_refs.push(&offset);

    let mut stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
    let items: Vec<Product> = stmt
        .query_map(rusqlite::params_from_iter(param_refs.iter()), |row| {
            Ok(Product {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                category_id: row.get(3)?,
                category_name: row.get(4)?,
                product_type: row.get(5)?,
                base_unit: row.get(6)?,
                origin: row.get(7)?,
                year: row.get(8)?,
                grade: row.get(9)?,
                fermentation_level: row.get(10)?,
                roast_level: row.get(11)?,
                image_url: row.get(12)?,
                default_unit_id: row.get(13)?,
                is_active: row.get::<_, i32>(14)? != 0,
                stock_grams: row.get(15)?,
                stock_units: row.get(16)?,
                created_at: row.get(17)?,
                updated_at: row.get(18)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "list": items,
        "total": total,
        "page": page,
        "pageSize": page_size
    }))
}

#[tauri::command]
pub fn get_product(db: State<'_, DbState>, token: String, id: String) -> Result<serde_json::Value, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let product: Product = conn
        .query_row(
            "SELECT p.id, p.code, p.name, p.category_id, c.name as category_name,
                    p.product_type, p.base_unit, p.origin, p.year, p.grade,
                    p.fermentation_level, p.roast_level, p.image_url, p.default_unit_id,
                    p.is_active, p.stock_grams, p.stock_units, p.created_at, p.updated_at
             FROM products p
             LEFT JOIN product_categories c ON p.category_id = c.id
             WHERE p.id = ?1",
            params![id],
            |row| {
                Ok(Product {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    product_type: row.get(5)?,
                    base_unit: row.get(6)?,
                    origin: row.get(7)?,
                    year: row.get(8)?,
                    grade: row.get(9)?,
                    fermentation_level: row.get(10)?,
                    roast_level: row.get(11)?,
                    image_url: row.get(12)?,
                    default_unit_id: row.get(13)?,
                    is_active: row.get::<_, i32>(14)? != 0,
                    stock_grams: row.get(15)?,
                    stock_units: row.get(16)?,
                    created_at: row.get(17)?,
                    updated_at: row.get(18)?,
                })
            },
        )
        .map_err(|e| format!("查询商品失败: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, product_id, name, conversion_to_base, retail_price, member_price, sort_order FROM sales_units WHERE product_id = ?1 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;
    let units: Vec<SalesUnit> = stmt
        .query_map(params![id], |row| {
            Ok(SalesUnit {
                id: row.get(0)?,
                product_id: row.get(1)?,
                name: row.get(2)?,
                conversion_to_base: row.get(3)?,
                retail_price: row.get(4)?,
                member_price: row.get(5)?,
                sort_order: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({ "product": product, "units": units }))
}

#[tauri::command]
pub fn create_product(db: State<'_, DbState>, token: String, input: CreateProductInput) -> Result<String, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let id = uuid::Uuid::new_v4().to_string();
    let code = input.code.unwrap_or_else(|| gen_product_code(&conn));

    conn.execute(
        "INSERT INTO products (id, code, name, category_id, product_type, base_unit, origin, year, grade, fermentation_level, roast_level, image_url)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id, code, input.name, input.category_id,
            input.product_type, input.base_unit,
            input.origin, input.year, input.grade,
            input.fermentation_level, input.roast_level, input.image_url
        ],
    )
    .map_err(|e| format!("创建商品失败: {}", e))?;

    for (i, unit) in input.units.iter().enumerate() {
        let unit_id = unit.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO sales_units (id, product_id, name, conversion_to_base, retail_price, member_price, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![unit_id, id, unit.name, unit.conversion_to_base, unit.retail_price, unit.member_price, i as i64],
        )
        .map_err(|e| format!("创建销售单位失败: {}", e))?;
    }

    Ok(id)
}

#[tauri::command]
pub fn update_product(db: State<'_, DbState>, token: String, id: String, input: UpdateProductInput) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    if let Some(name) = input.name {
        conn.execute("UPDATE products SET name = ?1, updated_at = datetime('now') WHERE id = ?2", params![name, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(code) = input.code {
        conn.execute("UPDATE products SET code = ?1, updated_at = datetime('now') WHERE id = ?2", params![code, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(cat_id) = input.category_id {
        conn.execute("UPDATE products SET category_id = ?1, updated_at = datetime('now') WHERE id = ?2", params![cat_id, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(ptype) = input.product_type {
        conn.execute("UPDATE products SET product_type = ?1, updated_at = datetime('now') WHERE id = ?2", params![ptype, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(bunit) = input.base_unit {
        conn.execute("UPDATE products SET base_unit = ?1, updated_at = datetime('now') WHERE id = ?2", params![bunit, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(origin) = input.origin {
        conn.execute("UPDATE products SET origin = ?1, updated_at = datetime('now') WHERE id = ?2", params![origin, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(year) = input.year {
        conn.execute("UPDATE products SET year = ?1, updated_at = datetime('now') WHERE id = ?2", params![year, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(grade) = input.grade {
        conn.execute("UPDATE products SET grade = ?1, updated_at = datetime('now') WHERE id = ?2", params![grade, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(fl) = input.fermentation_level {
        conn.execute("UPDATE products SET fermentation_level = ?1, updated_at = datetime('now') WHERE id = ?2", params![fl, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(rl) = input.roast_level {
        conn.execute("UPDATE products SET roast_level = ?1, updated_at = datetime('now') WHERE id = ?2", params![rl, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(img) = input.image_url {
        conn.execute("UPDATE products SET image_url = ?1, updated_at = datetime('now') WHERE id = ?2", params![img, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(active) = input.is_active {
        conn.execute("UPDATE products SET is_active = ?1, updated_at = datetime('now') WHERE id = ?2", params![active as i32, id])
            .map_err(|e| e.to_string())?;
    }

    if let Some(units) = input.units {
        conn.execute("DELETE FROM sales_units WHERE product_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        for (i, unit) in units.iter().enumerate() {
            let unit_id = unit.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            conn.execute(
                "INSERT INTO sales_units (id, product_id, name, conversion_to_base, retail_price, member_price, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![unit_id, id, unit.name, unit.conversion_to_base, unit.retail_price, unit.member_price, i as i64],
            )
            .map_err(|e| format!("更新销售单位失败: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn delete_product(db: State<'_, DbState>, token: String, id: String) -> Result<(), String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    conn.execute("DELETE FROM products WHERE id = ?1", params![id])
        .map_err(|e| format!("删除商品失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_product_units(db: State<'_, DbState>, token: String, product_id: String) -> Result<Vec<SalesUnit>, String> {
    let conn = get_conn(&db)?;
    let _ctx = verify_and_get_context(&conn, &token)?;

    let mut stmt = conn
        .prepare("SELECT id, product_id, name, conversion_to_base, retail_price, member_price, sort_order FROM sales_units WHERE product_id = ?1 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;
    let units: Vec<SalesUnit> = stmt
        .query_map(params![product_id], |row| {
            Ok(SalesUnit {
                id: row.get(0)?,
                product_id: row.get(1)?,
                name: row.get(2)?,
                conversion_to_base: row.get(3)?,
                retail_price: row.get(4)?,
                member_price: row.get(5)?,
                sort_order: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(units)
}
