/**
 * @file 价格计算工具单元测试
 * @description 测试 price.ts 中的金额计算、格式化、折扣、积分换算等纯函数
 */
import { describe, it, expect } from 'vitest'
import {
    calculateSubtotal,
    formatMoney,
    formatMoneyYuan,
    calculateChange,
    apportionDiscount,
    applyMemberDiscount,
    pointsToMoney,
    moneyToPoints
} from '@/utils/price'

describe('price 工具函数', () => {
    // ========== calculateSubtotal ==========
    describe('calculateSubtotal 计算小计', () => {
        it('正数单价 × 正数数量', () => {
            expect(calculateSubtotal(10.5, 3)).toBe(31.5)
        })
        it('零单价', () => {
            expect(calculateSubtotal(0, 5)).toBe(0)
        })
        it('零数量', () => {
            expect(calculateSubtotal(15.8, 0)).toBe(0)
        })
        it('小数单价', () => {
            expect(calculateSubtotal(9.99, 2)).toBe(19.98)
        })
    })

    // ========== formatMoney ==========
    describe('formatMoney 格式化金额', () => {
        it('保留两位小数 - 整数', () => {
            expect(formatMoney(100)).toBe('100.00')
        })
        it('保留两位小数 - 一位小数', () => {
            expect(formatMoney(99.9)).toBe('99.90')
        })
        it('保留两位小数 - 两位小数', () => {
            expect(formatMoney(88.88)).toBe('88.88')
        })
        it('保留两位小数 - 多位小数四舍五入', () => {
            expect(formatMoney(33.335)).toBe('33.34')
        })
        it('零金额', () => {
            expect(formatMoney(0)).toBe('0.00')
        })
    })

    // ========== formatMoneyYuan ==========
    describe('formatMoneyYuan 带符号金额', () => {
        it('正数带 ¥ 前缀', () => {
            expect(formatMoneyYuan(58.5)).toBe('¥58.50')
        })
        it('零金额带 ¥ 前缀', () => {
            expect(formatMoneyYuan(0)).toBe('¥0.00')
        })
        it('整数带 ¥ 前缀', () => {
            expect(formatMoneyYuan(100)).toBe('¥100.00')
        })
    })

    // ========== calculateChange ==========
    describe('calculateChange 计算找零', () => {
        it('收款 > 总额，正常找零', () => {
            expect(calculateChange(100, 88.5)).toBe(11.5)
        })
        it('收款 = 总额，找零为 0', () => {
            expect(calculateChange(50, 50)).toBe(0)
        })
        it('收款 < 总额，找零为 0（不能为负）', () => {
            expect(calculateChange(30, 50)).toBe(0)
        })
        it('零总额', () => {
            expect(calculateChange(20, 0)).toBe(20)
        })
    })

    // ========== apportionDiscount ==========
    describe('apportionDiscount 优惠分摊', () => {
        it('正常分摊 - 两项', () => {
            const items = [{ subtotal: 60 }, { subtotal: 40 }]
            const result = apportionDiscount(100, 20, items)
            // 60/100 * 20 = 12, 40/100 * 20 = 8
            expect(result[0]).toBeCloseTo(12, 5)
            expect(result[1]).toBeCloseTo(8, 5)
            // 总和应等于优惠金额
            const sum = result.reduce((a, b) => a + b, 0)
            expect(sum).toBeCloseTo(20, 5)
        })
        it('正常分摊 - 三项，舍入误差修正到第一项', () => {
            const items = [{ subtotal: 33.33 }, { subtotal: 33.33 }, { subtotal: 33.34 }]
            const result = apportionDiscount(100, 10, items)
            const sum = result.reduce((a, b) => a + b, 0)
            // 总和必须严格等于优惠金额
            expect(sum).toBeCloseTo(10, 10)
        })
        it('总金额为 0，分摊为全 0', () => {
            const items = [{ subtotal: 0 }, { subtotal: 0 }]
            const result = apportionDiscount(0, 10, items)
            expect(result).toEqual([0, 0])
        })
        it('优惠金额为 0，分摊为全 0', () => {
            const items = [{ subtotal: 50 }, { subtotal: 50 }]
            const result = apportionDiscount(100, 0, items)
            expect(result).toEqual([0, 0])
        })
        it('单项商品，全额分摊', () => {
            const items = [{ subtotal: 100 }]
            const result = apportionDiscount(100, 30, items)
            expect(result[0]).toBe(30)
        })
    })

    // ========== applyMemberDiscount ==========
    describe('applyMemberDiscount 会员折扣', () => {
        it('金卡折扣 0.9', () => {
            expect(applyMemberDiscount(100, 0.9)).toBe(90)
        })
        it('银卡折扣 0.95', () => {
            expect(applyMemberDiscount(100, 0.95)).toBe(95)
        })
        it('普通会员无折扣 1.0', () => {
            expect(applyMemberDiscount(100, 1.0)).toBe(100)
        })
        it('零金额', () => {
            expect(applyMemberDiscount(0, 0.9)).toBe(0)
        })
    })

    // ========== pointsToMoney ==========
    describe('pointsToMoney 积分抵现', () => {
        it('默认比例 1%', () => {
            // 100 积分 = 1 元
            expect(pointsToMoney(100)).toBe(1)
        })
        it('自定义比例', () => {
            // 50 积分 × 0.02 = 1 元
            expect(pointsToMoney(50, 0.02)).toBe(1)
        })
        it('零积分', () => {
            expect(pointsToMoney(0)).toBe(0)
        })
    })

    // ========== moneyToPoints ==========
    describe('moneyToPoints 金额转积分', () => {
        it('默认比例 1 元 1 积分', () => {
            expect(moneyToPoints(50)).toBe(50)
        })
        it('自定义比例 1 元 2 积分', () => {
            expect(moneyToPoints(50, 2)).toBe(100)
        })
        it('小数金额向下取整', () => {
            // 33.7 × 1 = 33.7 → floor = 33
            expect(moneyToPoints(33.7)).toBe(33)
        })
        it('零金额', () => {
            expect(moneyToPoints(0)).toBe(0)
        })
    })
})
