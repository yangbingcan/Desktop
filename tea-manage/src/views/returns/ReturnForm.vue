<!--
  @file 退货出库单表单
  @description 选择供应商 → 选择商品 → 自动加载该商品可用批次 → 选批次 → 输入数量（NInputNumber 实时改数量/小计）
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标（去除 i-ic-*）、
            n-space 统一间距、n-text 金额等宽。
  注：仅改 TEMPLATE 与 STYLE，业务逻辑（商品弹窗/批次选择/明细增删/金额汇总/提交）原样保留。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 + 返回 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-undo-variant text-[18px] align-middle text-[var(--tea-primary)]" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">
                        {{ isEdit ? '编辑退货单' : '新增退货单' }}
                    </span>
                </div>
                <n-button @click="$router.back()">
                    <template #icon>
                        <span class="i-mdi-arrow-left align-middle" />
                    </template>
                    返回
                </n-button>
            </div>

            <!-- 顶部：供应商/日期/原因 -->
            <n-card :bordered="false">
                <n-form label-placement="left" label-width="100">
                    <n-form-item label="供应商" required>
                        <n-select
                            v-model:value="form.supplierId"
                            :options="supplierOptions"
                            filterable
                            placeholder="请选择供应商"
                            style="width: 300px"
                        />
                    </n-form-item>
                    <n-form-item label="退货日期" required>
                        <n-date-picker
                            v-model:value="form.returnDate"
                            type="date"
                            style="width: 200px"
                        />
                    </n-form-item>
                    <n-form-item label="退货原因" required>
                        <n-select
                            v-model:value="form.returnReason"
                            :options="reasonOptions"
                            placeholder="请选择退货原因"
                            style="width: 180px"
                        />
                    </n-form-item>
                    <n-form-item label="备注">
                        <n-input
                            v-model:value="form.remark"
                            type="textarea"
                            placeholder="可填写退货详细说明"
                            :autosize="{ minRows: 2, maxRows: 4 }"
                            style="width: 500px"
                        />
                    </n-form-item>
                </n-form>
            </n-card>

            <!-- 退货明细 -->
            <n-card :bordered="false" title="退货明细">
                <template #header-extra>
                    <n-button type="primary" size="small" :disabled="!form.supplierId" @click="showProductModal = true">
                        <template #icon>
                            <span class="i-mdi-plus align-middle" />
                        </template>
                        添加退货商品
                    </n-button>
                </template>

                <n-data-table
                    :columns="itemColumns"
                    :data="form.items"
                    :bordered="false"
                    :single-line="false"
                    size="small"
                >
                    <template #empty>
                        <n-empty description="请先选择供应商，再添加退货商品" />
                    </template>
                </n-data-table>
            </n-card>

            <!-- 金额汇总 -->
            <n-card :bordered="false">
                <n-space align="center" :size="20">
                    <span class="text-[var(--tea-content-2)]">退货总金额：</span>
                    <n-text type="error" class="font-mono text-[18px] font-semibold">
                        ¥{{ totalAmount.toFixed(2) }}
                    </n-text>
                </n-space>
            </n-card>

            <!-- 操作 -->
            <n-space :size="12">
                <n-button type="primary" :loading="saving" size="large" @click="handleSubmit">
                    <template #icon>
                        <span class="i-mdi-content-save align-middle" />
                    </template>
                    {{ isEdit ? '保存' : '保存退货单' }}
                </n-button>
                <n-button size="large" @click="$router.back()">
                    <template #icon>
                        <span class="i-mdi-close align-middle" />
                    </template>
                    取消
                </n-button>
            </n-space>

            <!-- 选择商品弹窗 -->
            <n-modal v-model:show="showProductModal" :mask-closable="false">
                <n-card title="选择退货商品" style="width: 800px" closable @close="showProductModal = false">
                    <template #header-extra>
                        <span class="i-mdi-cube-outline text-[18px] align-middle text-[var(--tea-primary)]" />
                    </template>
                    <n-input
                        v-model:value="productSearch"
                        placeholder="搜索商品名称"
                        clearable
                    >
                        <template #prefix>
                            <span class="i-mdi-magnify align-middle" />
                        </template>
                    </n-input>

                    <n-data-table
                        class="mt-3"
                        :columns="productColumns"
                        :data="filteredProducts"
                        :max-height="400"
                        :bordered="false"
                        size="small"
                    />

                    <template #footer>
                        <n-space justify="end">
                            <n-button @click="showProductModal = false">关闭</n-button>
                        </n-space>
                    </template>
                </n-card>
            </n-modal>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 退货单表单逻辑
 *
 * 核心交互：
 * 1. 选供应商后才能添加商品
 * 2. 选商品 → 加载该商品的销售单位 + 可用批次
 * 3. 选批次 → 校验退货数量 <= 批次剩余
 * 4. 保存 → createReturnOrder
 */
import { ref, reactive, onMounted, h, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
    NCard, NForm, NFormItem, NInput, NSelect, NDatePicker,
    NButton, NSpace, NDataTable, NEmpty, NInputNumber, NModal,
    NPopconfirm, NText, useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useSupplierStore, useProductStore } from '@/stores'
import type {
    Supplier, Product, SalesUnit, BatchOption,
    ReturnOrderInput, ReturnItemInput, InventoryItem
} from '@/types'
import { getProducts } from '@/api/products'
import { getInventory } from '@/api/inventory'
import { getAvailableBatches, createReturnOrder, updateReturnOrder, getReturnOrderDetail, RETURN_REASON_OPTIONS } from '@/api/returnOrders'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const supplierStore = useSupplierStore()
const productStore = useProductStore()

const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const loadingDetail = ref(false)
const showProductModal = ref(false)
const productSearch = ref('')

const supplierOptions = ref<{ label: string; value: string }[]>([])
const products = ref<Product[]>([])
/** 商品ID -> 库存克数 */
const stockMap = ref<Map<string, number>>(new Map())

const form = reactive<{
    supplierId: string
    returnDate: number
    returnReason: string
    remark: string
    items: Array<ReturnItemInput & {
        productName: string
        unitName: string
        conversion: number
        batchCode: string
        purchasePrice: number
        remainingGrams: number
    }>
}>({
    supplierId: '',
    returnDate: Date.now(),
    returnReason: '',
    remark: '',
    items: []
})

/** 退货原因下拉 */
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

/** 加载商品列表和库存 */
async function loadProducts() {
    try {
        const [productList, inventoryResult] = await Promise.all([
            getProducts(),
            getInventory(1, 1000)
        ])
        products.value = productList
        // 库存映射
        const map = new Map<string, number>()
        inventoryResult.list.forEach((item: InventoryItem) => {
            map.set(item.productId, item.stockGrams)
        })
        stockMap.value = map
    } catch (e: any) {
        message.error(`加载商品失败: ${e}`)
    }
}

/** 过滤后的商品列表（按关键词） */
const filteredProducts = computed(() => {
    const kw = productSearch.value.trim().toLowerCase()
    if (!kw) return products.value
    return products.value.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        (p.code || '').toLowerCase().includes(kw)
    )
})

/** 总金额 */
const totalAmount = computed(() => {
    return form.items.reduce((sum, item) => {
        return sum + (item.purchasePrice * item.quantity)
    }, 0)
})

// ========== 表格列：退货明细 ==========
const itemColumns = computed<DataTableColumns<typeof form.items[number]>>(() => [
    { title: '商品名称', key: 'productName', width: 160, ellipsis: { tooltip: true } },
    { title: '销售单位', key: 'unitName', width: 80 },
    {
        title: '原批次',
        key: 'batchCode',
        width: 160,
        ellipsis: { tooltip: true }
    },
    {
        title: '批次剩余',
        key: 'remainingGrams',
        width: 100,
        render: (row) => h(NText, { depth: 2 }, { default: () => `${row.remainingGrams}g` })
    },
    {
        title: '退货单价',
        key: 'purchasePrice',
        width: 100,
        render: (row) => h(NText, { class: 'font-mono' }, { default: () => `¥${row.purchasePrice.toFixed(2)}` })
    },
    {
        title: '退货数量',
        key: 'quantity',
        width: 130,
        render: (row, index) => h(
            NInputNumber,
            {
                value: row.quantity,
                min: 1,
                max: Math.floor(row.remainingGrams / row.conversion) || 1,
                precision: 0,
                size: 'small',
                style: 'width: 110px',
                onUpdateValue: (val) => {
                    if (val !== null && val !== undefined) {
                        form.items[index].quantity = val
                    }
                }
            }
        )
    },
    {
        title: '小计(元)',
        key: 'subtotal',
        width: 100,
        render: (row) => h(NText, { type: 'error', class: 'font-mono' }, { default: () => `¥${(row.purchasePrice * row.quantity).toFixed(2)}` })
    },
    {
        title: '操作',
        key: 'actions',
        width: 80,
        render: (_row, index) => h(
            NPopconfirm,
            {
                onPositiveClick: () => form.items.splice(index, 1),
                positiveText: '确定',
                negativeText: '取消'
            },
            {
                trigger: () => h(
                    NButton,
                    { text: true, type: 'error', size: 'small' },
                    {
                        icon: () => h('span', { class: 'i-mdi-delete align-middle' }),
                        default: () => '移除'
                    }
                ),
                default: () => '确认移除该退货商品？'
            }
        )
    }
])

// ========== 表格列：选择商品弹窗 ==========
const productColumns = computed<DataTableColumns<Product>>(() => [
    { title: '编码', key: 'code', width: 100 },
    { title: '名称', key: 'name', width: 200, ellipsis: { tooltip: true } },
    {
        title: '类型',
        key: 'type',
        width: 80,
        render: (row) => h(NText, { depth: 3 }, { default: () => row.type === 'weight' ? '称重' : '计件' })
    },
    {
        title: '当前库存',
        key: 'stockGrams',
        width: 110,
        render: (row) => {
            const stock = stockMap.value.get(row.id) || 0
            return h(NText, { depth: 2 }, { default: () => `${stock}g` })
        }
    },
    {
        title: '操作',
        key: 'actions',
        width: 100,
        render: (row) => h(
            NButton,
            {
                type: 'primary',
                size: 'small',
                onClick: () => handleSelectProduct(row)
            },
            {
                icon: () => h('span', { class: 'i-mdi-plus align-middle' }),
                default: () => '选择'
            }
        )
    }
])

/** 处理选择商品：加载该商品的销售单位和批次 */
async function handleSelectProduct(product: Product) {
    try {
        // 1. 获取商品的销售单位
        const units: SalesUnit[] = await productStore.loadProductUnits(product.id)
        if (!units || units.length === 0) {
            message.error('该商品未配置销售单位')
            return
        }

        // 2. 获取可用批次
        const batches: BatchOption[] = await getAvailableBatches(product.id)
        if (!batches || batches.length === 0) {
            message.error('该商品没有可用批次（库存为 0）')
            return
        }

        // 3. 默认选择第一个销售单位 + 第一个批次
        const unit = units[0]
        const batch = batches[0]

        // 4. 添加到明细
        form.items.push({
            productId: product.id,
            productName: product.name,
            unitId: unit.id,
            unitName: unit.name,
            conversion: unit.conversionToBase,
            batchId: batch.id,
            batchCode: batch.batchCode,
            purchasePrice: batch.purchasePrice,
            remainingGrams: batch.remainingGrams,
            quantity: 1
        })

        // 5. 关闭弹窗
        showProductModal.value = false
        productSearch.value = ''
    } catch (e: any) {
        message.error(`加载商品详情失败: ${e}`)
    }
}

// ========== 编辑模式 - 加载退货单详情 ==========

/** 编辑模式下加载已有退货单 */
async function loadReturnOrder() {
    if (!isEdit.value) return
    loadingDetail.value = true
    try {
        const detail = await getReturnOrderDetail(route.params.id as string)
        form.supplierId = detail.supplierId
        form.returnDate = new Date(detail.returnDate).getTime()
        form.returnReason = detail.returnReason
        form.remark = detail.remark || ''
        form.items = detail.items.map(item => ({
            productId: item.productId,
            unitId: item.unitId,
            batchId: item.batchId,
            quantity: item.quantity,
            productName: item.productName,
            unitName: item.unitName,
            conversion: item.grams / item.quantity,
            batchCode: item.batchCode,
            purchasePrice: item.unitPrice,
            remainingGrams: item.grams
        }))
    } catch (e) {
        message.error('加载退货单失败')
    } finally {
        loadingDetail.value = false
    }
}

/** 提交 */
async function handleSubmit() {
    // 1. 校验
    if (!form.supplierId) {
        message.warning('请选择供应商')
        return
    }
    if (!form.returnReason) {
        message.warning('请选择退货原因')
        return
    }
    if (form.items.length === 0) {
        message.warning('请添加退货商品')
        return
    }
    // 数量校验
    for (const item of form.items) {
        if (item.quantity <= 0) {
            message.warning(`商品 [${item.productName}] 退货数量必须大于 0`)
            return
        }
        if (item.quantity * item.conversion > item.remainingGrams) {
            message.warning(
                `商品 [${item.productName}] 退货数量 (${item.quantity * item.conversion}g) 超过批次剩余 (${item.remainingGrams}g)`
            )
            return
        }
    }

    // 2. 构造提交数据
    const returnDate = new Date(form.returnDate)
    const dateStr = returnDate.toISOString().slice(0, 10)

    const input: ReturnOrderInput = {
        supplierId: form.supplierId,
        returnDate: dateStr,
        returnReason: form.returnReason as any,
        remark: form.remark.trim() || undefined,
        items: form.items.map(i => ({
            productId: i.productId,
            unitId: i.unitId,
            batchId: i.batchId,
            quantity: i.quantity
        }))
    }

    saving.value = true
    try {
        if (isEdit.value) {
            await updateReturnOrder(route.params.id as string, input)
            message.success('退货单更新成功')
            router.push('/returns')
        } else {
            const result = await createReturnOrder(input)
            message.success(`退货单 [${result.orderNo}] 创建成功`)
            router.push(`/returns/${result.id}`)
        }
    } catch (e: any) {
        message.error(`保存失败: ${e}`)
    } finally {
        saving.value = false
    }
}

// 监听商品变化时重新校验最大退货数
watch(() => form.items.map(i => `${i.productId}-${i.batchId}`), () => {
    // 这里不需要做特殊处理，NInputNumber 的 max 是响应式的
})

onMounted(async () => {
    await loadSuppliers()
    await loadProducts()
    await loadReturnOrder()
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
