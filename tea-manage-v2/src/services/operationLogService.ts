/** @file 操作日志服务 - 日志查询、删除、清理 */
import { invokeCommand } from './api'
import { useAuthStore } from '../stores/authStore'

export interface OperationLogItem {
  id: string
  username: string
  action_type: string
  action: string
  module: string
  detail: string
  computer_name: string
  ip_address: string
  mac_address: string
  os_info: string
  app_version: string
  created_at: string
}

export interface GetOperationLogsResult {
  items: OperationLogItem[]
  total: number
}

function getToken(): string {
  return useAuthStore.getState().token || ''
}

export async function getOperationLogs(params: {
  page?: number
  page_size?: number
  keyword?: string
  action_type?: string
  module?: string
  start_date?: string
  end_date?: string
}): Promise<GetOperationLogsResult> {
  return invokeCommand<GetOperationLogsResult>('get_operation_logs', { token: getToken(), params })
}

export async function deleteOperationLogs(ids: string[]): Promise<{ deleted_count: number }> {
  return invokeCommand<{ deleted_count: number }>('delete_operation_logs', { token: getToken(), params: { ids } })
}

export async function cleanOperationLogs(start_date: string, end_date: string): Promise<{ deleted_count: number }> {
  return invokeCommand<{ deleted_count: number }>('clean_operation_logs', { token: getToken(), params: { start_date, end_date } })
}

export async function recordPageView(pageName: string, module: string): Promise<void> {
  return invokeCommand<void>('record_page_view', { token: getToken(), params: { page_name: pageName, module } })
}
