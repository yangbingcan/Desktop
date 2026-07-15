/** @file 授权激活页 v2.0 - 离线 HMAC 签名验证 + 机器码展示 */
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Alert, Typography, Spin } from 'antd'
import {
  CloseOutlined,
  MinusOutlined,
  SunOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useLicenseStore } from '../../../stores/licenseStore'
import { verifyLicenseCode, getMachineId } from '../../../services/licenseService'
import { useTheme } from '../../../hooks/useTheme'
import { message } from 'antd'

const { Text, Paragraph } = Typography

export default function ActivationPage() {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [machineId, setMachineId] = useState<string>('')
  const [machineIdLoading, setMachineIdLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const appWindow = useMemo(() => getCurrentWindow(), [])

  const [form] = Form.useForm()

  // 获取机器码
  useEffect(() => {
    getMachineId()
      .then((id) => {
        setMachineId(id)
        setMachineIdLoading(false)
      })
      .catch(() => {
        setMachineId('获取失败')
        setMachineIdLoading(false)
      })
  }, [])

  const handleMinimize = () => {
    appWindow.minimize().catch(() => {})
  }
  const handleClose = () => {
    appWindow.close().catch(() => {})
  }

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId).then(() => {
      setCopied(true)
      message.success('机器码已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      message.error('复制失败，请手动选择复制')
    })
  }

  const onFinish = async (values: { code: string }) => {
    const code = values.code?.trim()
    if (!code) {
      setErrorMsg('请输入授权码')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      // 直接调用 service，在此处捕获错误，避免 store 时序问题
      const result = await verifyLicenseCode(code)
      // 验证成功，更新 store 状态
      useLicenseStore.setState({
        activated: true,
        activatedAt: result.activated_at,
        machineId: result.machine_id,
        expiry: result.expiry,
        loading: false,
        error: null,
      })
      message.success('授权激活成功！')
      navigate('/login')
    } catch (err: unknown) {
      // Tauri invoke 抛出的是字符串，直接取值
      const msg = typeof err === 'string' ? err : (err instanceof Error ? err.message : String(err))
      setErrorMsg(msg || '验证失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center overflow-hidden relative"
      style={{
        background: `radial-gradient(ellipse 60% 50% at 50% 50%, var(--gl-login-spotlight) 0%, transparent 70%), linear-gradient(160deg, var(--gl-login-bg) 0%, var(--gl-login-bg-end) 100%)`,
      }}
    >
      <div className="gl-login-aurora" />
      <div className="gl-login-grid" />
      <div className="gl-login-noise" />

      {/* 窗口控制按钮 */}
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

      {/* 激活卡片 */}
      <div
        className="gl-login-card gl-login-card-enter w-full max-w-[480px] rounded-2xl relative z-10 overflow-hidden"
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
                <SafetyCertificateOutlined />
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
                授权激活
              </h1>
              <p className="text-[12px] leading-tight" style={{ color: 'var(--gl-login-text-muted)' }}>
                管用GL · 请输入授权码完成激活
              </p>
            </div>
          </div>
        </div>

        <div className="gl-login-divider" />

        <div className="px-8 pt-5 pb-8">
          {/* 机器码展示区 */}
          <div
            className="mb-5 p-4 rounded-xl"
            style={{
              background: 'var(--gl-login-input-bg)',
              border: '1px solid var(--gl-login-input-border)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Text style={{ color: 'var(--gl-login-text-secondary)', fontSize: 12 }}>
                当前机器码
              </Text>
              {machineId && machineId !== '获取失败' && (
                <Button
                  type="text"
                  size="small"
                  icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={handleCopyMachineId}
                  style={{ color: 'var(--gl-primary)', fontSize: 11 }}
                >
                  {copied ? '已复制' : '复制'}
                </Button>
              )}
            </div>
            {machineIdLoading ? (
              <div className="flex items-center gap-2">
                <Spin size="small" />
                <Text style={{ color: 'var(--gl-login-text-muted)', fontSize: 13 }}>
                  正在获取机器码...
                </Text>
              </div>
            ) : (
              <Paragraph
                copyable={false}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: 2,
                  color: 'var(--gl-login-text)',
                  margin: 0,
                }}
              >
                {machineId}
              </Paragraph>
            )}
            <div className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--gl-login-text-muted)' }}>
              请将此机器码发送给技术服务人员，以获取对应的授权码
            </div>
          </div>

          <Form
            form={form}
            name="activation"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            requiredMark={false}
          >
            <Form.Item
              name="code"
              rules={[{ required: true, message: '请输入授权码' }]}
            >
              <Input.TextArea
                autoFocus
                placeholder="请输入技术服务人员提供的授权码"
                size="large"
                variant="borderless"
                style={{
                  minHeight: 72,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: 'var(--gl-login-text)',
                  resize: 'none',
                }}
                maxLength={512}
                onChange={() => {
                  if (errorMsg) setErrorMsg(null)
                }}
              />
            </Form.Item>

            {/* 错误提示 */}
            {errorMsg && (
              <Alert
                message={errorMsg}
                type="error"
                showIcon
                style={{
                  marginBottom: 16,
                  borderRadius: 8,
                  background: 'var(--gl-error-bg)',
                  border: '1px solid rgba(255, 77, 79, 0.2)',
                }}
              />
            )}

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
              >
                激 活
              </Button>
            </Form.Item>
          </Form>

          {/* 底部提示 */}
          <div
            className="text-center mt-4 text-[11px] leading-relaxed"
            style={{ color: 'var(--gl-login-text-muted)' }}
          >
            <p>授权码由技术服务人员通过机器码生成，具有机器绑定和有效期</p>
            <p>如需获取授权码或遇到问题，请联系技术服务人员</p>
          </div>
        </div>
      </div>
    </div>
  )
}
