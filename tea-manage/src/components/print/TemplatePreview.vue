<!--
  @file 打印模板预览组件
  @description 按模板 + 演示/真实数据渲染可打印 HTML 到 iframe，所见即所得。
              标签类型（含条码）走异步 renderLabelHTML；其余走同步 renderTemplateHTML。
-->
<template>
    <div class="preview-scroll">
        <iframe
            ref="frameRef"
            class="preview-frame"
            :style="frameStyle"
            title="模板预览"
            @load="onFrameLoad"
        />
    </div>
</template>

<script setup lang="ts">
/**
 * @file 打印模板预览逻辑
 * @description 监听 template / data 变化，重新渲染 HTML 写入 iframe。
 */
import { ref, watch, onMounted, computed } from 'vue'
import type {
    PrintTemplate,
    ReceiptPrintData,
    DocPrintData,
    LabelPrintData
} from '@/types/printTemplate'
import { renderTemplateHTML, renderLabelHTML, demoPrintData } from '@/utils/printTemplate'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
    template: PrintTemplate
    /** 可选：外部真实数据；缺省用演示数据 */
    data?: ReceiptPrintData | DocPrintData | LabelPrintData
}>()

const settings = useSettingsStore()
const frameRef = ref<HTMLIFrameElement | null>(null)
const htmlRef = ref('')

async function render() {
    const tpl = props.template
    const shop = {
        shopName: settings.settings.shopName || '茶易管',
        shopAddress: settings.settings.shopAddress || '茶香路1号',
        shopPhone: settings.settings.shopPhone || '13800000000'
    }
    const data = (props.data ?? demoPrintData(tpl.type, shop)) as
        | ReceiptPrintData
        | DocPrintData
        | LabelPrintData
    if (tpl.type === 'label') {
        htmlRef.value = await renderLabelHTML(tpl, data as LabelPrintData)
    } else {
        htmlRef.value = renderTemplateHTML(tpl, data as ReceiptPrintData | DocPrintData)
    }
    if (frameRef.value) frameRef.value.srcdoc = htmlRef.value
}

/** iframe 加载后，非标签类型按内容高度自适应（避免大片空白） */
function onFrameLoad() {
    const f = frameRef.value
    if (!f || props.template.type === 'label') return
    const doc = f.contentDocument
    if (doc && doc.body) {
        f.style.height = Math.max(doc.body.scrollHeight, 200) + 'px'
    }
}

const frameStyle = computed(() => {
    const w = props.template.paper.widthMm
    if (props.template.type === 'label' && props.template.paper.heightMm) {
        return { width: w + 'mm', height: props.template.paper.heightMm + 'mm' }
    }
    return { width: w + 'mm', height: 'auto' }
})

onMounted(render)
watch(() => props.template, render, { deep: true })
watch(() => props.data, render, { deep: true })
</script>

<style scoped>
.preview-scroll {
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12px;
    background: #f5f7fa;
    border: 1px solid var(--tea-line-1);
    border-radius: var(--tea-radius-lg);
    min-height: 320px;
}
.preview-frame {
    border: 1px solid #d9d9d9;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
</style>
