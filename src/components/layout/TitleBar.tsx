/** @file 自定义标题栏 v10.0 - 毛玻璃质感+丝滑动画+个人信息弹窗 */
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LeftOutlined,
  RightOutlined,
  SunOutlined,
  MoonOutlined,
  SettingOutlined,
  BellOutlined,
  CloseOutlined,
  MinusOutlined,
  BorderOutlined,
  BlockOutlined,
  UserOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { Badge, Dropdown, Modal, Form, Input, message, type MenuProps } from 'antd'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAppStore } from '../../stores/appStore'
import { useTabStore } from '../../stores/tabStore'
import { useAuthStore } from '../../stores/authStore'
import { invokeCommand } from '../../services/api'

export default function TitleBar() {
  const navigate = useNavigate()
  const appWindow = useMemo(() => getCurrentWindow(), [])
  const unlistenRef = useRef<(() => void) | null>(null)
  const { sidebarCollapsed, toggleSidebar, themeMode, toggleTheme, setSettingsOpen } = useAppStore()
  const { tabs, activeKey, removeTab, setActiveKey, closeOtherTabs, closeAllTabs, closeLeftTabs, closeRightTabs, moveTab } = useTabStore()
  const { logout, user, setUser } = useAuthStore()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [showLeftMask, setShowLeftMask] = useState(false)
  const [showRightMask, setShowRightMask] = useState(false)
  const [isMaximized, setIsMaximized] = useState(true)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()

  useEffect(() => {
    navigate(activeKey)
  }, [activeKey, navigate])

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized).catch(() => {})
    appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch(() => {})
    }).then(fn => { unlistenRef.current = fn })
    return () => { unlistenRef.current?.() }
  }, [])

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

  const checkOverflow = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth
    setShowLeftMask(overflow && el.scrollLeft > 2)
    setShowRightMask(overflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [tabs, checkOverflow])

  const handleTabScroll = (direction: 'left' | 'right') => {
    const el = tabsRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' })
    setTimeout(checkOverflow, 300)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.currentTarget.scrollBy({ left: e.deltaY, behavior: 'auto' })
    setTimeout(checkOverflow, 50)
  }

  const handleMinimize = () => {
    appWindow.minimize().catch(() => {})
  }
  const handleToggleMaximize = async () => {
    await appWindow.toggleMaximize()
    setIsMaximized(await appWindow.isMaximized())
  }
  const handleClose = () => {
    appWindow.close().catch(() => {})
  }

  const getContextMenu = (tab: typeof tabs[0], idx: number): MenuProps => {
    const items: MenuProps['items'] = []
    if (tab.closable !== false) {
      items.push({ key: 'close', label: '关闭', icon: <CloseOutlined /> })
    }
    if (tabs.length > 1) {
      items.push({ key: 'closeOthers', label: '关闭其他' })
      items.push({ key: 'closeAll', label: '关闭所有' })
    }
    if (idx > 0 && tabs.slice(0, idx).some((t) => t.closable !== false)) {
      items.push({ key: 'closeLeft', label: '关闭左边' })
    }
    if (idx < tabs.length - 1 && tabs.slice(idx + 1).some((t) => t.closable !== false)) {
      items.push({ key: 'closeRight', label: '关闭右边' })
    }
    return {
      items,
      onClick: ({ key }) => {
        switch (key) {
          case 'close': removeTab(tab.key); break
          case 'closeOthers': closeOtherTabs(tab.key); break
          case 'closeAll': closeAllTabs(); break
          case 'closeLeft': closeLeftTabs(tab.key); break
          case 'closeRight': closeRightTabs(tab.key); break
        }
      },
    }
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== idx) {
      moveTab(dragIndex, idx)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: '个人信息' },
    { key: 'change-password', label: '修改密码' },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', danger: true },
  ]

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'profile':
        if (user) {
          profileForm.setFieldsValue({
            real_name: user.real_name,
            phone: user.phone,
            email: user.email || '',
          })
        }
        setProfileOpen(true)
        break
      case 'change-password':
        passwordForm.resetFields()
        setPasswordOpen(true)
        break
      case 'logout':
        logout()
        navigate('/login')
        break
    }
  }

  const handleProfileSubmit = async (values: { real_name: string; phone: string; email: string }) => {
    setProfileLoading(true)
    try {
      const token = useAuthStore.getState().token
      await invokeCommand('update_user', {
        token,
        params: {
          id: user?.id,
          real_name: values.real_name,
          phone: values.phone,
          email: values.email || null,
        },
      })
      setUser({
        real_name: values.real_name,
        phone: values.phone,
        email: values.email || null,
      })
      message.success('个人信息已更新')
      setProfileOpen(false)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSubmit = async (values: { old_password: string; new_password: string }) => {
    setPasswordLoading(true)
    try {
      const token = useAuthStore.getState().token
      await invokeCommand('update_password', {
        token,
        old_password: values.old_password,
        new_password: values.new_password,
      })
      message.success('密码修改成功，请重新登录')
      setPasswordOpen(false)
      logout()
      navigate('/login')
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '修改失败')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <header
      data-tauri-drag-region
      className="gl-glass flex items-center flex-shrink-0 select-none relative"
      style={{ height: 'var(--gl-titlebar-height)', background: 'var(--gl-titlebar-bg)', borderBottom: '1px solid var(--gl-titlebar-border)', transition: 'background var(--gl-transition-normal), border-color var(--gl-transition-normal)' }}
      onDoubleClick={handleTitlebarDoubleClick}
    >
      <div
        className="gl-icon-btn flex items-center justify-center flex-shrink-0 cursor-pointer rounded-lg transition-all"
        style={{ width: 40, height: 32, marginLeft: 4, color: 'var(--gl-text-secondary)' }}
        onClick={toggleSidebar}
        title={sidebarCollapsed ? '展开菜单' : '折叠菜单'}
      >
        {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>

      <div data-tauri-drag-region className="flex-1 flex items-center relative h-full overflow-hidden" style={{ minWidth: 0 }}>
        <div className={`gl-mask-left ${showLeftMask ? 'gl-mask-visible' : ''}`} />

        {showLeftMask && (
          <div
            className="gl-icon-btn flex-shrink-0 flex items-center justify-center cursor-pointer h-full rounded-sm transition-all z-10"
            style={{ width: 24, color: 'var(--gl-text-tertiary)' }}
            onClick={() => handleTabScroll('left')}
          >
            <LeftOutlined style={{ fontSize: 10 }} />
          </div>
        )}

        <div
          ref={tabsRef}
          data-tauri-drag-region
          className="flex items-center h-full overflow-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', flex: 1 }}
          onScroll={checkOverflow}
          onWheel={handleWheel}
        >
          {tabs.map((tab, idx) => {
            const isActive = activeKey === tab.key
            const isDragging = dragIndex === idx
            const isDragOver = dragOverIndex === idx
            return (
              <Dropdown
                key={tab.key}
                menu={getContextMenu(tab, idx)}
                trigger={['contextMenu']}
              >
                <div
                  data-tab-key={tab.key}
                  data-tab-closable={tab.closable !== false ? 'true' : 'false'}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => { setActiveKey(tab.key); navigate(tab.key) }}
                  className="flex items-center gap-1.5 h-8 px-3 cursor-pointer transition-all flex-shrink-0 text-[13px] relative select-none"
                  style={{
                    maxWidth: 160,
                    color: isActive ? 'var(--gl-primary)' : 'var(--gl-text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                    opacity: isDragging ? 0.4 : 1,
                    borderLeft: isDragOver && dragIndex !== null && dragIndex !== idx ? '2px solid var(--gl-primary)' : '2px solid transparent',
                    borderRadius: isActive ? 'var(--gl-radius-sm)' : 0,
                    background: isActive ? 'var(--gl-primary-supply)' : 'transparent',
                  }}
                >
                  <span className="truncate">{tab.title}</span>
                  {tab.closable !== false && (
                    <span
                      onClick={(e) => { e.stopPropagation(); removeTab(tab.key) }}
                      className="gl-tab-close flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 transition-all"
                      style={{ color: 'var(--gl-text-tertiary)', fontSize: 10 }}
                    >
                      <CloseOutlined />
                    </span>
                  )}
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-2 right-2 rounded-full"
                      style={{ height: 2, background: 'var(--gl-primary)', transition: 'all var(--gl-transition-fast)' }}
                    />
                  )}
                </div>
              </Dropdown>
            )
          })}
        </div>

        {showRightMask && (
          <div
            className="gl-icon-btn flex-shrink-0 flex items-center justify-center cursor-pointer h-full rounded-sm transition-all z-10"
            style={{ width: 24, color: 'var(--gl-text-tertiary)' }}
            onClick={() => handleTabScroll('right')}
          >
            <RightOutlined style={{ fontSize: 10 }} />
          </div>
        )}

        <div className={`gl-mask-right ${showRightMask ? 'gl-mask-visible' : ''}`} />
      </div>

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
        <div
          className="gl-icon-btn w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{ color: 'var(--gl-text-secondary)' }}
        >
          <Badge dot offset={[-2, 2]}>
            <BellOutlined style={{ fontSize: 15 }} />
          </Badge>
        </div>
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

      <div className="flex items-center flex-shrink-0" style={{ height: 32 }}>
        <div
          className="gl-icon-btn flex items-center justify-center cursor-pointer transition-all"
          style={{ width: 46, height: 32, color: 'var(--gl-text-secondary)' }}
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <MinusOutlined style={{ fontSize: 12 }} />
        </div>
        <div
          className="gl-icon-btn flex items-center justify-center cursor-pointer transition-all"
          style={{ width: 46, height: 32, color: 'var(--gl-text-secondary)' }}
          onClick={handleToggleMaximize}
          aria-label={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? <BlockOutlined style={{ fontSize: 12 }} /> : <BorderOutlined style={{ fontSize: 12 }} />}
        </div>
        <div
          className="gl-win-close flex items-center justify-center cursor-pointer transition-all"
          style={{ width: 46, height: 32, color: 'var(--gl-text-secondary)' }}
          onClick={handleClose}
          aria-label="关闭"
        >
          <CloseOutlined style={{ fontSize: 12 }} />
        </div>
      </div>

      <Modal
        title="个人信息"
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        onOk={() => profileForm.submit()}
        confirmLoading={profileLoading}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={440}
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item label="用户名">
            <Input value={user?.username} disabled prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="real_name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改密码"
        open={passwordOpen}
        onCancel={() => setPasswordOpen(false)}
        onOk={() => passwordForm.submit()}
        confirmLoading={passwordLoading}
        okText="确认修改"
        cancelText="取消"
        destroyOnClose
        width={440}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="原密码"
            name="old_password"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="new_password"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password placeholder="请输入新密码" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirm_password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" prefix={<LockOutlined />} />
          </Form.Item>
        </Form>
      </Modal>
    </header>
  )
}
