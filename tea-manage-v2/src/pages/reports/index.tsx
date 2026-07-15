/** @file 报表分析页 - V2 Phase 1 占位页面 */
import { Card, Empty } from 'antd'
import { BarChartOutlined } from '@ant-design/icons'

export default function ReportPage() {
  return (
    <div className="p-4">
      <Card title={<><BarChartOutlined /> 报表分析</>}>
        <Empty description="报表分析功能开发中..." />
      </Card>
    </div>
  )
}
