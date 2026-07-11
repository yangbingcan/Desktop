/**
 * @file 供应商状态管理
 * @description 管理供应商档案，调用 api/suppliers 层
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Supplier, SupplierInput, PageResult } from '@/types'
import {
    getSuppliers, getAllActiveSuppliers, getSupplier,
    createSupplier, updateSupplier, deleteSupplier
} from '@/api/suppliers'

export const useSupplierStore = defineStore('suppliers', () => {
    // ========== 状态 ==========
    const suppliers = ref<Supplier[]>([])
    const activeSuppliers = ref<Supplier[]>([])  // 仅启用的供应商（下拉用）
    const total = ref(0)
    const loading = ref(false)

    // ========== Actions ==========

    /**
     * 加载供应商列表（分页 + 关键词）
     */
    async function loadSuppliers(
        page?: number, pageSize?: number, keyword?: string
    ): Promise<PageResult<Supplier>> {
        loading.value = true
        try {
            const result = await getSuppliers(page, pageSize, keyword)
            suppliers.value = result.list
            total.value = result.total
            return result
        } finally {
            loading.value = false
        }
    }

    /**
     * 加载所有启用的供应商（下拉用）
     */
    async function loadActiveSuppliers(): Promise<Supplier[]> {
        const list = await getAllActiveSuppliers()
        activeSuppliers.value = list
        return list
    }

    /**
     * 获取供应商详情
     */
    async function loadSupplier(id: string): Promise<Supplier> {
        return await getSupplier(id)
    }

    /**
     * 新增供应商
     */
    async function addSupplier(input: SupplierInput): Promise<Supplier> {
        const created = await createSupplier(input)
        suppliers.value.unshift(created)
        activeSuppliers.value = [...activeSuppliers.value, created].sort((a, b) =>
            a.name.localeCompare(b.name)
        )
        return created
    }

    /**
     * 更新供应商
     */
    async function updateSupplierById(
        id: string, input: SupplierInput
    ): Promise<Supplier> {
        const updated = await updateSupplier(id, input)
        const idx = suppliers.value.findIndex(s => s.id === id)
        if (idx !== -1) {
            suppliers.value[idx] = updated
        }
        const aIdx = activeSuppliers.value.findIndex(s => s.id === id)
        if (aIdx !== -1) {
            activeSuppliers.value[aIdx] = updated
        }
        return updated
    }

    /**
     * 删除供应商（软删除）
     */
    async function removeSupplier(id: string): Promise<void> {
        await deleteSupplier(id)
        suppliers.value = suppliers.value.filter(s => s.id !== id)
        activeSuppliers.value = activeSuppliers.value.filter(s => s.id !== id)
    }

    return {
        suppliers,
        activeSuppliers,
        total,
        loading,
        loadSuppliers,
        loadActiveSuppliers,
        loadSupplier,
        addSupplier,
        updateSupplierById,
        removeSupplier
    }
})
