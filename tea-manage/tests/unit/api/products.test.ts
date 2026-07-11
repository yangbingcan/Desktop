/**
 * @file 商品 API 单元测试
 * @description 测试 src/api/products.ts 中的所有函数
 *              通过 mock @tauri-apps/api/core 的 invoke 函数验证：
 *              - 调用的命令名是否正确
 *              - 传入参数是否符合契约（camelCase 键名）
 *              - 返回值处理是否正确
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockInvoke, resetInvokeMock } from './_helpers'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke
}))

import {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductUnits,
    searchProducts,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} from '@/api/products'
import type { Product, ProductCategory, SalesUnit, ProductCreateInput, ProductUpdateInput } from '@/types'

// 测试数据
const mockProduct: Product = {
    id: 'p-1',
    code: 'SP20260701001',
    name: '龙井',
    categoryId: 'cat-1',
    type: 'weight',
    baseUnit: 'g',
    origin: '杭州',
    year: '2024',
    grade: '特级',
    isActive: true,
    createdAt: '2026-07-01 10:00:00',
    updatedAt: '2026-07-01 10:00:00'
}

const mockUnit: SalesUnit = {
    id: 'u-1',
    productId: 'p-1',
    name: '50g',
    conversionToBase: 50,
    retailPrice: 80,
    memberPrice: 70
}

const mockCategory: ProductCategory = {
    id: 'cat-1',
    name: '绿茶',
    level: 1,
    sortOrder: 1
}

describe('api/products 商品 API', () => {
    beforeEach(() => {
        resetInvokeMock()
    })

    // ========== getProducts ==========
    describe('getProducts 获取商品列表', () => {
        it('调用 get_products 命令，传入 page=1, pageSize=100', async () => {
            mockInvoke.mockResolvedValue({ list: [mockProduct] })
            const result = await getProducts()
            expect(mockInvoke).toHaveBeenCalledWith('get_products', {
                page: 1,
                pageSize: 100
            })
            expect(result).toEqual([mockProduct])
        })
        it('返回 list 为空数组时，结果为 []', async () => {
            mockInvoke.mockResolvedValue({ list: [] })
            const result = await getProducts()
            expect(result).toEqual([])
        })
        it('返回 list 为 undefined 时，结果为 []', async () => {
            mockInvoke.mockResolvedValue({})
            const result = await getProducts()
            expect(result).toEqual([])
        })
    })

    // ========== getProduct ==========
    describe('getProduct 获取单个商品', () => {
        it('调用 get_product 命令，传入 { id }', async () => {
            mockInvoke.mockResolvedValue(mockProduct)
            const result = await getProduct('p-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_product', { id: 'p-1' })
            expect(result).toEqual(mockProduct)
        })
    })

    // ========== createProduct ==========
    describe('createProduct 创建商品', () => {
        it('调用 create_product 命令，参数名为 product', async () => {
            const input: ProductCreateInput = {
                name: '碧螺春',
                categoryId: 'cat-2',
                type: 'weight',
                units: [mockUnit]
            }
            mockInvoke.mockResolvedValue(mockProduct)
            const result = await createProduct(input)
            expect(mockInvoke).toHaveBeenCalledWith('create_product', { product: input })
            expect(result).toEqual(mockProduct)
        })
    })

    // ========== updateProduct ==========
    describe('updateProduct 更新商品', () => {
        it('调用 update_product 命令，参数名为 id + update（注意：不是 product）', async () => {
            const update: ProductUpdateInput = {
                name: '碧螺春（新）',
                grade: '一级'
            }
            mockInvoke.mockResolvedValue({ ...mockProduct, ...update })
            const result = await updateProduct('p-1', update)
            // 注意：后端 Rust 函数参数名为 update，不是 product
            expect(mockInvoke).toHaveBeenCalledWith('update_product', {
                id: 'p-1',
                update: update
            })
            expect(result.name).toBe('碧螺春（新）')
        })
    })

    // ========== deleteProduct ==========
    describe('deleteProduct 删除商品', () => {
        it('调用 delete_product 命令，传入 { id }', async () => {
            mockInvoke.mockResolvedValue(undefined)
            await deleteProduct('p-1')
            expect(mockInvoke).toHaveBeenCalledWith('delete_product', { id: 'p-1' })
        })
    })

    // ========== getProductUnits ==========
    describe('getProductUnits 获取商品销售单位', () => {
        it('调用 get_product_units 命令，传入 { productId }（camelCase）', async () => {
            mockInvoke.mockResolvedValue([mockUnit])
            const result = await getProductUnits('p-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_product_units', { productId: 'p-1' })
            expect(result).toEqual([mockUnit])
        })
        it('productId 为空字符串时抛出错误', async () => {
            await expect(getProductUnits('')).rejects.toThrow('商品 ID 不能为空')
            expect(mockInvoke).not.toHaveBeenCalled()
        })
        it('productId 为 undefined 时抛出错误', async () => {
            await expect(getProductUnits(undefined as unknown as string)).rejects.toThrow()
            expect(mockInvoke).not.toHaveBeenCalled()
        })
    })

    // ========== searchProducts ==========
    describe('searchProducts 搜索商品', () => {
        it('调用 get_products 命令，传入 keyword 参数', async () => {
            mockInvoke.mockResolvedValue({ list: [mockProduct] })
            const result = await searchProducts('龙井')
            expect(mockInvoke).toHaveBeenCalledWith('get_products', {
                page: 1,
                pageSize: 100,
                keyword: '龙井'
            })
            expect(result).toEqual([mockProduct])
        })
        it('无搜索结果返回空数组', async () => {
            mockInvoke.mockResolvedValue({ list: [] })
            const result = await searchProducts('不存在的茶')
            expect(result).toEqual([])
        })
    })

    // ========== getCategories ==========
    describe('getCategories 获取商品分类', () => {
        it('调用 get_categories 命令，无参数', async () => {
            mockInvoke.mockResolvedValue([mockCategory])
            const result = await getCategories()
            expect(mockInvoke).toHaveBeenCalledWith('get_categories')
            expect(result).toEqual([mockCategory])
        })
    })

    // ========== createCategory ==========
    describe('createCategory 创建分类', () => {
        it('调用 create_category 命令，参数名为 category', async () => {
            const input = { name: '青茶', level: 1 as const, sortOrder: 1 }
            mockInvoke.mockResolvedValue({ ...input, id: 'cat-new' })
            const result = await createCategory(input)
            expect(mockInvoke).toHaveBeenCalledWith('create_category', { category: input })
            expect(result.id).toBe('cat-new')
        })
    })

    // ========== updateCategory ==========
    describe('updateCategory 更新分类', () => {
        it('调用 update_category 命令，参数名为 id + update', async () => {
            const update = { name: '青茶（更新）' }
            mockInvoke.mockResolvedValue({ ...mockCategory, ...update })
            const result = await updateCategory('cat-1', update)
            expect(mockInvoke).toHaveBeenCalledWith('update_category', {
                id: 'cat-1',
                update: update
            })
            expect(result.name).toBe('青茶（更新）')
        })
    })

    // ========== deleteCategory ==========
    describe('deleteCategory 删除分类', () => {
        it('调用 delete_category 命令，传入 { id }', async () => {
            mockInvoke.mockResolvedValue(undefined)
            await deleteCategory('cat-1')
            expect(mockInvoke).toHaveBeenCalledWith('delete_category', { id: 'cat-1' })
        })
    })

    // ========== 错误传播 ==========
    describe('错误传播', () => {
        it('invoke 抛错时，API 函数应向上抛出', async () => {
            const error = new Error('数据库错误')
            mockInvoke.mockRejectedValue(error)
            await expect(getProducts()).rejects.toThrow('数据库错误')
        })
    })
})
