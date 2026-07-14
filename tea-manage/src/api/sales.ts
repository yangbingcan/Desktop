/**
 * @file 销售相关 API 调用
 * @description Tauri Commands 封装 - 销售订单、挂单、取单
 */
import { invoke } from '@tauri-apps/api/core'
import type {
    Member, SaleOrder, SaleOrderItem, SaleItemInput,
    SaleOrderInput, HeldOrder, SaleOrderSummary, DashboardStats,
    SaleOrderQuery, PageResult, ReturnSaleOrder, ReturnSaleOrderInput
} from '@/types'
import { getMemberDiscountRate, getMemberLevelName } from './members'

// 从 members 模块重新导出折扣率和等级名函数，避免重复定义
export { getMemberDiscountRate, getMemberLevelName }

/**
 * 按手机号获取会员（代理到 members 模块）
 */
export async function getMemberByPhone(phone: string): Promise<Member | null> {
    return await invoke('get_member_by_phone', { phone })
}

/**
 * 创建会员（代理到 members 模块）
 */
export async function createMember(
    name: string,
    phone: string,
    gender?: string,
    birthday?: string
): Promise<Member> {
    return await invoke('create_member', { name, phone, gender, birthday })
}

/**
 * 创建销售订单
 */
export async function createSaleOrder(input: SaleOrderInput): Promise<SaleOrder> {
    return await invoke('create_sale_order', { input })
}

/**
 * 挂单
 */
export async function holdOrder(input: SaleOrderInput): Promise<string> {
    return await invoke('hold_order', { input })
}

/**
 * 获取挂起的订单列表
 */
export async function getHeldOrders(): Promise<HeldOrder[]> {
    return await invoke('get_held_orders')
}

/**
 * 获取挂起订单详情
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ orderId }` 而非 `{ order_id }`
 */
export async function getHeldOrderDetail(orderId: string): Promise<SaleOrder> {
    return await invoke('get_held_order_detail', { orderId })
}

/**
 * 删除挂起的订单
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ orderId }` 而非 `{ order_id }`
 */
export async function deleteHeldOrder(orderId: string): Promise<void> {
    return await invoke('delete_held_order', { orderId })
}

/**
 * 获取销售历史（分页 + 筛选）
 *
 * 支持日期区间（YYYY-MM-DD）、会员、商品筛选；仅返回已完成订单。
 */
export async function getSaleOrders(query: SaleOrderQuery = {}): Promise<PageResult<SaleOrderSummary>> {
    return await invoke('get_sale_orders', {
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
        memberId: query.memberId ?? null,
        productId: query.productId ?? null,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
    })
}

/**
 * 获取单个销售订单详情（含明细），供客户退货弹窗加载原单商品行
 */
export async function getSaleOrder(id: string): Promise<SaleOrder> {
    return await invoke('get_sale_order', { id })
}

/**
 * 获取首页经营指标（今日订单/销售额/库存预警/新增会员）
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    return await invoke('get_dashboard_stats')
}

/**
 * 客户销售退货（CR-02 闭环）
 *
 * 传入原订单 id 与退货明细（商品/单位/数量），后端自动回滚库存、冲减会员积分并生成退货单。
 */
export async function returnSaleOrder(input: ReturnSaleOrderInput): Promise<ReturnSaleOrder> {
    return await invoke('return_sale_order', { input })
}

// 重新导出类型，方便外部使用
export type { Member, SaleOrder, SaleOrderItem, SaleItemInput, SaleOrderInput, HeldOrder, SaleOrderSummary, DashboardStats, SaleOrderQuery, ReturnSaleOrder, ReturnSaleOrderInput }
