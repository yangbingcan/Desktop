/**
 * @file 条码工具单元测试
 * @description 测试 barcode.ts 中的条码生成、解析、批次二维码内容生成等纯函数
 *              依赖 canvas 的 generateBarcode/generateQRCode 通过 mock canvas 验证调用
 */
import { describe, it, expect, vi } from 'vitest'
import {
    generateBarcode,
    generateQRCode,
    generateProductBarcode,
    generateBatchQRContent,
    parseProductBarcode
} from '@/utils/barcode'

// Mock jsbarcode 和 qrcode 模块
vi.mock('jsbarcode', () => ({
    default: vi.fn()
}))
vi.mock('qrcode', () => ({
    default: {
        toCanvas: vi.fn().mockResolvedValue(undefined)
    }
}))

import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

describe('barcode 工具函数', () => {
    // ========== generateProductBarcode ==========
    describe('generateProductBarcode 商品条码生成', () => {
        it('商品编码 + 单位ID 拼接', () => {
            expect(generateProductBarcode('SP20260701001', 'unit-001'))
                .toBe('SP20260701001-unit-001')
        })
        it('空单位ID', () => {
            expect(generateProductBarcode('SP001', '')).toBe('SP001-')
        })
        it('含连字符的商品编码', () => {
            expect(generateProductBarcode('SP-001', 'u1')).toBe('SP-001-u1')
        })
    })

    // ========== parseProductBarcode ==========
    // 实现说明：split('-') 后 pop() 最后一段作为 unitId，其余 join('-') 作为 productCode
    describe('parseProductBarcode 条码解析', () => {
        it('正常解析 - 商品编码 + 单位ID（最后一段为 unitId）', () => {
            const result = parseProductBarcode('SP20260701001-u001')
            expect(result.productCode).toBe('SP20260701001')
            expect(result.unitId).toBe('u001')
        })
        it('商品编码含连字符 - 仅最后一段作为 unitId', () => {
            // split('SP-001-002-x1', '-') 得到 ['SP', '001', '002', 'x1']
            // pop 移除 'x1'，剩余 ['SP', '001', '002'] join = 'SP-001-002'
            const result = parseProductBarcode('SP-001-002-x1')
            expect(result.productCode).toBe('SP-001-002')
            expect(result.unitId).toBe('x1')
        })
        it('无连字符 - 全部视为 productCode，unitId 为空', () => {
            // split 得到 ['SP001']，pop 移除 'SP001'，剩余 []，join = ''
            const result = parseProductBarcode('SP001')
            expect(result.productCode).toBe('')
            expect(result.unitId).toBe('SP001')
        })
        it('空字符串 - productCode 和 unitId 都为空', () => {
            // split 得到 ['']，pop 移除 ''，剩余 []，join = ''
            const result = parseProductBarcode('')
            expect(result.productCode).toBe('')
            expect(result.unitId).toBe('')
        })
        it('以连字符结尾 - 最后一段为空，unitId 为空', () => {
            // split 得到 ['SP001', '']，pop 移除 ''，剩余 ['SP001']，join = 'SP001'
            const result = parseProductBarcode('SP001-')
            expect(result.productCode).toBe('SP001')
            expect(result.unitId).toBe('')
        })
    })

    // ========== generateBatchQRContent ==========
    describe('generateBatchQRContent 批次二维码内容', () => {
        it('返回 JSON 字符串，包含 productCode 和 batchCode', () => {
            const content = generateBatchQRContent('SP001', 'B20260701001')
            const parsed = JSON.parse(content)
            expect(parsed.productCode).toBe('SP001')
            expect(parsed.batchCode).toBe('B20260701001')
            expect(typeof parsed.verify).toBe('number')
        })
        it('相同输入应产生相同 verify 校验值', () => {
            const c1 = generateBatchQRContent('SP001', 'B001')
            const c2 = generateBatchQRContent('SP001', 'B001')
            expect(JSON.parse(c1).verify).toBe(JSON.parse(c2).verify)
        })
        it('不同输入应产生不同 verify 校验值', () => {
            const c1 = generateBatchQRContent('SP001', 'B001')
            const c2 = generateBatchQRContent('SP002', 'B001')
            expect(JSON.parse(c1).verify).not.toBe(JSON.parse(c2).verify)
        })
        it('空字符串输入 - verify 仍为数字', () => {
            const content = generateBatchQRContent('', '')
            const parsed = JSON.parse(content)
            expect(typeof parsed.verify).toBe('number')
            expect(parsed.verify).toBe(0)  // 空字符串 reduce 初始为 0
        })
    })

    // ========== generateBarcode（依赖 canvas，验证 JsBarcode 调用） ==========
    describe('generateBarcode 一维码生成', () => {
        it('调用 JsBarcode，使用 CODE128 格式和默认配置', () => {
            const canvas = document.createElement('canvas')
            generateBarcode('1234567890', canvas)

            expect(JsBarcode).toHaveBeenCalledWith(
                canvas,
                '1234567890',
                expect.objectContaining({
                    format: 'CODE128',
                    background: '#ffffff',
                    lineColor: '#000000'
                })
            )
        })
        it('自定义配置覆盖默认值', () => {
            const canvas = document.createElement('canvas')
            generateBarcode('ABC123', canvas, {
                width: 3,
                height: 100,
                displayValue: false,
                fontSize: 16,
                margin: 5
            })

            expect(JsBarcode).toHaveBeenCalledWith(
                canvas,
                'ABC123',
                expect.objectContaining({
                    width: 3,
                    height: 100,
                    displayValue: false,
                    fontSize: 16,
                    margin: 5
                })
            )
        })
        it('displayValue 默认为 true', () => {
            const canvas = document.createElement('canvas')
            generateBarcode('TEST', canvas)

            const callArgs = (JsBarcode as unknown as { mock: { calls: any[][] } })
                .mock.calls.at(-1)
            expect(callArgs?.[2].displayValue).toBe(true)
        })
    })

    // ========== generateQRCode（依赖 canvas，验证 QRCode.toCanvas 调用） ==========
    describe('generateQRCode 二维码生成', () => {
        it('调用 QRCode.toCanvas，使用默认配置', async () => {
            const canvas = document.createElement('canvas')
            await generateQRCode('https://example.com', canvas)

            expect(QRCode.toCanvas).toHaveBeenCalledWith(
                canvas,
                'https://example.com',
                expect.objectContaining({
                    width: 200,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                })
            )
        })
        it('自定义配置覆盖默认值', async () => {
            const canvas = document.createElement('canvas')
            await generateQRCode('data', canvas, {
                width: 300,
                margin: 4,
                color: {
                    dark: '#ff0000',
                    light: '#eeeeee'
                }
            })

            expect(QRCode.toCanvas).toHaveBeenCalledWith(
                canvas,
                'data',
                expect.objectContaining({
                    width: 300,
                    margin: 4,
                    color: {
                        dark: '#ff0000',
                        light: '#eeeeee'
                    }
                })
            )
        })
    })
})
