/**
 * @file 条码生成工具
 * @description 使用 JsBarcode 和 qrcode 生成条码/二维码
 */
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

/**
 * 生成 Code128 一维码
 * @param text 内容
 * @param canvas canvas 元素
 * @param options 配置选项
 */
export function generateBarcode(
    text: string,
    canvas: HTMLCanvasElement,
    options?: {
        width?: number
        height?: number
        displayValue?: boolean
        fontSize?: number
        margin?: number
    }
): void {
    JsBarcode(canvas, text, {
        format: 'CODE128',
        width: options?.width || 2,
        height: options?.height || 80,
        displayValue: options?.displayValue ?? true,
        fontSize: options?.fontSize || 14,
        margin: options?.margin || 10,
        background: '#ffffff',
        lineColor: '#000000'
    })
}

/**
 * 生成二维码
 * @param text 内容
 * @param canvas canvas 元素
 * @param options 配置选项
 */
export async function generateQRCode(
    text: string,
    canvas: HTMLCanvasElement,
    options?: {
        width?: number
        height?: number
        margin?: number
        color?: {
            dark?: string
            light?: string
        }
    }
): Promise<void> {
    await QRCode.toCanvas(canvas, text, {
        width: options?.width || 200,
        margin: options?.margin || 2,
        color: {
            dark: options?.color?.dark || '#000000',
            light: options?.color?.light || '#ffffff'
        }
    })
}

/**
 * 生成商品零售条码
 * 格式：商品编码 + 销售单位编码
 * @param productCode 商品编码
 * @param unitId 单位ID
 * @returns 条码字符串
 */
export function generateProductBarcode(productCode: string, unitId: string): string {
    return `${productCode}-${unitId}`
}

/**
 * 生成批次追溯二维码内容
 * @param productCode 商品编码
 * @param batchCode 批次号
 * @returns 二维码内容 JSON
 */
export function generateBatchQRContent(productCode: string, batchCode: string): string {
    return JSON.stringify({
        productCode,
        batchCode,
        verify: `${productCode}${batchCode}`.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
    })
}

/**
 * 解析商品条码
 * @param barcode 条码字符串
 * @returns { productCode, unitId }
 */
export function parseProductBarcode(barcode: string): { productCode: string; unitId: string } {
    const parts = barcode.split('-')
    const unitId = parts.pop() || ''
    const productCode = parts.join('-')
    return { productCode, unitId }
}
