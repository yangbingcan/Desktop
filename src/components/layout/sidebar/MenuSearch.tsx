/** @file 菜单搜索 - 侧边栏顶部搜索框，支持按菜单名称过滤 */
import { SearchOutlined } from '@ant-design/icons'
import { Input } from 'antd'

/** MenuSearch 组件属性 */
interface MenuSearchProps {
  /** 搜索文本 */
  searchText: string
  /** 搜索文本变更回调 */
  onSearchChange: (text: string) => void
  /** 是否折叠（折叠时不显示搜索框） */
  collapsed: boolean
}

export default function MenuSearch({ searchText, onSearchChange, collapsed }: MenuSearchProps) {
  if (collapsed) return null

  return (
    <div className="px-3 pt-3 pb-1 flex-shrink-0">
      <Input
        prefix={<SearchOutlined style={{ color: 'var(--gl-text-tertiary)', fontSize: 12 }} />}
        placeholder="搜索菜单..."
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        size="small"
        allowClear
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--gl-primary)'
          e.target.style.borderWidth = '2px'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--gl-border)'
          e.target.style.borderWidth = '1px'
        }}
        style={{
          borderRadius: 'var(--gl-radius-md)',
          background: 'var(--gl-card-bg)',
          borderColor: 'var(--gl-border)',
          borderWidth: 1,
          height: 32,
          fontSize: 'var(--gl-font-size-sm)',
          transition: 'border-color 0.2s ease, background 0.2s ease',
        }}
      />
    </div>
  )
}
