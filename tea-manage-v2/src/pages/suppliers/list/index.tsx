/** @file 供应商列表页 - V2 Phase 1 占位页面 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Card, Tag, Button, Space, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'

export default function SupplierListPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const token = localStorage.getItem('token') || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoke<any>('get_suppliers', { token, page, pageSize: 20, keyword })
      setSuppliers(res.list || []); setTotal(res.total || 0)
    } catch (e: any) { message.error(e?.toString() || '加载失败') }
    finally { setLoading(false) }
  }, [page, keyword, token])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="p-4">
      <Card title="供应商管理" extra={
        <Space>
          <Input.Search placeholder="搜索供应商" style={{ width: 250 }}
            onChange={e => setKeyword(e.target.value)} onSearch={loadData} allowClear />
          <Button type="primary" icon={<PlusOutlined />}>新增供应商</Button>
        </Space>
      }>
        <Table loading={loading} dataSource={suppliers} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
          columns={[
            { title: '供应商名称', dataIndex: 'name', width: 200 },
            { title: '联系人', dataIndex: 'contact_person', width: 100 },
            { title: '电话', dataIndex: 'contact_phone', width: 130 },
            { title: '地址', dataIndex: 'address', width: 200 },
            { title: '状态', dataIndex: 'is_active', width: 80,
              render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '停用'}</Tag> },
          ]}
        />
      </Card>
    </div>
  )
}
