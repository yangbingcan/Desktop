/** @file 切换用户弹窗 - 显示记住登录的账号列表，支持快速切换和删除记录 */
import { useState } from 'react'
import { Modal, Button, message } from 'antd'
import { SwapOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../stores/authStore'
import { useTabStore } from '../../../stores/tabStore'
import { getCurrentUser } from '../../../services/authService'
import {
  getRememberedAccounts,
  getStoredToken,
  clearStoredToken,
  setLastUsername,
  type RememberedAccount,
} from '../../../utils/rememberPassword'

/** SwitchUserModal 组件属性 */
interface SwitchUserModalProps {
  /** 是否打开弹窗 */
  open: boolean
  /** 关闭弹窗回调 */
  onClose: () => void
}

export default function SwitchUserModal({ open, onClose }: SwitchUserModalProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuthStore()
  const { resetTabs } = useTabStore()
  const [accounts, setAccounts] = useState<RememberedAccount[]>([])
  const [switchLoading, setSwitchLoading] = useState<string | null>(null)

  /** 打开弹窗时加载记住的账号列表 */
  const handleOpen = () => {
    setAccounts(getRememberedAccounts())
  }

  /** 切换到指定账号（使用记住的Token验证） */
  const handleSwitchUser = async (account: RememberedAccount) => {
    if (account.username === user?.username) {
      message.info('当前已是该用户')
      return
    }
    const token = await getStoredToken(account.username)
    if (!token) {
      message.warning('该用户登录已过期，请手动登录')
      logout()
      resetTabs()
      onClose()
      navigate('/login')
      return
    }
    setSwitchLoading(account.username)
    try {
      // 仅设置token，使invokeCommand携带该token请求用户信息
      // 不设置空壳UserInfo，避免权限检查窗口期
      useAuthStore.getState().setTokenOnly(token)
      const userInfo = await getCurrentUser()
      // 请求成功后用完整用户信息设置认证状态
      useAuthStore.getState().setLogin(token, userInfo)
      setLastUsername(account.username)
      resetTabs()
      onClose()
      navigate('/dashboard')
      message.success(`已切换到 ${userInfo.real_name || account.username}`)
    } catch {
      // Token已失效，清除临时状态并跳转登录
      clearStoredToken(account.username)
      logout()
      resetTabs()
      onClose()
      navigate('/login')
      message.error('登录已过期，请重新登录')
    } finally {
      setSwitchLoading(null)
    }
  }

  /** 删除记住的账号Token记录 */
  const handleDeleteRemembered = (username: string) => {
    clearStoredToken(username)
    setAccounts(getRememberedAccounts())
    message.success(`已清除 ${username} 的记住登录`)
  }

  return (
    <Modal
      title="切换用户"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      maskClosable={false}
      width={400}
      afterOpenChange={(visible) => { if (visible) handleOpen() }}
    >
      <div style={{ marginTop: 8 }}>
        {accounts.length === 0 ? (
          <div className="text-center py-6" style={{ color: 'var(--gl-text-tertiary)' }}>
            <p>暂无记住登录的账号</p>
            <p className="text-[12px] mt-1">登录时勾选「记住密码」后可在此快速切换</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const isCurrent = account.username === user?.username
              return (
                <div
                  key={account.username}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: isCurrent ? 'var(--gl-primary-supply)' : 'transparent',
                    border: `1px solid ${isCurrent ? 'var(--gl-primary)' : 'var(--gl-border)'}`,
                  }}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                      style={{
                        background: isCurrent
                          ? 'linear-gradient(135deg, #1677FF, #4096FF)'
                          : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      }}
                    >
                      {account.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--gl-text-primary)' }}>
                        {account.username}
                        {isCurrent && (
                          <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--gl-primary)' }}>
                            当前
                          </span>
                        )}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--gl-text-tertiary)' }}>
                        {account.hasToken ? '已记住登录' : '未记住登录'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {!isCurrent && account.hasToken && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<SwapOutlined />}
                        loading={switchLoading === account.username}
                        onClick={() => handleSwitchUser(account)}
                      >
                        切换
                      </Button>
                    )}
                    <Button
                      type="text"
                      size="small"
                      danger={account.hasToken}
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteRemembered(account.username)}
                      title={account.hasToken ? '清除记住的登录' : '移除记录'}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
