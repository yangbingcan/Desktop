/** @file 认证状态管理 - 登录态管理、权限信息（localStorage持久化，刷新不丢失） */
import { create } from 'zustand'

interface RoleBrief {
  id: string
  name: string
}

interface UserInfo {
  id: string
  username: string
  real_name: string
  phone: string
  email: string | null
  avatar: string
  status: number
  permissions: string[]
  roles: { id: string; name: string }[]
  is_super_admin: boolean
}

interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  setLogin: (token: string, user: UserInfo) => void
  setUser: (user: Partial<UserInfo>) => void
  logout: () => void
}

function loadPersistedAuth(): { token: string | null; user: UserInfo | null; isAuthenticated: boolean } {
  try {
    const saved = localStorage.getItem('gl-auth')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.token && parsed.user) {
        return { token: parsed.token, user: parsed.user, isAuthenticated: true }
      }
    }
  } catch { /* ignore */ }
  return { token: null, user: null, isAuthenticated: false }
}

const persisted = loadPersistedAuth()

export const useAuthStore = create<AuthState>((set) => ({
  token: persisted.token,
  user: persisted.user,
  isAuthenticated: persisted.isAuthenticated,
  setLogin: (token, user) => {
    localStorage.setItem('gl-auth', JSON.stringify({ token, user }))
    localStorage.removeItem('gl-tabs')
    set({ token, user, isAuthenticated: true })
  },
  setUser: (partial) => {
    set((state) => {
      const updated = state.user ? { ...state.user, ...partial } : state.user
      if (updated && state.token) {
        localStorage.setItem('gl-auth', JSON.stringify({ token: state.token, user: updated }))
      }
      return { user: updated as UserInfo | null }
    })
  },
  logout: () => {
    localStorage.removeItem('gl-auth')
    localStorage.removeItem('gl-tabs')
    set({ token: null, user: null, isAuthenticated: false })
  },
}))

export type { UserInfo, RoleBrief }
