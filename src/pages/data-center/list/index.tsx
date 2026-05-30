/** @file 数据中心（占位） */
import { DatabaseOutlined } from '@ant-design/icons'
import PlaceholderPage from '../../../components/common/PlaceholderPage'

export default function DataCenterPage() {
  return (
    <PlaceholderPage
      icon={<DatabaseOutlined />}
      title="数据中心"
      description="集中管理所有表单提交数据，支持高级搜索、批量导出和数据分析"
      gradient="linear-gradient(135deg, #10B981, #059669)"
    />
  )
}