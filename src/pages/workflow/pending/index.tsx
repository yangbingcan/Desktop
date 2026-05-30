/** @file 流程审批（占位） */
import { AuditOutlined } from '@ant-design/icons'
import PlaceholderPage from '../../../components/common/PlaceholderPage'

export default function WorkflowPage() {
  return (
    <PlaceholderPage
      icon={<AuditOutlined />}
      title="流程审批"
      description="自定义审批流配置，支持多级审批、条件分支和催办提醒"
      gradient="linear-gradient(135deg, #F59E0B, #D97706)"
    />
  )
}