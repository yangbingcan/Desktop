/** @file 用户管理 - 编辑用户弹窗 */
import { useEffect, useState } from 'react'
import { Form, Input, message, Modal, Select } from 'antd'
import type { RoleBrief, UserItem } from '../../../services/userService'
import { updateUser } from '../../../services/userService'
import { handleFormSubmitError } from '../../../utils/errorHandler'

/** 编辑用户表单值 */
interface EditFormValues {
  real_name: string
  phone?: string
  email?: string
  role_ids?: string[]
}

interface EditUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  roleOptions: RoleBrief[]
  user: UserItem | null
}

/** 编辑用户弹窗，打开时自动填充用户信息，保存后刷新列表 */
export function EditUserModal({ open, onClose, onSuccess, roleOptions, user }: EditUserModalProps) {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<EditFormValues>()

  // 当弹窗打开时，填充用户信息到表单
  useEffect(() => {
    if (open && user) {
      form.setFieldsValue({
        real_name: user.real_name,
        phone: user.phone || undefined,
        email: user.email || undefined,
        role_ids: user.roles.map((r) => r.id),
      })
    }
  }, [open, user, form])

  /** 提交编辑用户 */
  const handleSubmit = async () => {
    if (!user) return
    try {
      const values = await form.validateFields()
      setLoading(true)
      await updateUser({
        id: user.id,
        real_name: values.real_name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        role_ids: values.role_ids,
      })
      onClose()
      message.success('用户信息更新成功')
      onSuccess()
    } catch (err: unknown) {
      handleFormSubmitError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="编辑用户"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      maskClosable={false}
      width={640}
    >
      {user && (
        <div className="mb-4 px-3 py-2 rounded" style={{ color: 'var(--gl-text-tertiary)' }}>
          <span style={{ color: 'var(--gl-text-tertiary)' }}>用户名：</span>
          <span style={{ color: 'var(--gl-text-primary)' }} className="font-medium">
            {user.username}
          </span>
        </div>
      )}
      <Form form={form} layout="vertical" className="mt-4" autoComplete="off">
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item
            name="real_name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" maxLength={32} />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" maxLength={20} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" maxLength={64} />
          </Form.Item>
          <Form.Item name="role_ids" label="角色">
            <Select
              mode="multiple"
              placeholder="请选择角色"
              options={roleOptions.map((r) => ({ label: r.name, value: r.id }))}
              allowClear
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
