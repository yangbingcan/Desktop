/** @file 主布局 v2.2 - 自定义标题栏 + 侧边栏 + 内容区，融合式一体化，标签与路由同步（防循环） */
import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import ThemeSettings from './ThemeSettings'
import { useTabStore } from '../../stores/tabStore'

/** AppLayout 组件属性 */
interface AppLayoutProps {
  /** 可选子内容，提供时替代Outlet渲染（用于强制改密等场景） */
  children?: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeKey } = useTabStore()
  /** 防止两个 useEffect 互相触发导致循环更新 */
  const isUpdatingRef = useRef(false)

  /* 标签 activeKey 与路由同步：当标签切换（关闭/右键操作）导致 activeKey 变化但路由未变时，同步路由 */
  useEffect(() => {
    if (isUpdatingRef.current) return
    if (activeKey !== location.pathname) {
      isUpdatingRef.current = true
      navigate(activeKey, { replace: true })
    }
  }, [activeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* 路由变化时同步标签 activeKey（如浏览器前进后退），忽略标签触发的同步 */
  useEffect(() => {
    if (isUpdatingRef.current) {
      // 上一次是标签触发同步路由，路由已变化，重置标记并跳过
      isUpdatingRef.current = false
      return
    }
    if (location.pathname !== activeKey) {
      useTabStore.getState().setActiveKey(location.pathname)
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

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
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      {/* 主题设置面板 */}
      <ThemeSettings />
    </div>
  )
}