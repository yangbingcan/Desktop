/**
 * @file 商品 Store 单元测试
 * @description 测试 src/stores/products.ts 中的 useProductStore
 *              通过 mock @/api/products 验证 store 状态变化和计算属性
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestPinia } from './_helpers'

// mock api/products 模块（用 vi.hoisted 提升至 vi.mock 工厂可访问的作用域）
const apiMocks = vi.hoisted(() => ({
    getProducts: vi.fn(),
    getCategories: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getProductUnits: vi.fn()
}))
vi.mock('@/api/products', () => apiMocks)

import { useProductStore } from '@/stores/products'
import type { Product, ProductCategory, SalesUnit } from '@/types'

// 测试数据
const mockProduct1: Product = {
    id: 'p-1',
    code: 'SP20260701001',
    name: '龙井',
    categoryId: 'cat-1',
    type: 'weight',
    baseUnit: 'g',
    isActive: true,
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01'
}
const mockProduct2: Product = {
    id: 'p-2',
    code: 'SP20260701002',
    name: '茶杯',
    categoryId: 'cat-2',
    type: 'count',
    baseUnit: 'pcs',
    isActive: true,
    createdAt: '2026-07-02',
    updatedAt: '2026-07-02'
}
const mockCategory1: ProductCategory = {
    id: 'cat-1', name: '绿茶', level: 1, sortOrder: 1
}
const mockCategory2: ProductCategory = {
    id: 'cat-2', name: '茶具', level: 1, sortOrder: 2
}
const mockCategory3: ProductCategory = {
    id: 'cat-3', name: '龙井', parentId: 'cat-1', level: 2, sortOrder: 1
}
const mockUnit: SalesUnit = {
    id: 'u-1', productId: 'p-1', name: '50g',
    conversionToBase: 50, retailPrice: 80, memberPrice: 70
}

describe('useProductStore 商品 Store', () => {
    beforeEach(() => {
        createTestPinia()
        vi.clearAllMocks()
    })

    // ========== 初始状态 ==========
    describe('初始状态', () => {
        it('products 初始为空数组', () => {
            const store = useProductStore()
            expect(store.products).toEqual([])
        })
        it('categories 初始为空数组', () => {
            const store = useProductStore()
            expect(store.categories).toEqual([])
        })
        it('loading 初始为 false', () => {
            const store = useProductStore()
            expect(store.loading).toBe(false)
        })
        it('currentProduct 初始为 null', () => {
            const store = useProductStore()
            expect(store.currentProduct).toBeNull()
        })
    })

    // ========== 计算属性 ==========
    describe('计算属性', () => {
        it('productMap 返回 id -> Product 的映射', () => {
            const store = useProductStore()
            store.products = [mockProduct1, mockProduct2]
            const map = store.productMap
            expect(map.size).toBe(2)
            expect(map.get('p-1')).toEqual(mockProduct1)
            expect(map.get('p-2')).toEqual(mockProduct2)
        })
        it('weightProducts 过滤出称重类商品', () => {
            const store = useProductStore()
            store.products = [mockProduct1, mockProduct2]
            expect(store.weightProducts).toHaveLength(1)
            expect(store.weightProducts[0].id).toBe('p-1')
        })
        it('countProducts 过滤出计件类商品', () => {
            const store = useProductStore()
            store.products = [mockProduct1, mockProduct2]
            expect(store.countProducts).toHaveLength(1)
            expect(store.countProducts[0].id).toBe('p-2')
        })
        it('topCategories 过滤出一级分类', () => {
            const store = useProductStore()
            store.categories = [mockCategory1, mockCategory2, mockCategory3]
            const top = store.topCategories
            expect(top).toHaveLength(2)
            expect(top.map(c => c.id).sort()).toEqual(['cat-1', 'cat-2'])
        })
    })

    // ========== loadProducts ==========
    describe('loadProducts 加载商品列表', () => {
        it('成功加载后写入 products 数组', async () => {
            apiMocks.getProducts.mockResolvedValue([mockProduct1, mockProduct2])
            const store = useProductStore()
            await store.loadProducts()
            expect(store.products).toEqual([mockProduct1, mockProduct2])
            expect(store.loading).toBe(false)
        })
        it('加载过程中 loading 为 true', async () => {
            let resolveFn!: (v: Product[]) => void
            apiMocks.getProducts.mockReturnValue(new Promise<Product[]>(r => { resolveFn = r }))
            const store = useProductStore()
            const promise = store.loadProducts()
            expect(store.loading).toBe(true)
            resolveFn([mockProduct1])
            await promise
            expect(store.loading).toBe(false)
        })
        it('加载完成后无论成功失败 loading 都重置为 false', async () => {
            apiMocks.getProducts.mockRejectedValue(new Error('网络错误'))
            const store = useProductStore()
            await expect(store.loadProducts()).rejects.toThrow('网络错误')
            expect(store.loading).toBe(false)
        })
        it('api 抛错时错误向上抛出', async () => {
            apiMocks.getProducts.mockRejectedValue(new Error('加载失败'))
            const store = useProductStore()
            await expect(store.loadProducts()).rejects.toThrow('加载失败')
        })
        it('调用 api.getProducts 无参数', async () => {
            apiMocks.getProducts.mockResolvedValue([])
            const store = useProductStore()
            await store.loadProducts()
            expect(apiMocks.getProducts).toHaveBeenCalledWith()
        })
    })

    // ========== loadCategories ==========
    describe('loadCategories 加载分类', () => {
        it('成功加载后写入 categories', async () => {
            apiMocks.getCategories.mockResolvedValue([mockCategory1, mockCategory2])
            const store = useProductStore()
            await store.loadCategories()
            expect(store.categories).toEqual([mockCategory1, mockCategory2])
        })
        it('api 抛错时错误向上抛出', async () => {
            apiMocks.getCategories.mockRejectedValue(new Error('分类加载失败'))
            const store = useProductStore()
            await expect(store.loadCategories()).rejects.toThrow('分类加载失败')
        })
    })

    // ========== addProduct ==========
    describe('addProduct 新增商品', () => {
        it('成功后追加到 products 数组末尾', async () => {
            const newProduct: Product = {
                id: 'p-new', code: 'SP20260701003', name: '碧螺春',
                categoryId: 'cat-1', type: 'weight', baseUnit: 'g',
                isActive: true, createdAt: '2026-07-03', updatedAt: '2026-07-03'
            }
            apiMocks.createProduct.mockResolvedValue(newProduct)
            const store = useProductStore()
            store.products = [mockProduct1]
            const result = await store.addProduct({
                name: '碧螺春', categoryId: 'cat-1', type: 'weight', units: []
            })
            expect(result).toEqual(newProduct)
            expect(store.products).toHaveLength(2)
            expect(store.products[1]).toEqual(newProduct)
        })
        it('api 抛错时错误向上抛出，products 不变', async () => {
            apiMocks.createProduct.mockRejectedValue(new Error('创建失败'))
            const store = useProductStore()
            store.products = [mockProduct1]
            await expect(store.addProduct({
                name: '碧螺春', categoryId: 'cat-1', type: 'weight', units: []
            })).rejects.toThrow('创建失败')
            expect(store.products).toHaveLength(1)
        })
    })

    // ========== updateProductById ==========
    describe('updateProductById 更新商品', () => {
        it('成功后更新 products 数组中对应 id 的商品', async () => {
            const updated = { ...mockProduct1, name: '龙井（特一级）' }
            apiMocks.updateProduct.mockResolvedValue(updated)
            const store = useProductStore()
            store.products = [mockProduct1, mockProduct2]
            const result = await store.updateProductById('p-1', { name: '龙井（特一级）' })
            expect(result).toEqual(updated)
            expect(store.products[0]).toEqual(updated)
            expect(store.products[1]).toEqual(mockProduct2)  // 其他商品不变
        })
        it('商品 id 不存在于列表中时，不修改数组但返回更新结果', async () => {
            const updated = { ...mockProduct1, id: 'p-x', name: '新商品' }
            apiMocks.updateProduct.mockResolvedValue(updated)
            const store = useProductStore()
            store.products = [mockProduct1]
            const result = await store.updateProductById('p-x', { name: '新商品' })
            expect(result).toEqual(updated)
            expect(store.products).toHaveLength(1)  // 列表不变
        })
        it('api 抛错时错误向上抛出', async () => {
            apiMocks.updateProduct.mockRejectedValue(new Error('更新失败'))
            const store = useProductStore()
            await expect(store.updateProductById('p-1', { name: '新名' }))
                .rejects.toThrow('更新失败')
        })
    })

    // ========== deleteProductById ==========
    describe('deleteProductById 删除商品', () => {
        it('成功后从 products 数组中移除对应 id', async () => {
            apiMocks.deleteProduct.mockResolvedValue(undefined)
            const store = useProductStore()
            store.products = [mockProduct1, mockProduct2]
            await store.deleteProductById('p-1')
            expect(store.products).toHaveLength(1)
            expect(store.products[0].id).toBe('p-2')
        })
        it('api 抛错时错误向上抛出，products 不变', async () => {
            apiMocks.deleteProduct.mockRejectedValue(new Error('删除失败'))
            const store = useProductStore()
            store.products = [mockProduct1]
            await expect(store.deleteProductById('p-1')).rejects.toThrow('删除失败')
            expect(store.products).toHaveLength(1)
        })
    })

    // ========== loadProductUnits ==========
    describe('loadProductUnits 获取商品销售单位', () => {
        it('返回 api 调用结果', async () => {
            apiMocks.getProductUnits.mockResolvedValue([mockUnit])
            const store = useProductStore()
            const result = await store.loadProductUnits('p-1')
            expect(result).toEqual([mockUnit])
            expect(apiMocks.getProductUnits).toHaveBeenCalledWith('p-1')
        })
        it('api 抛错时错误向上抛出', async () => {
            apiMocks.getProductUnits.mockRejectedValue(new Error('单位加载失败'))
            const store = useProductStore()
            await expect(store.loadProductUnits('p-1')).rejects.toThrow('单位加载失败')
        })
    })
})
