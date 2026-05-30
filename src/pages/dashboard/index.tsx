/** @file 仪表盘 v2.0 - 毛玻璃卡片+丝滑动画+高级视觉效果 */
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  FormOutlined,
  DatabaseOutlined,
  AuditOutlined,
  UserOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons'

const navigateMap: Record<string, string> = {
  '新建表单': '/form-designer',
  '数据导入': '/data-center',
  '流程配置': '/workflow/pending',
  '用户管理': '/user/list',
}

const stats = [
  {
    title: '活跃表单',
    value: '128',
    change: '+12%',
    up: true,
    icon: <FormOutlined />,
    gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    bg: 'var(--gl-primary-bg)',
  },
  {
    title: '数据记录',
    value: '5,847',
    change: '+8.2%',
    up: true,
    icon: <DatabaseOutlined />,
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    bg: 'var(--gl-success-bg)',
  },
  {
    title: '待审流程',
    value: '23',
    change: '-5%',
    up: false,
    icon: <AuditOutlined />,
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    bg: 'var(--gl-warning-bg)',
  },
  {
    title: '在线用户',
    value: '16',
    change: '+3',
    up: true,
    icon: <UserOutlined />,
    gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    bg: '#F5F3FF',
  },
]

const recentActivities = [
  { time: '10 分钟前', action: '提交了采购申请单', user: '张三', type: 'success' as const },
  { time: '30 分钟前', action: '创建了客户信息表', user: '李四', type: 'info' as const },
  { time: '1 小时前', action: '审批通过库存调拨', user: '王五', type: 'success' as const },
  { time: '2 小时前', action: '修改了销售订单字段', user: '赵六', type: 'warning' as const },
  { time: '3 小时前', action: '删除了测试数据', user: '张三', type: 'error' as const },
]

const quickActions = [
  { label: '新建表单', icon: <FormOutlined />, color: '#2563EB' },
  { label: '数据导入', icon: <DatabaseOutlined />, color: '#10B981' },
  { label: '流程配置', icon: <AuditOutlined />, color: '#F59E0B' },
  { label: '用户管理', icon: <UserOutlined />, color: '#8B5CF6' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-6 flex items-center justify-between relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)',
          boxShadow: '0 12px 36px rgba(37, 99, 235, 0.25)',
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10">
          <h1 className="text-[22px] font-bold text-white mb-1">早上好，管理员 👋</h1>
          <p className="text-[14px] text-blue-100">今天有 23 个待审流程需要处理</p>
          <p className="text-[11px] text-blue-200 mt-1" style={{ opacity: 0.7 }}>以上为演示数据</p>
        </div>
        <div className="flex gap-3 relative z-10">
          <button
            className="px-5 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all hover:bg-white/25"
            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
          >
            查看待办
          </button>
          <button
            className="px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:shadow-lg"
            style={{ background: 'white', color: '#2563EB' }}
          >
            快速创建
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="gl-card-glass p-5 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[16px]"
                style={{ background: stat.gradient, boxShadow: `0 4px 12px ${stat.gradient.includes('3B82F6') ? 'rgba(59, 130, 246, 0.3)' : stat.gradient.includes('10B981') ? 'rgba(16, 185, 129, 0.3)' : stat.gradient.includes('F59E0B') ? 'rgba(245, 158, 11, 0.3)' : 'rgba(139, 92, 246, 0.3)'}` }}
              >
                {stat.icon}
              </div>
              <span
                className={`text-[12px] font-medium flex items-center gap-0.5 ${
                  stat.up ? 'text-[var(--gl-success)]' : 'text-[var(--gl-error)]'
                }`}
              >
                {stat.up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {stat.change}
              </span>
            </div>
            <div className="text-[28px] font-bold mb-1" style={{ color: 'var(--gl-text-primary)' }}>
              {stat.value}
            </div>
            <div className="text-[13px]" style={{ color: 'var(--gl-text-secondary)' }}>
              {stat.title}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 gl-card-glass p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--gl-text-primary)' }}>
              数据趋势
            </h3>
            <div className="flex gap-2">
              {['近7天', '近30天', '近90天'].map((label, i) => (
                <button
                  key={label}
                  className="px-3 py-1 rounded-lg text-[12px] transition-all"
                  style={{
                    background: i === 0 ? 'var(--gl-primary-bg)' : 'transparent',
                    color: i === 0 ? 'var(--gl-primary)' : 'var(--gl-text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: '表单提交', value: 75, color: '#2563EB' },
              { label: '数据录入', value: 62, color: '#10B981' },
              { label: '流程审批', value: 48, color: '#F59E0B' },
              { label: '用户活跃', value: 85, color: '#8B5CF6' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[13px]" style={{ color: 'var(--gl-text-secondary)' }}>
                    {item.label}
                  </span>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--gl-text-primary)' }}>
                    {item.value}%
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--gl-border-light)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.value}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="gl-card-glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--gl-text-primary)' }}>
              最近动态
            </h3>
            <a
              className="text-[12px] flex items-center gap-0.5 transition-colors"
              style={{ color: 'var(--gl-primary)' }}
            >
              查看全部 <RightOutlined style={{ fontSize: 10 }} />
            </a>
          </div>
          <div className="space-y-3.5">
            {recentActivities.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0"
                  style={{
                    background: idx % 2 === 0
                      ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                      : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                    boxShadow: `0 2px 6px ${idx % 2 === 0 ? 'rgba(99, 102, 241, 0.25)' : 'rgba(37, 99, 235, 0.25)'}`,
                  }}
                >
                  {activity.user.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px]" style={{ color: 'var(--gl-text-primary)' }}>
                    <span className="font-medium">{activity.user}</span>
                    <span style={{ color: 'var(--gl-text-secondary)' }}> {activity.action}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <ClockCircleOutlined style={{ fontSize: 11, color: 'var(--gl-text-tertiary)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--gl-text-tertiary)' }}>
                      {activity.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="gl-card-glass p-5">
        <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--gl-text-primary)' }}>
          快捷操作
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 text-left"
              style={{ background: 'var(--gl-hover-bg)', border: '1px solid var(--gl-border-light)' }}
              onClick={() => {
                const path = navigateMap[action.label]
                if (path) navigate(path)
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[15px]"
                style={{ color: action.color, background: `${action.color}12` }}
              >
                {action.icon}
              </div>
              <span className="text-[13px] font-medium" style={{ color: 'var(--gl-text-primary)' }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
