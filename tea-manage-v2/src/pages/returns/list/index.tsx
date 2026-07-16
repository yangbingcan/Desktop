/** @file 退货管理列表页 - V2 Phase 1 占位页面 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Card, Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../../stores/authStore'

export default function ReturnListPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const token = useAuthStore.getState().token || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoke<any>('get_return_orders', { token, page, pageSize: 20 })
      setOrders(res.list || []); setTotal(res.total || 0)
    } catch (e: any) { message.error(e?.toString() || '加载失败') }
    finally { setLoading(false) }
  }, [page, token])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="p-4">
      <Card title="退货出库" extra={<Button type="primary" icon={<PlusOutlined />}>新增退货单</Button>}>
        <Table loading={loading} dataSource={orders} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
          columns={[
            { title: '单据编号', dataIndex: 'order_no', width: 180 },
            { title: '供应商', dataIndex: 'supplier_name', width: 150 },
            { title: '退货日期', dataIndex: 'return_date', width: 120 },
            { title: '退货原因', dataIndex: 'return_reason', width: 120 },
            { title: '总金额', dataIndex: 'total_amount', width: 120, render: (v: number) => `¥${(v || 0).toFixed(2)}` },
            { title: '商品数', dataIndex: 'item_count', width: 80 },
          ]}
        />
      </Card>
    </div>
  )
}

