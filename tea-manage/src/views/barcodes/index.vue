<!--
  @file 条码管理
  @description 零售条码生成、批次追溯（二维码）、标签设计
  @refactor v0.6.0 统一深茶绿视觉纪律：tea-page p-md + n-card + n-tabs + mdi 图标；
             去除散落 margin，补 n-empty 空态（暂无条码数据 / 暂无批次数据）。
             严格保留 canvas 条码/二维码 ref 与列定义。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-barcode text-[18px] align-middle text-[var(--tea-primary)]" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">条码管理</span>
                </div>
            </div>

            <n-card :bordered="false">
                <n-tabs type="line" animated>
                    <!-- 零售条码 -->
                    <n-tab-pane name="product">
                        <template #tab>
                            <span class="i-mdi-barcode align-middle" />
                            <span class="ml-1">零售条码</span>
                        </template>

                        <n-space vertical :size="12">
                            <n-space align="center" :wrap="true" :size="[12, 8]">
                                <n-select
                                    v-model:value="productFilters.productId"
                                    :options="productOptions"
                                    filterable
                                    clearable
                                    placeholder="搜索商品"
                                    style="width: 280px"
                                />
                                <n-button type="primary" @click="loadProductBarcodes">
                                    <template #icon>
                                        <span class="i-mdi-magnify align-middle" />
                                    </template>
                                    查询
                                </n-button>
                            </n-space>

                            <n-data-table
                                v-if="barcodes.length"
                                :columns="barcodeColumns"
                                :data="barcodes"
                                :row-key="(row: any) => row.id"
                                size="small"
                            >
                                <template #barcode="{ row }">
                                    <canvas :ref="el => setBarcodeRef(el, row.id)" />
                                </template>
                            </n-data-table>
                            <n-empty v-else description="暂无条码数据" />

                            <div class="flex items-center justify-end">
                                <n-button type="primary" size="small" @click="printSelected">
                                    <template #icon>
                                        <span class="i-mdi-printer align-middle" />
                                    </template>
                                    批量打印
                                </n-button>
                            </div>
                        </n-space>
                    </n-tab-pane>

                    <!-- 批次追溯 -->
                    <n-tab-pane name="batch">
                        <template #tab>
                            <span class="i-mdi-qrcode align-middle" />
                            <span class="ml-1">批次追溯</span>
                        </template>

                        <n-space vertical :size="12">
                            <n-space align="center" :wrap="true" :size="[12, 8]">
                                <n-input
                                    v-model:value="batchFilters.batchCode"
                                    placeholder="输入批次号"
                                    clearable
                                    style="width: 280px"
                                >
                                    <template #prefix>
                                        <span class="i-mdi-magnify align-middle" />
                                    </template>
                                </n-input>
                                <n-button type="primary" @click="loadBatchBarcodes">
                                    <template #icon>
                                        <span class="i-mdi-magnify align-middle" />
                                    </template>
                                    查询
                                </n-button>
                            </n-space>

                            <n-data-table
                                v-if="batchBarcodes.length"
                                :columns="batchColumns"
                                :data="batchBarcodes"
                                :row-key="(row: any) => row.id"
                                size="small"
                            >
                                <template #qrcode="{ row }">
                                    <canvas :ref="el => setQRCodeRef(el, row.id)" />
                                </template>
                            </n-data-table>
                            <n-empty v-else description="暂无批次数据" />
                        </n-space>
                    </n-tab-pane>

                    <!-- 标签设计 -->
                    <n-tab-pane name="label">
                        <template #tab>
                            <span class="i-mdi-label align-middle" />
                            <span class="ml-1">标签设计</span>
                        </template>

                        <n-form :model="labelConfig" label-placement="left" label-width="100">
                            <n-form-item label="标签尺寸">
                                <n-select
                                    v-model:value="labelConfig.size"
                                    :options="sizeOptions"
                                    style="width: 200px"
                                />
                            </n-form-item>
                            <n-form-item label="显示内容">
                                <n-checkbox-group v-model:value="labelConfig.fields">
                                    <n-space>
                                        <n-checkbox value="name">商品名称</n-checkbox>
                                        <n-checkbox value="price">价格</n-checkbox>
                                        <n-checkbox value="barcode">条码</n-checkbox>
                                        <n-checkbox value="origin">产地</n-checkbox>
                                        <n-checkbox value="date">日期</n-checkbox>
                                    </n-space>
                                </n-checkbox-group>
                            </n-form-item>
                            <n-form-item label="打印份数">
                                <n-input-number v-model:value="labelConfig.copies" :min="1" :max="100" />
                            </n-form-item>
                        </n-form>

                        <n-space :size="12">
                            <n-button type="primary" @click="previewLabel">
                                <template #icon>
                                    <span class="i-mdi-eye align-middle" />
                                </template>
                                预览
                            </n-button>
                            <n-button type="primary" @click="printLabel">
                                <template #icon>
                                    <span class="i-mdi-printer align-middle" />
                                </template>
                                打印
                            </n-button>
                        </n-space>
                    </n-tab-pane>
                </n-tabs>
            </n-card>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 条码管理逻辑
 * @description 零售条码 / 批次追溯 / 标签设计
 *
 * 业务逻辑（严格保留）：
 * 1. productFilters / batchFilters 筛选条件
 * 2. productOptions / barcodes / batchBarcodes 响应式数据
 * 3. barcodeRefs / qrcodeRefs：canvas 引用 Map，setBarcodeRef / setQRCodeRef 写入
 * 4. barcodeColumns / batchColumns：含 slot 列（'barcode' / 'qrcode'）供模板渲染 canvas
 * 5. 各操作为占位功能（message 提示），保持原行为
 */
import { ref, reactive, onMounted } from 'vue'
import { useMessage } from 'naive-ui'

const message = useMessage()

const productFilters = reactive({
    productId: null as string | null
})

const batchFilters = reactive({
    batchCode: ''
})

const productOptions = ref<Array<{ label: string; value: string }>>([])
const barcodes = ref<any[]>([])
const batchBarcodes = ref<any[]>([])

const barcodeRefs = new Map<string, HTMLCanvasElement>()
const qrcodeRefs = new Map<string, HTMLCanvasElement>()

const labelConfig = reactive({
    size: '40x30',
    fields: ['name', 'price', 'barcode'] as string[],
    copies: 1
})

const sizeOptions = [
    { label: '40mm x 30mm', value: '40x30' },
    { label: '60mm x 40mm', value: '60x40' },
    { label: '100mm x 50mm', value: '100x50' }
]

const barcodeColumns = [
    { type: 'selection', width: 50 },
    { title: '商品', key: 'productName' },
    { title: '单位', key: 'unitName' },
    { title: '条码', key: 'barcode' },
    { title: '预览', key: 'barcode', slot: 'barcode' }
]

const batchColumns = [
    { title: '批次号', key: 'batchCode' },
    { title: '商品', key: 'productName' },
    { title: '入库日期', key: 'createdAt' },
    { title: '二维码', key: 'qrcode', slot: 'qrcode' }
]

function setBarcodeRef(el: any, id: string) {
    if (el) barcodeRefs.set(id, el)
}

function setQRCodeRef(el: any, id: string) {
    if (el) qrcodeRefs.set(id, el)
}

function loadProductBarcodes() {
    message.info('条码查询功能开发中')
}

function loadBatchBarcodes() {
    message.info('批次追溯功能开发中')
}

function printSelected() {
    message.info('批量打印功能开发中')
}

function previewLabel() {
    message.info('标签预览功能开发中')
}

function printLabel() {
    message.info('标签打印功能开发中')
}

onMounted(async () => {
    // 条码管理功能开发中，暂不加载商品列表
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
