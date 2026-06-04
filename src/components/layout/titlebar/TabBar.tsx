/** @file 标签页栏 - 管理打开的标签页列表、关闭标签、右键菜单和拖拽排序 */
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  LeftOutlined,
  RightOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { Dropdown, type MenuProps } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTabStore } from '../../../stores/tabStore'

/** TabBar 组件属性 */
interface TabBarProps {
  /** 双击标题栏时的回调（用于双击标签页关闭） */
  onTitlebarDoubleClick: (e: React.MouseEvent) => void
}

export default function TabBar({ onTitlebarDoubleClick }: TabBarProps) {
  const { tabs, activeKey, removeTab, setActiveKey, closeOtherTabs, closeAllTabs, closeLeftTabs, closeRightTabs, moveTab } = useTabStore()
  const navigate = useNavigate()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [showLeftMask, setShowLeftMask] = useState(false)
  const [showRightMask, setShowRightMask] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const resizeTimer = useRef<ReturnType<typeof setTimeout>>()

  /** 检查标签页容器是否溢出，更新左右遮罩状态 */
  const checkOverflow = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth
    setShowLeftMask(overflow && el.scrollLeft > 2)
    setShowRightMask(overflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    checkOverflow()
    const handleResize = () => {
      clearTimeout(resizeTimer.current)
      resizeTimer.current = setTimeout(checkOverflow, 150)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer.current)
    }
  }, [tabs, checkOverflow])

  /** 标签页左右滚动 */
  const handleTabScroll = (direction: 'left' | 'right') => {
    const el = tabsRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' })
    setTimeout(checkOverflow, 300)
  }

  /** 鼠标滚轮横向滚动 */
  const handleWheel = (e: React.WheelEvent) => {
    e.currentTarget.scrollBy({ left: e.deltaY, behavior: 'auto' })
    setTimeout(checkOverflow, 50)
  }

  /** 生成标签页右键菜单 */
  const getContextMenu = (tab: typeof tabs[0], idx: number): MenuProps => {
    const items: MenuProps['items'] = []
    if (tab.closable !== false) {
      items.push({ key: 'close', label: '关闭', icon: <CloseOutlined /> })
    }
    if (tabs.length > 1) {
      items.push({ key: 'closeOthers', label: '关闭其他' })
      items.push({ key: 'closeAll', label: '关闭所有' })
    }
    if (idx > 0 && tabs.slice(0, idx).some((t) => t.closable !== false)) {
      items.push({ key: 'closeLeft', label: '关闭左边' })
    }
    if (idx < tabs.length - 1 && tabs.slice(idx + 1).some((t) => t.closable !== false)) {
      items.push({ key: 'closeRight', label: '关闭右边' })
    }
    return {
      items,
      onClick: ({ key }) => {
        switch (key) {
          case 'close': removeTab(tab.key); break
          case 'closeOthers': closeOtherTabs(tab.key); break
          case 'closeAll': closeAllTabs(); break
          case 'closeLeft': closeLeftTabs(tab.key); break
          case 'closeRight': closeRightTabs(tab.key); break
        }
      },
    }
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== idx) {
      moveTab(dragIndex, idx)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div
      data-tauri-drag-region
      className="flex-1 flex items-center relative h-full overflow-hidden"
      style={{ minWidth: 0 }}
      onDoubleClick={onTitlebarDoubleClick}
    >
      <div className={`gl-mask-left ${showLeftMask ? 'gl-mask-visible' : ''}`} />

      {showLeftMask && (
        <div
          className="gl-icon-btn flex-shrink-0 flex items-center justify-center cursor-pointer h-full rounded-sm transition-all z-10"
          style={{ width: 24, color: 'var(--gl-text-tertiary)' }}
          onClick={() => handleTabScroll('left')}
        >
          <LeftOutlined style={{ fontSize: 10 }} />
        </div>
      )}

      <div
        ref={tabsRef}
        data-tauri-drag-region
        className="flex items-center h-full overflow-hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', flex: 1 }}
        onScroll={checkOverflow}
        onWheel={handleWheel}
      >
        {tabs.map((tab, idx) => {
          const isActive = activeKey === tab.key
          const isDragging = dragIndex === idx
          const isDragOver = dragOverIndex === idx
          return (
            <Dropdown
              key={tab.key}
              menu={getContextMenu(tab, idx)}
              trigger={['contextMenu']}
            >
              <div
                data-tab-key={tab.key}
                data-tab-closable={tab.closable !== false ? 'true' : 'false'}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => { setActiveKey(tab.key); navigate(tab.key) }}
                className="flex items-center gap-1.5 h-8 px-3 cursor-pointer transition-all flex-shrink-0 text-[13px] relative select-none"
                style={{
                  maxWidth: 160,
                  color: isActive ? 'var(--gl-primary)' : 'var(--gl-text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  opacity: isDragging ? 0.4 : 1,
                  borderLeft: isDragOver && dragIndex !== null && dragIndex !== idx ? '2px solid var(--gl-primary)' : '2px solid transparent',
                  borderRadius: isActive ? 'var(--gl-radius-sm)' : 0,
                  background: isActive ? 'var(--gl-primary-supply)' : 'transparent',
                }}
              >
                <span className="truncate">{tab.title}</span>
                {tab.closable !== false && (
                  <span
                    onClick={(e) => { e.stopPropagation(); removeTab(tab.key) }}
                    className="gl-tab-close flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 transition-all"
                    style={{ color: 'var(--gl-text-tertiary)', fontSize: 10 }}
                  >
                    <CloseOutlined />
                  </span>
                )}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-2 right-2 rounded-full"
                    style={{ height: 2, background: 'var(--gl-primary)', transition: 'all var(--gl-transition-fast)' }}
                  />
                )}
              </div>
            </Dropdown>
          )
        })}
      </div>

      {showRightMask && (
        <div
          className="gl-icon-btn flex-shrink-0 flex items-center justify-center cursor-pointer h-full rounded-sm transition-all z-10"
          style={{ width: 24, color: 'var(--gl-text-tertiary)' }}
          onClick={() => handleTabScroll('right')}
        >
          <RightOutlined style={{ fontSize: 10 }} />
        </div>
      )}

      <div className={`gl-mask-right ${showRightMask ? 'gl-mask-visible' : ''}`} />
    </div>
  )
}
