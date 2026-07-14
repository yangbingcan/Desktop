<!--
  @file 库存列表页面
  @description 显示所有商品的库存信息，支持查看批次详情、流水记录、采购入库、报损出库、盘点调整
  @refactor v0.6.0 统一深茶绿主题（n-config-provider themeOverrides）、
            Naive UI 组件化（n-card / n-space / n-text / n-tag）、mdi 图标、
            去除散落 margin、彩色文字改用 NText type/depth、空状态 n-empty。
            业务逻辑（批次 / 流水 / 入库 / 报损 / 盘点加载与提交）保持不变。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 + 刷新 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-archive-outline text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">库存管理</span>
                </div>
                <n-button @click="loadInventory">
                    <template #icon>
                        <span class="i-mdi-refresh align-middle" />
                    </template>
                    刷新
                </n-button>
            </div>

            <!-- 筛选栏 -->
            <n-card :bordered="false" class="filter-card">
                <n-space align="center" :wrap="true" :size="[12, 8]">
                    <n-select
                        v-model:value="selectedCategoryId"
                        :options="categoryOptions"
                        placeholder="选择分类"
                        clearable
                        style="width: 180px"
                        @update:value="loadInventory"
                    />
                    <n-select
                        v-model:value="pageSize"
                        :options="[
                            { label: '20条/页', value: 20 },
                            { label: '50条/页', value: 50 },
                            { label: '100条/页', value: 100 }
                        ]"
                        style="width: 130px"
                        @update:value="loadInventory"
                    />
                </n-space>
            </n-card>

            <!-- 库存表格 -->
            <n-card :bordered="false" title="库存列表">
                <template #header-extra>
                    <n-text depth="3" class="text-[12px]">共 {{ total }} 条</n-text>
                </template>
                <n-data-table
                    :loading="loading"
                    :columns="columns"
                    :data="inventoryList"
                    :pagination="{
                        page: page,
                        pageSize: pageSize,
                        itemCount: total,
                        showSizePicker: false,
                        showQuickJumper: true
                    }"
                    :row-key="(row: InventoryItem) => row.productId"
                    size="small"
                    striped
                    @update:page="handlePageChange"
                />
                <n-empty v-if="!loading && inventoryList.length === 0" description="暂无库存数据" />
            </n-card>
        </n-space>

        <!-- 详情弹窗 -->
        <n-modal
            v-model:show="detailVisible"
            preset="card"
            title="库存详情"
            style="width: 800px; max-width: 90vw;"
            :z-index="1000"
        >
            <n-spin :show="detailLoading">
                <template v-if="inventoryDetail">
                    <n-descriptions :column="2" bordered label-placement="left" size="small">
                        <n-descriptions-item label="商品名称">
                            {{ inventoryDetail.productName }}
                        </n-descriptions-item>
                        <n-descriptions-item label="分类">
                            {{ inventoryDetail.categoryName || '-' }}
                        </n-descriptions-item>
                        <n-descriptions-item label="类型">
                            <n-tag size="small" :bordered="false" :type="inventoryDetail.productType === 'weight' ? 'warning' : 'info'">
                                {{ inventoryDetail.productType === 'weight' ? '称重类' : '计件类' }}
                            </n-tag>
                        </n-descriptions-item>
                        <n-descriptions-item label="当前库存">
                            <n-tag type="success" size="small" :bordered="false">{{ inventoryDetail.stockGrams }}g</n-tag>
                        </n-descriptions-item>
                    </n-descriptions>

                    <n-tabs type="line" class="mt-4">
                        <n-tab-pane name="batches" tab="批次列表">
                            <n-data-table
                                :columns="batchColumns"
                                :data="inventoryDetail.batches"
                                :pagination="false"
                                size="small"
                                striped
                            />
                            <n-empty v-if="inventoryDetail.batches.length === 0" description="暂无批次数据" />
                        </n-tab-pane>
                        <n-tab-pane name="flows" tab="近期流水">
                            <n-data-table
                                :columns="flowColumns"
                                :data="inventoryDetail.recentFlows"
                                :pagination="false"
                                size="small"
                                striped
                            />
                            <n-empty v-if="inventoryDetail.recentFlows.length === 0" description="暂无流水数据" />
                        </n-tab-pane>
                    </n-tabs>
                </template>
            </n-spin>

            <template #footer>
                <n-space justify="end">
                    <n-button @click="closeDetail">关闭</n-button>
                </n-space>
            </template>
        </n-modal>

        <!-- 采购入库弹窗 -->
        <n-modal
            v-model:show="purchaseVisible"
            preset="card"
            title="采购入库"
            style="width: 500px"
            :z-index="1000"
        >
            <n-spin :show="purchaseLoading">
                <n-form :model="purchaseForm" label-placement="left" label-width="80">
                    <n-form-item label="商品">
                        <n-input :value="purchaseForm.items[0]?.productId ? productStore.products.find(p => p.id === purchaseForm.items[0].productId)?.name || '' : ''" disabled />
                    </n-form-item>
                    <n-form-item label="入库单位">
                        <n-select
                            v-model:value="purchaseForm.items[0].unitId"
                            :options="purchaseUnits.map(u => ({ label: u.name, value: u.id }))"
                            placeholder="请选择入库单位"
                            :disabled="purchaseUnits.length === 0"
                        />
                    </n-form-item>
                    <n-form-item label="供应商">
                        <n-select
                            v-model:value="purchaseForm.supplierId"
                            :options="supplierOptions"
                            placeholder="请选择供应商"
                            filterable
                        />
                    </n-form-item>
                    <n-form-item label="入库数量">
                        <n-input-number
                            v-model:value="purchaseForm.items[0].quantity"
                            :min="1"
                            style="width: 100%"
                        />
                    </n-form-item>
                    <n-form-item label="采购单价">
                        <n-input-number
                            v-model:value="purchaseForm.items[0].unitPrice"
                            :min="0"
                            :precision="2"
                            style="width: 100%"
                        />
                    </n-form-item>
                    <n-form-item label="经手人">
                        <n-input v-model:value="purchaseForm.handler" placeholder="请输入经手人" />
                    </n-form-item>
                    <n-form-item label="备注">
                        <n-input v-model:value="purchaseForm.remark" placeholder="请输入备注" />
                    </n-form-item>
                </n-form>
            </n-spin>

            <template #footer>
                <n-space justify="end">
                    <n-button @click="purchaseVisible = false">取消</n-button>
                    <n-button type="primary" :loading="purchaseLoading" @click="submitPurchase">确认入库</n-button>
                </n-space>
            </template>
        </n-modal>

        <!-- 报损弹窗 -->
        <n-modal
            v-model:show="damageVisible"
            preset="card"
            title="报损出库"
            style="width: 400px"
            :z-index="1000"
        >
            <n-spin :show="damageLoading">
                <n-form :model="damageForm" label-placement="left" label-width="80">
                    <n-form-item label="商品">
                        <n-input :value="damageProductName" disabled />
                    </n-form-item>
                    <n-form-item label="报损数量">
                        <n-input-number
                            v-model:value="damageForm.grams"
                            :min="1"
                            style="width: 100%"
                        />
                    </n-form-item>
                    <n-form-item label="报损原因">
                        <n-input
                            v-model:value="damageForm.remark"
                            type="textarea"
                            placeholder="请输入报损原因"
                            :rows="3"
                        />
                    </n-form-item>
                </n-form>
            </n-spin>

            <template #footer>
                <n-space justify="end">
                    <n-button @click="damageVisible = false">取消</n-button>
                    <n-button type="error" :loading="damageLoading" @click="submitDamage">确认报损</n-button>
                </n-space>
            </template>
        </n-modal>

        <!-- 盘点调整弹窗 -->
        <n-modal
            v-model:show="adjustVisible"
            preset="card"
            title="盘点调整"
            style="width: 400px"
            :z-index="1000"
        >
            <n-spin :show="adjustLoading">
                <n-form :model="adjustForm" label-placement="left" label-width="90">
                    <n-form-item label="商品">
                        <n-input :value="adjustProductName" disabled />
                    </n-form-item>
                    <n-form-item label="调整后库存">
                        <n-input-number
                            v-model:value="adjustForm.grams"
                            :min="0"
                            style="width: 100%"
                        />
                    </n-form-item>
                    <n-form-item label="调整原因">
                        <n-input
                            v-model:value="adjustForm.remark"
                            type="textarea"
                            placeholder="请输入调整原因"
                            :rows="3"
                        />
                    </n-form-item>
                </n-form>
            </n-spin>

            <template #footer>
                <n-space justify="end">
                    <n-button @click="adjustVisible = false">取消</n-button>
                    <n-button type="primary" :loading="adjustLoading" @click="submitAdjust">确认调整</n-button>
                </n-space>
            </template>
        </n-modal>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 库存列表页面
 * @description 显示所有商品的库存信息，支持查看批次详情、流水记录、采购入库、报损出库、盘点调整
 * @refactor v0.6.0 仅做模板与样式层重构（Naive UI 组件化 + mdi 图标 + NText 着色），业务逻辑完全保留。
 */
import { ref, computed, onMounted, h } from 'vue'
import { NButton, NSpace, NTag, NText, NSelect } from 'naive-ui'
import { getInventory, getInventoryDetail, purchaseIn, damageOut, adjustStock } from '@/api/inventory'
import { getProductUnits } from '@/api/products'
import type { InventoryItem, InventoryDetail, PurchaseInput, DamageOutInput, AdjustInput, StockFlow, SalesUnit } from '@/types'
import { useProductStore, useSupplierStore } from '@/stores'
import { useMessage } from 'naive-ui'

const message = useMessage()
const productStore = useProductStore()

const loading = ref(false)
const inventoryList = ref<InventoryItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const selectedCategoryId = ref<string | null>(null)

// 详情弹窗
const detailVisible = ref(false)
const detailLoading = ref(false)
const inventoryDetail = ref<InventoryDetail | null>(null)

// 采购入库弹窗
const purchaseVisible = ref(false)
const purchaseLoading = ref(false)
const purchaseForm = ref<PurchaseInput>({
    supplierId: undefined,
    handler: '',
    items: [],
    remark: ''
})
// F1/F2：采购入库所需商品单位与供应商列表
const purchaseUnits = ref<SalesUnit[]>([])
const supplierStore = useSupplierStore()
const supplierOptions = computed(() => supplierStore.activeSuppliers.map(s => ({ label: s.name, value: s.id })))

// 报损弹窗
const damageVisible = ref(false)
const damageLoading = ref(false)
const damageForm = ref<DamageOutInput>({
    productId: '',
    grams: 0,
    remark: ''
})
const damageProductName = ref('')

// 盘点弹窗
const adjustVisible = ref(false)
const adjustLoading = ref(false)
const adjustForm = ref<AdjustInput>({
    productId: '',
    grams: 0,
    remark: ''
})
const adjustProductName = ref('')

// 分类选项
const categoryOptions = computed(() => {
    return [
        { label: '全部', value: '' },
        ...productStore.categories.map(c => ({ label: c.name, value: c.id }))
    ]
})

/** 表格列 */
const columns = [
    { title: '商品名称', key: 'productName', ellipsis: true },
    { title: '分类', key: 'categoryName', width: 100 },
    {
        title: '类型',
        key: 'productType',
        width: 80,
        render(row: InventoryItem) {
            return h(NTag, {
                size: 'small',
                bordered: false,
                type: row.productType === 'weight' ? 'warning' : 'info'
            }, { default: () => row.productType === 'weight' ? '称重类' : '计件类' })
        }
    },
    {
        title: '库存',
        key: 'displayStock',
        width: 140,
        render(row: InventoryItem) {
            return h(NText, { depth: 1, strong: true }, { default: () => row.displayStock })
        }
    },
    {
        title: '操作',
        key: 'actions',
        width: 280,
        render(row: InventoryItem) {
            return h(NSpace, { size: 'small' }, {
                default: () => [
                    h(NButton, {
                        size: 'small',
                        onClick: () => showDetail(row)
                    }, { default: () => '详情' }),
                    h(NButton, {
                        size: 'small',
                        type: 'primary',
                        onClick: () => openPurchase(row)
                    }, { default: () => '入库' }),
                    h(NButton, {
                        size: 'small',
                        type: 'error',
                        onClick: () => openDamage(row)
                    }, { default: () => '报损' }),
                    h(NButton, {
                        size: 'small',
                        onClick: () => openAdjust(row)
                    }, { default: () => '盘点' })
                ]
            })
        }
    }
]

/** 加载库存列表 */
async function loadInventory() {
    loading.value = true
    try {
        const result = await getInventory(page.value, pageSize.value, selectedCategoryId.value || undefined)
        inventoryList.value = result.list
        total.value = result.total
    } catch (error) {
        console.error('加载库存失败:', error)
        message.error('加载库存失败')
    } finally {
        loading.value = false
    }
}

/** 显示详情 */
async function showDetail(item: InventoryItem) {
    detailVisible.value = true
    detailLoading.value = true
    try {
        inventoryDetail.value = await getInventoryDetail(item.productId)
    } catch (error) {
        console.error('加载详情失败:', error)
        message.error('加载详情失败')
    } finally {
        detailLoading.value = false
    }
}

/** 关闭详情 */
function closeDetail() {
    detailVisible.value = false
    inventoryDetail.value = null
}

/** 打开采购入库弹窗（F1/F2 修复：加载单位与供应商，默认选中第一个单位） */
async function openPurchase(item: InventoryItem) {
    purchaseForm.value = {
        supplierId: undefined,
        handler: '',
        items: [{
            productId: item.productId,
            unitId: '',
            quantity: 1,
            unitPrice: 0
        }],
        remark: ''
    }
    purchaseVisible.value = true
    // 加载该商品销售单位，默认选中第一个
    try {
        const units = await getProductUnits(item.productId)
        purchaseUnits.value = units
        if (units.length > 0) {
            purchaseForm.value.items[0].unitId = units[0].id
        }
    } catch (e) {
        console.error('加载销售单位失败:', e)
    }
    // 确保供应商下拉有数据
    if (supplierStore.activeSuppliers.length === 0) {
        supplierStore.loadActiveSuppliers().catch(e => console.error('加载供应商失败:', e))
    }
}

/** 提交采购入库 */
async function submitPurchase() {
    if (!purchaseForm.value.items[0].unitId) {
        message.warning('请选择入库单位')
        return
    }
    if (!purchaseForm.value.supplierId) {
        message.warning('请选择供应商')
        return
    }
    if (purchaseForm.value.items[0].quantity <= 0) {
        message.warning('请输入正确的数量')
        return
    }
    if (purchaseForm.value.items[0].unitPrice <= 0) {
        message.warning('请输入采购单价')
        return
    }

    purchaseLoading.value = true
    try {
        await purchaseIn(purchaseForm.value)
        message.success('采购入库成功')
        purchaseVisible.value = false
        loadInventory()
    } catch (error) {
        console.error('采购入库失败:', error)
        message.error('采购入库失败：' + String(error ?? '未知错误'))
    } finally {
        purchaseLoading.value = false
    }
}

/** 打开报损弹窗 */
function openDamage(item: InventoryItem) {
    damageForm.value = {
        productId: item.productId,
        grams: 0,
        remark: ''
    }
    damageProductName.value = item.productName
    damageVisible.value = true
}

/** 提交报损 */
async function submitDamage() {
    if (damageForm.value.grams <= 0) {
        message.warning('请输入正确的报损数量')
        return
    }
    if (!damageForm.value.remark) {
        message.warning('请输入报损原因')
        return
    }

    damageLoading.value = true
    try {
        await damageOut(damageForm.value)
        message.success('报损成功')
        damageVisible.value = false
        loadInventory()
    } catch (error) {
        console.error('报损失败:', error)
        message.error('报损失败：' + String(error ?? '未知错误'))
    } finally {
        damageLoading.value = false
    }
}

/** 打开盘点弹窗 */
function openAdjust(item: InventoryItem) {
    adjustForm.value = {
        productId: item.productId,
        grams: item.stockGrams,
        remark: ''
    }
    adjustProductName.value = item.productName
    adjustVisible.value = true
}

/** 提交盘点调整 */
async function submitAdjust() {
    if (adjustForm.value.grams < 0) {
        message.warning('库存不能为负数')
        return
    }
    if (!adjustForm.value.remark) {
        message.warning('请输入调整原因')
        return
    }

    adjustLoading.value = true
    try {
        await adjustStock(adjustForm.value)
        message.success('盘点调整成功')
        adjustVisible.value = false
        loadInventory()
    } catch (error) {
        console.error('盘点调整失败:', error)
        message.error('盘点调整失败：' + String(error ?? '未知错误'))
    } finally {
        adjustLoading.value = false
    }
}

/** 格式化日期 */
function formatDate(dateStr: string): string {
    if (!dateStr) return '-'
    return dateStr.slice(0, 16)
}

/** 换页 */
function handlePageChange(newPage: number) {
    page.value = newPage
    loadInventory()
}

/** 批次表格列 */
const batchColumns = [
    { title: '批次号', key: 'batchCode', width: 150 },
    { title: '采购价', key: 'purchasePrice', width: 100 },
    { title: '初始数量', key: 'totalGrams', width: 100 },
    { title: '剩余数量', key: 'remainingGrams', width: 100 },
    { title: '生产日期', key: 'producedDate', width: 120 },
    { title: '过期日期', key: 'expireDate', width: 120 },
    { title: '创建时间', key: 'createdAt', width: 160 }
]

/** 流水表格列 */
const flowColumns = [
    {
        title: '类型',
        key: 'flowType',
        width: 100,
        render(row: StockFlow) {
            const typeMap: Record<string, string> = {
                purchaseIn: '采购入库',
                saleOut: '销售出库',
                damageOut: '报损出库',
                returnOut: '退货出库',
                adjustIn: '盘盈',
                adjustOut: '盘亏'
            }
            const label = typeMap[row.flowType] || row.flowType
            const tagType = row.changeGrams > 0 ? 'success' : 'warning'
            return h(NTag, { type: tagType, size: 'small', bordered: false }, { default: () => label })
        }
    },
    {
        title: '变更数量',
        key: 'changeGrams',
        width: 100,
        render(row: StockFlow) {
            const type = row.changeGrams > 0 ? 'success' : 'error'
            const sign = row.changeGrams > 0 ? '+' : ''
            return h(NText, { type, strong: true }, { default: () => `${sign}${row.changeGrams}g` })
        }
    },
    { title: '结余', key: 'balanceGrams', width: 100 },
    { title: '备注', key: 'remark', ellipsis: true },
    {
        title: '时间',
        key: 'createdAt',
        width: 160,
        render(row: StockFlow) {
            return h(NText, { depth: 3, class: 'text-[12px]' }, { default: () => formatDate(row.createdAt) })
        }
    }
]

onMounted(async () => {
    await productStore.loadCategories()
    await loadInventory()
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
