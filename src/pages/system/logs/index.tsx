/** @file 系统日志 - 操作日志列表、筛选、详情、删除 */
import { useCallback, useEffect, useState } from 'react'
import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Descriptions,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { usePermission } from '../../../hooks/usePermission'
import {
  deleteOperationLogs,
  getOperationLogs,
  type OperationLogItem,
} from '../../../services/operationLogService'

const ACTION_TYPE_MAP: Record<string, { color: string; label: string }> = {
  login: { color: 'green', label: '登录' },
  logout: { color: 'default', label: '登出' },
  view: { color: 'blue', label: '打开' },
  create: { color: 'cyan', label: '新增' },
  update: { color: 'orange', label: '修改' },
  delete: { color: 'red', label: '删除' },
}

const MODULE_OPTIONS = [
  { label: '认证', value: '认证' },
  { label: '用户管理', value: '用户管理' },
  { label: '角色权限', value: '角色权限' },
  { label: '系统日志', value: '系统日志' },
]

const ACTION_TYPE_OPTIONS = Object.entries(ACTION_TYPE_MAP).map(([key, val]) => ({
  label: val.label,
  value: key,
}))

export default function SystemLogsPage() {
  const { hasAction } = usePermission()
  const canDelete = hasAction('system_log', 'delete')

  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<OperationLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [keyword, setKeyword] = useState('')
  const [actionTypeFilter, setActionTypeFilter] = useState<string | undefined>(undefined)
  const [moduleFilter, setModuleFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<OperationLogItem | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOperationLogs({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        action_type: actionTypeFilter,
        module: moduleFilter,
        start_date: dateRange?.[0]?.format('YYYY-MM-DD') || undefined,
        end_date: dateRange?.[1]?.format('YYYY-MM-DD') || undefined,
      })
      setDataSource(res.items)
      setTotal(res.total)
    } catch {
      message.error('获取日志列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, actionTypeFilter, moduleFilter, dateRange])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleDetail = (record: OperationLogItem) => {
    setDetailRecord(record)
    setDetailOpen(true)
  }

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的日志')
      return
    }
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除选中的 ${selectedRowKeys.length} 条日志吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await deleteOperationLogs(selectedRowKeys)
          message.success(`已删除 ${result.deleted_count} 条日志`)
          setSelectedRowKeys([])
          fetchLogs()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const columns: ColumnsType<OperationLogItem> = [
    {
      title: '操作人',
      dataIndex: 'username',
      width: 100,
      ellipsis: true,
    },
    {
      title: '操作类型',
      dataIndex: 'action_type',
      width: 80,
      align: 'center',
      render: (val: string) => {
        const cfg = ACTION_TYPE_MAP[val]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : val
      },
    },
    {
      title: '操作描述',
      dataIndex: 'action',
      width: 140,
      ellipsis: true,
    },
    {
      title: '模块',
      dataIndex: 'module',
      width: 100,
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      width: 130,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: '计算机名',
      dataIndex: 'computer_name',
      width: 120,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleDetail(record)}>
          详情
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Input.Search
            placeholder="搜索操作人"
            allowClear
            style={{ width: 180 }}
            onSearch={(val) => { setKeyword(val); setPage(1) }}
          />
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 120 }}
            value={actionTypeFilter}
            onChange={(val) => { setActionTypeFilter(val); setPage(1) }}
            options={ACTION_TYPE_OPTIONS}
          />
          <Select
            placeholder="模块"
            allowClear
            style={{ width: 120 }}
            value={moduleFilter}
            onChange={(val) => { setModuleFilter(val); setPage(1) }}
            options={MODULE_OPTIONS}
          />
          <DatePicker.RangePicker
            style={{ width: 260 }}
            value={dateRange as any}
            onChange={(val) => { setDateRange(val as any); setPage(1) }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
            刷新
          </Button>
          <div className="flex-1" />
          {canDelete && selectedRowKeys.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              删除选中 ({selectedRowKeys.length})
            </Button>
          )}
        </div>
      </div>

      <div
        className="rounded-xl"
        style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
      >
        <Table<OperationLogItem>
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 1000 }}
          rowSelection={
            canDelete
              ? {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys as string[]),
                }
              : undefined
          }
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

      <Modal
        title="日志详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
      >
        {detailRecord && (
          <Descriptions column={2} size="small" bordered className="mt-4">
            <Descriptions.Item label="操作人">{detailRecord.username}</Descriptions.Item>
            <Descriptions.Item label="操作类型">
              {ACTION_TYPE_MAP[detailRecord.action_type]?.label || detailRecord.action_type}
            </Descriptions.Item>
            <Descriptions.Item label="操作描述" span={2}>{detailRecord.action}</Descriptions.Item>
            <Descriptions.Item label="模块">{detailRecord.module}</Descriptions.Item>
            <Descriptions.Item label="操作时间">{detailRecord.created_at}</Descriptions.Item>
            <Descriptions.Item label="操作详情" span={2}>
              {detailRecord.detail || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="计算机名称">{detailRecord.computer_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{detailRecord.ip_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="MAC地址">{detailRecord.mac_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="操作系统">{detailRecord.os_info || '-'}</Descriptions.Item>
            <Descriptions.Item label="应用版本" span={2}>{detailRecord.app_version || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
