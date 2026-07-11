/**
 * @file 库存 API 单元测试
 * @description 测试 src/api/inventory.ts 中的所有函数
 *              重点验证 camelCase 参数命名（productId、pageSize 等）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockInvoke, resetInvokeMock } from './_helpers'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke
}))

import {
    getInventory,
    getInventoryDetail,
    getStockFlows,
    purchaseIn,
    damageOut,
    adjustStock
} from '@/api/inventory'
import type {
    InventoryItem, InventoryDetail, StockFlow,
    PurchaseInput, PurchaseOrder, DamageOutInput, AdjustInput,
    StockChangeResult, PageResult
} from '@/types'

// 测试数据
const mockInventoryItem: InventoryItem = {
    productId: 'p-1',
    productName: '龙井',
    categoryName: '绿茶',
    productType: 'weight',
    stockGrams: 500,
    stockUnits: 10,
    displayStock: '500g'
}

const mockBatch = {
    id: 'b-1',
    productId: 'p-1',
    batchCode: 'B20260701001',
    purchasePrice: 50,
    totalGrams: 1000,
    remainingGrams: 500,
    supplierId: 'sup-1',
    producedDate: null,
    expireDate: null,
    createdAt: '2026-07-01'
}

const mockFlow: StockFlow = {
    id: 'f-1',
    productId: 'p-1',
    batchId: 'b-1',
    flowType: 'purchaseIn',
    changeGrams: 1000,
    balanceGrams: 1000,
    orderId: null,
    remark: '采购入库',
    createdAt: '2026-07-01 10:00:00'
}

const mockInventoryDetail: InventoryDetail = {
    productId: 'p-1',
    productName: '龙井',
    categoryName: '绿茶',
    productType: 'weight',
    stockGrams: 500,
    stockUnits: 10,
    batches: [mockBatch],
    recentFlows: [mockFlow]
}

const mockPurchaseOrder: PurchaseOrder = {
    id: 'po-1',
    orderNo: 'PO20260701001',
    supplierId: 'sup-1',
    supplierName: '浙江茶商',
    handler: '张三',
    totalAmount: 500,
    paymentStatus: 'unpaid',
    remark: '',
    items: [],
    createdAt: '2026-07-01'
}

describe('api/inventory 库存 API', () => {
    beforeEach(() => {
        resetInvokeMock()
    })

    // ========== getInventory ==========
    describe('getInventory 获取库存列表', () => {
        it('使用默认参数调用 get_inventory', async () => {
            const mockResult: PageResult<InventoryItem> = {
                list: [mockInventoryItem],
                total: 1,
                page: 1,
                pageSize: 20
            }
            mockInvoke.mockResolvedValue(mockResult)
            const result = await getInventory()
            expect(mockInvoke).toHaveBeenCalledWith('get_inventory', {
                page: 1,
                pageSize: 20,
                categoryId: null
            })
            expect(result).toEqual(mockResult)
        })
        it('传入 page/pageSize/categoryId 时正确传递', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 50 })
            await getInventory(2, 50, 'cat-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_inventory', {
                page: 2,
                pageSize: 50,
                categoryId: 'cat-1'
            })
        })
        it('categoryId 为 undefined 时传 null', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
            await getInventory(1, 20, undefined)
            expect(mockInvoke).toHaveBeenCalledWith('get_inventory', {
                page: 1,
                pageSize: 20,
                categoryId: null
            })
        })
    })

    // ========== getInventoryDetail ==========
    describe('getInventoryDetail 获取商品库存详情', () => {
        it('调用 get_inventory_detail，传入 { productId }（camelCase）', async () => {
            mockInvoke.mockResolvedValue(mockInventoryDetail)
            const result = await getInventoryDetail('p-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_inventory_detail', { productId: 'p-1' })
            expect(result).toEqual(mockInventoryDetail)
        })
    })

    // ========== getStockFlows ==========
    describe('getStockFlows 获取库存流水', () => {
        it('使用默认参数调用 get_stock_flows', async () => {
            mockInvoke.mockResolvedValue({ list: [mockFlow], total: 1, page: 1, pageSize: 20 })
            await getStockFlows('p-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_stock_flows', {
                productId: 'p-1',
                page: 1,
                pageSize: 20
            })
        })
        it('传入自定义分页参数', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 3, pageSize: 50 })
            await getStockFlows('p-1', 3, 50)
            expect(mockInvoke).toHaveBeenCalledWith('get_stock_flows', {
                productId: 'p-1',
                page: 3,
                pageSize: 50
            })
        })
    })

    // ========== purchaseIn ==========
    describe('purchaseIn 采购入库', () => {
        it('调用 purchase_in 命令，传入 { input }', async () => {
            const input: PurchaseInput = {
                supplierId: 'sup-1',
                handler: '张三',
                items: [
                    { productId: 'p-1', unitId: 'u-1', quantity: 10, unitPrice: 50 }
                ],
                remark: '首批采购',
                paymentStatus: 'unpaid'
            }
            mockInvoke.mockResolvedValue(mockPurchaseOrder)
            const result = await purchaseIn(input)
            expect(mockInvoke).toHaveBeenCalledWith('purchase_in', { input })
            expect(result).toEqual(mockPurchaseOrder)
        })
    })

    // ========== damageOut ==========
    describe('damageOut 报损出库', () => {
        it('调用 damage_out 命令，传入 { input }', async () => {
            const input: DamageOutInput = {
                productId: 'p-1',
                grams: 50,
                remark: '过期损坏'
            }
            const mockResult: StockChangeResult = {
                success: true,
                productId: 'p-1',
                changeGrams: -50,
                newBalance: 450,
                flowId: 'f-2'
            }
            mockInvoke.mockResolvedValue(mockResult)
            const result = await damageOut(input)
            expect(mockInvoke).toHaveBeenCalledWith('damage_out', { input })
            expect(result).toEqual(mockResult)
        })
    })

    // ========== adjustStock ==========
    describe('adjustStock 盘点调整', () => {
        it('调用 adjust_stock 命令，传入 { input }', async () => {
            const input: AdjustInput = {
                productId: 'p-1',
                grams: 100,
                remark: '盘点调整 +100g'
            }
            const mockResult: StockChangeResult = {
                success: true,
                productId: 'p-1',
                changeGrams: 100,
                newBalance: 600,
                flowId: 'f-3'
            }
            mockInvoke.mockResolvedValue(mockResult)
            const result = await adjustStock(input)
            expect(mockInvoke).toHaveBeenCalledWith('adjust_stock', { input })
            expect(result).toEqual(mockResult)
        })
    })

    // ========== 错误传播 ==========
    describe('错误传播', () => {
        it('invoke 抛错时，API 函数应向上抛出', async () => {
            mockInvoke.mockRejectedValue(new Error('库存不足'))
            await expect(getInventoryDetail('p-1')).rejects.toThrow('库存不足')
        })
    })
})
