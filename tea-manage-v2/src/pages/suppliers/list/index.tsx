/** @file 供应商列表页 - CRUD */
import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Card, Tag, Button, Space, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { getSuppliers, deleteSupplier, type Supplier } from '../../../services/supplierService'
import SupplierForm from './SupplierForm'

export default function SupplierListPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSuppliers({ page, pageSize: 20, keyword })
      setSuppliers(res.list || []); setTotal(res.total || 0)
    } catch (e: any) { message.error(e?.toString() || '加载失败') }
    finally { setLoading(false) }
  }, [page, keyword])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="p-4">
      <Card title="供应商管理" extra={
        <Space>
          <Input.Search placeholder="搜索供应商" style={{ width: 250 }}
            onChange={e => setKeyword(e.target.value)} onSearch={loadData} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditId(null); setFormOpen(true) }}>新增供应商</Button>
        </Space>
      }>
        <Table loading={loading} dataSource={suppliers} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
          columns={[
            { title: '供应商名称', dataIndex: 'name', width: 200 },
            { title: '联系人', dataIndex: 'contact_person', width: 100 },
            { title: '电话', dataIndex: 'contact_phone', width: 130 },
            { title: '地址', dataIndex: 'address', width: 200 },
            { title: '状态', dataIndex: 'is_active', width: 80,
              render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '停用'}</Tag> },
            { title: '操作', width: 150,
              render: (_: any, r: Supplier) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => { setEditId(r.id); setFormOpen(true) }}>编辑</Button>
                  <Popconfirm title="确定删除？" onConfirm={async () => { try { await deleteSupplier(r.id); message.success('删除成功'); loadData() } catch (e: any) { message.error(e?.toString() || '删除失败') } }}>
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>
      <SupplierForm open={formOpen} supplierId={editId} onClose={() => setFormOpen(false)} onSuccess={loadData} />
    </div>
  )
}
