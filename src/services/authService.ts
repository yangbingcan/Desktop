/** @file 认证服务 - 登录、用户信息 */
import { invokeCommand, getToken } from './api'
import type { UserInfo } from '../stores/authStore'

interface LoginResponse {
  token: string
  user: UserInfo
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return invokeCommand<LoginResponse>('login', { username, password })
}

export async function getCurrentUser(): Promise<UserInfo> {
  return invokeCommand<UserInfo>('get_current_user', { token: getToken() })
}

/** 修改当前用户密码 */
export async function updatePassword(oldPassword: string, newPassword: string): Promise<void> {
  return invokeCommand('update_password', { token: getToken(), old_password: oldPassword, new_password: newPassword })
}
