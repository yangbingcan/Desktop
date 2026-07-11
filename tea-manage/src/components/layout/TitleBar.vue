<!--
  @file 标题栏
  @description 茶易管 v0.5.5 - 融入应用的标题栏：折叠 + TabBar + 用户菜单 + 自实现窗口控制按钮
  @change
    - v0.5.0 移除品牌区，添加毛玻璃
    - v0.5.5 关闭原生装饰，自实现最小化/最大化/关闭按钮，整个标题栏可拖拽移动窗口
-->
<template>
  <header
    class="tea-titlebar"
    data-tauri-drag-region
  >
    <!-- 左侧：折叠按钮 -->
    <div class="tea-titlebar-left" data-tauri-drag-region>
      <div
        class="tea-titlebar-icon-btn"
        :title="collapsed ? '展开菜单' : '折叠菜单'"
        @click="emit('update:collapsed', !collapsed)"
      >
        <i class="i-mdi-menu tea-titlebar-collapse-icon" />
      </div>
    </div>

    <!-- 中部：标签栏（可拖拽） -->
    <div class="tea-titlebar-center" data-tauri-drag-region>
      <TabBar />
    </div>

    <!-- 右侧：用户菜单 -->
    <div class="tea-titlebar-right">
      <UserMenu />
    </div>

    <!-- 最右侧：窗口控制按钮（v0.5.5 自实现） -->
    <div class="tea-titlebar-window-controls">
      <button
        class="tea-window-btn tea-window-btn--min"
        type="button"
        title="最小化"
        aria-label="最小化"
        @click="handleMinimize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="1.5" y="5.5" width="9" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        class="tea-window-btn tea-window-btn--max"
        type="button"
        :title="isMaximized ? '向下还原' : '最大化'"
        :aria-label="isMaximized ? '向下还原' : '最大化'"
        @click="handleToggleMaximize"
      >
        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="1.5" y="3.5" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none" />
          <path d="M3.5 3.5 V1.5 H10.5 V8.5 H8.5" stroke="currentColor" stroke-width="1" fill="none" />
        </svg>
      </button>
      <button
        class="tea-window-btn tea-window-btn--close"
        type="button"
        title="关闭"
        aria-label="关闭"
        @click="handleClose"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * TitleBar 组件逻辑
 * - v0.5.5 自实现窗口控制：通过 @tauri-apps/api/window 调用
 *   - minimize() 最小化
 *   - toggleMaximize() 最大化/还原
 *   - close() 关闭
 * - 整个标题栏使用 data-tauri-drag-region 实现窗口拖拽
 * - 监听 onResized 同步最大化状态
 * - Web 环境下（非 Tauri）API 调用会被静默忽略，不影响开发预览
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import TabBar from './TabBar.vue'
import UserMenu from './UserMenu.vue'

defineProps<{
  /** 侧边栏是否折叠 */
  collapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
}>()

// 窗口最大化状态
const isMaximized = ref(false)

// Tauri 窗口实例（在非 Tauri 环境下为 null）
let appWindow: any = null
let unlistenResized: (() => void) | null = null

onMounted(async () => {
  // 仅在 Tauri 环境下加载窗口 API
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      appWindow = getCurrentWindow()
      // 初始同步最大化状态
      isMaximized.value = await appWindow.isMaximized()
      // 监听窗口大小变化，同步最大化状态
      unlistenResized = await appWindow.onResized(async () => {
        try {
          isMaximized.value = await appWindow.isMaximized()
        } catch {
          /* 忽略查询失败 */
        }
      })
    } catch (err) {
      // Tauri API 加载失败时静默降级（开发预览模式）
      console.warn('[TitleBar] Tauri window API unavailable:', err)
    }
  }
})

onBeforeUnmount(() => {
  if (unlistenResized) {
    unlistenResized()
    unlistenResized = null
  }
})

/** 最小化窗口 */
async function handleMinimize() {
  if (!appWindow) return
  try {
    await appWindow.minimize()
  } catch (err) {
    console.error('[TitleBar] minimize failed:', err)
  }
}

/** 切换最大化/还原 */
async function handleToggleMaximize() {
  if (!appWindow) return
  try {
    await appWindow.toggleMaximize()
    // 立即同步状态（onResized 也会触发，这里只是为了响应即时反馈）
    isMaximized.value = await appWindow.isMaximized()
  } catch (err) {
    console.error('[TitleBar] toggleMaximize failed:', err)
  }
}

/** 关闭窗口 */
async function handleClose() {
  if (!appWindow) return
  try {
    await appWindow.close()
  } catch (err) {
    console.error('[TitleBar] close failed:', err)
  }
}
</script>

<style scoped>
.tea-titlebar {
  height: var(--tea-titlebar-height);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  /* v0.5.5 融入应用：使用实色背景 + 装饰边框，去除独立长条感 */
  background: var(--tea-content-bg-solid);
  border-bottom: 1px solid var(--tea-border);
  user-select: none;
  position: relative;
  z-index: 10;
  transition:
    background var(--tea-transition-normal),
    border-color var(--tea-transition-normal);
}

.tea-titlebar-left {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px 0 8px;
  flex-shrink: 0;
}

.tea-titlebar-collapse-icon {
  font-size: 18px;
}

.tea-titlebar-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.tea-titlebar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* ==================== v0.5.5 窗口控制按钮 ==================== */
/* 仿 macOS/Windows 风格的简洁按钮，融入标题栏，深浅色自适应 */
.tea-titlebar-window-controls {
  display: flex;
  align-items: center;
  height: 100%;
  flex-shrink: 0;
  margin-left: 4px;
  padding: 0 4px;
  gap: 2px;
}

.tea-window-btn {
  width: 36px;
  height: 100%;
  min-height: 32px;
  border: none;
  background: transparent;
  color: var(--tea-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--tea-transition-fast), color var(--tea-transition-fast);
  -webkit-app-region: no-drag;
  outline: none;
  padding: 0;
}

.tea-window-btn:hover {
  background: var(--tea-hover-bg);
  color: var(--tea-text-primary);
}

.tea-window-btn:active {
  background: var(--tea-border-strong);
}

/* 最小化按钮：浅 hover */
.tea-window-btn--min:hover {
  background: var(--tea-hover-bg);
  color: var(--tea-text-primary);
}

/* 最大化按钮：主色 hover */
.tea-window-btn--max:hover {
  background: var(--tea-primary-supply);
  color: var(--tea-primary);
}

/* 关闭按钮：红色 hover，凸显危险操作 */
.tea-window-btn--close:hover {
  background: #E8412A;
  color: #FFFFFF;
}

.tea-window-btn--close:active {
  background: #C7311E;
  color: #FFFFFF;
}

/* ==================== 深色模式适配 ==================== */
:global([data-theme='dark']) .tea-titlebar {
  background: var(--tea-content-bg-solid);
  border-bottom-color: var(--tea-border);
}

:global([data-theme='dark']) .tea-window-btn {
  color: var(--tea-text-secondary);
}

:global([data-theme='dark']) .tea-window-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--tea-text-primary);
}

:global([data-theme='dark']) .tea-window-btn--max:hover {
  background: var(--tea-primary-supply);
  color: var(--tea-primary);
}

:global([data-theme='dark']) .tea-window-btn--close:hover {
  background: #E8412A;
  color: #FFFFFF;
}
</style>
