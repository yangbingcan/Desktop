/** @file 认证状态管理 - 登录态管理、权限信息（localStorage持久化，Token使用XOR混淆存储，注意：混淆非加密，仅防明文暴露） */
import { create } from 'zustand'
import type { RoleBrief } from '../services/userService'

/** 用户信息接口（认证状态专用） */
export interface UserInfo {
  id: string
  username: string
  real_name: string
  phone: string
  email: string | null
  avatar: string
  status: number
  permissions: string[]
  roles: RoleBrief[]
  is_super_admin: boolean
  must_change_password?: boolean
}

interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  setLogin: (token: string, user: UserInfo) => void
  setTokenOnly: (token: string) => void
  setUser: (user: Partial<UserInfo>) => void
  logout: () => void
}

/** Token混淆密钥（仅用于本地存储混淆，非加密） */
const TOKEN_OBFUSCATE_KEY = 'GL_TOKEN_OBFUSCATION_2024'

/** 混淆Token（XOR + Base64，比纯btoa稍强） */
function obfuscateToken(token: string): string {
  const encoded = btoa(token)
  let result = ''
  for (let i = 0; i < encoded.length; i++) {
    result += String.fromCharCode(encoded.charCodeAt(i) ^ TOKEN_OBFUSCATE_KEY.charCodeAt(i % TOKEN_OBFUSCATE_KEY.length))
  }
  return btoa(result)
}

/** 解混淆Token */
function decodeToken(obfuscated: string): string {
  try {
    const decoded = atob(obfuscated)
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ TOKEN_OBFUSCATE_KEY.charCodeAt(i % TOKEN_OBFUSCATE_KEY.length))
    }
    return atob(result)
  } catch {
    return ''
  }
}

/** 从localStorage加载持久化的认证信息（含token解混淆） */
function loadPersistedAuth(): { token: string | null; user: UserInfo | null; isAuthenticated: boolean } {
  try {
    const saved = localStorage.getItem('gl-auth')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.t && parsed.u) {
        const token = decodeToken(parsed.t)
        return { token, user: parsed.u, isAuthenticated: true }
      }
    }
  } catch { /* 持久化数据损坏时静默忽略 */ }
  return { token: null, user: null, isAuthenticated: false }
}

const persisted = loadPersistedAuth()

export const useAuthStore = create<AuthState>((set) => ({
  token: persisted.token,
  user: persisted.user,
  isAuthenticated: persisted.isAuthenticated,
  /** 登录成功后设置认证状态（token使用XOR混淆存储） */
  setLogin: (token, user) => {
    const obfuscated = obfuscateToken(token)
    localStorage.setItem('gl-auth', JSON.stringify({ t: obfuscated, u: user }))
    localStorage.removeItem('gl-tabs')
    set({ token, user, isAuthenticated: true })
  },
  /** 仅设置Token，不更新用户信息（用于切换用户中间态） */
  setTokenOnly: (token) => {
    const obfuscated = obfuscateToken(token)
    try {
      const stored = localStorage.getItem('gl-auth')
      if (stored) {
        const data = JSON.parse(stored)
        data.t = obfuscated
        localStorage.setItem('gl-auth', JSON.stringify(data))
      }
    } catch { /* 持久化数据损坏时静默忽略 */ }
    set({ token })
  },
  /** 更新用户信息（同步到localStorage） */
  setUser: (partial) => {
    set((state) => {
      const updated = state.user ? { ...state.user, ...partial } : state.user
      if (updated && state.token) {
        const obfuscated = obfuscateToken(state.token)
        localStorage.setItem('gl-auth', JSON.stringify({ t: obfuscated, u: updated }))
      }
      return { user: updated as UserInfo | null }
    })
  },
  /** 登出，清除认证状态 */
  logout: () => {
    localStorage.removeItem('gl-auth')
    localStorage.removeItem('gl-tabs')
    set({ token: null, user: null, isAuthenticated: false })
  },
}))

export type { RoleBrief }
