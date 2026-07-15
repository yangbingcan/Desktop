/** @file 茶易管V2 首页仪表盘 - 今日经营概览 + 快捷入口 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, Button, message, Spin } from 'antd'
import {
  ShoppingCartOutlined, DollarOutlined, AlertOutlined, TeamOutlined,
  ShopOutlined, InboxOutlined, BarcodeOutlined, PrinterOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../stores/authStore'

interface DashboardStats {
  todayOrders: number
  todaySales: number
  lowStockCount: number
  newMembers: number
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<DashboardStats>({ todayOrders: 0, todaySales: 0, lowStockCount: 0, newMembers: 0 })
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('token') || ''

  const loadData = useCallback(async () => {
    try {
      const res = await invoke<DashboardStats>('get_dashboard_stats', { token })
      setStats(res)
    } catch (e: any) {
      message.error(e?.toString() || '加载仪表盘数据失败')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  const hour = new Date().getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  const quickActions = [
    { label: '收银开单', icon: <ShoppingCartOutlined />, color: '#2563EB', path: '/sales' },
    { label: '商品档案', icon: <ShopOutlined />, color: '#8B5CF6', path: '/products' },
    { label: '库存管理', icon: <InboxOutlined />, color: '#10B981', path: '/inventory' },
    { label: '会员管理', icon: <TeamOutlined />, color: '#F59E0B', path: '/members' },
    { label: '条码打印', icon: <BarcodeOutlined />, color: '#EF4444', path: '/barcodes' },
    { label: '打印模板', icon: <PrinterOutlined />, color: '#6366F1', path: '/print-templates' },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6 flex items-center justify-between relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 50%, #2DD4BF 100%)', boxShadow: '0 12px 36px rgba(13, 148, 136, 0.25)' }}>
        <div className="relative z-10">
          <h1 className="text-white text-2xl font-bold mb-1">
            {greeting}，{user?.real_name || user?.username || '管理员'}！
          </h1>
          <p className="text-white/80 text-sm">欢迎使用茶易管V2 - 茶叶店智能管理系统</p>
        </div>
        <div className="text-white/60 text-6xl font-bold relative z-10">茶</div>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card hoverable>
              <Statistic title="今日订单" value={stats.todayOrders}
                prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#2563EB' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card hoverable>
              <Statistic title="今日销售额" value={stats.todaySales} prefix={<DollarOutlined />}
                precision={2} valueStyle={{ color: '#10B981' }} suffix="元" />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card hoverable>
              <Statistic title="低库存预警" value={stats.lowStockCount}
                prefix={<AlertOutlined />} valueStyle={{ color: '#EF4444' }} suffix="种" />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card hoverable>
              <Statistic title="今日新增会员" value={stats.newMembers}
                prefix={<TeamOutlined />} valueStyle={{ color: '#8B5CF6' }} suffix="人" />
            </Card>
          </Col>
        </Row>
      </Spin>

      <Card title="快捷操作">
        <Row gutter={[16, 16]}>
          {quickActions.map((action) => (
            <Col xs={8} sm={4} key={action.path}>
              <Button block size="large" style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                icon={<span style={{ fontSize: 24, color: action.color }}>{action.icon}</span>}
                onClick={() => navigate(action.path)}>
                <span style={{ fontSize: 13, marginTop: 8 }}>{action.label}</span>
              </Button>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  )
}
