/** @file 侧边栏导航 - 薄壳组件，组合 MenuSearch、MenuList、SidebarFooter 子组件 */
import { useState, useMemo } from 'react'
import {
  DashboardOutlined,
  SafetyOutlined,
  UserOutlined,
  SettingOutlined,
  ControlOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import MenuSearch from './sidebar/MenuSearch'
import MenuList, { filterMenuByPermissions, type GroupConfig } from './sidebar/MenuList'
import SidebarFooter from './sidebar/SidebarFooter'

export default function Sidebar() {
  const { sidebarCollapsed, uiSettings } = useAppStore()
  const { user } = useAuthStore()
  const permissions = user?.permissions ?? []
  const isSuperAdmin = user?.is_super_admin ?? false
  const [searchText, setSearchText] = useState('')

  /** 菜单配置定义 */
  const menuConfig: GroupConfig[] = useMemo(() => [
    {
      name: '工作台',
      icon: <DashboardOutlined />,
      items: [
        { key: '/dashboard', icon: <DashboardOutlined />, iconName: 'DashboardOutlined', label: '工作台', group: '工作台' },
      ],
    },
    {
      name: '系统管理',
      icon: <ControlOutlined />,
      items: [
        { key: '/user/list', icon: <UserOutlined />, iconName: 'UserOutlined', label: '用户管理', group: '系统管理' },
        { key: '/permission/roles', icon: <SafetyOutlined />, iconName: 'SafetyOutlined', label: '角色权限', group: '系统管理' },
        { key: '/system/logs', icon: <FileTextOutlined />, iconName: 'FileTextOutlined', label: '系统日志', group: '系统管理' },
        { key: '/settings', icon: <SettingOutlined />, iconName: 'SettingOutlined', label: '系统设置', group: '系统管理' },
      ],
    },
  ], [])

  /** 根据权限过滤菜单 */
  const filteredMenuConfig = filterMenuByPermissions(menuConfig, permissions, isSuperAdmin)

  const sidebarWidth = sidebarCollapsed ? 'var(--gl-sidebar-collapsed)' : `${uiSettings.sidebarWidth}px`

  return (
    <aside
      className="gl-glass h-full flex flex-col flex-shrink-0 overflow-hidden select-none"
      style={{ width: sidebarWidth, background: 'var(--gl-sidebar-bg)', borderRight: '1px solid var(--gl-titlebar-border)', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), background var(--gl-transition-normal), border-color var(--gl-transition-normal)' }}
    >
      {/* 菜单搜索 */}
      <MenuSearch
        searchText={searchText}
        onSearchChange={setSearchText}
        collapsed={sidebarCollapsed}
      />

      {/* 菜单列表 */}
      <MenuList
        menuConfig={filteredMenuConfig}
        searchText={searchText}
        collapsed={sidebarCollapsed}
      />

      {/* 底部折叠按钮 */}
      <SidebarFooter collapsed={sidebarCollapsed} />
    </aside>
  )
}
