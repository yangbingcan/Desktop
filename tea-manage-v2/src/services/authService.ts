/** @file 认证服务 - 登录、用户信息 */
import { invokeCommand } from './api'
import { useAuthStore } from '../stores/authStore'
import type { RoleBrief } from './userService'

interface LoginResponse {
  token: string
  user: {
    id: string
    username: string
    real_name: string
    phone: string
    email: string | null
    avatar: string
    status: number
    permissions: string[]
    roles: RoleBrief[]
    is_super_admin: boolean
  }
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return invokeCommand<LoginResponse>('login', { username, password })
}

export async function getCurrentUser() {
  const token = useAuthStore.getState().token
  return invokeCommand('get_current_user', { token })
}
