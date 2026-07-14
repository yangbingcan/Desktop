<!--
  @file 工作台今日数据
  @description 茶易管 - 4 张数据卡片（今日订单/今日销售额/库存预警/新增会员），拉取真实经营指标
  @refactor 统一视觉规范：图标改用 UnoCSS mdi 字符串（i-mdi-*）；
           金额统一 toFixed(2) + font-mono；卡片包裹上移父组件（index.vue 用 n-card）。
  @change 移除 Mock 趋势标签，改为调用 get_dashboard_stats 获取真实数据，加载态使用 NSpin。
-->
<template>
  <div class="today-stats">
    <div v-if="loading" class="today-stats-loading">
      <n-spin size="small" />
      <span class="text-[12px] text-[var(--tea-content-3)]">加载中…</span>
    </div>
    <template v-else>
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
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * TodayStats 组件逻辑
 * - 4 个数据卡片：今日订单/今日销售额/库存预警/新增会员
 * - 真实数据：调用 get_dashboard_stats（后端按本地日期统计）
 * - 加载态：NSpin；失败静默回退为空（不展示伪数据）
 */
import { onMounted, ref } from 'vue'
import { NSpin } from 'naive-ui'
import { getDashboardStats } from '@/api/sales'
import type { DashboardStats } from '@/types'

interface StatItem {
  key: string
  label: string
  value: string
  /** UnoCSS mdi 图标类名，如 'i-mdi-receipt' */
  icon: string
  color: string
  bgColor: string
}

/** 金额格式化：保留两位小数 + 千分位 */
function formatMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const loading = ref(true)
const stats = ref<StatItem[]>([])

async function loadStats() {
  loading.value = true
  try {
    const data: DashboardStats = await getDashboardStats()
    stats.value = [
      { key: 'orders', label: '今日订单', value: String(data.todayOrders), icon: 'i-mdi-receipt', color: 'var(--tea-icon-primary)', bgColor: 'var(--tea-primary-supply)' },
      { key: 'sales', label: '今日销售额', value: formatMoney(data.todaySales), icon: 'i-mdi-wallet', color: 'var(--tea-icon-emerald)', bgColor: 'var(--tea-accent-emerald-bg)' },
      { key: 'lowstock', label: '库存预警', value: String(data.lowStockCount), icon: 'i-mdi-alert', color: 'var(--tea-icon-warning)', bgColor: 'var(--tea-accent-warning-bg)' },
      { key: 'members', label: '新增会员', value: String(data.newMembers), icon: 'i-mdi-account-group-outline', color: 'var(--tea-icon-purple)', bgColor: 'var(--tea-accent-purple-bg)' },
    ]
  } catch (e) {
    // 失败时不展示任何伪数据，仅打印错误便于排查
    stats.value = []
    console.error('[TodayStats] 加载首页概览失败:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
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
