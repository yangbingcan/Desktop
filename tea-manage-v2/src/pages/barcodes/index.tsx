/** @file 条码打印页 - V2 Phase 1 占位页面 */
import { Card, Empty } from 'antd'
import { BarcodeOutlined } from '@ant-design/icons'

export default function BarcodePage() {
  return (
    <div className="p-4">
      <Card title={<><BarcodeOutlined /> 条码打印</>}>
        <Empty description="条码生成与打印功能开发中..." />
      </Card>
    </div>
  )
}
