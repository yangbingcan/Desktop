/**
 * @file 退货出库单 API 调用
 * @description Tauri Commands 封装 - 退货单创建、查询、删除、更新
 */
import { invoke } from '@tauri-apps/api/core'
import type {
    ReturnOrder, ReturnOrderInput, ReturnOrderListItem,
    BatchOption, PageResult
} from '@/types'

/**
 * 获取某商品的可用批次（退货选择用）
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ productId }` 而非 `{ product_id }`
 */
export async function getAvailableBatches(productId: string): Promise<BatchOption[]> {
    return await invoke('get_available_batches', { productId })
}

/**
 * 创建退货出库单
 */
export async function createReturnOrder(input: ReturnOrderInput): Promise<ReturnOrder> {
    return await invoke('create_return_order', { input })
}

/**
 * 获取退货单列表（分页 + 筛选：日期范围/供应商/退货原因）
 * @param dateStart 起始日期 YYYY-MM-DD（含）
 * @param dateEnd 截止日期 YYYY-MM-DD（含）
 *
 * 🔧 v0.3.2 关键修复：Tauri 2.x 命令参数默认 snake_case → camelCase 转换
 *   必须传 `{ pageSize, supplierId, returnReason, dateStart, dateEnd }`
 */
export async function getReturnOrders(
    page?: number,
    pageSize?: number,
    supplierId?: string,
    returnReason?: string,
    dateStart?: string,
    dateEnd?: string
): Promise<PageResult<ReturnOrderListItem>> {
    return await invoke('get_return_orders', {
        page: page || 1,
        pageSize: pageSize || 20,
        supplierId: supplierId || null,
        returnReason: returnReason || null,
        dateStart: dateStart || null,
        dateEnd: dateEnd || null
    })
}

/**
 * 获取退货单详情
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ orderId }` 而非 `{ order_id }`
 */
export async function getReturnOrderDetail(orderId: string): Promise<ReturnOrder> {
    return await invoke('get_return_order_detail', { orderId })
}

/**
 * 删除退货单（库存自动还原）
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ orderId }` 而非 `{ order_id }`
 */
export async function deleteReturnOrder(orderId: string): Promise<void> {
    return await invoke('delete_return_order', { orderId })
}

/**
 * 更新退货出库单
 */
export async function updateReturnOrder(id: string, input: ReturnOrderInput): Promise<ReturnOrder> {
    return await invoke('update_return_order', { id, input })
}

// ========== 常量选项 ==========

/** 退货原因选项 */
export const RETURN_REASON_OPTIONS = [
    { label: '质量问题', value: '质量问题' },
    { label: '数量超出', value: '数量超出' },
    { label: '保质期', value: '保质期' },
    { label: '其他', value: '其他' }
] as const

/**
 * 获取退货原因标签
 */
export function getReturnReasonLabel(reason: string): string {
    return reason || '其他'
}
