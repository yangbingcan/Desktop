/**
 * @file 销售 API 单元测试
 * @description 测试 src/api/sales.ts 中的所有函数
 *              重点验证 camelCase 参数命名（orderId 等）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockInvoke, resetInvokeMock } from './_helpers'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke
}))

import {
    getMemberByPhone,
    createMember,
    createSaleOrder,
    holdOrder,
    getHeldOrders,
    getHeldOrderDetail,
    deleteHeldOrder,
    getMemberDiscountRate,
    getMemberLevelName
} from '@/api/sales'
import type { SaleOrder, SaleOrderInput, HeldOrder, Member } from '@/types'

// 测试数据
const mockSaleOrder: SaleOrder = {
    id: 'order-001',
    orderNo: 'XS20260703001',
    memberId: null,
    memberName: null,
    totalAmount: 100,
    discountAmount: 0,
    pointsDeduct: 0,
    pointsEarned: 10,
    actualAmount: 100,
    payMethod: 'cash',
    payStatus: 'paid',
    status: 'completed',
    remark: null,
    items: [],
    createdAt: '2026-07-03 14:30:00'
}

const mockHeldOrder: HeldOrder = {
    id: 'held-1',
    orderNo: 'XS20260703002',
    memberName: null,
    itemCount: 2,
    totalAmount: 80,
    createdAt: '2026-07-03 15:00:00'
}

const mockMember: Member = {
    id: 'm-1',
    name: '张三',
    phone: '13800138000',
    gender: 'male',
    birthday: null,
    level: 'gold',
    points: 1000,
    balance: 500,
    totalConsume: 5000,
    consumeCount: 10,
    lastVisit: null,
    createdAt: '2026-01-01'
}

describe('api/sales 销售 API', () => {
    beforeEach(() => {
        resetInvokeMock()
    })

    // ========== getMemberByPhone（代理自 members 模块） ==========
    describe('getMemberByPhone 按手机号获取会员', () => {
        it('调用 get_member_by_phone 命令', async () => {
            mockInvoke.mockResolvedValue(mockMember)
            const result = await getMemberByPhone('13800138000')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_by_phone', { phone: '13800138000' })
            expect(result).toEqual(mockMember)
        })
    })

    // ========== createMember（代理自 members 模块） ==========
    describe('createMember 创建会员', () => {
        it('调用 create_member 命令', async () => {
            mockInvoke.mockResolvedValue(mockMember)
            await createMember('张三', '13800138000', 'male')
            expect(mockInvoke).toHaveBeenCalledWith('create_member', {
                name: '张三',
                phone: '13800138000',
                gender: 'male',
                birthday: undefined
            })
        })
    })

    // ========== createSaleOrder ==========
    describe('createSaleOrder 创建销售订单', () => {
        it('调用 create_sale_order，传入 { input }', async () => {
            const input: SaleOrderInput = {
                items: [
                    { productId: 'p-1', unitId: 'u-1', quantity: 2 }
                ],
                memberId: 'm-1',
                payMethod: 'wechat',
                remark: '备注'
            }
            mockInvoke.mockResolvedValue(mockSaleOrder)
            const result = await createSaleOrder(input)
            expect(mockInvoke).toHaveBeenCalledWith('create_sale_order', { input })
            expect(result).toEqual(mockSaleOrder)
        })
        it('无会员、无支付方式时仍能正常调用', async () => {
            const input: SaleOrderInput = {
                items: [{ productId: 'p-1', unitId: 'u-1', quantity: 1 }]
            }
            mockInvoke.mockResolvedValue(mockSaleOrder)
            await createSaleOrder(input)
            expect(mockInvoke).toHaveBeenCalledWith('create_sale_order', { input })
        })
    })

    // ========== holdOrder ==========
    describe('holdOrder 挂单', () => {
        it('调用 hold_order，传入 { input }', async () => {
            const input: SaleOrderInput = {
                items: [{ productId: 'p-1', unitId: 'u-1', quantity: 1 }]
            }
            mockInvoke.mockResolvedValue('held-1')
            const result = await holdOrder(input)
            expect(mockInvoke).toHaveBeenCalledWith('hold_order', { input })
            expect(result).toBe('held-1')
        })
    })

    // ========== getHeldOrders ==========
    describe('getHeldOrders 获取挂单列表', () => {
        it('调用 get_held_orders，无参数', async () => {
            mockInvoke.mockResolvedValue([mockHeldOrder])
            const result = await getHeldOrders()
            expect(mockInvoke).toHaveBeenCalledWith('get_held_orders')
            expect(result).toEqual([mockHeldOrder])
        })
        it('无挂单时返回空数组', async () => {
            mockInvoke.mockResolvedValue([])
            const result = await getHeldOrders()
            expect(result).toEqual([])
        })
    })

    // ========== getHeldOrderDetail ==========
    describe('getHeldOrderDetail 获取挂单详情', () => {
        it('调用 get_held_order_detail，传入 { orderId }（camelCase）', async () => {
            mockInvoke.mockResolvedValue(mockSaleOrder)
            const result = await getHeldOrderDetail('held-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_held_order_detail', { orderId: 'held-1' })
            expect(result).toEqual(mockSaleOrder)
        })
    })

    // ========== deleteHeldOrder ==========
    describe('deleteHeldOrder 删除挂单', () => {
        it('调用 delete_held_order，传入 { orderId }（camelCase）', async () => {
            mockInvoke.mockResolvedValue(undefined)
            await deleteHeldOrder('held-1')
            expect(mockInvoke).toHaveBeenCalledWith('delete_held_order', { orderId: 'held-1' })
        })
    })

    // ========== 重新导出的工具函数 ==========
    describe('重新导出的工具函数', () => {
        it('getMemberDiscountRate 可用', () => {
            expect(getMemberDiscountRate('gold')).toBe(0.9)
            expect(getMemberDiscountRate('silver')).toBe(0.95)
            expect(getMemberDiscountRate('normal')).toBe(1.0)
        })
        it('getMemberLevelName 可用', () => {
            expect(getMemberLevelName('gold')).toBe('金卡')
            expect(getMemberLevelName('silver')).toBe('银卡')
            expect(getMemberLevelName('normal')).toBe('普通')
        })
    })

    // ========== 错误传播 ==========
    describe('错误传播', () => {
        it('invoke 抛错时，API 函数应向上抛出', async () => {
            mockInvoke.mockRejectedValue(new Error('库存不足'))
            await expect(createSaleOrder({
                items: [{ productId: 'p-1', unitId: 'u-1', quantity: 9999 }]
            })).rejects.toThrow('库存不足')
        })
    })
})
