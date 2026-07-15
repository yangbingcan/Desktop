/** @file 会员储值充值弹窗 */
import { useState, useEffect } from 'react'
import { Modal, Form, InputNumber, Input, message, Statistic, Radio } from 'antd'
import { rechargeMemberBalance, getMemberDetail, type RechargeInput } from '../../../services/memberService'
import { useAuthStore } from '../../../stores/authStore'

interface Props {
  open: boolean
  memberId: string | null
  onClose: () => void
  onSuccess: () => void
}

const PAY_METHODS = [
  { label: '现金', value: 'cash' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
]

export default function RechargeModal({ open, memberId, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState(0)
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    if (open && memberId) {
      getMemberDetail(memberId).then(res => {
        setBalance(res.member?.balance || 0)
      }).catch(() => {})
      form.resetFields()
      form.setFieldsValue({ payment_method: 'cash' })
    }
  }, [open, memberId])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const input: RechargeInput = {
        member_id: memberId!, amount: values.amount,
        payment_method: values.payment_method, operator: user?.username || 'admin',
        remark: values.remark, bonus_amount: values.bonus_amount,
      }
      const res = await rechargeMemberBalance(input)
      message.success(`充值成功！余额：¥${res.newBalance.toFixed(2)}`)
      onSuccess()
      onClose()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.toString() || '充值失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="会员储值充值" open={open} onCancel={onClose}
      onOk={handleSave} confirmLoading={loading} width={480} okText="确认充值" cancelText="取消" destroyOnClose>
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <Statistic title="当前余额" value={balance} precision={2} prefix="¥"
          valueStyle={{ color: '#0D9488' }} />
      </div>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="充值金额" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
          <InputNumber style={{ width: '100%' }} min={0.01} step={100} precision={2}
            placeholder="输入充值金额" formatter={v => `¥${v}`} parser={v => v?.replace('¥', '') as any} />
        </Form.Item>
        <Form.Item label="赠送金额" name="bonus_amount" extra="可选，如充500送50则填50">
          <InputNumber style={{ width: '100%' }} min={0} step={10} precision={2}
            placeholder="赠送金额" formatter={v => `¥${v}`} parser={v => v?.replace('¥', '') as any} />
        </Form.Item>
        <Form.Item label="支付方式" name="payment_method" rules={[{ required: true }]}>
          <Radio.Group options={PAY_METHODS} optionType="button" buttonStyle="solid" />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={2} placeholder="可选备注" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
