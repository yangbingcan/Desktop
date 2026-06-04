/** @file 菜单列表 - 渲染侧边栏菜单项，含分组折叠、权限过滤、搜索结果和折叠弹窗 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../stores/appStore'
import { useTabStore } from '../../../stores/tabStore'
import { hasPermissionForRoute } from '../../../services/permissionMap'
import { recordPageView } from '../../../services/operationLogService'
import type { Tab } from '../../../stores/tabStore'

/** 菜单项定义 */
export interface MenuItem {
  key: string
  icon: React.ReactNode
  iconName: string
  label: string
  group: string
}

/** 分组配置 */
export interface GroupConfig {
  name: string
  icon: React.ReactNode
  items: MenuItem[]
}

/** 弹窗位置 */
interface PopupPosition {
  top: number
  left: number
}

/** 根据权限过滤菜单 */
export function filterMenuByPermissions(groups: GroupConfig[], permissions: string[], isSuperAdmin: boolean): GroupConfig[] {
  if (isSuperAdmin) return groups
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasPermissionForRoute(item.key, permissions, false)),
    }))
    .filter(group => group.items.length > 0)
}

/** MenuList 组件属性 */
interface MenuListProps {
  /** 完整菜单配置（已过滤） */
  menuConfig: GroupConfig[]
  /** 搜索文本 */
  searchText: string
  /** 是否折叠 */
  collapsed: boolean
}

export default function MenuList({ menuConfig, searchText, collapsed }: MenuListProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { uiSettings } = useAppStore()
  const { addTab } = useTabStore()
  const activePath = location.pathname

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [popupGroup, setPopupGroup] = useState<string | null>(null)
  const [popupPos, setPopupPos] = useState<PopupPosition>({ top: 0, left: 0 })

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const sidebarRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const allItems = menuConfig.flatMap((g) => g.items)

  /** 搜索过滤结果 */
  const filtered = searchText.trim()
    ? allItems.filter((item) => item.label.toLowerCase().includes(searchText.toLowerCase()))
    : []

  const isSearching = searchText.trim().length > 0 && !collapsed

  /** 点击叶子菜单项 */
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
      navigate(item.key)

      if (isNewTab) {
        recordPageView(item.label, item.group).catch((e) => console.warn('记录页面访问日志失败:', e))
      }
    },
    [addTab, navigate],
  )

  /** 点击分组标题 */
  const handleGroupClick = useCallback(
    (groupName: string) => {
      const group = menuConfig.find((g) => g.name === groupName)
      if (!group) return

      if (collapsed) {
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
    [collapsed, expandedGroup, popupGroup, menuConfig],
  )

  /** 展开侧边栏时关闭弹窗 */
  useEffect(() => {
    if (!collapsed) {
      setPopupGroup(null)
    }
  }, [collapsed])

  /** 点击弹窗外部关闭 */
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

  /** 判断分组是否有激活的子项 */
  const hasActiveChild = useCallback(
    (groupName: string) => {
      const group = menuConfig.find((g) => g.name === groupName)
      return group ? group.items.some((item) => activePath === item.key || activePath.startsWith(item.key + '/')) : false
    },
    [activePath, menuConfig],
  )

  /** 渲染单个菜单项 */
  const renderMenuItem = (item: MenuItem) => {
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
        {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
      </div>
    )
  }

  return (
    <div ref={sidebarRef} className="flex-1 overflow-y-auto py-1 px-2">
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
                onClick={() => { handleLeafClick(item) }}
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
        menuConfig.map((group) => {
          const isExpanded = expandedGroup === group.name
          const groupHasActive = hasActiveChild(group.name)

          // 只有一个子项的分组，直接作为一级菜单项显示（无需展开折叠）
          if (group.items.length === 1) {
            return <div key={group.name}>{renderMenuItem(group.items[0])}</div>
          }

          /* 全部展开模式 */
          if (uiSettings.navMode === 'all' && !collapsed) {
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
                {group.items.map((item) => renderMenuItem(item))}
              </div>
            )
          }

          /* 分组折叠模式 */
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
                {groupHasActive && !isExpanded && !collapsed && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                    style={{ background: 'var(--gl-primary)', height: '60%', boxShadow: '0 0 8px rgba(22, 119, 255, 0.3)', transition: 'background var(--gl-transition-fast)' }}
                  />
                )}
                <span className="w-[18px] text-center text-[14px] flex-shrink-0">{group.icon}</span>
                {!collapsed && (
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

              {!collapsed && (
                <div
                  className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    maxHeight: isExpanded ? `${group.items.length * 40}px` : '0px',
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div className="ml-[19px] pl-4 gl-sidebar-group-line">
                    {group.items.map((item) => renderMenuItem(item))}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* 折叠状态下的弹窗菜单 */}
      {collapsed && popupGroup && createPortal(
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
            {menuConfig
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
    </div>
  )
}
