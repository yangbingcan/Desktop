/** @file 会员管理 API 服务 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../stores/authStore'

const getToken = () => useAuthStore.getState().token || ''

export interface Member {
  id: string; name: string; phone: string; gender: string | null
  birthday: string | null; level: string; points: number; balance: number
  total_consume: number; consume_count: number; last_visit: string | null
  is_active: boolean; created_at: string
}

export interface MemberPreference {
  member_id: string; preferred_teas: string; taste_preferences: string
  taboos: string; brew_habits: string; consumption_scenario: string; remark: string
}

export interface MemberInput {
  name: string; phone: string; gender?: string; birthday?: string; level?: string
}

export interface RechargeInput {
  member_id: string; amount: number; payment_method: string
  operator: string; remark?: string; bonus_amount?: number
}

export async function getMembers(params: { page?: number; pageSize?: number; keyword?: string }) {
  return invoke<any>('get_members', { token: getToken(), ...params })
}

export async function getMemberDetail(id: string) {
  return invoke<any>('get_member_detail', { token: getToken(), id })
}

export async function createMember(input: MemberInput) {
  return invoke<string>('create_member', { token: getToken(), input })
}

export async function updateMember(id: string, input: MemberInput) {
  return invoke<void>('update_member', { token: getToken(), id, input })
}

export async function updateMemberPreference(memberId: string, input: Omit<MemberPreference, 'member_id'>) {
  return invoke<void>('update_member_preference', { token: getToken(), memberId, input })
}

export async function getMemberByPhone(phone: string) {
  return invoke<any>('get_member_by_phone', { token: getToken(), phone })
}

export async function getMemberConsumption(memberId: string) {
  return invoke<any>('get_member_consumption', { token: getToken(), memberId })
}

export async function rechargeMemberBalance(input: RechargeInput) {
  return invoke<any>('recharge_member_balance', { token: getToken(), input })
}

export async function refundMemberBalance(input: RechargeInput) {
  return invoke<any>('refund_member_balance', { token: getToken(), input })
}

export async function getMemberBalanceLogs(memberId: string, page?: number, pageSize?: number) {
  return invoke<any>('get_member_balance_logs', { token: getToken(), memberId, page, pageSize })
}

