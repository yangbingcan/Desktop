/** @file 会员新增/编辑弹窗 */
import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, DatePicker, message } from 'antd'
import { createMember, updateMember, getMemberDetail, type MemberInput } from '../../../services/memberService'
import dayjs from 'dayjs'

interface Props {
  open: boolean
  memberId?: string | null
  onClose: () => void
  onSuccess: () => void
}

const LEVEL_OPTIONS = [
  { label: '普通会员', value: 'normal' },
  { label: '银卡会员', value: 'silver' },
  { label: '金卡会员', value: 'gold' },
]

const GENDER_OPTIONS = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
]

export default function MemberForm({ open, memberId, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (memberId) {
        getMemberDetail(memberId).then(res => {
          const m = res.member
          form.setFieldsValue({
            name: m.name, phone: m.phone, gender: m.gender,
            birthday: m.birthday ? dayjs(m.birthday) : null, level: m.level,
          })
        }).catch(e => message.error(e?.toString() || '加载失败'))
      } else {
        form.resetFields()
        form.setFieldsValue({ level: 'normal' })
      }
    }
  }, [open, memberId])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const input: MemberInput = {
        name: values.name, phone: values.phone,
        gender: values.gender || undefined,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined,
        level: values.level || 'normal',
      }
      if (memberId) {
        await updateMember(memberId, input)
        message.success('更新成功')
      } else {
        await createMember(input)
        message.success('创建成功')
      }
      onSuccess()
      onClose()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.toString() || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={memberId ? '编辑会员' : '新增会员'} open={open} onCancel={onClose}
      onOk={handleSave} confirmLoading={loading} width={520} okText="保存" cancelText="取消" destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
          <Input placeholder="会员姓名/昵称" />
        </Form.Item>
        <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入正确的手机号' }]}>
          <Input placeholder="11位手机号" maxLength={11} />
        </Form.Item>
        <Form.Item label="性别" name="gender">
          <Select options={GENDER_OPTIONS} allowClear placeholder="选择性别" />
        </Form.Item>
        <Form.Item label="生日" name="birthday">
          <DatePicker style={{ width: '100%' }} placeholder="选择生日" />
        </Form.Item>
        <Form.Item label="会员等级" name="level">
          <Select options={LEVEL_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
