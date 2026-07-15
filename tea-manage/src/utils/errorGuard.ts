/**
 * @file 全局错误守卫
 * @description v0.7.1 回归加固 —— 防止任何运行时异常导致整页白屏（无任何提示）。
 * 通过 window 级错误捕获 + Vue errorHandler，将错误以可见面板呈现，
 * 便于定位问题而非面对空白窗口。
 */

let overlayEl: HTMLDivElement | null = null

/** 在 #app 之外渲染错误面板（即便根节点被 Vue 卸载也不受影响） */
function renderOverlay(message: string, detail?: string) {
  if (typeof document === 'undefined') return
  if (!overlayEl) {
    overlayEl = document.createElement('div')
    overlayEl.setAttribute('data-error-guard', '1')
    Object.assign(overlayEl.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      background: 'rgba(20,20,20,0.96)',
      color: '#fff',
      font: '14px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
      padding: '32px',
      overflow: 'auto',
      boxSizing: 'border-box',
    } as CSSStyleDeclaration)
    document.body.appendChild(overlayEl)
  }
  const time = new Date().toLocaleTimeString('zh-CN')
  overlayEl.innerHTML = `
    <div style="max-width:760px;margin:0 auto;">
      <div style="font-size:18px;font-weight:700;color:#ff7875;margin-bottom:12px;">
        应用运行出错（已捕获，未被静默忽略）
      </div>
      <div style="color:#ffccc7;white-space:pre-wrap;word-break:break-all;background:#000;padding:12px;border-radius:6px;">
        ${escapeHtml(message)}
        ${detail ? '\n\n' + escapeHtml(detail) : ''}
      </div>
      <div style="margin-top:12px;color:#999;font-size:12px;">发生时间：${time}</div>
      <div style="margin-top:8px;color:#999;font-size:12px;">
        请将以上内容反馈给开发者以便定位。部分功能可能已不可用，建议重启应用。
      </div>
    </div>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c
  )
}

/**
 * 安装全局错误守卫
 * - window.onerror / unhandledrejection：捕获脚本级未处理异常（含模块加载失败后的连锁错误）
 * - 返回供 Vue app.config.errorHandler 调用的处理函数
 */
export function installErrorGuard() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (e) => {
    const err = e.error || e
    renderOverlay(
      err?.message || String(e.message || e),
      err?.stack || `${e.filename}:${e.lineno}:${e.colno}`
    )
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason
    renderOverlay(
      '未处理的 Promise 异常：' + (reason?.message || String(reason)),
      reason?.stack
    )
  })
}

/** 供 Vue errorHandler 使用 */
export function vueErrorHandler(err: unknown, _instance: unknown, info: string) {
  const e = err as Error
  renderOverlay('Vue 渲染/逻辑异常：' + (e?.message || String(err)), e?.stack || info)
}
