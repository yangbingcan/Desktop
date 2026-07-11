/**
 * @file API 测试辅助函数
 * @description 提供 mock @tauri-apps/api/core 的 invoke 函数，以及断言辅助方法
 *
 * 使用方式：
 *   import { mockInvoke, getInvokeMock } from './_helpers'
 *   beforeEach(() => mockInvoke.mockClear())
 *   mockInvoke.mockResolvedValue({ list: [] })
 *   expect(mockInvoke).toHaveBeenCalledWith('get_products', { ... })
 */
import { vi } from 'vitest'

// 全局 mock invoke 函数
export const mockInvoke = vi.fn()

// 注册 mock：在测试文件顶部调用 vi.mock 时使用此函数
export function setupApiMock() {
    vi.mock('@tauri-apps/api/core', () => ({
        invoke: mockInvoke
    }))
}

/**
 * 重置 mockInvoke 状态（每个测试前调用）
 */
export function resetInvokeMock() {
    mockInvoke.mockReset()
}

/**
 * 断言 invoke 被以指定参数调用
 */
export function expectInvokeCalledWith(command: string, args?: Record<string, unknown>) {
    if (args) {
        expect(mockInvoke).toHaveBeenCalledWith(command, args)
    } else {
        expect(mockInvoke).toHaveBeenCalledWith(command)
    }
}
