/** @file 通信层 - 自动适配Tauri IPC与HTTP RPC，统一鉴权错误处理 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../stores/authStore'

const RUN_MODE = import.meta.env.VITE_RUN_MODE || 'standalone'
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:9520'

/** 获取当前认证Token（供各服务层统一调用） */
export function getToken(): string {
  return useAuthStore.getState().token || ''
}

/** 鉴权错误关键词，匹配则触发登出跳转 */
const AUTH_ERROR_KEYWORDS = ['Token已过期', 'Token签名验证失败', '无效的Token格式', '登录已失效']

/** 检查是否为鉴权错误，若是则执行登出跳转并返回true */
function handleAuthError(errorMsg: string): boolean {
  if (AUTH_ERROR_KEYWORDS.some(kw => errorMsg.includes(kw))) {
    useAuthStore.getState().logout()
    window.location.href = '/login'
    return true
  }
  return false
}

/** 处理业务错误（非认证类），返回用户友好的错误消息 */
function handleBusinessError(errorMsg: string): string {
  // 已知的后端错误消息已经是中文，直接返回
  return errorMsg || '操作失败'
}

/** 鉴权错误专用异常，标识已触发登出跳转，调用方无需再处理 */
class AuthError extends Error {
  constructor() {
    super('鉴权失败，已自动跳转登录页')
    this.name = 'AuthError'
  }
}

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (RUN_MODE === 'standalone') {
    try {
      return await invoke<T>(cmd, args)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // 鉴权错误已触发登出跳转，抛出专用异常避免调用方重复处理
      if (handleAuthError(msg)) {
        throw new AuthError()
      }
      throw err
    }
  }
  const token = getToken()
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
  if (!response.ok) {
    throw new Error(`服务器错误: ${response.status} ${response.statusText}`)
  }
  const result = await response.json()
  if (!result.ok) {
    const errorMsg = result.error || ''
    // 鉴权错误已触发登出跳转，抛出专用异常避免调用方重复处理
    if (handleAuthError(errorMsg)) {
      throw new AuthError()
    }
    throw new Error(handleBusinessError(errorMsg || '请求失败'))
  }
  return result.data as T
}

export { invokeCommand }
export { RUN_MODE, SERVER_URL }
