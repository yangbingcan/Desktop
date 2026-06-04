/** @file 个人信息弹窗 - 编辑用户姓名、手机号、邮箱 */
import { Form, Input, Modal, message } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { updateUser } from '../../../services/userService'
import { handleApiError } from '../../../utils/errorHandler'

/** ProfileModal 组件属性 */
interface ProfileModalProps {
  /** 是否打开弹窗 */
  open: boolean
  /** 关闭弹窗回调 */
  onClose: () => void
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, setUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  /** 打开弹窗时初始化表单 */
  const handleOpen = () => {
    if (user) {
      form.setFieldsValue({
        real_name: user.real_name,
        phone: user.phone,
        email: user.email || '',
      })
    }
  }

  /** 提交个人信息修改 */
  const handleSubmit = async (values: { real_name: string; phone: string; email: string }) => {
    setLoading(true)
    try {
      await updateUser({
        id: user?.id || '',
        real_name: values.real_name,
        phone: values.phone,
        email: values.email || undefined,
      })
      setUser({
        real_name: values.real_name,
        phone: values.phone,
        email: values.email || null,
      })
      message.success('个人信息已更新')
      onClose()
    } catch (err: unknown) {
      handleApiError(err, '更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="个人信息"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      maskClosable={false}
      width={560}
      afterOpenChange={(visible) => { if (visible) handleOpen() }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item label="用户名">
            <Input value={user?.username} disabled prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="real_name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
          ]}>
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}>
            <Input placeholder="请输入邮箱" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
