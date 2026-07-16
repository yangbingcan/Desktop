/** @file 报表分析 - 销售统计 + 库存分析 + 会员消费 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, DatePicker, message, Empty, Spin } from 'antd'
import { DollarOutlined, ShoppingCartOutlined, TeamOutlined, InboxOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function ReportPage() {
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [salesData, setSalesData] = useState<any[]>([])
  const [stats, setStats] = useState({ totalSales: 0, totalOrders: 0, totalMembers: 0, lowStock: 0 })

  const token = useAuthStore.getState().token || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD 00:00:00')
      const endDate = dateRange[1].format('YYYY-MM-DD 23:59:59')
      const res = await invoke<any>('get_sale_orders', { token, page: 1, pageSize: 100, startDate, endDate })
      const orders = res.list || []
      setSalesData(orders)

      const totalSales = orders.reduce((sum: number, o: any) => sum + (o.actual_amount || 0), 0)
      const totalOrders = orders.length
      const totalMembers = new Set(orders.map((o: any) => o.member_id).filter(Boolean)).size

      const dashRes = await invoke<any>('get_dashboard_stats', { token })
      setStats({ totalSales, totalOrders, totalMembers, lowStock: dashRes.lowStockCount || 0 })
    } catch (e: any) {
      message.error(e?.toString() || '加载报表失败')
    } finally {
      setLoading(false)
    }
  }, [dateRange, token])

  useEffect(() => { loadData() }, [loadData])

  // 按商品汇总销售
  const productSummary = () => {
    const map = new Map<string, { name: string; count: number; amount: number }>()
    salesData.forEach((o: any) => {
      const name = o.member_name || '散客'
      const existing = map.get(name) || { name, count: 0, amount: 0 }
      existing.count += 1
      existing.amount += o.actual_amount || 0
      map.set(name, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }

  const memberStats = productSummary()

  return (
    <div className="p-4 space-y-4">
      <Card title="报表分析" extra={
        <RangePicker value={dateRange} onChange={(dates) => {
          if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]])
        }} />
      }>
        <Spin spinning={loading}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Card hoverable size="small">
                <Statistic title="总销售额" value={stats.totalSales} precision={2}
                  prefix={<DollarOutlined />} suffix="元" valueStyle={{ color: '#10B981' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card hoverable size="small">
                <Statistic title="订单数" value={stats.totalOrders}
                  prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#2563EB' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card hoverable size="small">
                <Statistic title="消费会员数" value={stats.totalMembers}
                  prefix={<TeamOutlined />} valueStyle={{ color: '#8B5CF6' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card hoverable size="small">
                <Statistic title="低库存预警" value={stats.lowStock}
                  prefix={<InboxOutlined />} suffix="种" valueStyle={{ color: '#EF4444' }} />
              </Card>
            </Col>
          </Row>
        </Spin>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="销售订单明细" size="small">
            <Table dataSource={salesData} rowKey="id" size="small" scroll={{ y: 400 }}
              pagination={{ pageSize: 15, showSizeChanger: false }}
              columns={[
                { title: '单据编号', dataIndex: 'order_no', width: 160 },
                { title: '会员', dataIndex: 'member_name', width: 100,
                  render: (v: string) => v || <Tag>散客</Tag> },
                { title: '金额', dataIndex: 'actual_amount', width: 100,
                  render: (v: number) => `¥${(v || 0).toFixed(2)}` },
                { title: '支付', dataIndex: 'pay_method', width: 80,
                  render: (v: string) => {
                    const map: Record<string, string> = { cash: '现金', wechat: '微信', alipay: '支付宝', memberBalance: '余额' }
                    return <Tag>{map[v] || v || '-'}</Tag>
                  } },
                { title: '日期', dataIndex: 'created_at', width: 160 },
              ]}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="会员消费排行" size="small">
            {memberStats.length === 0 ? <Empty description="暂无数据" /> : (
              <Table dataSource={memberStats} rowKey="name" size="small"
                pagination={false} scroll={{ y: 400 }}
                columns={[
                  { title: '会员', dataIndex: 'name', width: 100 },
                  { title: '订单数', dataIndex: 'count', width: 80 },
                  { title: '消费额', dataIndex: 'amount', width: 100,
                    render: (v: number) => `¥${v.toFixed(2)}` },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

