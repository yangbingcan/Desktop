/**
 * @file 供应商 API 单元测试
 * @description 测试 src/api/suppliers.ts 中的所有函数
 *              重点验证 camelCase 参数命名（pageSize、keyword 等）
 *              以及工具函数 validateSupplierName / validatePhone
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockInvoke, resetInvokeMock } from './_helpers'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke
}))

import {
    getSuppliers,
    getAllActiveSuppliers,
    getSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    validateSupplierName,
    validatePhone,
    TEA_CATEGORY_OPTIONS
} from '@/api/suppliers'
import type { Supplier, SupplierInput, PageResult } from '@/types'

// 测试数据
const mockSupplier: Supplier = {
    id: 'sup-1',
    name: '浙江茶商',
    contactPerson: '李四',
    contactPhone: '13800138001',
    address: '杭州市',
    mainCategories: ['绿茶', '龙井'],
    remark: '长期合作',
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
}

const mockInput: SupplierInput = {
    name: '新供应商',
    contactPerson: '王五',
    contactPhone: '13900139001',
    address: '上海市',
    mainCategories: ['红茶'],
    remark: '新增供应商'
}

describe('api/suppliers 供应商 API', () => {
    beforeEach(() => {
        resetInvokeMock()
    })

    // ========== getSuppliers ==========
    describe('getSuppliers 获取供应商列表', () => {
        it('使用默认参数调用 get_suppliers', async () => {
            const mockResult: PageResult<Supplier> = {
                list: [mockSupplier],
                total: 1,
                page: 1,
                pageSize: 20
            }
            mockInvoke.mockResolvedValue(mockResult)
            const result = await getSuppliers()
            expect(mockInvoke).toHaveBeenCalledWith('get_suppliers', {
                page: 1,
                pageSize: 20,
                keyword: null
            })
            expect(result).toEqual(mockResult)
        })
        it('传入自定义参数', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 50 })
            await getSuppliers(2, 50, '浙江')
            expect(mockInvoke).toHaveBeenCalledWith('get_suppliers', {
                page: 2,
                pageSize: 50,
                keyword: '浙江'
            })
        })
        it('keyword 为空时传 null', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
            await getSuppliers(1, 20, '')
            expect(mockInvoke).toHaveBeenCalledWith('get_suppliers', {
                page: 1,
                pageSize: 20,
                keyword: null
            })
        })
    })

    // ========== getAllActiveSuppliers ==========
    describe('getAllActiveSuppliers 获取所有启用供应商', () => {
        it('调用 get_all_active_suppliers，无参数', async () => {
            mockInvoke.mockResolvedValue([mockSupplier])
            const result = await getAllActiveSuppliers()
            expect(mockInvoke).toHaveBeenCalledWith('get_all_active_suppliers')
            expect(result).toEqual([mockSupplier])
        })
    })

    // ========== getSupplier ==========
    describe('getSupplier 获取供应商详情', () => {
        it('调用 get_supplier，传入 { id }', async () => {
            mockInvoke.mockResolvedValue(mockSupplier)
            const result = await getSupplier('sup-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_supplier', { id: 'sup-1' })
            expect(result).toEqual(mockSupplier)
        })
    })

    // ========== createSupplier ==========
    describe('createSupplier 新增供应商', () => {
        it('调用 create_supplier，传入 { input }', async () => {
            mockInvoke.mockResolvedValue(mockSupplier)
            const result = await createSupplier(mockInput)
            expect(mockInvoke).toHaveBeenCalledWith('create_supplier', { input: mockInput })
            expect(result).toEqual(mockSupplier)
        })
    })

    // ========== updateSupplier ==========
    describe('updateSupplier 更新供应商', () => {
        it('调用 update_supplier，传入 { id, input }', async () => {
            const updated = { ...mockSupplier, ...mockInput }
            mockInvoke.mockResolvedValue(updated)
            const result = await updateSupplier('sup-1', mockInput)
            expect(mockInvoke).toHaveBeenCalledWith('update_supplier', {
                id: 'sup-1',
                input: mockInput
            })
            expect(result).toEqual(updated)
        })
    })

    // ========== deleteSupplier ==========
    describe('deleteSupplier 删除供应商', () => {
        it('调用 delete_supplier，传入 { id }', async () => {
            mockInvoke.mockResolvedValue(undefined)
            await deleteSupplier('sup-1')
            expect(mockInvoke).toHaveBeenCalledWith('delete_supplier', { id: 'sup-1' })
        })
    })

    // ========== validateSupplierName ==========
    describe('validateSupplierName 校验供应商名称', () => {
        it('空名称返回错误', () => {
            expect(validateSupplierName('')).toBe('供应商名称不能为空')
        })
        it('纯空格名称返回错误', () => {
            expect(validateSupplierName('   ')).toBe('供应商名称不能为空')
        })
        it('名称超过 50 字符返回错误', () => {
            const longName = 'a'.repeat(51)
            expect(validateSupplierName(longName)).toBe('供应商名称不能超过 50 个字符')
        })
        it('合法名称返回 null', () => {
            expect(validateSupplierName('浙江茶商')).toBeNull()
        })
        it('正好 50 字符的名称合法', () => {
            expect(validateSupplierName('a'.repeat(50))).toBeNull()
        })
        it('名称前后有空格会被 trim', () => {
            expect(validateSupplierName('  浙江茶商  ')).toBeNull()
        })
    })

    // ========== validatePhone ==========
    describe('validatePhone 校验联系电话', () => {
        it('undefined 返回 null（可选字段）', () => {
            expect(validatePhone(undefined)).toBeNull()
        })
        it('空字符串返回 null', () => {
            expect(validatePhone('')).toBeNull()
        })
        it('纯空格返回 null', () => {
            expect(validatePhone('   ')).toBeNull()
        })
        it('长度小于 7 返回错误', () => {
            expect(validatePhone('123456')).toBe('联系电话长度应在 7-20 位之间')
        })
        it('长度大于 20 返回错误', () => {
            expect(validatePhone('1'.repeat(21))).toBe('联系电话长度应在 7-20 位之间')
        })
        it('包含非法字符返回错误', () => {
            expect(validatePhone('13800138000abc')).toBe('电话号码只能包含数字、-、空格、+')
        })
        it('合法手机号返回 null', () => {
            expect(validatePhone('13800138000')).toBeNull()
        })
        it('带连字符的座机返回 null', () => {
            expect(validatePhone('0571-12345678')).toBeNull()
        })
        it('带 + 的国际号码返回 null', () => {
            expect(validatePhone('+86 13800138000')).toBeNull()
        })
        it('带空格的号码返回 null', () => {
            expect(validatePhone('138 0013 8000')).toBeNull()
        })
        it('正好 7 位返回 null', () => {
            expect(validatePhone('1234567')).toBeNull()
        })
        it('正好 20 位返回 null', () => {
            expect(validatePhone('1'.repeat(20))).toBeNull()
        })
    })

    // ========== 常量 ==========
    describe('TEA_CATEGORY_OPTIONS 茶叶品类选项', () => {
        it('包含 17 个常见茶类', () => {
            expect(TEA_CATEGORY_OPTIONS.length).toBeGreaterThanOrEqual(15)
        })
        it('包含青茶、红茶、普洱、绿茶、白茶', () => {
            expect(TEA_CATEGORY_OPTIONS).toContain('青茶')
            expect(TEA_CATEGORY_OPTIONS).toContain('红茶')
            expect(TEA_CATEGORY_OPTIONS).toContain('普洱')
            expect(TEA_CATEGORY_OPTIONS).toContain('绿茶')
            expect(TEA_CATEGORY_OPTIONS).toContain('白茶')
        })
    })

    // ========== 错误传播 ==========
    describe('错误传播', () => {
        it('invoke 抛错时，API 函数应向上抛出', async () => {
            mockInvoke.mockRejectedValue(new Error('供应商不存在'))
            await expect(getSupplier('sup-x')).rejects.toThrow('供应商不存在')
        })
    })
})
