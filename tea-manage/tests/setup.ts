/**
 * @file Vitest 全局测试装置
 * @description v0.7.1 回归修复 —— vitest.config.ts 声明需 mock @tauri-apps/api/core 的 invoke，
 * 但此前缺失 setupFiles 导致组件测试直接调用真实 invoke，在 jsdom 中因
 * window.__TAURI_INTERNALS__ 不存在而抛 "reading 'invoke' of undefined"，
 * 进而组件 onMounted 抛错、DOM 渲染失败。
 * 此处提供全局 invoke mock：依据命令名返回合理的空/默认数据，
 * 使组件在数据缺失时仍能正常渲染（与真实 Tauri 环境行为一致：invoke 成功返回数据）。
 */
import { vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    // 列表/查询类：返回空数组，组件做 .map / v-for 安全
    if (/list|inventory|all|search|history|orders|items|records|units|detail/i.test(cmd)) {
      return []
    }
    // 首页概览
    if (cmd === 'get_dashboard_stats') {
      return { todayOrders: 0, todaySales: 0, lowStockCount: 0, newMembers: 0 }
    }
    // 版本号
    if (cmd === 'get_version') return '0.7.1'
    // 设置/配置类：返回空对象
    return {}
  }),
}))
