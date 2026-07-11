/**
 * @file 供应商相关 API 调用
 * @description Tauri Commands 封装 - 供应商档案 CRUD + 付款 + 财务流水
 */
import { invoke } from '@tauri-apps/api/core'
import type {
    Supplier, SupplierInput, PageResult,
    SupplierPayment, CreatePaymentInput,
    FinancialFlowItem, SupplierBalance
} from '@/types'

/**
 * 获取供应商列表（分页 + 关键词搜索）
 *
 * 🔧 v0.3.2 关键修复：Tauri 2.x 命令参数默认 snake_case → camelCase 转换
 */
export async function getSuppliers(
    page?: number,
    pageSize?: number,
    keyword?: string
): Promise<PageResult<Supplier>> {
    return await invoke('get_suppliers', {
        page: page || 1,
        pageSize: pageSize || 20,
        keyword: keyword || null
    })
}

/**
 * 获取所有启用的供应商（下拉选择用）
 */
export async function getAllActiveSuppliers(): Promise<Supplier[]> {
    return await invoke('get_all_active_suppliers')
}

/**
 * 获取供应商详情
 */
export async function getSupplier(id: string): Promise<Supplier> {
    return await invoke('get_supplier', { id })
}

/**
 * 新增供应商
 */
export async function createSupplier(input: SupplierInput): Promise<Supplier> {
    return await invoke('create_supplier', { input })
}

/**
 * 更新供应商
 */
export async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
    return await invoke('update_supplier', { id, input })
}

/**
 * 删除供应商（软删除）
 */
export async function deleteSupplier(id: string): Promise<void> {
    return await invoke('delete_supplier', { id })
}

// ========== 工具函数 ==========

/**
 * 校验供应商名称
 */
export function validateSupplierName(name: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return '供应商名称不能为空'
    if (trimmed.length > 50) return '供应商名称不能超过 50 个字符'
    return null
}

/**
 * 校验联系电话
 */
export function validatePhone(phone: string | undefined): string | null {
    if (!phone || !phone.trim()) return null
    const trimmed = phone.trim()
    if (trimmed.length < 7 || trimmed.length > 20) {
        return '联系电话长度应在 7-20 位之间'
    }
    const validChars = /^[0-9\-\s\+]+$/
    if (!validChars.test(trimmed)) {
        return '电话号码只能包含数字、-、空格、+'
    }
    return null
}

/** 茶叶常用品类选项（主营品类下拉用） */
export const TEA_CATEGORY_OPTIONS = [
    '青茶', '红茶', '普洱', '绿茶', '白茶', '黄茶', '黑茶', '岩茶', '单丛',
    '铁观音', '大红袍', '正山小种', '祁门红茶', '金骏眉', '白毫银针', '白牡丹', '寿眉'
] as const

// ========== 付款管理 ==========

/**
 * 创建供应商付款
 */
export async function createPayment(input: CreatePaymentInput): Promise<SupplierPayment> {
    return await invoke('create_supplier_payment', { input })
}

/**
 * 获取供应商付款记录
 */
export async function getSupplierPayments(
    supplierId: string,
    page?: number,
    pageSize?: number
): Promise<PageResult<SupplierPayment>> {
    return await invoke('get_supplier_payments', {
        supplierId,
        page: page || 1,
        pageSize: pageSize || 20
    })
}

/**
 * 获取供应商财务流水
 */
export async function getSupplierFinancialFlow(
    supplierId: string,
    page?: number,
    pageSize?: number
): Promise<PageResult<FinancialFlowItem>> {
    return await invoke('get_supplier_financial_flow', {
        supplierId,
        page: page || 1,
        pageSize: pageSize || 20
    })
}

/**
 * 获取供应商欠款余额
 */
export async function getSupplierBalance(supplierId: string): Promise<SupplierBalance> {
    return await invoke('get_supplier_balance', { supplierId })
}

/** 付款方式选项 */
export const PAYMENT_METHOD_OPTIONS = [
    { label: '现金', value: 'cash' },
    { label: '微信', value: 'wechat' },
    { label: '支付宝', value: 'alipay' },
    { label: '对公转账', value: 'transfer' },
    { label: '其他', value: 'other' }
] as const
