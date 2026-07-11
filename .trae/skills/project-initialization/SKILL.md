---
name: project-initialization
description: 项目初始化执行者。读取 specs/ 下的定义文档，自动创建目录结构、配置文件和初始化 Git 仓库。
agent_created: true
---
# Role: 项目初始化工程师

> 这是一个执行型 Skill。当用户说"初始化项目"或完成项目规划后，使用此 Skill。

## 项目上下文协议 - CRITICAL
请严格遵守项目上下文强制协议：`specs/PROJECT-CONTEXT.md`
**在执行本 Skill 之前，必须先建立项目认知。**

## 你的任务
读取 `specs/` 目录下的所有定义文档，自动创建项目的目录结构、配置文件，并初始化 Git 仓库。

## 边界守卫 - CRITICAL
请严格遵守通用边界守卫规则：`specs/GUARDRAILS.md`
**当前阶段**: 项目初始化阶段

## 工作流程

### 1. 前置检查
- 确认 `docs/系统概述/产品概述.md` 是否存在
- 确认 `docs/系统概述/技术栈.md` 是否存在
- 确认 `docs/系统概述/项目结构.md` 是否存在
- 确认 `docs/系统概述/开发规范.md` 是否存在
- 如果缺失，提示用户先完成前置步骤

### 2. 读取定义文档
按顺序读取以下文档：
1. `docs/系统概述/产品概述.md` - 了解项目背景
2. `docs/系统概述/技术栈.md` - 确定技术选型
3. `docs/系统概述/项目结构.md` - 确定目录结构
4. `docs/系统概述/开发规范.md` - 确定代码规范

### 3. 创建目录结构
根据 `docs/系统概述/项目结构.md` 创建所有目录。

### 4. 初始化项目
根据技术栈执行初始化：
- Node.js 项目：`npm init -y` 或使用框架脚手架
- Python 项目：创建虚拟环境、requirements.txt
- Go 项目：`go mod init`
- 其他语言按规范初始化

### 5. 创建配置文件
根据技术栈和规范创建：
- ESLint 配置
- Prettier 配置
- TypeScript 配置
- Git 忽略文件
- 环境变量模板
- 其他必要配置

### 6. 初始化 Git
- `git init`
- 创建初始提交
- 设置分支保护规则（如需要）

### 7. 安装依赖
根据技术栈安装基础依赖：
- 开发依赖
- 核心框架
- 工具库

### 8. 创建基础文件
- README.md
- 项目入口文件
- 基础配置文件

## 输出确认

完成后，向用户展示：
```
=== 项目初始化完成 ===

已创建目录：
- src/
- tests/
- docs/
- ...

已创建配置文件：
- package.json
- tsconfig.json
- .eslintrc.js
- .prettierrc
- .gitignore
- ...

已初始化：
- Git 仓库
- 依赖安装

下一步：
1. 使用 /feature-requirements-clarification 开始功能开发
```

## 输出
- 完整的项目目录结构
- 配置文件
- Git 仓库
- 基础依赖

## 注意事项
1. 不要覆盖已有文件
2. 保持幂等性，可重复执行
3. 确保所有路径正确
4. 记录所有创建的文件和目录
