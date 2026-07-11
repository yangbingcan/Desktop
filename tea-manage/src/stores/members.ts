/**
 * @file 会员状态管理
 * @description 管理会员档案、口味偏好、消费记录等状态，调用 api/members 层
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Member, MemberPreference, MemberConsumption, MemberDetail, MemberPreferenceInput } from '@/types'
import { getMembers, getMemberByPhone, getMemberDetail, getMemberConsumption, createMember, updateMember, updateMemberPreference } from '@/api/members'

export const useMemberStore = defineStore('members', () => {
    // ========== 状态 ==========
    const members = ref<Member[]>([])
    const currentMember = ref<Member | null>(null)
    const memberPreferences = ref<Map<string, MemberPreference>>(new Map())
    const loading = ref(false)

    // ========== 计算属性 ==========
    const memberMap = computed(() => {
        return new Map(members.value.map(m => [m.id, m]))
    })

    // ========== Actions ==========

    /**
     * 加载会员列表（分页）
     */
    async function loadMembers(page?: number, pageSize?: number, keyword?: string) {
        loading.value = true
        try {
            const result = await getMembers(page, pageSize, keyword)
            members.value = result.list
            return result
        } finally {
            loading.value = false
        }
    }

    /**
     * 按手机号搜索会员
     */
    async function searchMember(phone: string): Promise<Member | null> {
        return await getMemberByPhone(phone)
    }

    /**
     * 获取会员详情（包含偏好）
     */
    async function getMemberDetailById(memberId: string): Promise<MemberDetail> {
        return await getMemberDetail(memberId)
    }

    /**
     * 获取会员偏好
     */
    async function getMemberPreferences(memberId: string): Promise<MemberDetail> {
        const detail = await getMemberDetail(memberId)
        if (detail.preference) {
            memberPreferences.value.set(memberId, detail.preference)
        }
        return detail
    }

    /**
     * 新增会员
     */
    async function addMember(name: string, phone: string, gender?: string, birthday?: string): Promise<Member> {
        const created = await createMember(name, phone, gender, birthday)
        members.value.push(created)
        return created
    }

    /**
     * 更新会员
     */
    async function updateMemberById(memberId: string, name: string, phone: string, gender?: string, birthday?: string): Promise<Member> {
        const updated = await updateMember(memberId, name, phone, gender, birthday)
        const index = members.value.findIndex(m => m.id === memberId)
        if (index !== -1) {
            members.value[index] = updated
        }
        return updated
    }

    /**
     * 更新会员偏好
     */
    async function updateMemberPreferences(memberId: string, input: MemberPreferenceInput): Promise<MemberPreference> {
        return await updateMemberPreference(memberId, input)
    }

    /**
     * 获取会员消费记录
     */
    async function getMemberConsumptions(memberId: string): Promise<MemberConsumption> {
        return await getMemberConsumption(memberId)
    }

    return {
        members,
        currentMember,
        memberPreferences,
        loading,
        memberMap,
        loadMembers,
        searchMember,
        getMemberDetailById,
        getMemberPreferences,
        addMember,
        updateMemberById,
        updateMemberPreferences,
        getMemberConsumptions
    }
})
