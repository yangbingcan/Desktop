/**
 * @file 设置 Store 单元测试
 * @description 测试 src/stores/settings.ts 中的 useSettingsStore
 *              后端 get_settings/save_settings/backup_database 暂未实现，store 内为空实现
 *              验证：默认设置、loadSettings 仅切换 loading、saveSettings 合并到本地状态、backupDatabase 不抛错
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestPinia } from './_helpers'

// 不需要 mock api（store 当前未引用 api 模块），但为防止后续 store 引入 invoke 也 mock 一份
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

import { useSettingsStore } from '@/stores/settings'
import type { SystemSettings } from '@/types'

// 默认设置预期值（与 stores/settings.ts 中的初始状态对齐）
const defaultSettings: SystemSettings = {
    shopName: '茶易管',
    shopAddress: '',
    shopPhone: '',
    allowNegativeStock: false,
    enableMemberDiscount: true,
    enablePrintReceipt: true,
    defaultReceiptTemplate: 'default'
}

describe('useSettingsStore 设置 Store', () => {
    beforeEach(() => {
        createTestPinia()
        vi.clearAllMocks()
    })

    // ========== 初始状态 ==========
    describe('初始状态', () => {
        it('settings 初始为默认值', () => {
            const store = useSettingsStore()
            expect(store.settings).toEqual(defaultSettings)
        })
        it('loading 初始为 false', () => {
            const store = useSettingsStore()
            expect(store.loading).toBe(false)
        })
    })

    // ========== loadSettings ==========
    describe('loadSettings 加载设置', () => {
        it('调用完成后 loading 重置为 false', async () => {
            const store = useSettingsStore()
            await store.loadSettings()
            expect(store.loading).toBe(false)
        })
        it('后端未实现：调用后 settings 保持默认值不修改', async () => {
            const store = useSettingsStore()
            await store.loadSettings()
            expect(store.settings).toEqual(defaultSettings)
        })
        it('调用 loadSettings 不抛错（空实现语义验证）', async () => {
            const store = useSettingsStore()
            await expect(store.loadSettings()).resolves.toBeUndefined()
        })
    })

    // ========== saveSettings ==========
    describe('saveSettings 保存设置', () => {
        it('传入部分字段：合并到现有 settings（其余字段保留）', async () => {
            const store = useSettingsStore()
            await store.saveSettings({ shopName: '我的茶店', shopPhone: '0591-12345678' })
            expect(store.settings).toEqual({
                ...defaultSettings,
                shopName: '我的茶店',
                shopPhone: '0591-12345678'
            })
        })
        it('传入完整对象：完整覆盖 settings', async () => {
            const store = useSettingsStore()
            const fullSettings: SystemSettings = {
                shopName: '新茶店',
                shopAddress: '新地址',
                shopPhone: '110',
                allowNegativeStock: true,
                enableMemberDiscount: false,
                enablePrintReceipt: false,
                defaultReceiptTemplate: 'simple'
            }
            await store.saveSettings(fullSettings)
            expect(store.settings).toEqual(fullSettings)
        })
        it('传入空对象：settings 不变', async () => {
            const store = useSettingsStore()
            await store.saveSettings({})
            expect(store.settings).toEqual(defaultSettings)
        })
        it('多次调用：每次基于上一次的结果合并', async () => {
            const store = useSettingsStore()
            await store.saveSettings({ shopName: '茶店A' })
            await store.saveSettings({ shopPhone: '123' })
            await store.saveSettings({ allowNegativeStock: true })
            expect(store.settings).toEqual({
                ...defaultSettings,
                shopName: '茶店A',
                shopPhone: '123',
                allowNegativeStock: true
            })
        })
    })

    // ========== backupDatabase ==========
    describe('backupDatabase 备份数据库', () => {
        it('后端未实现：调用返回 undefined 且不抛错', async () => {
            const store = useSettingsStore()
            await expect(store.backupDatabase('D:/backup.db')).resolves.toBeUndefined()
        })
        it('传入空字符串路径也不抛错', async () => {
            const store = useSettingsStore()
            await expect(store.backupDatabase('')).resolves.toBeUndefined()
        })
    })
})
