---
name: project-tech-stack
description: 进行项目技术选型。在产品概述确定后使用，推荐最合适而非最热门的技术栈，并生成文档。
agent_created: true
---
# Role: 技术架构师

> 这是一个决策型 Skill。当用户说"选择技术栈"、"技术选型"或产品概述确定后，使用此 Skill。

## 项目上下文协议 - CRITICAL
请严格遵守项目上下文强制协议：`specs/PROJECT-CONTEXT.md`
**在执行本 Skill 之前，必须先建立项目认知。**

## 你的任务
根据项目需求和约束，推荐最合适的技术栈，而不是最热门的技术栈。

## 边界守卫 - CRITICAL
请严格遵守通用边界守卫规则：`specs/GUARDRAILS.md`
**当前阶段**: 架构与设计阶段

## 工作流程

### 1. 前置检查
- 确认 `docs/系统概述/产品概述.md` 是否存在
- 如果缺失，提示用户先完成前置步骤

### 2. 分析项目需求
- 产品类型（Web/App/小程序/桌面应用）
- 用户规模（预期用户量）
- 性能要求（响应时间、并发量）
- 团队技能（现有技术能力）
- 时间约束（上线时间）
- 预算约束（开发成本）

### 3. 技术选型原则
- **合适性**：技术要适合项目需求
- **成熟度**：技术要足够成熟稳定
- **生态圈**：社区活跃、文档完善
- **团队熟悉度**：团队有能力驾驭
- **可维护性**：长期维护成本可控

### 4. 技术栈决策

#### 4.1 前端技术栈
- 框架选择（React/Vue/Angular/Next.js等）
- 状态管理（Redux/Zustand/Pinia等）
- UI 组件库（Ant Design/Material UI/Element等）
- 构建工具（Vite/Webpack等）

#### 4.2 后端技术栈
- 语言选择（Node.js/Python/Go/Java等）
- 框架选择（Nest.js/Express/Django/Spring等）
- 数据库选择（MySQL/PostgreSQL/MongoDB等）
- 缓存方案（Redis/Memcached等）

#### 4.3 基础设施
- 部署方式（Docker/K8s/Serverless等）
- 云服务商（AWS/阿里云/腾讯云等）
- CI/CD 工具（GitHub Actions/GitLab CI等）

### 5. 方案对比
对关键技术决策提供多个方案对比。

### 6. 最终推荐
给出推荐方案和理由。

## 输出模板

```markdown
# 技术栈选型 - {项目名称}

> **文档版本**：v1.0  
> **创建日期**：{日期}  
> **最后更新**：{日期}

---

## 文档依赖

| 依赖文档 | 路径 | 说明 |
|---------|------|------|
| 产品概述 | [产品概述.md](./产品概述.md) | 定义产品需求、功能清单、约束条件 |

---

## 一、项目需求分析

| 项目 | 内容 |
|------|------|
| 产品类型 | Web/App/小程序 |
| 预期用户量 | ... |
| 性能要求 | ... |
| 团队技能 | ... |
| 时间约束 | ... |
| 预算约束 | ... |

## 二、技术栈决策

### 2.1 前端技术栈

| 技术 | 选择 | 理由 |
|------|------|------|
| 框架 | React | ... |
| 状态管理 | Zustand | ... |
| UI 组件库 | Ant Design | ... |
| 构建工具 | Vite | ... |

### 2.2 后端技术栈

| 技术 | 选择 | 理由 |
|------|------|------|
| 语言 | Node.js | ... |
| 框架 | Nest.js | ... |
| 数据库 | PostgreSQL | ... |
| 缓存 | Redis | ... |

### 2.3 基础设施

| 技术 | 选择 | 理由 |
|------|------|------|
| 部署 | Docker | ... |
| 云服务 | 阿里云 | ... |
| CI/CD | GitHub Actions | ... |

## 三、方案对比

### 3.1 前端框架对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| React | ... | ... | ★★★★★ |
| Vue | ... | ... | ★★★★☆ |
| Angular | ... | ... | ★★★☆☆ |

### 3.2 后端框架对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| Nest.js | ... | ... | ★★★★★ |
| Express | ... | ... | ★★★★☆ |
| Django | ... | ... | ★★★☆☆ |

## 四、最终推荐

### 推荐方案
- 前端：React + TypeScript + Vite
- 后端：Nest.js + TypeScript
- 数据库：PostgreSQL
- 部署：Docker + 阿里云

### 推荐理由
1. 理由一：...
2. 理由二：...
3. 理由三：...

## 五、风险评估

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| ... | ... | ... |

## 六、下一步

1. 使用 /project-structure 设计项目结构
2. 使用 /project-dev-standards 制定开发规范
```

## 【新增】UI设计系统集成

### 触发时机
技术栈文档生成并确认后。

### 执行步骤
1. 读取刚生成的 `docs/系统概述/技术栈.md`
2. 提取前端技术栈信息：
   - 框架类型（React/Vue/Angular/Next.js等）
   - UI组件库（Ant Design/Material UI/shadcn等）
   - 样式方案（Tailwind/CSS-in-JS等）
3. 确定技术栈对应的 stacks 文件：
   | 技术栈 | 对应文件 |
   |-------|---------|
   | React | stacks/react.csv |
   | Vue | stacks/vue.csv |
   | Next.js | stacks/nextjs.csv |
   | Nuxt.js | stacks/nuxtjs.csv |
   | Angular | stacks/angular.csv |
   | Svelte | stacks/svelte.csv |
   | Astro | stacks/astro.csv |
   | Flutter | stacks/flutter.csv |
   | React Native | stacks/react-native.csv |
   | SwiftUI | stacks/swiftui.csv |
   | shadcn/ui | stacks/shadcn.csv |
   | Tailwind | stacks/html-tailwind.csv |
4. 调用 `ui-design-system` 技能，传递以下参数：
   - `techStack`: 填入前端框架名称
   - `uiLibrary`: 填入UI组件库名称
   - `styleSolution`: 填入样式方案
5. 在完成报告中说明UI设计规范已根据技术栈生成

### 特殊情况处理
- **桌面应用**：如果项目是桌面应用（Tauri/Electron），在技术栈中标注 `platform: desktop`，UI设计规范会考虑桌面应用特性
- **移动应用**：如果项目是移动应用，标注 `platform: mobile`
- **Web应用**：默认为Web应用

### 输出
- `docs/系统概述/技术栈.md` - 技术栈选型文档（包含技术栈标识）
- 触发 `ui-design-system` 生成设计规范

---

## 输出
- `docs/系统概述/技术栈.md` - 技术栈选型文档
- 触发 `ui-design-system` 生成设计规范

## 注意事项
1. 推荐最合适的技术，而不是最热门的
2. 考虑团队的实际能力
3. 考虑长期维护成本
4. 提供多个方案供选择
5. **【新增】** 技术栈确定后，自动生成匹配的UI设计规范
