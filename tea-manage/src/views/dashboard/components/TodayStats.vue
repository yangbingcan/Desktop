<!--
  @file 工作台今日数据
  @description 茶易管 - 4 张数据卡片（演示数据 + 趋势指示）（内容区，外层由 index.vue 用 n-card 包裹）
  @refactor 统一视觉规范：移除 @vicons/ionicons5，图标改用 UnoCSS mdi 字符串（i-mdi-*）；
           趋势标签改用 n-tag type；金额统一 toFixed(2) + font-mono；卡片包裹上移父组件。
-->
<template>
  <div class="today-stats">
    <div class="today-stats-grid">
      <div
        v-for="stat in stats"
        :key="stat.key"
        class="today-stat-card"
      >
        <div class="today-stat-icon" :style="{ color: stat.color, background: stat.bgColor }">
          <i :class="stat.icon" />
        </div>
        <div class="today-stat-info">
          <div class="today-stat-value font-mono">{{ stat.value }}</div>
          <div class="today-stat-label">{{ stat.label }}</div>
        </div>
        <n-tag
          v-if="stat.trend"
          size="small"
          :bordered="false"
          :type="stat.trendType === 'up' ? 'success' : 'warning'"
          class="today-stat-trend"
        >
          {{ stat.trend }}
        </n-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TodayStats 组件逻辑
 * - 4 个数据卡片：今日订单/今日销售额/库存预警/新增会员
 * - Mock 数据（带趋势指示）
 * - 实际项目替换为 API 数据
 */
import { NTag } from 'naive-ui'

interface StatItem {
  key: string
  label: string
  value: string
  /** UnoCSS mdi 图标类名，如 'i-mdi-receipt' */
  icon: string
  color: string
  bgColor: string
  trend: string
  trendType: 'up' | 'down'
}

/** 金额格式化：保留两位小数 + 千分位 */
function formatMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Mock 演示数据 - 实际项目替换为 API
 * 图标 color 改用 --tea-icon-* 专用色（与同色相浅底背景对比度 ≥ 5:1）
 * 今日销售额金额为真实金额，统一 toFixed(2) + font-mono
 */
const stats: StatItem[] = [
  { key: 'orders', label: '今日订单', value: '128', icon: 'i-mdi-receipt', color: 'var(--tea-icon-primary)', bgColor: 'var(--tea-primary-supply)', trend: '+12%', trendType: 'up' },
  { key: 'sales', label: '今日销售额', value: formatMoney(3580), icon: 'i-mdi-wallet', color: 'var(--tea-icon-emerald)', bgColor: 'var(--tea-accent-emerald-bg)', trend: '+8.5%', trendType: 'up' },
  { key: 'lowstock', label: '库存预警', value: '3', icon: 'i-mdi-alert', color: 'var(--tea-icon-warning)', bgColor: 'var(--tea-accent-warning-bg)', trend: '-2', trendType: 'down' },
  { key: 'members', label: '新增会员', value: '5', icon: 'i-mdi-account-group-outline', color: 'var(--tea-icon-purple)', bgColor: 'var(--tea-accent-purple-bg)', trend: '+3', trendType: 'up' },
]
</script>

<style scoped>
.today-stats {
  display: flex;
  flex-direction: column;
}

.today-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.today-stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--tea-radius-md);
  position: relative;
  background: var(--tea-surface-3);
  border: 1px solid var(--tea-line-1);
  transition: all var(--tea-transition-normal);
}

.today-stat-card:hover {
  border-color: var(--tea-primary-supply);
  transform: var(--tea-hover-lift-md);
  box-shadow: var(--tea-shadow-card-hover);
}

.today-stat-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--tea-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22px;
  transition: transform var(--tea-transition-fast);
}

.today-stat-card:hover .today-stat-icon {
  transform: scale(1.05);
}

.today-stat-info {
  flex: 1;
  min-width: 0;
}

.today-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tea-content-1);
  font-family: var(--tea-font-family-serif);
  line-height: 1.1;
  letter-spacing: -0.3px;
}

.today-stat-label {
  font-size: 11px;
  color: var(--tea-content-3);
  margin-top: 2px;
}

.today-stat-trend {
  position: absolute;
  top: 8px;
  right: 8px;
}

/* 深色模式适配 */
[data-theme='dark'] .today-stat-card {
  background: var(--tea-surface-3) !important;
  border-color: var(--tea-line-1) !important;
}

[data-theme='dark'] .today-stat-card:hover {
  border-color: var(--tea-primary) !important;
  background: var(--tea-surface-hover) !important;
}

[data-theme='dark'] .today-stat-value,
[data-theme='dark'] .today-stats-title {
  color: var(--tea-content-1) !important;
}

[data-theme='dark'] .today-stat-label {
  color: var(--tea-content-3) !important;
}

@media (max-width: 1280px) {
  .today-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
