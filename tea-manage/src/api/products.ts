/**
 * @file 商品相关 API 调用
 * @description Tauri Commands 封装 - 商品、销售单位、分类
 */
import { invoke } from '@tauri-apps/api/core'
import type { Product, ProductCategory, SalesUnit, ProductCreateInput, ProductUpdateInput, SalesUnitInput } from '@/types'

/**
 * 获取商品列表
 * 后端 get_products 支持分页和筛选参数，但当前前端不需要分页
 *
 * 🔧 v0.3.2 关键修复：Tauri 2.x 命令参数默认 snake_case → camelCase 转换
 *   客户端 invoke args 必须传 camelCase 键名（如 pageSize, categoryId, productType, keyword）
 */
export async function getProducts(): Promise<Product[]> {
    const result = await invoke<{ list: Product[] }>('get_products', {
        page: 1,
        pageSize: 100
    })
    return result.list || []
}

/**
 * 获取单个商品
 */
export async function getProduct(id: string): Promise<Product> {
    return await invoke('get_product', { id })
}

/**
 * 创建商品
 */
export async function createProduct(product: ProductCreateInput): Promise<Product> {
    return await invoke('create_product', { product })
}

/**
 * 更新商品
 * 后端参数名为 id + update (Rust 函数参数名)，不是 id + product
 */
export async function updateProduct(id: string, product: ProductUpdateInput): Promise<Product> {
    return await invoke('update_product', { id, update: product })
}

/**
 * 删除商品
 */
export async function deleteProduct(id: string): Promise<void> {
    return await invoke('delete_product', { id })
}

/**
 * 获取商品的销售单位列表
 *
 * 🔧 v0.3.2 关键修复：
 * 1. Tauri 2.x 命令参数默认 snake_case → camelCase 转换，必须传 `{ productId }` 而非 `{ product_id }`
 * 2. 增加 productId 空值校验，避免 undefined 触发后端 missing key 错误
 */
export async function getProductUnits(productId: string): Promise<SalesUnit[]> {
    if (!productId) {
        throw new Error('getProductUnits: 商品 ID 不能为空')
    }
    return await invoke<SalesUnit[]>('get_product_units', { productId })
}

/**
 * 搜索商品（支持拼音首字母）
 * 后端没有独立的 search_products 命令，使用 get_products + keyword 参数实现
 */
export async function searchProducts(keyword: string): Promise<Product[]> {
    const result = await invoke<{ list: Product[] }>('get_products', {
        page: 1,
        pageSize: 100,
        keyword
    })
    return result.list || []
}

/**
 * 获取商品分类
 */
export async function getCategories(): Promise<ProductCategory[]> {
    return await invoke('get_categories')
}

/**
 * 创建商品分类
 */
export async function createCategory(
    category: Omit<ProductCategory, 'id'>
): Promise<ProductCategory> {
    return await invoke('create_category', { category })
}

/**
 * 更新商品分类
 * 后端参数名为 id + update
 */
export async function updateCategory(
    id: string,
    category: Partial<ProductCategory>
): Promise<ProductCategory> {
    return await invoke('update_category', { id, update: category })
}

/**
 * 删除商品分类
 */
export async function deleteCategory(id: string): Promise<void> {
    return await invoke('delete_category', { id })
}

// 重新导出类型，方便外部使用
export type { ProductCreateInput, ProductUpdateInput, SalesUnitInput }
