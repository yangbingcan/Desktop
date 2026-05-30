/** @file 权限管理 - 角色列表、新增编辑、权限配置 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PlusOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Space,
  Table,
  Tag,
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

/** 角色表单值 */
interface RoleFormValues {
  name: string
  description?: string
  permission_keys?: string[]
}

export default function PermissionRolesPage() {
  /* ========== 列表相关状态 ========== */
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<RoleItem[]>([])
  const [keyword, setKeyword] = useState('')

  /* ========== 权限列表（弹窗用） ========== */
  const [permissions, setPermissions] = useState<PermissionItem[]>([])

  /** 按 group 分组的权限，用于弹窗中 Checkbox.Group 展示 */
  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionItem[]>()
    permissions.forEach((p) => {
      const list = map.get(p.group) || []
      list.push(p)
      map.set(p.group, list)
    })
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
  }, [permissions])

  /* ========== 新增/编辑弹窗 ========== */
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [form] = Form.useForm<RoleFormValues>()

  /* ========== 权限详情展开行 ========== */
  const [expandedKeys, setExpandedKeys] = useState<readonly string[]>([])

  /* ========== 加载角色列表 ========== */
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

  /* ========== 加载权限列表 ========== */
  const fetchPermissions = useCallback(async () => {
    try {
      const list = await getPermissions()
      setPermissions(list)
    } catch {
      // 权限加载失败不阻塞主流程
    }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  /* ========== 判断是否admin角色 ========== */
  const isAdminRole = (role: RoleItem) => role.name === 'admin' || role.is_system

  /* ========== 新增角色 ========== */
  const handleCreate = () => {
    setEditingRole(null)
    form.resetFields()
    setModalOpen(true)
  }

  /* ========== 编辑角色 ========== */
  const handleEdit = (role: RoleItem) => {
    if (isAdminRole(role)) {
      message.warning('系统角色不可编辑')
      return
    }
    setEditingRole(role)
    form.setFieldsValue({
      name: role.name,
      description: role.description || undefined,
      permission_keys: role.permissions,
    })
    setModalOpen(true)
  }

  /* ========== 新增/编辑提交 ========== */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setModalLoading(true)

      if (editingRole) {
        // 编辑模式
        await updateRole({
          id: editingRole.id,
          name: values.name,
          description: values.description,
          permission_keys: values.permission_keys,
        })
        message.success('角色更新成功')
      } else {
        // 新增模式
        await createRole({
          name: values.name,
          description: values.description,
          permission_keys: values.permission_keys,
        })
        message.success('角色创建成功')
      }

      setModalOpen(false)
      fetchRoles()
    } catch (err: unknown) {
      // 表单校验失败不提示，接口错误提示
      if (err && typeof err === 'object' && 'message' in err) {
        message.error(String((err as { message: string }).message))
      }
    } finally {
      setModalLoading(false)
    }
  }

  /* ========== 删除角色 ========== */
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

  /* ========== 根据权限key列表查找对应label ========== */
  const getPermissionLabels = (keys: string[]): string[] => {
    const labelMap = new Map(permissions.map((p) => [p.key, p.label]))
    return keys.map((k) => labelMap.get(k) || k)
  }

  /* ========== 表格列定义 ========== */
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
      render: (permissions: string[], record) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 'auto', fontWeight: 'normal' }}
          onClick={() => {
            const isExpanded = expandedKeys.includes(record.id)
            setExpandedKeys(isExpanded ? [] : [record.id])
          }}
        >
          <Tag color={permissions.length > 0 ? 'green' : 'default'}>
            {permissions.length}
          </Tag>
        </Button>
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
      width: 140,
      fixed: 'right',
      render: (_, record) => {
        // 系统角色不显示操作按钮
        if (isAdminRole(record)) return null

        return (
          <Space size={0} split={<span style={{ color: 'var(--gl-border)' }}>|</span>}>
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
            <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
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
        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-semibold" style={{ color: 'var(--gl-text-primary)' }}>
            权限管理
          </h1>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增角色
          </Button>
        </div>

        {/* 搜索区 */}
        <div className="flex items-center gap-3 mt-4">
          <Input.Search
            placeholder="搜索角色名称"
            allowClear
            style={{ width: 260 }}
            onSearch={(val) => setKeyword(val)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRoles}>
            刷新
          </Button>
        </div>
      </div>

      {/* 表格区 */}
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
          scroll={{ x: 830 }}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
            expandedRowRender: (record) => {
              const labels = getPermissionLabels(record.permissions)
              if (labels.length === 0) {
                return (
                  <span style={{ color: 'var(--gl-text-tertiary)' }}>暂无权限配置</span>
                )
              }
              // 按分组展示权限
              const keySet = new Set(record.permissions)
              return (
                <div className="space-y-3">
                  {groupedPermissions.map(({ group, items }) => {
                    const matched = items.filter((p) => keySet.has(p.key))
                    if (matched.length === 0) return null
                    return (
                      <div key={group}>
                        <span
                          className="font-medium mr-3"
                          style={{ color: 'var(--gl-text-secondary)', fontSize: 13 }}
                        >
                          {group}
                        </span>
                        <Space size={[4, 8]} wrap>
                          {matched.map((p) => (
                            <Tag key={p.key} color="processing" style={{ margin: 0 }}>
                              {p.label}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    )
                  })}
                </div>
              )
            },
          }}
        />
      </div>

      {/* ========== 新增/编辑角色弹窗 ========== */}
      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={modalLoading}
        okText={editingRole ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
          autoComplete="off"
        >
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" maxLength={32} />
          </Form.Item>
          <Form.Item name="description" label="角色描述">
            <Input.TextArea
              placeholder="请输入角色描述"
              maxLength={200}
              showCount
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>
          <Form.Item name="permission_keys" label="功能权限">
            {/* 按分组展示权限复选框 */}
            <div className="space-y-4">
              {groupedPermissions.map(({ group, items }) => (
                <div key={group}>
                  <div
                    className="mb-2 font-medium"
                    style={{ color: 'var(--gl-text-secondary)', fontSize: 13 }}
                  >
                    {group}
                  </div>
                  <Checkbox.Group>
                    <Row gutter={[16, 8]}>
                      {items.map((p) => (
                        <Col key={p.key} span={8}>
                          <Checkbox value={p.key}>{p.label}</Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </div>
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
