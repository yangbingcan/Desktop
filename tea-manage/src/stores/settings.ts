/**
 * @file 设置状态管理
 * @description 管理系统设置、店铺信息等状态
 * 后端 get_settings/save_settings 命令当前未实现，故使用 localStorage 持久化，
 * 保证设置（店铺信息、会员折扣开关等）在刷新/重启后不丢失。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SystemSettings } from '@/types'

const STORAGE_KEY = 'tea-settings'

/** 从 localStorage 读取已持久化的设置（容错：解析失败返回空对象） */
function loadFromStorage(): Partial<SystemSettings> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        return JSON.parse(raw) as Partial<SystemSettings>
    } catch {
        return {}
    }
}

export const useSettingsStore = defineStore('settings', () => {
    // ========== 状态 ==========
    // 默认值 + 本地持久化覆盖（刷新后仍为用户上次保存的值）
    const settings = ref<SystemSettings>({
        shopName: '茶易管',
        shopAddress: '',
        shopPhone: '',
        allowNegativeStock: false,
        enableMemberDiscount: true,
        enablePrintReceipt: true,
        defaultReceiptTemplate: 'default',
        ...loadFromStorage()
    })
    const loading = ref(false)

    // ========== Actions ==========

    /**
     * 加载系统设置
     * 备注：设置已从 localStorage 在 store 初始化时同步载入，此方法保留以兼容启动期调用。
     */
    async function loadSettings() {
        loading.value = false
    }

    /**
     * 保存系统设置（I2 修复：持久化到 localStorage，避免刷新后丢失）
     * @param newSettings 部分或全部系统设置
     */
    function saveSettings(newSettings: Partial<SystemSettings>) {
        settings.value = { ...settings.value, ...newSettings }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
        } catch {
            // 隐私模式 / 存储不可用时不阻断业务，仅丢失持久化
        }
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
