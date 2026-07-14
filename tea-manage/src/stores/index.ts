/**
 * @file Pinia Store 入口
 * @description 状态管理集中导出
 */
import { createPinia } from 'pinia'

export const pinia = createPinia()

export { useProductStore } from './products'
export { useInventoryStore } from './inventory'
export { useMemberStore } from './members'
export { useSupplierStore } from './suppliers'
export { useSettingsStore } from './settings'
