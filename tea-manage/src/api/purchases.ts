/**
 * @file 采购入库单 API
 * @description Tauri Commands 封装 - 采购单列表/详情/更新
 * @since v0.3.0
 */
import { invoke } from '@tauri-apps/api/core'
import type { PageResult, PurchaseOrder, PurchaseOrderListItem, PurchaseInput } from '@/types'

/**
 * 获取采购入库单列表（分页 + 筛选）
 * @param page 页码（从 1 开始）
 * @param pageSize 每页条数
 * @param supplierId 供应商 ID（可选）
 * @param paymentStatus 付款状态（可选）：unpaid / partial / paid
 * @param dateStart 起始日期 YYYY-MM-DD（含）
 * @param dateEnd 截止日期 YYYY-MM-DD（含）
 *
 * 🔧 v0.3.2 关键修复：Tauri 2.x 命令参数默认 snake_case → camelCase 转换
 *   必须传 `{ pageSize, supplierId, paymentStatus, dateStart, dateEnd }`（camelCase）
 */
export async function getPurchaseOrders(
    page?: number,
    pageSize?: number,
    supplierId?: string,
    paymentStatus?: string,
    dateStart?: string,
    dateEnd?: string
): Promise<PageResult<PurchaseOrderListItem>> {
    return await invoke('get_purchase_orders', {
        page: page || 1,
        pageSize: pageSize || 20,
        supplierId: supplierId || null,
        paymentStatus: paymentStatus || null,
        dateStart: dateStart || null,
        dateEnd: dateEnd || null
    })
}

/**
 * 获取采购单详情
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ orderId }` 而非 `{ order_id }`
 */
export async function getPurchaseOrderDetail(orderId: string): Promise<PurchaseOrder> {
    return await invoke('get_purchase_order_detail', { orderId })
}

/**
 * 更新采购入库单
 */
export async function updatePurchaseOrder(id: string, input: PurchaseInput): Promise<PurchaseOrder> {
    return await invoke('update_purchase_order', { id, input })
}
