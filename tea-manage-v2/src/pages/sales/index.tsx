/** @file 收银开单页 - V2 Phase 1 占位页面 */
import { Card, Empty, Button, Input, Tag, Space } from 'antd'
import { ShoppingCartOutlined, ScanOutlined } from '@ant-design/icons'

export default function SalesPage() {
  return (
    <div className="p-4">
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)' }}>
        <Card title="商品选择" style={{ flex: 1 }} extra={
          <Input.Search placeholder="扫码/搜索商品" prefix={<ScanOutlined />} style={{ width: 300 }} />
        }>
          <Empty description="商品快捷按钮区" />
        </Card>
        <Card title="购物清单" style={{ width: 400 }} extra={<Button icon={<ShoppingCartOutlined />}>挂单</Button>}
          actions={[
            <Space key="actions">
              <Tag color="green">合计: ¥0.00</Tag>
              <Button type="primary" size="large">结算</Button>
              <Button size="large">清空</Button>
            </Space>
          ]}>
          <Empty description="购物车为空" />
        </Card>
      </div>
    </div>
  )
}
