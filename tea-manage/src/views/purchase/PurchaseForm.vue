<!--
  @file 采购入库单表单
  @description 新增 / 编辑采购入库单 - 供应商 + 商品搜索弹窗 + 单位选择弹窗 + 明细增删 + 金额汇总
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标（去除 @vicons/ionicons5 与 i-ic-*）、
            n-space 统一间距、n-text 金额等宽。
  注：仅改 TEMPLATE 与 STYLE，业务逻辑（商品搜索/单位选择/明细增删/金额汇总/提交）原样保留。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 + 返回 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-archive-outline text-[18px] align-middle text-[var(--tea-primary)]" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">
                        {{ isEdit ? '编辑入库单' : '新增入库单' }}
                    </span>
                </div>
                <n-button @click="$router.back()">
                    <template #icon>
                        <span class="i-mdi-arrow-left align-middle" />
                    </template>
                    返回
                </n-button>
            </div>

            <!-- 入库单基本信息 -->
            <n-card :bordered="false">
                <n-form label-placement="left" label-width="80">
                    <n-form-item label="供应商">
                        <n-select
                            v-model:value="form.supplierId"
                            :options="supplierOptions"
                            filterable
                            placeholder="请选择供应商"
                            style="width: 300px"
                        />
                    </n-form-item>
                    <n-form-item label="入库日期">
                        <n-date-picker
                            v-model:value="form.date"
                            type="date"
                            style="width: 200px"
                        />
                    </n-form-item>
                    <n-form-item label="经手人">
                        <n-input
                            v-model:value="form.handler"
                            placeholder="请输入经手人"
                            style="width: 200px"
                        />
                    </n-form-item>
                    <n-form-item label="备注">
                        <n-input
                            v-model:value="form.remark"
                            type="textarea"
                            placeholder="请输入备注"
                            style="width: 400px"
                        />
                    </n-form-item>
                </n-form>
            </n-card>

            <!-- 商品明细 -->
            <n-card :bordered="false" title="入库商品">
                <template #header-extra>
                    <n-button type="primary" size="small" @click="showSearchModal = true">
                        <template #icon>
                            <span class="i-mdi-plus align-middle" />
                        </template>
                        添加商品
                    </n-button>
                </template>

                <n-data-table
                    :columns="itemColumns"
                    :data="form.items"
                    size="small"
                    :bordered="false"
                    :single-line="false"
                >
                    <template #empty>
                        <n-empty description="请添加入库商品" />
                    </template>
                </n-data-table>
            </n-card>

            <!-- 金额汇总 -->
            <n-card :bordered="false">
                <n-space align="center" :size="24">
                    <div class="flex items-center gap-2">
                        <span class="text-[var(--tea-content-2)]">总金额：</span>
                        <n-text type="warning" class="font-mono text-[18px] font-semibold">
                            ¥{{ totalAmount.toFixed(2) }}
                        </n-text>
                    </div>
                    <n-space align="center" :size="8">
                        <span class="text-[var(--tea-content-2)]">付款状态：</span>
                        <n-select
                            v-model:value="form.paymentStatus"
                            :options="paymentOptions"
                            style="width: 130px"
                        />
                    </n-space>
                </n-space>
            </n-card>

            <!-- 操作按钮 -->
            <n-space :size="12">
                <n-button type="primary" :loading="saving" size="large" @click="handleSubmit">
                    <template #icon>
                        <span class="i-mdi-content-save align-middle" />
                    </template>
                    {{ isEdit ? '保存' : '创建' }}
                </n-button>
                <n-button size="large" @click="$router.back()">
                    <template #icon>
                        <span class="i-mdi-close align-middle" />
                    </template>
                    取消
                </n-button>
            </n-space>

            <!-- 搜索商品弹窗 -->
            <n-modal v-model:show="showSearchModal" preset="card" title="选择商品" style="width: 700px">
                <template #header-extra>
                    <span class="i-mdi-cube-outline text-[18px] align-middle text-[var(--tea-primary)]" />
                </template>
                <n-input
                    v-model:value="productSearch"
                    placeholder="搜索商品名称/编码（模糊搜索）"
                    clearable
                >
                    <template #prefix>
                        <span class="i-mdi-magnify align-middle" />
                    </template>
                </n-input>
                <div class="text-[12px] text-[var(--tea-content-3)]">
                    共 {{ filteredProducts.length }} 个商品
                </div>
                <n-data-table
                    :columns="searchColumns"
                    :data="filteredProducts"
                    size="small"
                    :bordered="false"
                    :max-height="400"
                />
            </n-modal>

            <!-- 选择单位弹窗 -->
            <n-modal v-model:show="showUnitModal" preset="card" title="设置入库信息" style="width: 480px">
                <template #header-extra>
                    <span class="i-mdi-weight text-[18px] align-middle text-[var(--tea-primary)]" />
                </template>
                <template v-if="selectedProduct">
                    <n-descriptions :column="2" size="small" label-placement="left">
                        <n-descriptions-item label="商品">
                            {{ selectedProduct.name }}
                        </n-descriptions-item>
                        <n-descriptions-item label="类型">
                            <n-tag size="small" :bordered="false" :type="selectedProduct.type === 'weight' ? 'warning' : 'info'">
                                {{ selectedProduct.type === 'weight' ? '称重类' : '计件类' }}
                            </n-tag>
                        </n-descriptions-item>
                    </n-descriptions>

                    <n-form label-placement="left" label-width="80">
                        <n-form-item label="入库单位">
                            <n-select
                                v-model:value="addForm.unitId"
                                :options="unitOptions"
                                filterable
                                placeholder="请选择单位"
                            />
                        </n-form-item>
                        <n-form-item label="进价">
                            <n-input-number
                                v-model:value="addForm.unitPrice"
                                :min="0"
                                :precision="2"
                                placeholder="请输入进价"
                                style="width: 100%"
                            />
                        </n-form-item>
                        <n-form-item label="数量">
                            <n-input-number
                                v-model:value="addForm.quantity"
                                :min="1"
                                :precision="0"
                                placeholder="请输入数量"
                                style="width: 100%"
                            />
                        </n-form-item>
                        <n-form-item label="小计">
                            <n-text type="warning" class="font-mono text-[16px] font-semibold">
                                ¥{{ (addForm.unitPrice * addForm.quantity).toFixed(2) }}
                            </n-text>
                        </n-form-item>
                    </n-form>

                    <div class="flex justify-end">
                        <n-space :size="12">
                            <n-button @click="showUnitModal = false">取消</n-button>
                            <n-button type="primary" @click="confirmAddItem">
                                <template #icon>
                                    <span class="i-mdi-check align-middle" />
                                </template>
                                确认添加
                            </n-button>
                        </n-space>
                    </div>
                </template>
            </n-modal>
        </n-space>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NButton, NTag, NSpace, NText, NEmpty, useMessage } from 'naive-ui'
import { getProducts, getProductUnits } from '@/api/products'
import { purchaseIn } from '@/api/inventory'
import { updatePurchaseOrder, getPurchaseOrderDetail } from '@/api/purchases'
import { useSupplierStore } from '@/stores'
import type { Product, SalesUnit } from '@/types'

const router = useRouter()
const route = useRoute()
const message = useMessage()

const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const loadingDetail = ref(false)

// ========== 搜索弹窗 ==========
const showSearchModal = ref(false)
const productSearch = ref('')
const allProducts = ref<Product[]>([])

/** 客户端模糊过滤：匹配名称/编码 */
const filteredProducts = computed(() => {
    const kw = productSearch.value.trim().toLowerCase()
    if (!kw) return allProducts.value
    return allProducts.value.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        p.code.toLowerCase().includes(kw)
    )
})

/** 打开搜索弹窗时加载所有商品 */
watch(showSearchModal, async (show) => {
    if (show && allProducts.value.length === 0) {
        try {
            allProducts.value = await getProducts()
        } catch (error) {
            console.error('加载商品列表失败:', error)
        }
    }
})

// ========== 单位选择弹窗 ==========
const showUnitModal = ref(false)
const selectedProduct = ref<Product | null>(null)
const selectedUnits = ref<SalesUnit[]>([])
const unitOptions = ref<{ label: string; value: string }[]>([])

const addForm = reactive({
    unitId: '',
    unitPrice: 0,
    quantity: 1
})

const form = reactive({
    supplierId: null as string | null,
    date: Date.now(),
    handler: '',
    remark: '',
    paymentStatus: 'unpaid',
    items: [] as Array<{
        productId: string
        productName: string
        unitId: string
        unitName: string
        quantity: number
        purchasePrice: number
        subtotal: number
    }>
})

const totalAmount = computed(() => {
    return form.items.reduce((sum, item) => sum + item.subtotal, 0)
})

const supplierOptions = ref<Array<{ label: string; value: string }>>([])
const supplierStore = useSupplierStore()
const paymentOptions = [
    { label: '未付款', value: 'unpaid' },
    { label: '部分付款', value: 'partial' },
    { label: '已付款', value: 'paid' }
]

// ========== 表格列 ==========

/** 已选商品明细列 */
const itemColumns = [
    { title: '商品', key: 'productName' },
    { title: '单位', key: 'unitName', width: 100 },
    { title: '数量', key: 'quantity', width: 80 },
    {
        title: '进价',
        key: 'purchasePrice',
        width: 100,
        render: (row: any) => h(NText, { class: 'font-mono' }, { default: () => `¥${row.purchasePrice.toFixed(2)}` })
    },
    {
        title: '金额',
        key: 'subtotal',
        width: 100,
        render: (row: any) => h(NText, { type: 'warning', class: 'font-mono' }, { default: () => `¥${row.subtotal.toFixed(2)}` })
    },
    {
        title: '操作',
        key: 'actions',
        width: 80,
        render: (_row: any, index: number) => h(
            NButton,
            { size: 'small', type: 'error', text: true, onClick: () => form.items.splice(index, 1) },
            {
                icon: () => h('span', { class: 'i-mdi-delete align-middle' }),
                default: () => '删除'
            }
        )
    }
]

/** 搜索结果列 */
const searchColumns = [
    { title: '编码', key: 'code', width: 140 },
    { title: '名称', key: 'name' },
    {
        title: '类型',
        key: 'type',
        width: 80,
        render: (row: Product) => h(NTag, {
            size: 'small',
            bordered: false,
            type: row.type === 'weight' ? 'warning' : 'info'
        }, { default: () => row.type === 'weight' ? '称重' : '计件' })
    },
    {
        title: '操作',
        key: 'actions',
        width: 80,
        render: (row: Product) => h(
            NButton,
            { size: 'small', type: 'primary', onClick: () => openUnitSelect(row) },
            {
                icon: () => h('span', { class: 'i-mdi-plus align-middle' }),
                default: () => '添加'
            }
        )
    }
]

// ========== 选择单位 ==========

async function openUnitSelect(product: Product) {
    try {
        const units = await getProductUnits(product.id)
        if (units.length === 0) {
            message.warning('该商品没有销售单位')
            return
        }

        selectedProduct.value = product
        selectedUnits.value = units
        unitOptions.value = units.map(u => ({
            label: `${u.name} (零售 ¥${u.retailPrice.toFixed(2)})`,
            value: u.id
        }))

        // 默认选中第一个单位
        const defaultUnit = units[0]
        addForm.unitId = defaultUnit.id
        addForm.unitPrice = Math.round(defaultUnit.retailPrice * 0.6 * 100) / 100
        addForm.quantity = 1

        showSearchModal.value = false
        showUnitModal.value = true
    } catch (error) {
        message.error('加载商品单位失败：' + String(error ?? ''))
    }
}

function confirmAddItem() {
    if (!addForm.unitId) {
        message.warning('请选择入库单位')
        return
    }
    if (addForm.unitPrice <= 0) {
        message.warning('请输入进价')
        return
    }

    const unit = selectedUnits.value.find(u => u.id === addForm.unitId)
    if (!unit) return

    const subtotal = addForm.unitPrice * addForm.quantity

    form.items.push({
        productId: selectedProduct.value!.id,
        productName: selectedProduct.value!.name,
        unitId: unit.id,
        unitName: unit.name,
        quantity: addForm.quantity,
        purchasePrice: addForm.unitPrice,
        subtotal: Math.round(subtotal * 100) / 100
    })

    showUnitModal.value = false
    selectedProduct.value = null
}

// ========== 编辑模式 - 加载采购单详情 ==========

/** 编辑模式下加载已有采购单 */
async function loadPurchaseOrder() {
    if (!isEdit.value) return
    loadingDetail.value = true
    try {
        const detail = await getPurchaseOrderDetail(route.params.id as string)
        form.supplierId = detail.supplierId
        form.date = new Date(detail.createdAt).getTime()
        form.handler = detail.handler || ''
        form.remark = detail.remark || ''
        form.paymentStatus = detail.paymentStatus
        form.items = detail.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            unitId: item.unitId,
            unitName: item.unitName,
            quantity: item.quantity,
            purchasePrice: item.unitPrice,
            subtotal: item.subtotal
        }))
    } catch (e) {
        message.error('加载采购单失败')
    } finally {
        loadingDetail.value = false
    }
}

// ========== 提交 ==========

async function handleSubmit() {
    if (!form.supplierId) {
        message.warning('请选择供应商')
        return
    }
    if (form.items.length === 0) {
        message.warning('请至少添加一个入库商品')
        return
    }

    saving.value = true
    try {
        const input = {
            supplierId: form.supplierId,
            handler: form.handler || undefined,
            items: form.items.map(item => ({
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity,
                unitPrice: item.purchasePrice
            })),
            remark: form.remark || undefined
        }

        if (isEdit.value) {
            await updatePurchaseOrder(route.params.id as string, input)
            message.success('采购单更新成功')
        } else {
            await purchaseIn(input)
            message.success('入库单保存成功')
        }
        router.push('/purchase')
    } catch (error) {
        message.error('保存入库单失败：' + String(error ?? ''))
    } finally {
        saving.value = false
    }
}

/** 加载供应商下拉 */
async function loadSupplierOptions() {
    try {
        const list = await supplierStore.loadActiveSuppliers()
        supplierOptions.value = list.map(s => ({ label: s.name, value: s.id }))
    } catch (e) {
        console.error('加载供应商失败:', e)
    }
}

onMounted(async () => {
    await loadSupplierOptions()
    await loadPurchaseOrder()
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
