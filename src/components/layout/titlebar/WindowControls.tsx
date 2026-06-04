/** @file 窗口控制按钮 - 最小化、最大化/还原、关闭 */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MinusOutlined,
  BorderOutlined,
  BlockOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { getCurrentWindow } from '@tauri-apps/api/window'

export default function WindowControls() {
  const appWindow = useMemo(() => getCurrentWindow(), [])
  const unlistenRef = useRef<(() => void) | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized).catch((e) => console.warn('获取窗口状态失败:', e))
    appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch((e) => console.warn('获取窗口状态失败:', e))
    }).then(fn => { unlistenRef.current = fn })
    return () => { unlistenRef.current?.() }
  }, [])

  const handleMinimize = () => {
    appWindow.minimize().catch((e) => console.error('窗口最小化失败:', e))
  }

  const handleToggleMaximize = async () => {
    await appWindow.toggleMaximize()
    setIsMaximized(await appWindow.isMaximized())
  }

  const handleClose = () => {
    appWindow.close().catch((e) => console.error('窗口关闭失败:', e))
  }

  return (
    <div className="flex items-center flex-shrink-0" style={{ height: 32 }}>
      <div
        className="gl-icon-btn flex items-center justify-center cursor-pointer transition-all"
        style={{ width: 46, height: 32, color: 'var(--gl-text-secondary)' }}
        onClick={handleMinimize}
        aria-label="最小化"
      >
        <MinusOutlined style={{ fontSize: 12 }} />
      </div>
      <div
        className="gl-icon-btn flex items-center justify-center cursor-pointer transition-all"
        style={{ width: 46, height: 32, color: 'var(--gl-text-secondary)' }}
        onClick={handleToggleMaximize}
        aria-label={isMaximized ? '还原' : '最大化'}
      >
        {isMaximized ? <BlockOutlined style={{ fontSize: 12 }} /> : <BorderOutlined style={{ fontSize: 12 }} />}
      </div>
      <div
        className="gl-win-close flex items-center justify-center cursor-pointer transition-all"
        style={{ width: 46, height: 32, color: 'var(--gl-text-secondary)' }}
        onClick={handleClose}
        aria-label="关闭"
      >
        <CloseOutlined style={{ fontSize: 12 }} />
      </div>
    </div>
  )
}
