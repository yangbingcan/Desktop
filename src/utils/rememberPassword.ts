/** @file 记住登录工具 - 存储Token和密码（XOR混淆）实现记住密码功能 */

const REMEMBER_TOKEN_KEY = 'gl_remember_token'
const REMEMBER_PASSWORD_KEY = 'gl_remember_pwd'
const REMEMBER_CHECKED_KEY = 'gl_remember_checked'
const LAST_USERNAME_KEY = 'gl_last_username'

/** Token有效期：30天（毫秒） */
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000

/** XOR混淆密钥（仅用于本地存储混淆，非加密） */
const OBFUSCATE_KEY = 'GL_REMEMBER_OBFUSCATION_2024'

/** 混淆字符串（XOR + Base64），使用 TextEncoder 替代已弃用的 escape */
function obfuscate(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const encoded = btoa(String.fromCharCode(...bytes))
  let result = ''
  for (let i = 0; i < encoded.length; i++) {
    result += String.fromCharCode(encoded.charCodeAt(i) ^ OBFUSCATE_KEY.charCodeAt(i % OBFUSCATE_KEY.length))
  }
  return btoa(result)
}

/** 解混淆字符串，使用 TextDecoder 替代已弃用的 unescape */
function deobfuscate(obfuscated: string): string {
  try {
    const decoded = atob(obfuscated)
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ OBFUSCATE_KEY.charCodeAt(i % OBFUSCATE_KEY.length))
    }
    const bytes = Uint8Array.from(atob(result), (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

/** 获取已存储的Token */
export async function getStoredToken(username: string): Promise<string> {
  try {
    const data = localStorage.getItem(`${REMEMBER_TOKEN_KEY}_${username}`)
    if (!data) return ''
    const parsed = JSON.parse(data)
    const now = Date.now()
    if (parsed.exp && now > parsed.exp) {
      localStorage.removeItem(`${REMEMBER_TOKEN_KEY}_${username}`)
      return ''
    }
    return parsed.token || ''
  } catch {
    return ''
  }
}

/** 存储Token */
export async function storeToken(username: string, token: string): Promise<void> {
  try {
    const data = { token, exp: Date.now() + TOKEN_TTL }
    localStorage.setItem(`${REMEMBER_TOKEN_KEY}_${username}`, JSON.stringify(data))
  } catch { /* 存储失败静默忽略，不影响登录流程 */ }
}

/** 清除指定用户的已存储Token */
export function clearStoredToken(username: string) {
  localStorage.removeItem(`${REMEMBER_TOKEN_KEY}_${username}`)
}

/** 存储密码（XOR混淆，仅防明文暴露） */
export function storePassword(username: string, password: string): void {
  try {
    localStorage.setItem(`${REMEMBER_PASSWORD_KEY}_${username}`, obfuscate(password))
  } catch { /* 存储失败静默忽略 */ }
}

/** 获取已存储的密码 */
export function getStoredPassword(username: string): string {
  try {
    const data = localStorage.getItem(`${REMEMBER_PASSWORD_KEY}_${username}`)
    if (!data) return ''
    return deobfuscate(data)
  } catch {
    return ''
  }
}

/** 清除指定用户的已存储密码 */
export function clearStoredPassword(username: string) {
  localStorage.removeItem(`${REMEMBER_PASSWORD_KEY}_${username}`)
}

/** 获取"记住密码"勾选状态 */
export function getStoredRemember(): boolean {
  return localStorage.getItem(REMEMBER_CHECKED_KEY) === 'true'
}

/** 设置"记住密码"勾选状态 */
export function setStoredRemember(checked: boolean) {
  localStorage.setItem(REMEMBER_CHECKED_KEY, String(checked))
}

/** 获取上次登录的用户名 */
export function getLastUsername(): string {
  return localStorage.getItem(LAST_USERNAME_KEY) || ''
}

/** 设置上次登录的用户名 */
export function setLastUsername(username: string) {
  localStorage.setItem(LAST_USERNAME_KEY, username)
}

export interface RememberedAccount {
  username: string
  hasToken: boolean
}

/** 获取所有记住的账号列表（仅检查Token存在性） */
export function getRememberedAccounts(): RememberedAccount[] {
  const accounts: RememberedAccount[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(REMEMBER_TOKEN_KEY + '_')) {
      const username = key.slice(REMEMBER_TOKEN_KEY.length + 1)
      const data = localStorage.getItem(key)
      let hasToken = false
      if (data) {
        try {
          const parsed = JSON.parse(data)
          hasToken = !!(parsed.token && (!parsed.exp || Date.now() <= parsed.exp))
        } catch { /* ignore */ }
      }
      accounts.push({ username, hasToken })
    }
  }
  return accounts
}
