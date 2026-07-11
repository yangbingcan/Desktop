/**
 * @file 库存相关 API 调用
 * @description Tauri Commands 封装 - 库存查询、入库、出库、调整
 */
import { invoke } from '@tauri-apps/api/core'
import type {
    InventoryItem, InventoryBatch, StockFlow, InventoryDetail,
    PurchaseInput, PurchaseOrder, DamageOutInput, AdjustInput,
    StockChangeResult, PageResult
} from '@/types'

/**
 * 获取库存列表
 *
 * 🔧 v0.3.2 关键修复：Tauri 2.x 命令参数默认 snake_case → camelCase 转换
 */
export async function getInventory(
    page?: number,
    pageSize?: number,
    categoryId?: string
): Promise<PageResult<InventoryItem>> {
    return await invoke('get_inventory', {
        page: page || 1,
        pageSize: pageSize || 20,
        categoryId: categoryId || null
    })
}

/**
 * 获取商品库存详情
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ productId }` 而非 `{ product_id }`
 */
export async function getInventoryDetail(productId: string): Promise<InventoryDetail> {
    return await invoke('get_inventory_detail', { productId })
}

/**
 * 获取库存流水记录
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ productId, page, pageSize }` 而非 snake_case
 */
export async function getStockFlows(
    productId: string,
    page?: number,
    pageSize?: number
): Promise<PageResult<StockFlow>> {
    return await invoke('get_stock_flows', {
        productId,
        page: page || 1,
        pageSize: pageSize || 20
    })
}

/**
 * 采购入库
 */
export async function purchaseIn(input: PurchaseInput): Promise<PurchaseOrder> {
    return await invoke('purchase_in', { input })
}

/**
 * 报损出库
 */
export async function damageOut(input: DamageOutInput): Promise<StockChangeResult> {
    return await invoke('damage_out', { input })
}

/**
 * 盘点调整
 */
export async function adjustStock(input: AdjustInput): Promise<StockChangeResult> {
    return await invoke('adjust_stock', { input })
}

// 重新导出类型，方便外部使用
export type { InventoryItem, InventoryBatch, StockFlow, InventoryDetail, PurchaseInput, PurchaseOrder, DamageOutInput, AdjustInput, StockChangeResult }
