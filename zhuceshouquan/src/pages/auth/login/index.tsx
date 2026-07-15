/** @file 登录页 v9.0 - 极简高级+散布光点+柔和极光色洗+共享记住密码 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Checkbox, message } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  CloseOutlined,
  MinusOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAuthStore } from '../../../stores/authStore'
import { useTabStore } from '../../../stores/tabStore'
import { useTheme } from '../../../hooks/useTheme'
import { login } from '../../../services/authService'
import {
  getStoredPassword,
  storePassword,
  clearStoredPassword,
  getStoredRemember,
  setStoredRemember,
  getLastUsername,
  setLastUsername,
} from '../../../utils/rememberPassword'

const SCATTER_DOTS = [
  { x: 10, y: 14, size: 4, delay: 0, dur: 3.2 },
  { x: 82, y: 8, size: 3, delay: 1.1, dur: 3.8 },
  { x: 92, y: 35, size: 5, delay: 0.5, dur: 2.8 },
  { x: 18, y: 65, size: 3, delay: 1.9, dur: 3.5 },
  { x: 70, y: 88, size: 4, delay: 0.7, dur: 3.0 },
  { x: 35, y: 30, size: 3, delay: 1.4, dur: 4.0 },
  { x: 95, y: 70, size: 4, delay: 0.3, dur: 3.3 },
  { x: 5, y: 45, size: 5, delay: 1.7, dur: 2.6 },
  { x: 55, y: 10, size: 3, delay: 2.1, dur: 3.6 },
  { x: 42, y: 92, size: 4, delay: 0.9, dur: 3.1 },
  { x: 75, y: 50, size: 3, delay: 1.5, dur: 3.9 },
  { x: 14, y: 88, size: 5, delay: 0.4, dur: 2.9 },
  { x: 60, y: 58, size: 4, delay: 1.0, dur: 3.4 },
  { x: 28, y: 52, size: 3, delay: 2.3, dur: 3.7 },
  { x: 88, y: 55, size: 4, delay: 0.6, dur: 2.7 },
]

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setLogin } = useAuthStore()
  const { resetTabs } = useTabStore()
  const { isDark, toggleTheme } = useTheme()
  const appWindow = useMemo(() => getCurrentWindow(), [])

  const lastUsername = getLastUsername()
  const lastRemember = getStoredRemember()
  const storedPassword = lastUsername ? getStoredPassword(lastUsername) : ''

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

  const handleMinimize = () => {
    appWindow.minimize().catch(() => {})
  }
  const handleClose = () => {
    appWindow.close().catch(() => {})
  }

  const onFinish = async (values: { username: string; password: string; remember: boolean }) => {
    setLoading(true)
    try {
      const result = await login(values.username, values.password)
      resetTabs()
      setLogin(result.token, result.user)
      setLastUsername(values.username)

      if (values.remember) {
        storePassword(values.username, values.password)
        setStoredRemember(true)
      } else {
        clearStoredPassword(values.username)
        setStoredRemember(false)
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
      className="h-screen w-screen flex items-center justify-center overflow-hidden relative"
      style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, var(--gl-login-spotlight) 0%, transparent 70%), linear-gradient(160deg, var(--gl-login-bg) 0%, var(--gl-login-bg-end) 100%)` }}
    >
      <div className="gl-login-aurora" />
      <div className="gl-login-grid" />
      <div className="gl-login-dots-layer">
        {SCATTER_DOTS.map((dot, i) => (
          <div
            key={i}
            className="gl-login-dot"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: dot.size,
              height: dot.size,
              '--gl-dot-delay': `${dot.delay}s`,
              '--gl-dot-duration': `${dot.dur}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="gl-login-noise" />

      <div className="absolute top-0 right-0 flex items-center z-20" style={{ height: 36 }}>
        <div
          className="gl-login-win-btn flex items-center justify-center cursor-pointer transition-all"
          style={{ width: 40, height: 36, color: 'var(--gl-login-win-color)' }}
          onClick={toggleTheme}
          aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
        >
          {isDark ? <SunOutlined style={{ fontSize: 13 }} /> : <MoonOutlined style={{ fontSize: 13 }} />}
        </div>
        <div
          className="gl-login-win-btn flex items-center justify-center cursor-pointer transition-all"
          style={{ width: 46, height: 36, color: 'var(--gl-login-win-color)' }}
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <MinusOutlined style={{ fontSize: 12 }} />
        </div>
        <div
          className="gl-login-win-btn gl-login-win-close flex items-center justify-center cursor-pointer transition-all"
          style={{ width: 46, height: 36, color: 'var(--gl-login-win-color)' }}
          onClick={handleClose}
          aria-label="关闭"
        >
          <CloseOutlined style={{ fontSize: 12 }} />
        </div>
      </div>

      <div
        className="gl-login-card gl-login-card-enter w-full max-w-[400px] rounded-2xl relative z-10 overflow-hidden"
        style={{
          background: 'var(--gl-login-card-bg)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: 'var(--gl-login-card-shadow)',
          border: '1px solid var(--gl-login-card-border)',
          borderTopColor: 'var(--gl-login-card-border-top)',
        }}
      >
        <div className="gl-login-card-accent" />

        <div className="px-8 pt-9 pb-4">
          <div className="flex items-center gap-4 mb-1 relative">
            <div className="gl-login-logo-ring">
              <div className="gl-login-logo-glow" />
              <div
                className="gl-login-logo-pulse w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white relative"
                style={{
                  background: `linear-gradient(135deg, var(--gl-login-logo-from), var(--gl-login-logo-to))`,
                }}
              >
                GL
              </div>
            </div>
            <div>
              <h1
                className="text-[20px] font-bold tracking-tight leading-tight"
                style={{
                  background: `linear-gradient(135deg, var(--gl-login-title-from), var(--gl-login-title-to))`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                管用GL
              </h1>
              <p className="text-[12px] leading-tight" style={{ color: 'var(--gl-login-text-muted)' }}>
                企业资源管理平台
              </p>
            </div>
          </div>
        </div>

        <div className="gl-login-divider" />

        <div className="px-8 pt-5 pb-8">
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
                prefix={<UserOutlined style={{ color: 'var(--gl-login-text-muted)', fontSize: 14 }} />}
                placeholder="请输入用户名"
                size="large"
                variant="borderless"
                style={{
                  height: 48,
                  color: 'var(--gl-login-text)',
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--gl-login-text-muted)', fontSize: 14 }} />}
                placeholder="请输入密码"
                size="large"
                variant="borderless"
                style={{
                  height: 48,
                  color: 'var(--gl-login-text)',
                }}
              />
            </Form.Item>

            <Form.Item>
              <div className="flex justify-start items-center">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox style={{ fontSize: 13, color: 'var(--gl-login-text-secondary)' }}>
                    记住密码
                  </Checkbox>
                </Form.Item>
              </div>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className="gl-login-btn"
                style={{
                  borderRadius: 10,
                  height: 44,
                  fontWeight: 600,
                  fontSize: 15,
                  background: '#1677FF',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(22, 119, 255, 0.25)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#4096FF'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(22, 119, 255, 0.35)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1677FF'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(22, 119, 255, 0.25)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.background = '#0958D9'
                  e.currentTarget.style.transform = 'translateY(0) scale(0.98)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.background = '#4096FF'
                  e.currentTarget.style.transform = 'translateY(-1px)'
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
