<!--
  @file 退货出库单列表页面
  @description 退货单列表，按日期/供应商/原因筛选，抽屉查看详情，删除（库存自动还原）
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标、
            n-space 统一间距、n-text 金额等宽、空状态 n-empty。
  注：仅改 TEMPLATE 与 STYLE，业务逻辑（筛选/抽屉/删除）原样保留。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 + 主操作 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-undo-variant text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">退货出库</span>
                </div>
                <n-button type="primary" @click="$router.push('/returns/new')">
                    <template #icon>
                        <span class="i-mdi-plus align-middle" />
                    </template>
                    新增退货单
                </n-button>
            </div>

            <!-- 筛选区 -->
            <n-card :bordered="false" class="filter-card">
                <n-space align="center" :wrap="true" :size="[12, 8]">
                    <n-date-picker
                        v-model:value="filters.dateRange"
                        type="daterange"
                        clearable
                        placeholder="退货日期"
                        style="width: 260px"
                    />
                    <n-select
                        v-model:value="filters.supplierId"
                        :options="supplierOptions"
                        filterable
                        clearable
                        placeholder="全部供应商"
                        style="width: 200px"
                    />
                    <n-select
                        v-model:value="filters.returnReason"
                        :options="reasonOptions"
                        clearable
                        placeholder="全部原因"
                        style="width: 140px"
                    />
                    <n-button type="primary" @click="handleSearch">
                        <template #icon>
                            <span class="i-mdi-magnify align-middle" />
                        </template>
                        查询
                    </n-button>
                    <n-button @click="handleReset">
                        <template #icon>
                            <span class="i-mdi-refresh align-middle" />
                        </template>
                        重置
                    </n-button>
                </n-space>
            </n-card>

            <!-- 列表区 -->
            <n-card :bordered="false" title="退货出库单列表" class="table-card">
                <template #header-extra>
                    <span class="text-[12px] text-[var(--tea-content-3)]">共 {{ orders.length }} 单</span>
                </template>
                <n-data-table
                    :columns="columns"
                    :data="orders"
                    :loading="loading"
                    :pagination="pagination"
                    :bordered="false"
                    :single-line="false"
                    :scroll-x="scrollX"
                    size="small"
                    striped
                    @update:page="handlePageChange"
                >
                    <template #empty>
                        <n-empty description="暂无退货单" />
                    </template>
                </n-data-table>
            </n-card>

            <!-- 退货单详情抽屉 -->
            <n-drawer v-model:show="drawerVisible" :width="600" placement="right">
                <n-drawer-content
                    :title="`退货单详情 - ${drawerOrder?.orderNo || ''}`"
                    :header-style="{ padding: '16px 24px' }"
                    :body-style="{ padding: '24px' }"
                >
                    <n-spin :show="drawerLoading">
                        <template v-if="drawerOrder">
                            <n-descriptions :column="2" bordered size="small" label-placement="left">
                                <n-descriptions-item label="退货单号">
                                    {{ drawerOrder.orderNo }}
                                </n-descriptions-item>
                                <n-descriptions-item label="退货日期">
                                    {{ drawerOrder.returnDate }}
                                </n-descriptions-item>
                                <n-descriptions-item label="供应商">
                                    {{ drawerOrder.supplierName }}
                                </n-descriptions-item>
                                <n-descriptions-item label="退货原因">
                                    <n-tag size="small" :bordered="false" :type="getReasonColor(drawerOrder.returnReason)">
                                        {{ drawerOrder.returnReason }}
                                    </n-tag>
                                </n-descriptions-item>
                                <n-descriptions-item label="总金额">
                                    <n-text type="error" class="font-mono">¥{{ drawerOrder.totalAmount.toFixed(2) }}</n-text>
                                </n-descriptions-item>
                                <n-descriptions-item label="创建时间">
                                    {{ drawerOrder.createdAt }}
                                </n-descriptions-item>
                                <n-descriptions-item label="备注" :span="2">
                                    {{ drawerOrder.remark || '-' }}
                                </n-descriptions-item>
                            </n-descriptions>

                            <n-divider>商品明细</n-divider>

                            <n-data-table
                                :columns="itemColumns"
                                :data="drawerOrder.items"
                                size="small"
                                :bordered="false"
                                :single-line="false"
                            />

                            <n-divider />
                            <div class="flex justify-end">
                                <n-text type="error" class="font-mono text-[15px] font-semibold">
                                    合计：¥{{ drawerOrder.totalAmount.toFixed(2) }}
                                </n-text>
                            </div>
                        </template>
                    </n-spin>
                </n-drawer-content>
            </n-drawer>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 退货单列表逻辑
 * - 按供应商/退货原因筛选
 * - 抽屉查看详情 + 跳转详情页
 * - 删除退货单（库存自动还原）
 */
import { ref, reactive, onMounted, h, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
    NButton, NSpace, NPopconfirm, NTag, NDatePicker, NText, useMessage,
    NDrawer, NDrawerContent, NDescriptions, NDescriptionsItem, NDivider, NSpin
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useSupplierStore } from '@/stores'
import type { ReturnOrderListItem, Supplier, ReturnOrder, ReturnOrderItem } from '@/types'
import { getReturnOrders, getReturnOrderDetail, deleteReturnOrder, RETURN_REASON_OPTIONS } from '@/api/returnOrders'

const router = useRouter()
const message = useMessage()
const supplierStore = useSupplierStore()

const loading = ref(false)
const orders = ref<ReturnOrderListItem[]>([])

const filters = reactive({
    /** 退货日期范围 [start, end]，时间戳（毫秒） */
    dateRange: null as [number, number] | null,
    supplierId: null as string | null,
    returnReason: null as string | null
})

const pagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0,
    showSizePicker: true,
    pageSizes: [10, 20, 50, 100]
})

// ========== 抽屉状态 ==========
const drawerVisible = ref(false)
const drawerLoading = ref(false)
const drawerOrder = ref<ReturnOrder | null>(null)

/** 商品明细表格列 */
const itemColumns: DataTableColumns<ReturnOrderItem> = [
    { title: '商品', key: 'productName', width: 140 },
    { title: '单位', key: 'unitName', width: 70 },
    { title: '数量', key: 'quantity', width: 70 },
    {
        title: '单价',
        key: 'unitPrice',
        width: 90,
        render: (row) => h(NText, { class: 'font-mono' }, { default: () => `¥${row.unitPrice.toFixed(2)}` })
    },
    {
        title: '金额',
        key: 'subtotal',
        width: 90,
        render: (row) => h(NText, { type: 'error', class: 'font-mono' }, { default: () => `¥${row.subtotal.toFixed(2)}` })
    },
    { title: '批次', key: 'batchCode', width: 120 }
]

/** 打开抽屉查看退货单详情 */
async function openDrawer(row: ReturnOrderListItem) {
    drawerVisible.value = true
    drawerLoading.value = true
    try {
        const detail = await getReturnOrderDetail(row.id)
        drawerOrder.value = detail
    } catch (e: any) {
        message.error(`加载退货单详情失败: ${e}`)
    } finally {
        drawerLoading.value = false
    }
}

/** 供应商下拉选项 */
const supplierOptions = ref<{ label: string; value: string }[]>([])

/** 退货原因下拉选项 */
const reasonOptions = RETURN_REASON_OPTIONS.map(r => ({ label: r.label, value: r.value }))

/** 加载供应商下拉 */
async function loadSuppliers() {
    try {
        const list: Supplier[] = await supplierStore.loadActiveSuppliers()
        supplierOptions.value = list.map(s => ({ label: s.name, value: s.id }))
    } catch (e: any) {
        message.error(`加载供应商失败: ${e}`)
    }
}

/** 将时间戳（毫秒）转换为 YYYY-MM-DD 字符串 */
function formatDate(ts: number): string {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** 加载退货单 */
async function loadList() {
    loading.value = true
    try {
        // 解析日期范围
        let dateStart: string | undefined
        let dateEnd: string | undefined
        if (filters.dateRange && filters.dateRange.length === 2) {
            dateStart = formatDate(filters.dateRange[0])
            dateEnd = formatDate(filters.dateRange[1])
        }

        const result = await getReturnOrders(
            pagination.page, pagination.pageSize,
            filters.supplierId || undefined,
            filters.returnReason || undefined,
            dateStart,
            dateEnd
        )
        orders.value = result.list
        pagination.total = result.total
    } catch (e: any) {
        message.error(`加载退货单失败: ${e}`)
    } finally {
        loading.value = false
    }
}

function handleSearch() {
    pagination.page = 1
    loadList()
}

function handleReset() {
    filters.dateRange = null
    filters.supplierId = null
    filters.returnReason = null
    pagination.page = 1
    loadList()
}

function handlePageChange(page: number) {
    pagination.page = page
    loadList()
}

/** 跳转到详情 */
function goDetail(row: ReturnOrderListItem) {
    router.push(`/returns/${row.id}`)
}

/** 删除退货单 */
async function handleDelete(row: ReturnOrderListItem) {
    try {
        await deleteReturnOrder(row.id)
        message.success('删除成功，库存已还原')
        loadList()
    } catch (e: any) {
        message.error(`删除失败: ${e}`)
    }
}

/** 退货原因标签颜色 */
function getReasonColor(reason: string): 'error' | 'warning' | 'info' | 'default' {
    switch (reason) {
        case '质量问题': return 'error'
        case '数量超出': return 'warning'
        case '保质期': return 'info'
        default: return 'default'
    }
}

// ========== 表格列 ==========
const columns = computed<DataTableColumns<ReturnOrderListItem>>(() => [
    { title: '退货单号', key: 'orderNo', width: 180, resizable: true },
    { title: '供应商', key: 'supplierName', width: 150, resizable: true },
    { title: '退货日期', key: 'returnDate', width: 110, resizable: true },
    {
        title: '退货原因',
        key: 'returnReason',
        width: 100,
        render: (row) => h(
            NTag,
            { type: getReasonColor(row.returnReason), size: 'small', round: true },
            { default: () => row.returnReason }
        )
    },
    {
        title: '商品数',
        key: 'itemCount',
        width: 80,
        render: (row) => h(NText, { depth: 2 }, { default: () => `${row.itemCount} 项` })
    },
    {
        title: '退货金额',
        key: 'totalAmount',
        width: 120,
        render: (row) => h(NText, { type: 'error', class: 'font-mono' }, { default: () => `¥${row.totalAmount.toFixed(2)}` })
    },
    {
        title: '创建时间',
        key: 'createdAt',
        width: 160,
        resizable: true,
        render: (row) => h(NText, { depth: 3 }, { default: () => row.createdAt })
    },
    {
        title: '操作',
        key: 'actions',
        width: 220,
        fixed: 'right',
        render: (row) => h(
            NSpace,
            { size: 8, wrap: false },
            {
                default: () => [
                    h(
                        NButton,
                        { text: true, type: 'primary', size: 'small', onClick: () => openDrawer(row) },
                        {
                            icon: () => h('span', { class: 'i-mdi-eye align-middle' }),
                            default: () => '查看'
                        }
                    ),
                    h(
                        NButton,
                        { ghost: true, type: 'primary', size: 'small', onClick: () => goDetail(row) },
                        {
                            icon: () => h('span', { class: 'i-mdi-clipboard-text align-middle' }),
                            default: () => '详情'
                        }
                    ),
                    h(
                        NPopconfirm,
                        {
                            onPositiveClick: () => handleDelete(row),
                            positiveText: '确定删除',
                            negativeText: '取消'
                        },
                        {
                            trigger: () => h(
                                NButton,
                                { type: 'error', size: 'small' },
                                {
                                    icon: () => h('span', { class: 'i-mdi-delete align-middle' }),
                                    default: () => '删除'
                                }
                            ),
                            default: () => '确认删除该退货单？删除后库存将自动还原。'
                        }
                    )
                ]
            }
        )
    }
])

/** 表格最小宽度（触发横向滚动） */
const scrollX = computed(() =>
    columns.value.reduce((sum, col) => sum + ((col.width as number) || (col.minWidth as number) || 100), 0)
)

onMounted(async () => {
    await loadSuppliers()
    loadList()
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
