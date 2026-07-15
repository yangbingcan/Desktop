/** @file 主布局 v2.0 - 自定义标题栏 + 侧边栏 + 内容区，融合式一体化 */
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import ThemeSettings from './ThemeSettings'
export default function AppLayout() {

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--gl-content-bg)' }}
    >
      {/* 自定义标题栏 */}
      <TitleBar />

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* 侧边栏 */}
        <Sidebar />

        {/* 内容区 */}
        <main
          className="flex-1 overflow-auto"
          style={{ background: 'var(--gl-content-bg)' }}
        >
          <div className="p-5">
            <Outlet />
          </div>
        </main>
      </div>

      {/* 主题设置面板 */}
      <ThemeSettings />
    </div>
  )
}