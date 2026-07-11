/**
 * @file 会员相关 API 调用
 * @description Tauri Commands 封装 - 会员档案、口味偏好、消费记录、储值余额
 */
import { invoke } from '@tauri-apps/api/core'
import type {
    Member, MemberPreference, MemberPreferenceInput,
    MemberDetail, MemberConsumption, MemberConsumptionItem,
    PageResult, MemberLevel,
    RechargeInput, RechargeResult,
    RefundInput, RefundResult,
    BalanceLog
} from '@/types'

/**
 * 获取会员列表
 *
 * 🔧 v0.3.2 关键修复：Tauri 2.x 命令参数默认 snake_case → camelCase 转换
 */
export async function getMembers(
    page?: number,
    pageSize?: number,
    keyword?: string
): Promise<PageResult<Member>> {
    return await invoke('get_members', {
        page: page || 1,
        pageSize: pageSize || 20,
        keyword: keyword || null
    })
}

/**
 * 按手机号获取会员
 */
export async function getMemberByPhone(phone: string): Promise<Member | null> {
    return await invoke('get_member_by_phone', { phone })
}

/**
 * 创建会员
 */
export async function createMember(
    name: string,
    phone: string,
    gender?: string,
    birthday?: string
): Promise<Member> {
    return await invoke('create_member', { name, phone, gender, birthday })
}

/**
 * 更新会员信息
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ memberId }` 而非 `{ member_id }`
 */
export async function updateMember(
    memberId: string,
    name: string,
    phone: string,
    gender?: string,
    birthday?: string
): Promise<Member> {
    return await invoke('update_member', { memberId, name, phone, gender, birthday })
}

/**
 * 获取会员详情（包含偏好）
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ memberId }` 而非 `{ member_id }`
 */
export async function getMemberDetail(memberId: string): Promise<MemberDetail> {
    return await invoke('get_member_detail', { memberId })
}

/**
 * 更新会员口味偏好
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ memberId, input }` 而非 `{ member_id, input }`
 */
export async function updateMemberPreference(
    memberId: string,
    input: MemberPreferenceInput
): Promise<MemberPreference> {
    return await invoke('update_member_preference', { memberId, input })
}

/**
 * 获取会员消费记录
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ memberId }` 而非 `{ member_id }`
 */
export async function getMemberConsumption(memberId: string): Promise<MemberConsumption> {
    return await invoke('get_member_consumption', { memberId })
}

// ========== 工具函数（统一入口，避免重复定义） ==========

/**
 * 获取会员等级折扣率
 */
export function getMemberDiscountRate(level: MemberLevel): number {
    switch (level) {
        case 'gold': return 0.9
        case 'silver': return 0.95
        default: return 1.0
    }
}

/**
 * 获取会员等级名称
 */
export function getMemberLevelName(level: MemberLevel): string {
    switch (level) {
        case 'gold': return '金卡'
        case 'silver': return '银卡'
        default: return '普通'
    }
}

// ========== 常量选项 ==========

/** 会员等级选项 */
export const MEMBER_LEVEL_OPTIONS = [
    { label: '普通', value: 'normal' },
    { label: '银卡', value: 'silver' },
    { label: '金卡', value: 'gold' }
] as const

/** 性别选项 */
export const GENDER_OPTIONS = [
    { label: '男', value: 'male' },
    { label: '女', value: 'female' }
] as const

/** 茶类偏好选项 */
export const TEA_TYPE_OPTIONS = [
    '青茶', '红茶', '普洱', '绿茶', '白茶', '黄茶', '黑茶', '岩茶', '单丛', '铁观音', '大红袍', '正山小种', '祁门红茶', '金骏眉', '白毫银针', '白牡丹', '寿眉'
] as const

/** 口感偏好选项 */
export const TASTE_OPTIONS = [
    '浓醇厚重', '清香甘甜', '苦后回甘', '顺滑柔和', '花果香', '蜜香', '木质香', '岩韵', '毫香', '陈香'
] as const

/** 消费场景选项 */
export const SCENARIO_OPTIONS = [
    '自饮', '送礼', '办公接待', '茶空间', '收藏'
] as const

// ========== 储值余额（v0.3.1 M06） ==========

/** 储值支付方式选项 */
export const BALANCE_PAYMENT_OPTIONS = [
    { label: '现金', value: 'cash' },
    { label: '微信转账', value: 'wechat' },
    { label: '支付宝转账', value: 'alipay' }
] as const

/** 流水类型筛选选项 */
export const BALANCE_LOG_FILTER_OPTIONS = [
    { label: '充值', value: 'recharge' },
    { label: '消费', value: 'consume' },
    { label: '退款', value: 'refund' }
] as const

/**
 * 会员充值
 * @param input 充值输入（金额、支付方式、操作人、备注）
 * @returns 充值结果（新余额、流水 ID）
 */
export async function rechargeMemberBalance(input: RechargeInput): Promise<RechargeResult> {
    return await invoke('recharge_member_balance', { input })
}

/**
 * 会员退款
 * @param input 退款输入（金额、退款方式、操作人、退款原因）
 * @returns 退款结果（剩余余额、流水 ID）
 */
export async function refundMemberBalance(input: RefundInput): Promise<RefundResult> {
    return await invoke('refund_member_balance', { input })
}

/**
 * 获取会员储值流水（分页 + 类型筛选）
 * @param memberId 会员 ID
 * @param page 页码（默认 1）
 * @param pageSize 每页条数（默认 20）
 * @param changeType 流水类型筛选（recharge/consume/refund）
 *
 * 🔧 v0.3.2 关键修复：Tauri 2.x 命令参数默认 snake_case → camelCase 转换
 *   必须传 `{ memberId, page, pageSize, changeType }`
 */
export async function getMemberBalanceLogs(
    memberId: string,
    page?: number,
    pageSize?: number,
    changeType?: string
): Promise<PageResult<BalanceLog>> {
    return await invoke('get_member_balance_logs', {
        memberId,
        page: page || 1,
        pageSize: pageSize || 20,
        changeType: changeType || null
    })
}

/**
 * 获取会员最近一次充值的支付方式（用于退款弹窗默认值）
 * @param memberId 会员 ID
 * @returns 最近充值支付方式，找不到返回 null
 *
 * 🔧 v0.3.2 关键修复：必须传 `{ memberId }` 而非 `{ member_id }`
 */
export async function getMemberLastPaymentMethod(memberId: string): Promise<string | null> {
    return await invoke('get_member_last_payment_method', { memberId })
}

// 重新导出类型，方便外部使用
export type {
    Member, MemberPreference, MemberPreferenceInput, MemberDetail, MemberConsumption, MemberConsumptionItem,
    RechargeInput, RechargeResult, RefundInput, RefundResult, BalanceLog
}
