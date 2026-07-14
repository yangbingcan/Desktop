/**
 * @file 打印模板渲染引擎单元测试
 * @description 测试 renderTemplateHTML（小票/采购/退货）的区块渲染、禁用、字段过滤、金额格式。
 *              renderLabelHTML 依赖 DOM canvas 生成图片，不在本文件覆盖（由预览组件/e2e 验证）。
 */
import { describe, it, expect } from 'vitest'
import { renderTemplateHTML, defaultTemplates } from '@/utils/printTemplate'
import type { ReceiptPrintData, DocPrintData } from '@/types/printTemplate'

const receiptData: ReceiptPrintData = {
    shopName: '茶易管',
    shopAddress: '茶香路1号',
    shopPhone: '13800000000',
    orderNo: 'XS20260713001',
    date: '2026-07-13',
    items: [
        { productName: '龙井茶', quantity: 2, unitName: '50g', subtotal: 100 },
        { productName: '红茶', quantity: 1, unitName: '盒', subtotal: 80 }
    ],
    totalAmount: 180,
    discountAmount: 10,
    actualAmount: 170,
    memberName: '张三',
    payMethod: 'wechat',
    pointsEarned: 20
}

const docData: DocPrintData = {
    shopName: '茶易管',
    shopAddress: '茶香路1号',
    shopPhone: '13800000000',
    orderNo: 'PO20260713001',
    date: '2026-07-13',
    supplierName: '浙江茶商',
    handler: '店员A',
    title: '采购入库单',
    items: [
        { productName: '龙井', quantity: 10, unitName: '包', price: 50, subtotal: 500 },
        { productName: '红茶', quantity: 5, unitName: '盒', price: 80, subtotal: 400 }
    ],
    totalAmount: 900
}

describe('renderTemplateHTML - 小票', () => {
    it('默认模板包含店名/订单号/商品/金额', () => {
        const html = renderTemplateHTML(defaultTemplates().receipt, receiptData)
        expect(html).toContain('茶易管')
        expect(html).toContain('XS20260713001')
        expect(html).toContain('龙井茶')
        expect(html).toContain('红茶')
    })

    it('金额固定两位小数', () => {
        const html = renderTemplateHTML(defaultTemplates().receipt, receiptData)
        expect(html).toContain('180.00')
        expect(html).toContain('170.00')
        expect(html).toContain('10.00')
    })

    it('优惠>0 显示优惠行，会员信息与积分显示', () => {
        const html = renderTemplateHTML(defaultTemplates().receipt, receiptData)
        expect(html).toContain('优惠')
        expect(html).toContain('张三')
        expect(html).toContain('+20')
        expect(html).toContain('微信')
    })

    it('禁用 member 区块后不出现会员行', () => {
        const tpl = defaultTemplates().receipt
        tpl.blocks = tpl.blocks.map(b => (b.kind === 'member' ? { ...b, enabled: false } : b))
        const html = renderTemplateHTML(tpl, receiptData)
        expect(html).not.toContain('会员：')
    })

    it('items 字段过滤：仅显示名称与金额时不出现 × 数量', () => {
        const tpl = defaultTemplates().receipt
        tpl.blocks = tpl.blocks.map(b =>
            b.kind === 'items' ? { ...b, fields: ['name', 'subtotal'] } : b
        )
        const html = renderTemplateHTML(tpl, receiptData)
        expect(html).toContain('龙井茶')
        expect(html).not.toContain('×2')
    })

    it('自定义文本按行渲染', () => {
        const tpl = defaultTemplates().receipt
        tpl.blocks = tpl.blocks.map(b =>
            b.kind === 'customText' ? { ...b, text: '感谢惠顾\n第二行' } : b
        )
        const html = renderTemplateHTML(tpl, receiptData)
        expect(html).toContain('感谢惠顾')
        expect(html).toContain('第二行')
    })
})

describe('renderTemplateHTML - 采购/退货单据', () => {
    it('采购单含标题/供应商/经手人/总计', () => {
        const html = renderTemplateHTML(defaultTemplates().purchase, docData)
        expect(html).toContain('采购入库单')
        expect(html).toContain('浙江茶商')
        expect(html).toContain('店员A')
        expect(html).toContain('900.00')
    })

    it('明细表含单价列', () => {
        const html = renderTemplateHTML(defaultTemplates().purchase, docData)
        expect(html).toContain('50.00')
        expect(html).toContain('80.00')
    })

    it('退货单复用 doc 渲染且标题正确', () => {
        const tpl = defaultTemplates().return
        const data: DocPrintData = { ...docData, title: '退货出库单' }
        const html = renderTemplateHTML(tpl, data)
        expect(html).toContain('退货出库单')
        expect(html).toContain('900.00')
    })
})
