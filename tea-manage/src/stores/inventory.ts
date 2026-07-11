/**
 * @file 库存状态管理
 * @description 管理库存查询、批次、流水等状态，调用 api/inventory 层
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { InventoryBatch, StockFlow, InventoryDetail, PurchaseInput, DamageOutInput, AdjustInput, PurchaseOrder, StockChangeResult } from '@/types'
import { getInventoryDetail, purchaseIn, damageOut, adjustStock } from '@/api/inventory'

export const useInventoryStore = defineStore('inventory', () => {
    // ========== 状态 ==========
    const batches = ref<InventoryBatch[]>([])
    const stockFlows = ref<StockFlow[]>([])
    const loading = ref(false)

    // ========== Actions ==========

    /**
     * 加载商品库存详情（包含批次和流水）
     */
    async function loadInventoryDetail(productId: string): Promise<InventoryDetail> {
        loading.value = true
        try {
            const detail = await getInventoryDetail(productId)
            batches.value = detail.batches
            stockFlows.value = detail.recentFlows
            return detail
        } finally {
            loading.value = false
        }
    }

    /**
     * 采购入库
     */
    async function stockIn(input: PurchaseInput): Promise<PurchaseOrder> {
        return await purchaseIn(input)
    }

    /**
     * 报损出库
     */
    async function stockOut(input: DamageOutInput): Promise<StockChangeResult> {
        return await damageOut(input)
    }

    /**
     * 盘点调整
     */
    async function adjust(input: AdjustInput): Promise<StockChangeResult> {
        return await adjustStock(input)
    }

    return {
        batches,
        stockFlows,
        loading,
        loadInventoryDetail,
        stockIn,
        stockOut,
        adjust
    }
})
