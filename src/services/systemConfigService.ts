/** @file 系统配置服务 - 公司信息CRUD、备份恢复、系统信息查询 */
import { invokeCommand, getToken } from './api'

export async function getSystemConfig(keys: string[]): Promise<Record<string, string>> {
  const result = await invokeCommand<{ configs: Record<string, string> }>('get_system_config', { token: getToken(), keys })
  return result.configs
}

export async function saveSystemConfig(configs: Record<string, string>): Promise<void> {
  await invokeCommand('save_system_config', { token: getToken(), configs })
}

export async function uploadCompanyLogo(sourcePath: string): Promise<{ file_name: string; file_path: string }> {
  return invokeCommand<{ file_name: string; file_path: string }>('upload_company_logo', { token: getToken(), sourcePath })
}

export async function backupDatabase(destPath: string): Promise<{ file_path: string; file_size: number }> {
  return invokeCommand<{ file_path: string; file_size: number }>('backup_database', { token: getToken(), destPath })
}

export async function restoreDatabase(sourcePath: string): Promise<{ need_restart: boolean }> {
  return invokeCommand<{ need_restart: boolean }>('restore_database', { token: getToken(), sourcePath })
}

export async function getSystemInfo(): Promise<{
  app_name: string
  app_version: string
  db_version: number
  os_info: string
  db_path: string
  data_dir: string
}> {
  return invokeCommand('get_system_info', { token: getToken() })
}

export async function getStorageInfo(): Promise<{ db_size: number; log_count: number }> {
  return invokeCommand('get_storage_info', { token: getToken() })
}
