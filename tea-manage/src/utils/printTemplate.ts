/**
 * @file 打印模板渲染引擎
 * @description 把结构化区块模板渲染为可打印 HTML；提供 4 种单据的默认种子模板。
 *              小票/采购/退货走同步 renderTemplateHTML；标签走异步 renderLabelHTML（需生成条码图片）。
 */
import type {
    PrintTemplate,
    TemplateType,
    TemplateBlock,
    ShopInfo,
    ReceiptPrintData,
    DocPrintData,
    LabelPrintData
} from '@/types/printTemplate'

/** HTML 转义，防止模板/数据注入破坏结构 */
export function esc(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/** 金额固定两位小数（显示用） */
function money(n: number): string {
    return Number(n || 0).toFixed(2)
}

/** 对齐方式 → CSS */
function alignCss(a: string): string {
    return `text-align:${a};`
}

/** 区块基础样式 */
function blockStyle(block: TemplateBlock, extra = ''): string {
    return `font-size:${block.fontSize}px;${alignCss(block.align)}${extra}`
}

/**
 * 安全生成带 style 的 div 容器。
 * 注意：esbuild 对模板字符串中 `">${变量}`（属性闭合引号后紧跟变量插值）存在解析缺陷，
 * 会误报 "Unterminated string literal"。故此处用字符串拼接，让 `">` 落在字面量末尾，规避该问题。
 */
function divBlock(style: string, innerHtml: string): string {
    return `<div style="${style}">` + innerHtml + `</div>`
}

// ===================== 区块渲染（小票 / 单据通用） =====================

function renderHeader(block: TemplateBlock, data: { shopName: string }): string {
    if (!block.enabled) return ''
    const titleHtml = block.title
        ? `<div style="font-size:${Math.max(10, block.fontSize - 3)}px;">${esc(block.title)}</div>`
        : ''
    const style = blockStyle(block, 'font-weight:bold;margin-bottom:6px;')
    const inner = titleHtml + `<div>${esc(data.shopName)}</div>`
    return divBlock(style, inner)
}

function renderShopInfo(block: TemplateBlock, data: { shopAddress: string; shopPhone: string }): string {
    if (!block.enabled) return ''
    const fields = block.fields || ['address', 'phone']
    const lines: string[] = []
    if (fields.includes('address') && data.shopAddress) lines.push(esc(data.shopAddress))
    if (fields.includes('phone') && data.shopPhone) lines.push('电话：' + esc(data.shopPhone))
    if (lines.length === 0) return ''
    const sep = '<br/>'
    return divBlock(blockStyle(block, 'margin-bottom:6px;'), lines.join(sep))
}

function renderMeta(block: TemplateBlock, data: ReceiptPrintData | DocPrintData): string {
    if (!block.enabled) return ''
    const fields = block.fields || ['orderNo', 'date', 'supplier', 'handler']
    const rows: string[] = []
    if (fields.includes('orderNo')) rows.push(`单号：${esc(data.orderNo)}`)
    if (fields.includes('date')) rows.push(`日期：${esc(data.date)}`)
    if (fields.includes('supplier') && 'supplierName' in data && data.supplierName)
        rows.push(`供应商：${esc(data.supplierName)}`)
    if (fields.includes('handler') && 'handler' in data && data.handler)
        rows.push(`经手人：${esc(data.handler)}`)
    if (rows.length === 0) return ''
    const metaHtml = rows.map(r => `<div>${r}</div>`).join('')
    return divBlock(blockStyle(block, 'margin-bottom:8px;'), metaHtml)
}

/** 小票明细（名称 ×数量[单位] | 金额） */
function renderReceiptItems(block: TemplateBlock, data: ReceiptPrintData): string {
    if (!block.enabled) return ''
    const fields = block.fields || ['name', 'quantity', 'unit', 'subtotal']
    const rows = data.items.map(item => {
        const left = [
            fields.includes('name') ? esc(item.productName) : '',
            fields.includes('quantity') ? `×${item.quantity}` : '',
            fields.includes('unit') ? esc(item.unitName) : ''
        ].filter(Boolean).join(' ')
        const right = fields.includes('subtotal') ? `¥${money(item.subtotal)}` : ''
        return `<div style="display:flex;justify-content:space-between;padding:2px 0;">
            <span>${left}</span><span>${right}</span></div>`
    })
    const itemsHtml = rows.join('')
    return divBlock(blockStyle(block), itemsHtml)
}

/** 单据明细表（名称 | 数量单位 | 单价 | 金额），带表头 */
function renderDocItems(block: TemplateBlock, data: DocPrintData): string {
    if (!block.enabled) return ''
    const fields = block.fields || ['name', 'quantity', 'unit', 'price', 'subtotal']
    const headers: string[] = []
    if (fields.includes('name')) headers.push('商品')
    if (fields.includes('quantity') || fields.includes('unit')) headers.push('数量')
    if (fields.includes('price')) headers.push('单价')
    if (fields.includes('subtotal')) headers.push('金额')
    const thead = headers.map(h => `<th style="border:1px solid #000;padding:4px;">${h}</th>`).join('')
    const rows = data.items.map(item => {
        const tds: string[] = []
        if (fields.includes('name')) tds.push(`<td style="border:1px solid #000;padding:4px;text-align:left;">${esc(item.productName)}</td>`)
        if (fields.includes('quantity') || fields.includes('unit'))
            tds.push(`<td style="border:1px solid #000;padding:4px;">${esc(item.quantity + (fields.includes('unit') ? item.unitName : ''))}</td>`)
        if (fields.includes('price')) tds.push(`<td style="border:1px solid #000;padding:4px;">¥${money(item.price)}</td>`)
        if (fields.includes('subtotal')) tds.push(`<td style="border:1px solid #000;padding:4px;">¥${money(item.subtotal)}</td>`)
        return `<tr>${tds.join('')}</tr>`
    })
    const rowsHtml = rows.join('')
    return `<table style="width:100%;border-collapse:collapse;${blockStyle(block)}">
        <thead><tr>${thead}</tr></thead><tbody>${rowsHtml}</tbody></table>`
}

function renderSummary(block: TemplateBlock, data: ReceiptPrintData | DocPrintData): string {
    if (!block.enabled) return ''
    const isReceipt = 'actualAmount' in data
    const rows: string[] = []
    if (isReceipt) {
        const r = data as ReceiptPrintData
        rows.push(`<div style="display:flex;justify-content:space-between;"><span>合计:</span><span>¥${money(r.totalAmount)}</span></div>`)
        if (r.discountAmount > 0)
            rows.push(`<div style="display:flex;justify-content:space-between;color:#666;font-size:${Math.max(10, block.fontSize - 1)}px;"><span>优惠:</span><span>-¥${money(r.discountAmount)}</span></div>`)
        rows.push(`<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${block.fontSize + 2}px;"><span>实付:</span><span>¥${money(r.actualAmount)}</span></div>`)
    } else {
        const d = data as DocPrintData
        rows.push(`<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${block.fontSize + 2}px;"><span>总计:</span><span>¥${money(d.totalAmount)}</span></div>`)
    }
    const summaryHtml = rows.join('')
    return divBlock(blockStyle(block, 'margin-top:6px;'), summaryHtml)
}

function renderMember(block: TemplateBlock, data: ReceiptPrintData): string {
    if (!block.enabled) return ''
    const lines: string[] = []
    if (data.memberName) lines.push(`会员：${esc(data.memberName)}`)
    if (data.payMethod) {
        const pm: Record<string, string> = { cash: '现金', wechat: '微信', alipay: '支付宝', memberBalance: '会员卡', combined: '组合支付' }
        lines.push(`支付：${pm[data.payMethod] || esc(data.payMethod)}`)
    }
    if (data.pointsEarned > 0) lines.push(`积分：+${data.pointsEarned}`)
    if (lines.length === 0) return ''
    const memberHtml = lines.map(l => `<div>${l}</div>`).join('')
    return divBlock(blockStyle(block, 'margin-top:4px;'), memberHtml)
}

function renderCustomText(block: TemplateBlock): string {
    if (!block.enabled) return ''
    const text = (block.text || '').trim()
    if (!text) return ''
    const lines = text.split('\n').map(l => esc(l))
    const customHtml = lines.map(l => `<div>${l}</div>`).join('')
    return divBlock(blockStyle(block, 'margin-top:8px;'), customHtml)
}

// ===================== 对外渲染入口 =====================

/**
 * 同步渲染小票 / 采购 / 退货 单据 HTML
 */
export function renderTemplateHTML(
    tpl: PrintTemplate,
    data: ReceiptPrintData | DocPrintData
): string {
    const body = tpl.blocks
        .map(block => {
            switch (block.kind) {
                case 'header': return renderHeader(block, data)
                case 'shopInfo': return renderShopInfo(block, data)
                case 'meta': return renderMeta(block, data)
                case 'items':
                    return tpl.type === 'receipt'
                        ? renderReceiptItems(block, data as ReceiptPrintData)
                        : renderDocItems(block, data as DocPrintData)
                case 'summary': return renderSummary(block, data)
                case 'member': return tpl.type === 'receipt' ? renderMember(block, data as ReceiptPrintData) : ''
                case 'customText': return renderCustomText(block)
                default: return ''
            }
        })
        .filter(Boolean)
        .join('<div class="tea-divider" style="border-top:1px dashed #000;margin:6px 0;"></div>')

    const width = tpl.paper.widthMm
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        @page { size: ${width}mm auto; margin: 0; }
        body { font-family: "Courier New", "Microsoft YaHei", monospace; width: ${width}mm; margin: 0 auto; padding: 6px; color: #000; box-sizing: border-box; }
        th { background: #f0f0f0; }
    </style></head><body>${body}</body></html>`
}

/**
 * 异步渲染条码标签 HTML（生成真实条码图片）
 */
export async function renderLabelHTML(tpl: PrintTemplate, data: LabelPrintData): Promise<string> {
    const blocksHtml = await Promise.all(
        tpl.blocks.map(async block => {
            switch (block.kind) {
                case 'header': return renderHeader(block, data)
                case 'shopInfo': return renderShopInfo(block, data)
                case 'customText': return renderCustomText(block)
                case 'barcode': {
                    if (!block.enabled) return ''
                    const url = await barcodeToDataURL(data.productCode)
                    return `<div style="${blockStyle(block, 'margin-top:6px;')}"><img src="${url}" style="max-width:100%;"/></div>`
                }
                case 'qrcode': {
                    if (!block.enabled) return ''
                    const url = await qrcodeToDataURL(`${data.productCode}|${data.batchCode}`)
                    return `<div style="${blockStyle(block, 'margin-top:6px;')}"><img src="${url}" style="width:${Math.min(120, tpl.paper.widthMm * 2)}px;"/></div>`
                }
                default: return ''
            }
        })
    )
    const body = blocksHtml.filter(Boolean).join('')
    const w = tpl.paper.widthMm
    const h = tpl.paper.heightMm ? `${tpl.paper.heightMm}mm` : 'auto'
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        @page { size: ${w}mm ${h}; margin: 0; }
        body { font-family: "Microsoft YaHei", sans-serif; width: ${w}mm; height: ${h}; margin: 0 auto; padding: 4px; color: #000; box-sizing: border-box; display:flex; flex-direction:column; justify-content:center; }
    </style></head><body>${body}</body></html>`
}

/** Code128 → dataURL（离屏 canvas） */
async function barcodeToDataURL(text: string): Promise<string> {
    const canvas = document.createElement('canvas')
    const JsBarcode = (await import('jsbarcode')).default
    JsBarcode(canvas, text, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 12, margin: 4, background: '#fff', lineColor: '#000' })
    return canvas.toDataURL('image/png')
}

/** 二维码 → dataURL（离屏 canvas） */
async function qrcodeToDataURL(text: string): Promise<string> {
    const canvas = document.createElement('canvas')
    const QRCode = (await import('qrcode')).default
    await QRCode.toCanvas(canvas, text, { width: 160, margin: 2 })
    return canvas.toDataURL('image/png')
}

// ===================== 默认种子模板 =====================

function now(): string {
    return new Date().toISOString()
}

/** localStorage 键 */
export const TEMPLATE_STORAGE_KEY = 'tea-print-templates'

/**
 * 读取已存模板，与默认模板合并（保证新增字段/区块不丢失）。
 * 纯函数，不依赖 Pinia，可被 store 与 print.ts 共用，也便于单测。
 */
export function loadStoredTemplates(): Record<TemplateType, PrintTemplate> {
    const defaults = defaultTemplates()
    try {
        const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY)
        if (!raw) return defaults
        const parsed = JSON.parse(raw) as Partial<Record<TemplateType, PrintTemplate>>
        const merged = { ...defaults }
        ;(Object.keys(parsed) as TemplateType[]).forEach(k => {
            if (parsed[k]?.blocks) {
                merged[k] = { ...defaults[k], ...parsed[k], blocks: parsed[k]!.blocks }
            }
        })
        return merged
    } catch {
        return defaults
    }
}

/** 保存全部模板到 localStorage */
export function saveStoredTemplates(map: Record<TemplateType, PrintTemplate>): void {
    try {
        localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(map))
    } catch {
        /* localStorage 不可用时忽略（如隐私模式） */
    }
}

/**
 * 生成某类型的演示打印数据（店铺信息由调用方传入，保持本模块无 store 依赖、可单测）。
 * 预览组件与"测试打印"共用，避免重复造数据。
 */
export function demoPrintData(
    type: TemplateType,
    shop: ShopInfo
): ReceiptPrintData | DocPrintData | LabelPrintData {
    if (type === 'label') {
        return {
            ...shop,
            productName: '武夷岩茶',
            origin: '武夷山',
            weight: '250g',
            price: 200,
            productCode: '6901234500017',
            batchCode: 'B20260713'
        }
    }
    if (type === 'receipt') {
        return {
            ...shop,
            orderNo: 'XS20260713001',
            date: '2026-07-13 14:30',
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
    }
    return {
        ...shop,
        orderNo: type === 'purchase' ? 'PO20260713001' : 'RO20260713001',
        date: '2026-07-13',
        supplierName: '浙江茶商',
        handler: '店员A',
        title: type === 'purchase' ? '采购入库单' : '退货出库单',
        items: [
            { productName: '龙井', quantity: 10, unitName: '包', price: 50, subtotal: 500 },
            { productName: '红茶', quantity: 5, unitName: '盒', price: 80, subtotal: 400 }
        ],
        totalAmount: 900
    }
}

/** 4 种单据的默认模板（覆盖现有写死 HTML，保证重构不回退） */
export function defaultTemplates(): Record<TemplateType, PrintTemplate> {
    return {
        receipt: {
            id: 'receipt', name: '零售小票', type: 'receipt',
            paper: { widthMm: 58 },
            updatedAt: now(),
            blocks: [
                { kind: 'header', enabled: true, fontSize: 16, align: 'center' },
                { kind: 'shopInfo', enabled: true, fontSize: 11, align: 'center', fields: ['address', 'phone'] },
                { kind: 'meta', enabled: true, fontSize: 11, align: 'left', fields: ['orderNo', 'date'] },
                { kind: 'items', enabled: true, fontSize: 12, align: 'left', fields: ['name', 'quantity', 'unit', 'subtotal'] },
                { kind: 'summary', enabled: true, fontSize: 12, align: 'left' },
                { kind: 'member', enabled: true, fontSize: 11, align: 'left' },
                { kind: 'customText', enabled: true, fontSize: 11, align: 'center', text: '感谢惠顾，欢迎再次光临！\n扫码关注公众号领优惠券' }
            ]
        },
        purchase: {
            id: 'purchase', name: '采购入库单', type: 'purchase',
            paper: { widthMm: 210 },
            updatedAt: now(),
            blocks: [
                { kind: 'header', enabled: true, fontSize: 18, align: 'center', title: '采购入库单' },
                { kind: 'meta', enabled: true, fontSize: 12, align: 'left', fields: ['orderNo', 'date', 'supplier', 'handler'] },
                { kind: 'items', enabled: true, fontSize: 12, align: 'left', fields: ['name', 'quantity', 'unit', 'price', 'subtotal'] },
                { kind: 'summary', enabled: true, fontSize: 13, align: 'left' },
                { kind: 'customText', enabled: true, fontSize: 11, align: 'left', text: '供应商签字：________________\n收货人签字：________________' }
            ]
        },
        return: {
            id: 'return', name: '退货出库单', type: 'return',
            paper: { widthMm: 210 },
            updatedAt: now(),
            blocks: [
                { kind: 'header', enabled: true, fontSize: 18, align: 'center', title: '退货出库单' },
                { kind: 'meta', enabled: true, fontSize: 12, align: 'left', fields: ['orderNo', 'date', 'supplier', 'handler'] },
                { kind: 'items', enabled: true, fontSize: 12, align: 'left', fields: ['name', 'quantity', 'unit', 'price', 'subtotal'] },
                { kind: 'summary', enabled: true, fontSize: 13, align: 'left' },
                { kind: 'customText', enabled: true, fontSize: 11, align: 'left', text: '退换货凭证，请妥善保管。\n经手人签字：________________' }
            ]
        },
        label: {
            id: 'label', name: '条码标签', type: 'label',
            paper: { widthMm: 40, heightMm: 30 },
            updatedAt: now(),
            blocks: [
                { kind: 'header', enabled: true, fontSize: 14, align: 'center' },
                { kind: 'customText', enabled: true, fontSize: 11, align: 'left', text: '产地：武夷山\n净重：250g\n零售价：¥200.00' },
                { kind: 'barcode', enabled: true, fontSize: 11, align: 'center' },
                { kind: 'qrcode', enabled: true, fontSize: 11, align: 'center' }
            ]
        }
    }
}
