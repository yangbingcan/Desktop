/** @file 供应商新增/编辑弹窗 */
import { useState, useEffect } from 'react'
import { Modal, Form, Input, message } from 'antd'
import { createSupplier, updateSupplier, getSupplier, type SupplierInput } from '../../../services/supplierService'

interface Props {
  open: boolean; supplierId?: string | null; onClose: () => void; onSuccess: () => void
}

export default function SupplierForm({ open, supplierId, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (supplierId) {
        getSupplier(supplierId).then(s => {
          form.setFieldsValue({ name: s.name, contact_person: s.contact_person, contact_phone: s.contact_phone, address: s.address, main_categories: s.main_categories, remark: s.remark })
        }).catch(e => message.error(e?.toString() || '加载失败'))
      } else {
        form.resetFields()
        form.setFieldsValue({ main_categories: '[]' })
      }
    }
  }, [open, supplierId])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const input: SupplierInput = { ...values, main_categories: values.main_categories || '[]' }
      if (supplierId) {
        await updateSupplier(supplierId, input)
        message.success('更新成功')
      } else {
        await createSupplier(input)
        message.success('创建成功')
      }
      onSuccess(); onClose()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.toString() || '保存失败')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={supplierId ? '编辑供应商' : '新增供应商'} open={open} onCancel={onClose}
      onOk={handleSave} confirmLoading={loading} width={560} okText="保存" cancelText="取消" destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="供应商名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="供应商名称" />
        </Form.Item>
        <Form.Item label="联系人" name="contact_person"><Input placeholder="联系人" /></Form.Item>
        <Form.Item label="联系电话" name="contact_phone"><Input placeholder="联系电话" /></Form.Item>
        <Form.Item label="地址" name="address"><Input placeholder="供应商地址" /></Form.Item>
        <Form.Item label="主营类目" name="main_categories" extra="JSON格式，如 [&quot;青茶&quot;,&quot;红茶&quot;]">
          <Input placeholder='["青茶","红茶"]' />
        </Form.Item>
        <Form.Item label="备注" name="remark"><Input.TextArea rows={2} placeholder="备注" /></Form.Item>
      </Form>
    </Modal>
  )
}
