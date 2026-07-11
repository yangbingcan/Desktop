<!--
  @file 打印模板管理
  @description 小票模板、入库单模板管理
  @refactor v0.6.0 统一深茶绿视觉纪律：tea-page p-md + n-card + n-tabs + mdi 图标；
             金额统一 .toFixed(2) + font-mono；保留编辑弹窗逻辑。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-printer-settings text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">打印模板</span>
                </div>
            </div>

            <n-card :bordered="false">
                <n-tabs type="line" animated>
                    <!-- 小票模板 -->
                    <n-tab-pane name="receipt">
                        <template #tab>
                            <span class="i-mdi-receipt align-middle" />
                            <span class="ml-1">小票模板</span>
                        </template>

                        <n-space vertical :size="12">
                            <div class="flex items-center justify-between">
                                <span class="text-[14px] font-semibold text-[var(--tea-content-1)]">零售小票模板</span>
                                <n-button type="primary" size="small" @click="editTemplate('receipt')">
                                    <template #icon>
                                        <span class="i-mdi-pencil align-middle" />
                                    </template>
                                    编辑
                                </n-button>
                            </div>

                        <!-- 模板预览 - 固定白色背景（模拟真实小票纸） -->
                        <div class="receipt-preview">
                            <div class="text-center" style="margin-bottom: 12px;">
                                <div class="text-[16px] font-bold">{{ receiptDemo.shopName }}</div>
                            </div>
                            <div class="receipt-divider">
                                <div
                                    v-for="(item, idx) in receiptDemo.items"
                                    :key="idx"
                                    class="flex items-center justify-between"
                                    style="padding: 2px 0;"
                                >
                                    <span class="text-[13px]">{{ item.name }} × {{ item.qty }}</span>
                                    <span class="text-[13px] font-mono">¥{{ item.amount.toFixed(2) }}</span>
                                </div>
                            </div>
                            <div class="text-right font-bold font-mono" style="margin-top: 8px;">
                                合计：¥{{ receiptTotal }}
                            </div>
                            <div class="text-center text-[12px]" style="margin-top: 12px;">
                                {{ receiptDemo.footer }}
                            </div>
                        </div>
                        </n-space>
                    </n-tab-pane>

                    <!-- 入库单模板 -->
                    <n-tab-pane name="purchase">
                        <template #tab>
                            <span class="i-mdi-clipboard-text align-middle" />
                            <span class="ml-1">入库单模板</span>
                        </template>

                        <n-space vertical :size="12">
                            <div class="flex items-center justify-between">
                                <span class="text-[14px] font-semibold text-[var(--tea-content-1)]">采购入库单模板</span>
                                <n-button type="primary" size="small" @click="editTemplate('purchase')">
                                    <template #icon>
                                        <span class="i-mdi-pencil align-middle" />
                                    </template>
                                    编辑
                                </n-button>
                            </div>
                            <n-empty description="暂无模板预览" />
                        </n-space>
                    </n-tab-pane>
                </n-tabs>
            </n-card>
        </n-space>

        <!-- 编辑弹窗 -->
        <n-modal
            v-model:show="showEditModal"
            preset="card"
            :title="`编辑${currentTypeName}模板`"
            style="width: 800px"
        >
            <n-input
                v-model:value="templateContent"
                type="textarea"
                :rows="20"
                placeholder="请输入模板内容（HTML格式）"
            />
            <template #footer>
                <div class="flex items-center justify-end gap-2">
                    <n-button @click="showEditModal = false">取消</n-button>
                    <n-button type="primary" @click="saveTemplate">
                        <template #icon>
                            <span class="i-mdi-content-save align-middle" />
                        </template>
                        保存
                    </n-button>
                </div>
            </template>
        </n-modal>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 打印模板管理逻辑
 * @description 小票模板 / 入库单模板
 *
 * 业务逻辑（严格保留）：
 * 1. showEditModal / currentType / templateContent / currentTypeName 响应式状态
 * 2. editTemplate(type) 设置当前类型并提示（编辑功能开发中）
 * 3. saveTemplate() 提示保存并关闭弹窗
 *
 * 演示小票金额统一 .toFixed(2) + font-mono（视觉纪律 #8）
 */
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'

const message = useMessage()

const showEditModal = ref(false)
const currentType = ref('receipt')
const templateContent = ref('')
const currentTypeName = ref('')

/** 演示小票数据（仅用于预览，不改变业务逻辑） */
const receiptDemo = {
    shopName: '茶易管',
    items: [
        { name: '铁观音 50g', qty: 2, amount: 80.0 },
        { name: '大红袍 100g', qty: 1, amount: 88.0 }
    ],
    footer: '感谢惠顾，欢迎再次光临！'
}

/** 合计金额：toFixed(2) 固定两位小数 */
const receiptTotal = computed(() =>
    receiptDemo.items.reduce((sum, i) => sum + i.amount, 0).toFixed(2)
)

function editTemplate(type: string) {
    currentType.value = type
    currentTypeName.value = type === 'receipt' ? '小票' : '入库单'
    // 打印模板编辑功能开发中
    message.info('打印模板编辑功能开发中')
}

function saveTemplate() {
    // 保存模板功能开发中
    message.info('打印模板保存功能开发中')
    showEditModal.value = false
}
</script>

<style scoped>
/* v0.5.2 模板预览 - 模拟真实小票纸（固定浅色背景） */
.receipt-preview {
    padding: 16px;
    width: 300px;
    margin: 0 auto;
    background: #FFFFFF;
    border: 1px solid var(--tea-line-1);
    border-radius: var(--tea-radius-lg);
    color: #000000;
    font-family: 'Courier New', monospace;
}

.receipt-preview .receipt-divider {
    border-top: 1px dashed #000000;
    border-bottom: 1px dashed #000000;
    padding: 8px 0;
    margin-bottom: 8px;
}
</style>
