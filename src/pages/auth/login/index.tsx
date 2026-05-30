/** @file 登录页 v2.0 - 全屏渐变+毛玻璃登录卡片+高级视觉效果 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Checkbox, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../../stores/authStore'
import { useTabStore } from '../../../stores/tabStore'
import { login } from '../../../services/authService'

const LAST_USERNAME_KEY = 'gl_last_username'
const REMEMBER_PASSWORD_KEY = 'gl_remember_password'
const OBFUSCATE_KEY = 'GL_REMEMBER_PWD_OBFUSCATE_2026'

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

function getStoredPassword(username: string): string {
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

function storePassword(username: string, password: string) {
  try {
    const encrypted = encryptPassword(password, username)
    const data = { pwd: encrypted, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
    localStorage.setItem(`${REMEMBER_PASSWORD_KEY}_${username}`, JSON.stringify(data))
  } catch { /* ignore */ }
}

function clearStoredPassword(username: string) {
  localStorage.removeItem(`${REMEMBER_PASSWORD_KEY}_${username}`)
}

function getStoredRemember(): boolean {
  return localStorage.getItem('gl_remember_checked') === 'true'
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setLogin } = useAuthStore()
  const { resetTabs } = useTabStore()

  const lastUsername = localStorage.getItem(LAST_USERNAME_KEY) || ''
  const lastRemember = getStoredRemember()
  const storedPassword = lastRemember && lastUsername ? getStoredPassword(lastUsername) : ''

  const [form] = Form.useForm()

  useEffect(() => {
    if (lastUsername) {
      form.setFieldsValue({ username: lastUsername })
      if (storedPassword) {
        form.setFieldsValue({ password: storedPassword, remember: true })
      } else {
        form.setFieldsValue({ remember: lastRemember })
      }
    }
  }, [form, lastUsername, storedPassword, lastRemember])

  const onFinish = async (values: { username: string; password: string; remember: boolean }) => {
    setLoading(true)
    try {
      const result = await login(values.username, values.password)
      resetTabs()
      setLogin(result.token, result.user)
      localStorage.setItem(LAST_USERNAME_KEY, values.username)

      if (values.remember) {
        storePassword(values.username, values.password)
        localStorage.setItem('gl_remember_checked', 'true')
      } else {
        clearStoredPassword(values.username)
        localStorage.setItem('gl_remember_checked', 'false')
      }

      message.success('登录成功')
      navigate('/dashboard')
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err) || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="h-screen w-screen flex overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #1677FF 100%)' }}
    >
      <div className="absolute inset-0 opacity-[0.07]">
        <div
          className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, #4096FF 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[5%] right-[15%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[50%] left-[50%] w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }}
        />
      </div>

      <div className="hidden lg:flex flex-1 flex-col justify-center items-center px-16 relative z-10">
        <div className="relative text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white mx-auto mb-8"
            style={{ background: 'linear-gradient(135deg, #4096FF, #1677FF)', boxShadow: '0 20px 50px rgba(22, 119, 255, 0.35)' }}
          >
            GL
          </div>
          <h1 className="text-[40px] font-bold text-white mb-4 tracking-tight">管用GL</h1>
          <p className="text-[17px] text-[#94A3B8] mb-2 font-light">企业资源管理平台</p>
          <p className="text-[14px] text-[#64748B] max-w-[420px] leading-relaxed">
            低代码表单引擎 · 数据中心 · 流程审批 · 权限管理
          </p>

          <div className="grid grid-cols-4 gap-6 mt-14">
            {[
              { icon: '📋', label: '表单设计' },
              { icon: '📊', label: '数据分析' },
              { icon: '🔄', label: '流程审批' },
              { icon: '🔐', label: '权限管控' },
            ].map((item) => (
              <div key={item.label} className="text-center group">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110"
                  style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(8px)' }}
                >
                  <span className="text-xl">{item.icon}</span>
                </div>
                <div className="text-[12px] text-[#94A3B8]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 lg:px-16 relative z-10">
        <div
          className="w-full max-w-[420px] rounded-2xl p-8 gl-fade-in"
          style={{
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
          }}
        >
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #4096FF, #1677FF)', boxShadow: '0 8px 20px rgba(22, 119, 255, 0.3)' }}
            >
              GL
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--gl-text-primary)' }}>管用GL</h2>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-[24px] font-bold mb-2 tracking-tight" style={{ color: 'var(--gl-text-primary)' }}>
              欢迎回来
            </h2>
            <p className="text-[14px]" style={{ color: 'var(--gl-text-secondary)' }}>
              请登录您的账号以继续
            </p>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            requiredMark={false}
            initialValues={{ username: '', password: '', remember: false }}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                autoFocus
                prefix={<UserOutlined style={{ color: 'var(--gl-text-tertiary)' }} />}
                placeholder="请输入用户名"
                size="large"
                style={{ borderRadius: 10, height: 46 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--gl-text-tertiary)' }} />}
                placeholder="请输入密码"
                size="large"
                style={{ borderRadius: 10, height: 46 }}
              />
            </Form.Item>

            <Form.Item>
              <div className="flex justify-start items-center">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox style={{ fontSize: 13 }}>记住密码</Checkbox>
                </Form.Item>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  borderRadius: 10,
                  height: 46,
                  fontWeight: 600,
                  fontSize: 15,
                  boxShadow: '0 4px 14px rgba(22, 119, 255, 0.3)',
                }}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}
