<!--
  @file 首页/工作台
  @description 茶易管 - Hero 欢迎区 + 快捷操作 + 今日概览 + 演示数据管理
  @refactor 统一视觉规范：根节点 tea-page p-md；功能区块用 n-card 包裹；
           双栏布局改用 n-grid；图标全部改用 UnoCSS mdi；保留演示数据生成/清空逻辑。
-->
<template>
  <div class="tea-page p-md">
    <n-space vertical :size="16">
      <!-- 顶部 Hero 欢迎区 -->
      <DashboardHero />

      <!-- 快捷操作 + 今日概览 双栏 -->
      <n-grid :x-gap="12" :y-gap="12" cols="2 960:1" responsive="screen" item-responsive>
        <n-gi>
          <n-card :bordered="false">
            <template #header>
              <div class="flex items-center gap-2">
                <i class="i-mdi-grid align-middle text-[15px] text-tea-primary" />
                <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">快捷操作</span>
              </div>
            </template>
            <template #header-extra>
              <span class="text-[12px] text-[var(--tea-content-3)]">常用功能直达</span>
            </template>
            <QuickActions />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card :bordered="false">
            <template #header>
              <div class="flex items-center gap-2">
                <i class="i-mdi-chart-line align-middle text-[15px] text-tea-primary" />
                <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">今日概览</span>
              </div>
            </template>
            <template #header-extra>
              <n-tag size="small" :bordered="false" type="info">演示数据</n-tag>
            </template>
            <TodayStats />
          </n-card>
        </n-gi>
      </n-grid>

      <!-- 演示数据管理（开发辅助） -->
      <n-card :bordered="false">
        <template #header>
          <div class="flex items-center gap-2">
            <i class="i-mdi-cog-outline align-middle text-[15px] text-tea-primary" />
            <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">演示数据管理</span>
          </div>
        </template>
        <template #header-extra>
          <n-tag type="warning" size="small">仅开发使用</n-tag>
        </template>
        <n-space vertical :size="12">
          <n-alert type="info" :show-icon="true">
            生成示例商品、供应商、会员、储值记录、采购/销售/退货单等用于演示和测试。
            清空会删除所有业务数据，保留分类等系统数据。
          </n-alert>
          <n-space>
            <n-button
              type="primary"
              :loading="seeding"
              @click="handleSeed"
            >
              <template #icon>
                <i class="i-mdi-package-variant align-middle" />
              </template>
              生成演示数据
            </n-button>
            <n-button
              type="error"
              ghost
              :loading="clearing"
              @click="showClearConfirm = true"
            >
              <template #icon>
                <i class="i-mdi-delete align-middle" />
              </template>
              一键清空数据
            </n-button>
          </n-space>
        </n-space>
      </n-card>
    </n-space>

    <!-- 清空确认弹窗 -->
    <n-modal v-model:show="showClearConfirm">
      <n-card
        style="width: 400px"
        title="危险操作确认"
        :bordered="false"
        size="small"
      >
        <n-space vertical :size="12">
          <n-alert type="error" :show-icon="true">
            此操作将删除所有业务数据，且不可恢复！
          </n-alert>
          <p>请输入 <strong>清空</strong> 以确认操作：</p>
          <n-input
            v-model:value="clearConfirmText"
            placeholder="请输入 清空"
          />
        </n-space>
        <template #footer>
          <n-space justify="end">
            <n-button @click="showClearConfirm = false">取消</n-button>
            <n-button
              type="error"
              :disabled="clearConfirmText !== '清空'"
              :loading="clearing"
              @click="handleClear"
            >
              确认清空
            </n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * 仪表盘 - 工作台
 * - 上方：Hero 欢迎区（时段问候 + 渐变背景）
 * - 中部：快捷操作 + 今日概览（双栏布局，n-grid 响应式）
 * - 下方：演示数据管理（开发辅助）
 */
import { ref } from 'vue'
import { NAlert, NInput, NCard, NButton, NModal, NSpace, NTag, NGrid, NGi, useMessage } from 'naive-ui'
import { seedDemoData, clearAllData } from '@/api/dev'
import DashboardHero from './components/DashboardHero.vue'
import QuickActions from './components/QuickActions.vue'
import TodayStats from './components/TodayStats.vue'

// 演示数据管理
const message = useMessage()
const seeding = ref(false)
const clearing = ref(false)
const showClearConfirm = ref(false)
const clearConfirmText = ref('')

/** 生成演示数据 */
async function handleSeed() {
  seeding.value = true
  try {
    const result = await seedDemoData()
    message.success(
      `演示数据已生成：${result.products} 商品、${result.suppliers} 供应商、` +
      `${result.members} 会员、${result.balanceLogs} 储值流水`
    )
  } catch (e: any) {
    message.error(`生成失败: ${e}`)
  } finally {
    seeding.value = false
  }
}

/** 一键清空数据 */
async function handleClear() {
  if (clearConfirmText.value !== '清空') return
  clearing.value = true
  try {
    const result = await clearAllData()
    message.success(`已清空 ${result.clearedTables} 个业务表`)
    showClearConfirm.value = false
    clearConfirmText.value = ''
  } catch (e: any) {
    message.error(`清空失败: ${e}`)
  } finally {
    clearing.value = false
  }
}
</script>

<style scoped>
/* 页面统一由 n-space 控制区块间距，关闭 .tea-page 全局卡片 margin，避免双重间距 */
.tea-page :deep(.n-card) {
  margin-bottom: 0 !important;
}
.tea-page :deep(.n-card + .n-card) {
  margin-top: 0 !important;
}
</style>
