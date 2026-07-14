<!--
  @file 打印模板区块配置器
  @description 结构化配置（非拖拽）：纸张尺寸 + 各区块的启用/字号/对齐/标题/字段/文本。
              通过 defineModel 实时修改模板对象，预览组件监听即可所见即所得。
-->
<template>
    <div class="designer">
        <!-- 模板基础信息 + 纸张 -->
        <n-card size="small" :bordered="false" class="mb-3">
            <n-space vertical :size="10">
                <div class="flex items-center justify-between">
                    <span class="text-[13px] font-semibold text-[var(--tea-content-1)]">模板名称</span>
                    <n-input v-model:value="model.name" size="small" style="width: 160px" />
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-[13px] font-semibold text-[var(--tea-content-1)]">纸张宽度</span>
                    <n-select
                        v-model:value="model.paper.widthMm"
                        :options="paperWidthOptions"
                        size="small"
                        style="width: 160px"
                    />
                </div>
                <div
                    v-if="model.type === 'label'"
                    class="flex items-center justify-between"
                >
                    <span class="text-[13px] font-semibold text-[var(--tea-content-1)]">纸张高度</span>
                    <n-select
                        v-model:value="model.paper.heightMm"
                        :options="paperHeightOptions"
                        size="small"
                        style="width: 160px"
                    />
                </div>
            </n-space>
        </n-card>

        <!-- 区块列表 -->
        <n-space vertical :size="10">
            <n-card
                v-for="block in model.blocks"
                :key="block.kind"
                size="small"
                :bordered="false"
                class="block-card"
            >
                <div class="flex items-center justify-between">
                    <span class="text-[13px] font-semibold text-[var(--tea-content-1)]">
                        {{ kindLabel(block.kind) }}
                    </span>
                    <n-switch v-model:value="block.enabled" size="small" />
                </div>

                <template v-if="block.enabled">
                    <n-divider style="margin: 10px 0" />
                    <n-space vertical :size="10">
                        <!-- 字号 + 对齐（通用） -->
                        <div class="flex items-center justify-between">
                            <span class="text-[12px] text-[var(--tea-content-2)]">字号(px)</span>
                            <n-input-number
                                v-model:value="block.fontSize"
                                :min="8"
                                :max="32"
                                size="small"
                                style="width: 110px"
                            />
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[12px] text-[var(--tea-content-2)]">对齐</span>
                            <n-radio-group v-model:value="block.align" size="small">
                                <n-radio-button value="left">左</n-radio-button>
                                <n-radio-button value="center">中</n-radio-button>
                                <n-radio-button value="right">右</n-radio-button>
                            </n-radio-group>
                        </div>

                        <!-- header：标题 -->
                        <div v-if="block.kind === 'header'">
                            <span class="text-[12px] text-[var(--tea-content-2)]">标题文字</span>
                            <n-input
                                v-model:value="block.title"
                                size="small"
                                placeholder="留空则仅显示店名"
                                style="margin-top: 4px"
                            />
                        </div>

                        <!-- customText：文本 -->
                        <div v-if="block.kind === 'customText'">
                            <span class="text-[12px] text-[var(--tea-content-2)]">文本内容（每行一条）</span>
                            <n-input
                                v-model:value="block.text"
                                type="textarea"
                                :rows="3"
                                placeholder="支持换行，如：感谢惠顾\n扫码关注"
                                style="margin-top: 4px"
                            />
                        </div>

                        <!-- 字段白名单：shopInfo / meta / items -->
                        <div
                            v-if="['shopInfo', 'meta', 'items'].includes(block.kind)"
                        >
                            <span class="text-[12px] text-[var(--tea-content-2)]">显示字段</span>
                            <n-select
                                v-model:value="block.fields"
                                multiple
                                :options="fieldOptions(block.kind)"
                                size="small"
                                style="margin-top: 4px"
                            />
                        </div>
                    </n-space>
                </template>
            </n-card>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 打印模板区块配置器逻辑
 * @description defineModel 双向绑定模板对象；提供字段选项与纸张选项。
 */
import { computed } from 'vue'
import type { BlockKind, PrintTemplate } from '@/types/printTemplate'

const model = defineModel<PrintTemplate>({ required: true })

const kindLabels: Record<BlockKind, string> = {
    header: '店名标题',
    shopInfo: '店铺信息',
    meta: '单号 / 日期',
    items: '商品明细',
    summary: '合计 / 金额',
    member: '会员信息',
    customText: '自定义文本',
    barcode: '条码',
    qrcode: '二维码'
}
function kindLabel(k: BlockKind): string {
    return kindLabels[k]
}

const paperWidthOptions = computed(() => {
    if (model.value.type === 'receipt') return [58, 80].map(toMmOption)
    if (model.value.type === 'label') return [40, 60].map(toMmOption)
    return [210].map(toMmOption)
})
const paperHeightOptions = [30, 40, 50].map(toMmOption)

function toMmOption(v: number) {
    return { value: v, label: v + 'mm' }
}

function fieldOptions(kind: BlockKind): { value: string; label: string }[] {
    if (kind === 'shopInfo')
        return [
            { value: 'address', label: '地址' },
            { value: 'phone', label: '电话' }
        ]
    if (kind === 'items')
        return [
            { value: 'name', label: '名称' },
            { value: 'quantity', label: '数量' },
            { value: 'unit', label: '单位' },
            { value: 'price', label: '单价' },
            { value: 'subtotal', label: '金额' }
        ]
    if (kind === 'meta') {
        const base = [
            { value: 'orderNo', label: '单号' },
            { value: 'date', label: '日期' }
        ]
        if (model.value.type !== 'receipt')
            base.push(
                { value: 'supplier', label: '供应商' },
                { value: 'handler', label: '经手人' }
            )
        return base
    }
    return []
}
</script>

<style scoped>
.designer {
    max-height: 70vh;
    overflow: auto;
    padding-right: 4px;
}
.block-card {
    border: 1px solid var(--tea-line-1);
}
</style>
