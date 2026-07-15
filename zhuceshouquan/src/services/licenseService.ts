/** @file 授权码 Service - 封装 Tauri IPC 调用（license.rs 命令） */
import { invoke } from '@tauri-apps/api/core'

/** 授权状态查询结果 */
export interface LicenseStatusResult {
  activated: boolean
  activated_at: string | null
  app_version: string | null
  machine_id: string
  expiry: string | null
  license_code: string | null
}

/** 授权验证成功结果 */
export interface LicenseVerifyResult {
  activated_at: string
  expiry: string
  machine_id: string
}

/** 授权日志条目 */
export interface LicenseLogItem {
  id: string
  action_type: string
  action: string
  detail: string
  created_at: string
}

/** 授权日志查询结果 */
export interface LicenseLogsResult {
  items: LicenseLogItem[]
  total: number
}

/**
 * 获取当前机器指纹（无需鉴权）
 * - 返回 16 位十六进制字符串
 * - 用户将此码发送给开发者以获取授权码
 */
export async function getMachineId(): Promise<string> {
  return await invoke<string>('get_machine_id')
}

/**
 * 验证授权码（离线验证，无需网络）
 * - 验证 HMAC 签名
 * - 检查机器绑定
 * - 检查有效期
 * - 验证通过后本地持久化激活状态
 */
export async function verifyLicenseCode(code: string): Promise<LicenseVerifyResult> {
  return await invoke<LicenseVerifyResult>('verify_license', { code })
}

/**
 * 查询本地激活状态（不发起网络请求）
 * - 应用启动时调用，判断是否需要显示激活页
 * - 会重新验证有效期和机器绑定
 */
export async function fetchLicenseStatus(): Promise<LicenseStatusResult> {
  return await invoke<LicenseStatusResult>('get_license_status')
}

/**
 * 注销授权（需要登录鉴权）
 * - 删除本地激活状态文件
 * - 记录注销日志
 */
export async function revokeLicenseActivation(): Promise<void> {
  const { useAuthStore } = await import('../stores/authStore')
  const token = useAuthStore.getState().token || ''
  await invoke('revoke_license', { token })
}

/**
 * 获取授权验证日志（需要鉴权）
 */
export async function getLicenseLogs(
  page: number = 1,
  pageSize: number = 20,
): Promise<LicenseLogsResult> {
  const { useAuthStore } = await import('../stores/authStore')
  const token = useAuthStore.getState().token || ''
  return await invoke<LicenseLogsResult>('get_license_logs', {
    token,
    params: { page, page_size: pageSize },
  })
}
