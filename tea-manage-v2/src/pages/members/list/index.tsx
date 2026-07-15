/** @file 会员列表页 - V2 Phase 1 占位页面 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Card, Tag, Button, Space, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { invoke } from '@tauri-apps/api/core'

export default function MemberListPage() {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const token = localStorage.getItem('token') || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoke<any>('get_members', { token, page, pageSize: 20, keyword })
      setMembers(res.list || []); setTotal(res.total || 0)
    } catch (e: any) { message.error(e?.toString() || '加载失败') }
    finally { setLoading(false) }
  }, [page, keyword, token])

  useEffect(() => { loadData() }, [loadData])

  const levelColors: Record<string, string> = { normal: 'default', silver: 'silver', gold: 'gold' }
  const levelNames: Record<string, string> = { normal: '普通', silver: '银卡', gold: '金卡' }

  return (
    <div className="p-4">
      <Card title="会员管理" extra={
        <Space>
          <Input.Search placeholder="搜索姓名/手机号" style={{ width: 250 }}
            onChange={e => setKeyword(e.target.value)} onSearch={loadData} allowClear />
          <Button type="primary" icon={<PlusOutlined />}>新增会员</Button>
        </Space>
      }>
        <Table loading={loading} dataSource={members} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
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
          ]}
        />
      </Card>
    </div>
  )
}
