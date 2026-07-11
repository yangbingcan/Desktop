---
name: project-structure
description: 定义项目目录结构。在技术栈确定后使用，基于技术栈和业务核心设计高内聚低耦合的目录结构。
agent_created: true
---
# Role: 架构设计师

> 这是一个设计型 Skill。当用户说"设计项目结构"或技术栈确定后，使用此 Skill。

## 项目上下文协议 - CRITICAL
请严格遵守项目上下文强制协议：`specs/PROJECT-CONTEXT.md`
**在执行本 Skill 之前，必须先建立项目认知。**

## 你的任务
根据技术栈和业务核心，设计一个高内聚、低耦合的项目目录结构。

## 边界守卫 - CRITICAL
请严格遵守通用边界守卫规则：`specs/GUARDRAILS.md`
**当前阶段**: 架构与设计阶段

## 工作流程

### 1. 前置检查
- 确认 `docs/系统概述/产品概述.md` 是否存在
- 确认 `docs/系统概述/技术栈.md` 是否存在
- 如果缺失，提示用户先完成前置步骤

### 2. 分析业务核心
- 识别核心业务模块
- 确定模块间的依赖关系
- 分析数据流向

### 3. 分析技术栈
- 前端框架（React/Vue/Angular等）
- 后端框架（Nest.js/Express/Django等）
- 数据库类型
- 部署方式

### 4. 设计目录结构
根据技术栈和业务特点设计目录结构。

## 目录结构模板

### 前端项目（React/Vue）
```
src/
├── components/          # 公共组件
│   ├── common/         # 通用组件
│   └── business/       # 业务组件
├── pages/              # 页面组件
├── hooks/              # 自定义 Hooks
├── services/           # API 服务
├── stores/             # 状态管理
├── utils/              # 工具函数
├── constants/          # 常量定义
├── types/              # 类型定义
├── styles/             # 全局样式
└── assets/             # 静态资源
```

### 后端项目（Nest.js）
```
src/
├── modules/            # 业务模块
│   ├── user/
│   ├── auth/
│   └── ...
├── common/             # 公共模块
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/             # 配置
├── entities/           # 实体
├── dto/                # 数据传输对象
└── utils/              # 工具函数
```

### 全栈项目（Next.js）
```
src/
├── app/                # App Router
│   ├── (auth)/        # 认证相关页面
│   ├── (dashboard)/   # 仪表板页面
│   └── api/           # API 路由
├── components/         # 组件
├── lib/                # 工具库
├── hooks/              # Hooks
├── types/              # 类型定义
└── styles/             # 样式
```

## 输出模板

```markdown
# 项目结构 - {项目名称}

> **文档版本**：v1.0  
> **创建日期**：{日期}  
> **最后更新**：{日期}

---

## 文档依赖

| 依赖文档 | 路径 | 说明 |
|---------|------|------|
| 产品概述 | [产品概述.md](./产品概述.md) | 定义业务板块、功能模块 |
| 技术栈 | [技术栈.md](./技术栈.md) | 定义技术选型，决定目录结构 |

---

## 一、目录结构

\`\`\`
{项目根目录}/
├── src/                # 源代码
│   ├── ...
├── tests/              # 测试文件
├── docs/               # 文档
├── public/             # 静态资源
└── ...
\`\`\`

## 二、目录说明

| 目录 | 用途 | 说明 |
|------|------|------|
| src/ | 源代码 | 主要开发目录 |
| tests/ | 测试文件 | 单元测试、集成测试 |
| docs/ | 文档 | 项目文档 |
| ... | ... | ... |

## 三、命名规范

- 目录：kebab-case
- 组件文件：PascalCase.tsx
- 工具文件：camelCase.ts
- 样式文件：kebab-case.css
```

## 输出
- `docs/系统概述/项目结构.md` - 项目结构文档

## 注意事项
1. 结构要清晰，易于理解
2. 模块要高内聚、低耦合
3. 遵循技术栈的最佳实践
4. 考虑可扩展性
