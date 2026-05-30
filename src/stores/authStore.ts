/** @file 认证状态管理 - 登录态管理、权限信息（不持久化，每次启动需重新登录） */
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

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setLogin: (token, user) => {
    localStorage.removeItem('gl-tabs')
    set({ token, user, isAuthenticated: true })
  },
  setUser: (partial) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : state.user,
    }))
  },
  logout: () => {
    localStorage.removeItem('gl-tabs')
    set({ token: null, user: null, isAuthenticated: false })
  },
}))

export type { UserInfo, RoleBrief }
