/**
 * @file 演示数据 / 开发辅助 API
 * @description 封装 seed_demo_data 和 clear_all_data 命令
 */
import { invoke } from '@tauri-apps/api/core'

/** 演示数据生成结果 */
export interface SeedResult {
    products: number
    suppliers: number
    members: number
    balanceLogs: number
    purchases: number
}

/** 一键清空结果 */
export interface ClearResult {
    clearedTables: number
}

/** 生成演示数据 */
export async function seedDemoData(): Promise<SeedResult> {
    return await invoke('seed_demo_data')
}

/** 一键清空所有业务数据 */
export async function clearAllData(): Promise<ClearResult> {
    return await invoke('clear_all_data')
}

/** 数据库备份：复制当前数据库为带时间戳的副本，返回备份文件路径 */
export async function backupDatabase(): Promise<string> {
    return await invoke('backup_database')
}
