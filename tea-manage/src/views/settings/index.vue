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
                        <n-descriptions :column="1">
                            <n-descriptions-item label="系统名称">茶易管（TeaManage）</n-descriptions-item>
                            <n-descriptions-item label="版本号">v{{ appVersion }}</n-descriptions-item>
                            <n-descriptions-item label="技术栈">Vue 3 + Tauri 2.x + Rust + SQLite</n-descriptions-item>
                        </n-descriptions>
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
 * 3. 备份 / 初始化为占位功能（message 提示）
 */
import { reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useSettingsStore } from '@/stores'

const message = useMessage()
const settingsStore = useSettingsStore()

// v0.5.5 修复：从常量同步版本号，避免显示过期的 v0.1.0
const appVersion = ref('0.6.1')

const shopSettings = reactive({
    shopName: '茶易管',
    shopAddress: '',
    shopPhone: ''
})

const systemSettings = reactive({
    allowNegativeStock: false,
    enableMemberDiscount: true,
    enablePrintReceipt: true,
    defaultReceiptTemplate: 'default'
})

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
    // 备份功能暂未实现
    message.info('备份功能开发中')
}

async function initDatabase() {
    // TODO: 确认后初始化数据库
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
