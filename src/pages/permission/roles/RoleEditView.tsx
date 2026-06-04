/** @file 权限管理 - 角色编辑/创建视图，包含权限矩阵配置 */
import { useMemo, useState } from 'react'
import { ArrowLeftOutlined, SnippetsOutlined } from '@ant-design/icons'
import { Button, Checkbox, Input, message, Space, Tooltip } from 'antd'
import {
  createRole,
  updateRole,
  type PermissionItem,
  type RoleItem,
} from '../../../services/roleService'
import { PERMISSION_ACTIONS } from '../../../services/permissionMap'
import { handleApiError } from '../../../utils/errorHandler'

interface RoleEditViewProps {
  viewMode: 'edit' | 'create'
  editingRole: RoleItem | null
  onBack: () => void
  onSaved: () => void
  permissions: PermissionItem[]
  clipboard: string[] | null
}

/** 角色编辑/创建视图，包含角色基本信息和权限矩阵配置 */
export function RoleEditView({
  viewMode,
  editingRole,
  onBack,
  onSaved,
  permissions,
  clipboard,
}: RoleEditViewProps) {
  const [roleName, setRoleName] = useState(editingRole?.name ?? '')
  const [roleDesc, setRoleDesc] = useState(editingRole?.description ?? '')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(editingRole?.permissions ?? []),
  )
  const [saving, setSaving] = useState(false)

  /** 按分组聚合权限模块 */
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

  /** 扁平化的所有模块列表 */
  const allModules = useMemo(() => {
    const result: { module: string; moduleLabel: string; group: string; actions: PermissionItem[] }[] = []
    moduleGroups.forEach(({ modules }) => modules.forEach((m) => result.push(m)))
    return result
  }, [moduleGroups])

  /** 保存角色（新建或更新） */
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

      onBack()
      onSaved()
    } catch (err: unknown) {
      handleApiError(err, '操作失败')
    } finally {
      setSaving(false)
    }
  }

  /** 粘贴剪贴板中的权限 */
  const handlePastePermissions = () => {
    if (!clipboard) {
      message.warning('请先复制一个角色的权限')
      return
    }
    setSelectedKeys(new Set(clipboard))
    message.success(`已粘贴 ${clipboard.length} 项权限`)
  }

  /** 切换单个权限项 */
  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** 切换整行（模块）权限 */
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

  /** 切换整列（操作类型）权限 */
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

  /** 切换分组权限 */
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

  /** 全选/全不选 */
  const toggleAll = () => {
    const allKeys = permissions.map((p) => p.key)
    const allChecked = allKeys.every((k) => selectedKeys.has(k))
    if (allChecked) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(allKeys))
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
      >
        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
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
          <Button onClick={onBack}>取消</Button>
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

/** 权限矩阵中的分组行，包含分组标题行和模块行 */
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
