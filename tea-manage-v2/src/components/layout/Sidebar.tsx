/** @file 侧边栏导航 v10.0 - 清理低代码模块，保留用户权限管理 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  SafetyOutlined,
  UserOutlined,
  SettingOutlined,
  AppstoreOutlined,
  ControlOutlined,
  SearchOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  ShopOutlined,
  TeamOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  RollbackOutlined,
  BarcodeOutlined,
  PrinterOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { Input } from 'antd'
import { useAppStore } from '../../stores/appStore'
import { useTabStore } from '../../stores/tabStore'
import { useAuthStore } from '../../stores/authStore'
import { routePermissionMap } from '../../services/permissionMap'
import { recordPageView } from '../../services/operationLogService'
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

function filterMenuByPermissions(groups: GroupConfig[], permissions: string[], isSuperAdmin: boolean): GroupConfig[] {
  if (isSuperAdmin) return groups
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.key === '/dashboard') return true
        let permModule: string | undefined
        for (const [prefix, mod] of Object.entries(routePermissionMap)) {
          if (item.key === prefix || item.key.startsWith(prefix + '/')) {
            permModule = mod
            break
          }
        }
        if (!permModule) return true
        return permissions.some(p => p === permModule || p.startsWith(permModule + ':'))
      }),
    }))
    .filter(group => group.items.length > 0)
}

export default function Sidebar() {
  const location = useLocation()
  const { sidebarCollapsed, uiSettings } = useAppStore()
  const { addTab } = useTabStore()
  const { user } = useAuthStore()
  const permissions = user?.permissions ?? []
  const isSuperAdmin = user?.is_super_admin ?? false

  const menuConfig: GroupConfig[] = useMemo(() => [
    {
      name: '首页',
      icon: <AppstoreOutlined />,
      items: [
        { key: '/dashboard', icon: <DashboardOutlined />, iconName: 'DashboardOutlined', label: '仪表盘', group: '首页' },
      ],
    },
    {
      name: '茶叶店业务',
      icon: <ShopOutlined />,
      items: [
        { key: '/products', icon: <ShoppingOutlined />, iconName: 'ShoppingOutlined', label: '商品档案', group: '茶叶店业务' },
        { key: '/inventory', icon: <InboxOutlined />, iconName: 'InboxOutlined', label: '库存管理', group: '茶叶店业务' },
        { key: '/sales', icon: <ShoppingCartOutlined />, iconName: 'ShoppingCartOutlined', label: '收银开单', group: '茶叶店业务' },
        { key: '/members', icon: <TeamOutlined />, iconName: 'TeamOutlined', label: '会员管理', group: '茶叶店业务' },
        { key: '/purchase', icon: <ShoppingOutlined />, iconName: 'ShoppingOutlined', label: '采购入库', group: '茶叶店业务' },
        { key: '/returns', icon: <RollbackOutlined />, iconName: 'RollbackOutlined', label: '退货管理', group: '茶叶店业务' },
        { key: '/suppliers', icon: <ShopOutlined />, iconName: 'ShopOutlined', label: '供应商', group: '茶叶店业务' },
      ],
    },
    {
      name: '打印与报表',
      icon: <PrinterOutlined />,
      items: [
        { key: '/barcodes', icon: <BarcodeOutlined />, iconName: 'BarcodeOutlined', label: '条码打印', group: '打印与报表' },
        { key: '/print-templates', icon: <PrinterOutlined />, iconName: 'PrinterOutlined', label: '打印模板', group: '打印与报表' },
        { key: '/reports', icon: <BarChartOutlined />, iconName: 'BarChartOutlined', label: '报表分析', group: '打印与报表' },
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

  const filteredMenuConfig = filterMenuByPermissions(menuConfig, permissions, isSuperAdmin)
  const filteredAllItems = filteredMenuConfig.flatMap((g) => g.items)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [popupGroup, setPopupGroup] = useState<string | null>(null)
  const [popupPos, setPopupPos] = useState<PopupPosition>({ top: 0, left: 0 })
  const [searchText, setSearchText] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const sidebarRef = useRef<HTMLElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const handleLeafClick = useCallback(
    (item: MenuItem) => {
      const { tabs } = useTabStore.getState()
      const isNewTab = !tabs.some((t) => t.key === item.key)

      const tab: Tab = {
        key: item.key,
        title: item.label,
        icon: item.iconName,
        closable: item.key !== '/dashboard',
      }
      addTab(tab)

      if (isNewTab) {
        recordPageView(item.label, item.group).catch(() => {})
      }
    },
    [addTab],
  )

  const handleGroupClick = useCallback(
    (groupName: string) => {
      const group = filteredMenuConfig.find((g) => g.name === groupName)
      if (!group) return

      if (sidebarCollapsed) {
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
      if (!popupGroup) return
      const target = e.target as Node
      const inSidebar = sidebarRef.current?.contains(target)
      const inPopup = popupRef.current?.contains(target)
      if (!inSidebar && !inPopup) {
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
      return group ? group.items.some((item) => activePath === item.key || activePath.startsWith(item.key + '/')) : false
    },
    [activePath, filteredMenuConfig],
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
                  <div className="gl-sidebar-section-title">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--gl-sidebar-group-collapsed)' }}
                    >
                      {group.name}
                    </span>
                  </div>
                  {group.items.map((item) => renderMenuItem(item, false))}
                </div>
              )
            }

            return (
              <div key={group.name} className="mb-0.5">
                <div
                  ref={(el) => { groupRefs.current[group.name] = el }}
                  onClick={() => handleGroupClick(group.name)}
                  className="gl-sidebar-btn flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all text-[13px] relative"
                  style={{
                    color: (isExpanded || groupHasActive)
                      ? 'var(--gl-sidebar-group-expanded)'
                      : 'var(--gl-sidebar-group-collapsed)',
                    fontWeight: (isExpanded || groupHasActive) ? 600 : 400,
                    background: 'transparent',
                  }}
                >
                  {groupHasActive && !isExpanded && !sidebarCollapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                      style={{ background: 'var(--gl-primary)', height: '60%', boxShadow: '0 0 8px rgba(22, 119, 255, 0.3)', transition: 'background var(--gl-transition-fast)' }}
                    />
                  )}
                  <span className="w-[18px] text-center text-[14px] flex-shrink-0">{group.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="whitespace-nowrap flex-1">{group.name}</span>
                      <span
                        className="text-[10px] transition-transform duration-200"
                        style={{
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          color: 'var(--gl-sidebar-group-collapsed)',
                        }}
                      >
                        ▸
                      </span>
                    </>
                  )}
                </div>

                {!sidebarCollapsed && (
                  <div
                    className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      maxHeight: isExpanded ? `${group.items.length * 40}px` : '0px',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div className="ml-[19px] pl-4 gl-sidebar-group-line">
                      {group.items.map((item) => renderMenuItem(item, true))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {sidebarCollapsed && popupGroup && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopupGroup(null)} />
          <div
            ref={popupRef}
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
            <div className="gl-sidebar-section-title">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--gl-text-tertiary)' }}
              >
                {popupGroup}
              </span>
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
        </>,
        document.body
      )}
    </aside>
  )

  function renderMenuItem(item: MenuItem, _isChild: boolean) {
    const isActive = activePath === item.key || activePath.startsWith(item.key + '/')
    return (
      <div
        key={item.key}
        onClick={() => handleLeafClick(item)}
        className={`gl-sidebar-btn flex items-center gap-2.5 px-3 py-[7px] rounded-lg cursor-pointer transition-all text-[13px] ${isActive ? 'gl-sidebar-item-active' : ''}`}
        style={{
          color: isActive ? 'var(--gl-primary)' : 'var(--gl-sidebar-text)',
          background: isActive ? 'var(--gl-sidebar-item-active-bg)' : 'transparent',
          fontWeight: isActive ? 600 : 400,
        }}
      >
        <span className="w-[18px] text-center text-[14px] flex-shrink-0">{item.icon}</span>
        {!sidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
      </div>
    )
  }
}
