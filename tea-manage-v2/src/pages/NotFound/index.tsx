/** @file 404 页面 - 路由未匹配时的兜底页面 */
import { useNavigate } from 'react-router-dom'
import { Result, Button } from 'antd'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: '100%', background: 'var(--gl-bg)' }}
    >
      <Result
        status="404"
        title="404"
        subTitle="抱歉，您访问的页面不存在。"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回仪表盘
          </Button>
        }
      />
    </div>
  )
}
