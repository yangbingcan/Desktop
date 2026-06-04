/** @file 用户下拉菜单 - 头像、用户名、下拉选项（个人信息、修改密码、切换用户、退出登录） */
import { useNavigate } from 'react-router-dom'
import {
  SunOutlined,
  MoonOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  LockOutlined,
  SwapOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { Dropdown, Tooltip, type MenuProps } from 'antd'
import { useAppStore } from '../../../stores/appStore'
import { useAuthStore } from '../../../stores/authStore'

/** UserMenu 组件属性 */
interface UserMenuProps {
  /** 点击"个人信息"时的回调 */
  onProfileClick: () => void
  /** 点击"修改密码"时的回调 */
  onPasswordClick: () => void
  /** 点击"切换用户"时的回调 */
  onSwitchUserClick: () => void
}

export default function UserMenu({ onProfileClick, onPasswordClick, onSwitchUserClick }: UserMenuProps) {
  const navigate = useNavigate()
  const { themeMode, toggleTheme, setSettingsOpen } = useAppStore()
  const { logout, user } = useAuthStore()

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: '个人信息', icon: <UserOutlined /> },
    { key: 'change-password', label: '修改密码', icon: <LockOutlined /> },
    { key: 'switch-user', label: '切换用户', icon: <SwapOutlined /> },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
  ]

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'profile':
        onProfileClick()
        break
      case 'change-password':
        onPasswordClick()
        break
      case 'switch-user':
        onSwitchUserClick()
        break
      case 'logout':
        logout()
        navigate('/login')
        break
    }
  }

  return (
    <div className="flex items-center gap-0.5 px-1.5 flex-shrink-0">
      <div
        className="gl-icon-btn w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
        style={{ color: 'var(--gl-text-secondary)' }}
        onClick={toggleTheme}
        title={themeMode === 'dark' ? '切换浅色' : '切换深色'}
      >
        {themeMode === 'dark' ? <SunOutlined style={{ fontSize: 15 }} /> : <MoonOutlined style={{ fontSize: 15 }} />}
      </div>
      <div
        className="gl-icon-btn w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
        style={{ color: 'var(--gl-text-secondary)' }}
        onClick={() => setSettingsOpen(true)}
        title="主题设置"
      >
        <SettingOutlined style={{ fontSize: 15 }} />
      </div>
      <Tooltip title="暂无新通知">
        <div
          className="gl-icon-btn w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{ color: 'var(--gl-text-secondary)' }}
        >
          <BellOutlined style={{ fontSize: 15 }} />
        </div>
      </Tooltip>
      <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight" trigger={['click']}>
        <div
          className="gl-icon-btn flex items-center gap-1.5 h-8 px-2 rounded-lg cursor-pointer transition-all"
          style={{ color: 'var(--gl-text-secondary)' }}
        >
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)' }}
          >
            管
          </div>
          <span className="text-[13px] hidden lg:inline">{user?.real_name || user?.username || '管理员'}</span>
        </div>
      </Dropdown>
    </div>
  )
}
