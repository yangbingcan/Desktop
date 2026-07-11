<!--
  @file 供应商列表页面
  @description 供应商档案管理 - 列表、搜索、新增、编辑、删除；详情抽屉含 Tabs 查看入库单、退货单、付款记录、财务流水
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标（替换 i-ic-*）、
            去除散落 margin、金额等宽 + 状态色走 NText type。
  @change v0.5.5 应用 ProductList 紧凑设计模式（tea-page/page-header/filter-card）
  @change v0.5.5 第五轮：操作列按钮对齐 ProductList（查看=tea-btn-text，编辑=ghost，删除=实色 error）
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-domain text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">供应商管理</span>
                </div>
                <n-button type="primary" @click="$router.push('/suppliers/new')">
                    <template #icon>
                        <span class="i-mdi-plus align-middle" />
                    </template>
                    新增供应商
                </n-button>
            </div>

            <!-- 搜索区 -->
            <n-card :bordered="false" class="filter-card">
                <n-space align="center" :wrap="true" :size="[12, 8]">
                    <n-input
                        v-model:value="filters.keyword"
                        placeholder="搜索供应商名称/联系人"
                        clearable
                        style="width: 260px"
                        @keyup.enter="handleSearch"
                    >
                        <template #prefix>
                            <span class="i-mdi-magnify align-middle" />
                        </template>
                    </n-input>
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

            <!-- 列表 -->
            <n-card :bordered="false" title="供应商列表" class="table-card">
                <template #header-extra>
                    <span class="text-[12px] text-[var(--tea-content-3)]">共 {{ suppliers.length }} 家供应商</span>
                </template>
                <n-data-table
                    :columns="columns"
                    :data="suppliers"
                    :loading="loading"
                    :pagination="pagination"
                    :bordered="false"
                    :single-line="false"
                    @update:page="handlePageChange"
                />
                <n-empty
                    v-if="!loading && suppliers.length === 0"
                    description="暂无供应商数据"
                    class="py-12"
                />
            </n-card>

            <!-- 供应商详情抽屉 -->
            <n-drawer v-model:show="drawerVisible" :width="640" placement="right">
                <n-drawer-content :body-style="{ padding: 0 }">
                    <template #header>
                        <n-space vertical :size="8">
                            <div class="flex items-center justify-between w-full">
                                <div class="flex items-center gap-2">
                                    <span class="i-mdi-domain text-[16px] align-middle text-tea-primary" />
                                    <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">
                                        {{ drawerSupplier?.name || '' }}
                                    </span>
                                </div>
                                <n-button
                                    v-if="drawerSupplier"
                                    size="small"
                                    type="primary"
                                    @click="goEdit(drawerSupplier.id)"
                                >
                                    <template #icon>
                                        <span class="i-mdi-pencil align-middle" />
                                    </template>
                                    编辑
                                </n-button>
                            </div>
                            <div v-if="supplierBalance" class="text-[13px] text-[var(--tea-content-3)]">
                                应付余额：
                                <n-text :type="supplierBalance.balance > 0 ? 'error' : 'success'" strong class="font-mono">
                                    ¥{{ supplierBalance.balance.toFixed(2) }}
                                </n-text>
                                &nbsp;|&nbsp;采购总额 ¥{{ supplierBalance.totalPurchase.toFixed(2) }}
                                &nbsp;|&nbsp;已付 ¥{{ supplierBalance.totalPaid.toFixed(2) }}
                                &nbsp;|&nbsp;退货冲抵 ¥{{ supplierBalance.totalReturn.toFixed(2) }}
                            </div>
                        </n-space>
                    </template>

                    <template v-if="drawerSupplier">
                        <n-tabs v-model:value="activeTab" type="line" :tabs-padding="16">
                            <!-- Tab 1: 基本信息 -->
                            <n-tab-pane name="info" tab="基本信息">
                                <div style="padding: 0 16px 16px;">
                                    <n-descriptions :column="2" bordered size="small" label-placement="left">
                                        <n-descriptions-item label="名称">
                                            {{ drawerSupplier.name }}
                                        </n-descriptions-item>
                                        <n-descriptions-item label="状态">
                                            <n-tag size="small" :bordered="false" :type="drawerSupplier.isActive ? 'success' : 'default'">
                                                {{ drawerSupplier.isActive ? '启用' : '停用' }}
                                            </n-tag>
                                        </n-descriptions-item>
                                        <n-descriptions-item label="联系人">
                                            {{ drawerSupplier.contactPerson || '-' }}
                                        </n-descriptions-item>
                                        <n-descriptions-item label="联系电话">
                                            {{ drawerSupplier.contactPhone || '-' }}
                                        </n-descriptions-item>
                                        <n-descriptions-item label="地址" :span="2">
                                            {{ drawerSupplier.address || '-' }}
                                        </n-descriptions-item>
                                        <n-descriptions-item label="主营品类" :span="2">
                                            <template v-if="drawerSupplier.mainCategories && drawerSupplier.mainCategories.length > 0">
                                                <n-space size="small">
                                                    <n-tag
                                                        v-for="c in drawerSupplier.mainCategories"
                                                        :key="c"
                                                        size="small"
                                                        round
                                                        :bordered="false"
                                                    >
                                                        {{ c }}
                                                    </n-tag>
                                                </n-space>
                                            </template>
                                            <span v-else>-</span>
                                        </n-descriptions-item>
                                        <n-descriptions-item label="备注" :span="2">
                                            {{ drawerSupplier.remark || '-' }}
                                        </n-descriptions-item>
                                        <n-descriptions-item label="创建时间">
                                            {{ drawerSupplier.createdAt }}
                                        </n-descriptions-item>
                                        <n-descriptions-item label="更新时间">
                                            {{ drawerSupplier.updatedAt }}
                                        </n-descriptions-item>
                                    </n-descriptions>
                                </div>
                            </n-tab-pane>

                            <!-- Tab 2: 入库单 -->
                            <n-tab-pane name="purchase" tab="入库单">
                                <div style="padding: 0 16px 16px;">
                                    <n-data-table
                                        :columns="purchaseColumns"
                                        :data="purchaseOrders"
                                        size="small"
                                        :bordered="false"
                                        :loading="purchaseLoading"
                                    />
                                </div>
                            </n-tab-pane>

                            <!-- Tab 3: 退货单 -->
                            <n-tab-pane name="return" tab="退货单">
                                <div style="padding: 0 16px 16px;">
                                    <n-data-table
                                        :columns="returnColumns"
                                        :data="returnOrders"
                                        size="small"
                                        :bordered="false"
                                        :loading="returnLoading"
                                    />
                                </div>
                            </n-tab-pane>

                            <!-- Tab 4: 付款记录 -->
                            <n-tab-pane name="payments" tab="付款记录">
                                <div style="padding: 0 16px 16px;">
                                    <n-data-table
                                        :columns="paymentColumns"
                                        :data="payments"
                                        size="small"
                                        :bordered="false"
                                        :loading="paymentLoading"
                                    />
                                </div>
                            </n-tab-pane>

                            <!-- Tab 5: 财务流水 -->
                            <n-tab-pane name="flow" tab="财务流水">
                                <div style="padding: 0 16px 16px;">
                                    <n-data-table
                                        :columns="flowColumns"
                                        :data="financialFlow"
                                        size="small"
                                        :bordered="false"
                                        :loading="flowLoading"
                                    />
                                </div>
                            </n-tab-pane>
                        </n-tabs>
                    </template>
                </n-drawer-content>
            </n-drawer>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 供应商列表逻辑
 * - 调用 supplierStore.loadSuppliers 加载列表
 * - 软删除时弹确认框
 * - 已有进货记录的供应商禁用删除按钮
 */
import { ref, reactive, onMounted, h, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
    NButton, NSpace, NPopconfirm, NTag, NText, useMessage,
    NDrawer, NDrawerContent, NDescriptions, NDescriptionsItem,
    NTabs, NTabPane, NDataTable
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useSupplierStore } from '@/stores'
import type { Supplier, SupplierPayment, FinancialFlowItem, SupplierBalance, PurchaseOrderListItem, ReturnOrderListItem } from '@/types'
import { getSupplierBalance, getSupplierPayments, getSupplierFinancialFlow } from '@/api/suppliers'
import { getPurchaseOrders } from '@/api/purchases'
import { getReturnOrders } from '@/api/returnOrders'

const router = useRouter()
const message = useMessage()
const supplierStore = useSupplierStore()

const loading = ref(false)
const suppliers = ref<Supplier[]>([])

const filters = reactive({
    keyword: ''
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
const drawerSupplier = ref<Supplier | null>(null)

// 余额
const supplierBalance = ref<SupplierBalance | null>(null)

// Tabs
const activeTab = ref('info')

// 入库单列表
const purchaseOrders = ref<PurchaseOrderListItem[]>([])
const purchaseLoading = ref(false)

// 退货单列表
const returnOrders = ref<ReturnOrderListItem[]>([])
const returnLoading = ref(false)

// 付款记录
const payments = ref<SupplierPayment[]>([])
const paymentLoading = ref(false)
const paymentPage = ref(1)
const paymentTotal = ref(0)

// 财务流水
const financialFlow = ref<FinancialFlowItem[]>([])
const flowLoading = ref(false)
const flowPage = ref(1)
const flowTotal = ref(0)

/** 付款方式映射 */
function paymentMethodLabel(method: string): string {
    const map: Record<string, string> = {
        cash: '现金',
        wechat: '微信',
        alipay: '支付宝',
        transfer: '对公转账',
        other: '其他'
    }
    return map[method] || method
}

/** 付款状态标签 */
function getPaymentStatusLabel(status: string): string {
    const map: Record<string, string> = {
        unpaid: '未付款',
        partial: '部分付款',
        paid: '已付款'
    }
    return map[status] || status
}

/** 付款状态颜色 */
function getPaymentStatusType(status: string): string {
    const map: Record<string, string> = {
        unpaid: 'warning',
        partial: 'info',
        paid: 'success'
    }
    return map[status] || 'default'
}

/** 打开抽屉查看供应商详情 */
function openDrawer(supplier: Supplier) {
    drawerSupplier.value = supplier
    activeTab.value = 'info'
    drawerVisible.value = true
    // 重置列表数据
    purchaseOrders.value = []
    returnOrders.value = []
    payments.value = []
    financialFlow.value = []
    // 加载余额
    loadBalance(supplier.id)
}

function goEdit(id: string) {
    drawerVisible.value = false
    router.push(`/suppliers/${id}/edit`)
}

/** 加载供应商余额 */
async function loadBalance(supplierId: string) {
    try {
        supplierBalance.value = await getSupplierBalance(supplierId)
    } catch (e) {
        console.error('加载供应商余额失败:', e)
    }
}

/** 加载入库单 */
async function loadPurchaseOrders(supplierId: string) {
    purchaseLoading.value = true
    try {
        const result = await getPurchaseOrders(1, 10, supplierId)
        purchaseOrders.value = result.list
    } catch (e) {
        console.error('加载入库单失败:', e)
    } finally {
        purchaseLoading.value = false
    }
}

/** 加载退货单 */
async function loadReturnOrders(supplierId: string) {
    returnLoading.value = true
    try {
        const result = await getReturnOrders(1, 10, supplierId)
        returnOrders.value = result.list
    } catch (e) {
        console.error('加载退货单失败:', e)
    } finally {
        returnLoading.value = false
    }
}

/** 加载付款记录 */
async function loadPayments(supplierId: string) {
    paymentLoading.value = true
    try {
        const result = await getSupplierPayments(supplierId, paymentPage.value, 10)
        payments.value = result.list
        paymentTotal.value = result.total
    } catch (e) {
        console.error('加载付款记录失败:', e)
    } finally {
        paymentLoading.value = false
    }
}

/** 加载财务流水 */
async function loadFinancialFlow(supplierId: string) {
    flowLoading.value = true
    try {
        const result = await getSupplierFinancialFlow(supplierId, flowPage.value, 10)
        financialFlow.value = result.list
        flowTotal.value = result.total
    } catch (e) {
        console.error('加载财务流水失败:', e)
    } finally {
        flowLoading.value = false
    }
}

/** 监听 Tab 切换时加载对应数据 */
watch(activeTab, (tab) => {
    if (!drawerSupplier.value) return
    const id = drawerSupplier.value.id
    if (tab === 'purchase') loadPurchaseOrders(id)
    if (tab === 'return') loadReturnOrders(id)
    if (tab === 'payments') loadPayments(id)
    if (tab === 'flow') loadFinancialFlow(id)
})

/** 加载列表 */
async function loadList() {
    loading.value = true
    try {
        const result = await supplierStore.loadSuppliers(
            pagination.page, pagination.pageSize, filters.keyword
        )
        suppliers.value = result.list
        pagination.total = result.total
    } catch (e: any) {
        message.error(`加载供应商失败: ${e}`)
    } finally {
        loading.value = false
    }
}

function handleSearch() {
    pagination.page = 1
    loadList()
}

function handleReset() {
    filters.keyword = ''
    pagination.page = 1
    loadList()
}

function handlePageChange(page: number) {
    pagination.page = page
    loadList()
}

/** 跳转到新增/编辑 */
function goEditPage(id?: string) {
    router.push(id ? `/suppliers/${id}/edit` : '/suppliers/new')
}

/** 删除供应商 */
async function handleDelete(row: Supplier) {
    try {
        await supplierStore.removeSupplier(row.id)
        message.success('删除成功')
        loadList()
    } catch (e: any) {
        message.error(`删除失败: ${e}`)
    }
}

// ========== 表格列 ==========
const columns = computed<DataTableColumns<Supplier>>(() => [
    { title: '名称', key: 'name', width: 160, resizable: true },
    {
        title: '联系人',
        key: 'contactPerson',
        width: 100,
        render: (row) => h(NText, { depth: 2 }, { default: () => row.contactPerson || '-' })
    },
    {
        title: '联系电话',
        key: 'contactPhone',
        width: 130,
        render: (row) => h(NText, { depth: 2 }, { default: () => row.contactPhone || '-' })
    },
    {
        title: '地址',
        key: 'address',
        minWidth: 200,
        ellipsis: { tooltip: true },
        render: (row) => h(NText, { depth: 2 }, { default: () => row.address || '-' })
    },
    {
        title: '主营品类',
        key: 'mainCategories',
        width: 200,
        render: (row) => {
            if (!row.mainCategories || row.mainCategories.length === 0) {
                return h(NText, { depth: 3 }, { default: () => '-' })
            }
            return h(
                NSpace,
                { size: 4, wrap: true },
                {
                    default: () => row.mainCategories.map(c =>
                        h(NTag, { type: 'default', size: 'small', round: true }, { default: () => c })
                    )
                }
            )
        }
    },
    {
        title: '状态',
        key: 'isActive',
        width: 80,
        render: (row) => h(
            NTag,
            { type: row.isActive ? 'success' : 'default', size: 'small', round: true },
            { default: () => row.isActive ? '启用' : '停用' }
        )
    },
    {
        title: '操作',
        key: 'actions',
        width: 200,
        fixed: 'right',
        render: (row) => h(
            NSpace,
            { size: 8 },
            {
                default: () => [
                    h(
                        NButton,
                        { text: true, type: 'primary', size: 'small', class: 'tea-btn-text', onClick: () => openDrawer(row) },
                        { default: () => '查看' }
                    ),
                    h(
                        NButton,
                        { ghost: true, type: 'primary', size: 'small', onClick: () => goEditPage(row.id) },
                        { default: () => '编辑' }
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
                                { default: () => '删除' }
                            ),
                            default: () => '确认删除该供应商？软删除后可停用但不可恢复。'
                        }
                    )
                ]
            }
        )
    }
])

// ========== 抽屉内表格列 ==========

/** 入库单表格列 */
const purchaseColumns: DataTableColumns<PurchaseOrderListItem> = [
    { title: '单号', key: 'orderNo', width: 160 },
    { title: '日期', key: 'createdAt', width: 150 },
    {
        title: '金额',
        key: 'totalAmount',
        width: 100,
        render: (row) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => `¥${row.totalAmount.toFixed(2)}` })
    },
    { title: '商品数', key: 'itemCount', width: 70 },
    {
        title: '付款状态',
        key: 'paymentStatus',
        width: 100,
        render: (row) => h(NTag, {
            size: 'small',
            bordered: false,
            type: getPaymentStatusType(row.paymentStatus) as any
        }, { default: () => getPaymentStatusLabel(row.paymentStatus) })
    }
]

/** 退货单表格列 */
const returnColumns: DataTableColumns<ReturnOrderListItem> = [
    { title: '单号', key: 'orderNo', width: 160 },
    { title: '日期', key: 'createdAt', width: 150 },
    {
        title: '金额',
        key: 'totalAmount',
        width: 100,
        render: (row) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => `¥${row.totalAmount.toFixed(2)}` })
    },
    { title: '退货原因', key: 'returnReason', width: 100, ellipsis: { tooltip: true } }
]

/** 付款记录表格列 */
const paymentColumns: DataTableColumns<SupplierPayment> = [
    { title: '日期', key: 'paymentDate', width: 100 },
    {
        title: '金额',
        key: 'amount',
        width: 100,
        render: (row) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => `¥${row.amount.toFixed(2)}` })
    },
    {
        title: '方式',
        key: 'paymentMethod',
        width: 80,
        render: (row) => paymentMethodLabel(row.paymentMethod)
    },
    { title: '备注', key: 'remark', ellipsis: { tooltip: true } }
]

/** 财务流水表格列 */
const flowColumns: DataTableColumns<FinancialFlowItem> = [
    { title: '日期', key: 'createdAt', width: 150 },
    { title: '类型', key: 'flowTypeName', width: 80 },
    { title: '单号', key: 'orderNo', width: 150, render: (row) => row.orderNo || '-' },
    {
        title: '金额',
        key: 'amount',
        width: 100,
        render: (row) => h(
            NText,
            { type: row.amount > 0 ? 'success' : 'error', class: 'font-mono' },
            { default: () => `¥${row.amount.toFixed(2)}` }
        )
    },
    { title: '备注', key: 'remark', ellipsis: { tooltip: true } }
]

onMounted(() => {
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
