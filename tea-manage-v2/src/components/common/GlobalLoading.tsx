/** @file 全局加载状态 - 网络请求/操作等待时显示顶部进度条 */
import { useEffect } from 'react'
import nprogress from 'nprogress'
import 'nprogress/nprogress.css'

nprogress.configure({ showSpinner: false, speed: 300, trickleSpeed: 100, minimum: 0.15 })

export function startLoading() {
  nprogress.start()
}

export function stopLoading() {
  nprogress.done()
}

export default function GlobalLoading() {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      #nprogress .bar { background: var(--gl-primary) !important; height: 2px !important; }
      #nprogress .peg { box-shadow: 0 0 8px var(--gl-primary), 0 0 4px var(--gl-primary) !important; }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  return null
}