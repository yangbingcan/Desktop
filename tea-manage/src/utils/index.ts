/**
 * @file 工具函数入口
 * @description 集中导出所有工具函数
 */
export * from './price'
export * from './barcode'
export * from './print'

/**
 * 生成唯一ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 格式化日期
 * @param date 日期
 * @param format 格式字符串
 */
export function formatDate(date: Date | string, format: string = 'YYYY-MM-DD'): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')

    return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds)
}

/**
 * 获取今日日期字符串
 */
export function getToday(): string {
    return formatDate(new Date(), 'YYYY-MM-DD')
}

/**
 * 获取当前时间戳
 */
export function getTimestamp(): string {
    return formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let last = 0
    return (...args: Parameters<T>) => {
        const now = Date.now()
        if (now - last >= delay) {
            last = now
            fn(...args)
        }
    }
}
