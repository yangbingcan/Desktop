/**
 * @file 打印工具
 * @description 小票 / 采购入库单 / 退货出库单 / 条码标签打印。
 *              v0.7.0 起改为由 printTemplate 渲染引擎 + 模板配置驱动；旧 buildReceiptHTML 仅作回退。
 */
import type { SaleOrder, PurchaseOrder, ReturnOrder } from '@/types'
import type {
    PrintTemplate,
    TemplateType,
    ReceiptPrintData,
    DocPrintData,
    LabelPrintData,
    ShopInfo
} from '@/types/printTemplate'
import {
    renderTemplateHTML,
    renderLabelHTML,
    defaultTemplates,
    loadStoredTemplates,
    esc
} from '@/utils/printTemplate'
import { useSettingsStore } from '@/stores/settings'

/**
 * 调用系统打印（通过 iframe）
 * @param htmlContent 打印内容的 HTML
 */
export async function printHTML(htmlContent: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = 'none'
        document.body.appendChild(iframe)

        const doc = iframe.contentWindow?.document
        if (!doc) {
            document.body.removeChild(iframe)
            reject(new Error('无法创建打印 iframe'))
            return
        }

        doc.open()
        doc.write(htmlContent)
        doc.close()

        iframe.onload = () => {
            try {
                iframe.contentWindow?.print()
                setTimeout(() => {
                    document.body.removeChild(iframe)
                    resolve()
                }, 100)
            } catch (e) {
                document.body.removeChild(iframe)
                reject(e)
            }
        }

        // 保险超时
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe)
            }
            resolve()
        }, 2000)
    })
}

/**
 * 仅预览打印内容（新窗口打开，不触发系统打印对话框）
 * @param htmlContent 打印内容的 HTML
 */
export function previewHTML(htmlContent: string): void {
    const win = window.open('', '_blank')
    if (!win) {
        console.warn('预览窗口被浏览器拦截')
        return
    }
    win.document.open()
    win.document.write(htmlContent)
    win.document.close()
}

/** 读取店铺信息（来自 settings，作为渲染数据单一来源；无 Pinia 时回退默认） */
function shopInfo(): ShopInfo {
    try {
        const s = useSettingsStore()
        return {
            shopName: s.settings.shopName || '茶易管',
            shopAddress: s.settings.shopAddress || '',
            shopPhone: s.settings.shopPhone || ''
        }
    } catch {
        return { shopName: '茶易管', shopAddress: '', shopPhone: '' }
    }
}

/** 取得某类型模板（localStorage → 缺省合并），失败时回退到内置默认 */
function getTemplateSafe(type: TemplateType): PrintTemplate {
    try {
        return loadStoredTemplates()[type] ?? defaultTemplates()[type]
    } catch {
        return defaultTemplates()[type]
    }
}

/** ISO 时间格式化（打印展示用）：日期串原样返回，时间戳返回 YYYY-MM-DD HH:mm */
function formatDate(iso: string): string {
    if (!iso) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** SaleOrder → ReceiptPrintData */
function toReceiptData(order: SaleOrder): ReceiptPrintData {
    return {
        ...shopInfo(),
        orderNo: order.orderNo,
        date: formatDate(order.createdAt),
        items: order.items.map(it => ({
            productName: it.productName,
            quantity: it.quantity,
            unitName: it.unitName,
            subtotal: it.subtotal
        })),
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        actualAmount: order.actualAmount,
        memberName: order.memberName,
        payMethod: order.payMethod,
        pointsEarned: order.pointsEarned
    }
}

/** PurchaseOrder → DocPrintData */
function toPurchaseData(order: PurchaseOrder): DocPrintData {
    return {
        ...shopInfo(),
        orderNo: order.orderNo,
        date: formatDate(order.createdAt),
        supplierName: order.supplierName,
        handler: order.handler || '',
        title: '采购入库单',
        items: order.items.map(it => ({
            productName: it.productName,
            quantity: it.quantity,
            unitName: it.unitName,
            price: it.unitPrice,
            subtotal: it.subtotal
        })),
        totalAmount: order.totalAmount
    }
}

/** ReturnOrder → DocPrintData */
function toReturnData(order: ReturnOrder): DocPrintData {
    return {
        ...shopInfo(),
        orderNo: order.orderNo,
        date: formatDate(order.createdAt),
        supplierName: order.supplierName,
        handler: '',
        title: '退货出库单',
        items: order.items.map(it => ({
            productName: it.productName,
            quantity: it.quantity,
            unitName: it.unitName,
            price: it.unitPrice,
            subtotal: it.subtotal
        })),
        totalAmount: order.totalAmount
    }
}

/** 打印零售小票（模板引擎；异常时回退旧 HTML） */
export async function printReceipt(order: SaleOrder): Promise<void> {
    const data = toReceiptData(order)
    let html = ''
    try {
        html = renderTemplateHTML(getTemplateSafe('receipt'), data)
    } catch {
        html = buildReceiptHTML(order)
    }
    await printHTML(html)
}

/** 打印采购入库单 */
export async function printPurchaseOrder(order: PurchaseOrder): Promise<void> {
    const html = renderTemplateHTML(getTemplateSafe('purchase'), toPurchaseData(order))
    await printHTML(html)
}

/** 打印退货出库单 */
export async function printReturnOrder(order: ReturnOrder): Promise<void> {
    const html = renderTemplateHTML(getTemplateSafe('return'), toReturnData(order))
    await printHTML(html)
}

/** 打印条码标签（含一维码/二维码图片，异步）；copies 控制同页重复份数，避免多次弹窗 */
export async function printLabel(label: LabelPrintData, copies = 1): Promise<void> {
    let html = await renderLabelHTML(getTemplateSafe('label'), label)
    const n = Math.max(1, Math.floor(copies))
    if (n > 1) {
        const inner = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? ''
        html = html.replace(/<body>[\s\S]*?<\/body>/, `<body>${inner.repeat(n)}</body>`)
    }
    await printHTML(html)
}

/**
 * 构建小票 HTML（回退实现，模板引擎不可用时的兜底）
 */
function buildReceiptHTML(order: SaleOrder): string {
    const shopName = shopInfo().shopName
    const payMethodName = {
        cash: '现金',
        wechat: '微信',
        alipay: '支付宝',
        memberBalance: '会员卡',
        combined: '组合支付'
    }[order.payMethod || 'cash'] || esc(order.payMethod || '现金')

    const itemsHTML = order.items
        .map(
            item => `
        <tr>
            <td style="text-align:left">${esc(item.productName)}</td>
            <td style="text-align:center">x${item.quantity}</td>
            <td style="text-align:right">&yen;${item.subtotal.toFixed(2)}</td>
        </tr>
    `
        )
        .join('')

    const date = formatDate(order.createdAt)

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { size: 58mm auto; margin: 0; }
        body {
            font-family: "Courier New", monospace;
            width: 58mm;
            margin: 0 auto;
            padding: 5px;
            font-size: 12px;
        }
        .header { text-align: center; margin-bottom: 8px; }
        .header h2 { margin: 0; font-size: 16px; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3px 0; vertical-align: top; }
        .total-row { font-weight: bold; margin-top: 6px; }
        .discount { color: #666; font-size: 11px; }
        .footer { text-align: center; margin-top: 8px; font-size: 11px; }
        .order-info { font-size: 10px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h2>${esc(shopName)}</h2>
        <div class="order-info">${date}</div>
    </div>
    <div class="divider"></div>
    <table>
        ${itemsHTML}
    </table>
    <div class="divider"></div>
    <div class="total-row">
        <div style="display:flex;justify-content:space-between;">
            <span>合计:</span>
            <span>&yen;${order.totalAmount.toFixed(2)}</span>
        </div>
        ${order.discountAmount > 0 ? `
        <div class="discount" style="display:flex;justify-content:space-between;">
            <span>优惠:</span>
            <span>-&yen;${order.discountAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;font-size:14px;">
            <span>实付:</span>
            <span>&yen;${order.actualAmount.toFixed(2)}</span>
        </div>
    </div>
    ${order.memberName ? `<div style="margin-top:4px;">会员: ${order.memberName}</div>` : ''}
    <div style="margin-top:4px;">支付: ${payMethodName}</div>
    ${order.pointsEarned > 0 ? `<div style="margin-top:4px;">积分: +${order.pointsEarned}</div>` : ''}
    <div class="footer">
        <div class="divider"></div>
        <div>订单号: ${esc(order.orderNo)}</div>
        <div style="margin-top:4px;">感谢惠顾，欢迎再次光临！</div>
    </div>
</body>
</html>
    `
}
