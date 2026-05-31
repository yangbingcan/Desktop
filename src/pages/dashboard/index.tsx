/** @file 仪表盘 v4.0 - 基础仪表盘，待低代码重新规划后扩展 */
import { useNavigate } from 'react-router-dom'
import {
  SafetyOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/authStore'

const quickActions = [
  { label: '角色权限', icon: <SafetyOutlined />, color: '#2563EB', path: '/permission/roles' },
  { label: '用户管理', icon: <UserOutlined />, color: '#8B5CF6', path: '/user/list' },
  { label: '系统设置', icon: <SettingOutlined />, color: '#10B981', path: '/settings' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const hour = new Date().getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-6 flex items-center justify-between relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)',
          boxShadow: '0 12px 36px rgba(37, 99, 235, 0.25)',
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10">
          <h1 className="text-[22px] font-bold text-white mb-1">{greeting}，{user?.real_name || '管理员'} 👋</h1>
          <p className="text-[14px] text-blue-100">
            欢迎使用管用GL管理系统
          </p>
        </div>
        <div className="flex gap-3 relative z-10">
          <button
            className="px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:shadow-lg border-0 outline-none"
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              color: 'white',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
            onClick={() => navigate('/settings')}
          >
            系统设置
          </button>
        </div>
      </div>

      <div className="gl-card-glass p-5">
        <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--gl-text-primary)' }}>
          快捷操作
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 text-left"
              style={{ background: 'var(--gl-hover-bg)', border: '1px solid var(--gl-border-light)' }}
              onClick={() => navigate(action.path)}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[15px]"
                style={{ color: action.color, background: `${action.color}12` }}
              >
                {action.icon}
              </div>
              <span className="text-[13px] font-medium" style={{ color: 'var(--gl-text-primary)' }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
