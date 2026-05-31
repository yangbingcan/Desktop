/** @file 权限管理 - 角色列表 + Excel矩阵权限配置（独立页面，非弹窗） */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PlusOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  SnippetsOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
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
  createRole,
  deleteRole,
  getPermissions,
  getRoles,
  updateRole,
  type PermissionItem,
  type RoleItem,
} from '../../../services/roleService'
import { PERMISSION_ACTIONS } from '../../../services/permissionMap'
import { usePermission } from '../../../hooks/usePermission'

type ViewMode = 'list' | 'edit' | 'create'

export default function PermissionRolesPage() {
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<RoleItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [permissions, setPermissions] = useState<PermissionItem[]>([])

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [clipboard, setClipboard] = useState<string[] | null>(null)

  const { hasAction } = usePermission()
  const canAdd = hasAction('permission', 'add')
  const canEdit = hasAction('permission', 'edit')
  const canDelete = hasAction('permission', 'delete')

  const moduleGroups = useMemo(() => {
    interface ModuleGroup {
      module: string
      moduleLabel: string
      group: string
      actions: PermissionItem[]
    }
    const map = new Map<string, ModuleGroup>()
    permissions.forEach((p) => {
      const existing = map.get(p.module)
      if (existing) {
        existing.actions.push(p)
      } else {
        map.set(p.module, {
          module: p.module,
          moduleLabel: p.module_label,
          group: p.group,
          actions: [p],
        })
      }
    })
    const groups = new Map<string, ModuleGroup[]>()
    map.forEach((val) => {
      const list = groups.get(val.group) || []
      list.push(val)
      groups.set(val.group, list)
    })
    return Array.from(groups.entries()).map(([group, modules]) => ({ group, modules }))
  }, [permissions])

  const allModules = useMemo(() => {
    const result: { module: string; moduleLabel: string; group: string; actions: PermissionItem[] }[] = []
    moduleGroups.forEach(({ modules }) => modules.forEach((m) => result.push(m)))
    return result
  }, [moduleGroups])

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
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const isAdminRole = (role: RoleItem) => role.name === 'admin' || role.is_system

  const handleCreate = () => {
    setEditingRole(null)
    setRoleName('')
    setRoleDesc('')
    setSelectedKeys(new Set())
    setViewMode('create')
  }

  const handleEdit = (role: RoleItem) => {
    if (isAdminRole(role)) {
      message.warning('系统角色不可编辑')
      return
    }
    setEditingRole(role)
    setRoleName(role.name)
    setRoleDesc(role.description || '')
    setSelectedKeys(new Set(role.permissions))
    setViewMode('edit')
  }

  const handleSave = async () => {
    const name = roleName.trim()
    if (!name) {
      message.error('请输入角色名称')
      return
    }

    setSaving(true)
    try {
      const permKeys = Array.from(selectedKeys)

      if (editingRole) {
        await updateRole({
          id: editingRole.id,
          name,
          description: roleDesc || undefined,
          permission_keys: permKeys,
        })
        message.success('角色更新成功')
      } else {
        await createRole({
          name,
          description: roleDesc || undefined,
          permission_keys: permKeys,
        })
        message.success('角色创建成功')
      }

      setViewMode('list')
      fetchRoles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? '操作失败')
      if (msg) message.error(msg)
    } finally {
      setSaving(false)
    }
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

  const handlePastePermissions = () => {
    if (!clipboard) {
      message.warning('请先复制一个角色的权限')
      return
    }
    setSelectedKeys(new Set(clipboard))
    message.success(`已粘贴 ${clipboard.length} 项权限`)
  }

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleRow = (mod: { actions: PermissionItem[] }) => {
    const allKeys = mod.actions.map((a) => a.key)
    const allChecked = allKeys.every((k) => selectedKeys.has(k))
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      allKeys.forEach((k) => {
        if (allChecked) next.delete(k)
        else next.add(k)
      })
      return next
    })
  }

  const toggleColumn = (actionKey: string) => {
    const allKeys = allModules.map((m) => `${m.module}:${actionKey}`)
    const allChecked = allKeys.every((k) => selectedKeys.has(k))
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      allKeys.forEach((k) => {
        if (allChecked) next.delete(k)
        else next.add(k)
      })
      return next
    })
  }

  const toggleGroup = (modules: { actions: PermissionItem[] }[]) => {
    const allKeys = modules.flatMap((m) => m.actions.map((a) => a.key))
    const allChecked = allKeys.every((k) => selectedKeys.has(k))
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      allKeys.forEach((k) => {
        if (allChecked) next.delete(k)
        else next.add(k)
      })
      return next
    })
  }

  const toggleAll = () => {
    const allKeys = permissions.map((p) => p.key)
    const allChecked = allKeys.every((k) => selectedKeys.has(k))
    if (allChecked) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(allKeys))
    }
  }

  if (viewMode === 'edit' || viewMode === 'create') {
    return (
      <div className="space-y-4">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
        >
          <div className="flex items-center gap-3">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setViewMode('list')}
            >
              返回列表
            </Button>
            <div className="h-4 w-px" style={{ background: 'var(--gl-border)' }} />
            <span className="font-medium" style={{ color: 'var(--gl-text-primary)' }}>
              {viewMode === 'create' ? '新增角色' : `编辑角色 - ${editingRole?.name}`}
            </span>
            <div className="flex-1" />
            <Tooltip title={clipboard ? `粘贴（已复制 ${clipboard.length} 项权限）` : '请先在列表中复制角色权限'}>
              <Button
                icon={<SnippetsOutlined />}
                onClick={handlePastePermissions}
                disabled={!clipboard}
              >
                粘贴权限
              </Button>
            </Tooltip>
            <Button onClick={() => setViewMode('list')}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-2">
              <label className="text-sm whitespace-nowrap" style={{ color: 'var(--gl-text-secondary)' }}>
                角色名称<span style={{ color: 'var(--gl-error)' }}>*</span>
              </label>
              <Input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="请输入角色名称"
                maxLength={32}
                style={{ width: 200 }}
                status={roleName.trim() === '' && viewMode === 'edit' ? undefined : undefined}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm whitespace-nowrap" style={{ color: 'var(--gl-text-secondary)' }}>
                角色描述
              </label>
              <Input
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder="请输入角色描述"
                maxLength={200}
                style={{ width: 300 }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="font-medium" style={{ color: 'var(--gl-text-secondary)', fontSize: 13 }}>
              功能权限（已选 {selectedKeys.size} / {permissions.length}）
            </span>
            <Space size={8}>
              <Button size="small" onClick={toggleAll}>
                {selectedKeys.size === permissions.length ? '全部取消' : '全部选择'}
              </Button>
            </Space>
          </div>

          <div
            className="overflow-x-auto rounded-lg"
            style={{ border: '1px solid var(--gl-border)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'var(--gl-fill-quaternary)' }}>
                  <th
                    className="text-left px-3 py-2 font-medium sticky left-0 z-10"
                    style={{
                      borderBottom: '1px solid var(--gl-border)',
                      borderRight: '1px solid var(--gl-border)',
                      background: 'var(--gl-fill-quaternary)',
                      minWidth: 120,
                      fontSize: 13,
                      color: 'var(--gl-text-secondary)',
                    }}
                  >
                    模块
                  </th>
                  {PERMISSION_ACTIONS.map((action) => {
                    const allKeys = allModules.map((m) => `${m.module}:${action.key}`)
                    const allChecked = allKeys.every((k) => selectedKeys.has(k))
                    const someChecked = allKeys.some((k) => selectedKeys.has(k))
                    return (
                      <th
                        key={action.key}
                        className="px-2 py-2 text-center font-normal cursor-pointer select-none"
                        style={{
                          borderBottom: '1px solid var(--gl-border)',
                          fontSize: 12,
                          color: allChecked ? 'var(--gl-primary)' : someChecked ? 'var(--gl-primary)' : 'var(--gl-text-tertiary)',
                          minWidth: 56,
                          whiteSpace: 'nowrap',
                        }}
                        onClick={() => toggleColumn(action.key)}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <Checkbox checked={allChecked} indeterminate={someChecked && !allChecked} />
                          <span>{action.label}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {moduleGroups.map(({ group, modules }) => (
                  <FragmentWithGroup key={group} group={group} modules={modules} selectedKeys={selectedKeys} toggleGroup={toggleGroup} toggleRow={toggleRow} toggleKey={toggleKey} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

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

function FragmentWithGroup({ group, modules, selectedKeys, toggleGroup, toggleRow, toggleKey }: {
  group: string
  modules: { module: string; moduleLabel: string; actions: PermissionItem[] }[]
  selectedKeys: Set<string>
  toggleGroup: (modules: { actions: PermissionItem[] }[]) => void
  toggleRow: (mod: { actions: PermissionItem[] }) => void
  toggleKey: (key: string) => void
}) {
  const groupAllKeys = modules.flatMap((m) => m.actions.map((a) => a.key))
  const groupAllChecked = groupAllKeys.every((k) => selectedKeys.has(k))
  const groupSomeChecked = groupAllKeys.some((k) => selectedKeys.has(k))

  return (
    <>
      <tr
        className="cursor-pointer select-none"
        style={{ background: 'var(--gl-fill-quaternary)' }}
        onClick={() => toggleGroup(modules)}
      >
        <td
          colSpan={1 + PERMISSION_ACTIONS.length}
          className="px-3 py-1.5 font-medium"
          style={{
            borderBottom: '1px solid var(--gl-border)',
            fontSize: 13,
            color: 'var(--gl-text-secondary)',
          }}
        >
          <Checkbox checked={groupAllChecked} indeterminate={groupSomeChecked && !groupAllChecked} />
          <span className="ml-2">{group}</span>
        </td>
      </tr>
      {modules.map((mod) => {
        const rowAllKeys = mod.actions.map((a) => a.key)
        const rowAllChecked = rowAllKeys.every((k) => selectedKeys.has(k))
        const rowSomeChecked = rowAllKeys.some((k) => selectedKeys.has(k))
        return (
          <tr key={mod.module} className="hover:bg-[var(--gl-row-hover)]">
            <td
              className="px-3 py-1.5 sticky left-0 cursor-pointer select-none"
              style={{
                borderBottom: '1px solid var(--gl-border)',
                borderRight: '1px solid var(--gl-border)',
                background: 'var(--gl-card-bg)',
                fontSize: 13,
                color: 'var(--gl-text-primary)',
                whiteSpace: 'nowrap',
              }}
              onClick={() => toggleRow(mod)}
            >
              <Checkbox checked={rowAllChecked} indeterminate={rowSomeChecked && !rowAllChecked} />
              <span className="ml-2">{mod.moduleLabel}</span>
            </td>
            {PERMISSION_ACTIONS.map((action) => {
              const key = `${mod.module}:${action.key}`
              const perm = mod.actions.find((a) => a.action === action.key)
              return (
                <td
                  key={action.key}
                  className="px-2 py-1.5 text-center cursor-pointer select-none"
                  style={{
                    borderBottom: '1px solid var(--gl-border)',
                    fontSize: 12,
                  }}
                  onClick={() => perm && toggleKey(key)}
                >
                  <Checkbox checked={selectedKeys.has(key)} disabled={!perm} />
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}
