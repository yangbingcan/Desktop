/** @file 用户管理 - 用户列表、新增编辑、状态管理 */
import { useCallback, useEffect, useState } from 'react'
import {
  PlusOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import {
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import StatusBadge from '../../../components/common/StatusBadge'
import { usePermission } from '../../../hooks/usePermission'
import { useDebouncedCallback } from '../../../hooks/useDebounce'
import { getRoleOptions } from '../../../services/roleService'
import type { RoleBrief } from '../../../services/userService'
import {
  deleteUser,
  getUsers,
  toggleUserStatus,
  type UserItem,
} from '../../../services/userService'
import { CreateUserModal } from './CreateUserModal'
import { EditUserModal } from './EditUserModal'
import { ResetPasswordModal } from './ResetPasswordModal'

/** 状态映射：1=启用 0=禁用 */
const STATUS_MAP: Record<number, { type: 'success' | 'error'; label: string }> = {
  1: { type: 'success', label: '启用' },
  0: { type: 'error', label: '禁用' },
}

export default function UserManagePage() {
  const { hasAction } = usePermission()
  const canAdd = hasAction('user_manage', 'add')
  const canEdit = hasAction('user_manage', 'edit')
  const canDelete = hasAction('user_manage', 'delete')
  /* ========== 列表相关状态 ========== */
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)

  /* 搜索防抖：输入时延迟触发API请求 */
  const debouncedSetKeyword = useDebouncedCallback((val: string) => {
    setKeyword(val)
    setPage(1)
  }, 300)

  /* ========== 角色列表（弹窗用） ========== */
  const [roleOptions, setRoleOptions] = useState<RoleBrief[]>([])

  /* ========== 弹窗状态 ========== */
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resettingUser, setResettingUser] = useState<UserItem | null>(null)

  /* ========== 加载用户列表 ========== */
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUsers({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: statusFilter,
      })
      setDataSource(res.items)
      setTotal(res.total)
    } catch {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  /* ========== 加载角色选项 ========== */
  const fetchRoles = useCallback(async () => {
    try {
      const roles = await getRoleOptions()
      setRoleOptions(roles)
    } catch {
      // 角色加载失败不阻塞主流程
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  /* ========== 判断是否admin用户 ========== */
  const isAdmin = (user: UserItem) => user.roles?.some(r => r.is_system) ?? false

  /* ========== 删除用户 ========== */
  const handleDelete = async (user: UserItem) => {
    if (isAdmin(user)) {
      message.warning('admin用户不可删除')
      return
    }
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除用户「${user.real_name || user.username}」吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUser(user.id)
          message.success('删除成功')
          fetchUsers()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  /* ========== 切换用户状态 ========== */
  const handleToggleStatus = async (user: UserItem, newStatus: number) => {
    if (isAdmin(user)) {
      message.warning('admin用户不可禁用')
      return
    }
    try {
      await toggleUserStatus(user.id, newStatus)
      message.success(newStatus === 1 ? '已启用' : '已禁用')
      fetchUsers()
    } catch {
      message.error('状态切换失败')
    }
  }

  /* ========== 表格列定义 ========== */
  const columns: ColumnsType<UserItem> = [
    {
      title: '用户名',
      dataIndex: 'username',
      width: 120,
      ellipsis: true,
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 130,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 180,
      render: (roles: UserItem['roles']) =>
        roles.length > 0
          ? roles.map((r) => (
              <Tag key={r.id} color="blue" style={{ marginInlineEnd: 4 }}>
                {r.name}
              </Tag>
            ))
          : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      align: 'center',
      render: (status: number) => {
        const cfg = STATUS_MAP[status]
        return cfg ? <StatusBadge type={cfg.type}>{cfg.label}</StatusBadge> : '-'
      },
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      width: 170,
      render: (val: string | null) => val || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        // admin用户不显示操作按钮
        if (isAdmin(record)) return null

        const isEnabled = record.status === 1

        return (
          <Space size={0} split={<span style={{ color: 'var(--gl-border)' }}>|</span>}>
            {canEdit && (
              <Button type="link" size="small" onClick={() => { setEditingUser(record); setEditOpen(true) }}>
                编辑
              </Button>
            )}
            {canEdit && isEnabled && (
              <Button type="link" size="small" onClick={() => { setResettingUser(record); setResetOpen(true) }}>
                重置密码
              </Button>
            )}
            {canEdit && (isEnabled ? (
              <Popconfirm
                title="确认禁用"
                description={`确定要禁用用户「${record.real_name || record.username}」吗？`}
                onConfirm={() => handleToggleStatus(record, 0)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" danger>
                  禁用
                </Button>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="确认启用"
                description={`确定要启用用户「${record.real_name || record.username}」吗？`}
                onConfirm={() => handleToggleStatus(record, 1)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small">
                  启用
                </Button>
              </Popconfirm>
            ))}
            {canDelete && (
              <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
                删除
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  /* ========== 渲染 ========== */
  return (
    <div className="space-y-4">
      {/* 页面头部 */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
      >
        <div className="flex items-center gap-3">
          <Input.Search
            placeholder="搜索用户名/姓名"
            allowClear
            style={{ width: 260 }}
            onChange={(e) => debouncedSetKeyword(e.target.value)}
            onSearch={(val) => {
              setKeyword(val)
              setPage(1)
            }}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val)
              setPage(1)
            }}
            options={[
              { label: '启用', value: 1 },
              { label: '禁用', value: 0 },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
            刷新
          </Button>
          <div className="flex-1" />
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增用户
            </Button>
          )}
        </div>
      </div>

      {/* 表格区 */}
      <div
        className="rounded-xl"
        style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
      >
        <Table<UserItem>
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </div>

      {/* 新增用户弹窗 */}
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={fetchUsers}
        roleOptions={roleOptions}
      />

      {/* 编辑用户弹窗 */}
      <EditUserModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={fetchUsers}
        roleOptions={roleOptions}
        user={editingUser}
      />

      {/* 重置密码弹窗 */}
      <ResetPasswordModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onSuccess={fetchUsers}
        user={resettingUser}
      />
    </div>
  )
}
