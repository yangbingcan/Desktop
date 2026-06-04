/** @file 统一错误处理 - 将后端错误转换为用户友好的提示消息 */
import { message } from 'antd'

/** 处理API调用错误，统一展示错误提示 */
export function handleApiError(err: unknown, fallbackMsg = '操作失败') {
  // 鉴权错误已由api.ts自动处理（登出+跳转），不重复弹窗
  if (err instanceof Error && err.name === 'AuthError') {
    return
  }
  if (err instanceof Error) {
    message.error(err.message || fallbackMsg)
  } else if (typeof err === 'string') {
    message.error(err || fallbackMsg)
  } else if (err && typeof err === 'object' && 'message' in err) {
    message.error((err as { message: string }).message || fallbackMsg)
  } else {
    message.error(fallbackMsg)
  }
}

/** 处理表单提交错误（表单校验失败不提示，仅提示接口错误） */
export function handleFormSubmitError(err: unknown, fallbackMsg = '操作失败') {
  // Ant Design 表单校验失败会抛出包含 errorFields 的对象，不需要提示
  if (err && typeof err === 'object' && 'errorFields' in err) {
    return
  }
  handleApiError(err, fallbackMsg)
}
