/** @file 记住登录工具单元测试 - 存储Token和密码 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStoredToken,
  storeToken,
  clearStoredToken,
  getStoredRemember,
  setStoredRemember,
  getLastUsername,
  setLastUsername,
  getRememberedAccounts,
  storePassword,
  getStoredPassword,
  clearStoredPassword,
} from '../rememberPassword'

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

describe('rememberPassword', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('storeToken / getStoredToken', () => {
    it('存储并读取Token', async () => {
      await storeToken('testuser', 'token_abc123')

      // 验证localStorage.setItem被调用
      expect(localStorageMock.setItem).toHaveBeenCalled()
      const setCall = localStorageMock.setItem.mock.calls[0]
      expect(setCall[0]).toContain('gl_remember_token_testuser')

      // 直接从store读取验证
      const storedData = JSON.parse(setCall[1] as string)
      expect(storedData.token).toBe('token_abc123')
      expect(storedData.exp).toBeGreaterThan(Date.now())
    })

    it('过期Token不返回', async () => {
      // 手动设置过期数据
      const expiredData = JSON.stringify({ token: 'old_token', exp: Date.now() - 1000 })
      localStorageMock.getItem.mockReturnValueOnce(expiredData)

      const token = await getStoredToken('testuser')
      expect(token).toBe('')
      // 过期数据应被清除
      expect(localStorageMock.removeItem).toHaveBeenCalled()
    })

    it('空数据返回空字符串', async () => {
      localStorageMock.getItem.mockReturnValueOnce(null as unknown as string)

      const token = await getStoredToken('nonexistent')
      expect(token).toBe('')
    })

    it('有效Token正确返回', async () => {
      const validData = JSON.stringify({ token: 'valid_token_xyz', exp: Date.now() + 86400000 })
      localStorageMock.getItem.mockReturnValueOnce(validData)

      const token = await getStoredToken('testuser')
      expect(token).toBe('valid_token_xyz')
    })
  })

  describe('clearStoredToken', () => {
    it('清除指定用户的已存储Token', () => {
      clearStoredToken('testuser')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('gl_remember_token_testuser')
    })
  })

  describe('getStoredRemember / setStoredRemember', () => {
    it('读取和设置记住密码勾选状态', () => {
      setStoredRemember(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('gl_remember_checked', 'true')

      localStorageMock.getItem.mockReturnValueOnce('true')
      expect(getStoredRemember()).toBe(true)
    })

    it('未设置时返回false', () => {
      localStorageMock.getItem.mockReturnValueOnce(null as unknown as string)
      expect(getStoredRemember()).toBe(false)
    })
  })

  describe('getLastUsername / setLastUsername', () => {
    it('读取和设置上次登录用户名', () => {
      setLastUsername('admin')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('gl_last_username', 'admin')

      localStorageMock.getItem.mockReturnValueOnce('admin')
      expect(getLastUsername()).toBe('admin')
    })

    it('未设置时返回空字符串', () => {
      localStorageMock.getItem.mockReturnValueOnce(null as unknown as string)
      expect(getLastUsername()).toBe('')
    })
  })

  describe('getRememberedAccounts', () => {
    it('返回所有记住的账号列表', () => {
      // 模拟localStorage中有记住的账号
      localStorageMock.getItem.mockImplementation(((key: string): string | null => {
        if (key === 'gl_remember_token_user1') {
          return JSON.stringify({ token: 'token1', exp: Date.now() + 100000 })
        }
        if (key === 'gl_remember_token_user2') {
          return JSON.stringify({ token: 'token2', exp: Date.now() + 100000 })
        }
        return null
      }) as unknown as typeof localStorageMock.getItem)

      const accounts = getRememberedAccounts()
      expect(Array.isArray(accounts)).toBe(true)
    })
  })

  describe('storePassword / getStoredPassword', () => {
    it('存储并读取密码', () => {
      storePassword('testuser', 'mypassword123')

      // 验证localStorage.setItem被调用
      expect(localStorageMock.setItem).toHaveBeenCalled()
      const setCall = localStorageMock.setItem.mock.calls.find(c => c[0].includes('gl_remember_pwd_testuser'))
      expect(setCall).toBeTruthy()
      // 存储的值应该是混淆后的，不是明文
      expect(setCall![1]).not.toBe('mypassword123')

      // 重新通过mock返回存储的值来验证读取
      localStorageMock.getItem.mockReturnValueOnce(setCall![1] as string)
      const password = getStoredPassword('testuser')
      expect(password).toBe('mypassword123')
    })

    it('未存储密码返回空字符串', () => {
      localStorageMock.getItem.mockReturnValueOnce(null as unknown as string)
      expect(getStoredPassword('nonexistent')).toBe('')
    })

    it('混淆数据损坏返回空字符串', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid-base64!!!' as unknown as string)
      expect(getStoredPassword('testuser')).toBe('')
    })

    it('支持中文密码', () => {
      storePassword('testuser', '密码测试123')
      const setCall = localStorageMock.setItem.mock.calls.find(c => c[0].includes('gl_remember_pwd_testuser'))
      localStorageMock.getItem.mockReturnValueOnce(setCall![1] as string)
      const password = getStoredPassword('testuser')
      expect(password).toBe('密码测试123')
    })
  })

  describe('clearStoredPassword', () => {
    it('清除指定用户的已存储密码', () => {
      clearStoredPassword('testuser')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('gl_remember_pwd_testuser')
    })
  })
})
