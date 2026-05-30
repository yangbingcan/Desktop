/** @file 侧边栏导航 v7.0 - 毛玻璃质感+丝滑动画+交互优化 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  FormOutlined,
  DatabaseOutlined,
  AuditOutlined,
  SafetyOutlined,
  UserOutlined,
  SettingOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  ControlOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Input } from 'antd'
import { useAppStore } from '../../stores/appStore'
import { useTabStore } from '../../stores/tabStore'
import { useAuthStore } from '../../stores/authStore'
import { routePermissionMap } from '../../services/permissionMap'
import type { Tab } from '../../stores/tabStore'

interface MenuItem {
  key: string
  icon: React.ReactNode
  iconName: string
  label: string
  group: string
}

interface GroupConfig {
  name: string
  icon: React.ReactNode
  items: MenuItem[]
}

interface PopupPosition {
  top: number
  left: number
}

const menuConfig: GroupConfig[] = [
  {
    name: '仪表盘',
    icon: <AppstoreOutlined />,
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, iconName: 'DashboardOutlined', label: '仪表盘', group: '仪表盘' },
    ],
  },
  {
    name: '核心引擎',
    icon: <ThunderboltOutlined />,
    items: [
      { key: '/form-designer', icon: <FormOutlined />, iconName: 'FormOutlined', label: '表单设计器', group: '核心引擎' },
      { key: '/data-center', icon: <DatabaseOutlined />, iconName: 'DatabaseOutlined', label: '数据中心', group: '核心引擎' },
      { key: '/workflow/pending', icon: <AuditOutlined />, iconName: 'AuditOutlined', label: '流程管理', group: '核心引擎' },
    ],
  },
  {
    name: '系统管理',
    icon: <ControlOutlined />,
    items: [
      { key: '/permission/roles', icon: <SafetyOutlined />, iconName: 'SafetyOutlined', label: '权限管理', group: '系统管理' },
      { key: '/user/list', icon: <UserOutlined />, iconName: 'UserOutlined', label: '用户管理', group: '系统管理' },
      { key: '/settings', icon: <SettingOutlined />, iconName: 'SettingOutlined', label: '系统设置', group: '系统管理' },
    ],
  },
]

function filterMenuByPermissions(groups: GroupConfig[], permissions: string[], isSuperAdmin: boolean): GroupConfig[] {
  if (isSuperAdmin) return groups
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const permKey = routePermissionMap[item.key]
        return !permKey || permissions.includes(permKey)
      }),
    }))
    .filter(group => group.items.length > 0)
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, uiSettings } = useAppStore()
  const { addTab } = useTabStore()
  const { user } = useAuthStore()
  const permissions = user?.permissions ?? []
  const isSuperAdmin = user?.is_super_admin ?? false
  const filteredMenuConfig = filterMenuByPermissions(menuConfig, permissions, isSuperAdmin)
  const filteredAllItems = filteredMenuConfig.flatMap((g) => g.items)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [popupGroup, setPopupGroup] = useState<string | null>(null)
  const [popupPos, setPopupPos] = useState<PopupPosition>({ top: 0, left: 0 })
  const [searchText, setSearchText] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const sidebarRef = useRef<HTMLElement>(null)

  const handleLeafClick = useCallback(
    (item: MenuItem) => {
      const tab: Tab = {
        key: item.key,
        title: item.label,
        icon: item.iconName,
        closable: item.key !== '/dashboard',
      }
      addTab(tab)
      navigate(item.key)
    },
    [addTab, navigate],
  )

  const handleGroupClick = useCallback(
    (groupName: string) => {
      if (sidebarCollapsed) {
        const group = filteredMenuConfig.find((g) => g.name === groupName)
        if (group) {
          if (group.items.length === 1) {
            setPopupGroup(null)
            handleLeafClick(group.items[0])
          } else {
            if (popupGroup === groupName) {
              setPopupGroup(null)
            } else {
              const el = groupRefs.current[groupName]
              if (el) {
                const rect = el.getBoundingClientRect()
                setPopupPos({
                  top: rect.top,
                  left: rect.right + 4,
                })
              }
              setPopupGroup(groupName)
            }
          }
        }
      } else {
        setExpandedGroup(expandedGroup === groupName ? null : groupName)
      }
    },
    [sidebarCollapsed, expandedGroup, popupGroup, handleLeafClick],
  )

  useEffect(() => {
    if (!sidebarCollapsed) {
      setPopupGroup(null)
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupGroup && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setPopupGroup(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [popupGroup])

  const activePath = location.pathname
  const sidebarWidth = sidebarCollapsed ? 'var(--gl-sidebar-collapsed)' : `${uiSettings.sidebarWidth}px`

  const filtered = searchText.trim()
    ? filteredAllItems.filter((item) => item.label.toLowerCase().includes(searchText.toLowerCase()))
    : []

  const isSearching = searchText.trim().length > 0 && !sidebarCollapsed

  const hasActiveChild = useCallback(
    (groupName: string) => {
      const group = filteredMenuConfig.find((g) => g.name === groupName)
      return group ? group.items.some((item) => activePath === item.key) : false
    },
    [activePath],
  )

  return (
    <aside
      ref={sidebarRef}
      className="gl-glass h-full flex flex-col flex-shrink-0 overflow-hidden select-none"
      style={{ width: sidebarWidth, background: 'var(--gl-sidebar-bg)', borderRight: '1px solid var(--gl-titlebar-border)', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), background var(--gl-transition-normal), border-color var(--gl-transition-normal)' }}
    >
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        {sidebarCollapsed ? null : (
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--gl-text-tertiary)', fontSize: 12 }} />}
            placeholder="搜索菜单..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="small"
            allowClear
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              borderRadius: 'var(--gl-radius-md)',
              background: 'var(--gl-card-bg)',
              borderColor: searchFocused ? 'var(--gl-primary)' : 'var(--gl-border)',
              borderWidth: searchFocused ? 2 : 1,
              height: 32,
              fontSize: 'var(--gl-font-size-sm)',
              transition: 'border-color 0.2s ease, background 0.2s ease',
            }}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-2">
        {isSearching ? (
          filtered.length === 0 ? (
            <div className="text-center py-6" style={{ color: 'var(--gl-sidebar-text)', fontSize: 'var(--gl-font-size-sm)' }}>
              无匹配菜单
            </div>
          ) : (
            filtered.map((item) => {
              const isActive = activePath === item.key
              return (
                <div
                  key={item.key}
                  onClick={() => { handleLeafClick(item); setSearchText('') }}
                  className="gl-sidebar-btn flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all text-[13px]"
                  style={{
                    color: isActive ? 'var(--gl-primary)' : 'var(--gl-sidebar-text)',
                    background: isActive ? 'var(--gl-sidebar-item-active-bg)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span className="w-[18px] text-center text-[14px] flex-shrink-0">{item.icon}</span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
              )
            })
          )
        ) : (
          filteredMenuConfig.map((group) => {
            const isExpanded = expandedGroup === group.name
            const groupHasActive = hasActiveChild(group.name)

            if (uiSettings.navMode === 'all' && !sidebarCollapsed) {
              return (
                <div key={group.name} className="mb-1">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--gl-sidebar-group-expanded)' }}
                  >
                    {group.name}
                  </div>
                  {group.items.map((item) => renderMenuItem(item, false))}
                </div>
              )
            }

            const isSingleItem = group.items.length === 1
            const singleActive = isSingleItem && activePath === group.items[0].key

            return (
              <div key={group.name} className="mb-0.5">
                <div
                  ref={(el) => { groupRefs.current[group.name] = el }}
                  onClick={() => handleGroupClick(group.name)}
                  className="gl-sidebar-btn flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all text-[13px] relative"
                  style={{
                    color: (isExpanded || singleActive || groupHasActive)
                      ? 'var(--gl-sidebar-group-expanded)'
                      : 'var(--gl-sidebar-group-collapsed)',
                    fontWeight: (isExpanded || singleActive || groupHasActive) ? 600 : 400,
                    background: 'transparent',
                  }}
                >
                  {groupHasActive && !isExpanded && !sidebarCollapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                      style={{ background: 'var(--gl-primary)', height: '60%', transition: 'background var(--gl-transition-fast)' }}
                    />
                  )}
                  <span className="w-[18px] text-center text-[14px] flex-shrink-0">{group.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="whitespace-nowrap flex-1">{group.name}</span>
                      {!isSingleItem && (
                        <span
                          className="text-[10px] transition-transform duration-200"
                          style={{
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            color: 'var(--gl-sidebar-group-collapsed)',
                          }}
                        >
                          ▸
                        </span>
                      )}
                    </>
                  )}
                </div>

                {!sidebarCollapsed && !isSingleItem && (
                  <div
                    className="overflow-hidden transition-all duration-200 ease-in-out"
                    style={{
                      maxHeight: isExpanded ? `${group.items.length * 40}px` : '0px',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div className="ml-[19px] pl-4 border-l-2" style={{ borderColor: 'var(--gl-border)' }}>
                      {group.items.map((item) => renderMenuItem(item, true))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {sidebarCollapsed && popupGroup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopupGroup(null)} />
          <div
            className="fixed z-50 gl-glass gl-scale-in py-1 min-w-[160px]"
            style={{
              top: popupPos.top,
              left: popupPos.left,
              background: 'var(--gl-card-bg)',
              border: '1px solid var(--gl-card-border)',
              boxShadow: 'var(--gl-shadow-float)',
              borderRadius: 'var(--gl-radius-lg)',
            }}
          >
            <div
              className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--gl-text-tertiary)' }}
            >
              {popupGroup}
            </div>
            {filteredMenuConfig
              .find((g) => g.name === popupGroup)
              ?.items.map((item) => {
                const isActive = activePath === item.key
                return (
                  <div
                    key={item.key}
                    onClick={() => { handleLeafClick(item); setPopupGroup(null) }}
                    className="gl-sidebar-popup-btn flex items-center gap-2.5 px-3 py-[7px] mx-1 rounded-lg cursor-pointer transition-all text-[13px]"
                    style={{
                      color: isActive ? 'var(--gl-primary)' : 'var(--gl-text-primary)',
                      background: isActive ? 'var(--gl-sidebar-item-active-bg)' : 'transparent',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <span className="w-[18px] text-center text-[14px] flex-shrink-0">{item.icon}</span>
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </aside>
  )

  function renderMenuItem(item: MenuItem, isChild: boolean) {
    const isActive = activePath === item.key
    return (
      <div
        key={item.key}
        onClick={() => handleLeafClick(item)}
        className="gl-sidebar-btn flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all text-[13px] relative"
        style={{
          color: isActive ? 'var(--gl-primary)' : 'var(--gl-sidebar-text)',
          background: isActive ? 'var(--gl-sidebar-item-active-bg)' : 'transparent',
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {isChild && isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
            style={{ background: 'var(--gl-primary)', height: '60%', transition: 'background var(--gl-transition-fast)' }}
          />
        )}
        <span className="w-[18px] text-center text-[14px] flex-shrink-0">{item.icon}</span>
        {!sidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
      </div>
    )
  }
}
