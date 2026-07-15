/** @file 全局错误边界 - 捕获 React 组件树中的未处理错误，显示友好提示 */
import { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 输出到控制台便于调试
    console.error('应用错误边界捕获到异常:', error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleGoHome = (): void => {
    window.location.href = '/'
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: '100vh', background: 'var(--gl-bg)' }}
        >
          <Result
            status="500"
            title="应用遇到问题"
            subTitle="抱歉，应用出现了意外错误。您可以尝试刷新页面或返回首页。"
            extra={[
              <Button type="primary" key="reload" onClick={this.handleReload}>
                刷新页面
              </Button>,
              <Button key="home" onClick={this.handleGoHome}>
                返回首页
              </Button>,
            ]}
            style={{
              background: 'var(--gl-bg-card)',
              borderRadius: 16,
              padding: '48px 64px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            }}
          />
        </div>
      )
    }

    return this.props.children
  }
}
