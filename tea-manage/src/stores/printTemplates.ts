/**
 * @file 打印模板状态管理
 * @description 管理 4 种单据打印模板（localStorage 持久化，不依赖后端命令）。
 *              复用 settings 中的店铺信息作为单一来源。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PrintTemplate, TemplateType } from '@/types/printTemplate'
import {
    defaultTemplates,
    loadStoredTemplates,
    saveStoredTemplates
} from '@/utils/printTemplate'

export const usePrintTemplatesStore = defineStore('printTemplates', () => {
    // ========== 状态 ==========
    const templates = ref<Record<TemplateType, PrintTemplate>>(loadStoredTemplates())

    // ========== Actions ==========

    /** 重新从 localStorage 载入（首次挂载时调用） */
    function loadTemplates() {
        templates.value = loadStoredTemplates()
    }

    /** 获取单个模板 */
    function getTemplate(type: TemplateType): PrintTemplate {
        return templates.value[type]
    }

    /** 保存单个模板（更新时间戳并落盘） */
    function saveTemplate(tpl: PrintTemplate) {
        templates.value = {
            ...templates.value,
            [tpl.type]: { ...tpl, updatedAt: new Date().toISOString() }
        }
        saveStoredTemplates(templates.value)
    }

    /** 重置某类型为默认模板 */
    function resetTemplate(type: TemplateType) {
        const d = defaultTemplates()[type]
        saveTemplate({ ...d, updatedAt: new Date().toISOString() })
    }

    /** 重置全部为默认 */
    function resetAll() {
        templates.value = defaultTemplates()
        saveStoredTemplates(templates.value)
    }

    return {
        templates,
        loadTemplates,
        getTemplate,
        saveTemplate,
        resetTemplate,
        resetAll
    }
})
