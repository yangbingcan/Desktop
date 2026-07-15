<!--
  @file 系统设置页面
  @description 店铺信息、系统配置、数据管理、关于
  @refactor v0.6.0 统一深茶绿视觉纪律：tea-page p-md 根节点 + n-card 分区 +
             n-tabs 标签 + mdi 图标；去除散落 margin，区块间距由 n-space 控制。
             严格保留 settingsStore 的业务调用（saveSettings）。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-cog-outline text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">系统设置</span>
                </div>
            </div>

            <n-card :bordered="false">
                <n-tabs type="line" animated>
                    <!-- 店铺信息 -->
                    <n-tab-pane name="shop">
                        <template #tab>
                            <span class="i-mdi-store align-middle" />
                            <span class="ml-1">店铺信息</span>
                        </template>
                        <n-form
                            :model="shopSettings"
                            label-placement="left"
                            label-width="120"
                        >
                            <n-form-item label="店铺名称">
                                <n-input v-model:value="shopSettings.shopName" placeholder="请输入店铺名称" />
                            </n-form-item>
                            <n-form-item label="店铺地址">
                                <n-input v-model:value="shopSettings.shopAddress" placeholder="请输入店铺地址" />
                            </n-form-item>
                            <n-form-item label="联系电话">
                                <n-input v-model:value="shopSettings.shopPhone" placeholder="请输入联系电话" />
                            </n-form-item>
                            <n-divider />
                            <n-button type="primary" @click="saveShopSettings">
                                <template #icon>
                                    <span class="i-mdi-content-save align-middle" />
                                </template>
                                保存
                            </n-button>
                        </n-form>
                    </n-tab-pane>

                    <!-- 系统配置 -->
                    <n-tab-pane name="system">
                        <template #tab>
                            <span class="i-mdi-tune align-middle" />
                            <span class="ml-1">系统配置</span>
                        </template>
                        <n-form label-placement="left" label-width="200">
                            <n-form-item label="允许负库存销售">
                                <n-space align="center" :size="12">
                                    <n-switch v-model:value="systemSettings.allowNegativeStock" />
                                    <n-text :type="systemSettings.allowNegativeStock ? 'success' : 'default'">
                                        {{ systemSettings.allowNegativeStock ? '已开启' : '已关闭' }}
                                    </n-text>
                                </n-space>
                            </n-form-item>
                            <n-form-item label="启用会员折扣">
                                <n-switch v-model:value="systemSettings.enableMemberDiscount" />
                            </n-form-item>
                            <n-form-item label="启用小票打印">
                                <n-switch v-model:value="systemSettings.enablePrintReceipt" />
                            </n-form-item>
                            <n-form-item label="默认小票模板">
                                <n-select
                                    v-model:value="systemSettings.defaultReceiptTemplate"
                                    :options="templateOptions"
                                    style="width: 200px"
                                />
                            </n-form-item>
                            <n-divider />
                            <n-button type="primary" @click="saveSystemSettings">
                                <template #icon>
                                    <span class="i-mdi-content-save align-middle" />
                                </template>
                                保存
                            </n-button>
                        </n-form>
                    </n-tab-pane>

                    <!-- 数据管理 -->
                    <n-tab-pane name="data">
                        <template #tab>
                            <span class="i-mdi-archive-outline align-middle" />
                            <span class="ml-1">数据管理</span>
                        </template>
                        <n-space vertical :size="8">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-[14px] font-semibold text-[var(--tea-content-1)]">数据库备份</div>
                                    <div class="text-[13px] text-[var(--tea-content-3)]">将数据库文件备份到指定位置</div>
                                </div>
                                <n-button @click="backupDatabase">立即备份</n-button>
                            </div>
                            <n-divider />
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-[14px] font-semibold text-[var(--tea-content-1)]">初始化数据库</div>
                                    <div class="text-[13px] text-[var(--tea-content-3)]">清空所有数据，重新开始（不可恢复！）</div>
                                </div>
                                <n-button type="error" @click="initDatabase">初始化</n-button>
                            </div>
                        </n-space>
                    </n-tab-pane>

                    <!-- 关于 -->
                    <n-tab-pane name="about">
                        <template #tab>
                            <span class="i-mdi-information align-middle" />
                            <span class="ml-1">关于</span>
                        </template>
                        <n-space vertical :size="16">
                            <!-- 演示模式开关 -->
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-[14px] font-semibold text-[var(--tea-content-1)]">演示模式</div>
                                    <div class="text-[13px] text-[var(--tea-content-3)]">
                                        关闭后首页不显示「演示数据管理」
                                    </div>
                                </div>
                                <n-switch :value="demoMode" @update:value="onDemoModeChange" />
                            </div>

                            <n-divider />

                            <!-- 版本号（保留） -->
                            <n-descriptions :column="1">
                                <n-descriptions-item label="版本号">v{{ appVersion }}</n-descriptions-item>
                            </n-descriptions>

                            <n-divider />

                            <!-- 版本更新内容 -->
                            <div>
                                <div class="section-title">版本更新内容</div>
                                <n-alert v-if="latest" :title="`v${latest.version} · ${latest.title}`" type="success">
                                    <ul class="changelog-list">
                                        <li v-for="(c, i) in latest.changes" :key="i">{{ c }}</li>
                                    </ul>
                                </n-alert>
                            </div>

                            <n-divider />

                            <!-- 版本历史 -->
                            <div>
                                <div class="section-title">版本历史</div>
                                <ul class="version-history">
                                    <li
                                        v-for="(v, i) in changelog"
                                        :key="v.version"
                                        class="version-item"
                                    >
                                        <span class="version-tag" :class="{ 'is-latest': i === 0 }">v{{ v.version }}</span>
                                        <span class="version-date">{{ v.date }}</span>
                                        <span class="version-title">{{ v.title }}</span>
                                    </li>
                                </ul>
                            </div>
                        </n-space>
                    </n-tab-pane>
                </n-tabs>
            </n-card>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 系统设置页面逻辑
 * @description 店铺信息 / 系统配置 / 数据管理 / 关于
 *
 * 业务逻辑（严格保留）：
 * 1. settingsStore.saveSettings(shopSettings) / saveSettings(systemSettings)
 * 2. 版本号从常量读取（v0.5.5 修复：避免显示过期版本）
 * 3. 备份已接入真实命令（v0.7.0）；初始化接入 seed_demo_data（I3 修复）
 */
import { onMounted, reactive, ref } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { getVersion } from '@tauri-apps/api/app'
import { useSettingsStore } from '@/stores'
import { demoMode, setDemoMode } from '@/utils/demoMode'
import { seedDemoData, backupDatabase as backupDatabaseApi } from '@/api/dev'
import changelogData from '@/data/changelog.json'

interface ChangelogEntry {
    version: string
    date: string
    type: string
    title: string
    changes: string[]
}

const message = useMessage()
// 防御：useDialog 需要 NDialogProvider 祖先组件，若缺失会抛异常导致 setup 中断
// 延迟到 shopSettings/systemSettings 初始化之后再调用，确保渲染数据已就绪
const settingsStore = useSettingsStore()

// 版本号从 Tauri 运行时读取（tauri.conf.json），始终与安装包一致，避免硬编码过期版本
const appVersion = ref('0.7.1')
const changelog = changelogData as ChangelogEntry[]
const latest = changelog[0]

// I2 修复：表单初始值从已持久化的 store 读取，确保刷新后回显用户保存的设置
// 防御：使用可选链 + 默认值，避免 settings 为 undefined 时崩溃（HMR / store 未初始化场景）
const shopSettings = reactive({
    shopName: settingsStore.settings?.shopName ?? '',
    shopAddress: settingsStore.settings?.shopAddress ?? '',
    shopPhone: settingsStore.settings?.shopPhone ?? ''
})

const systemSettings = reactive({
    allowNegativeStock: settingsStore.settings?.allowNegativeStock ?? false,
    enableMemberDiscount: settingsStore.settings?.enableMemberDiscount ?? true,
    enablePrintReceipt: settingsStore.settings?.enablePrintReceipt ?? true,
    defaultReceiptTemplate: settingsStore.settings?.defaultReceiptTemplate ?? 'default'
})

// useDialog 必须在 shopSettings/systemSettings 之后调用，
// 确保即使 NDialogProvider 缺失导致异常，渲染所需的响应式数据已就绪
const dialog = useDialog()

onMounted(async () => {
    try {
        appVersion.value = await getVersion()
    } catch {
        // 非 Tauri 环境保留兜底版本号
    }
})

/** 切换演示模式并持久化 */
function onDemoModeChange(val: boolean): void {
    setDemoMode(val)
    message.success(val ? '已开启演示模式' : '已关闭演示模式，首页将隐藏演示数据管理')
}

const templateOptions = [
    { label: '默认模板', value: 'default' }
]

async function saveShopSettings() {
    await settingsStore.saveSettings(shopSettings)
}

async function saveSystemSettings() {
    await settingsStore.saveSettings(systemSettings)
}

async function backupDatabase() {
    // v0.7.0：替换占位，调用真实备份命令（复制数据库为带时间戳副本）
    try {
        const path = await backupDatabaseApi()
        message.success(`备份成功：${path}`)
    } catch (e) {
        message.error(`备份失败：${String(e)}`)
    }
}

async function initDatabase() {
    // I3 修复：原为 TODO 空实现；现在接入 seed_demo_data（清空全库 + 载入演示数据），危险操作需显式确认
    dialog.warning({
        title: '初始化数据库',
        content: '将清空所有业务数据并重新载入演示数据，此操作不可恢复！',
        positiveText: '确认初始化',
        negativeText: '取消',
        onPositiveClick: async () => {
            try {
                await seedDemoData()
                message.success('数据库已初始化为演示数据')
            } catch (e) {
                message.error('初始化失败：' + String(e ?? ''))
            }
        }
    })
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

/* 关于页 - 分节标题（版本更新内容 / 版本历史） */
.section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--tea-content-1);
    padding-left: 8px;
    border-left: 3px solid var(--tea-primary);
    line-height: 1.2;
    margin-bottom: 10px;
}

/* 版本更新内容 - 变更点列表 */
.changelog-list {
    margin: 0;
    padding-left: 18px;
    list-style: disc;
}
.changelog-list li {
    font-size: 13px;
    line-height: 1.7;
    color: var(--tea-content-2);
}

/* 版本历史 - 时间线式列表 */
.version-history {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
}
.version-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--tea-line-2);
}
.version-item:last-child {
    border-bottom: none;
}
.version-tag {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--tea-font-family);
    padding: 2px 8px;
    border-radius: var(--tea-radius-sm);
    background: var(--tea-primary-light);
    color: var(--tea-primary-active);
}
.version-tag.is-latest {
    background: var(--tea-primary);
    color: #fff;
}
.version-date {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--tea-content-3);
    font-variant-numeric: tabular-nums;
}
.version-title {
    font-size: 13px;
    color: var(--tea-content-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
