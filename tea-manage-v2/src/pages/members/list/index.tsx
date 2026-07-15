/** @file 会员列表页 - 完整 CRUD + 储值充值 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Card, Tag, Button, Space, message } from 'antd'
import { PlusOutlined, EditOutlined, DollarOutlined } from '@ant-design/icons'
import { getMembers, type Member } from '../../../services/memberService'
import MemberForm from './MemberForm'
import RechargeModal from './RechargeModal'

export default function MemberListPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [rechargeId, setRechargeId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMembers({ page, pageSize: 20, keyword })
      setMembers(res.list || [])
      setTotal(res.total || 0)
    } catch (e: any) {
      message.error(e?.toString() || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => { loadData() }, [loadData])

  const levelColors: Record<string, string> = { normal: 'default', silver: 'silver', gold: 'gold' }
  const levelNames: Record<string, string> = { normal: '普通', silver: '银卡', gold: '金卡' }

  const handleAdd = () => { setEditId(null); setFormOpen(true) }
  const handleEdit = (r: Member) => { setEditId(r.id); setFormOpen(true) }
  const handleRecharge = (r: Member) => { setRechargeId(r.id); setRechargeOpen(true) }

  return (
    <div className="p-4">
      <Card title="会员管理" extra={
        <Space>
          <Input.Search placeholder="搜索姓名/手机号" style={{ width: 250 }}
            onChange={e => setKeyword(e.target.value)} onSearch={loadData} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增会员</Button>
        </Space>
      }>
        <Table loading={loading} dataSource={members} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 100 },
            { title: '手机号', dataIndex: 'phone', width: 130 },
            { title: '等级', dataIndex: 'level', width: 80,
              render: (v: string) => <Tag color={levelColors[v]}>{levelNames[v] || v}</Tag> },
            { title: '积分', dataIndex: 'points', width: 80 },
            { title: '余额', dataIndex: 'balance', width: 100,
              render: (v: number) => `¥${(v || 0).toFixed(2)}` },
            { title: '累计消费', dataIndex: 'total_consume', width: 120,
              render: (v: number) => `¥${(v || 0).toFixed(2)}` },
            { title: '消费次数', dataIndex: 'consume_count', width: 80 },
            { title: '操作', width: 180,
              render: (_: any, r: Member) => (
                <Space>
                  <Button size="small" icon={<DollarOutlined />} onClick={() => handleRecharge(r)}>充值</Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
                </Space>
              ) },
          ]}
        />
      </Card>

      <MemberForm open={formOpen} memberId={editId} onClose={() => setFormOpen(false)} onSuccess={loadData} />
      <RechargeModal open={rechargeOpen} memberId={rechargeId} onClose={() => setRechargeOpen(false)} onSuccess={loadData} />
    </div>
  )
}
