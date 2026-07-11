<!--
  @file 工作台快捷操作
  @description 茶易管 - 6 个常用功能入口卡片（内容区，外层由 index.vue 用 n-card 包裹）
  @refactor 统一视觉规范：移除 @vicons/ionicons5，图标改用 UnoCSS mdi 字符串（i-mdi-*），
           卡片包裹上移父组件；保留 6 入口配置 / 路由跳转 / hover 抬升等业务逻辑。
-->
<template>
  <div class="quick-actions">
    <div class="quick-actions-grid">
      <div
        v-for="action in actions"
        :key="action.key"
        class="quick-action-card"
        :title="action.title"
        @click="goTo(action.path)"
      >
        <div
          class="quick-action-icon"
          :style="{ background: action.bgColor, color: action.color }"
        >
          <i :class="action.icon" />
        </div>
        <span class="quick-action-label">{{ action.title }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * QuickActions 组件逻辑
 * - 6 个常用功能入口
 * - 点击跳转对应路由
 * - hover 抬升 + 阴影
 */
import { useRouter } from 'vue-router'

const router = useRouter()

interface QuickAction {
  key: string
  title: string
  /** UnoCSS mdi 图标类名，如 'i-mdi-cash-register' */
  icon: string
  color: string
  bgColor: string
  path: string
}

/**
 * 快捷操作配置 - 颜色与各业务主题对应
 * 图标 color 改用 --tea-icon-* 专用色（与同色相浅底背景对比度 ≥ 5:1）
 */
const actions: QuickAction[] = [
  { key: 'sales', title: '零售收银', icon: 'i-mdi-cash-register', color: 'var(--tea-icon-primary)', bgColor: 'var(--tea-primary-supply)', path: '/sales' },
  { key: 'products', title: '商品查询', icon: 'i-mdi-grid', color: 'var(--tea-icon-success)', bgColor: 'var(--tea-accent-success-bg)', path: '/products' },
  { key: 'purchase', title: '采购入库', icon: 'i-mdi-archive-outline', color: 'var(--tea-icon-info)', bgColor: 'var(--tea-accent-info-bg)', path: '/purchase/new' },
  { key: 'members', title: '会员管理', icon: 'i-mdi-account-group-outline', color: 'var(--tea-icon-purple)', bgColor: 'var(--tea-accent-purple-bg)', path: '/members' },
  { key: 'inventory', title: '库存管理', icon: 'i-mdi-cube-outline', color: 'var(--tea-icon-emerald)', bgColor: 'var(--tea-accent-emerald-bg)', path: '/inventory' },
  { key: 'settings', title: '系统设置', icon: 'i-mdi-cog-outline', color: 'var(--tea-icon-gray)', bgColor: 'var(--tea-accent-gray-bg)', path: '/settings' },
]

function goTo(path: string) {
  router.push(path)
}
</script>

<style scoped>
.quick-actions {
  display: flex;
  flex-direction: column;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.quick-action-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--tea-radius-md);
  cursor: pointer;
  background: var(--tea-surface-3);
  border: 1px solid var(--tea-line-1);
  transition: all var(--tea-transition-normal);
  user-select: none;
}

.quick-action-card:hover {
  border-color: var(--tea-primary-supply);
  transform: var(--tea-hover-lift-md);
  box-shadow: var(--tea-shadow-card-hover);
}

.quick-action-card:active {
  transform: translateY(0) scale(0.98);
}

.quick-action-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--tea-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  transition: transform var(--tea-transition-fast);
}

.quick-action-card:hover .quick-action-icon {
  transform: scale(1.05);
}

.quick-action-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--tea-content-1);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 深色模式适配 */
[data-theme='dark'] .quick-action-card {
  background: var(--tea-surface-3) !important;
  border-color: var(--tea-line-1) !important;
}

[data-theme='dark'] .quick-action-card:hover {
  border-color: var(--tea-primary) !important;
  background: var(--tea-surface-hover) !important;
}

[data-theme='dark'] .quick-action-label {
  color: var(--tea-content-1) !important;
}

/* 响应式 */
@media (max-width: 1280px) {
  .quick-actions-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .quick-actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
