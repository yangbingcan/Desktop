/** @file 授权码状态管理 - 激活状态、验证、注销（配合 Rust 后端 license.rs） */
import { create } from 'zustand'
import {
  verifyLicenseCode,
  fetchLicenseStatus,
  revokeLicenseActivation,
} from '../services/licenseService'

interface LicenseState {
  /** 是否已激活 */
  activated: boolean
  /** 激活时间 */
  activatedAt: string | null
  /** 激活时的应用版本 */
  appVersion: string | null
  /** 当前机器码 */
  machineId: string
  /** 授权有效期 */
  expiry: string | null
  /** 加载中（初始化检查 / 验证中） */
  loading: boolean
  /** 错误信息（验证失败时设置） */
  error: string | null

  /** 初始化：检查本地激活状态（应用启动时调用） */
  checkStatus: () => Promise<void>
  /** 验证授权码（离线校验） */
  verify: (code: string) => Promise<boolean>
  /** 注销授权（清除本地激活状态） */
  revoke: () => Promise<void>
  /** 清除错误 */
  clearError: () => void
}

export const useLicenseStore = create<LicenseState>((set) => ({
  activated: false,
  activatedAt: null,
  appVersion: null,
  machineId: '',
  expiry: null,
  loading: false,
  error: null,

  checkStatus: async () => {
    set({ loading: true, error: null })
    try {
      const result = await fetchLicenseStatus()
      set({
        activated: result.activated,
        activatedAt: result.activated_at ?? null,
        appVersion: result.app_version ?? null,
        machineId: result.machine_id,
        expiry: result.expiry ?? null,
        loading: false,
      })
    } catch {
      // 读取本地状态失败 → 视为未激活
      set({ activated: false, activatedAt: null, appVersion: null, loading: false })
    }
  },

  verify: async (code: string) => {
    set({ loading: true, error: null })
    try {
      const result = await verifyLicenseCode(code)
      set({
        activated: true,
        activatedAt: result.activated_at,
        machineId: result.machine_id,
        expiry: result.expiry,
        loading: false,
        error: null,
      })
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ loading: false, error: msg })
      return false
    }
  },

  revoke: async () => {
    set({ loading: true, error: null })
    try {
      await revokeLicenseActivation()
      set({ activated: false, activatedAt: null, appVersion: null, expiry: null, loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ loading: false, error: msg })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))
