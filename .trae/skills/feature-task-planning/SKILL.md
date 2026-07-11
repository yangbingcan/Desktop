---
name: feature-task-planning
description: 功能任务规划。将技术方案拆解为细粒度、可执行的开发任务清单 (Task List)，每个任务适配 TDD 流程。
agent_created: true
---
# Role: 技术主管

> 这是一个规划型 Skill。当用户说"规划 XX 功能的任务"或技术方案确定后，使用此 Skill。

## 项目上下文协议 - CRITICAL
请严格遵守项目上下文强制协议：`specs/PROJECT-CONTEXT.md`
**在执行本 Skill 之前，必须先建立项目认知。**

## 你的任务
将技术方案拆解为细粒度、可执行的开发任务清单，每个任务适配 TDD 流程，并拆解为原子级步骤。

## 边界守卫 - CRITICAL
请严格遵守通用边界守卫规则：`specs/GUARDRAILS.md`
**当前阶段**: 规划与任务阶段

## 工作流程

### 1. 前置检查
- 确认 `specs/features/{功能名}.md` 是否存在
- 确认 `specs/features/{功能名}_技术方案.md` 是否存在
- 如果缺失，提示用户先完成前置步骤

### 2. 分析技术方案
- 识别所有技术组件
- 确定开发顺序
- 分析依赖关系

### 3. 任务拆解原则
- 每个任务粒度适中（1-4小时）
- 每个任务有明确的输入输出
- 每个任务可独立测试
- 任务间依赖关系清晰

### 4. 任务分类
按照开发层次分类：
- 数据层任务：数据库表、模型、迁移
- 服务层任务：业务逻辑、数据处理
- API 层任务：接口定义、路由、控制器
- 表现层任务：页面、组件、样式
- 测试任务：单元测试、集成测试
- **【新增】版本控制任务：迁移脚本、版本号更新、更新日志**

### 4.1 版本控制检查点（强制）
> 参考 `version-release` 技能的检查点 3

如果功能涉及数据库变更，任务清单中**必须**包含以下独立任务：

**在数据层阶段：**
- Task-XX: 编写数据库迁移脚本
  - 在 `src-tauri/src/db_migrate.rs` 中新增 `migrate_v{N}` 函数
  - 在 `run_migrations` 中注册新版本
  - 包含事务保护（`unchecked_transaction` + `commit`）
  - 包含版本号记录（`INSERT INTO schema_version`）

**在最后阶段：**
- Task-XX: 更新版本号和更新日志
  - 更新 `src-tauri/tauri.conf.json` 的 `version`
  - 更新 `src/config/version.ts` 的 `APP_VERSION`
  - 更新 `src/data/changelog.json` 新增版本条目
  - 确保三处版本号一致

如果不涉及数据库变更，仍需确认：
- 是否需要递增修复版本号（如有 bug 修复）
- changelog.json 是否需要添加修复记录

### 5. TDD 适配
为每个任务标注：
- 测试文件路径
- 测试用例概要
- 验证标准

### 6. 依赖排序
- 识别任务依赖关系
- 确定执行顺序
- 标注并行可能性

### 7. 原子级步骤拆解（核心要求）
每个任务必须拆解为原子级步骤，包含以下要素：

| 要素 | 说明 | 必填 |
|------|------|------|
| **前置条件** | 执行前必须满足的条件 | ✅ |
| **执行动作** | 具体要做什么（带完整代码示例） | ✅ |
| **预期结果** | 完成后应该看到什么 | ✅ |
| **验证方法** | 如何确认成功（具体命令） | ✅ |
| **回滚方案** | 失败后如何恢复 | ✅ |
| **输出物** | 该步骤产出的文件或结果 | ✅ |

## 输出模板

```markdown
# 任务规划 - {功能名称}

## 一、任务概览

| 项目 | 内容 |
|------|------|
| 功能名称 | {功能名} |
| 任务总数 | {数量} |
| 预计工时 | {小时} |
| 依赖任务 | {数量} |

## 二、阶段划分

### 阶段一：数据层
- Task-01: 创建数据表
- Task-02: 创建数据模型
- Task-03: 实现数据访问层

### 阶段二：服务层
- Task-04: 实现核心业务逻辑
- Task-05: 实现数据处理服务

### 阶段三：API 层
- Task-06: 定义 API 接口
- Task-07: 实现控制器

### 阶段四：表现层
- Task-08: 创建页面组件
- Task-09: 实现交互逻辑

## 三、任务详情

### Task-01: 创建用户表

**任务说明**
创建用户数据表，包含基础字段和索引。

**涉及文件**
- 数据库迁移：`migrations/001_create_users_table.sql`
- 模型文件：`src/models/user.ts`

**测试文件**
- `tests/models/user.test.ts`

**验证标准**
- [ ] 表结构符合设计文档
- [ ] 索引创建正确
- [ ] CRUD 操作正常

**依赖任务**
无

**对应验收标准**
- AC-01: 用户可以注册账号

---

### 原子级步骤

#### 步骤 1.1: 创建迁移文件

**前置条件**
- [ ] 数据库连接配置正确
- [ ] migrations 目录已存在

**执行动作**
创建文件 `migrations/001_create_users_table.sql`：

```sql
-- 创建用户表
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

**预期结果**
- 文件创建成功
- 文件内容正确

**验证方法**
```bash
# 检查文件是否存在
ls -la migrations/001_create_users_table.sql

# 检查文件内容
cat migrations/001_create_users_table.sql
```

**回滚方案**
```bash
rm migrations/001_create_users_table.sql
```

**输出物**
- `migrations/001_create_users_table.sql`

---

#### 步骤 1.2: 执行数据库迁移

**前置条件**
- [ ] 步骤 1.1 完成
- [ ] 数据库服务运行中

**执行动作**
```bash
# 执行迁移
npm run migrate:up
```

**预期结果**
- 控制台输出迁移成功信息
- 数据库中存在 users 表

**验证方法**
```bash
# 连接数据库检查表结构
mysql -u root -p -e "DESCRIBE users;"

# 或使用项目命令
npm run db:check
```

**回滚方案**
```bash
# 回滚迁移
npm run migrate:down
```

**输出物**
- 数据库中的 users 表

---

#### 步骤 1.3: 创建模型文件

**前置条件**
- [ ] 步骤 1.2 完成
- [ ] src/models 目录已存在

**执行动作**
创建文件 `src/models/user.ts`：

```typescript
export interface User {
  id: string
  username: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export class UserModel {
  // 模型实现...
}
```

**预期结果**
- 文件创建成功
- TypeScript 编译通过

**验证方法**
```bash
# TypeScript 编译检查
npx tsc --noEmit

# 运行模型测试
npm test -- user.model.test.ts
```

**回滚方案**
```bash
rm src/models/user.ts
```

**输出物**
- `src/models/user.ts`

---

### Task-02: {任务名称}

...

## 四、依赖关系图

```
Task-01 → Task-02 → Task-04
                ↘ Task-03 → Task-05
```

## 五、验收标准映射

| 验收标准 | 对应任务 |
|---------|---------|
| AC-01 | Task-01, Task-02 |
| AC-02 | Task-03, Task-04 |
| AC-03 | Task-05, Task-06 |

## 六、风险提示

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| ... | ... | ... |

## 七、执行检查清单

在执行每个任务前，请确认：
- [ ] 已阅读并理解任务说明
- [ ] 已检查前置条件
- [ ] 已准备好回滚方案
- [ ] 已了解验证方法
```

## 输出
- `specs/features/{功能名}_任务规划.md` - 任务规划文档

## 注意事项
1. 任务粒度要适中，不要过大或过小
2. 依赖关系要清晰
3. 每个任务都要有验证标准
4. 考虑并行执行的可能性
5. **每个任务必须拆解为原子级步骤**
6. **每个步骤必须包含：前置条件、执行动作、预期结果、验证方法、回滚方案、输出物**
7. **确保计划可以指导 AI 不出错**
