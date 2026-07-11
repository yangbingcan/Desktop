/**
 * @file 价格计算工具
 * @description 金额计算、格式化等工具函数
 */

/**
 * 计算商品价格
 * @param price 单价
 * @param quantity 数量
 * @returns 总价
 */
export function calculateSubtotal(price: number, quantity: number): number {
    return price * quantity
}

/**
 * 格式化金额（保留两位小数）
 * @param amount 金额
 * @returns 格式化后的字符串
 */
export function formatMoney(amount: number): string {
    return amount.toFixed(2)
}

/**
 * 格式化金额（带 ¥ 符号）
 * @param amount 金额
 * @returns 格式化后的字符串
 */
export function formatMoneyYuan(amount: number): string {
    return `¥${amount.toFixed(2)}`
}

/**
 * 计算找零
 * @param received 收款金额
 * @param total 总金额
 * @returns 找零金额
 */
export function calculateChange(received: number, total: number): number {
    return Math.max(0, received - total)
}

/**
 * 分摊优惠
 * @param totalAmount 总金额
 * @param discountAmount 优惠金额
 * @param items 商品项
 * @returns 分摊后各项金额
 */
export function apportionDiscount(
    totalAmount: number,
    discountAmount: number,
    items: { subtotal: number }[]
): number[] {
    if (totalAmount === 0) return items.map(() => 0)

    const ratios = items.map(item => item.subtotal / totalAmount)
    const distributed = ratios.map(ratio => discountAmount * ratio)

    // 确保总额等于优惠金额（处理舍入误差）
    const distributedSum = distributed.reduce((a, b) => a + b, 0)
    const diff = discountAmount - distributedSum

    if (diff !== 0) {
        distributed[0] += diff
    }

    return distributed
}

/**
 * 计算会员折扣
 * @param amount 金额
 * @param discountRate 折扣率
 * @returns 折扣后金额
 */
export function applyMemberDiscount(amount: number, discountRate: number): number {
    return amount * discountRate
}

/**
 * 积分抵现计算
 * @param points 积分数量
 * @param conversionRate 兑换比例（如 100积分=1元 则比例为 0.01）
 * @returns 可抵现金额
 */
export function pointsToMoney(points: number, conversionRate: number = 0.01): number {
    return points * conversionRate
}

/**
 * 金额转积分
 * @param amount 消费金额
 * @param earnRate 积分比例（如 1元=1积分 则比例为 1）
 * @returns 获得积分
 */
export function moneyToPoints(amount: number, earnRate: number = 1): number {
    return Math.floor(amount * earnRate)
}
