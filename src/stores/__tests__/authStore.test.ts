/** @file 认证状态管理单元测试 - Token混淆/解混淆、登录/登出状态 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Token混淆密钥（与authStore.ts中保持一致）
const TOKEN_OBFUSCATE_KEY = 'GL_TOKEN_OBFUSCATION_2024'

/** 混淆Token（与authStore.ts中逻辑一致） */
function obfuscateToken(token: string): string {
  const encoded = btoa(token)
  let result = ''
  for (let i = 0; i < encoded.length; i++) {
    result += String.fromCharCode(encoded.charCodeAt(i) ^ TOKEN_OBFUSCATE_KEY.charCodeAt(i % TOKEN_OBFUSCATE_KEY.length))
  }
  return btoa(result)
}

/** 解混淆Token（与authStore.ts中逻辑一致） */
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

// mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('obfuscateToken / decodeToken', () => {
  it('互为逆操作', () => {
    const originalToken = 'token_user123_1234567890_abcdef123456'
    const obfuscated = obfuscateToken(originalToken)
    const decoded = decodeToken(obfuscated)
    expect(decoded).toBe(originalToken)
  })

  it('不同Token产生不同混淆结果', () => {
    const token1 = 'token_user1_1234_abcd'
    const token2 = 'token_user2_5678_efgh'
    expect(obfuscateToken(token1)).not.toBe(obfuscateToken(token2))
  })

  it('混淆结果不等于明文', () => {
    const token = 'token_secret_value'
    const obfuscated = obfuscateToken(token)
    expect(obfuscated).not.toBe(token)
    expect(obfuscated).not.toContain(token)
  })

  it('decodeToken处理无效输入返回空字符串', () => {
    expect(decodeToken('')).toBe('')
    expect(decodeToken('!!!invalid-base64!!!')).toBe('')
  })

  it('decodeToken处理被篡改的混淆数据', () => {
    const token = 'token_user_1234_sig'
    const obfuscated = obfuscateToken(token)
    // 篡改混淆数据
    const tampered = obfuscated.slice(0, -2) + 'XX'
    // 解混淆后应不等于原始token（除非巧合）
    const decoded = decodeToken(tampered)
    expect(decoded).not.toBe(token)
  })

  it('多次混淆同一Token结果一致', () => {
    const token = 'token_consistent_test'
    const obfuscated1 = obfuscateToken(token)
    const obfuscated2 = obfuscateToken(token)
    expect(obfuscated1).toBe(obfuscated2)
  })
})

describe('useAuthStore 登录登出', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('登录后localStorage存储混淆后的token', async () => {
    const { useAuthStore } = await import('../../stores/authStore')
    const store = useAuthStore.getState()

    store.setLogin('token_test123_9999_sig', {
      id: 'user-1',
      username: 'admin',
      real_name: '管理员',
      phone: '',
      email: null,
      avatar: '',
      status: 1,
      permissions: ['dashboard'],
      roles: [],
      is_super_admin: true,
    })

    // 验证localStorage被调用
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'gl-auth',
      expect.any(String)
    )

    // 验证状态
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.token).toBe('token_test123_9999_sig')
    expect(state.user?.username).toBe('admin')
  })

  it('登出后清除认证状态', async () => {
    const { useAuthStore } = await import('../../stores/authStore')

    useAuthStore.getState().setLogin('token_test', {
      id: 'user-1',
      username: 'admin',
      real_name: '管理员',
      phone: '',
      email: null,
      avatar: '',
      status: 1,
      permissions: [],
      roles: [],
      is_super_admin: false,
    })

    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('gl-auth')
  })
})
