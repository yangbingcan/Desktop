/** @file 通信层 - 自动适配Tauri IPC与HTTP RPC，统一鉴权错误处理 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../stores/authStore'

const RUN_MODE = import.meta.env.VITE_RUN_MODE || 'standalone'
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:9520'

function getAuthToken(): string | null {
  return useAuthStore.getState().token
}

function handleAuthError(errorMsg: string) {
  if (errorMsg.includes('Token已过期') || errorMsg.includes('Token签名验证失败') || errorMsg.includes('无效的Token格式')) {
    useAuthStore.getState().logout()
    window.location.href = '/login'
  }
}

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (RUN_MODE === 'standalone') {
    try {
      return await invoke<T>(cmd, args)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      handleAuthError(msg)
      throw err
    }
  }
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const response = await fetch(`${SERVER_URL}/rpc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cmd, args: args || {} }),
  })
  const result = await response.json()
  if (!result.ok) {
    handleAuthError(result.error || '')
    throw new Error(result.error || '请求失败')
  }
  return result.data as T
}

export { invokeCommand }
export { RUN_MODE, SERVER_URL }
