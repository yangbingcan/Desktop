/** @file 自定义标题栏 - 薄壳组件，组合 TabBar、WindowControls、UserMenu 及各弹窗子组件 */
import { useState, useCallback } from 'react'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { useTabStore } from '../../stores/tabStore'
import TabBar from './titlebar/TabBar'
import WindowControls from './titlebar/WindowControls'
import UserMenu from './titlebar/UserMenu'
import ProfileModal from './titlebar/ProfileModal'
import PasswordModal from './titlebar/PasswordModal'
import SwitchUserModal from './titlebar/SwitchUserModal'

export default function TitleBar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const { removeTab } = useTabStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [switchUserOpen, setSwitchUserOpen] = useState(false)

  /** 双击标题栏：点击标签页则关闭，否则由窗口管理器处理最大化 */
  const handleTitlebarDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.gl-icon-btn, .gl-win-close, .gl-tab-close')) return
    const tabEl = target.closest('[data-tab-key]')
    if (tabEl) {
      const tabKey = tabEl.getAttribute('data-tab-key')
      const closable = tabEl.getAttribute('data-tab-closable')
      if (tabKey && closable !== 'false') {
        removeTab(tabKey)
      }
      return
    }
  }, [removeTab])

  return (
    <header
      data-tauri-drag-region
      className="gl-glass flex items-center flex-shrink-0 select-none relative"
      style={{ height: 'var(--gl-titlebar-height)', background: 'var(--gl-titlebar-bg)', borderBottom: '1px solid var(--gl-titlebar-border)', transition: 'background var(--gl-transition-normal), border-color var(--gl-transition-normal)' }}
      onDoubleClick={handleTitlebarDoubleClick}
    >
      {/* 侧边栏折叠按钮 */}
      <div
        className="gl-icon-btn flex items-center justify-center flex-shrink-0 cursor-pointer rounded-lg transition-all"
        style={{ width: 40, height: 32, marginLeft: 4, color: 'var(--gl-text-secondary)' }}
        onClick={toggleSidebar}
        title={sidebarCollapsed ? '展开菜单' : '折叠菜单'}
      >
        {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>

      {/* 标签页栏 */}
      <TabBar onTitlebarDoubleClick={handleTitlebarDoubleClick} />

      {/* 用户菜单区（主题切换、通知、用户下拉） */}
      <UserMenu
        onProfileClick={() => setProfileOpen(true)}
        onPasswordClick={() => setPasswordOpen(true)}
        onSwitchUserClick={() => setSwitchUserOpen(true)}
      />

      {/* 窗口控制按钮 */}
      <WindowControls />

      {/* 个人信息弹窗 */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* 修改密码弹窗 */}
      <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />

      {/* 切换用户弹窗 */}
      <SwitchUserModal open={switchUserOpen} onClose={() => setSwitchUserOpen(false)} />
    </header>
  )
}
