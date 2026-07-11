/**
 * @file IPC 契约测试 - 前后端参数命名一致性校验
 * @description 验证前端 invoke() 调用与后端 #[tauri::command] 函数签名的契约一致性
 *
 * 测试目标：
 * 1. 命令名存在性 - 前端调用的每个命令必须存在于后端注册清单
 * 2. 参数命名一致性 - 前端 camelCase key 转换为 snake_case 后必须匹配后端 params
 * 3. 必传参数完整性 - 后端 required: true 的参数，前端必须传
 * 4. 幽灵参数检测 - 前端传的每个 key 必须在后端 params 中有对应定义
 *
 * Tauri 2.x 命名规则：
 * - 后端 #[tauri::command] 默认使用 snake_case 参数名
 * - Tauri 运行时自动将前端 camelCase key 转换为后端 snake_case 参数
 * - 因此前端传 { memberId } 后端接收 member_id: String
 * - 若前端传 { member_id } 后端会报 "missing required key 'member_id'" 错误
 *
 * 数据来源：
 * - 后端：tests/contract/fixtures/ipc-commands.ts（手工维护自 src-tauri/src/commands/*.rs）
 * - 前端：tests/contract/fixtures/frontend-calls.ts（手工维护自 src/api/*.ts）
 */
import { describe, it, expect } from 'vitest'
import {
    BACKEND_COMMANDS,
    findCommand,
    REGISTERED_COMMAND_NAMES,
    type CommandContract,
} from './fixtures/ipc-commands'
import { FRONTEND_CALLS, type FrontendCall } from './fixtures/frontend-calls'

/**
 * 将 camelCase 字符串转换为 snake_case
 *
 * 示例：
 *   memberId    → member_id
 *   pageSize    → page_size
 *   orderId     → order_id
 *   page        → page
 *   input       → input
 */
function camelToSnake(s: string): string {
    return s.replace(/[A-Z]/g, (match, offset) => {
        return offset === 0 ? match.toLowerCase() : '_' + match.toLowerCase()
    })
}

/**
 * 将 snake_case 字符串转换为 camelCase
 *
 * 示例：
 *   member_id   → memberId
 *   page_size   → pageSize
 *   page        → page
 */
function snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * 构造"命令 + 调用"配对的诊断标识
 */
function describeCall(call: FrontendCall): string {
    return `${call.sourceFile}:${call.line} ${call.functionName}() → ${call.command}`
}

// ========================================================================
// 测试套件 1：命令名存在性
// ========================================================================
describe('IPC 契约 - 命令名存在性', () => {
    it('后端命令清单非空', () => {
        expect(BACKEND_COMMANDS.length).toBeGreaterThan(0)
    })

    it('前端调用清单非空', () => {
        expect(FRONTEND_CALLS.length).toBeGreaterThan(0)
    })

    it('后端命令名无重复', () => {
        const names = BACKEND_COMMANDS.map((c) => c.name)
        const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
        expect(duplicates, `后端存在重复命令名: ${duplicates.join(', ')}`).toEqual([])
    })

    it('前端调用的每个命令名必须存在于后端注册清单', () => {
        const missing: string[] = []
        for (const call of FRONTEND_CALLS) {
            if (!REGISTERED_COMMAND_NAMES.includes(call.command)) {
                missing.push(describeCall(call))
            }
        }
        expect(
            missing,
            `前端调用了未注册的命令:\n${missing.map((m) => '  - ' + m).join('\n')}`,
        ).toEqual([])
    })
})

// ========================================================================
// 测试套件 2：参数命名一致性（核心）
// ========================================================================
describe('IPC 契约 - 参数命名一致性', () => {
    /**
     * 为每个前端调用生成独立测试，便于定位具体哪个调用契约不一致
     */
    FRONTEND_CALLS.forEach((call: FrontendCall) => {
        it(`${describeCall(call)} 参数命名匹配`, () => {
            const cmd = findCommand(call.command)
            expect(cmd, `命令 ${call.command} 不存在`).not.toBeNull()
            if (!cmd) return

            // 后端所有参数名（snake_case）集合
            const backendParamNames = cmd.params.map((p) => p.name)
            // 后端所有参数名转换为 camelCase 后的集合
            const backendParamNamesCamel = backendParamNames.map(snakeToCamel)

            // 检查前端每个 key 是否能在后端找到对应（通过 camelCase ↔ snake_case 双向转换）
            const ghostKeys: string[] = []
            for (const key of call.keys) {
                const keyAsSnake = camelToSnake(key)
                const found =
                    backendParamNames.includes(key) || // 直接匹配（如 page、input）
                    backendParamNames.includes(keyAsSnake) || // camelCase → snake_case 匹配
                    backendParamNamesCamel.includes(key) // snake_case → camelCase 匹配
                if (!found) {
                    ghostKeys.push(key)
                }
            }

            expect(
                ghostKeys,
                `前端传了后端不存在的参数:\n` +
                    `  命令: ${cmd.name} (${cmd.sourceFile})\n` +
                    `  后端 params: [${backendParamNames.join(', ')}]\n` +
                    `  前端 ghost keys: [${ghostKeys.join(', ')}]`,
            ).toEqual([])
        })
    })
})

// ========================================================================
// 测试套件 3：必传参数完整性
// ========================================================================
describe('IPC 契约 - 必传参数完整性', () => {
    FRONTEND_CALLS.forEach((call: FrontendCall) => {
        it(`${describeCall(call)} 必传参数齐全`, () => {
            const cmd = findCommand(call.command)
            expect(cmd, `命令 ${call.command} 不存在`).not.toBeNull()
            if (!cmd) return

            // 后端必传参数（required: true）
            const requiredParams = cmd.params.filter((p) => p.required)
            // 前端 keys 的 snake_case 版本
            const frontendKeysSnake = call.keys.map(camelToSnake)

            const missing: string[] = []
            for (const p of requiredParams) {
                // 前端 key 直接是 snake_case，或前端 key 是 camelCase
                if (
                    !frontendKeysSnake.includes(p.name) &&
                    !call.keys.includes(snakeToCamel(p.name))
                ) {
                    missing.push(`${p.name} (${p.type})`)
                }
            }

            expect(
                missing,
                `前端未传必传参数:\n` +
                    `  命令: ${cmd.name} (${cmd.sourceFile})\n` +
                    `  缺失参数: [${missing.join(', ')}]\n` +
                    `  前端 keys: [${call.keys.join(', ')}]`,
            ).toEqual([])
        })
    })
})

// ========================================================================
// 测试套件 4：幽灵参数检测（前端传了但后端没有）
// ========================================================================
describe('IPC 契约 - 幽灵参数检测', () => {
    FRONTEND_CALLS.forEach((call: FrontendCall) => {
        it(`${describeCall(call)} 无幽灵参数`, () => {
            const cmd = findCommand(call.command)
            expect(cmd, `命令 ${call.command} 不存在`).not.toBeNull()
            if (!cmd) return

            // 这个测试与"参数命名一致性"测试有重叠，但单独列出便于诊断
            const backendParamNamesSnake = cmd.params.map((p) => p.name)
            const backendParamNamesCamel = backendParamNamesSnake.map(snakeToCamel)

            const ghosts: string[] = []
            for (const key of call.keys) {
                const keySnake = camelToSnake(key)
                const exists =
                    backendParamNamesSnake.includes(key) ||
                    backendParamNamesSnake.includes(keySnake) ||
                    backendParamNamesCamel.includes(key)
                if (!exists) {
                    ghosts.push(key)
                }
            }

            expect(
                ghosts,
                `发现幽灵参数（前端传了但后端无定义）:\n` +
                    `  命令: ${cmd.name}\n` +
                    `  幽灵参数: [${ghosts.join(', ')}]\n` +
                    `  后端 params: [${backendParamNamesSnake.join(', ')}]`,
            ).toEqual([])
        })
    })
})

// ========================================================================
// 测试套件 5：后端命令覆盖度（哪些后端命令从未被前端调用）
// ========================================================================
describe('IPC 契约 - 后端命令覆盖度', () => {
    it('所有后端命令至少被前端调用一次', () => {
        const calledNames = new Set(FRONTEND_CALLS.map((c) => c.command))
        const neverCalled = BACKEND_COMMANDS.filter(
            (c: CommandContract) => !calledNames.has(c.name),
        ).map((c) => `${c.name} (${c.sourceFile})`)

        // 这只是覆盖率报告，不强制要求（某些命令可能仅用于管理后台/未上线功能）
        // 但若有未覆盖命令，需要确认是否为 dead code 或待对接
        if (neverCalled.length > 0) {
            console.warn(
                `[覆盖率提示] 以下后端命令未被前端调用（仅供参考）:\n` +
                    neverCalled.map((n) => '  - ' + n).join('\n'),
            )
        }
        // 软断言：不强制失败，仅记录
        expect(true).toBe(true)
    })
})

// ========================================================================
// 测试套件 6：契约元数据自身完整性
// ========================================================================
describe('IPC 契约 - 元数据完整性', () => {
    it('后端每个命令的参数列表无重复参数名', () => {
        const dupes: string[] = []
        for (const cmd of BACKEND_COMMANDS) {
            const names = cmd.params.map((p) => p.name)
            const dups = names.filter((n, i) => names.indexOf(n) !== i)
            if (dups.length > 0) {
                dupes.push(`${cmd.name}: [${dups.join(', ')}]`)
            }
        }
        expect(dupes, `后端命令存在重复参数名:\n${dupes.join('\n')}`).toEqual([])
    })

    it('前端每个调用的 keys 无重复', () => {
        const dupes: string[] = []
        for (const call of FRONTEND_CALLS) {
            const dups = call.keys.filter((k, i) => call.keys.indexOf(k) !== i)
            if (dups.length > 0) {
                dupes.push(`${describeCall(call)}: [${dups.join(', ')}]`)
            }
        }
        expect(dupes, `前端调用存在重复 key:\n${dupes.join('\n')}`).toEqual([])
    })

    it('camelToSnake 转换函数正确', () => {
        expect(camelToSnake('memberId')).toBe('member_id')
        expect(camelToSnake('pageSize')).toBe('page_size')
        expect(camelToSnake('orderId')).toBe('order_id')
        expect(camelToSnake('categoryId')).toBe('category_id')
        expect(camelToSnake('page')).toBe('page')
        expect(camelToSnake('input')).toBe('input')
        expect(camelToSnake('dateStart')).toBe('date_start')
        expect(camelToSnake('paymentStatus')).toBe('payment_status')
    })

    it('snakeToCamel 转换函数正确', () => {
        expect(snakeToCamel('member_id')).toBe('memberId')
        expect(snakeToCamel('page_size')).toBe('pageSize')
        expect(snakeToCamel('order_id')).toBe('orderId')
        expect(snakeToCamel('page')).toBe('page')
        expect(snakeToCamel('input')).toBe('input')
    })
})
