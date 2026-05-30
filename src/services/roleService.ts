/** @file 角色服务 - 角色CRUD、权限管理 */
import { invokeCommand } from './api'
import { useAuthStore } from '../stores/authStore'

export interface RoleItem {
  id: string
  name: string
  description: string
  is_system: boolean
  permissions: string[]
  user_count: number
  created_at: string
}

export interface PermissionItem {
  key: string
  label: string
  group: string
}

function getToken(): string {
  return useAuthStore.getState().token || ''
}

export async function getRoles(keyword?: string): Promise<RoleItem[]> {
  return invokeCommand<RoleItem[]>('get_roles', { token: getToken(), keyword: keyword || null })
}

export async function createRole(data: {
  name: string
  description?: string
  permission_keys?: string[]
}): Promise<RoleItem> {
  return invokeCommand('create_role', { token: getToken(), params: data })
}

export async function updateRole(data: {
  id: string
  name?: string
  description?: string
  permission_keys?: string[]
}): Promise<RoleItem> {
  return invokeCommand('update_role', { token: getToken(), params: data })
}

export async function deleteRole(id: string): Promise<void> {
  return invokeCommand('delete_role', { token: getToken(), id })
}

export async function getPermissions(): Promise<PermissionItem[]> {
  return invokeCommand<PermissionItem[]>('get_permissions')
}
