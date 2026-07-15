/** @file 库存管理页 - V2 Phase 1 占位页面 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Card, Tag, message, Space } from 'antd'
import { invoke } from '@tauri-apps/api/core'

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const token = localStorage.getItem('token') || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoke<any>('get_inventory', { token, page, pageSize: 20, keyword })
      setItems(res.list || []); setTotal(res.total || 0)
    } catch (e: any) { message.error(e?.toString() || '加载失败') }
    finally { setLoading(false) }
  }, [page, keyword, token])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="p-4">
      <Card title="库存管理" extra={<Input.Search placeholder="搜索商品名称" style={{ width: 250 }}
        onChange={e => setKeyword(e.target.value)} onSearch={loadData} allowClear />}>
        <Table loading={loading} dataSource={items} rowKey="product_id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
          columns={[
            { title: '商品名称', dataIndex: 'product_name', width: 200 },
            { title: '分类', dataIndex: 'category_name', width: 120 },
            { title: '类型', dataIndex: 'product_type', width: 80,
              render: (v: string) => <Tag color={v === 'weight' ? 'green' : 'blue'}>{v === 'weight' ? '称重' : '计件'}</Tag> },
            { title: '库存显示', dataIndex: 'display_stock', width: 150 },
          ]}
        />
      </Card>
    </div>
  )
}
