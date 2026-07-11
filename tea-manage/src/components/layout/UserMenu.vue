<!--
  @file 用户菜单
  @description 标题栏右侧：主题切换 / 设置入口 / 占位通知 / 用户下拉
-->
<template>
  <div class="tea-user-menu">
    <!-- 主题切换 -->
    <div
      class="tea-titlebar-icon-btn"
      :title="themeMode === 'dark' ? '切换浅色' : '切换深色'"
      @click="toggleTheme"
    >
      <i class="tea-user-icon" :class="themeMode === 'dark' ? 'i-mdi-weather-sunny' : 'i-mdi-weather-night'" />
    </div>

    <!-- 主题设置 -->
    <div
      class="tea-titlebar-icon-btn"
      title="主题设置"
      @click="openSettings"
    >
      <i class="tea-user-icon i-mdi-cog-outline" />
    </div>

    <!-- 通知（占位） -->
    <n-tooltip>
      <template #trigger>
        <div class="tea-titlebar-icon-btn" title="暂无新通知">
          <i class="tea-user-icon i-mdi-bell-outline" />
        </div>
      </template>
      暂无新通知
    </n-tooltip>

    <!-- 用户下拉 -->
    <n-dropdown
      placement="bottom-end"
      trigger="click"
      :options="userOptions"
      @select="handleSelect"
    >
      <div class="tea-user-menu-trigger">
        <div class="tea-user-avatar">茶</div>
        <span class="tea-user-name">茶馆主</span>
      </div>
    </n-dropdown>
  </div>
</template>

<script setup lang="ts">
/**
 * UserMenu 组件逻辑
 * - 主题切换：useThemeStore.toggleTheme
 * - 设置：useThemeStore.openSettings
 * - 用户下拉：仅占位
 */
import { computed, h } from 'vue'
import { NTooltip, NDropdown, type DropdownOption } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const themeMode = computed(() => themeStore.themeMode)
const toggleTheme = () => themeStore.toggleTheme()
const openSettings = () => themeStore.openSettings()

/** 下拉菜单项 */
const userOptions = computed<DropdownOption[]>(() => [
  {
    key: 'profile',
    label: '个人信息（开发中）',
    icon: () => h('i', { class: 'i-mdi-account-circle' }),
    disabled: true,
  },
  { type: 'divider', key: 'd1' },
  {
    key: 'logout',
    label: '退出登录（开发中）',
    icon: () => h('i', { class: 'i-mdi-logout' }),
    disabled: true,
  },
])

/** 选择下拉项（目前都是 disabled） */
function handleSelect(_key: string | number) {
  /* noop */
}
</script>

<style scoped>
.tea-user-menu {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  flex-shrink: 0;
}

.tea-user-menu-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 8px 0 4px;
  border-radius: var(--tea-radius-md);
  cursor: pointer;
  color: var(--tea-titlebar-text);
  transition: background var(--tea-transition-fast);
}

.tea-user-menu-trigger:hover {
  background: var(--tea-primary-supply);
}

.tea-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4A6741, #3C5532);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(74, 103, 65, 0.3);
}

.tea-user-icon {
  font-size: 16px;
}

.tea-user-name {
  font-size: 13px;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .tea-user-name {
    display: none;
  }
}
</style>
