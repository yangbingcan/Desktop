/**
 * @file 销售 Store 单元测试
 * @description 测试 src/stores/sales.ts 中的 useSalesStore
 *              覆盖购物车操作、计算属性、结算、挂单/取单、设置会员等行为
 *              通过 mock @/api/sales 验证 store 状态变化
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestPinia } from './_helpers'

// mock api/sales 模块（用 vi.hoisted 提升至 vi.mock 工厂可访问的作用域）
const apiMocks = vi.hoisted(() => ({
    createSaleOrder: vi.fn(),
    holdOrder: vi.fn(),
    getHeldOrders: vi.fn(),
    getHeldOrderDetail: vi.fn(),
    deleteHeldOrder: vi.fn()
}))
vi.mock('@/api/sales', () => apiMocks)

import { useSalesStore } from '@/stores/sales'
import type { SaleOrder, SaleOrderItem, HeldOrder } from '@/types'

// 测试数据：购物车项基础数据（不含 subtotal，由 store 内部计算）
const cartBase1 = {
    productId: 'p-1',
    productName: '龙井',
    unitId: 'u-1',
    unitName: '50g',
    quantity: 2,
    price: 80,
    grams: 100
}
const cartBase2 = {
    productId: 'p-2',
    productName: '茶杯',
    unitId: 'u-2',
    unitName: '个',
    quantity: 3,
    price: 20,
    grams: 0
}

// 测试数据：销售订单明细（用于 resumeOrder 测试）
const orderItem1: SaleOrderItem = {
    id: 'oi-1',
    orderId: 'o-1',
    productId: 'p-1',
    productName: '龙井',
    unitName: '50g',
    unitId: 'u-1',
    quantity: 2,
    unitPrice: 80,
    grams: 100,
    subtotal: 160
}

// 测试数据：销售订单（用于 checkout 返回值和 resumeOrder 返回值）
const mockOrder: SaleOrder = {
    id: 'o-1',
    orderNo: 'SO20260701001',
    memberId: null,
    memberName: null,
    totalAmount: 160,
    discountAmount: 0,
    pointsDeduct: 0,
    pointsEarned: 16,
    actualAmount: 160,
    payMethod: 'cash',
    payStatus: 'paid',
    status: 'completed',
    remark: null,
    items: [orderItem1],
    createdAt: '2026-07-01 10:00:00'
}

// 测试数据：挂起订单列表项（id 与 mockOrder.id 一致，因 resumeOrder 会按 orderId 过滤列表）
const mockHeldOrder: HeldOrder = {
    id: 'o-1',
    orderNo: 'HO20260701001',
    memberName: null,
    itemCount: 1,
    totalAmount: 160,
    createdAt: '2026-07-01 10:30:00'
}

describe('useSalesStore 销售 Store', () => {
    beforeEach(() => {
        createTestPinia()
        vi.clearAllMocks()
    })

    // ========== 初始状态 ==========
    describe('初始状态', () => {
        it('cartItems 初始为空数组', () => {
            const store = useSalesStore()
            expect(store.cartItems).toEqual([])
        })
        it('currentMemberId 初始为 null', () => {
            const store = useSalesStore()
            expect(store.currentMemberId).toBeNull()
        })
        it('currentOrder 初始为 null', () => {
            const store = useSalesStore()
            expect(store.currentOrder).toBeNull()
        })
        it('heldOrderList 初始为空数组', () => {
            const store = useSalesStore()
            expect(store.heldOrderList).toEqual([])
        })
        it('loading 初始为 false', () => {
            const store = useSalesStore()
            expect(store.loading).toBe(false)
        })
    })

    // ========== 计算属性 ==========
    describe('计算属性', () => {
        it('totalAmount 累加所有购物车项的 subtotal', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)  // 2*80=160
            store.addToCart(cartBase2)  // 3*20=60
            expect(store.totalAmount).toBe(220)
        })
        it('totalAmount 购物车为空时返回 0', () => {
            const store = useSalesStore()
            expect(store.totalAmount).toBe(0)
        })
        it('totalItems 累加所有购物车项的 quantity', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)  // 2
            store.addToCart(cartBase2)  // 3
            expect(store.totalItems).toBe(5)
        })
        it('totalItems 购物车为空时返回 0', () => {
            const store = useSalesStore()
            expect(store.totalItems).toBe(0)
        })
    })

    // ========== addToCart ==========
    describe('addToCart 添加到购物车', () => {
        it('新商品：追加到购物车，subtotal = price * quantity', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)
            expect(store.cartItems).toHaveLength(1)
            expect(store.cartItems[0]).toEqual({
                ...cartBase1,
                subtotal: 160
            })
        })
        it('同 productId+unitId：数量累加，subtotal 重新计算', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)         // 2*80=160
            store.addToCart({ ...cartBase1, quantity: 1 })  // +1=3*80=240
            expect(store.cartItems).toHaveLength(1)
            expect(store.cartItems[0].quantity).toBe(3)
            expect(store.cartItems[0].subtotal).toBe(240)
        })
        it('同 productId 不同 unitId：作为新项追加', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.addToCart({ ...cartBase1, unitId: 'u-3', unitName: '100g' })
            expect(store.cartItems).toHaveLength(2)
        })
    })

    // ========== updateCartItem ==========
    describe('updateCartItem 更新购物车项', () => {
        it('更新数量后重新计算 subtotal', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)  // 2*80=160
            store.updateCartItem('p-1', 'u-1', 5)
            expect(store.cartItems[0].quantity).toBe(5)
            expect(store.cartItems[0].subtotal).toBe(400)
        })
        it('指定 productId+unitId 不存在时不做任何修改', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.updateCartItem('p-x', 'u-x', 5)
            expect(store.cartItems).toHaveLength(1)
            expect(store.cartItems[0].quantity).toBe(2)
        })
    })

    // ========== removeFromCart ==========
    describe('removeFromCart 移除购物车项', () => {
        it('移除指定 productId+unitId 的项', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.addToCart(cartBase2)
            store.removeFromCart('p-1', 'u-1')
            expect(store.cartItems).toHaveLength(1)
            expect(store.cartItems[0].id === 'p-2' || store.cartItems[0].productId === 'p-2').toBe(true)
        })
        it('购物车为空时调用不抛错', () => {
            const store = useSalesStore()
            expect(() => store.removeFromCart('p-1', 'u-1')).not.toThrow()
            expect(store.cartItems).toHaveLength(0)
        })
    })

    // ========== clearCart ==========
    describe('clearCart 清空购物车', () => {
        it('清空 cartItems 并重置 currentMemberId', () => {
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.setMember('m-1')
            store.clearCart()
            expect(store.cartItems).toEqual([])
            expect(store.currentMemberId).toBeNull()
        })
    })

    // ========== setMember ==========
    describe('setMember 设置当前会员', () => {
        it('设置 currentMemberId 为给定值', () => {
            const store = useSalesStore()
            store.setMember('m-1')
            expect(store.currentMemberId).toBe('m-1')
        })
        it('传入 null 清空 currentMemberId', () => {
            const store = useSalesStore()
            store.setMember('m-1')
            store.setMember(null)
            expect(store.currentMemberId).toBeNull()
        })
    })

    // ========== checkout ==========
    describe('checkout 结算', () => {
        it('成功：调用 createSaleOrder，写入 currentOrder，清空购物车', async () => {
            apiMocks.createSaleOrder.mockResolvedValue(mockOrder)
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.setMember('m-1')
            const result = await store.checkout('cash', '备注')
            expect(result).toEqual(mockOrder)
            expect(store.currentOrder).toEqual(mockOrder)
            expect(apiMocks.createSaleOrder).toHaveBeenCalledTimes(1)
            // checkout 后购物车应被清空（包含 currentMemberId）
            expect(store.cartItems).toEqual([])
            expect(store.currentMemberId).toBeNull()
        })
        it('调用 createSaleOrder 时传入正确的 input（items/memberId/payMethod/remark）', async () => {
            apiMocks.createSaleOrder.mockResolvedValue(mockOrder)
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.setMember('m-1')
            await store.checkout('wechat', '打包带走')
            expect(apiMocks.createSaleOrder).toHaveBeenCalledWith({
                items: [{ productId: 'p-1', unitId: 'u-1', quantity: 2 }],
                memberId: 'm-1',
                payMethod: 'wechat',
                remark: '打包带走'
            })
        })
        it('currentMemberId 为 null 时 memberId 为 undefined', async () => {
            apiMocks.createSaleOrder.mockResolvedValue(mockOrder)
            const store = useSalesStore()
            store.addToCart(cartBase1)
            await store.checkout('cash')
            const callArg = apiMocks.createSaleOrder.mock.calls[0][0]
            expect(callArg.memberId).toBeUndefined()
        })
        it('loading 状态在请求期间为 true，结束后为 false', async () => {
            let resolveFn!: (v: SaleOrder) => void
            apiMocks.createSaleOrder.mockReturnValue(
                new Promise<SaleOrder>(r => { resolveFn = r })
            )
            const store = useSalesStore()
            store.addToCart(cartBase1)
            const promise = store.checkout('cash')
            expect(store.loading).toBe(true)
            resolveFn(mockOrder)
            await promise
            expect(store.loading).toBe(false)
        })
        it('api 抛错时 loading 重置为 false 且错误向上抛出', async () => {
            apiMocks.createSaleOrder.mockRejectedValue(new Error('结算失败'))
            const store = useSalesStore()
            store.addToCart(cartBase1)
            await expect(store.checkout('cash')).rejects.toThrow('结算失败')
            expect(store.loading).toBe(false)
        })
    })

    // ========== doHoldOrder ==========
    describe('doHoldOrder 挂单', () => {
        it('成功：调用 holdOrder，清空购物车', async () => {
            apiMocks.holdOrder.mockResolvedValue('held-id-1')
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.setMember('m-1')
            await store.doHoldOrder()
            expect(apiMocks.holdOrder).toHaveBeenCalledTimes(1)
            expect(store.cartItems).toEqual([])
            expect(store.currentMemberId).toBeNull()
        })
        it('调用 holdOrder 时传入正确的 input（items/memberId，不含 payMethod/remark）', async () => {
            apiMocks.holdOrder.mockResolvedValue('held-id-1')
            const store = useSalesStore()
            store.addToCart(cartBase1)
            store.setMember('m-1')
            await store.doHoldOrder()
            expect(apiMocks.holdOrder).toHaveBeenCalledWith({
                items: [{ productId: 'p-1', unitId: 'u-1', quantity: 2 }],
                memberId: 'm-1'
            })
        })
        it('loading 状态在请求期间为 true，结束后为 false', async () => {
            let resolveFn!: (v: string) => void
            apiMocks.holdOrder.mockReturnValue(
                new Promise<string>(r => { resolveFn = r })
            )
            const store = useSalesStore()
            store.addToCart(cartBase1)
            const promise = store.doHoldOrder()
            expect(store.loading).toBe(true)
            resolveFn('held-id-1')
            await promise
            expect(store.loading).toBe(false)
        })
        it('api 抛错时 loading 重置为 false 且错误向上抛出', async () => {
            apiMocks.holdOrder.mockRejectedValue(new Error('挂单失败'))
            const store = useSalesStore()
            store.addToCart(cartBase1)
            await expect(store.doHoldOrder()).rejects.toThrow('挂单失败')
            expect(store.loading).toBe(false)
        })
    })

    // ========== loadHeldOrders ==========
    describe('loadHeldOrders 加载挂单列表', () => {
        it('成功后写入 heldOrderList', async () => {
            apiMocks.getHeldOrders.mockResolvedValue([mockHeldOrder])
            const store = useSalesStore()
            await store.loadHeldOrders()
            expect(store.heldOrderList).toEqual([mockHeldOrder])
        })
        it('api 抛错时错误向上抛出', async () => {
            apiMocks.getHeldOrders.mockRejectedValue(new Error('列表加载失败'))
            const store = useSalesStore()
            await expect(store.loadHeldOrders()).rejects.toThrow('列表加载失败')
        })
    })

    // ========== resumeOrder ==========
    describe('resumeOrder 取单', () => {
        it('成功：恢复购物车，设置 currentMemberId，删除挂单并从列表移除', async () => {
            apiMocks.getHeldOrderDetail.mockResolvedValue(mockOrder)
            apiMocks.deleteHeldOrder.mockResolvedValue(undefined)
            const store = useSalesStore()
            store.heldOrderList = [mockHeldOrder]
            const result = await store.resumeOrder('o-1')
            expect(result).toEqual(mockOrder)
            // 购物车已从订单 items 恢复
            expect(store.cartItems).toHaveLength(1)
            expect(store.cartItems[0]).toEqual({
                productId: 'p-1',
                productName: '龙井',
                unitId: 'u-1',
                unitName: '50g',
                quantity: 2,
                price: 80,
                grams: 100,
                subtotal: 160
            })
            // currentMemberId 已从订单 memberId 设置（mockOrder.memberId 为 null）
            expect(store.currentMemberId).toBeNull()
            // 调用了 deleteHeldOrder
            expect(apiMocks.deleteHeldOrder).toHaveBeenCalledWith('o-1')
            // heldOrderList 中已移除该挂单
            expect(store.heldOrderList).toHaveLength(0)
        })
        it('getHeldOrderDetail 抛错时错误向上抛出，不调用 deleteHeldOrder', async () => {
            apiMocks.getHeldOrderDetail.mockRejectedValue(new Error('取单失败'))
            const store = useSalesStore()
            store.heldOrderList = [mockHeldOrder]
            await expect(store.resumeOrder('o-1')).rejects.toThrow('取单失败')
            expect(apiMocks.deleteHeldOrder).not.toHaveBeenCalled()
        })
        it('deleteHeldOrder 抛错时错误向上抛出', async () => {
            apiMocks.getHeldOrderDetail.mockResolvedValue(mockOrder)
            apiMocks.deleteHeldOrder.mockRejectedValue(new Error('删除挂单失败'))
            const store = useSalesStore()
            await expect(store.resumeOrder('o-1')).rejects.toThrow('删除挂单失败')
        })
    })
})
