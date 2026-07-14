<!--
  @file 打印模板设计器
  @description 4 类单据（零售小票 / 采购入库单 / 退货出库单 / 条码标签）的可视化模板设计器。
              左：结构化区块配置器（TemplateDesigner）；右：所见即所得预览（TemplatePreview）。
              配置经 Pinia store 持久化到 localStorage，重构后不再写死 HTML。
  @refactor v0.7.0 用区块配置器 + 实时预览替换原占位壳；引入 TemplateDesigner / TemplatePreview。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 + 操作 -->
            <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-printer-settings text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">打印模板设计器</span>
                </div>
                <n-space :size="8">
                    <n-button size="small" @click="onReset">
                        <template #icon>
                            <span class="i-mdi-restore align-middle" />
                        </template>
                        重置默认
                    </n-button>
                    <n-button size="small" @click="onTestPrint">
                        <template #icon>
                            <span class="i-mdi-printer align-middle" />
                        </template>
                        测试打印
                    </n-button>
                    <n-button type="primary" size="small" @click="onSave">
                        <template #icon>
                            <span class="i-mdi-content-save align-middle" />
                        </template>
                        保存模板
                    </n-button>
                </n-space>
            </div>

            <n-card :bordered="false">
                <n-tabs v-model:value="activeType" type="line" animated>
                    <n-tab-pane
                        v-for="t in typeList"
                        :key="t.value"
                        :name="t.value"
                    >
                        <template #tab>
                            <span :class="t.icon" class="align-middle" />
                            <span class="ml-1">{{ t.label }}</span>
                        </template>

                        <n-grid
                            cols="1 820:2"
                            :x-gap="16"
                            :y-gap="16"
                            responsive="screen"
                        >
                            <n-gi>
                                <n-card title="区块配置" size="small" :bordered="false">
                                    <TemplateDesigner v-model="drafts[t.value]" />
                                </n-card>
                            </n-gi>
                            <n-gi>
                                <n-card title="预览" size="small" :bordered="false">
                                    <TemplatePreview :template="drafts[t.value]" />
                                </n-card>
                            </n-gi>
                        </n-grid>
                    </n-tab-pane>
                </n-tabs>
            </n-card>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 打印模板设计器逻辑
 * @description 维护 4 类模板的可编辑副本 drafts；保存落盘、重置默认、测试打印走 store + 渲染引擎。
 */
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import TemplateDesigner from '@/components/print/TemplateDesigner.vue'
import TemplatePreview from '@/components/print/TemplatePreview.vue'
import { usePrintTemplatesStore } from '@/stores/printTemplates'
import { useSettingsStore } from '@/stores/settings'
import { renderTemplateHTML, renderLabelHTML, demoPrintData } from '@/utils/printTemplate'
import { printHTML } from '@/utils/print'
import type {
    TemplateType,
    PrintTemplate,
    ShopInfo,
    ReceiptPrintData,
    DocPrintData,
    LabelPrintData
} from '@/types/printTemplate'

const store = usePrintTemplatesStore()
const settings = useSettingsStore()
const message = useMessage()

const typeList = [
    { value: 'receipt', label: '零售小票', icon: 'i-mdi-receipt' },
    { value: 'purchase', label: '采购入库单', icon: 'i-mdi-clipboard-text' },
    { value: 'return', label: '退货出库单', icon: 'i-mdi-clipboard-remove' },
    { value: 'label', label: '条码标签', icon: 'i-mdi-barcode' }
] as const

const activeType = ref<TemplateType>('receipt')
const drafts = ref<Record<TemplateType, PrintTemplate>>(clone(store.templates))

/** 深拷贝（模板为纯 JSON 结构） */
function clone<T>(x: T): T {
    return JSON.parse(JSON.stringify(x))
}

function typeLabel(t: TemplateType): string {
    return typeList.find(x => x.value === t)?.label ?? ''
}

function shopInfo(): ShopInfo {
    return {
        shopName: settings.settings.shopName || '茶易管',
        shopAddress: settings.settings.shopAddress || '',
        shopPhone: settings.settings.shopPhone || ''
    }
}

/** 保存当前类型模板到 store（localStorage 持久化） */
function onSave() {
    const type = activeType.value
    store.saveTemplate(drafts.value[type])
    message.success(`已保存「${typeLabel(type)}」模板`)
}

/** 重置当前类型为默认模板 */
function onReset() {
    const type = activeType.value
    store.resetTemplate(type)
    drafts.value[type] = clone(store.getTemplate(type))
    message.info(`已重置「${typeLabel(type)}」为默认模板`)
}

/** 用演示数据渲染当前模板并调用浏览器打印（验证排版） */
async function onTestPrint() {
    const type = activeType.value
    const tpl = drafts.value[type]
    const data = demoPrintData(type, shopInfo())
    let html = ''
    if (type === 'label') {
        html = await renderLabelHTML(tpl, data as LabelPrintData)
    } else {
        html = renderTemplateHTML(tpl, data as ReceiptPrintData | DocPrintData)
    }
    await printHTML(html)
    message.success('已发送打印，请在打印对话框中确认')
}
</script>
