# 茶易管（TeaManage）测试体系

> 本目录是项目自动化测试的总入口，由 v0.3.3 版本建立的回归测试体系。

## 一、目录结构

```
tests/
├── README.md                          # 本说明文件
├── contract/                          # IPC 契约测试（阶段1）
│   ├── ipc-contract.test.ts           # 前端 invoke 调用 vs 后端 #[tauri::command] 参数契约
│   ├── serialization.test.ts          # 前端 TS 类型 vs 后端 Rust 结构体序列化字段一致性
│   └── fixtures/                      # 契约元数据（手工维护的"事实清单"）
│       ├── ipc-commands.ts            # 后端命令签名清单（参数名/命令名）
│       └── type-fields.ts             # 后端结构体字段清单（serde rename 后的最终字段名）
├── unit/                              # 前端单元测试（阶段3）
│   ├── stores/                        # Pinia stores 单元测试
│   ├── utils/                         # utils 工具函数测试
│   └── api/                           # api 层测试（mock invoke）
└── reports/                           # 测试报告输出目录
```

## 二、运行命令

```bash
# 在 tea-manage 目录下执行

# 运行全部前端测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 以 watch 模式运行（开发时推荐）
npm run test:watch

# 运行特定测试文件
npx vitest tests/contract/ipc-contract.test.ts
```

## 三、测试层级说明

### 阶段1：IPC 契约测试（最高优先级）

**目标**：防止 v0.3.2 那类 BUG 再次出现（参数命名错位、序列化字段错位）。

**原理**：
- 不启动 Tauri 应用
- 通过静态扫描前端 `invoke()` 调用 + 后端 `#[tauri::command]` 函数签名
- 维护一份"事实清单"（fixtures），测试时比对前端调用与清单是否一致

**为何不直接反射后端**：Rust 端在编译期已被 `tauri::generate_handler!` 注册，运行时反射成本高且不稳定。手工维护清单更可控，且能在 CI 中独立运行。

### 阶段3：前端单元测试

- **stores**：测试 Pinia store 的 state/getters/actions
- **utils**：测试纯函数（price/barcode/print）
- **api**：mock `@tauri-apps/api/core` 的 `invoke`，验证参数构造正确

## 四、与后端测试的关系

| 层级 | 工具 | 位置 | 命令 |
|------|------|------|------|
| 后端 Rust 单元测试 | `cargo test` | `src-tauri/src/` 内联 `mod tests` | `cd src-tauri && cargo test --lib` |
| 前端契约测试 | Vitest | `tests/contract/` | `npm test` |
| 前端单元测试 | Vitest + @vue/test-utils | `tests/unit/` | `npm test` |

## 五、CI 集成建议（未来）

```yaml
# .github/workflows/test.yml （示例，项目未接入 CI）
- name: Backend tests
  run: cd src-tauri && cargo test --lib
- name: Frontend tests
  run: cd tea-manage && npm test
- name: Type check
  run: cd tea-manage && npx vue-tsc --noEmit
```
