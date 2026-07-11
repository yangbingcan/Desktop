---
name: ui-design-system
description: UI/UX设计智能助手。可独立使用或集成到项目流程中。触发场景：(1)用户请求UI设计 (2)项目规划需要UI规范 (3)功能开发需要组件样式
  (4)配色方案推荐。输出到 specs/ui-design/ 目录。
agent_created: true
---
# UI Design System - UI/UX设计智能助手

> 这是一个设计型 Skill。当用户需要 UI 设计支持时，或在项目规划、功能开发流程中需要前端设计时使用。

## 项目上下文协议 - CRITICAL
请严格遵守项目上下文强制协议：`specs/PROJECT-CONTEXT.md`
**在执行本 Skill 之前，必须先建立项目认知。**

## 边界守卫 - CRITICAL
请严格遵守通用边界守卫规则：`specs/GUARDRAILS.md`
**当前阶段**: 架构与设计阶段

---

## 一、技能定位

### 1.1 核心能力
- **设计系统生成**：根据项目类型自动生成完整设计系统
- **配色方案推荐**：161种行业专属配色方案
- **UI风格推荐**：67种UI风格（Glassmorphism、Neumorphism、Minimalism等）
- **组件规范输出**：按钮、卡片、表单、列表等32+组件规范
- **字体搭配推荐**：57种字体组合方案

### 1.2 使用场景

| 场景 | 触发条件 | 输出 |
|------|---------|------|
| 独立使用 | 用户说"帮我设计XX页面" | 完整设计系统 |
| 项目规划 | `project-product-overview` 调用 | 初始UI规范 |
| 功能设计 | `feature-tech-design` 引用 | 组件规范 |
| 代码实现 | `feature-implementation` 引用 | 具体样式值 |

---

## 二、数据资源

本技能包含以下数据文件（位于 `templates/ui-design-data/` 目录）：

### 2.1 基础数据文件

| 文件 | 内容 | 用途 |
|------|------|------|
| `products.csv` | 161种产品类型 | 匹配项目类型 |
| `styles.csv` | 67种UI风格 | 推荐设计风格 |
| `colors.csv` | 161种配色方案 | 推荐配色 |
| `typography.csv` | 57种字体搭配 | 推荐字体 |
| `landing.csv` | 落地页模式 | 页面结构参考 |
| `ux-guidelines.csv` | UX最佳实践 | 设计指导 |
| `app-interface.csv` | 应用界面 | 界面布局参考 |
| `charts.csv` | 图表设计 | 数据可视化 |
| `design.csv` | 设计规范 | 设计系统参考 |
| `draft.csv` | 草稿模板 | 快速原型 |
| `google-fonts.csv` | Google字体库 | 字体选择 |
| `icons.csv` | 图标库 | 图标推荐 |
| `react-performance.csv` | React性能优化 | 性能优化建议 |
| `ui-reasoning.csv` | UI推理规则 | 设计决策依据 |

### 2.2 技术栈数据文件（stacks 子目录）

根据项目技术栈，读取对应的组件规范文件：

| 文件 | 适用技术栈 | 内容 |
|------|-----------|------|
| `stacks/react.csv` | React | React 组件规范 |
| `stacks/vue.csv` | Vue | Vue 组件规范 |
| `stacks/nextjs.csv` | Next.js | Next.js 页面规范 |
| `stacks/nuxtjs.csv` | Nuxt.js | Nuxt.js 页面规范 |
| `stacks/nuxt-ui.csv` | Nuxt UI | Nuxt UI 组件规范 |
| `stacks/angular.csv` | Angular | Angular 组件规范 |
| `stacks/svelte.csv` | Svelte | Svelte 组件规范 |
| `stacks/astro.csv` | Astro | Astro 组件规范 |
| `stacks/shadcn.csv` | shadcn/ui | shadcn 组件规范 |
| `stacks/html-tailwind.csv` | HTML + Tailwind | Tailwind 样式规范 |
| `stacks/flutter.csv` | Flutter | Flutter Widget规范 |
| `stacks/react-native.csv` | React Native | RN 组件规范 |
| `stacks/swiftui.csv` | SwiftUI | SwiftUI 视图规范 |
| `stacks/jetpack-compose.csv` | Jetpack Compose | Compose 组件规范 |
| `stacks/laravel.csv` | Laravel | Laravel Blade规范 |
| `stacks/threejs.csv` | Three.js | 3D 场景规范 |

**数据来源**：`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`

**更新方式**：执行 `project-protocol-init` 技能或说"更新UI素材"

---

## 三、执行流程

### 第一步：分析项目上下文

**读取项目文档（如果存在）：**
```
docs/系统概述/产品概述.md     → 了解产品类型
docs/系统概述/技术栈.md       → 了解技术平台
specs/ui-design/      → 检查是否已有设计规范
```

**确定设计需求：**
- 产品类型/行业（SaaS、电商、金融、医疗等）
- 目标平台（Web、小程序、App）
- 技术栈（React、Vue、Next.js 等）
- 设计偏好（现代、简约、专业、活泼等）

---

### 第二步：查询数据资源

**2.1 匹配产品类型**
- 读取 `docs/ui-design-data/products.csv`
- 根据项目描述匹配最合适的产品类型
- 获取推荐的UI风格和配色方案

**2.2 查询UI风格**
- 读取 `docs/ui-design-data/styles.csv`
- 根据产品类型获取风格推荐
- 提供风格特点和适用场景

**2.3 获取配色方案**
- 读取 `docs/ui-design-data/colors.csv`
- 根据产品类型匹配配色
- 输出主色、辅色、功能色

**2.4 查询字体搭配**
- 读取 `docs/ui-design-data/typography.csv`
- 获取字体推荐
- 输出标题字体、正文字体

**2.5 读取技术栈组件规范（重要）**
- 根据项目技术栈，读取对应的 stacks 文件：
  - React 项目 → `docs/ui-design-data/stacks/react.csv`
  - Vue 项目 → `docs/ui-design-data/stacks/vue.csv`
  - Next.js 项目 → `docs/ui-design-data/stacks/nextjs.csv`
  - 其他技术栈参考 2.2 节的文件列表
- 获取技术栈专属的组件规范和样式建议
- 如果项目使用 shadcn/ui，额外读取 `stacks/shadcn.csv`

---

### 第三步：生成设计系统

**3.1 确定UI风格**

根据产品类型匹配UI风格：

| 产品类型 | 推荐风格 | 特点 |
|---------|---------|------|
| SaaS/企业应用 | Minimalism / Glassmorphism | 专业、清晰、高效 |
| 电商/零售 | Soft UI / Flat Design | 友好、信任、转化 |
| 金融/银行 | Minimalism / Professional | 稳重、安全、可信 |
| 医疗/健康 | Soft UI / Clean | 温和、专业、安心 |
| 社交/娱乐 | Vibrant / Neubrutalism | 活泼、年轻、有趣 |
| 工具/效率 | Minimalism / Swiss Style | 高效、清晰、专注 |

**3.2 生成配色方案**

根据产品类型推荐配色：

| 产品类型 | 主色系 | 示例 |
|---------|-------|------|
| SaaS | 蓝色系 | #3B82F6 (专业蓝) |
| 金融 | 深蓝/金色 | #1E3A5F + #D4AF37 |
| 电商 | 橙色/红色 | #F97316 (活力橙) |
| 医疗 | 绿色/蓝色 | #10B981 (健康绿) |
| 社交 | 紫色/粉色 | #8B5CF6 (社交紫) |
| 工具 | 灰色/蓝色 | #6B7280 (中性灰) |

**3.3 定义字体规范**

```
标题字体：PingFang SC / Microsoft YaHei / -apple-system
正文字体：PingFang SC / Microsoft YaHei / -apple-system
数字字体：DIN / SF Mono (用于金额、数据)
```

**3.4 应用技术栈组件规范**

根据项目技术栈，应用对应的组件规范：

| 技术栈 | 组件规范来源 | 特殊考虑 |
|--------|-------------|---------|
| React | `stacks/react.csv` | 函数组件、Hooks |
| Vue | `stacks/vue.csv` | Composition API |
| Next.js | `stacks/nextjs.csv` | SSR/SSG、App Router |
| shadcn/ui | `stacks/shadcn.csv` | Radix UI、Tailwind |
| Flutter | `stacks/flutter.csv` | Widget、Material/Cupertino |

**3.5 定义组件规范**

核心组件清单：
- 容器：页面容器、卡片容器、列表容器
- 导航：头部导航、底部导航、标签栏
- 输入：输入框、选择器、开关、复选框
- 展示：卡片、列表项、头像、标签、徽章
- 反馈：按钮、弹窗、Toast、Loading
- 数据：表格、图表、进度条

---

### 第四步：输出设计文档

**创建目录结构：**
```
specs/ui-design/
├── design-system.md      # 设计系统总览
├── color-palette.md      # 配色方案
├── typography.md         # 字体规范
├── components.md         # 组件规范
└── patterns.md           # 设计模式
```

---

## 四、输出模板

### 4.1 design-system.md 模板

```markdown
# 设计系统 - {项目名称}

## 一、概述

| 项目 | 内容 |
|------|------|
| 产品类型 | {类型} |
| 目标平台 | {平台} |
| 设计风格 | {风格} |
| 设计原则 | {原则} |

## 二、设计原则

1. **一致性**：相同功能使用相同的视觉表达
2. **清晰性**：信息层级分明，重点突出
3. **高效性**：减少用户操作步骤
4. **友好性**：温和的视觉风格，舒适的交互反馈

## 三、核心规范

详见：
- [配色方案](./color-palette.md)
- [字体规范](./typography.md)
- [组件规范](./components.md)
- [设计模式](./patterns.md)
```

### 4.2 color-palette.md 模板

```markdown
# 配色方案

## 一、主色系

| 用途 | 颜色名称 | 色值 | 使用场景 |
|------|---------|------|---------|
| 主色 | {名称} | #{HEX} | 主要按钮、重点元素 |
| 辅色 | {名称} | #{HEX} | 次要按钮、辅助元素 |
| 强调色 | {名称} | #{HEX} | 链接、高亮、提示 |

## 二、功能色

| 用途 | 色值 | 使用场景 |
|------|------|---------|
| 成功 | #10B981 | 成功提示、完成状态 |
| 警告 | #F59E0B | 警告提示、待处理 |
| 错误 | #EF4444 | 错误提示、删除操作 |
| 信息 | #3B82F6 | 信息提示、帮助说明 |

## 三、中性色

| 用途 | 色值 | 使用场景 |
|------|------|---------|
| 标题文字 | #1F2937 | 页面标题、重要文字 |
| 正文文字 | #374151 | 正文内容 |
| 次要文字 | #6B7280 | 辅助说明、时间戳 |
| 占位文字 | #9CA3AF | 输入提示、空状态 |
| 边框 | #E5E7EB | 分割线、边框 |
| 背景 | #F9FAFB | 页面背景 |
| 卡片背景 | #FFFFFF | 卡片、容器背景 |

## 四、状态色（项目专属）

| 状态 | 色值 | 使用场景 |
|------|------|---------|
| 欠款 | #EF4444 | 欠款金额、逾期状态 |
| 结清 | #10B981 | 已结清状态 |
| 部分付款 | #F59E0B | 部分付款状态 |
```

### 4.3 components.md 模板

```markdown
# 组件规范

## 一、容器组件

### 1.1 页面容器
\`\`\`css
.page-container {
  padding: 32rpx;
  background-color: #F9FAFB;
  min-height: 100vh;
}
\`\`\`

### 1.2 卡片容器
\`\`\`css
.card {
  background-color: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}
\`\`\`

## 二、按钮组件

### 2.1 主按钮
\`\`\`css
.btn-primary {
  background-color: #3B82F6;
  color: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx 48rpx;
  font-size: 32rpx;
  font-weight: 500;
}
\`\`\`

### 2.2 次按钮
\`\`\`css
.btn-secondary {
  background-color: #FFFFFF;
  color: #3B82F6;
  border: 2rpx solid #3B82F6;
  border-radius: 16rpx;
  padding: 24rpx 48rpx;
}
\`\`\`

## 三、列表组件

### 3.1 列表项
\`\`\`css
.list-item {
  display: flex;
  align-items: center;
  padding: 32rpx;
  background-color: #FFFFFF;
  border-bottom: 1rpx solid #E5E7EB;
}
\`\`\`

## 四、表单组件

### 4.1 输入框
\`\`\`css
.input-field {
  background-color: #F9FAFB;
  border: 2rpx solid #E5E7EB;
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  font-size: 32rpx;
}
\`\`\`

## 五、状态标签

### 5.1 状态徽章
\`\`\`css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.badge-danger {
  background-color: #FEE2E2;
  color: #DC2626;
}

.badge-success {
  background-color: #D1FAE5;
  color: #059669;
}

.badge-warning {
  background-color: #FEF3C7;
  color: #D97706;
}
\`\`\`
```

---

## 五、与其他技能的协作

### 5.1 被 `project-product-overview` 调用

**触发时机**：产品概述文档生成后

**执行逻辑**：
1. 读取 `docs/系统概述/产品概述.md`
2. 提取产品类型、目标用户
3. 查询数据资源匹配设计
4. 生成初始设计系统
5. 输出到 `specs/ui-design/`

### 5.2 被 `feature-tech-design` 引用

**触发时机**：设计前端实现时

**执行逻辑**：
1. 检查 `specs/ui-design/` 是否存在
2. 如果存在，读取组件规范
3. 在技术方案中引用组件规范
4. 确保页面设计遵循UI规范

### 5.3 被 `feature-implementation` 引用

**触发时机**：编写前端代码时

**执行逻辑**：
1. 读取 `specs/ui-design/components.md`
2. 提取具体CSS值
3. 确保代码遵循UI规范

---

## 六、交互准则

### 6.1 信息收集
- 如果用户未提供产品类型，询问："这是什么类型的产品？比如：SaaS工具、电商、金融、社交等"
- 如果用户未提供平台信息，询问："目标平台是什么？Web、小程序、还是App？"

### 6.2 风格确认
- 提供风格选项让用户选择
- 根据产品类型给出推荐

### 6.3 输出确认
- 展示设计系统概要
- 询问用户是否满意
- 确认后保存到 `specs/ui-design/`

---

## 七、最终交付

- `specs/ui-design/design-system.md` - 设计系统总览
- `specs/ui-design/color-palette.md` - 配色方案
- `specs/ui-design/typography.md` - 字体规范
- `specs/ui-design/components.md` - 组件规范
- `specs/ui-design/patterns.md` - 设计模式（可选）
