<!--
  @file 退货出库单详情页面
  @description 查看退货单完整信息
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标、
            n-space 统一间距、n-text 金额等宽、空状态 n-empty。
  注：仅改 TEMPLATE 与 STYLE，业务逻辑（详情加载/明细表格）原样保留。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 + 返回 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-undo-variant text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">退货单详情</span>
                </div>
                <n-button @click="$router.back()">
                    <template #icon>
                        <span class="i-mdi-arrow-left align-middle" />
                    </template>
                    返回
                </n-button>
                <n-button v-if="order" type="primary" @click="handlePrint">
                    <template #icon>
                        <span class="i-mdi-printer align-middle" />
                    </template>
                    打印退货单
                </n-button>
            </div>

            <n-card v-if="loading" :bordered="false">
                <div class="flex justify-center py-12">
                    <n-spin />
                </div>
            </n-card>

            <template v-else-if="order">
                <!-- 顶部信息 -->
                <n-card :bordered="false">
                    <n-descriptions :column="3" bordered size="small" label-placement="left">
                        <n-descriptions-item label="退货单号">{{ order.orderNo }}</n-descriptions-item>
                        <n-descriptions-item label="供应商">{{ order.supplierName }}</n-descriptions-item>
                        <n-descriptions-item label="退货日期">{{ order.returnDate }}</n-descriptions-item>
                        <n-descriptions-item label="退货原因">
                            <n-tag :type="getReasonColor(order.returnReason)" size="small" round>
                                {{ order.returnReason }}
                            </n-tag>
                        </n-descriptions-item>
                        <n-descriptions-item label="退货金额">
                            <n-text type="error" class="font-mono text-[16px] font-semibold">
                                ¥{{ order.totalAmount.toFixed(2) }}
                            </n-text>
                        </n-descriptions-item>
                        <n-descriptions-item label="创建时间">{{ order.createdAt }}</n-descriptions-item>
                        <n-descriptions-item label="备注" :span="3">
                            {{ order.remark || '-' }}
                        </n-descriptions-item>
                    </n-descriptions>
                </n-card>

                <!-- 明细 -->
                <n-card :bordered="false" title="退货明细">
                    <n-data-table
                        :columns="itemColumns"
                        :data="order.items"
                        :bordered="false"
                        :single-line="false"
                        size="small"
                    />
                </n-card>
            </template>

            <n-empty v-else description="退货单不存在">
                <template #extra>
                    <n-button size="small" @click="$router.back()">返回列表</n-button>
                </template>
            </n-empty>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 退货单详情逻辑
 * - 加载单据信息
 * - 展示明细表格
 */
import { ref, onMounted, computed, h } from 'vue'
import { useRoute } from 'vue-router'
import { NCard, NDescriptions, NDescriptionsItem, NDataTable, NTag, NSpin, NButton, NText, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { ReturnOrder, ReturnOrderItem } from '@/types'
import { getReturnOrderDetail } from '@/api/returnOrders'
import { printReturnOrder } from '@/utils/print'

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const order = ref<ReturnOrder | null>(null)

const orderId = computed(() => route.params.id as string)

async function loadDetail() {
    loading.value = true
    try {
        order.value = await getReturnOrderDetail(orderId.value)
    } catch (e: any) {
        message.error(`加载退货单失败: ${e}`)
    } finally {
        loading.value = false
    }
}

function getReasonColor(reason: string): 'error' | 'warning' | 'info' | 'default' {
    switch (reason) {
        case '质量问题': return 'error'
        case '数量超出': return 'warning'
        case '保质期': return 'info'
        default: return 'default'
    }
}

const itemColumns = computed<DataTableColumns<ReturnOrderItem>>(() => [
    { title: '序号', key: 'index', width: 60, render: (_row, index) => `${index + 1}` },
    { title: '商品名称', key: 'productName', width: 180, ellipsis: { tooltip: true } },
    { title: '原批次', key: 'batchCode', width: 160, ellipsis: { tooltip: true } },
    { title: '销售单位', key: 'unitName', width: 80 },
    {
        title: '退货数量',
        key: 'quantity',
        width: 100,
        render: (row) => h(NText, { depth: 2 }, { default: () => `${row.quantity}` })
    },
    {
        title: '实际克数',
        key: 'grams',
        width: 100,
        render: (row) => h(NText, { depth: 2 }, { default: () => `${row.grams}g` })
    },
    {
        title: '退货单价',
        key: 'unitPrice',
        width: 100,
        render: (row) => h(NText, { class: 'font-mono' }, { default: () => `¥${row.unitPrice.toFixed(2)}` })
    },
    {
        title: '小计',
        key: 'subtotal',
        width: 120,
        render: (row) => h(NText, { type: 'error', class: 'font-mono' }, { default: () => `¥${row.subtotal.toFixed(2)}` })
    }
])

/** 打印退货出库单（走模板引擎） */
async function handlePrint() {
    if (!order.value) return
    try {
        await printReturnOrder(order.value)
        message.success('已发送打印任务')
    } catch (e) {
        message.error('打印失败：' + String(e))
    }
}

onMounted(() => {
    loadDetail()
})
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
