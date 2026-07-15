/** @file 打印模板管理 - 模板列表 + 编辑器 + 实时预览 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Table, Tag, Space, Modal, Input, Select, message, Popconfirm, Row, Col, Divider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons'
import {
  getPrintTemplates, savePrintTemplate, deletePrintTemplate,
  type PrintTemplate, TEMPLATE_VARIABLES, DEFAULT_RECEIPT_TEMPLATE
} from '../../services/printTemplateService'

const { TextArea } = Input

const TEMPLATE_TYPES = [
  { label: '零售小票', value: 'receipt' },
  { label: '采购入库单', value: 'purchase' },
  { label: '报损出库单', value: 'damage' },
  { label: '退货单', value: 'return' },
]

export default function PrintTemplatePage() {
  const [templates, setTemplates] = useState<PrintTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [templateType, setTemplateType] = useState('receipt')
  const [content, setContent] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getPrintTemplates()
      setTemplates(list || [])
    } catch (e: any) {
      message.error(e?.toString() || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAdd = () => {
    setEditId(null)
    setName('')
    setTemplateType('receipt')
    setContent(DEFAULT_RECEIPT_TEMPLATE)
    setIsDefault(false)
    setEditorOpen(true)
    setPreviewKey(k => k + 1)
  }

  const handleEdit = (record: PrintTemplate) => {
    setEditId(record.id)
    setName(record.name)
    setTemplateType(record.template_type)
    setContent(record.content)
    setIsDefault(record.is_default)
    setEditorOpen(true)
    setPreviewKey(k => k + 1)
  }

  const handleSave = async () => {
    if (!name.trim()) { message.warning('请输入模板名称'); return }
    if (!content.trim()) { message.warning('模板内容不能为空'); return }
    try {
      await savePrintTemplate({ name, template_type: templateType, content, is_default: isDefault })
      message.success(editId ? '更新成功' : '创建成功')
      setEditorOpen(false)
      loadData()
    } catch (e: any) {
      message.error(e?.toString() || '保存失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePrintTemplate(id)
      message.success('删除成功')
      loadData()
    } catch (e: any) {
      message.error(e?.toString() || '删除失败')
    }
  }

  const insertVariable = (varKey: string) => {
    setContent(content + varKey)
    setPreviewKey(k => k + 1)
  }

  // 生成预览HTML
  const previewHtml = content
    .replace(/{{shopName}}/g, '茗香茶叶店')
    .replace(/{{shopAddress}}/g, '杭州市西湖区龙井路88号')
    .replace(/{{shopPhone}}/g, '138-0571-8888')
    .replace(/{{orderNo}}/g, 'XS20260715001')
    .replace(/{{date}}/g, '2026-07-15 14:30')
    .replace(/{{items}}/g, '<tr><td>铁观音(50g)</td><td style="text-align:center;">2</td><td style="text-align:right;">¥80.00</td></tr><tr><td>牛栏坑肉桂(罐)</td><td style="text-align:center;">1</td><td style="text-align:right;">¥380.00</td></tr>')
    .replace(/{{total}}/g, '¥460.00')
    .replace(/{{discount}}/g, '¥0.00')
    .replace(/{{actualAmount}}/g, '¥460.00')
    .replace(/{{memberName}}/g, '张先生')
    .replace(/{{pointsEarned}}/g, '460')
    .replace(/{{payMethod}}/g, '微信支付')
    .replace(/{{operator}}/g, '管理员')
    .replace(/{{supplierName}}/g, '福建茶业')
    .replace(/{{remark}}/g, '')

  return (
    <div className="p-4">
      <Card title={<><PrinterOutlined /> 打印模板设计器</>} extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建模板</Button>
      }>
        <Table loading={loading} dataSource={templates} rowKey="id"
          pagination={false}
          columns={[
            { title: '模板名称', dataIndex: 'name', width: 200 },
            { title: '类型', dataIndex: 'template_type', width: 120,
              render: (v: string) => <Tag color="blue">{TEMPLATE_TYPES.find(t => t.value === v)?.label || v}</Tag> },
            { title: '默认', dataIndex: 'is_default', width: 80,
              render: (v: boolean) => v ? <Tag color="green">默认</Tag> : '-' },
            { title: '更新时间', dataIndex: 'updated_at', width: 180 },
            { title: '操作', width: 200,
              render: (_: any, r: PrintTemplate) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
                  <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} disabled={r.is_default}>
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={r.is_default}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 模板编辑器弹窗 */}
      <Modal title={editId ? '编辑模板' : '新建模板'} open={editorOpen} onCancel={() => setEditorOpen(false)}
        onOk={handleSave} width={1100} okText="保存" cancelText="取消" destroyOnClose
        footer={null}>
        <Row gutter={16}>
          {/* 左侧：编辑区 */}
          <Col span={14}>
            <Card size="small" title="模板编辑" extra={
              <Space>
                <Select size="small" value={templateType} onChange={setTemplateType}
                  options={TEMPLATE_TYPES} style={{ width: 140 }} />
                <label><input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} /> 设为默认</label>
              </Space>
            }>
              <Input placeholder="模板名称" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 8 }} />
              <TextArea value={content} onChange={e => { setContent(e.target.value); setPreviewKey(k => k + 1) }}
                rows={20} style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </Card>
          </Col>

          {/* 右侧：预览和变量 */}
          <Col span={10}>
            <Card size="small" title="实时预览" extra={<Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewKey(k => k + 1)}>刷新</Button>}
              bodyStyle={{ background: '#f5f5f5', padding: 8 }}>
              <div key={previewKey} style={{ background: '#fff', padding: 8, minHeight: 400, overflow: 'auto' }}
                dangerouslySetInnerHTML={{ __html: previewHtml || '<div style="color:#999;text-align:center;padding:40px;">预览区域</div>' }} />
            </Card>
            <Card size="small" title="可用变量" style={{ marginTop: 8 }}>
              <Space wrap size="small">
                {TEMPLATE_VARIABLES.map(v => (
                  <Button key={v.key} size="small" type="dashed" onClick={() => insertVariable(v.key)}>
                    {v.label}
                  </Button>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
        <Divider />
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setEditorOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSave}>保存模板</Button>
          </Space>
        </div>
      </Modal>
    </div>
  )
}
