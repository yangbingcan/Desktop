/** @file 采购入库列表页 - V2 Phase 1 占位页面 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Card, Tag, Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'

export default function PurchaseListPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
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
      <Card title="采购入库" extra={<Button type="primary" icon={<PlusOutlined />}>新增采购单</Button>}>
        <Table loading={loading} dataSource={orders} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
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
    </div>
  )
}
