/** @file 商品新增/编辑弹窗 - 多单位 + 分类选择 + 茶叶属性 */
import { useState, useEffect, useCallback } from 'react'
import { Modal, Form, Input, Select, Button, Space, InputNumber, Radio, Divider, message } from 'antd'
import { PlusOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { createProduct, updateProduct, getProduct, getCategories, type CreateProductInput, type UnitInput, type Category } from '../../../services/productService'

interface Props {
  open: boolean
  productId?: string | null
  onClose: () => void
  onSuccess: () => void
}

const FERMENTATION_OPTIONS = [
  { label: '不发酵', value: '不发酵' },
  { label: '微发酵', value: '微发酵' },
  { label: '轻发酵', value: '轻发酵' },
  { label: '半发酵', value: '半发酵' },
  { label: '全发酵', value: '全发酵' },
  { label: '后发酵', value: '后发酵' },
]

const ROAST_OPTIONS = [
  { label: '轻焙火', value: '轻焙火' },
  { label: '中焙火', value: '中焙火' },
  { label: '重焙火', value: '重焙火' },
  { label: '足焙火', value: '足焙火' },
]

export default function ProductForm({ open, productId, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<UnitInput[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const cats = await getCategories()
      setCategories(cats || [])
    } catch (e: any) {
      message.error(e?.toString() || '加载分类失败')
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadData()
      if (productId) {
        loadProduct(productId)
      } else {
        form.resetFields()
        form.setFieldsValue({ product_type: 'weight', base_unit: 'g' })
        setUnits([{ name: '克', conversion_to_base: 1, retail_price: 0, member_price: 0 }])
      }
    }
  }, [open, productId])

  const loadProduct = async (id: string) => {
    try {
      const res = await getProduct(id)
      const p = res.product
      form.setFieldsValue({
        name: p.name, code: p.code, category_id: p.category_id,
        product_type: p.product_type, base_unit: p.base_unit,
        origin: p.origin, year: p.year, grade: p.grade,
        fermentation_level: p.fermentation_level, roast_level: p.roast_level,
      })
      setUnits(res.units?.map((u: any) => ({
        id: u.id, name: u.name, conversion_to_base: u.conversion_to_base,
        retail_price: u.retail_price, member_price: u.member_price,
      })) || [])
    } catch (e: any) {
      message.error(e?.toString() || '加载商品失败')
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const input: CreateProductInput = {
        ...values,
        units: units.filter(u => u.name && u.conversion_to_base > 0),
      }
      if (productId) {
        await updateProduct(productId, input)
        message.success('更新成功')
      } else {
        await createProduct(input)
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

  const addUnit = () => {
    setUnits([...units, { name: '', conversion_to_base: 1, retail_price: 0, member_price: 0 }])
  }

  const removeUnit = (idx: number) => {
    setUnits(units.filter((_, i) => i !== idx))
  }

  const updateUnit = (idx: number, field: keyof UnitInput, value: any) => {
    const newUnits = [...units]
    ;(newUnits[idx] as any)[field] = value
    setUnits(newUnits)
  }

  // 构建分类树形选项
  const categoryOptions = () => {
    const level1 = categories.filter(c => c.level === 1)
    return level1.map(l1 => ({
      label: l1.name,
      value: l1.id,
      children: categories.filter(c => c.parent_id === l1.id).map(l2 => ({
        label: l2.name, value: l2.id,
      })),
    }))
  }

  return (
    <Modal
      title={productId ? '编辑商品' : '新增商品'}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={loading}
      width={720}
      okText="保存"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="商品名称" name="name" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="如：牛栏坑肉桂" />
          </Form.Item>
          <Form.Item label="商品编码" name="code" extra="留空自动生成">
            <Input placeholder="如：SP20260715001" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item label="商品分类" name="category_id">
            <CascaderWrapper options={categoryOptions()} placeholder="选择分类" />
          </Form.Item>
          <Form.Item label="商品类型" name="product_type" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="weight">称重类</Radio.Button>
              <Radio.Button value="count">计件类</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="基准单位" name="base_unit" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="g">克 (g)</Select.Option>
              <Select.Option value="pcs">个 (pcs)</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item label="产地" name="origin"><Input placeholder="如：福建武夷山" /></Form.Item>
          <Form.Item label="年份" name="year"><Input placeholder="如：2024" /></Form.Item>
          <Form.Item label="等级" name="grade"><Input placeholder="如：特级" /></Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="发酵程度" name="fermentation_level">
            <Select allowClear placeholder="选择发酵程度" options={FERMENTATION_OPTIONS} />
          </Form.Item>
          <Form.Item label="焙火程度" name="roast_level">
            <Select allowClear placeholder="选择焙火程度" options={ROAST_OPTIONS} />
          </Form.Item>
        </div>

        <Divider>销售单位与定价</Divider>

        <div style={{ marginBottom: 12 }}>
          {units.map((unit, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '100px 100px 120px 120px 32px', gap: 8, marginBottom: 8 }}>
              <Input placeholder="单位名" value={unit.name}
                onChange={e => updateUnit(idx, 'name', e.target.value)} />
              <InputNumber placeholder="换算比" value={unit.conversion_to_base} min={1}
                onChange={v => updateUnit(idx, 'conversion_to_base', v || 1)} style={{ width: '100%' }} />
              <InputNumber placeholder="零售价" value={unit.retail_price} min={0} step={0.01}
                onChange={v => updateUnit(idx, 'retail_price', v || 0)} style={{ width: '100%' }}
                formatter={v => `¥${v}`} parser={v => v?.replace('¥', '') as any} />
              <InputNumber placeholder="会员价" value={unit.member_price} min={0} step={0.01}
                onChange={v => updateUnit(idx, 'member_price', v || 0)} style={{ width: '100%' }}
                formatter={v => `¥${v}`} parser={v => v?.replace('¥', '') as any} />
              <Button danger icon={<MinusCircleOutlined />} onClick={() => removeUnit(idx)} disabled={units.length <= 1} />
            </div>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={addUnit} block>
            添加单位
          </Button>
        </div>
      </Form>
    </Modal>
  )
}

/** 级联选择器包装组件 */
function CascaderWrapper({ options, placeholder }: { options: any[]; placeholder: string }) {
  return <Select options={options} placeholder={placeholder} allowClear />
}
