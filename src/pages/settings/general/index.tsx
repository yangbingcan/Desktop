/** @file 系统设置（占位） */
import { SettingOutlined } from '@ant-design/icons'
import PlaceholderPage from '../../../components/common/PlaceholderPage'

export default function SettingsPage() {
  return (
    <PlaceholderPage
      icon={<SettingOutlined />}
      title="系统设置"
      description="系统参数配置、日志管理、数据备份与恢复"
      gradient="linear-gradient(135deg, #64748B, #475569)"
    />
  )
}