/** @file 统一错误处理单元测试 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleApiError, handleFormSubmitError } from '../errorHandler'

// mock antd message模块
vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
  },
}))

import { message } from 'antd'

describe('handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('处理带message的错误对象', () => {
    handleApiError({ message: '用户名已存在' })
    expect(message.error).toHaveBeenCalledWith('用户名已存在')
  })

  it('处理Error实例', () => {
    handleApiError(new Error('网络错误'))
    expect(message.error).toHaveBeenCalledWith('网络错误')
  })

  it('处理未知错误类型使用fallbackMsg', () => {
    handleApiError('string error')
    expect(message.error).toHaveBeenCalledWith('操作失败')
  })

  it('处理null使用fallbackMsg', () => {
    handleApiError(null)
    expect(message.error).toHaveBeenCalledWith('操作失败')
  })

  it('处理undefined使用fallbackMsg', () => {
    handleApiError(undefined)
    expect(message.error).toHaveBeenCalledWith('操作失败')
  })

  it('使用自定义fallbackMsg', () => {
    handleApiError(null, '自定义错误')
    expect(message.error).toHaveBeenCalledWith('自定义错误')
  })

  it('处理空message的对象使用fallbackMsg', () => {
    handleApiError({ message: '' })
    expect(message.error).toHaveBeenCalledWith('操作失败')
  })
})

describe('handleFormSubmitError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('跳过表单校验错误（含errorFields）', () => {
    const formError = { errorFields: [{ name: ['username'], errors: ['必填'] }] }
    handleFormSubmitError(formError)
    expect(message.error).not.toHaveBeenCalled()
  })

  it('接口错误正常提示', () => {
    handleFormSubmitError({ message: '服务器错误' })
    expect(message.error).toHaveBeenCalledWith('服务器错误')
  })

  it('未知错误使用fallbackMsg', () => {
    handleFormSubmitError(123)
    expect(message.error).toHaveBeenCalledWith('操作失败')
  })
})
