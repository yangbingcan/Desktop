/** @file 系统设置 - 公司信息、数据管理、关于系统 */
import { useCallback, useEffect, useState } from 'react'
import {
  BankOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import {
  Button,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Select,
  Spin,
  Statistic,
  Tabs,
  Tooltip,
} from 'antd'
import { open, save } from '@tauri-apps/plugin-dialog'
import { convertFileSrc } from '@tauri-apps/api/core'
import dayjs from 'dayjs'
import { getStorageInfo, getSystemConfig, getSystemInfo, saveSystemConfig, uploadCompanyLogo, backupDatabase, restoreDatabase } from '../../../services/systemConfigService'
import { cleanOperationLogs } from '../../../services/operationLogService'
import { handleFormSubmitError } from '../../../utils/errorHandler'

const APP_ICON = '/icon.png'

const CONFIG_KEYS = ['company_name', 'company_phone', 'company_address', 'company_tax_id', 'company_logo']

const LOG_CLEAN_OPTIONS = [
  { label: '最近7天', value: 7 },
  { label: '最近30天', value: 30 },
  { label: '最近90天', value: 90 },
  { label: '全部日志', value: 0 },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company')

  return (
    <div className="space-y-4">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'company', label: '公司信息', icon: <BankOutlined /> },
          { key: 'data', label: '数据管理', icon: <DatabaseOutlined /> },
          { key: 'about', label: '关于系统', icon: <InfoCircleOutlined /> },
        ]}
      />
      {activeTab === 'company' && <CompanyInfoTab />}
      {activeTab === 'data' && <DataManagerTab />}
      {activeTab === 'about' && <AboutSystemTab />}
    </div>
  )
}

function CompanyInfoTab() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [initialValues, setInitialValues] = useState<Record<string, string>>({})

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const configs = await getSystemConfig(CONFIG_KEYS)
      form.setFieldsValue({
        company_name: configs.company_name || '',
        company_phone: configs.company_phone || '',
        company_address: configs.company_address || '',
        company_tax_id: configs.company_tax_id || '',
      })
      setInitialValues({
        company_name: configs.company_name || '',
        company_phone: configs.company_phone || '',
        company_address: configs.company_address || '',
        company_tax_id: configs.company_tax_id || '',
      })
      if (configs.company_logo) {
        try {
          setLogoUrl(convertFileSrc(configs.company_logo))
        } catch {
          setLogoUrl(null)
        }
      }
    } catch (err) {
      message.error('加载公司信息失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const configs: Record<string, string> = {}
      if (values.company_name !== undefined) configs.company_name = values.company_name
      if (values.company_phone !== undefined) configs.company_phone = values.company_phone
      if (values.company_address !== undefined) configs.company_address = values.company_address
      if (values.company_tax_id !== undefined) configs.company_tax_id = values.company_tax_id
      await saveSystemConfig(configs)
      setInitialValues({ ...initialValues, ...configs })
      message.success('保存成功')
    } catch (err: unknown) {
      handleFormSubmitError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'svg'] }],
      })
      if (!selected) return

      const filePath = typeof selected === 'string' ? selected : (Array.isArray(selected) ? selected[0] : '')
      if (!filePath) return

      const result = await uploadCompanyLogo(filePath)
      try {
        setLogoUrl(convertFileSrc(result.file_path))
      } catch {
        setLogoUrl(null)
      }
      message.success('Logo上传成功')
    } catch (err) {
      message.error('Logo上传失败')
    }
  }

  const currentValues = Form.useWatch([], form)
  const isModified = JSON.stringify(currentValues) !== JSON.stringify({
    company_name: initialValues.company_name,
    company_phone: initialValues.company_phone,
    company_address: initialValues.company_address,
    company_tax_id: initialValues.company_tax_id,
  })

  return (
    <Spin spinning={loading}>
      <div className="rounded-xl p-6" style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}>
        <div className="flex gap-8">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:border-[var(--gl-primary)]"
              style={{ borderColor: 'var(--gl-border)', background: 'var(--gl-primary-bg)' }}
              onClick={handleLogoUpload}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-lg object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <CloudUploadOutlined style={{ fontSize: 24, color: 'var(--gl-text-tertiary)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--gl-text-tertiary)' }}>上传Logo</span>
                </div>
              )}
            </div>
            <span className="text-[11px]" style={{ color: 'var(--gl-text-tertiary)' }}>
              支持 JPG/PNG/SVG，不超过5MB
            </span>
          </div>

          <Form form={form} layout="vertical" className="flex-1">
            <div className="grid grid-cols-2 gap-x-6">
              <Form.Item label="公司名称" name="company_name" rules={[{ required: true, message: '请输入公司名称' }]}>
                <Input prefix={<HomeOutlined />} placeholder="请输入公司名称" />
              </Form.Item>
              <Form.Item label="联系电话" name="company_phone">
                <Input prefix={<PhoneOutlined />} placeholder="请输入联系电话" />
              </Form.Item>
              <Form.Item label="公司地址" name="company_address">
                <Input placeholder="请输入公司地址" />
              </Form.Item>
              <Form.Item label="税号" name="company_tax_id">
                <Input placeholder="请输入纳税人识别号" />
              </Form.Item>
            </div>
          </Form>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!isModified}
            onClick={handleSave}
          >
            保存
          </Button>
        </div>
      </div>
    </Spin>
  )
}

function DataManagerTab() {
  const [storageInfo, setStorageInfo] = useState<{ db_size: number; log_count: number } | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [cleanDays, setCleanDays] = useState(30)
  const [cleanLoading, setCleanLoading] = useState(false)

  const fetchStorageInfo = useCallback(async () => {
    try {
      const info = await getStorageInfo()
      setStorageInfo(info)
    } catch { /* 存储信息加载失败不阻塞 */ }
  }, [])

  useEffect(() => { fetchStorageInfo() }, [fetchStorageInfo])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleBackup = async () => {
    try {
      setBackupLoading(true)
      const destPath = await save({
        defaultPath: `管用GL_备份_${dayjs().format('YYYYMMDD_HHmmss')}.db`,
        filters: [{ name: '数据库备份', extensions: ['db'] }],
      })
      if (!destPath) { setBackupLoading(false); return }

      const result = await backupDatabase(destPath)
      message.success(`备份成功！文件大小：${formatSize(result.file_size)}`)
      fetchStorageInfo()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      message.error(`备份失败：${msg}`)
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestore = async () => {
    try {
      const sourcePath = await open({
        multiple: false,
        filters: [{ name: '数据库备份', extensions: ['db'] }],
      })
      if (!sourcePath) return

      const filePath = typeof sourcePath === 'string' ? sourcePath : (Array.isArray(sourcePath) ? sourcePath[0] : '')
      if (!filePath) return

      Modal.confirm({
        title: '确认恢复数据库',
        icon: <ExclamationCircleOutlined />,
        content: '恢复操作将覆盖当前所有数据，且不可撤销。系统会先自动备份当前数据库。确定要继续吗？',
        okText: '确认恢复',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            setRestoreLoading(true)
            const result = await restoreDatabase(filePath)
            if (result.need_restart) {
              Modal.success({
                title: '恢复成功',
                content: '数据库已成功恢复。请重启应用以使更改完全生效。',
                okText: '我知道了',
              })
            }
            fetchStorageInfo()
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            message.error(`恢复失败：${msg}`)
          } finally {
            setRestoreLoading(false)
          }
        },
      })
    } catch { /* user cancelled */ }
  }

  const handleCleanLogs = async () => {
    const startDate = cleanDays === 0
      ? '2000-01-01'
      : dayjs().subtract(cleanDays, 'day').format('YYYY-MM-DD')
    const endDate = dayjs().format('YYYY-MM-DD')

    Modal.confirm({
      title: '确认清理日志',
      icon: <ExclamationCircleOutlined />,
      content: cleanDays === 0
        ? '将清理所有操作日志，此操作不可撤销。确定要继续吗？'
        : `将清理最近 ${cleanDays} 天的操作日志，此操作不可撤销。确定要继续吗？`,
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setCleanLoading(true)
          const result = await cleanOperationLogs(startDate, endDate)
          message.success(`清理完成，共删除 ${result.deleted_count} 条日志`)
          fetchStorageInfo()
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          message.error(`清理失败：${msg}`)
        } finally {
          setCleanLoading(false)
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}>
        <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--gl-text-primary)' }}>存储信息</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4" style={{ background: 'var(--gl-primary-bg)' }}>
            <Statistic
              title={<span style={{ color: 'var(--gl-text-secondary)', fontSize: 12 }}>数据库大小</span>}
              value={storageInfo ? formatSize(storageInfo.db_size) : '-'}
              valueStyle={{ color: 'var(--gl-primary)', fontSize: 20, fontWeight: 600 }}
              prefix={<DatabaseOutlined />}
            />
          </div>
          <div className="rounded-lg p-4" style={{ background: 'var(--gl-primary-bg)' }}>
            <Statistic
              title={<span style={{ color: 'var(--gl-text-secondary)', fontSize: 12 }}>操作日志</span>}
              value={storageInfo?.log_count ?? '-'}
              valueStyle={{ color: 'var(--gl-primary)', fontSize: 20, fontWeight: 600 }}
              suffix="条"
              prefix={<InfoCircleOutlined />}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}>
        <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--gl-text-primary)' }}>数据备份</div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--gl-text-secondary)' }}>
          将当前数据库完整备份到本地文件，用于数据安全保护。
        </p>
        <Button
          type="primary"
          icon={<DatabaseOutlined />}
          loading={backupLoading}
          onClick={handleBackup}
        >
          备份数据库
        </Button>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}>
        <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--gl-text-primary)' }}>数据恢复</div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--gl-text-secondary)' }}>
          从备份文件恢复数据库。恢复前系统会自动备份当前数据，恢复后需要重启应用。
        </p>
        <Button
          danger
          icon={<DatabaseOutlined />}
          loading={restoreLoading}
          onClick={handleRestore}
        >
          恢复数据库
        </Button>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}>
        <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--gl-text-primary)' }}>日志清理</div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--gl-text-secondary)' }}>
          按时间范围批量清理操作日志，释放存储空间。
        </p>
        <div className="flex items-center gap-3">
          <Select
            value={cleanDays}
            onChange={setCleanDays}
            options={LOG_CLEAN_OPTIONS}
            style={{ width: 160 }}
            size="small"
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={cleanLoading}
            onClick={handleCleanLogs}
          >
            清理日志
          </Button>
        </div>
      </div>
    </div>
  )
}

function AboutSystemTab() {
  const [systemInfo, setSystemInfo] = useState<{
    app_name: string
    app_version: string
    db_version: number
    os_info: string
    db_path: string
    data_dir: string
  } | null>(null)

  useEffect(() => {
    getSystemInfo().then(setSystemInfo).catch((err) => {
      console.error('获取系统信息失败:', err)
      message.error('获取系统信息失败')
    })
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success('已复制到剪贴板'),
      () => message.error('复制失败'),
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-6" style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}>
        <div className="flex items-center gap-5 mb-6">
          <img
            src={APP_ICON}
            alt="管用GL"
            className="w-16 h-16 rounded-2xl object-contain"
          />
          <div>
            <div className="text-xl font-bold" style={{ color: 'var(--gl-text-primary)' }}>
              {systemInfo?.app_name || '管用GL'}
            </div>
            <div className="text-[13px]" style={{ color: 'var(--gl-text-secondary)' }}>
              企业资源管理平台
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--gl-text-tertiary)' }}>
              v{systemInfo?.app_version || '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}>
        <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--gl-text-primary)' }}>系统信息</div>
        <Descriptions column={1} size="small" colon={false} labelStyle={{ color: 'var(--gl-text-secondary)', fontSize: 12, width: 100 }} contentStyle={{ color: 'var(--gl-text-primary)', fontSize: 12 }}>
          <Descriptions.Item label="应用版本">v{systemInfo?.app_version || '-'}</Descriptions.Item>
          <Descriptions.Item label="数据库版本">v{systemInfo?.db_version ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="操作系统">{systemInfo?.os_info || '-'}</Descriptions.Item>
          <Descriptions.Item label="数据目录">
            <div className="flex items-center gap-2">
              <span className="text-[11px] break-all" style={{ color: 'var(--gl-text-tertiary)' }}>{systemInfo?.data_dir || '-'}</span>
              {systemInfo?.data_dir && (
                <Tooltip title="复制路径">
                  <CopyOutlined className="cursor-pointer" style={{ color: 'var(--gl-primary)' }} onClick={() => copyToClipboard(systemInfo.data_dir)} />
                </Tooltip>
              )}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="数据库路径">
            <div className="flex items-center gap-2">
              <span className="text-[11px] break-all" style={{ color: 'var(--gl-text-tertiary)' }}>{systemInfo?.db_path || '-'}</span>
              {systemInfo?.db_path && (
                <Tooltip title="复制路径">
                  <CopyOutlined className="cursor-pointer" style={{ color: 'var(--gl-primary)' }} onClick={() => copyToClipboard(systemInfo.db_path)} />
                </Tooltip>
              )}
            </div>
          </Descriptions.Item>
        </Descriptions>
      </div>
    </div>
  )
}
