/**
 * @file 设置状态管理
 * @description 管理系统设置、店铺信息等状态
 * 注意：get_settings/save_settings/backup_database 后端暂未实现，先提供空实现
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SystemSettings } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
    // ========== 状态 ==========
    const settings = ref<SystemSettings>({
        shopName: '茶易管',
        shopAddress: '',
        shopPhone: '',
        allowNegativeStock: false,
        enableMemberDiscount: true,
        enablePrintReceipt: true,
        defaultReceiptTemplate: 'default'
    })
    const loading = ref(false)

    // ========== Actions ==========

    /**
     * 加载系统设置
     * TODO: 后端 get_settings 命令实现后替换
     */
    async function loadSettings() {
        loading.value = true
        try {
            // 后端暂未实现 get_settings，暂时使用默认值
            // const loaded = await invoke<SystemSettings>('get_settings')
            // settings.value = { ...settings.value, ...loaded }
        } finally {
            loading.value = false
        }
    }

    /**
     * 保存系统设置
     * TODO: 后端 save_settings 命令实现后替换
     */
    async function saveSettings(newSettings: Partial<SystemSettings>) {
        // 后端暂未实现 save_settings，仅更新本地状态
        settings.value = { ...settings.value, ...newSettings }
        // await invoke('save_settings', { settings: newSettings })
    }

    /**
     * 备份数据库
     * TODO: 后端 backup_database 命令实现后替换
     */
    async function backupDatabase(_path: string): Promise<void> {
        // 后端暂未实现 backup_database
        // await invoke('backup_database', { path })
    }

    return {
        settings,
        loading,
        loadSettings,
        saveSettings,
        backupDatabase
    }
})
