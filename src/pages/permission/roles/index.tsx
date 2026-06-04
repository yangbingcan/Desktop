/** @file 权限管理 - 角色列表 + Excel矩阵权限配置（独立页面，非弹窗） */
import { useCallback, useEffect, useState } from 'react'
import {
  PlusOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import {
  Button,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  deleteRole,
  getPermissions,
  getRoles,
  type PermissionItem,
  type RoleItem,
} from '../../../services/roleService'
import { usePermission } from '../../../hooks/usePermission'
import { useDebouncedCallback } from '../../../hooks/useDebounce'
import { RoleEditView } from './RoleEditView'

type ViewMode = 'list' | 'edit' | 'create'

export default function PermissionRolesPage() {
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<RoleItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [permissions, setPermissions] = useState<PermissionItem[]>([])

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [clipboard, setClipboard] = useState<string[] | null>(null)

  const { hasAction } = usePermission()
  const canAdd = hasAction('permission', 'add')
  const canEdit = hasAction('permission', 'edit')
  const canDelete = hasAction('permission', 'delete')

  /* 搜索防抖：输入时延迟触发API请求 */
  const debouncedSetKeyword = useDebouncedCallback((val: string) => {
    setKeyword(val)
  }, 300)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getRoles(keyword || undefined)
      setDataSource(list)
    } catch {
      message.error('获取角色列表失败')
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const fetchPermissions = useCallback(async () => {
    try {
      const list = await getPermissions()
      setPermissions(list)
    } catch {
      message.warning('权限列表加载失败，部分功能可能不可用')
    }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const isAdminRole = (role: RoleItem) => role.is_system

  const handleCreate = () => {
    setEditingRole(null)
    setViewMode('create')
  }

  const handleEdit = (role: RoleItem) => {
    if (isAdminRole(role)) {
      message.warning('系统角色不可编辑')
      return
    }
    setEditingRole(role)
    setViewMode('edit')
  }

  const handleDelete = (role: RoleItem) => {
    if (isAdminRole(role)) {
      message.warning('系统角色不可删除')
      return
    }
    const hasUsers = role.user_count > 0
    const content = hasUsers
      ? `该角色已分配给 ${role.user_count} 个用户，删除后相关用户将失去对应权限。确认删除？`
      : `确定要删除角色「${role.name}」吗？此操作不可恢复。`
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteRole(role.id)
          message.success('删除成功')
          fetchRoles()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const handleCopyPermissions = (role: RoleItem) => {
    setClipboard(role.permissions)
    message.success(`已复制「${role.name}」的 ${role.permissions.length} 项权限`)
  }

  /* ========== 编辑/创建视图 ========== */
  if (viewMode === 'edit' || viewMode === 'create') {
    return (
      <RoleEditView
        viewMode={viewMode}
        editingRole={editingRole}
        onBack={() => setViewMode('list')}
        onSaved={fetchRoles}
        permissions={permissions}
        clipboard={clipboard}
      />
    )
  }

  /* ========== 列表视图 ========== */
  const columns: ColumnsType<RoleItem> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 140,
      ellipsis: true,
      render: (name: string, record) => (
        <Space size={6}>
          <span className="font-medium">{name}</span>
          {record.is_system && <Tag color="orange">系统</Tag>}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      width: 90,
      align: 'center',
      render: (val: number) => (
        <Tag color={val > 0 ? 'blue' : 'default'}>{val}</Tag>
      ),
    },
    {
      title: '权限数',
      dataIndex: 'permissions',
      width: 90,
      align: 'center',
      render: (permissions: string[]) => (
        <Tag color={permissions.length > 0 ? 'green' : 'default'}>
          {permissions.length}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        if (isAdminRole(record)) {
          return <span style={{ color: 'var(--gl-text-tertiary)' }}>-</span>
        }
        return (
          <Space size={0} split={<span style={{ color: 'var(--gl-border)' }}>|</span>}>
            {canEdit && (
              <Button type="link" size="small" onClick={() => handleEdit(record)}>
                编辑
              </Button>
            )}
            <Tooltip title="复制权限到剪贴板，可在编辑角色时粘贴">
              <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopyPermissions(record)}>
                复制
              </Button>
            </Tooltip>
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

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
      >
        <div className="flex items-center gap-3">
          <Input.Search
            placeholder="搜索角色名称"
            allowClear
            style={{ width: 260 }}
            onChange={(e) => debouncedSetKeyword(e.target.value)}
            onSearch={(val) => setKeyword(val)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRoles}>
            刷新
          </Button>
          <div className="flex-1" />
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新增角色
            </Button>
          )}
        </div>
      </div>

      <div
        className="rounded-xl"
        style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
      >
        <Table<RoleItem>
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 930 }}
          pagination={false}
        />
      </div>
    </div>
  )
}
