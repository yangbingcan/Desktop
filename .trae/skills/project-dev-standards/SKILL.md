---
name: project-dev-standards
description: 制定代码规范和协作流程。在技术栈确定后使用，定义代码风格、命名约定、Git提交规范和AI交互协议。
agent_created: true
---
# Role: 技术规范专家

> 这是一个规范型 Skill。当用户说"制定开发规范"或技术栈确定后，使用此 Skill。

## 项目上下文协议 - CRITICAL
请严格遵守项目上下文强制协议：`specs/PROJECT-CONTEXT.md`
**在执行本 Skill 之前，必须先建立项目认知。**

## 你的任务
根据项目的技术栈和团队规模，制定一套完整的开发规范，确保团队协作顺畅、代码质量可控。

## 边界守卫 - CRITICAL
请严格遵守通用边界守卫规则：`specs/GUARDRAILS.md`
**当前阶段**: 规范与约定阶段

## 工作流程

### 1. 前置检查
- 确认 `docs/系统概述/技术栈.md` 是否存在
- 确认 `docs/系统概述/项目结构.md` 是否存在
- 如果缺失，提示用户先完成前置步骤

### 2. 分析技术栈
- 识别编程语言（JavaScript/TypeScript/Python/Go等）
- 识别框架（React/Vue/Next.js/Nest.js等）
- 识别数据库类型（MySQL/PostgreSQL/MongoDB等）
- 识别部署环境（Docker/K8s/Serverless等）

### 3. 制定规范内容

#### 3.1 代码风格规范
- 缩进和格式化规则
- 命名约定（变量、函数、类、文件）
- 注释规范
- 代码组织结构

#### 3.2 Git 规范
- 分支命名规范
- 提交信息规范（Conventional Commits）
- 代码审查流程
- 合并策略

#### 3.3 项目结构规范
- 目录组织原则
- 文件命名规范
- 模块划分规则

#### 3.4 API 规范
- RESTful API 设计规范
- 接口命名规范
- 响应格式规范
- 错误处理规范

#### 3.5 数据库规范
- 表命名规范
- 字段命名规范
- 索引命名规范
- 迁移文件规范

#### 3.6 AI 交互协议
- Prompt 编写规范
- 上下文提供规范
- 输出格式要求
- 迭代反馈流程

### 4. 生成配置文件
根据技术栈生成对应的配置文件：
- ESLint 配置
- Prettier 配置
- EditorConfig
- Git Hooks (Husky + lint-staged)
- TypeScript 配置（如适用）

### 5. 文档输出
生成完整的开发规范文档。

## 输出模板

```markdown
# 开发规范 - {项目名称}

> **文档版本**：v1.0  
> **创建日期**：{日期}  
> **最后更新**：{日期}

---

## 文档依赖

| 依赖文档 | 路径 | 说明 |
|---------|------|------|
| 产品概述 | [产品概述.md](./产品概述.md) | 定义功能需求 |
| 技术栈 | [技术栈.md](./技术栈.md) | 定义技术选型 |
| 项目结构 | [项目结构.md](./项目结构.md) | 定义目录结构 |

---

## 一、代码风格规范

### 1.1 通用规则
- 缩进：2空格
- 引号：单引号
- 分号：不使用分号
- ...

### 1.2 命名约定
- 变量：camelCase
- 常量：UPPER_SNAKE_CASE
- 类/组件：PascalCase
- 文件：kebab-case
- ...

## 二、Git 规范

### 2.1 分支命名
- feature/{功能名}
- fix/{问题描述}
- refactor/{重构内容}
- ...

### 2.2 提交信息
格式：<type>(<scope>): <subject>

类型：
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- test: 测试
- chore: 构建/工具

示例：
feat(auth): 添加用户登录功能
fix(api): 修复用户数据获取错误

## 三、API 规范

### 3.1 RESTful 设计
- GET /api/users - 获取用户列表
- POST /api/users - 创建用户
- PUT /api/users/:id - 更新用户
- DELETE /api/users/:id - 删除用户

### 3.2 响应格式
{
  "code": 200,
  "message": "success",
  "data": {}
}

## 四、AI 交互协议

### 4.1 Prompt 规范
- 明确描述目标
- 提供必要上下文
- 指定输出格式
- ...

### 4.2 迭代流程
1. 提出需求
2. AI 生成初版
3. 人工审查反馈
4. AI 优化调整
5. 确认定稿
```

## 输出
- `specs/开发规范.md` - 开发规范文档
- 配置文件（根据技术栈生成）

## 注意事项
1. 规范要符合团队实际情况，不要过于复杂
2. 规范要有可执行性，配套工具支持
3. 规范要持续迭代，根据实践调整
