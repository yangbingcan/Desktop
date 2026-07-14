/**
 * @file 打印模板类型定义
 * @description 结构化区块配置器的模板数据模型（小票/采购入库/退货出库/条码标签）
 */

/** 模板类型 */
export type TemplateType = 'receipt' | 'purchase' | 'return' | 'label'

/** 区块种类 */
export type BlockKind =
    | 'header' // 店名（大字）
    | 'shopInfo' // 地址 / 电话
    | 'meta' // 单号 / 日期 / 供应商 / 经手人（采购退货用）
    | 'items' // 商品明细表
    | 'summary' // 合计 / 优惠 / 实付（小票）；总计（采购退货）
    | 'member' // 会员名 / 积分（小票）
    | 'customText' // 自由文本行（页脚感谢语、促销语等）
    | 'barcode' // Code128 一维码（标签）
    | 'qrcode' // 二维码（标签）

/** 商品明细可显示字段 */
export type ItemField = 'name' | 'quantity' | 'unit' | 'price' | 'subtotal'

/** meta 区块可显示字段 */
export type MetaField = 'orderNo' | 'date' | 'supplier' | 'handler'

/** 单个模板区块 */
export interface TemplateBlock {
    kind: BlockKind
    /** 是否启用（禁用区块不参与渲染） */
    enabled: boolean
    /** 区块标题（可选，如"合计""会员"） */
    title?: string
    /** 字号 px，默认 12 */
    fontSize: number
    /** 对齐方式，默认 center（header）/ left（其余） */
    align: 'left' | 'center' | 'right'
    /** customText 内容（按换行拆分多行） */
    text?: string
    /** 该区块可显示的子字段白名单（items→ItemField，meta→MetaField） */
    fields?: string[]
}

/** 纸张配置 */
export interface PaperConfig {
    /** 宽度 mm：小票 58/80；采购退货 210(A4)；标签 40/60 */
    widthMm: number
    /** 高度 mm（标签专用：30/40） */
    heightMm?: number
}

/** 打印模板 */
export interface PrintTemplate {
    id: TemplateType
    name: string
    type: TemplateType
    paper: PaperConfig
    /** 区块顺序即渲染顺序 */
    blocks: TemplateBlock[]
    updatedAt: string
}

/** 渲染数据：店铺信息（来自 settings） */
export interface ShopInfo {
    shopName: string
    shopAddress: string
    shopPhone: string
}

/** 渲染数据：小票明细行 */
export interface ReceiptPrintItem {
    productName: string
    quantity: number
    unitName: string
    subtotal: number
}

/** 渲染数据：小票（收银结算后） */
export interface ReceiptPrintData extends ShopInfo {
    orderNo: string
    date: string
    items: ReceiptPrintItem[]
    totalAmount: number
    discountAmount: number
    actualAmount: number
    memberName: string | null
    payMethod: string | null
    pointsEarned: number
}

/** 渲染数据：采购 / 退货 单据明细行 */
export interface DocPrintItem {
    productName: string
    quantity: number
    unitName: string
    price: number
    subtotal: number
}

/** 渲染数据：采购入库单 / 退货出库单 */
export interface DocPrintData extends ShopInfo {
    orderNo: string
    date: string
    supplierName: string
    handler: string
    items: DocPrintItem[]
    totalAmount: number
    /** 单据标题（采购入库单 / 退货出库单） */
    title: string
}

/** 渲染数据：条码标签 */
export interface LabelPrintData extends ShopInfo {
    productName: string
    origin: string
    weight: string
    price: number
    productCode: string
    batchCode: string
}
