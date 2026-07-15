/** @file 打印模板页 - V2 Phase 1 占位页面 */
import { Card, Empty } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'

export default function PrintTemplatePage() {
  return (
    <div className="p-4">
      <Card title={<><PrinterOutlined /> 打印模板设计器</>}>
        <Empty description="打印模板设计功能开发中..." />
      </Card>
    </div>
  )
}
