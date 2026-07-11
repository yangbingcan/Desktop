/**
 * @file 库存 Store 单元测试
 * @description 测试 src/stores/inventory.ts 中的 useInventoryStore
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestPinia } from './_helpers'

// mock api/inventory 模块（用 vi.hoisted 提升至 vi.mock 工厂可访问的作用域）
const apiMocks = vi.hoisted(() => ({
    getInventoryDetail: vi.fn(),
    purchaseIn: vi.fn(),
    damageOut: vi.fn(),
    adjustStock: vi.fn()
}))
vi.mock('@/api/inventory', () => apiMocks)

import { useInventoryStore } from '@/stores/inventory'
import type {
    InventoryDetail, PurchaseInput, PurchaseOrder,
    DamageOutInput, AdjustInput, StockChangeResult
} from '@/types'

const mockDetail: InventoryDetail = {
    productId: 'p-1',
    productName: '龙井',
    categoryName: '绿茶',
    productType: 'weight',
    stockGrams: 500,
    stockUnits: 10,
    batches: [{
        id: 'b-1', productId: 'p-1', batchCode: 'B001',
        purchasePrice: 50, totalGrams: 1000, remainingGrams: 500,
        supplierId: 'sup-1', producedDate: null, expireDate: null,
        createdAt: '2026-07-01'
    }],
    recentFlows: [{
        id: 'f-1', productId: 'p-1', batchId: 'b-1', flowType: 'purchaseIn',
        changeGrams: 1000, balanceGrams: 1000, orderId: null,
        remark: '采购入库', createdAt: '2026-07-01'
    }]
}

describe('useInventoryStore 库存 Store', () => {
    beforeEach(() => {
        createTestPinia()
        vi.clearAllMocks()
    })

    describe('初始状态', () => {
        it('batches 初始为空数组', () => {
            const store = useInventoryStore()
            expect(store.batches).toEqual([])
        })
        it('stockFlows 初始为空数组', () => {
            const store = useInventoryStore()
            expect(store.stockFlows).toEqual([])
        })
        it('loading 初始为 false', () => {
            const store = useInventoryStore()
            expect(store.loading).toBe(false)
        })
    })

    describe('loadInventoryDetail 加载商品库存详情', () => {
        it('成功后写入 batches 和 stockFlows', async () => {
            apiMocks.getInventoryDetail.mockResolvedValue(mockDetail)
            const store = useInventoryStore()
            const result = await store.loadInventoryDetail('p-1')
            expect(result).toEqual(mockDetail)
            expect(store.batches).toEqual(mockDetail.batches)
            expect(store.stockFlows).toEqual(mockDetail.recentFlows)
        })
        it('加载过程中 loading 为 true', async () => {
            let resolveFn!: (v: InventoryDetail) => void
            apiMocks.getInventoryDetail.mockReturnValue(
                new Promise<InventoryDetail>(r => { resolveFn = r })
            )
            const store = useInventoryStore()
            const promise = store.loadInventoryDetail('p-1')
            expect(store.loading).toBe(true)
            resolveFn(mockDetail)
            await promise
            expect(store.loading).toBe(false)
        })
        it('api 抛错时 loading 仍重置为 false', async () => {
            apiMocks.getInventoryDetail.mockRejectedValue(new Error('查询失败'))
            const store = useInventoryStore()
            await expect(store.loadInventoryDetail('p-1')).rejects.toThrow('查询失败')
            expect(store.loading).toBe(false)
        })
        it('调用 api.getInventoryDetail 传入 productId', async () => {
            apiMocks.getInventoryDetail.mockResolvedValue(mockDetail)
            const store = useInventoryStore()
            await store.loadInventoryDetail('p-1')
            expect(apiMocks.getInventoryDetail).toHaveBeenCalledWith('p-1')
        })
    })

    describe('stockIn 采购入库', () => {
        it('返回 api 调用结果', async () => {
            const input: PurchaseInput = {
                supplierId: 'sup-1',
                items: [{ productId: 'p-1', unitId: 'u-1', quantity: 10, unitPrice: 50 }]
            }
            const mockOrder: PurchaseOrder = {
                id: 'po-1', orderNo: 'PO001', supplierId: 'sup-1',
                supplierName: '浙江茶商', handler: null, totalAmount: 500,
                paymentStatus: 'unpaid', remark: '', items: [], createdAt: '2026-07-01'
            }
            apiMocks.purchaseIn.mockResolvedValue(mockOrder)
            const store = useInventoryStore()
            const result = await store.stockIn(input)
            expect(result).toEqual(mockOrder)
            expect(apiMocks.purchaseIn).toHaveBeenCalledWith(input)
        })
    })

    describe('stockOut 报损出库', () => {
        it('返回 api 调用结果', async () => {
            const input: DamageOutInput = {
                productId: 'p-1', grams: 50, remark: '过期'
            }
            const mockResult: StockChangeResult = {
                success: true, productId: 'p-1', changeGrams: -50,
                newBalance: 450, flowId: 'f-2'
            }
            apiMocks.damageOut.mockResolvedValue(mockResult)
            const store = useInventoryStore()
            const result = await store.stockOut(input)
            expect(result).toEqual(mockResult)
            expect(apiMocks.damageOut).toHaveBeenCalledWith(input)
        })
    })

    describe('adjust 盘点调整', () => {
        it('返回 api 调用结果', async () => {
            const input: AdjustInput = {
                productId: 'p-1', grams: 100, remark: '盘点+100'
            }
            const mockResult: StockChangeResult = {
                success: true, productId: 'p-1', changeGrams: 100,
                newBalance: 600, flowId: 'f-3'
            }
            apiMocks.adjustStock.mockResolvedValue(mockResult)
            const store = useInventoryStore()
            const result = await store.adjust(input)
            expect(result).toEqual(mockResult)
            expect(apiMocks.adjustStock).toHaveBeenCalledWith(input)
        })
    })
})
