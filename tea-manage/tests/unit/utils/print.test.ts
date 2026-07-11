/**
 * @file 打印工具单元测试
 * @description 测试 print.ts 中的打印逻辑
 *              - printHTML: 通过 jsdom 提供的 document API + spy createElement 测试 iframe 创建逻辑
 *              - printReceipt: 验证小票 HTML 构建（通过 mock createElement 拦截 doc.write）
 *              - printPurchaseOrder: 验证入库单 HTML 构建（同上）
 */
import { describe, it, expect, vi } from 'vitest'
import { printHTML, printReceipt, printPurchaseOrder } from '@/utils/print'
import type { SaleOrder } from '@/types'

// 测试用 SaleOrder 数据
const mockSaleOrder: SaleOrder = {
    id: 'order-001',
    orderNo: 'XS20260703001',
    memberId: null,
    memberName: null,
    totalAmount: 100,
    discountAmount: 0,
    pointsDeduct: 0,
    pointsEarned: 10,
    actualAmount: 100,
    payMethod: 'cash',
    payStatus: 'paid',
    status: 'completed',
    remark: null,
    items: [
        {
            id: 'item-1',
            orderId: 'order-001',
            productId: 'p-1',
            productName: '龙井茶',
            unitName: '50g',
            unitId: 'u-1',
            quantity: 2,
            unitPrice: 50,
            grams: 100,
            subtotal: 100
        }
    ],
    createdAt: '2026-07-03T14:30:00'
}

/**
 * 辅助函数：mock document.createElement 以拦截 iframe 的 doc.write 内容
 * 返回 capturedHTML 引用，测试中可断言其内容
 */
function mockIframeDocWrite(): { capture: () => string; restore: () => void } {
    let capturedHTML = ''
    const originalCreateElement = document.createElement.bind(document)
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag)
        if (tag === 'iframe') {
            Object.defineProperty(el, 'contentWindow', {
                get: () => ({
                    document: {
                        open: () => {},
                        write: (html: string) => { capturedHTML = html },
                        close: () => {}
                    },
                    print: () => {}
                }),
                configurable: true
            })
        }
        return el
    })
    return {
        capture: () => capturedHTML,
        restore: () => spy.mockRestore()
    }
}

describe('print 工具函数', () => {
    // ========== printHTML ==========
    // 实现说明：printHTML 创建 iframe 写入 HTML 后调用 print，100ms 后移除 iframe
    // 因此 await 完成后 iframe 已被移除，测试通过 spy document.createElement 检查
    describe('printHTML', () => {
        it('调用 document.createElement("iframe") 创建 iframe', async () => {
            const spy = vi.spyOn(document, 'createElement')
            await printHTML('<div>test</div>')
            expect(spy).toHaveBeenCalledWith('iframe')
            spy.mockRestore()
        })

        it('调用 document.body.appendChild 附加 iframe', async () => {
            const spy = vi.spyOn(document.body, 'appendChild')
            await printHTML('<div>test</div>')
            expect(spy).toHaveBeenCalled()
            spy.mockRestore()
        })

        it('iframe 样式为隐藏（fixed/0尺寸/无边框）', async () => {
            const createdElements: Element[] = []
            const originalCreateElement = document.createElement.bind(document)
            const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const el = originalCreateElement(tag)
                if (tag === 'iframe') {
                    createdElements.push(el)
                    Object.defineProperty(el, 'contentWindow', {
                        get: () => ({
                            document: { open: () => {}, write: () => {}, close: () => {} },
                            print: () => {}
                        }),
                        configurable: true
                    })
                }
                return el
            })

            await printHTML('<div>test</div>')
            const iframe = createdElements[0] as HTMLIFrameElement
            expect(iframe.style.position).toBe('fixed')
            expect(iframe.style.right).toMatch(/^0/)  // right: 0
            expect(iframe.style.bottom).toMatch(/^0/) // bottom: 0
            // jsdom 会把 '0' 规范化为 '0px'
            expect(iframe.style.width).toMatch(/^0/)
            expect(iframe.style.height).toMatch(/^0/)
            // 注：iframe.style.border = 'none' 在 jsdom 中会被忽略（简写属性），
            // 实际浏览器中正常工作，此处不验证 border
            spy.mockRestore()
        })

        it('iframe contentWindow.document 写入 HTML 内容', async () => {
            const mock = mockIframeDocWrite()
            await printHTML('<div>hello</div>')
            expect(mock.capture()).toContain('hello')
            mock.restore()
        })

        it('iframe 加载完成后调用 print', async () => {
            const printMock = vi.fn()
            const originalCreateElement = document.createElement.bind(document)
            const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const el = originalCreateElement(tag)
                if (tag === 'iframe') {
                    Object.defineProperty(el, 'contentWindow', {
                        get: () => ({
                            document: { open: () => {}, write: () => {}, close: () => {} },
                            print: printMock
                        }),
                        configurable: true
                    })
                    // 异步触发 onload
                    setTimeout(() => (el as HTMLIFrameElement).onload?.(new Event('load')), 0)
                }
                return el
            })

            await printHTML('<div>test</div>')
            await new Promise(r => setTimeout(r, 200))
            expect(printMock).toHaveBeenCalled()
            spy.mockRestore()
        })
    })

    // ========== printReceipt ==========
    describe('printReceipt 小票打印', () => {
        it('调用 printHTML 渲染小票 HTML', async () => {
            const spy = vi.spyOn(document.body, 'appendChild')
            await printReceipt(mockSaleOrder)
            expect(spy).toHaveBeenCalled()
            spy.mockRestore()
        })

        it('小票包含所有关键字段 - 店铺名/订单号/商品/金额/支付方式/积分', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({
                ...mockSaleOrder,
                payMethod: 'wechat',
                memberName: '张三',
                pointsEarned: 20,
                discountAmount: 5,
                actualAmount: 95
            })
            const html = mock.capture()
            // 店铺名
            expect(html).toContain('茶易管')
            // 订单号
            expect(html).toContain('XS20260703001')
            // 商品名和数量
            expect(html).toContain('龙井茶')
            expect(html).toContain('x2')
            // 实付金额
            expect(html).toContain('95.00')
            // 优惠金额
            expect(html).toContain('5.00')
            expect(html).toContain('优惠')
            // 会员名
            expect(html).toContain('张三')
            expect(html).toContain('会员')
            // 积分
            expect(html).toContain('+20')
            // 支付方式映射：wechat → 微信
            expect(html).toContain('微信')
            mock.restore()
        })

        it('支付方式映射 - cash → 现金', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({ ...mockSaleOrder, payMethod: 'cash' })
            expect(mock.capture()).toContain('现金')
            mock.restore()
        })

        it('支付方式映射 - alipay → 支付宝', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({ ...mockSaleOrder, payMethod: 'alipay' })
            expect(mock.capture()).toContain('支付宝')
            mock.restore()
        })

        it('支付方式映射 - memberBalance → 会员卡', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({ ...mockSaleOrder, payMethod: 'memberBalance' })
            expect(mock.capture()).toContain('会员卡')
            mock.restore()
        })

        it('支付方式映射 - combined → 组合支付', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({ ...mockSaleOrder, payMethod: 'combined' })
            expect(mock.capture()).toContain('组合支付')
            mock.restore()
        })

        it('无会员时不显示会员行', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({ ...mockSaleOrder, memberName: null })
            const html = mock.capture()
            // 不应包含 "会员:" 前缀（但有"会员卡"支付方式映射时可能误判，使用精确匹配）
            expect(html).not.toMatch(/会员:\s/)
            mock.restore()
        })

        it('积分为 0 时不显示积分行', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({ ...mockSaleOrder, pointsEarned: 0 })
            expect(mock.capture()).not.toContain('积分: +0')
            mock.restore()
        })

        it('优惠为 0 时不显示优惠行', async () => {
            const mock = mockIframeDocWrite()
            await printReceipt({ ...mockSaleOrder, discountAmount: 0 })
            expect(mock.capture()).not.toMatch(/优惠:\s*-¥0\.00/)
            mock.restore()
        })
    })

    // ========== printPurchaseOrder ==========
    describe('printPurchaseOrder 入库单打印', () => {
        it('调用 printHTML 渲染入库单 HTML', async () => {
            const spy = vi.spyOn(document.body, 'appendChild')
            await printPurchaseOrder({
                id: 'po-1',
                orderNo: 'PO20260703001',
                supplierName: '浙江茶商',
                items: [],
                totalAmount: 0,
                handler: '张三',
                date: '2026-07-03'
            })
            expect(spy).toHaveBeenCalled()
            spy.mockRestore()
        })

        it('入库单包含标题/供应商/商品明细/总金额', async () => {
            const mock = mockIframeDocWrite()
            await printPurchaseOrder({
                id: 'po-1',
                orderNo: 'PO20260703001',
                supplierName: '浙江茶商',
                items: [
                    { productName: '龙井', quantity: 10, unitName: '包', price: 50, subtotal: 500 },
                    { productName: '红茶', quantity: 5, unitName: '盒', price: 80, subtotal: 400 }
                ],
                totalAmount: 900,
                handler: '张三',
                date: '2026-07-03'
            })
            const html = mock.capture()
            expect(html).toContain('采购入库单')
            expect(html).toContain('浙江茶商')
            expect(html).toContain('PO20260703001')
            expect(html).toContain('龙井')
            expect(html).toContain('红茶')
            expect(html).toContain('900.00')
            expect(html).toContain('张三')
            expect(html).toContain('2026-07-03')
            mock.restore()
        })
    })
})
