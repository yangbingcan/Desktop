/** @file 占位页面 - 统一占位态展示，用于未完成功能的页面 */
import type { ReactNode } from 'react'

interface PlaceholderPageProps {
  icon: ReactNode
  title: string
  description: string
  gradient?: string
}

export default function PlaceholderPage({
  icon,
  title,
  description,
  gradient,
}: PlaceholderPageProps) {
  return (
    <div
      className="rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px]"
      style={{ background: 'var(--gl-card-bg)', border: '1px solid var(--gl-border)' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl text-white mb-5"
        style={{
          background: gradient || 'linear-gradient(135deg, #2563EB, #3B82F6)',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.08)',
        }}
      >
        {icon}
      </div>
      <h3
        className="text-[15px] font-semibold mb-2"
        style={{ color: 'var(--gl-text-primary)' }}
      >
        {title}
      </h3>
      <p className="text-[13px] max-w-[280px] text-center" style={{ color: 'var(--gl-text-secondary)' }}>
        {description}
      </p>
      <p className="text-[11px] mt-3" style={{ color: 'var(--gl-text-tertiary)' }}>
        敬请期待，功能开发中
      </p>
    </div>
  )
}