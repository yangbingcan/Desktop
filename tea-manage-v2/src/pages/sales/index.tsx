/** @file 收银开单 - 商品搜索 + 购物车 + 会员识别 + 结算 */
import { useState, useCallback, useEffect } from 'react'
import { Card, Input, Button, Table, Tag, Space, Empty, Modal, Radio, message, InputNumber, Row, Col, Statistic } from 'antd'
import { ScanOutlined, ShoppingCartOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'
import { getProducts } from '../../services/productService'
import { createSaleOrder, getMemberByPhone, type CartItem } from '../../services/salesService'

export default function SalesPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [memberPhone, setMemberPhone] = useState('')
  const [member, setMember] = useState<any>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [payMethod, setPayMethod] = useState('cash')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const discount = member ? (member.level === 'gold' ? total * 0.05 : member.level === 'silver' ? total * 0.03 : 0) : 0
  const actualAmount = total - discount

  const searchProducts = useCallback(async () => {
    if (!searchKeyword.trim()) { setProductResults([]); return }
    setSearchLoading(true)
    try {
      const res = await getProducts({ page: 1, pageSize: 50, keyword: searchKeyword })
      setProductResults(res.list || [])
    } catch (e: any) {
      message.error(e?.toString() || '搜索失败')
    } finally {
      setSearchLoading(false)
    }
  }, [searchKeyword])

  const searchMember = async () => {
    if (!memberPhone.trim()) return
    try {
      const res = await getMemberByPhone(memberPhone.trim())
      if (res) {
        setMember(res)
        message.success(`会员：${res.name}（${res.level === 'gold' ? '金卡' : res.level === 'silver' ? '银卡' : '普通'}）`)
      } else {
        setMember(null)
        message.info('未找到会员')
      }
    } catch (e: any) {
      message.error(e?.toString() || '查询会员失败')
    }
  }

  const addToCart = (product: any, unitId: string, unitName: string, price: number, conversion: number) => {
    const existing = cart.find(c => c.productId === product.id && c.unitId === unitId)
    if (existing) {
      const newCart = [...cart]
      const idx = cart.indexOf(existing)
      newCart[idx].quantity += 1
      newCart[idx].grams += conversion
      newCart[idx].subtotal = newCart[idx].price * newCart[idx].quantity
      setCart(newCart)
    } else {
      setCart([...cart, {
        productId: product.id, productName: product.name,
        unitId, unitName, quantity: 1, price, grams: conversion, subtotal: price,
      }])
    }
  }

  const updateQuantity = (idx: number, qty: number) => {
    if (qty <= 0) { removeItem(idx); return }
    const newCart = [...cart]
    // 数量更新时不重新计算 grams（已通过单位换算在添加时确定）
    newCart[idx].quantity = qty
    newCart[idx].subtotal = newCart[idx].price * qty
    setCart(newCart)
  }

  const removeItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx))
  }

  const handleCheckout = async () => {
    if (cart.length === 0) { message.warning('购物车为空'); return }
    setCheckoutLoading(true)
    try {
      const res = await createSaleOrder({
        items: cart.map(c => ({ product_id: c.productId, unit_id: c.unitId, quantity: c.quantity })),
        member_id: member?.id,
        apply_member_discount: !!member,
        pay_method: payMethod,
      })
      message.success(`结算成功！订单号：${res.orderNo}，实付：¥${res.actualAmount.toFixed(2)}`)
      setCart([])
      setMember(null)
      setMemberPhone('')
      setCheckoutOpen(false)
    } catch (e: any) {
      message.error(e?.toString() || '结算失败')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const payMethodOptions = [
    { label: '现金', value: 'cash' },
    { label: '微信', value: 'wechat' },
    { label: '支付宝', value: 'alipay' },
    { label: '会员余额', value: 'memberBalance', disabled: !member },
  ]

  return (
    <div className="p-4">
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)' }}>
        {/* 左侧：商品搜索区 */}
        <Card title="商品选择" style={{ flex: 1 }} extra={
          <Input.Search placeholder="扫码/搜索商品" prefix={<ScanOutlined />}
            value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
            onSearch={searchProducts} loading={searchLoading} style={{ width: 300 }} />
        }>
          {productResults.length === 0 ? (
            <Empty description="搜索商品后显示结果" />
          ) : (
            <Row gutter={[8, 8]}>
              {productResults.map(p => (
                <Col key={p.id} span={8}>
                  <Card size="small" hoverable title={p.name}
                    extra={<Tag color={p.product_type === 'weight' ? 'green' : 'blue'}>{p.product_type === 'weight' ? '称重' : '计件'}</Tag>}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                      编码：{p.code} | 产地：{p.origin || '-'}
                    </div>
                    <ProductUnitButtons product={p} onAdd={addToCart} />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>

        {/* 右侧：购物清单 */}
        <Card title="购物清单" style={{ width: 420 }}
          extra={
            <Space>
              <Input placeholder="会员手机" prefix={<UserOutlined />}
                value={memberPhone} onChange={e => setMemberPhone(e.target.value)}
                onPressEnter={searchMember} style={{ width: 150 }} />
              <Button onClick={searchMember}>查询</Button>
            </Space>
          }
        >
          {member && (
            <div style={{ marginBottom: 12, padding: 8, background: 'rgba(13, 148, 136, 0.05)', borderRadius: 6 }}>
              <Space>
                <Tag color="teal">{member.level === 'gold' ? '金卡' : member.level === 'silver' ? '银卡' : '普通'}</Tag>
                <span>{member.name}</span>
                <span style={{ color: '#666' }}>积分: {member.points}</span>
                <span style={{ color: '#666' }}>余额: ¥{member.balance?.toFixed(2)}</span>
              </Space>
            </div>
          )}

          {cart.length === 0 ? (
            <Empty description="购物车为空" />
          ) : (
            <Table size="small" dataSource={cart} rowKey={(r, i) => `${r.productId}-${r.unitId}-${i}`}
              pagination={false} scroll={{ y: 300 }}
              columns={[
                { title: '商品', dataIndex: 'productName', width: 120 },
                { title: '单位', dataIndex: 'unitName', width: 60 },
                { title: '数量', width: 100,
                  render: (_: any, r: CartItem, i: number) => (
                    <InputNumber size="small" value={r.quantity} min={1} onChange={v => updateQuantity(i, v || 1)} style={{ width: 80 }} />
                  ) },
                { title: '单价', dataIndex: 'price', width: 70, render: (v: number) => `¥${v.toFixed(2)}` },
                { title: '小计', dataIndex: 'subtotal', width: 80, render: (v: number) => `¥${v.toFixed(2)}` },
                { title: '', width: 30, render: (_: any, _r: CartItem, i: number) => (
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(i)} />) },
              ]}
            />
          )}

          <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid #f0f0f0' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="合计" value={total} precision={2} prefix="¥" valueStyle={{ fontSize: 16 }} />
              </Col>
              <Col span={8}>
                <Statistic title="会员折扣" value={discount} precision={2} prefix="-¥" valueStyle={{ fontSize: 16, color: '#f50' }} />
              </Col>
              <Col span={8}>
                <Statistic title="应付" value={actualAmount} precision={2} prefix="¥" valueStyle={{ fontSize: 18, color: '#0D9488' }} />
              </Col>
            </Row>
          </div>

          <Space style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            <Button size="large" onClick={() => { setCart([]); setMember(null); setMemberPhone('') }}>清空</Button>
            <Button type="primary" size="large" icon={<ShoppingCartOutlined />}
              onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>结算</Button>
          </Space>
        </Card>
      </div>

      {/* 结算弹窗 */}
      <Modal title="结算确认" open={checkoutOpen} onCancel={() => setCheckoutOpen(false)}
        onOk={handleCheckout} confirmLoading={checkoutLoading}
        okText="确认结算" cancelText="取消">
        <Statistic title="应付金额" value={actualAmount} precision={2} prefix="¥"
          valueStyle={{ fontSize: 28, color: '#0D9488', textAlign: 'center' }} />
        <div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 8 }}>选择支付方式：</p>
          <Radio.Group value={payMethod} onChange={e => setPayMethod(e.target.value)}
            options={payMethodOptions} optionType="button" buttonStyle="solid" />
        </div>
      </Modal>
    </div>
  )
}

/** 商品单位按钮组件 */
function ProductUnitButtons({ product, onAdd }: { product: any; onAdd: (p: any, unitId: string, unitName: string, price: number, conversion: number) => void }) {
  const [units, setUnits] = useState<any[]>([])
  const token = localStorage.getItem('token') || ''

  useEffect(() => {
    if (product.id) {
      invoke<any>('get_product_units', { token, productId: product.id })
        .then(res => setUnits(res || []))
        .catch(() => setUnits([]))
    }
  }, [product.id])

  if (units.length === 0) return <div style={{ fontSize: 12, color: '#999' }}>未设置销售单位</div>

  return (
    <Space wrap size="small">
      {units.map(u => (
        <Button key={u.id} size="small" type="primary" ghost
          onClick={() => onAdd(product, u.id, u.name, u.retail_price, u.conversion_to_base)}>
          {u.name} ¥{u.retail_price.toFixed(2)}
        </Button>
      ))}
    </Space>
  )
}
