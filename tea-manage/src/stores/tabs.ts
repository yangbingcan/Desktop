/**
 * @file 多标签页状态管理
 * @description v0.4.0 - 多任务并行，支持开关/拖拽/右键/持久化
 * @reference 设计借鉴 D:\AI\AI\JXC 的 tabStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ========== 类型定义 ==========

/** 标签页数据 */
export interface Tab {
  /** 路由 path，全局唯一标识 */
  key: string
  /** 标签显示名 */
  title: string
  /** 是否可关闭（首页 false） */
  closable: boolean
}

// ========== 常量 ==========

/** localStorage 键 */
const STORAGE_KEY = 'tea-tabs'

/** 首页标签（不可关闭） */
const HOME_TAB: Tab = { key: '/', title: '首页', closable: false }

// ========== 持久化 ==========

/**
 * 从 localStorage 加载标签
 * - 异常或空时返回默认（仅首页）
 * - 始终保证首页存在且不可关闭
 * - 始终保证 activeKey 指向一个存在的标签
 */
function loadFromStorage(): { tabs: Tab[]; activeKey: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        // 去重
        const unique: Tab[] = []
        const seen = new Set<string>()
        for (const t of parsed.tabs) {
          if (t?.key && !seen.has(t.key)) {
            seen.add(t.key)
            unique.push({
              key: t.key,
              title: t.title || t.key,
              closable: t.closable !== false,
            })
          }
        }
        // 保证首页存在
        const hasHome = unique.find((t) => t.key === HOME_TAB.key)
        if (!hasHome) {
          unique.unshift({ ...HOME_TAB })
        } else {
          // 强制首页不可关闭
          const idx = unique.findIndex((t) => t.key === HOME_TAB.key)
          unique[idx] = { ...unique[idx], closable: false }
        }
        // 保证 activeKey 有效
        let activeKey = parsed.activeKey
        if (!unique.find((t) => t.key === activeKey)) {
          activeKey = HOME_TAB.key
        }
        return { tabs: unique, activeKey }
      }
    }
  } catch {
    /* 忽略 */
  }
  return { tabs: [{ ...HOME_TAB }], activeKey: HOME_TAB.key }
}

/**
 * 持久化保存
 */
function saveToStorage(tabs: Tab[], activeKey: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeKey }))
  } catch {
    /* 忽略（quota / private mode） */
  }
}

// ========== Store 定义 ==========

export const useTabsStore = defineStore('tabs', () => {
  // ========== 状态 ==========
  const initial = loadFromStorage()
  const tabs = ref<Tab[]>(initial.tabs)
  const activeKey = ref<string>(initial.activeKey)
  const dragIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)

  // ========== 计算 ==========

  /** 当前激活的标签 */
  const activeTab = computed(() => tabs.value.find((t) => t.key === activeKey.value) || null)

  // ========== Actions ==========

  /**
   * 持久化
   */
  function persist() {
    saveToStorage(tabs.value, activeKey.value)
  }

  /**
   * 添加或激活标签
   * - 已存在则只激活
   * - 不存在则追加并激活
   */
  function addTab(tab: Tab) {
    const exists = tabs.value.find((t) => t.key === tab.key)
    if (exists) {
      activeKey.value = tab.key
    } else {
      tabs.value.push({ key: tab.key, title: tab.title, closable: tab.closable !== false })
      activeKey.value = tab.key
    }
    persist()
  }

  /**
   * 关闭标签
   * - 不可关闭的标签（首页）拒绝
   * - 关闭的是当前激活标签时，自动激活相邻标签
   * - 关闭后无标签时，自动恢复首页
   */
  function removeTab(key: string) {
    const idx = tabs.value.findIndex((t) => t.key === key)
    if (idx === -1) return
    const tab = tabs.value[idx]
    if (tab.closable === false) return

    tabs.value.splice(idx, 1)

    // 兜底：如果全关，恢复首页
    if (tabs.value.length === 0) {
      tabs.value.push({ ...HOME_TAB })
    }

    // 关闭的是当前激活 → 激活相邻
    if (activeKey.value === key) {
      const nextIdx = idx < tabs.value.length ? idx : tabs.value.length - 1
      activeKey.value = tabs.value[nextIdx].key
    }
    persist()
  }

  /**
   * 设置当前激活标签
   */
  function setActiveKey(key: string) {
    if (activeKey.value === key) return
    activeKey.value = key
    persist()
  }

  /**
   * 关闭其他标签（保留不可关闭的）
   */
  function closeOtherTabs(key: string) {
    const target = tabs.value.find((t) => t.key === key)
    if (!target) return
    tabs.value = tabs.value.filter((t) => t.key === key || t.closable === false)
    activeKey.value = key
    persist()
  }

  /**
   * 关闭所有可关闭标签
   */
  function closeAllTabs() {
    tabs.value = tabs.value.filter((t) => t.closable === false)
    if (tabs.value.length > 0) {
      activeKey.value = tabs.value[0].key
    } else {
      tabs.value.push({ ...HOME_TAB })
      activeKey.value = HOME_TAB.key
    }
    persist()
  }

  /**
   * 关闭指定标签左侧的所有可关闭标签
   */
  function closeLeftTabs(key: string) {
    const idx = tabs.value.findIndex((t) => t.key === key)
    if (idx <= 0) return
    let needChangeActive = false
    tabs.value = tabs.value.filter((t, i) => {
      if (i < idx && t.closable !== false) {
        if (t.key === activeKey.value) needChangeActive = true
        return false
      }
      return true
    })
    if (needChangeActive) activeKey.value = key
    persist()
  }

  /**
   * 关闭指定标签右侧的所有可关闭标签
   */
  function closeRightTabs(key: string) {
    const idx = tabs.value.findIndex((t) => t.key === key)
    if (idx === -1 || idx === tabs.value.length - 1) return
    let needChangeActive = false
    tabs.value = tabs.value.filter((t, i) => {
      if (i > idx && t.closable !== false) {
        if (t.key === activeKey.value) needChangeActive = true
        return false
      }
      return true
    })
    if (needChangeActive) activeKey.value = key
    persist()
  }

  /**
   * 拖拽排序
   * @param from 源索引
   * @param to 目标索引
   */
  function moveTab(from: number, to: number) {
    if (from === to) return
    if (from < 0 || from >= tabs.value.length) return
    if (to < 0 || to >= tabs.value.length) return
    const [moved] = tabs.value.splice(from, 1)
    tabs.value.splice(to, 0, moved)
    persist()
  }

  // ========== 拖拽状态 ==========

  function setDragIndex(idx: number | null) {
    dragIndex.value = idx
  }

  function setDragOverIndex(idx: number | null) {
    dragOverIndex.value = idx
  }

  return {
    // 状态
    tabs,
    activeKey,
    activeTab,
    dragIndex,
    dragOverIndex,
    // 操作
    addTab,
    removeTab,
    setActiveKey,
    closeOtherTabs,
    closeAllTabs,
    closeLeftTabs,
    closeRightTabs,
    moveTab,
    setDragIndex,
    setDragOverIndex,
    // 内部（测试用）
    persist,
  }
})
