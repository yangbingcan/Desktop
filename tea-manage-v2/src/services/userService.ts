/** @file 用户服务 - 用户CRUD、状态管理、密码重置 */
import { invokeCommand } from './api'
import { useAuthStore } from '../stores/authStore'

export interface RoleBrief {
  id: string
  name: string
}

export interface UserItem {
  id: string
  username: string
  real_name: string
  phone: string
  email: string | null
  avatar: string
  status: number
  roles: RoleBrief[]
  last_login_at: string | null
  created_at: string
}

export interface GetUsersResult {
  items: UserItem[]
  total: number
}

function getToken(): string {
  return useAuthStore.getState().token || ''
}

export async function getUsers(params: {
  page?: number
  page_size?: number
  keyword?: string
  status?: number
}): Promise<GetUsersResult> {
  return invokeCommand<GetUsersResult>('get_users', { token: getToken(), params })
}

export async function createUser(data: {
  username: string
  real_name: string
  phone?: string
  email?: string
  password: string
  role_ids?: string[]
}): Promise<{ user: UserItem; generated_password: string | null }> {
  return invokeCommand('create_user', { token: getToken(), params: data })
}

export async function updateUser(data: {
  id: string
  real_name?: string
  phone?: string
  email?: string
  role_ids?: string[]
}): Promise<UserItem> {
  return invokeCommand('update_user', { token: getToken(), params: data })
}

export async function deleteUser(id: string): Promise<void> {
  return invokeCommand('delete_user', { token: getToken(), id })
}

export async function toggleUserStatus(id: string, status: number): Promise<void> {
  return invokeCommand('toggle_user_status', { token: getToken(), params: { id, status } })
}

export async function resetUserPassword(id: string, new_password: string): Promise<void> {
  return invokeCommand('reset_user_password', { token: getToken(), params: { id, new_password } })
}

export async function generateRandomPassword(): Promise<string> {
  return invokeCommand<string>('generate_random_password')
}
