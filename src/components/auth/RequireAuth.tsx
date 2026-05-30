/** @file 认证守卫 - 保护需要登录的路由，检查菜单权限 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { routePermissionMap } from '../../services/permissionMap'

interface RequireAuthProps {
  children: React.ReactNode
}

function hasRoutePermission(pathname: string, permissions: string[], isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true
  for (const [prefix, permKey] of Object.entries(routePermissionMap)) {
    if (pathname.startsWith(prefix)) {
      return permissions.includes(permKey)
    }
  }
  return true
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

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
        </div>
      </div>
    )
  }

  return <>{children}</>
}
