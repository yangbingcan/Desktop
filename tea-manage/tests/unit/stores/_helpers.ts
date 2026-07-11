/**
 * @file Store 测试辅助函数
 * @description 提供 Pinia store 测试基础设施
 *              - createTestPinia: 创建独立的测试用 Pinia 实例
 *              - mockApiModule: mock 整个 api 模块，便于 store 测试时控制 api 行为
 */
import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

/**
 * 创建并激活测试用 Pinia 实例
 * 每个测试用例的 beforeEach 中调用，确保 store 状态隔离
 */
export function createTestPinia() {
    const pinia = createPinia()
    setActivePinia(pinia)
    return pinia
}
