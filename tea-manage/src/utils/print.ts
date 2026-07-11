/**
 * @file 打印工具
 * @description 小票打印、标签打印相关工具
 */
import type { SaleOrder } from '@/types'

/**
 * 调用系统打印（通过 iframe）
 * @param htmlContent 打印内容的 HTML
 */
export async function printHTML(htmlContent: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // 创建隐藏的 iframe
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

        // 等待内容加载后打印
        iframe.onload = () => {
            try {
                iframe.contentWindow?.print()
                // 打印完成后移除 iframe
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
 * 打印小票
 * @param order 销售订单（camelCase 字段，匹配后端 rename_all = "camelCase"）
 */
export async function printReceipt(order: SaleOrder): Promise<void> {
    const html = buildReceiptHTML(order)
    await printHTML(html)
}

/**
 * 打印入库单
 */
export async function printPurchaseOrder(order: {
    id: string
    orderNo: string
    supplierName: string
    items: Array<{
        productName: string
        quantity: number
        unitName: string
        price: number
        subtotal: number
    }>
    totalAmount: number
    handler: string
    date: string
}): Promise<void> {
    const html = buildPurchaseOrderHTML(order)
    await printHTML(html)
}

/**
 * 构建小票 HTML
 */
function buildReceiptHTML(order: SaleOrder): string {
    const shopName = '茶易管'
    const payMethodName = {
        cash: '现金',
        wechat: '微信',
        alipay: '支付宝',
        memberBalance: '会员卡',
        combined: '组合支付'
    }[order.payMethod || 'cash'] || order.payMethod || '现金'

    const itemsHTML = order.items
        .map(
            item => `
        <tr>
            <td style="text-align:left">${item.productName}</td>
            <td style="text-align:center">x${item.quantity}</td>
            <td style="text-align:right">&yen;${item.subtotal.toFixed(2)}</td>
        </tr>
    `
        )
        .join('')

    const date = new Date(order.createdAt).toLocaleString('zh-CN')

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
        <h2>${shopName}</h2>
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
        <div>订单号: ${order.orderNo}</div>
        <div style="margin-top:4px;">感谢惠顾，欢迎再次光临！</div>
    </div>
</body>
</html>
    `
}

/**
 * 构建入库单 HTML
 */
function buildPurchaseOrderHTML(order: {
    orderNo: string
    supplierName: string
    items: Array<{
        productName: string
        quantity: number
        unitName: string
        price: number
        subtotal: number
    }>
    totalAmount: number
    handler: string
    date: string
}): string {
    const itemsHTML = order.items
        .map(
            item => `
        <tr>
            <td>${item.productName}</td>
            <td>${item.quantity}${item.unitName}</td>
            <td>&yen;${item.price.toFixed(2)}</td>
            <td>&yen;${item.subtotal.toFixed(2)}</td>
        </tr>
    `
        )
        .join('')

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; width: 210mm; margin: 0 auto; padding: 20px; }
                h1 { text-align: center; }
                .info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f0f0f0; }
                .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>采购入库单</h1>
            <div class="info">
                <p>单号：${order.orderNo}</p>
                <p>供应商：${order.supplierName}</p>
                <p>日期：${order.date}</p>
                <p>经手人：${order.handler}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>商品名称</th>
                        <th>数量</th>
                        <th>单价</th>
                        <th>金额</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
            <div class="total">
                总计：&yen;${order.totalAmount.toFixed(2)}
            </div>
            <div style="margin-top: 40px;">
                <p>供应商签字：________________</p>
                <p>收货人签字：________________</p>
            </div>
        </body>
        </html>
    `
}
