/**
 * @file 演示模式开关（全局响应式 + localStorage 持久化）
 * @description 默认开启演示模式；关闭后首页不显示「演示数据管理」卡片。
 *              使用模块级 ref 实现跨组件响应式共享（settings 切换 → dashboard 即时生效）。
 */
import { ref } from 'vue'

const STORAGE_KEY = 'tea-demo-mode'

/** 读取初始值：仅当显式存 '0' 时关闭，否则默认开启 */
function readInitial(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== '0'
}

/** 全局演示模式状态（true=开启，显示演示数据管理） */
export const demoMode = ref<boolean>(readInitial())

/** 切换并持久化演示模式 */
export function setDemoMode(val: boolean): void {
    demoMode.value = val
    localStorage.setItem(STORAGE_KEY, val ? '1' : '0')
}
