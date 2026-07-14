<!--
  @file 系统操作手册（首页卡片）
  @description 茶易管 - 分模块分功能的操作说明与使用步骤，使用 n-collapse 折叠展示。
  @spec 统一视觉规范：根节点由父组件 n-space 控制间距；本组件自包含 n-card + mdi 图标；
       步骤列表用纯 HTML + UnoCSS 排版（避免额外组件注册）。
-->
<template>
  <n-card :bordered="false">
    <template #header>
      <div class="flex items-center gap-2">
        <i class="i-mdi-book-open-variant align-middle text-[15px] text-tea-primary" />
        <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">系统操作手册</span>
      </div>
    </template>
    <template #header-extra>
      <n-tag size="small" :bordered="false" type="info">按模块</n-tag>
    </template>

    <n-collapse :default-expanded-names="defaultExpanded" accordion>
      <n-collapse-item
        v-for="m in manualModules"
        :key="m.key"
        :name="m.key"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <i :class="m.icon" class="text-[15px] text-tea-primary" />
            <span class="text-[14px] font-medium text-[var(--tea-content-1)]">{{ m.title }}</span>
          </div>
        </template>
        <ol class="manual-steps">
          <li v-for="(s, i) in m.steps" :key="i" class="manual-step">
            <div class="manual-step-title">{{ i + 1 }}. {{ s.title }}</div>
            <div class="manual-step-desc">{{ s.desc }}</div>
          </li>
        </ol>
      </n-collapse-item>
    </n-collapse>
  </n-card>
</template>

<script setup lang="ts">
/**
 * 系统操作手册组件逻辑
 * - 数据来自 @/data/operationManual（分模块步骤）
 * - 默认展开第一个模块；accordion 模式一次展开一个
 */
import { manualModules } from '@/data/operationManual'

const defaultExpanded = manualModules.length > 0 ? [manualModules[0].key] : []
</script>

<style scoped>
.manual-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.manual-step {
  position: relative;
  padding-left: 12px;
  border-left: 2px solid var(--tea-primary-supply);
}

.manual-step-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tea-content-1);
}

.manual-step-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--tea-content-3);
}
</style>
