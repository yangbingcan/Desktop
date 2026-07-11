/**
 * @file 供应商 Store 单元测试
 * @description 测试 src/stores/suppliers.ts 中的 useSupplierStore
 *              覆盖 loadSuppliers/loadActiveSuppliers/loadSupplier/addSupplier/updateSupplierById/removeSupplier
 *              通过 mock @/api/suppliers 验证 store 状态变化
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestPinia } from './_helpers'

// mock api/suppliers 模块（用 vi.hoisted 提升至 vi.mock 工厂可访问的作用域）
const apiMocks = vi.hoisted(() => ({
    getSuppliers: vi.fn(),
    getAllActiveSuppliers: vi.fn(),
    getSupplier: vi.fn(),
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    deleteSupplier: vi.fn()
}))
vi.mock('@/api/suppliers', () => apiMocks)

import { useSupplierStore } from '@/stores/suppliers'
import type { Supplier, SupplierInput, PageResult } from '@/types'

// 测试数据
const mockSupplier1: Supplier = {
    id: 's-1',
    name: '安溪茶厂',
    contactPerson: '张三',
    contactPhone: '13800000001',
    address: '福建泉州',
    mainCategories: ['铁观音'],
    remark: '老供应商',
    isActive: true,
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01'
}
const mockSupplier2: Supplier = {
    id: 's-2',
    name: '武夷山茶厂',
    contactPerson: '李四',
    contactPhone: '13800000002',
    address: '福建南平',
    mainCategories: ['大红袍', '岩茶'],
    remark: '',
    isActive: true,
    createdAt: '2026-07-02',
    updatedAt: '2026-07-02'
}
const mockInactiveSupplier: Supplier = {
    ...mockSupplier1,
    id: 's-3',
    name: '已禁用茶厂',
    isActive: false
}

// 用于新增/更新的输入
const inputForCreate: SupplierInput = {
    name: '安溪茶厂',
    contactPerson: '张三',
    contactPhone: '13800000001',
    address: '福建泉州',
    mainCategories: ['铁观音'],
    remark: '老供应商'
}

describe('useSupplierStore 供应商 Store', () => {
    beforeEach(() => {
        createTestPinia()
        vi.clearAllMocks()
    })

    // ========== 初始状态 ==========
    describe('初始状态', () => {
        it('suppliers 初始为空数组', () => {
            const store = useSupplierStore()
            expect(store.suppliers).toEqual([])
        })
        it('activeSuppliers 初始为空数组', () => {
            const store = useSupplierStore()
            expect(store.activeSuppliers).toEqual([])
        })
        it('total 初始为 0', () => {
            const store = useSupplierStore()
            expect(store.total).toBe(0)
        })
        it('loading 初始为 false', () => {
            const store = useSupplierStore()
            expect(store.loading).toBe(false)
        })
    })

    // ========== loadSuppliers ==========
    describe('loadSuppliers 加载供应商列表', () => {
        it('成功后写入 suppliers 和 total，并返回结果', async () => {
            const pageResult: PageResult<Supplier> = {
                list: [mockSupplier1, mockSupplier2],
                total: 2,
                page: 1,
                pageSize: 20
            }
            apiMocks.getSuppliers.mockResolvedValue(pageResult)
            const store = useSupplierStore()
            const result = await store.loadSuppliers(1, 20, '茶')
            expect(result).toEqual(pageResult)
            expect(store.suppliers).toEqual([mockSupplier1, mockSupplier2])
            expect(store.total).toBe(2)
            expect(apiMocks.getSuppliers).toHaveBeenCalledWith(1, 20, '茶')
        })
        it('loading 状态在请求期间为 true，结束后为 false', async () => {
            let resolveFn!: (v: PageResult<Supplier>) => void
            apiMocks.getSuppliers.mockReturnValue(
                new Promise<PageResult<Supplier>>(r => { resolveFn = r })
            )
            const store = useSupplierStore()
            const promise = store.loadSuppliers()
            expect(store.loading).toBe(true)
            resolveFn({ list: [], total: 0, page: 1, pageSize: 20 })
            await promise
            expect(store.loading).toBe(false)
        })
        it('api 抛错时 loading 重置为 false 且错误向上抛出', async () => {
            apiMocks.getSuppliers.mockRejectedValue(new Error('加载失败'))
            const store = useSupplierStore()
            await expect(store.loadSuppliers()).rejects.toThrow('加载失败')
            expect(store.loading).toBe(false)
        })
        it('调用时不传参时 api.getSuppliers 收到 undefined', async () => {
            apiMocks.getSuppliers.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
            const store = useSupplierStore()
            await store.loadSuppliers()
            expect(apiMocks.getSuppliers).toHaveBeenCalledWith(undefined, undefined, undefined)
        })
    })

    // ========== loadActiveSuppliers ==========
    describe('loadActiveSuppliers 加载启用供应商', () => {
        it('成功后写入 activeSuppliers 并返回', async () => {
            apiMocks.getAllActiveSuppliers.mockResolvedValue([mockSupplier1, mockSupplier2])
            const store = useSupplierStore()
            const result = await store.loadActiveSuppliers()
            expect(result).toEqual([mockSupplier1, mockSupplier2])
            expect(store.activeSuppliers).toEqual([mockSupplier1, mockSupplier2])
        })
        it('api 抛错时错误向上抛出，activeSuppliers 不变', async () => {
            apiMocks.getAllActiveSuppliers.mockRejectedValue(new Error('加载失败'))
            const store = useSupplierStore()
            store.activeSuppliers = [mockSupplier1]
            await expect(store.loadActiveSuppliers()).rejects.toThrow('加载失败')
            expect(store.activeSuppliers).toEqual([mockSupplier1])
        })
    })

    // ========== loadSupplier ==========
    describe('loadSupplier 获取供应商详情', () => {
        it('返回 api 调用结果，不修改 store 状态', async () => {
            apiMocks.getSupplier.mockResolvedValue(mockSupplier1)
            const store = useSupplierStore()
            const result = await store.loadSupplier('s-1')
            expect(result).toEqual(mockSupplier1)
            expect(apiMocks.getSupplier).toHaveBeenCalledWith('s-1')
            // store 列表状态不被修改
            expect(store.suppliers).toEqual([])
        })
        it('api 抛错时错误向上抛出', async () => {
            apiMocks.getSupplier.mockRejectedValue(new Error('详情加载失败'))
            const store = useSupplierStore()
            await expect(store.loadSupplier('s-x')).rejects.toThrow('详情加载失败')
        })
    })

    // ========== addSupplier ==========
    describe('addSupplier 新增供应商', () => {
        it('成功后插入到 suppliers 数组开头，并按 name 排序追加到 activeSuppliers', async () => {
            apiMocks.createSupplier.mockResolvedValue(mockSupplier1)
            const store = useSupplierStore()
            store.suppliers = [mockSupplier2]  // 已有 s-2 武夷山茶厂
            store.activeSuppliers = [mockSupplier2]
            const result = await store.addSupplier(inputForCreate)
            expect(result).toEqual(mockSupplier1)
            expect(store.suppliers).toHaveLength(2)
            // unshift 把新供应商放到开头
            expect(store.suppliers[0]).toEqual(mockSupplier1)
            expect(store.suppliers[1]).toEqual(mockSupplier2)
            // activeSuppliers 也追加并按 name 排序（'安溪茶厂' < '武夷山茶厂'）
            expect(store.activeSuppliers).toHaveLength(2)
            expect(store.activeSuppliers.map(s => s.name)).toEqual(['安溪茶厂', '武夷山茶厂'])
        })
        it('activeSuppliers 为空时直接追加新供应商', async () => {
            apiMocks.createSupplier.mockResolvedValue(mockSupplier1)
            const store = useSupplierStore()
            const result = await store.addSupplier(inputForCreate)
            expect(result).toEqual(mockSupplier1)
            expect(store.activeSuppliers).toEqual([mockSupplier1])
        })
        it('api 抛错时错误向上抛出，suppliers 和 activeSuppliers 不变', async () => {
            apiMocks.createSupplier.mockRejectedValue(new Error('创建失败'))
            const store = useSupplierStore()
            store.suppliers = [mockSupplier2]
            store.activeSuppliers = [mockSupplier2]
            await expect(store.addSupplier(inputForCreate)).rejects.toThrow('创建失败')
            expect(store.suppliers).toEqual([mockSupplier2])
            expect(store.activeSuppliers).toEqual([mockSupplier2])
        })
    })

    // ========== updateSupplierById ==========
    describe('updateSupplierById 更新供应商', () => {
        it('成功后同步更新 suppliers 和 activeSuppliers 中的对应项', async () => {
            const updated = { ...mockSupplier1, name: '安溪茶厂（新）' }
            apiMocks.updateSupplier.mockResolvedValue(updated)
            const store = useSupplierStore()
            store.suppliers = [mockSupplier1, mockSupplier2]
            store.activeSuppliers = [mockSupplier1, mockSupplier2]
            const result = await store.updateSupplierById('s-1', inputForCreate)
            expect(result).toEqual(updated)
            expect(store.suppliers[0]).toEqual(updated)
            expect(store.suppliers[1]).toEqual(mockSupplier2)
            expect(store.activeSuppliers[0]).toEqual(updated)
            expect(store.activeSuppliers[1]).toEqual(mockSupplier2)
            expect(apiMocks.updateSupplier).toHaveBeenCalledWith('s-1', inputForCreate)
        })
        it('suppliers 中找不到 id 时仅更新 activeSuppliers', async () => {
            const updated = { ...mockSupplier1, name: '安溪茶厂（新）' }
            apiMocks.updateSupplier.mockResolvedValue(updated)
            const store = useSupplierStore()
            store.suppliers = []  // suppliers 为空
            store.activeSuppliers = [mockSupplier1, mockSupplier2]
            await store.updateSupplierById('s-1', inputForCreate)
            expect(store.suppliers).toEqual([])  // 仍为空
            expect(store.activeSuppliers[0]).toEqual(updated)
        })
        it('activeSuppliers 中找不到 id 时仅更新 suppliers', async () => {
            const updated = { ...mockSupplier1, name: '安溪茶厂（新）' }
            apiMocks.updateSupplier.mockResolvedValue(updated)
            const store = useSupplierStore()
            store.suppliers = [mockSupplier1, mockSupplier2]
            store.activeSuppliers = []  // activeSuppliers 为空
            await store.updateSupplierById('s-1', inputForCreate)
            expect(store.suppliers[0]).toEqual(updated)
            expect(store.activeSuppliers).toEqual([])
        })
        it('api 抛错时错误向上抛出', async () => {
            apiMocks.updateSupplier.mockRejectedValue(new Error('更新失败'))
            const store = useSupplierStore()
            await expect(store.updateSupplierById('s-1', inputForCreate))
                .rejects.toThrow('更新失败')
        })
    })

    // ========== removeSupplier ==========
    describe('removeSupplier 删除供应商', () => {
        it('成功后从 suppliers 和 activeSuppliers 中同步移除', async () => {
            apiMocks.deleteSupplier.mockResolvedValue(undefined)
            const store = useSupplierStore()
            store.suppliers = [mockSupplier1, mockSupplier2]
            store.activeSuppliers = [mockSupplier1, mockSupplier2]
            await store.removeSupplier('s-1')
            expect(apiMocks.deleteSupplier).toHaveBeenCalledWith('s-1')
            expect(store.suppliers).toHaveLength(1)
            expect(store.suppliers[0].id).toBe('s-2')
            expect(store.activeSuppliers).toHaveLength(1)
            expect(store.activeSuppliers[0].id).toBe('s-2')
        })
        it('被删除的 id 不在列表中时也调用 api 且不抛错', async () => {
            apiMocks.deleteSupplier.mockResolvedValue(undefined)
            const store = useSupplierStore()
            store.suppliers = [mockSupplier1]
            store.activeSuppliers = [mockSupplier1]
            await store.removeSupplier('s-x')  // 不存在
            expect(apiMocks.deleteSupplier).toHaveBeenCalledWith('s-x')
            expect(store.suppliers).toHaveLength(1)
        })
        it('api 抛错时错误向上抛出，列表不变', async () => {
            apiMocks.deleteSupplier.mockRejectedValue(new Error('删除失败'))
            const store = useSupplierStore()
            store.suppliers = [mockSupplier1]
            store.activeSuppliers = [mockSupplier1]
            await expect(store.removeSupplier('s-1')).rejects.toThrow('删除失败')
            expect(store.suppliers).toHaveLength(1)
        })
    })
})
