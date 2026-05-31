/** @file 权限控制Hook - 按钮级权限判断 */
import { useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'

export function usePermission() {
  const user = useAuthStore((s) => s.user)
  const permissions = user?.permissions ?? []
  const isSuperAdmin = user?.is_super_admin ?? false

  const permissionSet = useMemo(() => new Set(permissions), [permissions])

  const hasPermission = (key: string): boolean => {
    if (isSuperAdmin) return true
    return permissionSet.has(key)
  }

  const hasModulePermission = (module: string): boolean => {
    if (isSuperAdmin) return true
    return permissions.some(p => p === module || p.startsWith(module + ':'))
  }

  const hasAction = (module: string, action: string): boolean => {
    if (isSuperAdmin) return true
    return permissionSet.has(`${module}:${action}`)
  }

  return { hasPermission, hasModulePermission, hasAction, permissions, isSuperAdmin }
}
