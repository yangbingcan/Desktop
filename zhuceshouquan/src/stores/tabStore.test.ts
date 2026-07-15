/** @file TabStore 状态管理单元测试 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useTabStore } from './tabStore'

describe('useTabStore', () => {
  beforeEach(() => {
    useTabStore.getState().resetTabs()
  })

  it('初始应有仪表盘标签页', () => {
    const state = useTabStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].key).toBe('/dashboard')
    expect(state.activeKey).toBe('/dashboard')
  })

  it('addTab 应添加新标签页', () => {
    useTabStore.getState().addTab({
      key: '/settings',
      title: '系统设置',
      closable: true,
    })

    const state = useTabStore.getState()
    expect(state.tabs).toHaveLength(2)
    expect(state.activeKey).toBe('/settings')
  })

  it('addTab 不应添加重复标签页', () => {
    useTabStore.getState().addTab({
      key: '/dashboard',
      title: '仪表盘',
      closable: false,
    })

    const state = useTabStore.getState()
    expect(state.tabs).toHaveLength(1)
  })

  it('removeTab 应移除标签页并切换激活', () => {
    useTabStore.getState().addTab({ key: '/user', title: '用户', closable: true })
    useTabStore.getState().addTab({ key: '/settings', title: '设置', closable: true })

    // 当前激活 /settings
    expect(useTabStore.getState().activeKey).toBe('/settings')

    // 移除 /settings，应切换到前一个
    useTabStore.getState().removeTab('/settings')
    const state = useTabStore.getState()

    expect(state.tabs).toHaveLength(2)
    expect(state.activeKey).toBe('/user')
  })

  it('removeTab 不应移除不可关闭的标签页', () => {
    useTabStore.getState().removeTab('/dashboard')
    expect(useTabStore.getState().tabs).toHaveLength(1)
  })

  it('closeOtherTabs 应只保留指定和不可关闭的标签页', () => {
    useTabStore.getState().addTab({ key: '/user', title: '用户', closable: true })
    useTabStore.getState().addTab({ key: '/settings', title: '设置', closable: true })

    useTabStore.getState().closeOtherTabs('/user')
    const state = useTabStore.getState()

    expect(state.tabs).toHaveLength(2) // dashboard + user
    expect(state.activeKey).toBe('/user')
  })

  it('closeAllTabs 应只保留不可关闭的标签页', () => {
    useTabStore.getState().addTab({ key: '/user', title: '用户', closable: true })
    useTabStore.getState().addTab({ key: '/settings', title: '设置', closable: true })

    useTabStore.getState().closeAllTabs()
    const state = useTabStore.getState()

    expect(state.tabs).toHaveLength(1) // only dashboard
    expect(state.activeKey).toBe('/dashboard')
  })
})
