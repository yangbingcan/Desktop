<!--
  @file 侧边栏
  @description 茶易管 v0.5.0 - 品牌+搜索+分组菜单+分组激活增强+折叠态 portal 弹窗
  @feature v0.5.0 分组内有激活子项时组标题加发光竖条 + 折叠态点击分组弹窗菜单
-->
<template>
  <aside
    class="tea-sider"
    :class="{ 'tea-sider-collapsed': collapsed }"
  >
    <!-- 品牌区（展开时显示） -->
    <div v-if="!collapsed" class="tea-sider-brand">
      <i class="tea-sider-brand-icon i-mdi-leaf" :style="{ color: brandIconColor }" />
      <span class="tea-sider-brand-name">茶易管</span>
    </div>

    <!-- 搜索框 -->
    <div v-if="!collapsed" class="tea-sider-search">
      <i class="tea-sider-search-icon i-mdi-magnify" />
      <input
        v-model="searchText"
        type="text"
        placeholder="搜索菜单..."
      />
    </div>

    <!-- 菜单列表 -->
    <div class="tea-sider-menu" ref="menuRef">
      <!-- 搜索结果模式 -->
      <template v-if="searchText.trim() && !collapsed">
        <div v-if="searchResults.length === 0" class="tea-sider-empty">
          无匹配菜单
        </div>
        <div
          v-for="item in searchResults"
          :key="item.key"
          class="tea-sider-btn"
          :class="{ 'tea-sider-btn-active': isActive(item.key) }"
          @click="handleMenuClick(item)"
        >
          <i class="tea-sider-btn-icon" :class="item.icon" />
          <span class="tea-sider-btn-label">{{ item.title }}</span>
        </div>
      </template>

      <!-- 分组模式 -->
      <template v-else>
        <div
          v-for="group in menuGroups"
          :key="group.key"
          class="tea-sider-group"
          :class="{ 'tea-sider-group-has-active': hasActiveChild(group.key) }"
          :title="group.title"
          @click="collapsed && handleGroupClick(group, $event)"
        >
          <!-- 折叠态：分组占位图标（v0.5.1 修复"斜杠"问题：原 ::after 虚线方块改为真实图标） -->
          <i
            v-if="collapsed"
            class="tea-sider-group-icon"
            :class="group.groupIcon"
          />

          <!-- 分组标题（展开时） -->
          <div v-if="!collapsed" class="tea-sider-section">
            <span class="tea-sider-section-text">{{ group.title }}</span>
          </div>

          <!-- 菜单项（展开时） -->
          <template v-if="!collapsed">
            <div
              v-for="item in getMenuItemsByGroup(group.key)"
              :key="item.key"
              class="tea-sider-btn"
              :class="{ 'tea-sider-btn-active': isActive(item.key) }"
              @click="handleMenuClick(item)"
            >
              <i class="tea-sider-btn-icon" :class="item.icon" />
              <span class="tea-sider-btn-label">{{ item.title }}</span>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- 折叠态 portal 弹窗（点击分组后浮出） -->
    <teleport to="body">
      <div
        v-if="popupState.show"
        class="tea-sider-popup-mask"
        @click="closePopup"
      />
      <transition name="tea-scale-in">
        <div
          v-if="popupState.show"
          class="tea-sider-popup tea-float-popup"
          :style="{ top: popupState.top + 'px', left: popupState.left + 'px' }"
          @click.stop
        >
          <div class="tea-sider-section">
            <span class="tea-sider-section-text">{{ popupState.groupTitle }}</span>
          </div>
          <div
            v-for="item in popupState.items"
            :key="item.key"
            class="tea-sider-btn"
            :class="{ 'tea-sider-btn-active': isActive(item.key) }"
            @click="handlePopupItemClick(item)"
          >
          <i class="tea-sider-btn-icon" :class="item.icon" />
            <span class="tea-sider-btn-label">{{ item.title }}</span>
          </div>
        </div>
      </transition>
    </teleport>
  </aside>
</template>

<script setup lang="ts">
/**
 * Sidebar 组件逻辑
 * - 菜单分组展示（展开态）
 * - 搜索过滤（展开态）
 * - 分组激活增强：组内有激活子项时组标题加发光竖条
 * - 折叠态：点击分组 → 浮出 portal 弹窗菜单
 * - 弹窗外点击关闭
 */
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTabsStore } from '@/stores/tabs'
import { useThemeStore } from '@/stores/theme'
import { menuItems, menuGroups, getMenuItemsByGroup, type MenuGroup, type MenuItem } from './sidebarMenus'

const props = defineProps<{
  /** 是否折叠 */
  collapsed: boolean
}>()

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()
const themeStore = useThemeStore()

// ========== 状态 ==========
const searchText = ref('')
const menuRef = ref<HTMLElement | null>(null)

// 折叠态浮窗
const popupState = reactive({
  show: false,
  top: 0,
  left: 0,
  groupTitle: '',
  items: [] as MenuItem[],
})

// ========== 计算 ==========

/** 品牌图标颜色 - 跟随主色 */
const brandIconColor = computed(() => {
  const primaryMap: Record<string, string> = {
    gold: '#4A6741',
    bamboo: '#5B8C5A',
    cinnabar: '#B5483F',
  }
  return primaryMap[themeStore.settings.primary] || '#4A6741'
})

/** 搜索过滤结果（不区分大小写，匹配 title） */
const searchResults = computed(() => {
  const kw = searchText.value.trim().toLowerCase()
  if (!kw) return []
  return menuItems.filter((item) => item.title.toLowerCase().includes(kw))
})

/** 判断菜单项是否处于激活路由 */
function isActive(key: string): boolean {
  if (route.path === key) return true
  if (key !== '/' && route.path.startsWith(key + '/')) return true
  return false
}

/** 判断分组内是否有激活的子菜单 */
function hasActiveChild(groupKey: string): boolean {
  return getMenuItemsByGroup(groupKey).some((item) => isActive(item.key))
}

// ========== 菜单点击 ==========

/**
 * 菜单点击 → 打开/激活标签 + 路由跳转
 */
function handleMenuClick(item: MenuItem) {
  tabsStore.addTab({
    key: item.key,
    title: item.title,
    closable: item.key !== '/', // 首页不可关闭
  })
  if (route.path !== item.key) {
    router.push(item.key)
  }
  closePopup()
}

/**
 * 折叠态：点击分组 → 打开 portal 弹窗
 * 计算弹窗位置：分组的右侧 + 4px
 */
function handleGroupClick(group: MenuGroup, e: MouseEvent) {
  if (!props.collapsed) return

  // 复用弹窗（toggle 行为）
  if (popupState.show && popupState.groupTitle === group.title) {
    closePopup()
    return
  }

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  popupState.groupTitle = group.title
  popupState.items = getMenuItemsByGroup(group.key)
  popupState.top = rect.top
  popupState.left = rect.right + 6
  popupState.show = true
}

/** 弹窗中子项点击 */
function handlePopupItemClick(item: MenuItem) {
  handleMenuClick(item)
}

function closePopup() {
  popupState.show = false
}

// ========== 文档点击关闭弹窗 ==========
function handleDocMouseDown(e: MouseEvent) {
  if (!popupState.show) return
  const target = e.target as HTMLElement
  // 弹窗内不关闭
  if (target.closest('.tea-sider-popup')) return
  // 分组按钮上不关闭（让点击事件自身处理 toggle）
  if (target.closest('.tea-sider-group') && props.collapsed) return
  closePopup()
}

// ========== 监听折叠状态：关闭弹窗 ==========
watch(() => props.collapsed, (val) => {
  if (!val) {
    popupState.show = false
  }
})

// ========== 路由变化时清空搜索 + 关闭弹窗 ==========
watch(() => route.path, () => {
  searchText.value = ''
  popupState.show = false
})

onMounted(() => {
  document.addEventListener('mousedown', handleDocMouseDown)
})

onBeforeUnmount(() => {
  popupState.show = false
  document.removeEventListener('mousedown', handleDocMouseDown)
})
</script>

<style scoped>
.tea-sider {
  width: var(--tea-sider-width);
  height: 100%;
  background: var(--tea-sider-bg);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: width var(--tea-transition-normal), background var(--tea-transition-normal);
  position: relative;
}

.tea-sider-collapsed {
  width: var(--tea-sider-collapsed);
}

/* 品牌区 */
.tea-sider-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: var(--tea-brand-height);
  padding: 0 16px;
  border-bottom: 1px solid var(--tea-sider-item-hover);
  color: var(--tea-sider-text);
  flex-shrink: 0;
}

.tea-sider-brand-name {
  font-family: var(--tea-font-family-serif);
  font-size: 18px;
  font-weight: 700;
  color: var(--tea-primary, #4A6741);
  letter-spacing: 4px;
  white-space: nowrap;
  transition: color var(--tea-transition-normal);
}

.tea-sider-brand-icon {
  font-size: 20px;
}

.tea-sider-search-icon {
  font-size: 14px;
  color: var(--tea-sider-text-tertiary);
}

/* 菜单列表 */
.tea-sider-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0 12px;
  scrollbar-width: thin;
}

.tea-sider-group {
  margin-bottom: 4px;
  position: relative;
}

.tea-sider-empty {
  text-align: center;
  padding: 24px 12px;
  color: var(--tea-sider-text-tertiary);
  font-size: 12px;
}

/* 折叠态：分组占位图标（v0.5.1 替换原 ::after 虚线方块） */
.tea-sider-collapsed .tea-sider-group {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  cursor: pointer;
  margin: 4px 8px;
  border-radius: var(--tea-radius-md);
  color: var(--tea-sider-text);
  transition: background var(--tea-transition-fast), color var(--tea-transition-fast);
}

.tea-sider-collapsed .tea-sider-group:hover {
  background: var(--tea-sider-item-hover);
  color: var(--tea-sider-text-active, var(--tea-primary));
}

.tea-sider-group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
}

/* v0.5.1 移除：原 .tea-sider-collapsed .tea-sider-group::after 虚线方块伪元素
   （用户反馈"斜杠图标"实际就是这个 24x24 虚线方块，已替换为真实 icon 组件） */

.tea-sider-btn-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: currentColor;
}

.tea-sider-btn-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 折叠态弹窗遮罩 - v0.5.1 修复点击切换问题：
   让 mask 从侧栏右侧开始覆盖，避免挡住侧栏组按钮 */
.tea-sider-popup-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--tea-sider-collapsed, 64px);
  z-index: 998;
  background: transparent;
}

/* 折叠态弹窗 */
.tea-sider-popup {
  min-width: 180px;
  padding: 6px;
  max-height: 80vh;
  overflow-y: auto;
}

.tea-sider-popup .tea-sider-btn {
  color: var(--tea-text-primary);
}

.tea-sider-popup .tea-sider-btn:hover {
  background: var(--tea-hover-bg, rgba(0, 0, 0, 0.04));
}

/* ==================== 分组激活增强 - v0.5.0 ==================== */

/* 展开态：分组内有激活子项时，分组标题左侧 3px 主色发光竖条 */
.tea-sider:not(.tea-sider-collapsed) .tea-sider-group-has-active > .tea-sider-section {
  position: relative;
}

.tea-sider:not(.tea-sider-collapsed) .tea-sider-group-has-active > .tea-sider-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--tea-primary);
  box-shadow: 0 0 8px var(--tea-primary-supply);
  animation: teaBarIn 0.3s var(--tea-spring);
}

/* 折叠态：分组有激活子项时，分组按钮加发光竖条（v0.5.2 紧贴左边缘） */
.tea-sider-collapsed .tea-sider-group-has-active {
  position: relative;
}

.tea-sider-collapsed .tea-sider-group-has-active::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--tea-primary);
  box-shadow: 0 0 8px var(--tea-primary-supply);
  animation: teaBarIn 0.3s var(--tea-spring);
  z-index: 1;
}

/* 弹窗过渡 */
.tea-scale-in-enter-active {
  transition: opacity 0.2s ease, transform 0.2s var(--tea-spring);
}
.tea-scale-in-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tea-scale-in-enter-from,
.tea-scale-in-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* ==================== v0.5.5 移除树状分组连线 ==================== */
/* 用户反馈：左侧虚线像错位的装饰条，干扰视觉。改为仅保留激活态发光竖条 */
/* 原 tea-sider-group::after dashed 伪元素已移除 */

.tea-sider:not(.tea-sider-collapsed) .tea-sider-group {
  position: relative;
}

/* v0.5.5 保留：激活态分组标题竖条（精确定位到标题中心） */
.tea-sider:not(.tea-sider-collapsed) .tea-sider-group-has-active > .tea-sider-section {
  position: relative;
}

.tea-sider:not(.tea-sider-collapsed) .tea-sider-group-has-active > .tea-sider-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 25%;
  bottom: 25%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--tea-primary);
  box-shadow: 0 0 8px var(--tea-primary-supply);
  animation: teaBarIn 0.3s var(--tea-spring);
}
</style>
