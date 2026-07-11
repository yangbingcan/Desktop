/**
 * @file 通用工具函数单元测试
 * @description 测试 utils/index.ts 中的 generateId、formatDate、getToday、getTimestamp、debounce、throttle
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    generateId,
    formatDate,
    getToday,
    getTimestamp,
    debounce,
    throttle
} from '@/utils'

describe('utils/index 通用工具函数', () => {
    // ========== generateId ==========
    describe('generateId 唯一ID生成', () => {
        it('返回字符串', () => {
            const id = generateId()
            expect(typeof id).toBe('string')
        })
        it('格式为 timestamp-randomString', () => {
            const id = generateId()
            expect(id).toMatch(/^\d+-[a-z0-9]+$/)
        })
        it('连续调用产生不同ID', () => {
            const ids = new Set<string>()
            for (let i = 0; i < 100; i++) {
                ids.add(generateId())
            }
            expect(ids.size).toBe(100)
        })
    })

    // ========== formatDate ==========
    describe('formatDate 日期格式化', () => {
        it('默认格式 YYYY-MM-DD', () => {
            const date = new Date(2026, 6, 3)  // 2026-07-03
            expect(formatDate(date)).toBe('2026-07-03')
        })
        it('完整日期时间格式 YYYY-MM-DD HH:mm:ss', () => {
            const date = new Date(2026, 6, 3, 14, 30, 45)
            expect(formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-07-03 14:30:45')
        })
        it('字符串日期输入', () => {
            expect(formatDate('2026-07-03')).toBe('2026-07-03')
        })
        it('ISO 字符串输入', () => {
            const result = formatDate('2026-07-03T14:30:45')
            expect(result).toBe('2026-07-03')
        })
        it('月日补零 - 单位数月份', () => {
            const date = new Date(2026, 0, 5)  // 2026-01-05
            expect(formatDate(date)).toBe('2026-01-05')
        })
        it('仅时间格式 HH:mm:ss', () => {
            const date = new Date(2026, 6, 3, 9, 5, 3)
            expect(formatDate(date, 'HH:mm:ss')).toBe('09:05:03')
        })
        it('时分为单位数时补零', () => {
            const date = new Date(2026, 6, 3, 8, 5, 0)
            expect(formatDate(date, 'HH:mm:ss')).toBe('08:05:00')
        })
    })

    // ========== getToday ==========
    describe('getToday 今日日期', () => {
        it('返回 YYYY-MM-DD 格式', () => {
            const today = getToday()
            expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
        it('与当前日期一致', () => {
            const now = new Date()
            const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
            expect(getToday()).toBe(expected)
        })
    })

    // ========== getTimestamp ==========
    describe('getTimestamp 当前时间戳', () => {
        it('返回 YYYY-MM-DD HH:mm:ss 格式', () => {
            const ts = getTimestamp()
            expect(ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
        })
    })

    // ========== debounce ==========
    describe('debounce 防抖', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })
        afterEach(() => {
            vi.useRealTimers()
        })
        it('延迟执行函数', () => {
            const fn = vi.fn()
            const debounced = debounce(fn, 300)
            debounced()
            expect(fn).not.toHaveBeenCalled()
            vi.advanceTimersByTime(300)
            expect(fn).toHaveBeenCalledTimes(1)
        })
        it('多次连续调用只执行最后一次', () => {
            const fn = vi.fn()
            const debounced = debounce(fn, 300)
            debounced()
            debounced()
            debounced()
            vi.advanceTimersByTime(300)
            expect(fn).toHaveBeenCalledTimes(1)
        })
        it('参数正确传递', () => {
            const fn = vi.fn()
            const debounced = debounce(fn, 100)
            debounced('arg1', 'arg2')
            vi.advanceTimersByTime(100)
            expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
        })
        it('间隔超过 delay 的两次调用都会执行', () => {
            const fn = vi.fn()
            const debounced = debounce(fn, 100)
            debounced()
            vi.advanceTimersByTime(100)
            debounced()
            vi.advanceTimersByTime(100)
            expect(fn).toHaveBeenCalledTimes(2)
        })
    })

    // ========== throttle ==========
    describe('throttle 节流', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })
        afterEach(() => {
            vi.useRealTimers()
        })
        it('首次调用立即执行', () => {
            const fn = vi.fn()
            const throttled = throttle(fn, 300)
            throttled()
            expect(fn).toHaveBeenCalledTimes(1)
        })
        it('间隔内多次调用只执行第一次', () => {
            const fn = vi.fn()
            const throttled = throttle(fn, 300)
            throttled()
            throttled()
            throttled()
            expect(fn).toHaveBeenCalledTimes(1)
        })
        it('超过间隔后再次调用会执行', () => {
            const fn = vi.fn()
            const throttled = throttle(fn, 300)
            throttled()
            vi.advanceTimersByTime(300)
            throttled()
            expect(fn).toHaveBeenCalledTimes(2)
        })
        it('参数正确传递', () => {
            const fn = vi.fn()
            const throttled = throttle(fn, 100)
            throttled('a', 'b')
            expect(fn).toHaveBeenCalledWith('a', 'b')
        })
    })
})
