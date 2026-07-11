/**
 * @file 会员 Store 单元测试
 * @description 测试 src/stores/members.ts 中的 useMemberStore
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestPinia } from './_helpers'

// mock api/members 模块（用 vi.hoisted 提升至 vi.mock 工厂可访问的作用域）
const apiMocks = vi.hoisted(() => ({
    getMembers: vi.fn(),
    getMemberByPhone: vi.fn(),
    getMemberDetail: vi.fn(),
    getMemberConsumption: vi.fn(),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    updateMemberPreference: vi.fn()
}))
vi.mock('@/api/members', () => apiMocks)

import { useMemberStore } from '@/stores/members'
import type { Member, MemberDetail, MemberPreferenceInput, MemberConsumption } from '@/types'

const mockMember1: Member = {
    id: 'm-1', name: '张三', phone: '13800138000', gender: 'male',
    birthday: null, level: 'gold', points: 1000, balance: 500,
    totalConsume: 5000, consumeCount: 10, lastVisit: null, createdAt: '2026-01-01'
}
const mockMember2: Member = {
    id: 'm-2', name: '李四', phone: '13900139000', gender: 'female',
    birthday: null, level: 'normal', points: 0, balance: 0,
    totalConsume: 0, consumeCount: 0, lastVisit: null, createdAt: '2026-01-02'
}

const mockDetail: MemberDetail = {
    member: mockMember1,
    preference: {
        memberId: 'm-1', preferredTeas: ['绿茶'], tastePreferences: ['清香甘甜'],
        taboos: '', brewHabits: '', consumptionScenario: ['自饮'], remark: ''
    }
}

const mockConsumption: MemberConsumption = {
    memberId: 'm-1', totalConsume: 5000, consumeCount: 10, records: []
}

describe('useMemberStore 会员 Store', () => {
    beforeEach(() => {
        createTestPinia()
        vi.clearAllMocks()
    })

    describe('初始状态', () => {
        it('members 初始为空数组', () => {
            const store = useMemberStore()
            expect(store.members).toEqual([])
        })
        it('currentMember 初始为 null', () => {
            const store = useMemberStore()
            expect(store.currentMember).toBeNull()
        })
        it('memberPreferences 初始为空 Map', () => {
            const store = useMemberStore()
            expect(store.memberPreferences.size).toBe(0)
        })
        it('loading 初始为 false', () => {
            const store = useMemberStore()
            expect(store.loading).toBe(false)
        })
    })

    describe('计算属性', () => {
        it('memberMap 返回 id -> Member 的映射', () => {
            const store = useMemberStore()
            store.members = [mockMember1, mockMember2]
            const map = store.memberMap
            expect(map.size).toBe(2)
            expect(map.get('m-1')).toEqual(mockMember1)
            expect(map.get('m-2')).toEqual(mockMember2)
        })
    })

    describe('loadMembers 加载会员列表', () => {
        it('成功后写入 members 数组', async () => {
            apiMocks.getMembers.mockResolvedValue({
                list: [mockMember1, mockMember2], total: 2, page: 1, pageSize: 20
            })
            const store = useMemberStore()
            const result = await store.loadMembers()
            expect(store.members).toEqual([mockMember1, mockMember2])
            expect(result.list).toHaveLength(2)
        })
        it('加载过程中 loading 为 true', async () => {
            let resolveFn!: (v: any) => void
            apiMocks.getMembers.mockReturnValue(new Promise(r => { resolveFn = r }))
            const store = useMemberStore()
            const promise = store.loadMembers()
            expect(store.loading).toBe(true)
            resolveFn({ list: [], total: 0, page: 1, pageSize: 20 })
            await promise
            expect(store.loading).toBe(false)
        })
        it('api 抛错时 loading 仍重置为 false', async () => {
            apiMocks.getMembers.mockRejectedValue(new Error('加载失败'))
            const store = useMemberStore()
            await expect(store.loadMembers()).rejects.toThrow('加载失败')
            expect(store.loading).toBe(false)
        })
        it('传入参数正确传递给 api', async () => {
            apiMocks.getMembers.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 50 })
            const store = useMemberStore()
            await store.loadMembers(2, 50, '张三')
            expect(apiMocks.getMembers).toHaveBeenCalledWith(2, 50, '张三')
        })
    })

    describe('searchMember 按手机号搜索', () => {
        it('返回 api 调用结果', async () => {
            apiMocks.getMemberByPhone.mockResolvedValue(mockMember1)
            const store = useMemberStore()
            const result = await store.searchMember('13800138000')
            expect(result).toEqual(mockMember1)
            expect(apiMocks.getMemberByPhone).toHaveBeenCalledWith('13800138000')
        })
        it('会员不存在返回 null', async () => {
            apiMocks.getMemberByPhone.mockResolvedValue(null)
            const store = useMemberStore()
            const result = await store.searchMember('13900000000')
            expect(result).toBeNull()
        })
    })

    describe('getMemberDetailById 获取会员详情', () => {
        it('返回 api 调用结果', async () => {
            apiMocks.getMemberDetail.mockResolvedValue(mockDetail)
            const store = useMemberStore()
            const result = await store.getMemberDetailById('m-1')
            expect(result).toEqual(mockDetail)
            expect(apiMocks.getMemberDetail).toHaveBeenCalledWith('m-1')
        })
    })

    describe('getMemberPreferences 获取会员偏好', () => {
        it('成功后写入 memberPreferences Map', async () => {
            apiMocks.getMemberDetail.mockResolvedValue(mockDetail)
            const store = useMemberStore()
            const result = await store.getMemberPreferences('m-1')
            expect(result).toEqual(mockDetail)
            expect(store.memberPreferences.get('m-1')).toEqual(mockDetail.preference)
        })
        it('preference 为 null 时不写入 Map', async () => {
            apiMocks.getMemberDetail.mockResolvedValue({
                member: mockMember1, preference: null
            })
            const store = useMemberStore()
            await store.getMemberPreferences('m-1')
            expect(store.memberPreferences.has('m-1')).toBe(false)
        })
    })

    describe('addMember 新增会员', () => {
        it('成功后追加到 members 数组末尾', async () => {
            apiMocks.createMember.mockResolvedValue(mockMember1)
            const store = useMemberStore()
            store.members = [mockMember2]
            const result = await store.addMember('张三', '13800138000', 'male')
            expect(result).toEqual(mockMember1)
            expect(store.members).toHaveLength(2)
            expect(store.members[1]).toEqual(mockMember1)
        })
        it('参数正确传递给 api', async () => {
            apiMocks.createMember.mockResolvedValue(mockMember1)
            const store = useMemberStore()
            await store.addMember('张三', '13800138000', 'male', '1990-01-01')
            expect(apiMocks.createMember).toHaveBeenCalledWith(
                '张三', '13800138000', 'male', '1990-01-01'
            )
        })
        it('api 抛错时错误向上抛出，members 不变', async () => {
            apiMocks.createMember.mockRejectedValue(new Error('手机号已存在'))
            const store = useMemberStore()
            store.members = [mockMember2]
            await expect(store.addMember('张三', '13800138000'))
                .rejects.toThrow('手机号已存在')
            expect(store.members).toHaveLength(1)
        })
    })

    describe('updateMemberById 更新会员', () => {
        it('成功后更新 members 数组中对应 id', async () => {
            const updated = { ...mockMember1, name: '张三（改）' }
            apiMocks.updateMember.mockResolvedValue(updated)
            const store = useMemberStore()
            store.members = [mockMember1, mockMember2]
            const result = await store.updateMemberById('m-1', '张三（改）', '13800138000')
            expect(result).toEqual(updated)
            expect(store.members[0]).toEqual(updated)
            expect(store.members[1]).toEqual(mockMember2)
        })
        it('会员 id 不存在于列表中时，不修改数组', async () => {
            const updated = { ...mockMember1, id: 'm-x', name: '新会员' }
            apiMocks.updateMember.mockResolvedValue(updated)
            const store = useMemberStore()
            store.members = [mockMember1]
            await store.updateMemberById('m-x', '新会员', '13800138000')
            expect(store.members).toHaveLength(1)
        })
    })

    describe('updateMemberPreferences 更新会员偏好', () => {
        it('返回 api 调用结果', async () => {
            const input: MemberPreferenceInput = {
                preferredTeas: ['红茶'],
                tastePreferences: ['浓醇厚重'],
                taboos: '无', brewHabits: '功夫泡',
                consumptionScenario: ['自饮'], remark: '更新'
            }
            apiMocks.updateMemberPreference.mockResolvedValue({
                memberId: 'm-1', ...input
            })
            const store = useMemberStore()
            const result = await store.updateMemberPreferences('m-1', input)
            expect(result.memberId).toBe('m-1')
            expect(result.preferredTeas).toEqual(['红茶'])
            expect(apiMocks.updateMemberPreference).toHaveBeenCalledWith('m-1', input)
        })
    })

    describe('getMemberConsumptions 获取消费记录', () => {
        it('返回 api 调用结果', async () => {
            apiMocks.getMemberConsumption.mockResolvedValue(mockConsumption)
            const store = useMemberStore()
            const result = await store.getMemberConsumptions('m-1')
            expect(result).toEqual(mockConsumption)
            expect(apiMocks.getMemberConsumption).toHaveBeenCalledWith('m-1')
        })
    })
})
