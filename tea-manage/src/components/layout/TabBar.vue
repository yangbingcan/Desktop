<!--
  @file 多标签页栏
  @description v0.4.0 核心组件 - 浏览器式多任务标签
  @feature 开关/激活/双击关闭/右键菜单/拖拽排序/横向滚动+遮罩
-->
<template>
  <div class="tea-tab-bar">
    <!-- 左侧渐变遮罩 -->
    <div class="tea-mask-left" :class="{ 'tea-mask-visible': showLeftMask }" />

    <!-- 左滚动按钮 -->
    <div
      v-if="showLeftMask"
      class="tea-tab-bar-scroll-btn"
      @click="scrollBy(-200)"
    >
      <i class="i-mdi-chevron-left tea-tab-scroll-icon" />
    </div>

    <!-- 标签滚动容器 -->
    <div
      ref="scrollRef"
      class="tea-tab-bar-scroll"
      @wheel.passive="handleWheel"
      @scroll="checkOverflow"
    >
      <div
        v-for="(tab, idx) in tabs"
        :key="tab.key"
        class="tea-tab"
        :class="{
          'tea-tab-active': activeKey === tab.key,
          'tea-tab-drag-over': dragOverIndex === idx && dragIndex !== null && dragIndex !== idx,
        }"
        :style="{ opacity: dragIndex === idx ? 0.4 : 1 }"
        draggable="true"
        @click="handleClick(tab)"
        @auxclick.middle="handleMiddleClick(tab)"
        @dblclick="handleDoubleClick(tab)"
        @contextmenu.prevent="handleContextMenu($event, tab, idx)"
        @dragstart="handleDragStart($event, idx)"
        @dragover.prevent="handleDragOver($event, idx)"
        @drop.prevent="handleDrop($event, idx)"
        @dragend="handleDragEnd"
      >
        <span class="tea-tab-title">{{ tab.title }}</span>
        <span
          v-if="tab.closable"
          class="tea-tab-close"
          @click.stop="handleClose(tab)"
          title="关闭"
        >
          <i class="i-mdi-close tea-tab-close-icon" />
        </span>
      </div>
    </div>

    <!-- 右滚动按钮 -->
    <div
      v-if="showRightMask"
      class="tea-tab-bar-scroll-btn"
      @click="scrollBy(200)"
    >
      <i class="i-mdi-chevron-right tea-tab-scroll-icon" />
    </div>

    <!-- 右侧渐变遮罩 -->
    <div class="tea-mask-right" :class="{ 'tea-mask-visible': showRightMask }" />

    <!-- 右键菜单 -->
    <n-dropdown
      placement="bottom-start"
      trigger="manual"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="contextMenuOptions"
      :show="contextMenu.show"
      @clickoutside="contextMenu.show = false"
      @select="handleContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * TabBar 组件逻辑
 * - 通过 useTabsStore 读取/操作标签
 * - 点击 → 激活并跳转
 * - 关闭 → 标签 store.removeTab（store 内部已处理激活态切换）
 * - 拖拽 → store.moveTab
 * - 滚动 → DOM 原生 scrollBy
 */
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { NDropdown, type DropdownOption } from 'naive-ui'
import { useTabsStore, type Tab } from '@/stores/tabs'

const router = useRouter()
const tabsStore = useTabsStore()

const tabs = computed(() => tabsStore.tabs)
const activeKey = computed(() => tabsStore.activeKey)
const dragIndex = computed(() => tabsStore.dragIndex)
const dragOverIndex = computed(() => tabsStore.dragOverIndex)

// ========== 滚动溢出检测 ==========
const scrollRef = ref<HTMLElement | null>(null)
const showLeftMask = ref(false)
const showRightMask = ref(false)

/**
 * 检查标签栏是否溢出，更新左右遮罩和滚动按钮状态
 */
function checkOverflow() {
  const el = scrollRef.value
  if (!el) return
  const overflow = el.scrollWidth > el.clientWidth + 2
  if (!overflow) {
    showLeftMask.value = false
    showRightMask.value = false
    return
  }
  showLeftMask.value = el.scrollLeft > 2
  showRightMask.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 2
}

/**
 * 横向滚动
 */
function scrollBy(dx: number) {
  const el = scrollRef.value
  if (!el) return
  el.scrollBy({ left: dx, behavior: 'smooth' })
}

/**
 * 鼠标滚轮转为横向滚动
 */
function handleWheel(e: WheelEvent) {
  const el = scrollRef.value
  if (!el) return
  if (e.deltaY === 0 && e.deltaX === 0) return
  // 仅在垂直滚动时转为横向
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    el.scrollBy({ left: e.deltaY, behavior: 'auto' })
  }
}

// ========== 标签操作 ==========

/**
 * 点击标签 → 激活并跳转
 */
function handleClick(tab: Tab) {
  if (activeKey.value === tab.key) return
  tabsStore.setActiveKey(tab.key)
  router.push(tab.key)
}

/**
 * 双击标签 → 关闭（首页除外，由 store 内部保护）
 */
function handleDoubleClick(tab: Tab) {
  tabsStore.removeTab(tab.key)
}

/**
 * 鼠标中键点击 → 关闭
 */
function handleMiddleClick(tab: Tab) {
  tabsStore.removeTab(tab.key)
}

/**
 * 关闭按钮点击
 */
function handleClose(tab: Tab) {
  tabsStore.removeTab(tab.key)
}

// ========== 拖拽 ==========

function handleDragStart(e: DragEvent, idx: number) {
  if (!e.dataTransfer) return
  tabsStore.setDragIndex(idx)
  e.dataTransfer.effectAllowed = 'move'
  // 必须 setData 才能在 Firefox 触发 dragover
  e.dataTransfer.setData('text/plain', String(idx))
}

function handleDragOver(e: DragEvent, idx: number) {
  if (!e.dataTransfer) return
  e.dataTransfer.dropEffect = 'move'
  if (dragOverIndex.value !== idx) {
    tabsStore.setDragOverIndex(idx)
  }
}

function handleDrop(_e: DragEvent, idx: number) {
  const from = tabsStore.dragIndex
  if (from !== null && from !== idx) {
    tabsStore.moveTab(from, idx)
  }
  tabsStore.setDragIndex(null)
  tabsStore.setDragOverIndex(null)
}

function handleDragEnd() {
  tabsStore.setDragIndex(null)
  tabsStore.setDragOverIndex(null)
}

// ========== 右键菜单 ==========
const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  tab: null as Tab | null,
  idx: -1,
})

const contextMenuOptions = computed<DropdownOption[]>(() => {
  const items: DropdownOption[] = []
  const tab = contextMenu.tab
  const idx = contextMenu.idx
  if (!tab) return items

  if (tab.closable) {
    items.push({ key: 'close', label: '关闭', icon: () => h('i', { class: 'i-mdi-close' }) })
  }
  if (tabs.value.length > 1) {
    items.push({ key: 'closeOthers', label: '关闭其他' })
    items.push({ key: 'closeAll', label: '关闭所有' })
  }
  if (idx > 0) {
    items.push({ key: 'closeLeft', label: '关闭左侧' })
  }
  if (idx < tabs.value.length - 1) {
    items.push({ key: 'closeRight', label: '关闭右侧' })
  }
  return items
})

function handleContextMenu(e: MouseEvent, tab: Tab, idx: number) {
  contextMenu.show = false
  contextMenu.tab = tab
  contextMenu.idx = idx
  contextMenu.x = e.clientX
  contextMenu.y = e.clientY
  nextTick(() => {
    contextMenu.show = true
  })
}

function handleContextMenuSelect(key: string | number) {
  const tab = contextMenu.tab
  if (!tab) return
  switch (key) {
    case 'close':
      tabsStore.removeTab(tab.key)
      break
    case 'closeOthers':
      tabsStore.closeOtherTabs(tab.key)
      break
    case 'closeAll':
      tabsStore.closeAllTabs()
      break
    case 'closeLeft':
      tabsStore.closeLeftTabs(tab.key)
      break
    case 'closeRight':
      tabsStore.closeRightTabs(tab.key)
      break
  }
  contextMenu.show = false
}

// ========== 生命周期 ==========

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // 初始检测
  setTimeout(checkOverflow, 50)
  // 窗口 resize 时重检
  window.addEventListener('resize', checkOverflow)
  // 容器尺寸变化时重检
  if (scrollRef.value) {
    resizeObserver = new ResizeObserver(() => checkOverflow())
    resizeObserver.observe(scrollRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkOverflow)
  resizeObserver?.disconnect()
})

// 引入 h 用于 n-icon 渲染
import { h } from 'vue'
</script>

<style scoped>
.tea-tab-bar {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.tea-tab-bar-scroll {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0 8px;
  gap: 4px;
}

.tea-tab-bar-scroll::-webkit-scrollbar {
  display: none;
}

.tea-tab-bar-scroll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 100%;
  cursor: pointer;
  color: var(--tea-text-tertiary);
  flex-shrink: 0;
  transition: color var(--tea-transition-fast), background var(--tea-transition-fast);
  z-index: 6;
  border-radius: var(--tea-radius-sm);
}

.tea-tab-bar-scroll-btn:hover {
  color: var(--tea-primary);
  background: var(--tea-primary-supply);
}

.tea-tab-scroll-icon {
  font-size: 12px;
}

.tea-tab-close-icon {
  font-size: 10px;
}
</style>
