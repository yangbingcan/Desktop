<!--
  @file 主题设置抽屉
  @description 茶易管 v0.4.0 - 外观/排版/布局/辅助 4 组配置
-->
<template>
  <n-drawer
    :show="settingsOpen"
    :width="340"
    placement="right"
    @update:show="handleShowChange"
  >
    <n-drawer-content title="主题设置" closable>
      <!-- ============ 外观 ============ -->
      <div class="tea-settings-section">
        <div class="tea-settings-section-title">外观</div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">主题模式</span>
          <n-radio-group
            :value="themeMode"
            size="small"
            @update:value="setThemeMode"
          >
            <n-radio-button value="light">浅色</n-radio-button>
            <n-radio-button value="dark">深色</n-radio-button>
          </n-radio-group>
        </div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">主色调</span>
          <div class="tea-color-picker">
            <div
              v-for="c in colorOptions"
              :key="c.value"
              class="tea-color-dot"
              :class="{ 'tea-color-dot-active': settings.primary === c.value }"
              :style="{ background: c.hex }"
              :title="c.label"
              @click="updateSettings({ primary: c.value })"
            >
              <i v-if="settings.primary === c.value" class="i-mdi-check tea-settings-check" />
            </div>
          </div>
        </div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">侧栏风格</span>
          <n-radio-group
            :value="settings.sidebarStyle"
            size="small"
            @update:value="(v) => updateSettings({ sidebarStyle: v })"
          >
            <n-radio-button value="dark">深色</n-radio-button>
            <n-radio-button value="light">浅色</n-radio-button>
          </n-radio-group>
        </div>
      </div>

      <n-divider style="margin: 16px 0 12px;" />

      <!-- ============ 排版 ============ -->
      <div class="tea-settings-section">
        <div class="tea-settings-section-title">排版</div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">字号</span>
          <n-radio-group
            :value="settings.fontSize"
            size="small"
            @update:value="(v) => updateSettings({ fontSize: v })"
          >
            <n-radio-button value="small">小</n-radio-button>
            <n-radio-button value="standard">标准</n-radio-button>
            <n-radio-button value="large">大</n-radio-button>
          </n-radio-group>
        </div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">圆角</span>
          <n-radio-group
            :value="settings.radius"
            size="small"
            @update:value="(v) => updateSettings({ radius: v })"
          >
            <n-radio-button value="sharp">锐利</n-radio-button>
            <n-radio-button value="rounded">圆润</n-radio-button>
            <n-radio-button value="full">饱满</n-radio-button>
          </n-radio-group>
        </div>
      </div>

      <n-divider style="margin: 16px 0 12px;" />

      <!-- ============ 布局 ============ -->
      <div class="tea-settings-section">
        <div class="tea-settings-section-title">布局</div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">密度</span>
          <n-radio-group
            :value="settings.density"
            size="small"
            @update:value="(v) => updateSettings({ density: v })"
          >
            <n-radio-button value="comfortable">舒适</n-radio-button>
            <n-radio-button value="compact">紧凑</n-radio-button>
          </n-radio-group>
        </div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">侧栏宽度</span>
          <n-radio-group
            :value="settings.siderWidth"
            size="small"
            @update:value="(v) => updateSettings({ siderWidth: v })"
          >
            <n-radio-button :value="180">紧凑</n-radio-button>
            <n-radio-button :value="220">标准</n-radio-button>
            <n-radio-button :value="240">宽敞</n-radio-button>
          </n-radio-group>
        </div>
      </div>

      <n-divider style="margin: 16px 0 12px;" />

      <!-- ============ 辅助 ============ -->
      <div class="tea-settings-section">
        <div class="tea-settings-section-title">辅助</div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">护眼模式</span>
          <n-radio-group
            :value="settings.eyeCare"
            size="small"
            @update:value="(v) => updateSettings({ eyeCare: v })"
          >
            <n-radio-button value="off">关</n-radio-button>
            <n-radio-button value="mild">轻</n-radio-button>
            <n-radio-button value="moderate">中</n-radio-button>
            <n-radio-button value="strong">强</n-radio-button>
          </n-radio-group>
        </div>

        <div class="tea-settings-row">
          <span class="tea-settings-label">暖色温</span>
          <n-switch
            :value="settings.warmTone"
            size="small"
            @update:value="(v) => updateSettings({ warmTone: v })"
          />
        </div>
      </div>

      <n-divider style="margin: 16px 0 12px;" />

      <div style="display: flex; gap: 8px;">
        <n-button size="small" @click="handleReset">恢复默认</n-button>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: var(--tea-primary-bg); border-radius: var(--tea-radius-md); font-size: 12px; color: var(--tea-text-secondary); line-height: 1.6;">
        💡 设置自动保存到本地，刷新页面后保留。
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
/**
 * ThemeSettings 组件逻辑
 * - 直接绑定 useThemeStore
 * - 实时写入，实时生效
 * - 关闭抽屉通过 store
 */
import { computed } from 'vue'
import { NDrawer, NDrawerContent, NRadioGroup, NRadioButton, NSwitch, NButton, NDivider } from 'naive-ui'
import { useThemeStore, type PrimaryColor } from '@/stores/theme'

const themeStore = useThemeStore()

const settingsOpen = computed(() => themeStore.settingsOpen)
const themeMode = computed(() => themeStore.themeMode)
const settings = computed(() => themeStore.settings)
const setThemeMode = (mode: 'light' | 'dark') => themeStore.setThemeMode(mode)
const updateSettings = (partial: any) => themeStore.updateSettings(partial)

function handleShowChange(show: boolean) {
  if (!show) themeStore.closeSettings()
}

function handleReset() {
  themeStore.resetSettings()
  // 主题模式不重置（用户偏好）
}

/** 主色选项 */
const colorOptions: { value: PrimaryColor; label: string; hex: string }[] = [
  { value: 'gold', label: '茶金', hex: '#4A6741' },
  { value: 'bamboo', label: '竹青', hex: '#5B8C5A' },
  { value: 'cinnabar', label: '朱砂', hex: '#B5483F' },
]
</script>

<style scoped>
.tea-settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tea-settings-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tea-text-primary);
  margin-bottom: 4px;
}

.tea-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tea-settings-row-block {
  align-items: flex-start;
  flex-direction: column;
  gap: 8px;
}

.tea-settings-label {
  font-size: 12px;
  color: var(--tea-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.tea-color-picker {
  display: flex;
  gap: 10px;
}

.tea-color-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  transition: border-color var(--tea-transition-fast), transform var(--tea-transition-fast);
  flex-shrink: 0;
}

.tea-color-dot:hover {
  transform: scale(1.1);
}

.tea-color-dot-active {
  border-color: var(--tea-text-primary);
  box-shadow: 0 0 0 2px var(--tea-primary-supply);
}

.tea-settings-check {
  font-size: 14px;
  color: #fff;
}
</style>
