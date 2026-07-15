/** @file 认证守卫 - 保护需要登录的路由，检查菜单权限 */
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { useAuthStore } from '../../stores/authStore'
import { routePermissionMap } from '../../services/permissionMap'

interface RequireAuthProps {
  children: React.ReactNode
}

/**
 * 路由权限检查（白名单模式：未映射的路由默认拒绝）
 * - 超级管理员：允许所有路由
 * - /dashboard：所有已登录用户可访问
 * - 其他路由：必须在 routePermissionMap 中有映射，且用户拥有对应权限
 * - 未映射的路由：默认拒绝（返回 false），防止越权访问
 */
function hasRoutePermission(pathname: string, permissions: string[], isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true
  if (pathname === '/dashboard') return true

  let matched = false
  for (const [prefix, permModule] of Object.entries(routePermissionMap)) {
    if (pathname.startsWith(prefix)) {
      matched = true
      if (permissions.some(p => p === permModule || p.startsWith(permModule + ':'))) {
        return true
      }
    }
  }

  // 白名单模式：未映射的路由默认拒绝
  if (!matched) {
    return false
  }

  return false
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user && !hasRoutePermission(location.pathname, user.permissions, user.is_super_admin)) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--gl-text-secondary)' }}>
        <div className="text-center">
          <div className="text-6xl font-bold mb-4" style={{ color: 'var(--gl-text-tertiary)' }}>403</div>
          <div className="text-lg">无权限访问此页面</div>
          <div className="text-sm mt-2" style={{ color: 'var(--gl-text-tertiary)' }}>请联系管理员分配相应权限</div>
          <Button type="primary" className="mt-4" onClick={() => navigate('/dashboard')}>
            返回仪表盘
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
