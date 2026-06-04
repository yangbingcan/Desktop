/** @file 用户管理 - 重置密码弹窗 */
import { useState } from 'react'
import { KeyOutlined } from '@ant-design/icons'
import { Button, Form, Input, message, Modal } from 'antd'
import { generateRandomPassword, resetUserPassword } from '../../../services/userService'
import type { UserItem } from '../../../services/userService'
import { handleFormSubmitError } from '../../../utils/errorHandler'

/** 重置密码表单值 */
interface ResetPasswordFormValues {
  new_password: string
}

interface ResetPasswordModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user: UserItem | null
}

/** 重置密码弹窗，支持手动输入或自动生成新密码 */
export function ResetPasswordModal({ open, onClose, onSuccess, user }: ResetPasswordModalProps) {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<ResetPasswordFormValues>()

  /** 提交重置密码 */
  const handleSubmit = async () => {
    if (!user) return
    try {
      const values = await form.validateFields()
      setLoading(true)
      await resetUserPassword(user.id, values.new_password)
      onClose()
      message.success('密码重置成功')
      onSuccess()
    } catch (err: unknown) {
      handleFormSubmitError(err)
    } finally {
      setLoading(false)
    }
  }

  /** 自动生成密码并填入表单 */
  const handleAutoGenerate = async () => {
    try {
      const pw = await generateRandomPassword()
      form.setFieldValue('new_password', pw)
      message.success('已自动生成密码')
    } catch {
      message.error('生成密码失败')
    }
  }

  return (
    <Modal
      title="重置密码"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="确认重置"
      cancelText="取消"
      destroyOnClose
      maskClosable={false}
      width={440}
    >
      {user && (
        <p className="mb-4" style={{ color: 'var(--gl-text-secondary)' }}>
          为用户「<strong style={{ color: 'var(--gl-text-primary)' }}>{user.real_name || user.username}</strong>」设置新密码
        </p>
      )}
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少6个字符' },
            { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '密码必须包含字母和数字' },
          ]}
        >
          <Input.Password
            placeholder="请输入新密码"
            addonAfter={
              <Button
                type="link"
                size="small"
                icon={<KeyOutlined />}
                onClick={handleAutoGenerate}
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
              >
                自动生成
              </Button>
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
