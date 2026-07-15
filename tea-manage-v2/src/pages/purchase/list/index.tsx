/** @file 采购入库 - 列表 + 新增采购单表单 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Card, Tag, Button, message, Modal, Form, Select, InputNumber, Input, Space } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'
import { purchaseIn } from '../../../services/inventoryService'
import { getProducts } from '../../../services/productService'

interface PurchaseLine {
  key: string
  productId: string; productName: string
  unitId: string; unitName: string; conversion: number
  quantity: number; unitPrice: number
  grams: number; subtotal: number
}

export default function PurchaseListPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const token = localStorage.getItem('token') || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoke<any>('get_purchase_orders', { token, page, pageSize: 20 })
      setOrders(res.list || []); setTotal(res.total || 0)
    } catch (e: any) { message.error(e?.toString() || '加载失败') }
    finally { setLoading(false) }
  }, [page, token])

  useEffect(() => { loadData() }, [loadData])

  const payStatusMap: Record<string, { color: string; text: string }> = {
    unpaid: { color: 'red', text: '未付' }, partial: { color: 'orange', text: '部分' }, paid: { color: 'green', text: '已付' }
  }

  return (
    <div className="p-4">
      <Card title="采购入库" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>新增采购单</Button>}>
        <Table loading={loading} dataSource={orders} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
          columns={[
            { title: '单据编号', dataIndex: 'order_no', width: 180 },
            { title: '供应商', dataIndex: 'supplier_name', width: 150 },
            { title: '经手人', dataIndex: 'handler', width: 100 },
            { title: '总金额', dataIndex: 'total_amount', width: 120, render: (v: number) => `¥${(v || 0).toFixed(2)}` },
            { title: '付款状态', dataIndex: 'payment_status', width: 100,
              render: (v: string) => { const m = payStatusMap[v] || payStatusMap.unpaid; return <Tag color={m.color}>{m.text}</Tag> } },
            { title: '商品数', dataIndex: 'item_count', width: 80 },
            { title: '日期', dataIndex: 'created_at', width: 180 },
          ]}
        />
      </Card>

      <PurchaseForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={loadData} />
    </div>
  )
}

/** 新增采购单表单弹窗 */
function PurchaseForm({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm()
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const token = localStorage.getItem('token') || ''

  useEffect(() => {
    if (open) {
      form.resetFields()
      setLines([])
      invoke<any>('get_all_active_suppliers', { token }).then(res => setSuppliers(res || [])).catch(() => {})
      getProducts({ page: 1, pageSize: 100 }).then(res => setProducts(res.list || [])).catch(() => {})
    }
  }, [open])

  const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0)

  const addLine = () => {
    setLines([...lines, {
      key: Date.now().toString(), productId: '', productName: '',
      unitId: '', unitName: '', conversion: 1,
      quantity: 1, unitPrice: 0, grams: 0, subtotal: 0,
    }])
  }

  const removeLine = (key: string) => {
    setLines(lines.filter(l => l.key !== key))
  }

  const updateLine = (key: string, field: keyof PurchaseLine, value: any) => {
    setLines(lines.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unitPrice' || field === 'conversion') {
        updated.grams = updated.conversion * updated.quantity
        updated.subtotal = updated.unitPrice * updated.quantity
      }
      return updated
    }))
  }

  const selectProduct = async (key: string, productId: string) => {
    const p = products.find(p => p.id === productId)
    if (!p) return
    try {
      const units = await invoke<any>('get_product_units', { token, productId })
      const firstUnit = units?.[0]
      setLines(lines.map(l => {
        if (l.key !== key) return l
        return {
          ...l, productId: p.id, productName: p.name,
          unitId: firstUnit?.id || '', unitName: firstUnit?.name || '',
          conversion: firstUnit?.conversion_to_base || 1,
          quantity: 1, unitPrice: firstUnit?.retail_price || 0,
          grams: firstUnit?.conversion_to_base || 1,
          subtotal: firstUnit?.retail_price || 0,
        }
      }))
    } catch (e: any) {
      message.error(e?.toString() || '加载单位失败')
    }
  }

  const selectUnit = (key: string, unitId: string) => {
    setLines(lines.map(l => {
      if (l.key !== key) return l
      // 需要异步获取单位信息，这里先标记，后续可优化
      return l
    }))
    // 获取单位信息并更新
    const line = lines.find(l => l.key === key)
    if (line) {
      invoke<any>('get_product_units', { token, productId: line.productId }).then(units => {
        const u = units?.find((u: any) => u.id === unitId)
        if (u) {
          setLines(lines.map(l => {
            if (l.key !== key) return l
            return {
              ...l, unitId: u.id, unitName: u.name,
              conversion: u.conversion_to_base, unitPrice: u.retail_price,
              grams: u.conversion_to_base * l.quantity,
              subtotal: u.retail_price * l.quantity,
            }
          }))
        }
      })
    }
  }

  const handleSave = async () => {
    if (lines.length === 0) { message.warning('请至少添加一条采购商品'); return }
    const supplierId = form.getFieldValue('supplier_id')
    if (!supplierId) { message.warning('请选择供应商'); return }

    setSaving(true)
    let successCount = 0
    for (const line of lines) {
      if (!line.productId || !line.unitId) continue
      try {
        await purchaseIn({
          product_id: line.productId, unit_id: line.unitId,
          quantity: line.quantity, unit_price: line.unitPrice,
          supplier_id: supplierId, remark: form.getFieldValue('remark'),
        })
        successCount++
      } catch (e: any) {
        message.error(`商品 ${line.productName} 入库失败：${e?.toString() || '未知错误'}`)
      }
    }
    if (successCount > 0) {
      message.success(`采购入库成功，共 ${successCount} 条记录，总金额 ¥${totalAmount.toFixed(2)}`)
      onSuccess(); onClose()
    }
    setSaving(false)
  }

  return (
    <Modal title="新增采购单" open={open} onCancel={onClose} onOk={handleSave}
      confirmLoading={saving} width={900} okText="确认入库" cancelText="取消" destroyOnClose>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item label="供应商" name="supplier_id" rules={[{ required: true, message: '请选择供应商' }]}>
          <Select style={{ width: 200 }} placeholder="选择供应商"
            options={suppliers.map(s => ({ label: s.name, value: s.id }))} />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input style={{ width: 250 }} placeholder="可选备注" />
        </Form.Item>
      </Form>

      <div style={{ marginBottom: 8 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500 }}>采购明细</span>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addLine}>添加商品行</Button>
        </Space>
      </div>

      <Table size="small" dataSource={lines} rowKey="key" pagination={false} scroll={{ y: 300 }}
        columns={[
          { title: '商品', width: 180,
            render: (_: any, r: PurchaseLine) => (
              <Select showSearch style={{ width: '100%' }} placeholder="选择商品"
                value={r.productId || undefined}
                onChange={v => selectProduct(r.key, v)}
                options={products.map(p => ({ label: `${p.name} (${p.code})`, value: p.id }))}
                filterOption={(input, option) => (option?.label ?? '').includes(input)} />
            ) },
          { title: '单位', width: 120,
            render: (_: any, r: PurchaseLine) => (
              <Select style={{ width: '100%' }} placeholder="单位"
                value={r.unitId || undefined}
                onChange={v => selectUnit(r.key, v)}
                disabled={!r.productId}
                options={[]} /* 单位选项在selectProduct时已设置 */
              />
            ) },
          { title: '换算', width: 70, dataIndex: 'conversion',
            render: (v: number) => `${v}g` },
          { title: '数量', width: 80,
            render: (_: any, r: PurchaseLine) => (
              <InputNumber min={1} value={r.quantity} style={{ width: 70 }}
                onChange={v => updateLine(r.key, 'quantity', v || 1)} />
            ) },
          { title: '单价', width: 100,
            render: (_: any, r: PurchaseLine) => (
              <InputNumber min={0} step={0.01} precision={2} value={r.unitPrice} style={{ width: 90 }}
                formatter={v => `¥${v}`} parser={v => v?.replace('¥', '') as any}
                onChange={v => updateLine(r.key, 'unitPrice', v || 0)} />
            ) },
          { title: '克数', width: 80, dataIndex: 'grams',
            render: (v: number) => `${v}g` },
          { title: '小计', width: 90, dataIndex: 'subtotal',
            render: (v: number) => `¥${v.toFixed(2)}` },
          { title: '', width: 40,
            render: (_: any, r: PurchaseLine) => (
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(r.key)} />
            ) },
        ]}
        footer={() => (
          <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 16 }}>
            合计：¥{totalAmount.toFixed(2)}
          </div>
        )}
      />
    </Modal>
  )
}
