/** @file 侧边栏底部 - 折叠/展开按钮 */
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../stores/appStore'

/** SidebarFooter 组件属性 */
interface SidebarFooterProps {
  /** 是否折叠 */
  collapsed: boolean
}

export default function SidebarFooter({ collapsed }: SidebarFooterProps) {
  const { toggleSidebar } = useAppStore()

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center py-2 border-t"
      style={{ borderColor: 'var(--gl-titlebar-border)' }}
    >
      <div
        className="gl-icon-btn flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-all"
        style={{ color: 'var(--gl-text-secondary)' }}
        onClick={toggleSidebar}
        title={collapsed ? '展开菜单' : '折叠菜单'}
      >
        {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 14 }} /> : <MenuFoldOutlined style={{ fontSize: 14 }} />}
      </div>
    </div>
  )
}
