/** @file 认证守卫 - 保护需要登录的路由，检查菜单权限，首次登录强制修改密码 */
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { hasPermissionForRoute } from '../../services/permissionMap'
import PasswordModal from '../layout/titlebar/PasswordModal'
import AppLayout from '../layout/AppLayout'

interface RequireAuthProps {
  children: React.ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const navigate = useNavigate()
  const [passwordModalOpen, setPasswordModalOpen] = useState(true)

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 首次登录强制修改密码（包裹在AppLayout中，避免孤立弹窗无布局）
  if (user?.must_change_password) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <PasswordModal
            open={passwordModalOpen}
            onClose={() => setPasswordModalOpen(false)}
            forceChange
          />
        </div>
      </AppLayout>
    )
  }

  if (user && !hasPermissionForRoute(location.pathname, user.permissions, user.is_super_admin)) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--gl-text-secondary)' }}>
        <div className="text-center">
          <div className="text-6xl font-bold mb-4" style={{ color: 'var(--gl-text-tertiary)' }}>403</div>
          <div className="text-lg">无权限访问此页面</div>
          <div className="text-sm mt-2" style={{ color: 'var(--gl-text-tertiary)' }}>请联系管理员分配相应权限</div>
          <Button type="primary" className="mt-4" onClick={() => navigate('/dashboard')}>
            返回工作台
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
