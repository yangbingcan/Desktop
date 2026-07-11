<!--
  @file 采购入库单列表
  @description 采购入库单查询与管理，支持日期/供应商/付款状态筛选，抽屉查看详情，供应商付款
  @refactor v0.6.0 统一深茶绿主题（n-config-provider themeOverrides）、
            Naive UI 组件化（n-card / n-space / n-text）、mdi 图标、
            去除散落 margin，区块间距由 n-space 统一控制，
            金额等宽 + n-text type 着色，空状态 n-empty。
  注：仅改 TEMPLATE 与 STYLE，业务逻辑（筛选/分页/抽屉/付款弹窗）原样保留。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 + 主操作 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-archive-outline text-[18px] align-middle text-[var(--tea-primary)]" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">采购入库单</span>
                </div>
                <n-button type="primary" @click="$router.push('/purchase/new')">
                    <template #icon>
                        <span class="i-mdi-plus align-middle" />
                    </template>
                    新增入库单
                </n-button>
            </div>

            <!-- 筛选区 -->
            <n-card :bordered="false" class="filter-card">
                <n-space align="center" :wrap="true" :size="[12, 8]">
                    <n-date-picker
                        v-model:value="filters.dateRange"
                        type="daterange"
                        clearable
                        placeholder="入库日期"
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
                        v-model:value="filters.paymentStatus"
                        :options="paymentOptions"
                        clearable
                        placeholder="全部状态"
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
            <n-card :bordered="false" title="采购入库单列表" class="table-card">
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
                        <n-empty description="暂无采购单" />
                    </template>
                </n-data-table>
            </n-card>

            <!-- 采购单详情抽屉 -->
            <n-drawer v-model:show="drawerVisible" :width="600" placement="right">
                <n-drawer-content
                    :title="`采购单详情 - ${drawerOrder?.orderNo || ''}`"
                    :header-style="{ padding: '16px 24px' }"
                    :body-style="{ padding: '24px' }"
                >
                    <n-spin :show="drawerLoading">
                        <template v-if="drawerOrder">
                            <n-descriptions :column="2" bordered size="small" label-placement="left">
                                <n-descriptions-item label="单号">
                                    {{ drawerOrder.orderNo }}
                                </n-descriptions-item>
                                <n-descriptions-item label="日期">
                                    {{ drawerOrder.createdAt }}
                                </n-descriptions-item>
                                <n-descriptions-item label="供应商">
                                    {{ drawerOrder.supplierName }}
                                </n-descriptions-item>
                                <n-descriptions-item label="经手人">
                                    {{ drawerOrder.handler || '-' }}
                                </n-descriptions-item>
                                <n-descriptions-item label="付款状态">
                                    <n-tag size="small" :bordered="false" :type="getPaymentColor(drawerOrder.paymentStatus)">
                                        {{ getPaymentLabel(drawerOrder.paymentStatus) }}
                                    </n-tag>
                                </n-descriptions-item>
                                <n-descriptions-item label="总金额">
                                    <n-text type="warning" class="font-mono">¥{{ drawerOrder.totalAmount.toFixed(2) }}</n-text>
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
                                <n-text type="warning" class="font-mono text-[15px] font-semibold">
                                    合计：¥{{ drawerOrder.totalAmount.toFixed(2) }}
                                </n-text>
                            </div>

                            <!-- 付款按钮 -->
                            <div v-if="drawerOrder && drawerOrder.paymentStatus !== 'paid'" class="flex justify-end">
                                <n-button type="primary" @click="openPayment(drawerOrder!.id, drawerOrder!.supplierId!, drawerOrder!.totalAmount)">
                                    <template #icon>
                                        <span class="i-mdi-cash align-middle" />
                                    </template>
                                    付款
                                </n-button>
                            </div>
                        </template>
                    </n-spin>
                </n-drawer-content>
            </n-drawer>

            <!-- 供应商付款弹窗 -->
            <n-modal v-model:show="showPaymentModal" preset="card" title="供应商付款" style="width: 450px">
                <template #header-extra>
                    <span class="i-mdi-cash-register text-[18px] align-middle text-[var(--tea-primary)]" />
                </template>
                <n-form label-placement="left" label-width="80">
                    <n-form-item label="付款金额">
                        <n-input-number v-model:value="paymentForm.amount" :min="0.01" :precision="2" style="width:100%" />
                    </n-form-item>
                    <n-form-item label="付款方式">
                        <n-select v-model:value="paymentForm.paymentMethod" :options="paymentMethodOptions" />
                    </n-form-item>
                    <n-form-item label="付款日期">
                        <n-date-picker v-model:value="paymentForm.paymentDate" type="date" style="width:100%" />
                    </n-form-item>
                    <n-form-item label="备注">
                        <n-input v-model:value="paymentForm.remark" type="textarea" />
                    </n-form-item>
                </n-form>
                <div class="flex justify-end">
                    <n-space :size="12">
                        <n-button @click="showPaymentModal = false">取消</n-button>
                        <n-button type="primary" :loading="paymentLoading" @click="confirmPayment">
                            <template #icon>
                                <span class="i-mdi-check align-middle" />
                            </template>
                            确认付款
                        </n-button>
                    </n-space>
                </div>
            </n-modal>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 采购单列表逻辑
 * - 按日期/供应商/付款状态筛选
 * - 抽屉查看详情
 *
 * 设计要点：
 * 1. 表格金额统一 toFixed(2) + font-mono 等宽，付款状态走 NTag type 着色
 * 2. 列表空态由 n-data-table #empty 插槽提供「暂无采购单」
 * 3. 操作列按钮与 ProductList 对齐（查看=text/编辑=ghost/详情=ghost）
 */
import { ref, reactive, onMounted, h, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, NDatePicker, NSpace, useMessage,
    NDrawer, NDrawerContent, NDescriptions, NDescriptionsItem, NDivider, NSpin, NText
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { PurchaseOrderListItem, PurchaseOrder, PurchaseOrderItem } from '@/types'
import { getPurchaseOrders, getPurchaseOrderDetail } from '@/api/purchases'
import { createPayment, PAYMENT_METHOD_OPTIONS } from '@/api/suppliers'
import { useSupplierStore } from '@/stores'

const router = useRouter()
const message = useMessage()
const supplierStore = useSupplierStore()

const loading = ref(false)
const orders = ref<PurchaseOrderListItem[]>([])

const filters = reactive({
    /** 入库日期范围 [start, end]，时间戳（毫秒） */
    dateRange: null as [number, number] | null,
    supplierId: null as string | null,
    paymentStatus: null as string | null
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
const drawerOrder = ref<PurchaseOrder | null>(null)

/** 商品明细表格列 */
const itemColumns: DataTableColumns<PurchaseOrderItem> = [
    { title: '商品', key: 'productName', width: 140 },
    { title: '单位', key: 'unitName', width: 70 },
    { title: '数量', key: 'quantity', width: 70 },
    {
        title: '进价',
        key: 'unitPrice',
        width: 90,
        render: (row) => h(NText, { class: 'font-mono' }, { default: () => `¥${row.unitPrice.toFixed(2)}` })
    },
    {
        title: '金额',
        key: 'subtotal',
        width: 90,
        render: (row) => h(NText, { class: 'font-mono' }, { default: () => `¥${row.subtotal.toFixed(2)}` })
    },
    { title: '批次', key: 'batchCode', width: 120 }
]

// ========== 付款弹窗状态 ==========
const showPaymentModal = ref(false)
const paymentLoading = ref(false)
const currentPaymentOrderId = ref('')
const currentPaymentSupplierId = ref('')

const paymentForm = reactive({
    amount: 0,
    paymentMethod: 'cash',
    paymentDate: Date.now(),
    remark: ''
})

/** 付款方式选项 */
const paymentMethodOptions = PAYMENT_METHOD_OPTIONS.map(o => ({ label: o.label, value: o.value }))

/** 打开付款弹窗 */
function openPayment(orderId: string, supplierId: string, totalAmount: number) {
    currentPaymentOrderId.value = orderId
    currentPaymentSupplierId.value = supplierId
    paymentForm.amount = totalAmount
    paymentForm.paymentMethod = 'cash'
    paymentForm.paymentDate = Date.now()
    paymentForm.remark = ''
    showPaymentModal.value = true
}

/** 确认付款 */
async function confirmPayment() {
    if (paymentForm.amount <= 0) {
        message.warning('请输入付款金额')
        return
    }
    paymentLoading.value = true
    try {
        const paymentDate = new Date(paymentForm.paymentDate).toISOString().slice(0, 10)
        await createPayment({
            supplierId: currentPaymentSupplierId.value,
            purchaseOrderId: currentPaymentOrderId.value,
            amount: paymentForm.amount,
            paymentMethod: paymentForm.paymentMethod,
            paymentDate,
            remark: paymentForm.remark || undefined
        })
        message.success('付款成功')
        showPaymentModal.value = false
        // 刷新抽屉内容
        if (drawerOrder.value) {
            await openDrawer({ id: drawerOrder.value.id } as PurchaseOrderListItem)
        }
    } catch (e: any) {
        message.error(`付款失败: ${e}`)
    } finally {
        paymentLoading.value = false
    }
}

/** 打开抽屉查看采购单详情 */
async function openDrawer(row: PurchaseOrderListItem) {
    drawerVisible.value = true
    drawerLoading.value = true
    try {
        const detail = await getPurchaseOrderDetail(row.id)
        drawerOrder.value = detail
    } catch (e: any) {
        message.error(`加载采购单详情失败: ${e}`)
    } finally {
        drawerLoading.value = false
    }
}

const supplierOptions = computed(() =>
    supplierStore.suppliers.map(s => ({ label: s.name, value: s.id }))
)

const paymentOptions = [
    { label: '未付款', value: 'unpaid' },
    { label: '部分付款', value: 'partial' },
    { label: '已付款', value: 'paid' }
]

/** 将时间戳（毫秒）转换为 YYYY-MM-DD 字符串 */
function formatDate(ts: number): string {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** 加载采购单列表 */
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

        const result = await getPurchaseOrders(
            pagination.page, pagination.pageSize,
            filters.supplierId || undefined,
            filters.paymentStatus || undefined,
            dateStart, dateEnd
        )
        orders.value = result.list
        pagination.total = result.total
    } catch (e: any) {
        message.error(`加载采购单失败: ${e}`)
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
    filters.paymentStatus = null
    pagination.page = 1
    loadList()
}

function handlePageChange(page: number) {
    pagination.page = page
    loadList()
}

/** 跳转到详情 */
function goDetail(id: string) {
    router.push(`/purchase/${id}`)
}

function getPaymentColor(status: string): 'success' | 'warning' | 'error' | 'default' {
    switch (status) {
        case 'paid': return 'success'
        case 'partial': return 'warning'
        case 'unpaid': return 'error'
        default: return 'default'
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

// ========== 表格列 ==========
const columns = computed<DataTableColumns<PurchaseOrderListItem>>(() => [
    { title: '单号', key: 'orderNo', width: 180, resizable: true },
    { title: '日期', key: 'createdAt', width: 160, resizable: true },
    { title: '供应商', key: 'supplierName', width: 150, resizable: true },
    { title: '经手人', key: 'handler', width: 100, render: (row) => h(NText, { depth: 3 }, { default: () => row.handler || '-' }) },
    {
        title: '付款状态',
        key: 'paymentStatus',
        width: 100,
        render: (row) => h(
            NTag, { type: getPaymentColor(row.paymentStatus), size: 'small', round: true },
            { default: () => getPaymentLabel(row.paymentStatus) }
        )
    },
    { title: '商品数', key: 'itemCount', width: 80, render: (row) => h(NText, { depth: 2 }, { default: () => `${row.itemCount} 项` }) },
    {
        title: '总金额',
        key: 'totalAmount',
        width: 120,
        render: (row) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => `¥${row.totalAmount.toFixed(2)}` })
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
                        { ghost: true, type: 'primary', size: 'small', onClick: () => router.push(`/purchase/${row.id}/edit`) },
                        {
                            icon: () => h('span', { class: 'i-mdi-pencil align-middle' }),
                            default: () => '编辑'
                        }
                    ),
                    h(
                        NButton,
                        { ghost: true, type: 'primary', size: 'small', onClick: () => goDetail(row.id) },
                        {
                            icon: () => h('span', { class: 'i-mdi-clipboard-text align-middle' }),
                            default: () => '详情'
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
    // 确保供应商列表已加载
    if (supplierStore.suppliers.length === 0) {
        await supplierStore.loadSuppliers(1, 100)
    }
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
