/** @file 状态标签组件 - 4色系(success/warning/error/info)业务状态展示 */
import type { ReactNode } from 'react'

type StatusType = 'success' | 'warning' | 'error' | 'info'

interface StatusBadgeProps {
  type: StatusType
  children: ReactNode
}

const typeStyles: Record<StatusType, string> = {
  success: 'bg-[var(--gl-success-bg)] text-[var(--gl-success)]',
  warning: 'bg-[var(--gl-warning-bg)] text-[var(--gl-warning)]',
  error: 'bg-[var(--gl-error-bg)] text-[var(--gl-error)]',
  info: 'bg-[var(--gl-info-bg)] text-[var(--gl-info)]',
}

export default function StatusBadge({ type, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[var(--gl-radius-sm)] text-[var(--gl-font-size-xs)] font-medium ${typeStyles[type]}`}
    >
      {children}
    </span>
  )
}
