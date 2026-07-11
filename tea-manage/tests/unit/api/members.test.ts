/**
 * @file 会员 API 单元测试
 * @description 测试 src/api/members.ts 中的所有函数
 *              重点验证 camelCase 参数命名（memberId、pageSize、changeType 等）
 *              以及工具函数 getMemberDiscountRate / getMemberLevelName
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockInvoke, resetInvokeMock } from './_helpers'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke
}))

import {
    getMembers,
    getMemberByPhone,
    createMember,
    updateMember,
    getMemberDetail,
    updateMemberPreference,
    getMemberConsumption,
    rechargeMemberBalance,
    refundMemberBalance,
    getMemberBalanceLogs,
    getMemberLastPaymentMethod,
    getMemberDiscountRate,
    getMemberLevelName,
    MEMBER_LEVEL_OPTIONS,
    GENDER_OPTIONS,
    BALANCE_PAYMENT_OPTIONS,
    BALANCE_LOG_FILTER_OPTIONS
} from '@/api/members'
import type {
    Member, MemberDetail, MemberPreference, MemberPreferenceInput,
    MemberConsumption, MemberLevel,
    RechargeInput, RechargeResult, RefundInput, RefundResult,
    BalanceLog, PageResult, PaymentMethod
} from '@/types'

// 测试数据
const mockMember: Member = {
    id: 'm-1',
    name: '张三',
    phone: '13800138000',
    gender: 'male',
    birthday: '1990-01-01',
    level: 'gold',
    points: 1000,
    balance: 500,
    totalConsume: 5000,
    consumeCount: 10,
    lastVisit: '2026-07-01',
    createdAt: '2026-01-01'
}

const mockPreference: MemberPreference = {
    memberId: 'm-1',
    preferredTeas: ['绿茶'],
    tastePreferences: ['清香甘甜'],
    taboos: '',
    brewHabits: '',
    consumptionScenario: ['自饮'],
    remark: ''
}

const mockMemberDetail: MemberDetail = {
    member: mockMember,
    preference: mockPreference
}

const mockConsumption: MemberConsumption = {
    memberId: 'm-1',
    totalConsume: 5000,
    consumeCount: 10,
    records: []
}

const mockBalanceLog: BalanceLog = {
    id: 'log-1',
    memberId: 'm-1',
    changeType: 'recharge',
    changeAmount: 100,
    balanceAfter: 600,
    paymentMethod: 'cash',
    operator: '张三',
    relatedOrderId: null,
    bonusAmount: 0,
    feeAmount: 0,
    remark: '充值',
    createdAt: '2026-07-01'
}

describe('api/members 会员 API', () => {
    beforeEach(() => {
        resetInvokeMock()
    })

    // ========== getMembers ==========
    describe('getMembers 获取会员列表', () => {
        it('使用默认参数调用 get_members', async () => {
            const mockResult: PageResult<Member> = {
                list: [mockMember],
                total: 1,
                page: 1,
                pageSize: 20
            }
            mockInvoke.mockResolvedValue(mockResult)
            const result = await getMembers()
            expect(mockInvoke).toHaveBeenCalledWith('get_members', {
                page: 1,
                pageSize: 20,
                keyword: null
            })
            expect(result).toEqual(mockResult)
        })
        it('传入自定义参数', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 50 })
            await getMembers(2, 50, '张三')
            expect(mockInvoke).toHaveBeenCalledWith('get_members', {
                page: 2,
                pageSize: 50,
                keyword: '张三'
            })
        })
        it('keyword 为空时传 null', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
            await getMembers(1, 20, '')
            expect(mockInvoke).toHaveBeenCalledWith('get_members', {
                page: 1,
                pageSize: 20,
                keyword: null
            })
        })
    })

    // ========== getMemberByPhone ==========
    describe('getMemberByPhone 按手机号获取会员', () => {
        it('调用 get_member_by_phone，传入 { phone }', async () => {
            mockInvoke.mockResolvedValue(mockMember)
            const result = await getMemberByPhone('13800138000')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_by_phone', { phone: '13800138000' })
            expect(result).toEqual(mockMember)
        })
        it('会员不存在时返回 null', async () => {
            mockInvoke.mockResolvedValue(null)
            const result = await getMemberByPhone('13900000000')
            expect(result).toBeNull()
        })
    })

    // ========== createMember ==========
    describe('createMember 创建会员', () => {
        it('调用 create_member，传入 name/phone/gender/birthday', async () => {
            mockInvoke.mockResolvedValue(mockMember)
            const result = await createMember('张三', '13800138000', 'male', '1990-01-01')
            expect(mockInvoke).toHaveBeenCalledWith('create_member', {
                name: '张三',
                phone: '13800138000',
                gender: 'male',
                birthday: '1990-01-01'
            })
            expect(result).toEqual(mockMember)
        })
        it('gender 和 birthday 为 undefined 时仍正确传递', async () => {
            mockInvoke.mockResolvedValue(mockMember)
            await createMember('李四', '13800138001')
            expect(mockInvoke).toHaveBeenCalledWith('create_member', {
                name: '李四',
                phone: '13800138001',
                gender: undefined,
                birthday: undefined
            })
        })
    })

    // ========== updateMember ==========
    describe('updateMember 更新会员', () => {
        it('调用 update_member，传入 { memberId, ... }（注意：memberId 是 camelCase）', async () => {
            mockInvoke.mockResolvedValue(mockMember)
            await updateMember('m-1', '张三', '13800138000', 'male', '1990-01-01')
            expect(mockInvoke).toHaveBeenCalledWith('update_member', {
                memberId: 'm-1',
                name: '张三',
                phone: '13800138000',
                gender: 'male',
                birthday: '1990-01-01'
            })
        })
    })

    // ========== getMemberDetail ==========
    describe('getMemberDetail 获取会员详情', () => {
        it('调用 get_member_detail，传入 { memberId }（camelCase）', async () => {
            mockInvoke.mockResolvedValue(mockMemberDetail)
            const result = await getMemberDetail('m-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_detail', { memberId: 'm-1' })
            expect(result).toEqual(mockMemberDetail)
        })
    })

    // ========== updateMemberPreference ==========
    describe('updateMemberPreference 更新会员偏好', () => {
        it('调用 update_member_preference，传入 { memberId, input }', async () => {
            const input: MemberPreferenceInput = {
                preferredTeas: ['红茶'],
                tastePreferences: ['浓醇厚重'],
                taboos: '无',
                brewHabits: '功夫泡',
                consumptionScenario: ['办公接待'],
                remark: '更新偏好'
            }
            mockInvoke.mockResolvedValue({ ...mockPreference, ...input })
            const result = await updateMemberPreference('m-1', input)
            expect(mockInvoke).toHaveBeenCalledWith('update_member_preference', {
                memberId: 'm-1',
                input
            })
            expect(result.preferredTeas).toEqual(['红茶'])
        })
    })

    // ========== getMemberConsumption ==========
    describe('getMemberConsumption 获取会员消费记录', () => {
        it('调用 get_member_consumption，传入 { memberId }', async () => {
            mockInvoke.mockResolvedValue(mockConsumption)
            const result = await getMemberConsumption('m-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_consumption', { memberId: 'm-1' })
            expect(result).toEqual(mockConsumption)
        })
    })

    // ========== rechargeMemberBalance ==========
    describe('rechargeMemberBalance 会员充值', () => {
        it('调用 recharge_member_balance，传入 { input }', async () => {
            const input: RechargeInput = {
                memberId: 'm-1',
                amount: 100,
                paymentMethod: 'cash' as PaymentMethod,
                operator: '管理员',
                remark: '充值100元'
            }
            const mockResult: RechargeResult = {
                logId: 'log-1',
                newBalance: 600,
                createdAt: '2026-07-01 10:00:00'
            }
            mockInvoke.mockResolvedValue(mockResult)
            const result = await rechargeMemberBalance(input)
            expect(mockInvoke).toHaveBeenCalledWith('recharge_member_balance', { input })
            expect(result).toEqual(mockResult)
        })
        it('带 bonusAmount 的充值', async () => {
            const input: RechargeInput = {
                memberId: 'm-1',
                amount: 100,
                paymentMethod: 'wechat',
                operator: '管理员',
                bonusAmount: 20
            }
            mockInvoke.mockResolvedValue({ logId: 'log-2', newBalance: 620, createdAt: '' })
            await rechargeMemberBalance(input)
            expect(mockInvoke).toHaveBeenCalledWith('recharge_member_balance', { input })
        })
    })

    // ========== refundMemberBalance ==========
    describe('refundMemberBalance 会员退款', () => {
        it('调用 refund_member_balance，传入 { input }', async () => {
            const input: RefundInput = {
                memberId: 'm-1',
                amount: 50,
                paymentMethod: 'cash',
                operator: '管理员',
                remark: '退款50元'
            }
            const mockResult: RefundResult = {
                logId: 'log-3',
                newBalance: 450,
                createdAt: '2026-07-01 11:00:00'
            }
            mockInvoke.mockResolvedValue(mockResult)
            const result = await refundMemberBalance(input)
            expect(mockInvoke).toHaveBeenCalledWith('refund_member_balance', { input })
            expect(result).toEqual(mockResult)
        })
    })

    // ========== getMemberBalanceLogs ==========
    describe('getMemberBalanceLogs 获取储值流水', () => {
        it('使用默认参数调用 get_member_balance_logs', async () => {
            mockInvoke.mockResolvedValue({ list: [mockBalanceLog], total: 1, page: 1, pageSize: 20 })
            await getMemberBalanceLogs('m-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_balance_logs', {
                memberId: 'm-1',
                page: 1,
                pageSize: 20,
                changeType: null
            })
        })
        it('传入 changeType 筛选参数', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
            await getMemberBalanceLogs('m-1', 2, 50, 'recharge')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_balance_logs', {
                memberId: 'm-1',
                page: 2,
                pageSize: 50,
                changeType: 'recharge'
            })
        })
        it('changeType 为空字符串时传 null', async () => {
            mockInvoke.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
            await getMemberBalanceLogs('m-1', 1, 20, '')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_balance_logs', {
                memberId: 'm-1',
                page: 1,
                pageSize: 20,
                changeType: null
            })
        })
    })

    // ========== getMemberLastPaymentMethod ==========
    describe('getMemberLastPaymentMethod 获取最近充值支付方式', () => {
        it('调用 get_member_last_payment_method，传入 { memberId }', async () => {
            mockInvoke.mockResolvedValue('wechat')
            const result = await getMemberLastPaymentMethod('m-1')
            expect(mockInvoke).toHaveBeenCalledWith('get_member_last_payment_method', { memberId: 'm-1' })
            expect(result).toBe('wechat')
        })
        it('无充值记录时返回 null', async () => {
            mockInvoke.mockResolvedValue(null)
            const result = await getMemberLastPaymentMethod('m-1')
            expect(result).toBeNull()
        })
    })

    // ========== 工具函数 ==========
    describe('getMemberDiscountRate 获取折扣率', () => {
        it('普通会员折扣率 1.0', () => {
            expect(getMemberDiscountRate('normal')).toBe(1.0)
        })
        it('银卡会员折扣率 0.95', () => {
            expect(getMemberDiscountRate('silver')).toBe(0.95)
        })
        it('金卡会员折扣率 0.9', () => {
            expect(getMemberDiscountRate('gold')).toBe(0.9)
        })
        it('未知等级默认 1.0', () => {
            expect(getMemberDiscountRate('unknown' as MemberLevel)).toBe(1.0)
        })
    })

    describe('getMemberLevelName 获取等级名称', () => {
        it('普通 → 普通', () => {
            expect(getMemberLevelName('normal')).toBe('普通')
        })
        it('银卡 → 银卡', () => {
            expect(getMemberLevelName('silver')).toBe('银卡')
        })
        it('金卡 → 金卡', () => {
            expect(getMemberLevelName('gold')).toBe('金卡')
        })
        it('未知等级默认 → 普通', () => {
            expect(getMemberLevelName('unknown' as MemberLevel)).toBe('普通')
        })
    })

    // ========== 常量选项 ==========
    describe('常量选项', () => {
        it('MEMBER_LEVEL_OPTIONS 包含 3 个等级', () => {
            expect(MEMBER_LEVEL_OPTIONS).toHaveLength(3)
            expect(MEMBER_LEVEL_OPTIONS.map(o => o.value)).toEqual(['normal', 'silver', 'gold'])
        })
        it('GENDER_OPTIONS 包含 2 个性别', () => {
            expect(GENDER_OPTIONS).toHaveLength(2)
            expect(GENDER_OPTIONS.map(o => o.value)).toEqual(['male', 'female'])
        })
        it('BALANCE_PAYMENT_OPTIONS 包含 3 种支付方式', () => {
            expect(BALANCE_PAYMENT_OPTIONS).toHaveLength(3)
            expect(BALANCE_PAYMENT_OPTIONS.map(o => o.value)).toEqual(['cash', 'wechat', 'alipay'])
        })
        it('BALANCE_LOG_FILTER_OPTIONS 包含 3 种流水类型', () => {
            expect(BALANCE_LOG_FILTER_OPTIONS).toHaveLength(3)
            expect(BALANCE_LOG_FILTER_OPTIONS.map(o => o.value)).toEqual(['recharge', 'consume', 'refund'])
        })
    })
})
