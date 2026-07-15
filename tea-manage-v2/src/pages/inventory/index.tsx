/** @file 库存管理 - 列表 + 批次详情 + 入库/报损/盘点弹窗 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Card, Tag, Button, Space, message, Modal, InputNumber, Form, Select, Drawer, Descriptions, Tabs } from 'antd'
import { PlusOutlined, MinusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'
import { getInventory, getInventoryDetail, purchaseIn, damageOut, adjustStock, type InventoryItem } from '../../services/inventoryService'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)
  const [stockInOpen, setStockInOpen] = useState(false)
  const [damageOpen, setDamageOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<InventoryItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getInventory({ page, pageSize: 20, keyword })
      setItems(res.list || []); setTotal(res.total || 0)
    } catch (e: any) { message.error(e?.toString() || '加载失败') }
    finally { setLoading(false) }
  }, [page, keyword])

  useEffect(() => { loadData() }, [loadData])

  const showDetail = async (record: InventoryItem) => {
    try {
      const res = await getInventoryDetail(record.product_id)
      setDetailData(res)
      setDetailOpen(true)
    } catch (e: any) {
      message.error(e?.toString() || '加载详情失败')
    }
  }

  const showStockIn = (record: InventoryItem) => {
    setCurrentProduct(record); setStockInOpen(true)
  }

  const showDamage = (record: InventoryItem) => {
    setCurrentProduct(record); setDamageOpen(true)
  }

  const showAdjust = (record: InventoryItem) => {
    setCurrentProduct(record); setAdjustOpen(true)
  }

  return (
    <div className="p-4">
      <Card title="库存管理" extra={
        <Input.Search placeholder="搜索商品名称" style={{ width: 250 }}
          onChange={e => setKeyword(e.target.value)} onSearch={loadData} allowClear />
      }>
        <Table loading={loading} dataSource={items} rowKey="product_id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
          columns={[
            { title: '商品名称', dataIndex: 'product_name', width: 200 },
            { title: '分类', dataIndex: 'category_name', width: 120 },
            { title: '类型', dataIndex: 'product_type', width: 80,
              render: (v: string) => <Tag color={v === 'weight' ? 'green' : 'blue'}>{v === 'weight' ? '称重' : '计件'}</Tag> },
            { title: '库存', dataIndex: 'display_stock', width: 150 },
            { title: '操作', width: 280,
              render: (_: any, r: InventoryItem) => (
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)}>详情</Button>
                  <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => showStockIn(r)}>入库</Button>
                  <Button size="small" danger ghost icon={<MinusOutlined />} onClick={() => showDamage(r)}>报损</Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => showAdjust(r)}>盘点</Button>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 库存详情抽屉 */}
      <Drawer title="库存详情" open={detailOpen} onClose={() => setDetailOpen(false)} width={600}>
        {detailData && (
          <Tabs items={[
            { key: 'info', label: '基本信息', children: (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="商品名称">{detailData.productName}</Descriptions.Item>
                <Descriptions.Item label="商品类型">{detailData.productType === 'weight' ? '称重类' : '计件类'}</Descriptions.Item>
                <Descriptions.Item label="库存(克)">{detailData.stockGrams}g</Descriptions.Item>
                <Descriptions.Item label="库存(个)">{detailData.stockUnits}</Descriptions.Item>
              </Descriptions>
            )},
            { key: 'batches', label: '批次列表', children: (
              <Table size="small" dataSource={detailData.batches || []} rowKey="id" pagination={false}
                columns={[
                  { title: '批次号', dataIndex: 'batch_code', width: 150 },
                  { title: '进价', dataIndex: 'purchase_price', width: 80, render: (v: number) => `¥${v.toFixed(2)}` },
                  { title: '总量', dataIndex: 'total_grams', width: 80, render: (v: number) => `${v}g` },
                  { title: '剩余', dataIndex: 'remaining_grams', width: 80, render: (v: number) => `${v}g` },
                  { title: '入库日期', dataIndex: 'created_at', width: 150 },
                ]}
              />
            )},
            { key: 'flows', label: '库存流水', children: (
              <Table size="small" dataSource={detailData.recentFlows || []} rowKey="id" pagination={false}
                columns={[
                  { title: '类型', dataIndex: 'flow_type', width: 100,
                    render: (v: string) => { const map: Record<string,string> = { purchase_in: '采购入库', sale_out: '销售出库', damage_out: '报损', adjust_in: '盘盈', adjust_out: '盘亏', return_out: '退货出库' }; return <Tag>{map[v] || v}</Tag> } },
                  { title: '变更', dataIndex: 'change_grams', width: 80, render: (v: number) => `${v > 0 ? '+' : ''}${v}g` },
                  { title: '结余', dataIndex: 'balance_grams', width: 80, render: (v: number) => `${v}g` },
                  { title: '备注', dataIndex: 'remark', width: 120 },
                  { title: '时间', dataIndex: 'created_at', width: 150 },
                ]}
              />
            )},
          ]} />
        )}
      </Drawer>

      {/* 入库弹窗 */}
      <StockInModal open={stockInOpen} product={currentProduct} onClose={() => setStockInOpen(false)} onSuccess={loadData} />
      {/* 报损弹窗 */}
      <DamageModal open={damageOpen} product={currentProduct} onClose={() => setDamageOpen(false)} onSuccess={loadData} />
      {/* 盘点弹窗 */}
      <AdjustModal open={adjustOpen} product={currentProduct} onClose={() => setAdjustOpen(false)} onSuccess={loadData} />
    </div>
  )
}

/** 入库弹窗 */
function StockInModal({ open, product, onClose, onSuccess }: { open: boolean; product: InventoryItem | null; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [units, setUnits] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const token = localStorage.getItem('token') || ''

  useEffect(() => {
    if (open && product) {
      form.resetFields()
      // 加载商品的单位列表
      invoke<any>('get_product_units', { token, productId: product.product_id })
        .then(res => { setUnits(res || []); if (res?.[0]) form.setFieldsValue({ unit_id: res[0].id }) })
        .catch(() => setUnits([]))
      // 加载供应商列表
      invoke<any>('get_all_active_suppliers', { token })
        .then(res => setSuppliers(res || []))
        .catch(() => setSuppliers([]))
    }
  }, [open, product])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await purchaseIn({ ...values, product_id: product!.product_id })
      message.success('入库成功')
      onSuccess(); onClose()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.toString() || '入库失败')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={`入库 - ${product?.product_name || ''}`} open={open} onCancel={onClose}
      onOk={handleSave} confirmLoading={loading} width={520} okText="确认入库" cancelText="取消" destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="入库单位" name="unit_id" rules={[{ required: true, message: '请选择单位' }]}>
          <Select options={units.map(u => ({ label: `${u.name} (${u.conversion_to_base}g/单位)`, value: u.id }))} placeholder="选择单位" />
        </Form.Item>
        <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
          <InputNumber style={{ width: '100%' }} min={1} placeholder="入库数量" />
        </Form.Item>
        <Form.Item label="单价" name="unit_price" rules={[{ required: true, message: '请输入单价' }]}>
          <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={2}
            formatter={v => `¥${v}`} parser={v => v?.replace('¥', '') as any} />
        </Form.Item>
        <Form.Item label="供应商" name="supplier_id">
          <Select options={suppliers.map(s => ({ label: s.name, value: s.id }))} allowClear placeholder="选择供应商" />
        </Form.Item>
        <Form.Item label="备注" name="remark"><Input placeholder="可选备注" /></Form.Item>
      </Form>
    </Modal>
  )
}

/** 报损弹窗 */
function DamageModal({ open, product, onClose, onSuccess }: { open: boolean; product: InventoryItem | null; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) form.resetFields() }, [open])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await damageOut({ ...values, product_id: product!.product_id })
      message.success('报损成功')
      onSuccess(); onClose()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.toString() || '报损失败')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={`报损 - ${product?.product_name || ''}`} open={open} onCancel={onClose}
      onOk={handleSave} confirmLoading={loading} width={420} okText="确认报损" cancelText="取消" destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="报损克数" name="grams" rules={[{ required: true, message: '请输入克数' }]}>
          <InputNumber style={{ width: '100%' }} min={1} placeholder="报损克数" suffix="g" />
        </Form.Item>
        <Form.Item label="报损原因" name="remark" rules={[{ required: true, message: '请输入原因' }]}>
          <Input placeholder="如：受潮、过期、破损等" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** 盘点弹窗 */
function AdjustModal({ open, product, onClose, onSuccess }: { open: boolean; product: InventoryItem | null; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) form.resetFields() }, [open])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await adjustStock({ ...values, product_id: product!.product_id })
      message.success('盘点调整成功')
      onSuccess(); onClose()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.toString() || '调整失败')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={`盘点调整 - ${product?.product_name || ''}`} open={open} onCancel={onClose}
      onOk={handleSave} confirmLoading={loading} width={420} okText="确认调整" cancelText="取消" destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="调整克数" name="grams" rules={[{ required: true, message: '请输入克数' }]}
          extra="正数为盘盈(增加)，负数为盘亏(减少)">
          <InputNumber style={{ width: '100%' }} placeholder="如：+500 或 -300" suffix="g" />
        </Form.Item>
        <Form.Item label="调整原因" name="remark" rules={[{ required: true, message: '请输入原因' }]}>
          <Input placeholder="盘点差异原因" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
