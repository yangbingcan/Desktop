/** @file AuthStore 状态管理单元测试 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    // 每个测试前重置 store
    useAuthStore.getState().logout()
    localStorage.clear()
  })

  it('初始状态应为未认证', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBe(null)
    expect(state.user).toBe(null)
  })

  it('setLogin 应设置 token 和用户信息', () => {
    const token = 'test_token_123'
    const user = {
      id: 'u1',
      username: 'admin',
      real_name: '管理员',
      phone: '',
      email: null,
      avatar: '',
      status: 1,
      permissions: ['dashboard', 'settings'],
      roles: [],
      is_super_admin: false,
    }

    useAuthStore.getState().setLogin(token, user)
    const state = useAuthStore.getState()

    expect(state.isAuthenticated).toBe(true)
    expect(state.token).toBe(token)
    expect(state.user).toEqual(user)
  })

  it('logout 应清除所有状态', () => {
    useAuthStore.getState().setLogin('token', {
      id: 'u1',
      username: 'admin',
      real_name: '管理员',
      phone: '',
      email: null,
      avatar: '',
      status: 1,
      permissions: ['dashboard'],
      roles: [],
      is_super_admin: false,
    })

    useAuthStore.getState().logout()
    const state = useAuthStore.getState()

    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBe(null)
    expect(state.user).toBe(null)
  })

  it('setUser 应部分更新用户信息', () => {
    const user = {
      id: 'u1',
      username: 'admin',
      real_name: '管理员',
      phone: '13800000000',
      email: null,
      avatar: '',
      status: 1,
      permissions: ['dashboard'],
      roles: [],
      is_super_admin: false,
    }
    useAuthStore.getState().setLogin('token', user)

    useAuthStore.getState().setUser({ real_name: '超级管理员' })
    const state = useAuthStore.getState()

    expect(state.user?.real_name).toBe('超级管理员')
    expect(state.user?.username).toBe('admin') // 不受影响
  })
})
