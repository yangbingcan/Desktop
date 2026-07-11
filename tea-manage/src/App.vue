<!--
  @file 根组件
  @description v0.4.0 - 使用新的 AppLayout（多标签页 + 侧栏 + 主题）
  @change v0.5.0 支持公开路由（meta.public）跳过 AppLayout
-->
<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <!-- 公开页（登录）不进入 AppLayout -->
      <router-view v-if="isPublicRoute" v-slot="{ Component, route: r }">
        <transition name="tea-fade-in" mode="out-in">
          <component :is="markRaw(Component)" :key="r.path" v-if="Component" />
        </transition>
      </router-view>
      <!-- 业务页：AppLayout 包裹 -->
      <AppLayout v-else />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
/**
 * 根组件逻辑
 * v0.4.0 重构：移除原 n-layout/n-menu/breadcrumb/clock 全部代码
 * 全部职责下放至 AppLayout / TitleBar / Sidebar / TabBar
 * v0.5.0 扩展：识别公开路由（meta.public）跳过 AppLayout
 * v0.5.2 router-view 的 Component 加上 markRaw，修复
 *        [Vue warn] Component that was made reactive
 * v0.5.2 修复：n-config-provider 注入 darkTheme，让 Naive UI
 *        组件（n-button/n-input/n-data-table/n-tag/n-card...）
 *        跟随主题切换深/浅色
 */
import { computed, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useThemeStore } from '@/stores/theme'
import type { PrimaryColor } from '@/stores/theme'

const route = useRoute()
const themeStore = useThemeStore()

/** Naive UI 主题 - 跟随 [data-theme] 切换 */
const naiveTheme = computed(() => {
  return themeStore.themeMode === 'dark' ? darkTheme : null
})

/**
 * 主色方案 → Naive UI 主色派生色
 * gold 即茶叶店默认深茶绿；bamboo/cinnabar 为可选备选主色
 */
const PRIMARY_MAP: Record<PrimaryColor, { color: string; hover: string; pressed: string; suppl: string }> = {
  gold: { color: '#4A6741', hover: '#5C7A50', pressed: '#3C5532', suppl: '#4A6741' },
  bamboo: { color: '#5B8C5A', hover: '#6FA06E', pressed: '#4A7349', suppl: '#5B8C5A' },
  cinnabar: { color: '#B5483F', hover: '#C45A51', pressed: '#9C3A32', suppl: '#B5483F' },
}

/**
 * Naive UI 全局主题覆盖
 * 让所有 Naive 组件（n-button / n-input / n-data-table / n-tag / n-card ...）
 * 跟随茶叶店深茶绿主色 + 规范状态色 + 3px 圆角 + 无衬线字体
 * 浅色/深色模式下均生效（darkTheme 仅提供深浅背景，主色覆盖保持不变）
 */
const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const p = PRIMARY_MAP[themeStore.settings.primary] ?? PRIMARY_MAP.gold
  return {
    common: {
      primaryColor: p.color,
      primaryColorHover: p.hover,
      primaryColorPressed: p.pressed,
      primaryColorSuppl: p.suppl,
      // 状态色 - 规范指定
      successColor: '#67C23A',
      successColorHover: '#85D85A',
      successColorPressed: '#54A82E',
      successColorSuppl: '#67C23A',
      warningColor: '#E6A23C',
      warningColorHover: '#EEB865',
      warningColorPressed: '#CF8C26',
      warningColorSuppl: '#E6A23C',
      errorColor: '#F56C6C',
      errorColorHover: '#F89393',
      errorColorPressed: '#E04C4C',
      errorColorSuppl: '#F56C6C',
      infoColor: '#1677FF',
      // 圆角基础 3px（禁用 12/16px 大圆角）
      borderRadius: '3px',
      // 字体强制无衬线（禁用 Serif）
      fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif",
    },
  }
})

/** 当前路由是否为公开页（不进入 AppLayout） */
const isPublicRoute = computed(() => Boolean(route.meta?.public))
</script>
