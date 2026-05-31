/** @file 记住密码工具 - 加密存储、读取、列出、删除记住的密码 */

const REMEMBER_PASSWORD_KEY = 'gl_remember_password'
const OBFUSCATE_KEY = 'GL_REMEMBER_PWD_OBFUSCATE_2026'
const REMEMBER_CHECKED_KEY = 'gl_remember_checked'
const LAST_USERNAME_KEY = 'gl_last_username'

function xorObfuscate(input: string, key: string): string {
  let result = ''
  for (let i = 0; i < input.length; i++) {
    result += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result
}

function encryptPassword(password: string, username: string): string {
  const combinedKey = OBFUSCATE_KEY + username
  const xored = xorObfuscate(password, combinedKey)
  return btoa(encodeURIComponent(xored))
}

function decryptPassword(encrypted: string, username: string): string {
  const combinedKey = OBFUSCATE_KEY + username
  const xored = decodeURIComponent(atob(encrypted))
  return xorObfuscate(xored, combinedKey)
}

export function getStoredPassword(username: string): string {
  try {
    const data = localStorage.getItem(`${REMEMBER_PASSWORD_KEY}_${username}`)
    if (!data) return ''
    const parsed = JSON.parse(data)
    const now = Date.now()
    if (parsed.exp && now > parsed.exp) {
      localStorage.removeItem(`${REMEMBER_PASSWORD_KEY}_${username}`)
      return ''
    }
    if (!parsed.pwd) return ''
    return decryptPassword(parsed.pwd, username)
  } catch {
    return ''
  }
}

export function storePassword(username: string, password: string) {
  try {
    const encrypted = encryptPassword(password, username)
    const data = { pwd: encrypted, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
    localStorage.setItem(`${REMEMBER_PASSWORD_KEY}_${username}`, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function clearStoredPassword(username: string) {
  localStorage.removeItem(`${REMEMBER_PASSWORD_KEY}_${username}`)
}

export function getStoredRemember(): boolean {
  return localStorage.getItem(REMEMBER_CHECKED_KEY) === 'true'
}

export function setStoredRemember(checked: boolean) {
  localStorage.setItem(REMEMBER_CHECKED_KEY, String(checked))
}

export function getLastUsername(): string {
  return localStorage.getItem(LAST_USERNAME_KEY) || ''
}

export function setLastUsername(username: string) {
  localStorage.setItem(LAST_USERNAME_KEY, username)
}

export interface RememberedAccount {
  username: string
  hasPassword: boolean
}

export function getRememberedAccounts(): RememberedAccount[] {
  const accounts: RememberedAccount[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(REMEMBER_PASSWORD_KEY + '_')) {
      const username = key.slice(REMEMBER_PASSWORD_KEY.length + 1)
      const data = localStorage.getItem(key)
      let hasPassword = false
      if (data) {
        try {
          const parsed = JSON.parse(data)
          hasPassword = !!(parsed.pwd && (!parsed.exp || Date.now() <= parsed.exp))
        } catch { /* ignore */ }
      }
      accounts.push({ username, hasPassword })
    }
  }
  return accounts
}
