<!--
  @file 主布局
  @description 茶易管 v0.5.0 - 标题栏 + 侧栏 + 内容区，标签↔路由双向同步
  @change v0.5.0 内容区支持双层背景视觉
  @key 防循环：使用 isUpdatingRef 标志位
-->
<template>
  <div class="tea-app-layout">
    <!-- 标题栏 -->
    <TitleBar v-model:collapsed="collapsed" />

    <!-- 主体：侧栏 + 内容 -->
    <div class="tea-app-body">
      <Sidebar v-model:collapsed="collapsed" />
      <main class="tea-app-main">
        <div class="tea-app-content">
          <router-view v-slot="{ Component, route: r }">
            <transition name="tea-fade-in-fast" mode="out-in">
              <component :is="markRaw(Component)" :key="r.path" v-if="Component" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>

    <!-- 主题设置抽屉 -->
    <ThemeSettings />
  </div>
</template>

<script setup lang="ts">
/**
 * AppLayout 组件逻辑
 * - 侧栏折叠状态（local 维护）
 * - 监听路由变化 → 同步到 tabsStore.activeKey
 * - 监听 tabsStore.activeKey → 同步到 router
 * - isUpdatingRef 防止两个监听器互相触发死循环
 */
import { markRaw, ref, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TitleBar from './TitleBar.vue'
import Sidebar from './Sidebar.vue'
import ThemeSettings from './ThemeSettings.vue'
import { useTabsStore } from '@/stores/tabs'
import { menuItems } from './sidebarMenus'

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()

// 侧栏折叠状态（仅本组件维护）
const collapsed = ref(false)

// 防循环标志
let isUpdating = false

// ========== 路由 → 标签 同步 ==========
watch(
  () => route.path,
  (path) => {
    if (isUpdating) {
      isUpdating = false
      return
    }
    // 如果标签 store 中 activeKey 已与 path 一致，跳过
    if (tabsStore.activeKey === path) return
    // 查找对应的菜单项以获取 tabTitle，否则用 path
    const menuItem = menuItems.find((m) => m.key === path)
    const tabTitle = (route.meta?.tabTitle as string) || menuItem?.title || path
    tabsStore.addTab({
      key: path,
      title: tabTitle,
      closable: path !== '/',
    })
  },
  { immediate: true }
)

// ========== 标签 → 路由 同步 ==========
watch(
  () => tabsStore.activeKey,
  (key) => {
    if (key === route.path) return
    isUpdating = true
    router.push(key)
  }
)

// 卸载时清理
onBeforeUnmount(() => {
  isUpdating = false
})
</script>

<style scoped>
.tea-app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* v0.5.5 修复：使用实色背景，避免主题切换时半透明叠加产生"遮罩"视觉效果 */
  background: var(--tea-content-bg-solid);
  transition: background var(--tea-transition-normal);
}

.tea-app-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.tea-app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tea-app-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 20px;
  /* v0.5.5 内容区使用实色背景，避免主题切换时半透明叠加 */
  background: var(--tea-content-bg-solid);
}
</style>
