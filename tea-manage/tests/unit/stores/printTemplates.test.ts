/**
 * @file 打印模板 store 单元测试
 * @description 验证模板种子注入、保存/读取往返、重置默认。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestPinia } from './_helpers'
import { usePrintTemplatesStore } from '@/stores/printTemplates'
import { TEMPLATE_STORAGE_KEY, loadStoredTemplates } from '@/utils/printTemplate'

describe('printTemplates store', () => {
    beforeEach(() => {
        localStorage.clear()
        createTestPinia()
    })

    it('首次载入注入 4 种默认模板', () => {
        const store = usePrintTemplatesStore()
        expect(Object.keys(store.templates).sort()).toEqual(['label', 'purchase', 'receipt', 'return'])
        expect(store.getTemplate('receipt').name).toBe('零售小票')
    })

    it('保存模板后落盘且可被重新读取', () => {
        const store = usePrintTemplatesStore()
        const tpl = store.getTemplate('receipt')
        tpl.blocks[0].fontSize = 20
        tpl.blocks[1].enabled = false
        store.saveTemplate(tpl)

        const fromDisk = loadStoredTemplates().receipt
        expect(fromDisk.blocks[0].fontSize).toBe(20)
        expect(fromDisk.blocks[1].enabled).toBe(false)
    })

    it('保存后重新加载 store 仍保留修改', () => {
        const store = usePrintTemplatesStore()
        store.saveTemplate({ ...store.getTemplate('purchase'), name: '采购单(改)' })

        createTestPinia()
        const store2 = usePrintTemplatesStore()
        store2.loadTemplates()
        expect(store2.getTemplate('purchase').name).toBe('采购单(改)')
    })

    it('重置单类型为默认', () => {
        const store = usePrintTemplatesStore()
        store.saveTemplate({ ...store.getTemplate('receipt'), name: '临时名' })
        store.resetTemplate('receipt')
        expect(store.getTemplate('receipt').name).toBe('零售小票')
        expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toContain('零售小票')
    })
})
