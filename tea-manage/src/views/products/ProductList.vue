<!--
  @file 商品档案 - 列表页
  @description 商品档案管理：搜索筛选 + 表格 + 低库存预警 + 详情抽屉
  @refactor v0.6.0 统一深茶绿主题（n-config-provider themeOverrides）、
            Naive UI 组件化（n-card / n-space / n-text）、mdi 图标、
            真实库存联动（getInventory）、金额等宽 + 低库存变色。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 + 主操作 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-leaf text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">商品档案</span>
                </div>
                <n-button type="primary" @click="goNew">
                    <template #icon>
                        <span class="i-mdi-plus align-middle" />
                    </template>
                    新增商品
                </n-button>
            </div>

            <!-- 筛选区 -->
            <n-card :bordered="false" class="filter-card">
                <n-space align="center" :wrap="true" :size="[12, 8]">
                    <n-input
                        v-model:value="filters.keyword"
                        placeholder="搜索商品名称 / 编码"
                        clearable
                        style="width: 260px"
                        @keyup.enter="handleSearch"
                    >
                        <template #prefix>
                            <span class="i-mdi-magnify align-middle" />
                        </template>
                    </n-input>
                    <n-select
                        v-model:value="filters.categoryId"
                        :options="categoryOptions"
                        clearable
                        placeholder="商品分类"
                        style="width: 160px"
                    />
                    <n-select
                        v-model:value="filters.type"
                        :options="typeOptions"
                        clearable
                        placeholder="商品类型"
                        style="width: 150px"
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
            <n-card :bordered="false" :title="tableTitle" class="table-card">
                <template #header-extra>
                    <span class="text-[12px] text-[var(--tea-content-3)]">共 {{ products.length }} 个商品</span>
                </template>
                <n-data-table
                    :columns="columns"
                    :data="products"
                    :loading="loading"
                    :row-key="rowKey"
                    :scroll-x="scrollX"
                    :max-height="tableMaxHeight"
                    size="small"
                    striped
                    :flex-height="false"
                />
                <n-empty
                    v-if="!loading && products.length === 0"
                    description="暂无茶叶数据"
                    class="py-12"
                >
                    <template #extra>
                        <n-button size="small" type="primary" @click="goNew">
                            添加第一个商品
                        </n-button>
                    </template>
                </n-empty>
            </n-card>

            <!-- 商品详情抽屉 -->
            <n-drawer v-model:show="drawerVisible" :width="520" placement="right">
                <n-drawer-content :body-style="{ padding: '20px' }">
                    <template #header>
                        <div class="flex items-center justify-between w-full">
                            <div class="flex items-center gap-2">
                                <span class="i-mdi-tea text-[16px] align-middle text-tea-primary" />
                                <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">
                                    {{ drawerProduct ? drawerProduct.name : '商品详情' }}
                                </span>
                            </div>
                            <n-button
                                v-if="drawerProduct"
                                size="small"
                                type="primary"
                                @click="goEdit(drawerProduct.id)"
                            >
                                <template #icon>
                                    <span class="i-mdi-pencil align-middle" />
                                </template>
                                编辑
                            </n-button>
                        </div>
                    </template>

                    <n-spin :show="drawerLoading">
                        <template v-if="drawerProduct">
                            <n-descriptions :column="2" bordered size="small" label-placement="left">
                                <n-descriptions-item label="商品名称">{{ drawerProduct.name }}</n-descriptions-item>
                                <n-descriptions-item label="编码">{{ drawerProduct.code }}</n-descriptions-item>
                                <n-descriptions-item label="分类">{{ getCategoryName(drawerProduct.categoryId) }}</n-descriptions-item>
                                <n-descriptions-item label="类型">
                                    <n-tag size="small" :bordered="false" :type="drawerProduct.type === 'weight' ? 'warning' : 'info'">
                                        {{ drawerProduct.type === 'weight' ? '称重类' : '计件类' }}
                                    </n-tag>
                                </n-descriptions-item>
                                <n-descriptions-item label="基准单位">{{ drawerProduct.baseUnit === 'g' ? '克(g)' : '个(pcs)' }}</n-descriptions-item>
                                <n-descriptions-item label="产地">{{ drawerProduct.origin || '-' }}</n-descriptions-item>
                                <n-descriptions-item label="年份">{{ drawerProduct.year || '-' }}</n-descriptions-item>
                                <n-descriptions-item label="等级">{{ drawerProduct.grade || '-' }}</n-descriptions-item>
                                <n-descriptions-item label="发酵程度">{{ drawerProduct.fermentationLevel ? fermentationLabelMap[drawerProduct.fermentationLevel] || drawerProduct.fermentationLevel : '-' }}</n-descriptions-item>
                                <n-descriptions-item label="焙火程度">{{ drawerProduct.roastLevel ? roastLabelMap[drawerProduct.roastLevel] || drawerProduct.roastLevel : '-' }}</n-descriptions-item>
                                <n-descriptions-item label="创建时间">{{ drawerProduct.createdAt }}</n-descriptions-item>
                                <n-descriptions-item label="更新时间">{{ drawerProduct.updatedAt }}</n-descriptions-item>
                            </n-descriptions>

                            <n-divider title-placement="left">销售单位</n-divider>

                            <n-data-table
                                :columns="unitColumns"
                                :data="drawerUnits"
                                size="small"
                                :bordered="false"
                                :single-line="false"
                            />
                        </template>
                    </n-spin>
                </n-drawer-content>
            </n-drawer>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 商品档案 - 列表页逻辑
 * @description 搜索筛选 + 表格 + 低库存预警 + 详情抽屉
 *
 * 设计要点：
 * 1. 表格行数据（ProductRow）在商品基础字段上补充：销售单位数、首单位零售/会员价、实时库存（克/个）
 * 2. 库存来自 getInventory() 一次拉取并按时 productId 建索引，避免逐商品请求
 * 3. 低库存按基准单位区分阈值：称重类 < 500g / 计件类 < 20 个 → warning，归零 → error
 * 4. 金额统一 toLocaleString 两位小数 + font-mono 等宽；状态色走 NText type，自动适配深浅主题
 */
import { ref, reactive, computed, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import {
    NButton, NTag, NText, NSpace, NPopconfirm,
    NDrawer, NDrawerContent, NDescriptions, NDescriptionsItem, NDivider, NSpin
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useProductStore } from '@/stores'
import { getCategories, getProduct, getProductUnits } from '@/api/products'
import { getInventory } from '@/api/inventory'
import type { Product, ProductCategory, SalesUnit, InventoryItem, ProductType } from '@/types'

/** 表格行：商品基础字段 + 列表展示所需的派生字段 */
interface ProductRow extends Product {
    /** 销售单位数量 */
    unitCount: number
    /** 首个销售单位零售价（用于列表快速预览） */
    retailPrice?: number
    /** 首个销售单位会员价 */
    memberPrice?: number
    /** 称重库存（克） */
    stockGrams: number
    /** 计件库存（个） */
    stockUnits: number
}

const router = useRouter()
const productStore = useProductStore()

// ========== 状态 ==========
const loading = ref(false)
/** 全量数据（含库存/单位），筛选在此之上进行，避免重复请求 */
const allRows = ref<ProductRow[]>([])
/** 当前展示数据（已应用筛选） */
const products = ref<ProductRow[]>([])
const categories = ref<ProductCategory[]>([])

/** 低库存阈值：按基准单位区分，低于阈值触发 warning，归零触发 error */
const LOW_STOCK_GRAMS = 500
const LOW_STOCK_UNITS = 20

// ========== 筛选 ==========
const filters = reactive({
    categoryId: null as string | null,
    type: null as ProductType | null,
    keyword: ''
})

const categoryOptions = computed(() =>
    categories.value.map(c => ({ label: c.name, value: c.id }))
)

const typeOptions = [
    { label: '称重类', value: 'weight' as ProductType },
    { label: '计件类', value: 'count' as ProductType }
]

// ========== 工具方法 ==========
function getCategoryName(categoryId: string | null): string {
    return categories.value.find(c => c.id === categoryId)?.name || '-'
}

/** 金额格式化：保留两位小数 + 千分位 */
function formatMoney(n?: number): string {
    if (n == null) return '-'
    return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 整数千分位 */
function formatInt(n: number): string {
    return n.toLocaleString('zh-CN')
}

/**
 * 计算库存展示文本与预警级别
 * level: error（归零）/ warning（低于阈值）/ normal
 */
function getStockInfo(row: ProductRow): { text: string; level: 'error' | 'warning' | 'normal' } {
    const isWeight = row.type === 'weight'
    const value = isWeight ? row.stockGrams : row.stockUnits
    const threshold = isWeight ? LOW_STOCK_GRAMS : LOW_STOCK_UNITS
    const text = isWeight ? `${formatInt(value)} g` : `${formatInt(value)} 个`
    let level: 'error' | 'warning' | 'normal' = 'normal'
    if (value <= 0) level = 'error'
    else if (value < threshold) level = 'warning'
    return { text, level }
}

/** 发酵程度标签映射 */
const fermentationLabelMap: Record<string, string> = {
    none: '不发酵',
    light: '轻发酵',
    half: '半发酵',
    full: '全发酵'
}

/** 焙火程度标签映射 */
const roastLabelMap: Record<string, string> = {
    light: '轻火',
    medium: '中火',
    full: '足火',
    heavy: '重火'
}

// ========== 表格列 ==========
const tableTitle = '商品列表'
const rowKey = (row: ProductRow) => row.id

const columns: DataTableColumns<ProductRow> = [
    {
        title: '编码', key: 'code', width: 140, fixed: 'left', resizable: true, minWidth: 120,
        render: (row) => h(NText, { depth: 2 }, { default: () => row.code })
    },
    {
        title: '名称', key: 'name', width: 200, fixed: 'left', ellipsis: { tooltip: true }, resizable: true, minWidth: 160,
        render: (row) => h(NText, { strong: true }, { default: () => row.name })
    },
    {
        title: '分类', key: 'categoryId', width: 110, resizable: true, minWidth: 90,
        render: (row) => h(NText, { depth: 3 }, { default: () => getCategoryName(row.categoryId) })
    },
    {
        title: '类型', key: 'type', width: 90, resizable: true, minWidth: 80,
        render: (row) => h(NTag, { size: 'small', bordered: false, type: row.type === 'weight' ? 'warning' : 'info' },
            { default: () => row.type === 'weight' ? '称重类' : '计件类' })
    },
    {
        title: '基准单位', key: 'baseUnit', width: 92, resizable: true, minWidth: 80,
        render: (row) => h(NText, { depth: 3 }, { default: () => row.baseUnit === 'g' ? '克(g)' : '个(pcs)' })
    },
    {
        title: '产地', key: 'origin', width: 130, resizable: true, minWidth: 100, ellipsis: { tooltip: true },
        render: (row) => h(NText, { depth: 3 }, { default: () => row.origin || '-' })
    },
    {
        title: '年份', key: 'year', width: 80, align: 'center', resizable: true, minWidth: 60,
        render: (row) => h(NText, { depth: 3 }, { default: () => row.year || '-' })
    },
    {
        title: '等级', key: 'grade', width: 90, resizable: true, minWidth: 70,
        render: (row) => h(NText, { depth: 3 }, { default: () => row.grade || '-' })
    },
    {
        title: '发酵', key: 'fermentationLevel', width: 90, resizable: true, minWidth: 70,
        render: (row) => h(NText, { depth: 3 },
            { default: () => row.fermentationLevel ? fermentationLabelMap[row.fermentationLevel] || row.fermentationLevel : '-' })
    },
    {
        title: '焙火', key: 'roastLevel', width: 80, resizable: true, minWidth: 60,
        render: (row) => h(NText, { depth: 3 },
            { default: () => row.roastLevel ? roastLabelMap[row.roastLevel] || row.roastLevel : '-' })
    },
    {
        title: '销售单位', key: 'unitCount', width: 100, align: 'center', resizable: true, minWidth: 90,
        render: (row) => h(NText, { depth: 2 }, { default: () => `${row.unitCount} 个` })
    },
    {
        title: '零售价', key: 'retailPrice', width: 120, align: 'right', resizable: true, minWidth: 100,
        render: (row) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => formatMoney(row.retailPrice) })
    },
    {
        title: '会员价', key: 'memberPrice', width: 120, align: 'right', resizable: true, minWidth: 100,
        render: (row) => h(NText, { type: 'success', class: 'font-mono' }, { default: () => formatMoney(row.memberPrice) })
    },
    {
        title: '总库存', key: 'totalStock', width: 120, align: 'right', resizable: true, minWidth: 100,
        render: (row) => {
            const { text, level } = getStockInfo(row)
            const type = level === 'error' ? 'error' : level === 'warning' ? 'warning' : undefined
            return h(NText, { type, class: 'font-mono' }, { default: () => text })
        }
    },
    {
        title: '状态', key: 'isActive', width: 80, align: 'center', resizable: true, minWidth: 70,
        render: (row) => h(NTag, { size: 'small', bordered: false, type: row.isActive ? 'success' : 'default' },
            { default: () => row.isActive ? '在售' : '下架' })
    },
    {
        title: '更新时间', key: 'updatedAt', width: 150, resizable: true, minWidth: 130,
        render: (row) => h(NText, { depth: 3, class: 'text-[11px]' },
            { default: () => (row.updatedAt || '').slice(0, 16).replace('T', ' ') })
    },
    {
        title: '操作', key: 'actions', width: 210, fixed: 'right',
        render: (row) => h(NSpace, { size: 'small', wrap: false }, {
            default: () => [
                h(NButton, { size: 'small', type: 'primary', text: true, onClick: () => openDrawer(row) }, {
                    icon: () => h('span', { class: 'i-mdi-eye align-middle' }),
                    default: () => '查看'
                }),
                h(NButton, { size: 'small', type: 'primary', ghost: true, onClick: () => handleEdit(row) }, {
                    icon: () => h('span', { class: 'i-mdi-pencil align-middle' }),
                    default: () => '编辑'
                }),
                h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
                    trigger: () => h(NButton, { size: 'small', type: 'error' }, {
                        icon: () => h('span', { class: 'i-mdi-delete align-middle' }),
                        default: () => '删除'
                    }),
                    default: () => '确定删除该商品？'
                })
            ]
        })
    }
]

/** 抽屉内销售单位表格列 */
const unitColumns: DataTableColumns<SalesUnit> = [
    { title: '单位', key: 'name', width: 90 },
    {
        title: '换算比', key: 'conversionToBase', width: 90,
        render: (row) => h(NText, { depth: 2, class: 'font-mono' }, { default: () => String(row.conversionToBase) })
    },
    {
        title: '零售价', key: 'retailPrice', width: 120, align: 'right',
        render: (row) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => formatMoney(row.retailPrice) })
    },
    {
        title: '会员价', key: 'memberPrice', width: 120, align: 'right',
        render: (row) => h(NText, { type: 'success', class: 'font-mono' }, { default: () => formatMoney(row.memberPrice) })
    }
]

/** 表格最小宽度（触发横向滚动） */
const scrollX = computed(() =>
    columns.reduce((sum, col) => sum + ((col.width as number) || (col.minWidth as number) || 100), 0)
)

/** 表格最大高度 - 自适应窗口 */
const tableMaxHeight = computed(() => Math.max(420, window.innerHeight - 300))

// ========== 数据加载 ==========
async function loadAll() {
    loading.value = true
    try {
        await productStore.loadProducts()
        const list = productStore.products

        // 一次拉取全量库存，按 productId 建索引
        const invRes = await getInventory(1, 1000).catch(() => ({ list: [] as InventoryItem[] }))
        const invMap = new Map<string, InventoryItem>()
        ;(invRes.list || []).forEach((it) => invMap.set(it.productId, it))

        // 并行补充销售单位（用于单位数 + 首单位价格）
        const rows = await Promise.all(list.map(async (p) => {
            const units = await getProductUnits(p.id).catch(() => [] as SalesUnit[])
            const inv = invMap.get(p.id)
            const first = units[0]
            return {
                ...p,
                unitCount: units.length,
                retailPrice: first?.retailPrice,
                memberPrice: first?.memberPrice,
                stockGrams: inv?.stockGrams ?? 0,
                stockUnits: inv?.stockUnits ?? 0
            } as ProductRow
        }))

        allRows.value = rows
        applyFilters()
    } finally {
        loading.value = false
    }
}

/** 在 allRows 之上应用当前筛选条件 */
function applyFilters() {
    const kw = filters.keyword.trim().toLowerCase()
    const cid = filters.categoryId
    const t = filters.type
    products.value = allRows.value.filter((p) => {
        if (cid && p.categoryId !== cid) return false
        if (t && p.type !== t) return false
        if (kw) {
            return p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw)
        }
        return true
    })
}

function handleSearch() {
    applyFilters()
}

function handleReset() {
    filters.keyword = ''
    filters.categoryId = null
    filters.type = null
    applyFilters()
}

// ========== 抽屉 ==========
const drawerVisible = ref(false)
const drawerLoading = ref(false)
const drawerProduct = ref<Product | null>(null)
const drawerUnits = ref<SalesUnit[]>([])

async function openDrawer(product: Product) {
    drawerVisible.value = true
    drawerLoading.value = true
    drawerUnits.value = []
    try {
        drawerProduct.value = await getProduct(product.id)
        drawerUnits.value = await getProductUnits(product.id).catch(() => [])
    } catch (error) {
        console.error('加载商品详情失败:', error)
    } finally {
        drawerLoading.value = false
    }
}

function goEdit(id: string) {
    drawerVisible.value = false
    router.push(`/products/${id}/edit`)
}

function handleEdit(product: Product) {
    router.push(`/products/${product.id}/edit`)
}

async function handleDelete(id: string) {
    try {
        await productStore.deleteProductById(id)
        allRows.value = allRows.value.filter(p => p.id !== id)
        products.value = products.value.filter(p => p.id !== id)
    } catch (error) {
        console.error('删除失败:', error)
    }
}

function goNew() {
    router.push('/products/new')
}

async function loadCategoriesSafe() {
    try {
        categories.value = await getCategories()
    } catch (error) {
        console.error('加载分类失败:', error)
    }
}

onMounted(() => {
    loadCategoriesSafe()
    loadAll()
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
