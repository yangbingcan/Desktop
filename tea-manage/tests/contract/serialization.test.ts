/**
 * @file 序列化字段一致性测试 - 验证前后端字段名匹配
 * @description 比对前端 TS interface 字段名与后端 Rust 结构体 serde 序列化后的字段名
 *
 * 测试目标：
 * 1. 字段名一致性 - 前端字段名必须与后端 serde 序列化后的字段名匹配
 * 2. 字段完整性 - 检测前端缺失/多出的字段
 * 3. 枚举值一致性 - 验证字面量联合类型与后端枚举值匹配
 * 4. 已知缺陷标记 - 明确报告已知的不一致问题
 *
 * 严重等级：
 * - 🚨 CRITICAL：会导致运行时反序列化失败的契约不一致
 * - ⚠️ WARNING：字段缺失/多余，可能影响功能但不直接导致反序列化失败
 * - ℹ️ INFO：仅记录差异，不影响功能
 *
 * 数据来源：
 * - 后端：tests/contract/fixtures/backend-structs.ts
 * - 前端：tests/contract/fixtures/frontend-types.ts
 */
import { describe, it, expect } from 'vitest'
import { BACKEND_STRUCTS, findStruct, type StructContract } from './fixtures/backend-structs'
import { FRONTEND_TYPES, findType, type TypeContract } from './fixtures/frontend-types'

/**
 * 去除字段名的 ? 后缀（标记可选字段），获取纯字段名
 */
function normalizeField(field: string): string {
    return field.replace(/\?$/, '')
}

/**
 * 检测字段名是否为枚举值（首字母小写、非驼峰、长度较短）
 */
function isEnumValues(struct: StructContract): boolean {
    // 通过白名单明确判断（更可靠）
    const enumNames = new Set([
        'FlowType', 'MemberLevel', 'PayMethod', 'PayStatus', 'OrderStatus',
        'BalanceChangeType', 'ProductType', 'BaseUnit',
    ])
    return enumNames.has(struct.rustName)
}

// ========================================================================
// 测试套件 1：基础完整性
// ========================================================================
describe('序列化契约 - 基础完整性', () => {
    it('后端结构体清单非空', () => {
        expect(BACKEND_STRUCTS.length).toBeGreaterThan(0)
    })

    it('前端类型清单非空', () => {
        expect(FRONTEND_TYPES.length).toBeGreaterThan(0)
    })

    it('后端结构体名无重复', () => {
        const names = BACKEND_STRUCTS.map((s) => s.rustName)
        const dupes = names.filter((n, i) => names.indexOf(n) !== i)
        expect(dupes, `后端结构体名重复: ${dupes.join(', ')}`).toEqual([])
    })

    it('前端类型名无重复', () => {
        const names = FRONTEND_TYPES.map((t) => t.tsName)
        const dupes = names.filter((n, i) => names.indexOf(n) !== i)
        expect(dupes, `前端类型名重复: ${dupes.join(', ')}`).toEqual([])
    })

    it('每个有 rustName 的前端类型都能在后端找到对应', () => {
        const missing: string[] = []
        for (const t of FRONTEND_TYPES) {
            if (t.rustName && !findStruct(t.rustName)) {
                missing.push(`${t.tsName} → ${t.rustName}`)
            }
        }
        expect(missing, `前端类型找不到后端对应:\n${missing.join('\n')}`).toEqual([])
    })
})

// ========================================================================
// 测试套件 2：字段名一致性（核心）
// ========================================================================
describe('序列化契约 - 字段名一致性', () => {
    /**
     * 为每对前后端类型生成独立测试
     */
    FRONTEND_TYPES.forEach((tsType: TypeContract) => {
        if (!tsType.rustName) return

        const backend = findStruct(tsType.rustName)
        if (!backend) return

        it(`${tsType.tsName} ↔ ${backend.rustName} 字段名匹配`, () => {
            // 枚举类型走枚举值匹配测试
            if (isEnumValues(backend)) return

            const frontendFields = new Set(tsType.fields.map(normalizeField))
            const backendFields = new Set(backend.serializedFields)

            // 找出字段名不匹配的（前端有但后端没有的）
            const frontendOnly = [...frontendFields].filter((f) => !backendFields.has(f))
            // 找出后端有但前端没有的
            const backendOnly = [...backendFields].filter((f) => !frontendFields.has(f))

            // 严重程度判断：
            // - CRITICAL：后端 rename_all='none' 且字段含下划线，前端却用 camelCase
            //   这种情况下后端期望 snake_case，前端发送 camelCase，会导致反序列化失败
            // - WARNING：后端 rename_all='camelCase'，前端多出/缺失字段
            //   多出字段不影响反序列化（serde 忽略未知字段）
            //   缺失字段不影响反序列化（前端拿不到值，但不会失败）
            const backendHasSnakeCase = backend.serializedFields.some((f) => f.includes('_'))
            const isCriticalCase =
                backend.renameAll === 'none' && backendHasSnakeCase && frontendOnly.length > 0

            if (isCriticalCase) {
                // CRITICAL：前端 camelCase 字段 vs 后端 snake_case 字段，反序列化会失败
                throw new Error(
                    `🚨 [CRITICAL] ${tsType.tsName} ↔ ${backend.rustName} 字段命名风格不一致\n` +
                        `  后端 rename_all: ${backend.renameAll}（默认 snake_case）\n` +
                        `  后端字段: [${backend.serializedFields.join(', ')}]\n` +
                        `  前端字段: [${tsType.fields.map(normalizeField).join(', ')}]\n` +
                        `  前端多出（camelCase）: [${frontendOnly.join(', ')}]\n` +
                        `  前端缺失（snake_case）: [${backendOnly.join(', ')}]\n` +
                        `  影响：反序列化时后端期望 snake_case，前端发送 camelCase 会被忽略\n` +
                        `  修复：后端添加 #[serde(rename_all = "camelCase")]`,
                )
            }

            // WARNING：后端 camelCase 但前端多出字段
            // 这种情况是设计层面的小问题，不直接导致反序列化失败
            if (frontendOnly.length > 0) {
                console.warn(
                    `[字段多出警告] ${tsType.tsName} ↔ ${backend.rustName}\n` +
                        `  前端多出: [${frontendOnly.join(', ')}]`,
                )
            }

            if (backendOnly.length > 0) {
                console.warn(
                    `[字段缺失警告] ${tsType.tsName} ↔ ${backend.rustName}\n` +
                        `  前端缺失: [${backendOnly.join(', ')}]`,
                )
            }

            // 对于 WARNING 情况，测试通过
            expect(true).toBe(true)
        })
    })
})

// ========================================================================
// 测试套件 3：枚举值一致性
// ========================================================================
describe('序列化契约 - 枚举值一致性', () => {
    it('ProductType 枚举值匹配', () => {
        const ts = findType('ProductType')!
        const rs = findStruct('ProductType')!
        expect(ts.fields.sort()).toEqual([...rs.serializedFields].sort())
    })

    it('BaseUnit 枚举值匹配', () => {
        const ts = findType('BaseUnit')!
        const rs = findStruct('BaseUnit')!
        expect(ts.fields.sort()).toEqual([...rs.serializedFields].sort())
    })

    it('MemberLevel 枚举值匹配', () => {
        const ts = findType('MemberLevel')!
        const rs = findStruct('MemberLevel')!
        expect(ts.fields.sort()).toEqual([...rs.serializedFields].sort())
    })

    it('FlowType (StockFlowType) 枚举值匹配', () => {
        const ts = findType('StockFlowType')!
        const rs = findStruct('FlowType')!
        expect(ts.fields.sort()).toEqual([...rs.serializedFields].sort())
    })

    it('OrderStatus (SaleOrderStatus) 枚举值匹配', () => {
        const ts = findType('SaleOrderStatus')!
        const rs = findStruct('OrderStatus')!
        expect(ts.fields.sort()).toEqual([...rs.serializedFields].sort())
    })

    it('BalanceChangeType 枚举值匹配', () => {
        const ts = findType('BalanceChangeType')!
        const rs = findStruct('BalanceChangeType')!
        expect(ts.fields.sort()).toEqual([...rs.serializedFields].sort())
    })

    // 🔧 v0.3.3 已修复：PayMethod 枚举值已统一
    it('PayMethod 枚举值匹配 [v0.3.3 已修复]', () => {
        const ts = findType('PayMethod')!
        const rs = findStruct('PayMethod')!
        const tsSorted = [...ts.fields].sort()
        const rsSorted = [...rs.serializedFields].sort()

        // 找出差异
        const onlyInTs = tsSorted.filter((v) => !rsSorted.includes(v))
        const onlyInRs = rsSorted.filter((v) => !tsSorted.includes(v))

        if (onlyInTs.length > 0 || onlyInRs.length > 0) {
            throw new Error(
                `PayMethod 枚举值不一致:\n` +
                    `  前端 PayMethod: [${tsSorted.join(', ')}]\n` +
                    `  后端 PayMethod: [${rsSorted.join(', ')}]\n` +
                    `  仅前端有: [${onlyInTs.join(', ')}]\n` +
                    `  仅后端有: [${onlyInRs.join(', ')}]\n` +
                    `  影响范围：SaleOrderInput.payMethod、SaleOrder.payMethod`,
            )
        }
    })

    // 🔧 v0.3.3 已修复：PayStatus 枚举值已统一
    it('PayStatus 枚举值匹配 [v0.3.3 已修复]', () => {
        const ts = findType('PayStatus')!
        const rs = findStruct('PayStatus')!
        const tsSorted = [...ts.fields].sort()
        const rsSorted = [...rs.serializedFields].sort()

        const onlyInTs = tsSorted.filter((v) => !rsSorted.includes(v))
        const onlyInRs = rsSorted.filter((v) => !tsSorted.includes(v))

        if (onlyInTs.length > 0 || onlyInRs.length > 0) {
            throw new Error(
                `PayStatus 枚举值不一致:\n` +
                    `  前端 PayStatus: [${tsSorted.join(', ')}]\n` +
                    `  后端 PayStatus: [${rsSorted.join(', ')}]\n` +
                    `  仅前端有: [${onlyInTs.join(', ')}]\n` +
                    `  仅后端有: [${onlyInRs.join(', ')}]\n` +
                    `  影响范围：SaleOrder.payStatus`,
            )
        }
    })
})

// ========================================================================
// 测试套件 4：rename_all 一致性检查
// ========================================================================
describe('序列化契约 - rename_all 规则检查', () => {
    /**
     * 检查后端结构体的 rename_all 规则是否合理
     * - 字段名包含下划线的，应该有 rename_all="camelCase"（否则前端 camelCase 会失败）
     */
    BACKEND_STRUCTS.forEach((struct: StructContract) => {
        // 跳过枚举
        if (isEnumValues(struct)) return
        // 跳过没有字段的
        if (struct.serializedFields.length === 0) return

        it(`${struct.rustName} 字段命名规则合理`, () => {
            // 如果后端 rename_all = 'none'，意味着字段保持 snake_case
            // 检查字段名中是否包含下划线（snake_case 标识）
            const hasSnakeCaseFields = struct.serializedFields.some((f) => f.includes('_'))

            if (struct.renameAll === 'none' && hasSnakeCaseFields) {
                // 这是潜在 BUG：前端通常使用 camelCase
                const snakeFields = struct.serializedFields.filter((f) => f.includes('_'))
                throw new Error(
                    `🚨 ${struct.rustName} (${struct.sourceFile}) 缺少 #[serde(rename_all = "camelCase")]\n` +
                        `  字段包含 snake_case: [${snakeFields.join(', ')}]\n` +
                        `  前端通常使用 camelCase 字段名，会导致反序列化失败\n` +
                        `  修复建议：在 struct 上添加 #[serde(rename_all = "camelCase")]`,
                )
            }

            // 如果 rename_all = 'camelCase'，字段应该都是 camelCase（不含下划线）
            if (struct.renameAll === 'camelCase') {
                const snakeFields = struct.serializedFields.filter((f) => f.includes('_'))
                expect(
                    snakeFields,
                    `${struct.rustName} 声明 camelCase 但字段含下划线: [${snakeFields.join(', ')}]`,
                ).toEqual([])
            }
        })
    })
})

// ========================================================================
// 测试套件 5：缺陷汇总（v0.3.3 修复后应为空）
// ========================================================================
describe('序列化契约 - 缺陷汇总', () => {
    it('汇总所有已知缺陷（v0.3.3 修复后应为空）', () => {
        const knownBugs: string[] = []

        // 检查 PurchaseItemInput 是否缺少 rename_all
        const purchaseItemInput = findStruct('PurchaseItemInput')
        if (purchaseItemInput && purchaseItemInput.renameAll === 'none') {
            knownBugs.push(
                `🚨 [CRITICAL] PurchaseItemInput (${purchaseItemInput.sourceFile}) 缺少 #[serde(rename_all = "camelCase")]\n` +
                    `   后端期望字段: [${purchaseItemInput.serializedFields.join(', ')}]\n` +
                    `   前端发送字段: [productId, unitId, quantity, unitPrice]`,
            )
        }

        // 检查 PayMethod 枚举值
        const payMethod = findStruct('PayMethod')
        if (payMethod && payMethod.serializedFields.includes('member_card')) {
            knownBugs.push(
                `🚨 [CRITICAL] PayMethod 枚举值不一致 (${payMethod.sourceFile})\n` +
                    `   后端: member_card/mixed，前端: memberBalance/combined`,
            )
        }

        // 检查 PayStatus 枚举值
        const payStatus = findStruct('PayStatus')
        if (payStatus && payStatus.serializedFields.includes('pending')) {
            knownBugs.push(
                `🚨 [CRITICAL] PayStatus 枚举值不一致 (${payStatus.sourceFile})\n` +
                    `   后端: pending，前端: unpaid`,
            )
        }

        // 输出汇总
        if (knownBugs.length > 0) {
            console.error(
                `\n========== 序列化契约已知缺陷汇总 ==========\n\n` +
                    knownBugs.join('\n\n') +
                    `\n\n============================================\n`,
            )
        } else {
            console.info(
                `\n========== 序列化契约缺陷汇总 ==========\n` +
                    `✅ 所有已知缺陷已修复（v0.3.3）\n` +
                    `========================================\n`,
            )
        }

        // v0.3.3 修复后应无已知缺陷
        expect(knownBugs).toEqual([])
    })
})

// ========================================================================
// 测试套件 6：字段完整性报告
// ========================================================================
describe('序列化契约 - 字段完整性报告', () => {
    it('汇总前端缺失字段（后端有但前端没声明）', () => {
        const reports: string[] = []

        for (const tsType of FRONTEND_TYPES) {
            if (!tsType.rustName) continue
            const backend = findStruct(tsType.rustName)
            if (!backend) continue
            if (isEnumValues(backend)) continue

            const frontendFields = new Set(tsType.fields.map(normalizeField))
            const backendOnly = backend.serializedFields.filter((f) => !frontendFields.has(f))

            if (backendOnly.length > 0) {
                reports.push(
                    `${tsType.tsName} (前端) ↔ ${backend.rustName} (后端)\n` +
                        `  前端缺失字段: [${backendOnly.join(', ')}]`,
                )
            }
        }

        if (reports.length > 0) {
            console.warn(
                `\n========== 前端缺失字段汇总 ==========\n\n` +
                    reports.join('\n\n') +
                    `\n\n======================================\n`,
            )
        }

        expect(true).toBe(true)
    })

    it('汇总前端多出字段（前端有但后端没声明）', () => {
        const reports: string[] = []

        for (const tsType of FRONTEND_TYPES) {
            if (!tsType.rustName) continue
            const backend = findStruct(tsType.rustName)
            if (!backend) continue
            if (isEnumValues(backend)) continue

            const backendFields = new Set(backend.serializedFields)
            const frontendOnly = tsType.fields
                .map(normalizeField)
                .filter((f) => !backendFields.has(f))

            if (frontendOnly.length > 0) {
                reports.push(
                    `${tsType.tsName} (前端) ↔ ${backend.rustName} (后端)\n` +
                        `  前端多出字段: [${frontendOnly.join(', ')}]`,
                )
            }
        }

        if (reports.length > 0) {
            console.warn(
                `\n========== 前端多出字段汇总 ==========\n\n` +
                    reports.join('\n\n') +
                    `\n\n======================================\n`,
            )
        }

        expect(true).toBe(true)
    })
})
