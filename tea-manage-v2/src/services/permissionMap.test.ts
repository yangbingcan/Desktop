/** @file 权限映射单元测试 */
import { describe, it, expect } from 'vitest'
import { routePermissionMap, PERMISSION_ACTIONS } from './permissionMap'

describe('routePermissionMap', () => {
  it('应包含所有核心路由的权限映射', () => {
    expect(routePermissionMap['/dashboard']).toBe('dashboard')
    expect(routePermissionMap['/permission']).toBe('permission')
    expect(routePermissionMap['/user']).toBe('user_manage')
    expect(routePermissionMap['/system']).toBe('system_log')
    expect(routePermissionMap['/settings']).toBe('settings')
  })

  it('所有权限模块值应为字符串', () => {
    for (const value of Object.values(routePermissionMap)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

describe('PERMISSION_ACTIONS', () => {
  it('应包含 15 种操作类型', () => {
    expect(PERMISSION_ACTIONS).toHaveLength(15)
  })

  it('每个操作应有 key 和 label', () => {
    for (const action of PERMISSION_ACTIONS) {
      expect(action.key).toBeTruthy()
      expect(action.label).toBeTruthy()
    }
  })

  it('操作 key 应唯一', () => {
    const keys = PERMISSION_ACTIONS.map(a => a.key)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })
})
