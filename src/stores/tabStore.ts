/** @file 标签栏状态管理 - 标签列表、活跃标签、右键菜单操作、拖拽排序、localStorage持久化 */
import { create } from 'zustand'

export interface Tab {
  key: string
  title: string
  icon?: string
  closable?: boolean
}

interface TabState {
  tabs: Tab[]
  activeKey: string
  addTab: (tab: Tab) => void
  removeTab: (key: string) => void
  setActiveKey: (key: string) => void
  closeOtherTabs: (key: string) => void
  closeAllTabs: () => void
  closeLeftTabs: (key: string) => void
  closeRightTabs: (key: string) => void
  moveTab: (fromIndex: number, toIndex: number) => void
  resetTabs: () => void
}

const STORAGE_KEY = 'gl-tabs'
const HOME_TAB: Tab = { key: '/dashboard', title: '工作台', icon: 'DashboardOutlined', closable: false }

function loadTabs(): { tabs: Tab[]; activeKey: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.tabs && parsed.tabs.length > 0) {
        const migrated = parsed.tabs.map((t: Tab) => {
          if (t.key === 'dashboard' || t.key === '/dashboard') {
            return { ...t, key: '/dashboard', closable: false }
          }
          return t
        })
        const unique: Tab[] = []
        const seen = new Set<string>()
        for (const t of migrated) {
          if (!seen.has(t.key)) {
            seen.add(t.key)
            unique.push(t)
          }
        }
        const hasHome = unique.find((t) => t.key === '/dashboard')
        if (!hasHome) {
          unique.unshift({ ...HOME_TAB })
        } else {
          const homeIdx = unique.findIndex((t) => t.key === '/dashboard')
          unique[homeIdx] = { ...unique[homeIdx], closable: false }
        }
        let activeKey = parsed.activeKey
        if (activeKey === 'dashboard') activeKey = '/dashboard'
        if (!unique.find((t) => t.key === activeKey)) activeKey = '/dashboard'
        return { tabs: unique, activeKey }
      }
    }
  } catch { /* ignore */ }
  return { tabs: [{ ...HOME_TAB }], activeKey: '/dashboard' }
}

function saveTabs(tabs: Tab[], activeKey: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeKey }))
}

const initial = loadTabs()

export const useTabStore = create<TabState>((set) => ({
  tabs: initial.tabs,
  activeKey: initial.activeKey,

  resetTabs: () =>
    set(() => {
      const defaultTabs = [{ ...HOME_TAB }]
      saveTabs(defaultTabs, '/dashboard')
      return { tabs: defaultTabs, activeKey: '/dashboard' }
    }),

  addTab: (tab) =>
    set((state) => {
      const exists = state.tabs.find((t) => t.key === tab.key)
      if (exists) {
        saveTabs(state.tabs, tab.key)
        return { activeKey: tab.key }
      }
      const newTabs = [...state.tabs, tab]
      saveTabs(newTabs, tab.key)
      return { tabs: newTabs, activeKey: tab.key }
    }),

  removeTab: (key) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.key === key)
      if (tab?.closable === false) return state
      const idx = state.tabs.findIndex((t) => t.key === key)
      const newTabs = state.tabs.filter((t) => t.key !== key)
      if (newTabs.length === 0) return state
      let newActiveKey = state.activeKey
      if (state.activeKey === key) {
        const nextIdx = idx < newTabs.length ? idx : newTabs.length - 1
        newActiveKey = newTabs[nextIdx].key
      }
      saveTabs(newTabs, newActiveKey)
      return { tabs: newTabs, activeKey: newActiveKey }
    }),

  setActiveKey: (key) =>
    set((state) => {
      saveTabs(state.tabs, key)
      return { activeKey: key }
    }),

  closeOtherTabs: (key) =>
    set((state) => {
      const target = state.tabs.find((t) => t.key === key)
      if (!target) return state
      const newTabs = state.tabs.filter((t) => t.key === key || t.closable === false)
      saveTabs(newTabs, key)
      return { tabs: newTabs, activeKey: key }
    }),

  closeAllTabs: () =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.closable === false)
      const newActiveKey = newTabs.length > 0 ? newTabs[0].key : '/dashboard'
      saveTabs(newTabs, newActiveKey)
      return { tabs: newTabs, activeKey: newActiveKey }
    }),

  closeLeftTabs: (key) =>
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.key === key)
      if (idx <= 0) return state
      const newTabs = state.tabs.filter((t, i) => i >= idx || t.closable === false)
      const unique = [...new Map(newTabs.map((t) => [t.key, t])).values()]
      const closedKeys = state.tabs.filter((t, i) => i < idx && t.closable !== false).map((t) => t.key)
      let newActiveKey = state.activeKey
      if (closedKeys.includes(state.activeKey)) {
        newActiveKey = key
      }
      saveTabs(unique, newActiveKey)
      return { tabs: unique, activeKey: newActiveKey }
    }),

  closeRightTabs: (key) =>
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.key === key)
      if (idx < 0 || idx === state.tabs.length - 1) return state
      const newTabs = state.tabs.filter((t, i) => i <= idx || t.closable === false)
      const unique = [...new Map(newTabs.map((t) => [t.key, t])).values()]
      const closedKeys = state.tabs.filter((t, i) => i > idx && t.closable !== false).map((t) => t.key)
      let newActiveKey = state.activeKey
      if (closedKeys.includes(state.activeKey)) {
        newActiveKey = key
      }
      saveTabs(unique, newActiveKey)
      return { tabs: unique, activeKey: newActiveKey }
    }),

  moveTab: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex) return state
      const newTabs = [...state.tabs]
      const [moved] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, moved)
      saveTabs(newTabs, state.activeKey)
      return { tabs: newTabs }
    }),
}))