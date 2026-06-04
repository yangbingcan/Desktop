/** @file 修改密码弹窗 - 输入原密码、新密码、确认新密码，支持首次登录强制改密 */
import { Form, Input, Modal, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../stores/authStore'
import { updatePassword } from '../../../services/authService'
import { handleApiError } from '../../../utils/errorHandler'

/** PasswordModal 组件属性 */
interface PasswordModalProps {
  /** 是否打开弹窗 */
  open: boolean
  /** 关闭弹窗回调 */
  onClose: () => void
  /** 是否为首次登录强制改密（隐藏取消按钮，禁止关闭） */
  forceChange?: boolean
}

export default function PasswordModal({ open, onClose, forceChange }: PasswordModalProps) {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  /** 提交密码修改 */
  const handleSubmit = async (values: { old_password: string; new_password: string }) => {
    setLoading(true)
    try {
      await updatePassword(values.old_password, values.new_password)
      message.success('密码修改成功，请重新登录')
      onClose()
      logout()
      navigate('/login')
    } catch (err: unknown) {
      handleApiError(err, '修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={forceChange ? "首次登录，请修改密码" : "修改密码"}
      open={open}
      onCancel={forceChange ? undefined : onClose}
      closable={!forceChange}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="确认修改"
      cancelButtonProps={forceChange ? { style: { display: 'none' } } : undefined}
      cancelText="取消"
      destroyOnClose
      maskClosable={false}
      width={440}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label="原密码"
          name="old_password"
          rules={[{ required: true, message: '请输入原密码' }]}
        >
          <Input.Password placeholder="请输入原密码" prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="new_password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码长度不能少于6位' },
            { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '密码必须包含字母和数字' },
          ]}
        >
          <Input.Password placeholder="请输入新密码" prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirm_password"
          dependencies={['new_password']}
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" prefix={<LockOutlined />} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
