<!--
  @file 采购入库单详情页面
  @description 查看采购单完整信息和商品明细
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
                    <span class="i-mdi-archive-outline text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">采购单详情</span>
                </div>
                <n-button @click="$router.back()">
                    <template #icon>
                        <span class="i-mdi-arrow-left align-middle" />
                    </template>
                    返回
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
                        <n-descriptions-item label="采购单号">{{ order.orderNo }}</n-descriptions-item>
                        <n-descriptions-item label="供应商">{{ order.supplierName }}</n-descriptions-item>
                        <n-descriptions-item label="经手人">{{ order.handler || '-' }}</n-descriptions-item>
                        <n-descriptions-item label="创建时间">{{ order.createdAt }}</n-descriptions-item>
                        <n-descriptions-item label="付款状态">
                            <n-tag :type="getPaymentColor(order.paymentStatus)" size="small" round>
                                {{ getPaymentLabel(order.paymentStatus) }}
                            </n-tag>
                        </n-descriptions-item>
                        <n-descriptions-item label="总金额">
                            <n-text type="warning" class="font-mono text-[16px] font-semibold">
                                ¥{{ order.totalAmount.toFixed(2) }}
                            </n-text>
                        </n-descriptions-item>
                        <n-descriptions-item label="备注" :span="3">
                            {{ order.remark || '-' }}
                        </n-descriptions-item>
                    </n-descriptions>
                </n-card>

                <!-- 明细 -->
                <n-card :bordered="false" title="商品明细">
                    <n-data-table
                        :columns="itemColumns"
                        :data="order.items"
                        :bordered="false"
                        :single-line="false"
                        size="small"
                    />
                </n-card>
            </template>

            <n-empty v-else description="采购单不存在">
                <template #extra>
                    <n-button size="small" @click="$router.back()">返回列表</n-button>
                </template>
            </n-empty>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 采购单详情逻辑
 * - 加载单据信息
 * - 展示明细表格
 */
import { ref, onMounted, computed, h } from 'vue'
import { useRoute } from 'vue-router'
import {
    NCard, NDescriptions, NDescriptionsItem, NDataTable, NTag, NSpin, NButton, NText, useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { PurchaseOrder, PurchaseOrderItem } from '@/types'
import { getPurchaseOrderDetail } from '@/api/purchases'

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const order = ref<PurchaseOrder | null>(null)

const orderId = computed(() => route.params.id as string)

async function loadDetail() {
    loading.value = true
    try {
        order.value = await getPurchaseOrderDetail(orderId.value)
    } catch (e: any) {
        message.error(`加载采购单失败: ${e}`)
    } finally {
        loading.value = false
    }
}

function getPaymentLabel(status: string): string {
    switch (status) {
        case 'paid': return '已付款'
        case 'partial': return '部分付款'
        case 'unpaid': return '未付款'
        default: return status
    }
}

function getPaymentColor(status: string): 'success' | 'warning' | 'error' | 'default' {
    switch (status) {
        case 'paid': return 'success'
        case 'partial': return 'warning'
        case 'unpaid': return 'error'
        default: return 'default'
    }
}

const itemColumns = computed<DataTableColumns<PurchaseOrderItem>>(() => [
    { title: '序号', key: 'index', width: 60, render: (_row, index) => `${index + 1}` },
    { title: '商品名称', key: 'productName', width: 180, ellipsis: { tooltip: true } },
    { title: '销售单位', key: 'unitName', width: 80 },
    { title: '数量', key: 'quantity', width: 80 },
    { title: '实际克数', key: 'grams', width: 100, render: (row) => h(NText, { depth: 2 }, { default: () => `${row.grams}g` }) },
    { title: '进价', key: 'unitPrice', width: 100, render: (row) => h(NText, { class: 'font-mono' }, { default: () => `¥${row.unitPrice.toFixed(2)}` }) },
    { title: '小计', key: 'subtotal', width: 120, render: (row) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => `¥${row.subtotal.toFixed(2)}` }) },
    { title: '批次号', key: 'batchCode', width: 160, ellipsis: { tooltip: true } }
])

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
