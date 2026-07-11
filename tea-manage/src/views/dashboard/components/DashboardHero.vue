<!--
  @file 工作台 Hero 区
  @description 茶易管 - 渐变背景 + 时段问候 + 快捷入口
  @refactor 统一视觉规范：移除 @vicons/ionicons5，图标改用 UnoCSS mdi（i-mdi-*），
           保留时段问候 / 用户名 / 日期 / 天气 / 系统设置跳转等业务逻辑。
-->
<template>
  <div class="dashboard-hero tea-fade-in">
    <div class="dashboard-hero-bg" />
    <div class="dashboard-hero-content">
      <div class="dashboard-hero-left">
        <div class="dashboard-hero-greeting-row">
          <h1 class="dashboard-hero-greeting">
            {{ greeting }}，{{ userName }}
          </h1>
        </div>
        <p class="dashboard-hero-subtitle">
          {{ subtitle }}
        </p>
        <div class="dashboard-hero-meta">
          <span class="dashboard-hero-meta-item">
            <i class="i-mdi-calendar align-middle text-[14px]" />
            <span>{{ todayDate }}</span>
          </span>
          <span class="dashboard-hero-meta-item">
            <i class="i-mdi-information align-middle text-[14px]" />
            <span>{{ weather }}</span>
          </span>
        </div>
      </div>
      <div class="dashboard-hero-right">
        <div
          class="dashboard-hero-btn"
          @click="goSettings"
        >
          <i class="i-mdi-cog-outline align-middle text-[16px]" />
          <span>系统设置</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DashboardHero 组件逻辑
 * - 计算时段问候（早/午/晚/夜深）
 * - 显示用户名称"茶馆主"（占位）
 * - 显示今日日期与天气（占位）
 * - 系统设置按钮（毛玻璃 + 跳转 /settings）
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

/**
 * 时段问候
 * - 0-5  夜深了
 * - 6-11 早上好
 * - 12-13 中午好
 * - 14-17 下午好
 * - 18-23 晚上好
 */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const userName = '茶馆主'

const subtitle = '欢迎使用茶易管，今天也是元气满满的一天'

/** 今日日期 - 格式 yyyy年M月d日 星期X */
const todayDate = computed(() => {
  const now = new Date()
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
})

/** 天气（占位，后续接 API） */
const weather = '晴 24°C'

/** 跳转设置 */
function goSettings() {
  router.push('/settings')
}
</script>

<style scoped>
.dashboard-hero {
  position: relative;
  border-radius: var(--tea-radius-xl);
  padding: 18px 22px;
  overflow: hidden;
  min-height: 110px;
  display: flex;
  align-items: center;
  box-shadow: var(--tea-hero-shadow, 0 12px 36px rgba(196, 149, 106, 0.25));
  isolation: isolate;
}

.dashboard-hero-bg {
  position: absolute;
  inset: 0;
  background: var(--tea-hero-gradient);
  z-index: -2;
}

/* 右上角装饰光晕（脉冲呼吸） */
.dashboard-hero-bg::after {
  content: '';
  position: absolute;
  top: -60px;
  right: -60px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, transparent 70%);
  border-radius: 50%;
  animation: teaPulseGlow 4s ease-in-out infinite;
}

/* 左下角小光晕（错落感） */
.dashboard-hero-bg::before {
  content: '';
  position: absolute;
  bottom: -80px;
  left: -40px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.13) 0%, transparent 70%);
  border-radius: 50%;
  animation: teaPulseGlow 5s ease-in-out infinite;
  animation-delay: 1.5s;
}

.dashboard-hero-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  position: relative;
  z-index: 1;
  gap: 16px;
}

.dashboard-hero-left {
  flex: 1;
  min-width: 0;
}

.dashboard-hero-greeting-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.dashboard-hero-greeting {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.dashboard-hero-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  margin: 0 0 10px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.dashboard-hero-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.dashboard-hero-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.88);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.dashboard-hero-right {
  flex-shrink: 0;
}

.dashboard-hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: var(--tea-radius-md);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: all var(--tea-transition-fast);
}

.dashboard-hero-btn:hover {
  background: rgba(255, 255, 255, 0.32);
  border-color: rgba(255, 255, 255, 0.5);
  transform: var(--tea-hover-lift-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dashboard-hero-btn:active {
  transform: scale(0.97);
}

/* 响应式 */
@media (max-width: 640px) {
  .dashboard-hero {
    padding: 16px 18px;
  }
  .dashboard-hero-greeting {
    font-size: 18px;
  }
  .dashboard-hero-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
