/** @file 表单设计器（占位） */
import { FormOutlined } from '@ant-design/icons'
import PlaceholderPage from '../../components/common/PlaceholderPage'

export default function FormDesignerPage() {
  return (
    <PlaceholderPage
      icon={<FormOutlined />}
      title="表单设计器"
      description="拖拽式低代码表单构建工具，支持丰富的字段类型和自定义校验规则"
      gradient="linear-gradient(135deg, #3B82F6, #2563EB)"
    />
  )
}