/**
 * @file 主题与 UI 设置状态
 * @description v0.4.0 - 3 主色 × 2 主题 × 字号/圆角/密度，全部 CSS 变量驱动 + localStorage 持久化
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

// ========== 类型定义 ==========

/** 主题模式 */
export type ThemeMode = 'light' | 'dark'

/** 主色方案 */
export type PrimaryColor = 'gold' | 'bamboo' | 'cinnabar'

/** 字号档位 */
export type FontSize = 'small' | 'standard' | 'large'

/** 圆角档位 */
export type Radius = 'sharp' | 'rounded' | 'full'

/** 密度档位 */
export type Density = 'comfortable' | 'compact'

/** 侧栏宽度（像素） */
export type SiderWidth = 180 | 220 | 240

/** 护眼模式档位 */
export type EyeCare = 'off' | 'mild' | 'moderate' | 'strong'

/** 侧栏风格（v0.5.0 新增） */
export type SidebarStyle = 'dark' | 'light'

/** UI 设置集合 */
export interface UISettings {
  /** 主色 */
  primary: PrimaryColor
  /** 字号 */
  fontSize: FontSize
  /** 圆角 */
  radius: Radius
  /** 密度 */
  density: Density
  /** 侧栏宽度 */
  siderWidth: SiderWidth
  /** 护眼模式 */
  eyeCare: EyeCare
  /** 暖色温 */
  warmTone: boolean
  /** 侧栏风格（v0.5.0 新增） */
  sidebarStyle: SidebarStyle
}

// ========== 常量 ==========

/** 默认 UI 设置 */
const DEFAULTS: UISettings = {
  primary: 'gold',
  fontSize: 'standard',
  radius: 'rounded',
  density: 'comfortable',
  siderWidth: 220,
  eyeCare: 'off',
  warmTone: false,
  sidebarStyle: 'dark',
}

/** localStorage 键 */
const STORAGE_THEME = 'tea-theme'
const STORAGE_UI = 'tea-ui-settings'

// ========== 持久化加载 ==========

/**
 * 从 localStorage 加载主题模式
 * 异常时返回默认值
 */
function loadThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_THEME)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* 忽略 */
  }
  return 'light'
}

/**
 * 从 localStorage 加载 UI 设置
 * 字段合并默认，避免老版本新增字段丢失
 */
function loadUISettings(): UISettings {
  try {
    const saved = localStorage.getItem(STORAGE_UI)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...DEFAULTS, ...parsed }
    }
  } catch {
    /* 忽略 */
  }
  return { ...DEFAULTS }
}

// ========== DOM 应用 ==========

/**
 * 将设置应用到 document.documentElement（内部实现，同步执行）
 * 通过 data-* 属性切换，CSS 选择器自动应用对应变量
 */
function applyToDOMInternal(root: HTMLElement, mode: ThemeMode, settings: UISettings) {
  // 主题
  if (mode === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')

  // 主色
  root.setAttribute('data-primary', settings.primary)

  // 字号
  root.setAttribute('data-font-size', settings.fontSize)

  // 圆角
  root.setAttribute('data-radius', settings.radius)

  // 密度
  root.setAttribute('data-density', settings.density)

  // 护眼 + 暖色温
  if (settings.eyeCare !== 'off') root.setAttribute('data-eye-care', settings.eyeCare)
  else root.removeAttribute('data-eye-care')

  if (settings.warmTone) root.setAttribute('data-warm-tone', 'true')
  else root.removeAttribute('data-warm-tone')

  // 侧栏风格（v0.5.0 新增）
  root.setAttribute('data-sidebar-style', settings.sidebarStyle)

  // 侧栏宽度（直接写 style）
  root.style.setProperty('--tea-sider-width', `${settings.siderWidth}px`)
}

/** v0.5.5 第四轮修复：延迟清理残留遮罩的安全网 */
/* 根因：原逻辑使用 maskEl.closest('.n-drawer') 判断父抽屉是否可见，
   但 Naive UI 的 n-drawer 将 mask 和 drawer 渲染为兄弟节点（同在 .n-drawer-container 内），
   而非父子关系，导致 closest('.n-drawer') 永远返回 null，
   isParentVisible 永远为 false，会错误隐藏正在显示的抽屉的 mask。 */
function cleanupLingeringMasks() {
  if (typeof document === 'undefined') return
  // 查找所有仍可见但不应显示的遮罩元素
  document.querySelectorAll('.n-drawer-mask, .n-modal-mask').forEach(el => {
    const maskEl = el as HTMLElement
    const computed = getComputedStyle(maskEl)
    // 仅处理 opacity 不是 0 的遮罩
    if (parseFloat(computed.opacity) > 0.05) {
      // v0.5.5 第四轮修复：改用 .n-drawer-container 内是否有 .n-drawer 子元素判断
      // Naive UI 的 n-drawer 结构：<div class="n-drawer-container"><div class="n-drawer-mask"/><div class="n-drawer"/></div>
      // 关闭时 drawer 会被 v-if 卸载，但 mask 可能因 transition 中断而残留
      const container = maskEl.closest('.n-drawer-container') || maskEl.parentElement
      let hasVisibleDrawer = false
      let hasVisibleModal = false

      if (container) {
        // 检查同容器内是否有 drawer 元素且可见
        const drawer = container.querySelector('.n-drawer')
        if (drawer) {
          const drawerStyle = getComputedStyle(drawer)
          hasVisibleDrawer =
            drawerStyle.display !== 'none' &&
            drawerStyle.visibility !== 'hidden' &&
            parseFloat(drawerStyle.opacity) > 0.05
        }
      }

      // 检查 modal 容器是否有可见的 modal
      const modalContainer = maskEl.closest('.n-modal-container') || maskEl.closest('.n-modal')
      if (modalContainer) {
        const modalStyle = getComputedStyle(modalContainer)
        hasVisibleModal =
          modalStyle.display !== 'none' &&
          modalStyle.visibility !== 'hidden' &&
          !modalContainer.classList.contains('n-modal-container--hidden')
      }

      if (!hasVisibleDrawer && !hasVisibleModal) {
        maskEl.style.setProperty('opacity', '0', 'important')
        maskEl.style.setProperty('visibility', 'hidden', 'important')
        maskEl.style.setProperty('pointer-events', 'none', 'important')
      }
    }
  })

  // v0.5.5 第四轮修复：清理空的 n-drawer-container / n-modal-container 残留
  // 根因：Naive UI 在抽屉/弹窗关闭过渡期间，可能先卸载内部 .n-drawer/.n-modal，
  //   但 .n-drawer-container/.n-modal-container 延迟卸载。空容器若被 CSS 赋予背景色
  //   （如 [data-theme='dark'] .n-drawer-container），会全屏覆盖造成视觉遮罩残留。
  document.querySelectorAll('.n-drawer-container, .n-modal-container').forEach(el => {
    const container = el as HTMLElement
    // 容器内没有任何子元素（drawer/modal/mask 都已卸载）→ 视为残留
    if (container.children.length === 0) {
      container.style.setProperty('display', 'none', 'important')
      container.style.setProperty('visibility', 'hidden', 'important')
      container.style.setProperty('opacity', '0', 'important')
      container.style.setProperty('pointer-events', 'none', 'important')
    }
  })
}

/**
 * 将设置应用到 document.documentElement（对外接口）
 * v0.5.5 修复：使用双 rAF 延迟执行，避免在抽屉/弹窗关闭的 CSS 过渡期间
 * 触发 <html> 属性变更导致全页样式重算，中断 mask 的 opacity 过渡动画。
 *
 * Naive UI 抽屉/弹窗关闭时使用 fadeInTransition（0.2s opacity 过渡），
 * 如果在此窗口内修改 <html> 的 data-* 属性，浏览器会触发样式重算（recalculate style），
 * 可能导致 transition 被中断/取消，遮罩停留在中间 opacity 状态造成视觉残留。
 *
 * 双 requestAnimationFrame 确保在当前帧渲染完成后再执行属性变更（~32ms 延迟），
 * 远超 fadeInTransition 的 200ms 窗口中的"安全区域"。
 */
function applyToDOM(mode: ThemeMode, settings: UISettings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // 使用双 rAF 延迟：第一 rAF 在当前帧末尾排队，第二 rAF 在下一帧末尾执行
  // 此时任何正在进行的 CSS 过渡要么已完成、要么已被浏览器正确处理
  let scheduled = false
  const doApply = () => {
    applyToDOMInternal(root, mode, settings)
    // 安全网：延迟清理可能因样式重算而卡住的遮罩
    setTimeout(cleanupLingeringMasks, 250)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      doApply()
      scheduled = true
    })
  })

  // 如果 rAF 不支持（极端环境），回退到同步执行
  setTimeout(() => {
    if (!scheduled) {
      doApply()
    }
  }, 100)
}

// ========== Store 定义 ==========

export const useThemeStore = defineStore('theme', () => {
  // ========== 状态 ==========
  const themeMode = ref<ThemeMode>(loadThemeMode())
  const settings = ref<UISettings>(loadUISettings())
  const settingsOpen = ref(false)

  // ========== Actions ==========

  /**
   * 设置主题模式并立即应用
   */
  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
    try {
      localStorage.setItem(STORAGE_THEME, mode)
    } catch {
      /* 忽略 */
    }
    applyToDOM(mode, settings.value)
  }

  /**
   * 切换浅/深主题
   */
  function toggleTheme() {
    setThemeMode(themeMode.value === 'dark' ? 'light' : 'dark')
  }

  /**
   * 部分更新 UI 设置并立即应用
   * @param partial 要更新的字段（未提供的字段保持不变）
   */
  function updateSettings(partial: Partial<UISettings>) {
    settings.value = { ...settings.value, ...partial }
    try {
      localStorage.setItem(STORAGE_UI, JSON.stringify(settings.value))
    } catch {
      /* 忽略 */
    }
    applyToDOM(themeMode.value, settings.value)
  }

  /**
   * 重置 UI 设置为默认
   */
  function resetSettings() {
    settings.value = { ...DEFAULTS }
    try {
      localStorage.removeItem(STORAGE_UI)
    } catch {
      /* 忽略 */
    }
    applyToDOM(themeMode.value, settings.value)
  }

  /**
   * 打开主题设置抽屉
   */
  function openSettings() {
    settingsOpen.value = true
  }

  /**
   * 关闭主题设置抽屉
   */
  function closeSettings() {
    settingsOpen.value = false
  }

  // ========== 初始化时立即应用（避免主题闪烁） ==========
  // 首次加载无抽屉/弹窗过渡，直接同步应用
  if (typeof document !== 'undefined') {
    applyToDOMInternal(document.documentElement, themeMode.value, settings.value)
  }

  return {
    // 状态
    themeMode,
    settings,
    settingsOpen,
    // 操作
    setThemeMode,
    toggleTheme,
    updateSettings,
    resetSettings,
    openSettings,
    closeSettings,
  }
})
