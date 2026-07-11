---
name: "b-end-design-skill"
description: "B端后台管理系统UI设计规范查询、界面原型生成、代码规范自查。适用于管理后台、数据看板、表单页面等B端场景。基于Ant Design设计体系+业界通用B端规范。"
agent_created: true
---

# B 端设计规范 Skill

## 技能说明
本 Skill 适用于 B 端后台管理系统的 UI 设计规范查询、界面原型生成、代码规范自查。
基于 Ant Design 设计体系 + 业界通用 B 端规范整理，拿到即用，替换品牌色后可直接落地。

---

## 预设人设（导入后直接激活）

```
你是 B 端产品专属设计规范顾问，严格依据本 Skill 文档作答。
回答原则：
1. 优先输出硬性规则、标准尺寸、禁用项、最佳实践
2. 回答精简落地，不输出冗余科普内容
3. 所有尺寸以 px 为单位，颜色使用 Token 变量名输出
4. 规范未覆盖的场景，说明「未覆盖，建议参考 Ant Design 规范」
激活词：当用户询问 B 端设计相关问题时自动激活本 Skill。
```

---

## 使用方式

**查询规范**
> 「按钮的标准高度是多少？」
> 「表格操作列超过几个需要折叠？」

**生成原型**
> 「用这套 Skill 帮我生成一个订单列表页」
> 「按照规范生成一个审批流详情页」

**自查验收**
> 「帮我检查这段代码是否符合 B 端设计规范」
> 「对照 checklist 验收这个页面设计」

---

# 一、tokens/ 设计基础变量

> 所有组件和页面模板引用变量名，不硬编码数值。
> 🔧 只需修改 value 字段，全局同步更新。

## 1.1 色彩 Token

### 品牌色
| Token | 默认值 | 用途 |
|---|---|---|
| brand.primary | #1677FF | 主按钮、链接、选中态、焦点边框 |
| brand.primary-hover | #4096FF | 主色悬停态 |
| brand.primary-active | #0958D9 | 主色点击态 |
| brand.primary-disabled | #91CAFF | 主色禁用态 |
| brand.primary-bg | #E6F4FF | 主色浅背景，用于选中行、激活容器 |

🔧 **替换方式**：将 brand.primary 改为你的品牌色，hover 调亮 15%，active 调深 15%，disabled 降透明度至 40%，bg 取主色的 10% 透明度叠白底。

### 功能色（不可自定义替换）
| Token | 值 | 用途 |
|---|---|---|
| func.success | #52C41A | 成功、通过、完成、启用 |
| func.success-bg | #F6FFED | 成功状态背景 |
| func.warning | #FAAD14 | 警告、待处理、注意 |
| func.warning-bg | #FFFBE6 | 警告状态背景 |
| func.error | #FF4D4F | 错误、失败、拒绝、删除 |
| func.error-bg | #FFF2F0 | 错误状态背景 |
| func.info | #1677FF | 信息提示、说明 |
| func.info-bg | #E6F4FF | 信息状态背景 |

### 文字色
| Token | 值 | 用途 |
|---|---|---|
| text.primary | #1F1F1F | 标题、重要信息、主文案 |
| text.secondary | #595959 | 正文、次要信息 |
| text.tertiary | #8C8C8C | 辅助文字、placeholder、说明 |
| text.disabled | #BFBFBF | 禁用态文字 |
| text.inverse | #FFFFFF | 深色背景上的文字 |
| text.link | #1677FF | 链接文字 |

### 背景色
| Token | 值 | 用途 |
|---|---|---|
| bg.page | #F5F5F5 | 页面底色 |
| bg.card | #FFFFFF | 卡片、面板、表格背景 |
| bg.hover | #F0F0F0 | 列表行 hover、菜单项 hover |
| bg.selected | #E6F4FF | 选中行、激活菜单项 |
| bg.mask | rgba(0,0,0,0.45) | 弹窗遮罩层 |

### 边框色
| Token | 值 | 用途 |
|---|---|---|
| border.default | #D9D9D9 | 输入框、卡片、分割线 |
| border.strong | #BFBFBF | 需要强调的边框 |
| border.focus | #1677FF | 输入框聚焦态 |
| border.error | #FF4D4F | 输入框错误态 |

---

## 1.2 字体 Token

**字体家族**
```
font-family: PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;
```

**字号层级**
| Token | 字号 | 行高 | 字重 | 用途 |
|---|---|---|---|---|
| text.page-title | 20px | 28px | 600 | 页面主标题，每页仅一个 |
| text.module-title | 16px | 24px | 600 | 卡片标题、模块标题 |
| text.body | 14px | 22px | 400 | 标准正文，最高频 |
| text.caption | 12px | 20px | 400 | 辅助说明、标签、时间戳 |
| text.table-header | 14px | 22px | 500 | 表格表头 |

**强制要求**
- 最小字号不低于 12px
- 标题 weight 600，正文 400，强调 500
- 禁止同页面字号层级混乱随意混用

---

## 1.3 间距 Token

**基础单位：4px**（所有间距为 4 的倍数）

| Token | 值 | 语义用途 |
|---|---|---|
| space.xs | 4px | 组件内紧凑间距 |
| space.sm | 8px | 行内元素间距（图标+文字） |
| space.md | 12px | 组件间距 |
| space.lg | 16px | 模块内边距、卡片间距 |
| space.xl | 24px | 页面边距、卡片内边距 |
| space.2xl | 32px | 表单字段间距、分组间距 |
| space.3xl | 48px | 大模块间距 |

**语义间距**
| 名称 | 值 | 说明 |
|---|---|---|
| page-padding-x | 24px | 页面左右边距 |
| page-padding-y | 24px | 页面上下边距 |
| card-padding | 16px | 标准卡片内边距 |
| card-padding-lg | 24px | 大卡片内边距 |
| form-item-gap | 24px | 表单字段上下间距 |
| section-gap | 16px | 卡片与卡片间距 |
| inline-gap | 8px | 行内元素水平间距 |

**栅格**
- 列数：24 列
- 列间距：16px
- 常用分栏：全宽(24)、1/2(12)、1/3(8)、2/3(16)、1/4(6)

---

## 1.4 圆角 & 阴影 Token

**圆角**
| Token | 值 | 适用组件 |
|---|---|---|
| radius.sm | 2px | 标签 Tag、徽标 Badge |
| radius.md | 4px | 按钮、输入框、表格、下拉框 |
| radius.lg | 8px | 卡片 Card、面板 Panel |
| radius.xl | 16px | 弹窗 Modal、抽屉 Drawer |
| radius.full | 999px | 圆形头像、胶囊标签 |

**阴影**
| Token | 值 | 适用场景 |
|---|---|---|
| shadow.sm | 0 1px 2px rgba(0,0,0,0.06) | 卡片默认态 |
| shadow.md | 0 4px 12px rgba(0,0,0,0.08) | 卡片 hover、下拉菜单 |
| shadow.lg | 0 8px 24px rgba(0,0,0,0.10) | Modal 弹窗、Drawer |
| shadow.xl | 0 16px 48px rgba(0,0,0,0.12) | 全局顶层浮层 |

**禁止**：彩色阴影、装饰性内阴影、超过 shadow.lg 的厚重阴影

---

# 二、components/ 组件规范

## 2.1 按钮 Button

**类型与用途**
| 类型 | 场景 | 每页数量 |
|---|---|---|
| Primary 主按钮 | 页面核心操作 | 仅 1 个 |
| Default 次按钮 | 次要操作、取消 | 不限 |
| Text 文字按钮 | 低优先级、表格行内操作 | 不限 |
| Danger 危险按钮 | 删除、停用等不可逆操作 | 按需 |

**尺寸规范**
| 尺寸 | 高度 | 字号 | 左右内边距 | 圆角 |
|---|---|---|---|---|
| Large | 40px | 14px | 16px | radius.md(4px) |
| Middle（默认）| 32px | 14px | 12px | radius.md(4px) |
| Small | 24px | 12px | 8px | radius.md(4px) |

**交互状态**
- 默认：正常样式
- Hover：背景调亮，border 变主色
- Active：背景加深，有按压感
- Loading：展示 spinner，禁止重复点击
- Disabled：opacity 40%，cursor not-allowed

**强制要求**
- 单页面主按钮不超过 1 个
- 危险操作必须有二次确认弹窗
- 最小点击热区 32×32px

**禁止设计**
- 页面出现 2 个以上高亮主按钮
- 按钮高度低于 24px
- 禁用态无视觉弱化

---

## 2.2 输入框 Input

**类型**
| 类型 | 圆角 | 场景 |
|---|---|---|
| 普通输入框 | radius.md(4px) | 表单填写 |
| 搜索框 | radius.xl(16px) | 搜索、筛选 |
| 文本域 Textarea | radius.md(4px) | 多行文本 |

**尺寸规范**
| 尺寸 | 高度 | 字号 | 内边距 |
|---|---|---|---|
| Large | 40px | 14px | 左右 12px |
| Middle（默认）| 32px | 14px | 左右 12px |
| Small | 24px | 12px | 左右 8px |

**交互状态**
| 状态 | 边框 | 额外样式 |
|---|---|---|
| 默认 | border.default | — |
| 聚焦 | border.focus | 外发光 0 0 0 2px rgba(22,119,255,0.1) |
| 错误 | border.error | 外发光 0 0 0 2px rgba(255,77,79,0.1) |
| 禁用 | border.default | 背景 bg.disabled，cursor not-allowed |

**强制要求**
- 必填项 Label 前标红色星号 *
- 错误态必须同时标红边框 + 显示错误文字
- 不能只弹 Toast 代替字段错误提示

**禁止设计**
- 输入框无边框无法识别
- 错误只弹 Toast 不标红字段
- 占位文字使用无意义的「请输入」

---

## 2.3 表格 Table

**行高规格**
| 规格 | 行高 | 场景 |
|---|---|---|
| 默认 | 54px | 标准数据列表 |
| 紧凑 | 38px | 数据密集、对比场景 |
| 宽松 | 70px | 含图片、多行内容 |

**结构规范**
- 表头背景：#FAFAFA，字重 500
- 表头高度：46px
- 行 hover 背景：bg.hover(#F0F0F0)
- 选中行背景：bg.selected(#E6F4FF)
- 操作列：固定右侧，box-shadow 区分
- 列间距：左右 padding 各 16px

**强制要求**
- 操作列超过 4 个必须折叠进「更多」下拉
- 空数据必须展示空态组件（插图 + 文字 + 引导操作）
- 分页必须展示，含总条数
- 支持批量操作时，顶部展示已选数量

**禁止设计**
- 无分页做无限滚动
- 操作列不固定右侧
- 空表格无任何提示

---

## 2.4 表单 Form

**布局**
- 优先单列布局
- 字段超过 8 个或逻辑分区明显时，按组用卡片包裹
- 字段超过 10 个考虑分步骤（Step 组件）
- Label 宽度：80~120px（同页面统一）

**底部操作栏**
- position: sticky，bottom: 0
- 取消在左，提交在右，间距 8px
- 背景白色，顶部 1px 分割线，box-shadow 向上

**强制要求**
- 提交前执行全量校验，错误字段滚动到视口并高亮
- 提交中按钮变 Loading，禁止重复提交
- 取消时若已填写内容，弹窗提示「确认放弃已填写的内容？」

---

## 2.5 全局交互状态

**8 种必覆盖状态**
| 状态 | 触发条件 | 视觉表现 | 交互限制 |
|---|---|---|---|
| 默认 | 初始加载 | 正常样式 | 无 |
| Hover | 鼠标悬停 | bg.hover，cursor pointer | 无 |
| 激活 | 鼠标按下 | 背景加深，有按压感 | 无 |
| 选中 | 用户选择 | 主色高亮，bg.selected | 无 |
| 禁用 | 不可操作 | opacity 40%，cursor not-allowed | 禁止点击 |
| 加载 | 等待响应 | spinner 图标 | 禁止重复触发 |
| 错误 | 校验失败 | 红色边框 + 错误文字 | 需修正才可提交 |
| 空态 | 无数据 | 居中插图 + 说明 + 引导按钮 | 提供操作入口 |

**最小点击热区：32×32px**

---

# 三、patterns/ 页面设计模式

## 3.1 列表页

**页面结构**
```
┌─────────────────────────────────────────────────────────┐
│  [页面标题]                          [导出] [+ 新建]     │  页头区
├─────────────────────────────────────────────────────────┤
│  [搜索框]  [状态筛选]  [时间范围]   [重置] [查询]        │  筛选区
├─────────────────────────────────────────────────────────┤
│  □  编号    名称    状态    时间    操作                  │
│  ────────────────────────────────────────────────────   │
│  □  001    张三    启用    01-01   查看  编辑  删除      │  表格区
│  □  002    李四    禁用    01-02   查看  编辑  更多      │
│  ────────────────────────────────────────────────────   │
│  已选 2 项  [批量导出]  [批量删除]                        │  批量操作
├─────────────────────────────────────────────────────────┤
│  共 128 条       < 1  2  3 ... >       10条/页           │  分页区
└─────────────────────────────────────────────────────────┘
```

**规范说明**
| 区域 | 规范 |
|---|---|
| 页头区 | 左侧标题(20px 加粗)，右侧操作按钮，主按钮最多 1 个 |
| 筛选区 | 常用条件 ≤4 个直接展示，超过收进「展开筛选」 |
| 表格区 | 状态列用彩色圆点区分，操作列超 4 个折叠为「更多」 |
| 批量操作 | 勾选后顶部浮现，显示已选数量 |
| 分页区 | 展示总条数、页码、每页条数(10/20/50) |

**强制要求**
- 默认加载数据，不做空白等待
- 空数据展示空态，含引导操作（如「去新建」）
- 操作列固定右侧

---

## 3.2 详情页

**页面结构**
```
[首页] / [列表页] / 当前页面                              面包屑
┌─────────────────────────────────────────────────────────┐
│  页面标题  #编号    [状态标签]        [次操作] [主操作]   │  页头区
├─────────────────────────────────────────────────────────┤
│  ┌── 基本信息 ───────────────────────────────────────┐  │
│  │  字段A：值      字段B：值      字段C：值           │  │  信息卡片
│  │  字段D：值      字段E：值                          │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌── 关联信息 ───────────────────────────────────────┐  │
│  │  [Tab1]  [Tab2]  [Tab3]                           │  │  关联Tab
│  │  对应 Tab 内容区域                                 │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**强制要求**
- 面包屑必须存在，点击可返回上级
- 状态变更必须有二次确认弹窗
- 核心操作按钮始终在视口内可见
- 关联信息超过 3 个模块用 Tab 切换

---

## 3.3 表单页

**页面结构**
```
┌─────────────────────────────────────────────────────────┐
│  新建 XXX                                               │  标题
│  [步骤1：基本信息] ── [步骤2：详细填写] ── [步骤3：确认] │  步骤条
├─────────────────────────────────────────────────────────┤
│  ┌── 基本信息 ───────────────────────────────────────┐  │
│  │  字段A *  [___________]    字段B *  [___________] │  │
│  │  字段C *  [___________]    字段D    [___________] │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌── 详细信息 ───────────────────────────────────────┐  │
│  │  字段E *  [多行文本框_________________________]   │  │
│  │           [________________________________]      │  │
│  │  附件上传  [点击上传]  支持 PDF/Word，≤10MB       │  │
│  └────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  * 为必填项                      [取消]  [保存草稿]  [提交] │  底部操作栏
└─────────────────────────────────────────────────────────┘
```

**强制要求**
- 步骤条：字段超过 10 个或流程分阶段时使用
- 底部操作栏：固定，取消在左，提交在右
- 提交中按钮变 Loading，禁止重复点击

---

## 3.4 数据看板

**页面结构**
```
┌─────────────────────────────────────────────────────────┐
│  数据概览                [时间范围]  [维度筛选]           │  筛选
├──────────────┬──────────────┬──────────────┬────────────┤
│   核心指标    │   核心指标   │   核心指标   │  核心指标  │  指标卡
│   1,234      │   89.2%     │   ¥56,789   │  2.3小时   │
│   +12.3%     │   +2.1%    │   +8.9%     │  -0.5h     │
├──────────────┴──────────────┴──────────────┴────────────┤
│   ┌── 趋势图（折线图）────────┐  ┌── 占比（饼图）──────┐ │
│   │                          │  │                     │ │  图表区
│   └──────────────────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  明细数据                                   [导出 Excel] │  明细
│  标准表格...                                             │
└─────────────────────────────────────────────────────────┘
```

**强制要求**
- 指标卡 3~4 个，数字大号展示（28px 加粗）
- 指标标注同比/环比变化，绿涨红跌
- 图表必须有 loading 态和空态
- 指标卡 hover 显示统计口径说明

---

# 四、templates/ 业务场景模板

## 4.1 审批流

**状态定义**
| 状态 | 颜色 Token | 含义 |
|---|---|---|
| 待审批 | func.info | 等待当前节点操作 |
| 审批中 | func.warning | 流程流转中，当前节点 |
| 已通过 | func.success | 审批完成 |
| 已拒绝 | func.error | 审批终止 |
| 已撤回 | text.tertiary | 申请人主动撤回 |

**页面结构**
```
┌─────────────────────────────────────────────────────────┐
│  [返回]  审批详情  #编号       [状态标签]                │
├─────────────────────────────────────────────────────────┤
│  ┌── 申请信息 ────────────────────────────────────────┐ │
│  │  申请人 / 部门 / 时间 / 申请内容                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌── 审批流程（时间轴）──────────────────────────────┐ │
│  │  已完成节点  姓名  时间  意见                      │ │
│  │  ─── 当前节点（高亮）────────────────────────────  │ │
│  │  待处理节点                                        │ │
│  └───────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  审批意见 [___________]          [拒绝]  [通过]          │  当前节点审批人可见
└─────────────────────────────────────────────────────────┘
```

**强制要求**
- 拒绝操作必须填写原因（必填）
- 通过/拒绝均需二次确认弹窗
- 审批记录只读，不可编辑删除
- 当前节点高亮区分

---

## 4.2 权限管理

**页面结构**
```
┌───────────────────┬─────────────────────────────────────┐
│  角色列表          │  权限配置：[当前角色名]              │
│  ─────────────── │  ──────────────────────────────────  │
│  超级管理员   8人  │  [全选]  菜单权限                    │
│  运营专员  > 15人  │                                     │
│  财务专员     6人  │  ▼ 模块A                            │
│                   │    ▼ 菜单1     [√] 查看  [√] 操作   │
│  [+ 新建角色]      │    ▼ 菜单2     [√] 查看  [ ] 操作   │
│                   │  ▶ 模块B       [－]（半选）           │
│                   │  ▶ 模块C       [ ]                   │
│                   │                   [取消]  [保存]     │
└───────────────────┴─────────────────────────────────────┘
```

**强制要求**
- 超级管理员不可删除、不可修改权限
- 权限保存前弹窗说明影响范围（「此操作将影响 N 名用户」）
- 半选状态（indeterminate）必须实现
- 权限变更写入操作日志

---

## 4.3 消息通知

**状态定义**
| 状态 | 视觉 | 说明 |
|---|---|---|
| 未读 | 左侧蓝色圆点 + 标题加粗 | 需用户查看 |
| 已读 | 无圆点，常规字重 | 已处理 |
| 待办类 | 橙色图标 | 需用户操作后才消失 |
| 系统类 | 灰色图标 | 仅展示，无需操作 |

**强制要求**
- 未读数超过 99 显示「99+」
- 待办消息处理完成后自动归档
- 顶部导航铃铛图标实时同步未读数
- 点击条目跳转至对应详情页

---

## 4.4 异常页面

| 页面 | 提示文案 | 操作按钮 |
|---|---|---|
| 403 无权限 | 「暂无权限访问该页面」 | 返回首页 + 联系管理员 |
| 404 不存在 | 「页面不存在或已被删除」 | 返回首页 |
| 500 服务异常 | 「服务繁忙，请稍后重试」 | 刷新页面 |
| 登录页 | — | Logo + 登录表单居中 |

**强制要求**
- 所有异常页必须有返回首页入口
- 403 需提供联系管理员方式
- 登录失败明确提示原因（账号不存在/密码错误/已锁定）
- 连续失败 5 次触发验证码或临时锁定

---

# 五、rules/ 设计验收 Checklist

> 上线前逐项检查，全部通过才算验收完成。

## 视觉基础
```
布局与间距
□ 页面左右边距统一 24px
□ 卡片内边距统一 16px 或 24px，同页面一致
□ 所有间距符合 4px 基础单位，无随意数值
□ 模块间距 16px，无紧贴边缘情况

色彩
□ 主色仅用于核心操作按钮、链接、选中态
□ 功能色规范使用：成功绿、警告橙、错误红、信息蓝，未自定义替换
□ 文字使用三级色阶，未直接使用纯黑 #000000
□ 页面背景 #F5F5F5，卡片背景 #FFFFFF

字体
□ 页面标题 20px 加粗，模块标题 16px 加粗，正文 14px，辅助 12px
□ 最小字号不低于 12px
□ 同页面字号层级不超过 4 级

圆角与阴影
□ 标签 2px，按钮/输入框 4px，卡片 8px，弹窗 16px
□ 阴影仅用于表达层级，未用于纯装饰
□ 未使用彩色阴影
```

## 组件规范
```
按钮
□ 单页面主按钮不超过 1 个
□ 危险操作使用红色危险按钮
□ 危险操作有二次确认弹窗
□ 按钮禁用态 opacity 40%，视觉弱化明显
□ Loading 态禁止重复点击

输入框与表单
□ 必填项 Label 前有红色星号 *
□ 聚焦态蓝色高亮边框
□ 错误态红色边框 + 错误提示文字（非仅 Toast）
□ 占位文字说明清晰，非「请输入」等无意义占位

表格
□ 操作列固定右侧
□ 操作列超过 4 个已折叠进「更多」
□ 空数据有空态组件（插图 + 文字 + 引导操作）
□ 分页展示总条数

弹窗
□ 所有弹窗有关闭或取消按钮
□ 底部按钮：取消在左，确认在右
□ 弹窗出现时禁止背景页面滚动
```

## 交互状态
```
□ 所有按钮有 hover、点击、禁用态
□ 所有输入框有聚焦、错误、禁用态
□ 所有列表页有加载态（骨架屏或 loading）
□ 所有列表页有空态（含引导操作）
□ 所有列表页有网络错误态（含重试按钮）
□ 可点击元素 cursor: pointer
□ 不可点击元素 cursor: not-allowed
□ 所有可点击控件热区不小于 32×32px
```

## 页面结构
```
列表页
□ 有筛选/搜索区域
□ 筛选条件超过 4 个已收起
□ 有分页控件，含总条数和每页条数选择
□ 支持批量操作（如有需要）

详情页
□ 有面包屑导航
□ 有明确返回入口
□ 信息按模块分组，每组用卡片包裹
□ 核心操作按钮始终在视口内可见

表单页
□ 字段按业务逻辑分组
□ 底部操作栏固定
□ 提交前执行全量校验
□ 取消时提示「确认放弃已填写内容？」

数据看板
□ 指标卡标注统计口径
□ 图表有 loading 态和空态
□ 支持数据导出
```

## 合规与安全
```
□ 权限变更操作有二次确认
□ 删除操作说明「此操作不可恢复」
□ 审批记录只读，不提供修改删除入口
□ 密码输入框有显示/隐藏切换，不明文展示
□ 敏感操作有操作日志记录
□ 超级管理员角色不提供删除入口
```

---

# 六、prompts/ 场景化 Prompt

## 基础查询
```
你是 B 端设计规范顾问，基于本 Skill 回答问题。
回答精简，优先输出数值和规则，不要冗余解释。
```

## 原型生成
```
你是 B 端界面原型生成专家，基于本 Skill 规范生成界面。
要求：
1. 严格使用 tokens/ 中的色彩、间距、圆角变量
2. 页面结构参考 patterns/ 对应模板
3. 组件参数严格按照 components/ 规范
4. 生成后对照 rules/ checklist 自查禁止项
输入格式：[业务场景] + [页面类型] + [核心功能点]
```

## 代码自查
```
你是 B 端前端代码规范审查员，基于本 Skill 检查代码。
检查重点：
- CSS 变量是否引用 token，未硬编码数值
- 组件尺寸是否符合规范
- 交互状态是否完整覆盖（8 种）
- 是否存在 rules/ 禁止项
输出格式：逐条列出问题，标注严重程度（严重/警告/建议）
```

---

*本 Skill 基于通用 B 端规范整理，替换 brand.primary 品牌色后可直接落地使用。*
*如需结合公司特定规范，在 tokens/ 替换数值，在 templates/ 补充业务模板即可。*

---

# 七、examples/ 业务模板 HTML

> 以下三个模板严格基于本 Skill 的 token 系统构建。
> 直接复制 HTML 代码到浏览器即可预览，替换 brand.primary 品牌色全局同步。

---

## 7.1 列表页模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>列表页模板</title>
<style>
:root {
  --brand-primary:        #1677FF;
  --brand-primary-hover:  #4096FF;
  --brand-primary-active: #0958D9;
  --brand-primary-bg:     #E6F4FF;
  --func-success:    #52C41A; --func-success-bg: #F6FFED;
  --func-warning:    #FAAD14; --func-warning-bg: #FFFBE6;
  --func-error:      #FF4D4F; --func-error-bg:   #FFF2F0;
  --text-primary:   #1F1F1F; --text-secondary: #595959;
  --text-tertiary:  #8C8C8C; --text-disabled:  #BFBFBF;
  --bg-page: #F5F5F5; --bg-card: #FFFFFF;
  --bg-hover: #F0F0F0; --bg-selected: #E6F4FF;
  --border-default: #D9D9D9; --border-focus: #1677FF;
  --font: 'PingFang SC','Microsoft YaHei',sans-serif;
  --radius-md: 4px; --radius-lg: 8px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);font-size:14px;color:var(--text-primary);background:var(--bg-page);min-height:100vh}
/* 导航 */
.nav{height:56px;background:var(--bg-card);border-bottom:1px solid var(--border-default);display:flex;align-items:center;padding:0 24px;gap:12px;box-shadow:var(--shadow-sm);position:sticky;top:0;z-index:100}
.nav-logo{font-size:15px;font-weight:600;color:var(--brand-primary)}
.nav-sep{width:1px;height:18px;background:var(--border-default)}
.nav-sub{font-size:13px;color:var(--text-secondary)}
.nav-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.nav-avatar{width:30px;height:30px;border-radius:50%;background:var(--brand-primary);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center}
/* 布局 */
.layout{display:flex;min-height:calc(100vh - 56px)}
.sidebar{width:196px;background:var(--bg-card);border-right:1px solid var(--border-default);padding:8px 0;flex-shrink:0}
.menu-group{padding:14px 16px 4px;font-size:11px;color:var(--text-tertiary);font-weight:500;letter-spacing:.5px;text-transform:uppercase}
.menu-item{display:flex;align-items:center;gap:8px;padding:9px 20px;font-size:13px;color:var(--text-secondary);cursor:pointer;transition:all .15s;position:relative}
.menu-item:hover{background:var(--bg-hover);color:var(--text-primary)}
.menu-item.active{background:var(--brand-primary-bg);color:var(--brand-primary);font-weight:500}
.menu-item.active::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--brand-primary);border-radius:0 2px 2px 0}
/* 内容 */
.content{flex:1;padding:24px;overflow-y:auto}
.breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);margin-bottom:14px}
.breadcrumb a{color:var(--text-tertiary);cursor:pointer;text-decoration:none}
.breadcrumb a:hover{color:var(--brand-primary)}
/* 页头 */
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.page-title{font-size:20px;font-weight:600}
.btn-group{display:flex;gap:8px}
/* 按钮 */
.btn{height:32px;padding:0 12px;border-radius:var(--radius-md);font-size:13px;font-family:var(--font);cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;white-space:nowrap}
.btn-primary{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}
.btn-primary:hover{background:var(--brand-primary-hover);border-color:var(--brand-primary-hover)}
.btn-default{background:var(--bg-card);color:var(--text-primary);border-color:var(--border-default)}
.btn-default:hover{color:var(--brand-primary);border-color:var(--brand-primary);background:var(--brand-primary-bg)}
.btn-text{background:transparent;color:var(--brand-primary);border:none;padding:0 4px;height:28px;font-size:13px}
.btn-text:hover{background:var(--brand-primary-bg)}
.btn-danger-text{background:transparent;color:var(--func-error);border:none;padding:0 4px;height:28px;font-size:13px}
.btn-danger-text:hover{background:var(--func-error-bg)}
/* 筛选卡片 */
.filter-card{background:var(--bg-card);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
.filter-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}
.filter-item{display:flex;flex-direction:column;gap:4px}
.filter-label{font-size:12px;color:var(--text-secondary)}
.input,.select{height:32px;padding:0 10px;border:1px solid var(--border-default);border-radius:var(--radius-md);font-size:13px;font-family:var(--font);color:var(--text-primary);background:var(--bg-card);outline:none;transition:border-color .2s}
.input{width:180px}.input:focus{border-color:var(--border-focus);box-shadow:0 0 0 2px rgba(22,119,255,.1)}
.input::placeholder{color:var(--text-tertiary)}
.select{min-width:110px;padding-right:26px;appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238C8C8C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.select:focus{border-color:var(--border-focus);box-shadow:0 0 0 2px rgba(22,119,255,.1)}
.filter-actions{display:flex;gap:8px;margin-left:auto}
/* 表格卡片 */
.table-card{background:var(--bg-card);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);overflow:hidden}
.table-toolbar{padding:10px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #F0F0F0;min-height:48px}
.table-count{font-size:12px;color:var(--text-tertiary)}
.bulk-bar{display:none;align-items:center;gap:8px;animation:fadeIn .15s ease}
.bulk-bar.show{display:flex}
@keyframes fadeIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
.bulk-label{font-size:13px;color:var(--text-secondary)}
table{width:100%;border-collapse:collapse}
thead th{height:44px;padding:0 14px;text-align:left;font-size:13px;font-weight:500;color:var(--text-primary);background:#FAFAFA;border-bottom:1px solid #F0F0F0;white-space:nowrap}
thead th:first-child{width:44px}
thead th:last-child{position:sticky;right:0;background:#FAFAFA;box-shadow:-2px 0 4px rgba(0,0,0,.04)}
tbody td{height:54px;padding:0 14px;font-size:13px;color:var(--text-secondary);border-bottom:1px solid #F0F0F0;vertical-align:middle}
tbody td:last-child{position:sticky;right:0;background:var(--bg-card);box-shadow:-2px 0 4px rgba(0,0,0,.04)}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--bg-hover)}
tbody tr:hover td:last-child{background:var(--bg-hover)}
tbody tr.selected td{background:var(--bg-selected)}
tbody tr.selected td:last-child{background:var(--bg-selected)}
.checkbox{width:15px;height:15px;accent-color:var(--brand-primary);cursor:pointer}
/* 状态标签 */
.tag{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:2px;font-size:12px;font-weight:500}
.tag-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.tag-success{background:var(--func-success-bg);color:var(--func-success)}.tag-success .tag-dot{background:var(--func-success)}
.tag-warning{background:var(--func-warning-bg);color:var(--func-warning)}.tag-warning .tag-dot{background:var(--func-warning)}
.tag-error{background:var(--func-error-bg);color:var(--func-error)}.tag-error .tag-dot{background:var(--func-error)}
.tag-default{background:#F5F5F5;color:var(--text-tertiary)}.tag-default .tag-dot{background:var(--text-tertiary)}
/* 操作列 */
.action-btns{display:flex;align-items:center}
.action-sep{width:1px;height:12px;background:var(--border-default);margin:0 2px}
/* 头像 */
.user-cell{display:flex;align-items:center;gap:8px}
.avatar{width:26px;height:26px;border-radius:50%;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
/* 分页 */
.pagination{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid #F0F0F0}
.pagination-info{font-size:12px;color:var(--text-tertiary)}
.page-controls{display:flex;align-items:center;gap:4px}
.page-btn{min-width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-default);border-radius:var(--radius-md);font-size:13px;color:var(--text-secondary);background:var(--bg-card);cursor:pointer;transition:all .15s;padding:0 6px}
.page-btn:hover{color:var(--brand-primary);border-color:var(--brand-primary)}
.page-btn.active{color:var(--brand-primary);background:var(--brand-primary-bg);border-color:var(--brand-primary);font-weight:600}
.page-btn.disabled{color:var(--text-disabled);cursor:not-allowed}
.page-size{height:30px;padding:0 22px 0 8px;border:1px solid var(--border-default);border-radius:var(--radius-md);font-size:12px;font-family:var(--font);color:var(--text-secondary);background:var(--bg-card);outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238C8C8C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 5px center}
</style>
</head>
<body>
<div class="nav">
  <div class="nav-logo">管理后台</div>
  <div class="nav-sep"></div>
  <div class="nav-sub">B端 Skill — 列表页模板</div>
  <div class="nav-right">
    <div class="nav-avatar">张</div>
  </div>
</div>
<div class="layout">
  <div class="sidebar">
    <div class="menu-group">核心功能</div>
    <div class="menu-item active">订单管理</div>
    <div class="menu-item">用户管理</div>
    <div class="menu-item">商品管理</div>
    <div class="menu-group">运营</div>
    <div class="menu-item">数据看板</div>
    <div class="menu-item">审批管理</div>
    <div class="menu-group">系统</div>
    <div class="menu-item">权限管理</div>
    <div class="menu-item">系统设置</div>
  </div>
  <div class="content">
    <div class="breadcrumb"><a>首页</a> / <span>订单管理</span></div>
    <div class="page-header">
      <div class="page-title">订单管理</div>
      <div class="btn-group">
        <button class="btn btn-default">导出</button>
        <button class="btn btn-primary">+ 新建订单</button>
      </div>
    </div>
    <div class="filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <div class="filter-label">关键词</div>
          <input class="input" placeholder="订单号 / 客户名称">
        </div>
        <div class="filter-item">
          <div class="filter-label">状态</div>
          <select class="select"><option>全部状态</option><option>已完成</option><option>处理中</option><option>待处理</option><option>已取消</option></select>
        </div>
        <div class="filter-item">
          <div class="filter-label">创建时间</div>
          <select class="select"><option>最近 30 天</option><option>最近 7 天</option><option>最近 90 天</option></select>
        </div>
        <div class="filter-item">
          <div class="filter-label">负责人</div>
          <select class="select"><option>全部</option><option>张三</option><option>李四</option><option>王五</option></select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-default">重置</button>
          <button class="btn btn-primary">查询</button>
        </div>
      </div>
    </div>
    <div class="table-card">
      <div class="table-toolbar">
        <span class="table-count">共 128 条记录</span>
        <div class="bulk-bar" id="bulkBar">
          <span class="bulk-label">已选 <strong id="selCount">0</strong> 项</span>
          <button class="btn btn-default" style="height:26px;font-size:12px;padding:0 8px">批量导出</button>
          <button style="height:26px;padding:0 8px;font-size:12px;background:var(--func-error-bg);color:var(--func-error);border:1px solid var(--func-error);border-radius:var(--radius-md);cursor:pointer;font-family:var(--font)">批量删除</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" class="checkbox" id="chkAll" onchange="toggleAll(this)"></th>
            <th>订单编号</th><th>客户名称</th><th>金额</th><th>状态</th><th>负责人</th><th>创建时间</th><th>操作</th>
          </tr>
        </thead>
        <tbody id="tbody">
          <tr>
            <td><input type="checkbox" class="checkbox row-chk" onchange="updateSel()"></td>
            <td style="color:var(--brand-primary);font-weight:500;cursor:pointer">#ORD-20240101</td>
            <td><div class="user-cell"><div class="avatar" style="background:#1677FF">皓</div>皓月设计公司</div></td>
            <td style="font-weight:500">¥128,000</td>
            <td><span class="tag tag-success"><span class="tag-dot"></span>已完成</span></td>
            <td><div class="user-cell"><div class="avatar" style="background:#52C41A">李</div>李四</div></td>
            <td>2024-01-01 09:30</td>
            <td><div class="action-btns"><button class="btn-text btn">查看</button><div class="action-sep"></div><button class="btn-text btn">编辑</button><div class="action-sep"></div><button class="btn-danger-text btn">删除</button></div></td>
          </tr>
          <tr>
            <td><input type="checkbox" class="checkbox row-chk" onchange="updateSel()"></td>
            <td style="color:var(--brand-primary);font-weight:500;cursor:pointer">#ORD-20240102</td>
            <td><div class="user-cell"><div class="avatar" style="background:#FAAD14">星</div>星辰科技</div></td>
            <td style="font-weight:500">¥56,800</td>
            <td><span class="tag tag-warning"><span class="tag-dot"></span>处理中</span></td>
            <td><div class="user-cell"><div class="avatar" style="background:#1677FF">张</div>张三</div></td>
            <td>2024-01-02 14:20</td>
            <td><div class="action-btns"><button class="btn-text btn">查看</button><div class="action-sep"></div><button class="btn-text btn">编辑</button><div class="action-sep"></div><button class="btn-danger-text btn">删除</button></div></td>
          </tr>
          <tr>
            <td><input type="checkbox" class="checkbox row-chk" onchange="updateSel()"></td>
            <td style="color:var(--brand-primary);font-weight:500;cursor:pointer">#ORD-20240103</td>
            <td><div class="user-cell"><div class="avatar" style="background:#FF4D4F">云</div>云帆网络</div></td>
            <td style="font-weight:500">¥89,500</td>
            <td><span class="tag tag-default"><span class="tag-dot"></span>待处理</span></td>
            <td><div class="user-cell"><div class="avatar" style="background:#722ED1">王</div>王五</div></td>
            <td>2024-01-03 11:00</td>
            <td><div class="action-btns"><button class="btn-text btn">查看</button><div class="action-sep"></div><button class="btn-text btn">编辑</button><div class="action-sep"></div><button class="btn-danger-text btn">删除</button></div></td>
          </tr>
          <tr>
            <td><input type="checkbox" class="checkbox row-chk" onchange="updateSel()"></td>
            <td style="color:var(--brand-primary);font-weight:500;cursor:pointer">#ORD-20240104</td>
            <td><div class="user-cell"><div class="avatar" style="background:#13C2C2">远</div>远航信息</div></td>
            <td style="font-weight:500">¥23,000</td>
            <td><span class="tag tag-error"><span class="tag-dot"></span>已取消</span></td>
            <td><div class="user-cell"><div class="avatar" style="background:#52C41A">李</div>李四</div></td>
            <td>2024-01-04 16:45</td>
            <td><div class="action-btns"><button class="btn-text btn">查看</button><div class="action-sep"></div><button class="btn-text btn">编辑</button><div class="action-sep"></div><button class="btn-danger-text btn">删除</button></div></td>
          </tr>
          <tr>
            <td><input type="checkbox" class="checkbox row-chk" onchange="updateSel()"></td>
            <td style="color:var(--brand-primary);font-weight:500;cursor:pointer">#ORD-20240105</td>
            <td><div class="user-cell"><div class="avatar" style="background:#FA8C16">明</div>明途传媒</div></td>
            <td style="font-weight:500">¥312,000</td>
            <td><span class="tag tag-success"><span class="tag-dot"></span>已完成</span></td>
            <td><div class="user-cell"><div class="avatar" style="background:#722ED1">赵</div>赵六</div></td>
            <td>2024-01-05 09:15</td>
            <td><div class="action-btns"><button class="btn-text btn">查看</button><div class="action-sep"></div><button class="btn-text btn">编辑</button><div class="action-sep"></div><button class="btn-danger-text btn">删除</button></div></td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="pagination-info">共 128 条，每页</span>
          <select class="page-size"><option>10 条</option><option>20 条</option><option>50 条</option></select>
        </div>
        <div class="page-controls">
          <div class="page-btn disabled">&#8249;</div>
          <div class="page-btn active">1</div>
          <div class="page-btn">2</div>
          <div class="page-btn">3</div>
          <div class="page-btn" style="border:none;color:var(--text-tertiary)">...</div>
          <div class="page-btn">13</div>
          <div class="page-btn">&#8250;</div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
function updateSel(){
  const all=document.querySelectorAll('.row-chk'),sel=document.querySelectorAll('.row-chk:checked');
  document.getElementById('selCount').textContent=sel.length;
  document.getElementById('bulkBar').classList.toggle('show',sel.length>0);
  all.forEach(c=>c.closest('tr').classList.toggle('selected',c.checked));
  const ca=document.getElementById('chkAll');
  ca.indeterminate=sel.length>0&&sel.length<all.length;
  ca.checked=sel.length===all.length;
}
function toggleAll(el){
  document.querySelectorAll('.row-chk').forEach(c=>{c.checked=el.checked;c.closest('tr').classList.toggle('selected',el.checked)});
  document.getElementById('selCount').textContent=el.checked?document.querySelectorAll('.row-chk').length:0;
  document.getElementById('bulkBar').classList.toggle('show',el.checked);
}
document.querySelectorAll('.menu-item').forEach(m=>m.addEventListener('click',()=>{
  document.querySelectorAll('.menu-item').forEach(i=>i.classList.remove('active'));
  m.classList.add('active');
}));
</script>
</body>
</html>
```

---

## 7.2 表单页模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>表单页模板</title>
<style>
:root{
  --brand-primary:#1677FF;--brand-primary-hover:#4096FF;--brand-primary-active:#0958D9;--brand-primary-bg:#E6F4FF;
  --func-success:#52C41A;--func-error:#FF4D4F;--func-error-bg:#FFF2F0;--func-warning:#FAAD14;
  --text-primary:#1F1F1F;--text-secondary:#595959;--text-tertiary:#8C8C8C;--text-disabled:#BFBFBF;
  --bg-page:#F5F5F5;--bg-card:#FFFFFF;--bg-hover:#F0F0F0;--bg-disabled:#F5F5F5;
  --border-default:#D9D9D9;--border-focus:#1677FF;--border-error:#FF4D4F;
  --font:'PingFang SC','Microsoft YaHei',sans-serif;
  --radius-md:4px;--radius-lg:8px;--radius-xl:16px;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.06);--shadow-footer:0 -2px 8px rgba(0,0,0,0.06);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);font-size:14px;color:var(--text-primary);background:var(--bg-page);min-height:100vh;display:flex;flex-direction:column}
.nav{height:56px;background:var(--bg-card);border-bottom:1px solid var(--border-default);display:flex;align-items:center;padding:0 24px;gap:12px;box-shadow:var(--shadow-sm);position:sticky;top:0;z-index:100;flex-shrink:0}
.nav-logo{font-size:15px;font-weight:600;color:var(--brand-primary)}
.nav-sep{width:1px;height:18px;background:var(--border-default)}
.nav-sub{font-size:13px;color:var(--text-secondary)}
.nav-avatar{margin-left:auto;width:30px;height:30px;border-radius:50%;background:var(--brand-primary);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center}
.main{flex:1;padding:24px;padding-bottom:80px;max-width:860px;margin:0 auto;width:100%}
.breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);margin-bottom:14px}
.breadcrumb a{color:var(--text-tertiary);cursor:pointer;text-decoration:none}
.breadcrumb a:hover{color:var(--brand-primary)}
/* 步骤条 */
.steps{display:flex;align-items:center;background:var(--bg-card);border-radius:var(--radius-lg);padding:18px 28px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
.step{display:flex;align-items:center;gap:10px;flex:1}
.step-circle{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;transition:all .2s}
.step.done .step-circle{background:var(--brand-primary);color:#fff}
.step.active .step-circle{background:var(--brand-primary);color:#fff;box-shadow:0 0 0 3px var(--brand-primary-bg)}
.step.pending .step-circle{background:var(--bg-page);color:var(--text-tertiary);border:1px solid var(--border-default)}
.step-label{font-size:13px;font-weight:500;color:var(--text-primary)}
.step.pending .step-label{color:var(--text-tertiary)}
.step-desc{font-size:11px;color:var(--text-tertiary);margin-top:1px}
.step-line{flex:1;height:1px;background:var(--border-default);margin:0 8px;max-width:72px}
.step-line.done{background:var(--brand-primary)}
/* 卡片 */
.card{background:var(--bg-card);border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
.card-title{font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #F5F5F5;display:flex;align-items:center;gap:8px}
.card-bar{width:3px;height:14px;background:var(--brand-primary);border-radius:2px;flex-shrink:0}
/* 表单 */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 24px}
.form-full{grid-column:1/-1}
.form-item{display:flex;flex-direction:column;gap:5px}
.form-label{font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:2px}
.required{color:var(--func-error)}
.input,.select,.textarea{font-family:var(--font);font-size:13px;color:var(--text-primary);background:var(--bg-card);border:1px solid var(--border-default);border-radius:var(--radius-md);outline:none;transition:all .2s;width:100%}
.input,.select{height:34px;padding:0 10px}
.textarea{padding:8px 10px;resize:vertical;min-height:80px;line-height:1.6}
.input:focus,.select:focus,.textarea:focus{border-color:var(--border-focus);box-shadow:0 0 0 2px rgba(22,119,255,.1)}
.input.err,.select.err,.textarea.err{border-color:var(--border-error);box-shadow:0 0 0 2px rgba(255,77,79,.1)}
.input::placeholder,.textarea::placeholder{color:var(--text-tertiary)}
.input:disabled,.select:disabled{background:var(--bg-disabled);color:var(--text-disabled);cursor:not-allowed}
.select{appearance:none;padding-right:26px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238C8C8C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.form-err{font-size:11px;color:var(--func-error);margin-top:2px}
.form-hint{font-size:11px;color:var(--text-tertiary)}
.radio-group{display:flex;gap:20px;padding-top:4px}
.radio-item{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-secondary)}
.radio-item input{accent-color:var(--brand-primary);width:14px;height:14px;cursor:pointer}
.check-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.check-item{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-secondary);padding:3px 0}
.check-item input{accent-color:var(--brand-primary);width:14px;height:14px;cursor:pointer}
.upload-area{border:1px dashed var(--border-default);border-radius:var(--radius-md);padding:18px;text-align:center;cursor:pointer;transition:all .2s;color:var(--text-tertiary);font-size:13px}
.upload-area:hover{border-color:var(--brand-primary);background:var(--brand-primary-bg);color:var(--brand-primary)}
.upload-hint{font-size:11px;margin-top:4px;color:var(--text-tertiary)}
.textarea-wrap{position:relative}
.char-count{position:absolute;right:8px;bottom:6px;font-size:11px;color:var(--text-tertiary);pointer-events:none}
/* 底部操作栏 */
.footer{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:10px 24px;background:var(--bg-card);border-top:1px solid #F0F0F0;box-shadow:var(--shadow-footer);z-index:99}
.footer-tip{margin-right:auto;font-size:12px;color:var(--text-tertiary)}
.btn{height:34px;padding:0 18px;border-radius:var(--radius-md);font-size:13px;font-family:var(--font);cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;border:1px solid transparent}
.btn-primary{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}
.btn-primary:hover{background:var(--brand-primary-hover);border-color:var(--brand-primary-hover)}
.btn-default{background:var(--bg-card);color:var(--text-primary);border-color:var(--border-default)}
.btn-default:hover{color:var(--brand-primary);border-color:var(--brand-primary);background:var(--brand-primary-bg)}
/* 成功弹窗 */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;align-items:center;justify-content:center}
.overlay.show{display:flex}
.modal{background:var(--bg-card);border-radius:var(--radius-xl);padding:36px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.15);animation:popIn .3s cubic-bezier(.34,1.56,.64,1);max-width:320px;width:90%}
@keyframes popIn{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
.modal-icon{font-size:48px;margin-bottom:10px}
.modal-title{font-size:17px;font-weight:600;margin-bottom:6px}
.modal-desc{font-size:13px;color:var(--text-secondary);margin-bottom:20px}
.modal-btn{width:100%;height:38px;background:var(--brand-primary);color:#fff;border:none;border-radius:var(--radius-md);font-size:14px;font-family:var(--font);cursor:pointer}
.modal-btn:hover{background:var(--brand-primary-hover)}
@keyframes spin{to{transform:rotate(360deg)}}
.spin{width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
</style>
</head>
<body>
<div class="nav">
  <div class="nav-logo">管理后台</div>
  <div class="nav-sep"></div>
  <div class="nav-sub">B端 Skill — 表单页模板</div>
  <div class="nav-avatar">张</div>
</div>
<div class="main">
  <div class="breadcrumb"><a>首页</a> / <a>订单管理</a> / <span style="color:var(--text-secondary)">新建订单</span></div>
  <div class="steps">
    <div class="step done">
      <div class="step-circle">&#10003;</div>
      <div><div class="step-label">基本信息</div><div class="step-desc">已完成</div></div>
    </div>
    <div class="step-line done"></div>
    <div class="step active">
      <div class="step-circle">2</div>
      <div><div class="step-label">订单详情</div><div class="step-desc">当前步骤</div></div>
    </div>
    <div class="step-line"></div>
    <div class="step pending">
      <div class="step-circle">3</div>
      <div><div class="step-label">确认提交</div><div class="step-desc">待完成</div></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div>客户信息</div>
    <div class="form-grid">
      <div class="form-item">
        <label class="form-label"><span class="required">*</span> 客户名称</label>
        <input class="input" id="company" value="皓月设计公司" placeholder="请输入客户名称">
      </div>
      <div class="form-item">
        <label class="form-label"><span class="required">*</span> 联系人</label>
        <input class="input" id="contact" value="李总" placeholder="请输入联系人姓名">
      </div>
      <div class="form-item">
        <label class="form-label"><span class="required">*</span> 联系电话</label>
        <input class="input" id="phone" placeholder="请输入手机号">
        <div class="form-err" id="phoneErr" style="display:none">手机号格式不正确</div>
      </div>
      <div class="form-item">
        <label class="form-label">联系邮箱</label>
        <input class="input" type="email" placeholder="请输入邮箱（选填）">
        <div class="form-hint">用于接收订单通知</div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div>订单信息</div>
    <div class="form-grid">
      <div class="form-item">
        <label class="form-label"><span class="required">*</span> 订单类型</label>
        <select class="select" id="orderType">
          <option value="">请选择</option>
          <option value="1" selected>标准采购</option>
          <option value="2">定制开发</option>
          <option value="3">年度合同</option>
        </select>
      </div>
      <div class="form-item">
        <label class="form-label"><span class="required">*</span> 负责人</label>
        <select class="select">
          <option>请选择</option><option selected>李四</option><option>张三</option><option>王五</option>
        </select>
      </div>
      <div class="form-item">
        <label class="form-label"><span class="required">*</span> 合同金额（元）</label>
        <input class="input" id="amount" type="number" placeholder="0.00" value="128000">
      </div>
      <div class="form-item">
        <label class="form-label">预计交付日期</label>
        <input class="input" type="date" value="2024-03-31">
      </div>
      <div class="form-item form-full">
        <label class="form-label"><span class="required">*</span> 优先级</label>
        <div class="radio-group">
          <label class="radio-item"><input type="radio" name="pri" value="low"> 低</label>
          <label class="radio-item"><input type="radio" name="pri" value="mid" checked> 中</label>
          <label class="radio-item"><input type="radio" name="pri" value="high"> 高</label>
          <label class="radio-item"><input type="radio" name="pri" value="urgent"> 紧急</label>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div>详细信息</div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="form-item">
        <label class="form-label"><span class="required">*</span> 订单说明</label>
        <div class="textarea-wrap">
          <textarea class="textarea" id="desc" oninput="cnt(this,'cnt1',500)" placeholder="请描述订单需求、背景及特殊要求" style="min-height:88px">本次订单为皓月设计公司采购 B 端管理系统，包含用户权限、数据报表及移动端适配模块。</textarea>
          <span class="char-count" id="cnt1">43/500</span>
        </div>
      </div>
      <div class="form-item">
        <label class="form-label">服务项目</label>
        <div class="check-grid">
          <label class="check-item"><input type="checkbox" checked> 系统开发</label>
          <label class="check-item"><input type="checkbox" checked> 数据迁移</label>
          <label class="check-item"><input type="checkbox"> 培训服务</label>
          <label class="check-item"><input type="checkbox"> 运维支持</label>
          <label class="check-item"><input type="checkbox" checked> 文档交付</label>
          <label class="check-item"><input type="checkbox"> 二次开发</label>
        </div>
      </div>
      <div class="form-item">
        <label class="form-label">附件上传</label>
        <div class="upload-area">
          <div style="font-size:20px;margin-bottom:4px">+</div>
          <div>点击或拖拽文件到此处上传</div>
          <div class="upload-hint">支持 PDF、Word、Excel，单个不超过 10MB</div>
        </div>
      </div>
      <div class="form-item">
        <label class="form-label">备注</label>
        <div class="textarea-wrap">
          <textarea class="textarea" oninput="cnt(this,'cnt2',200)" placeholder="其他补充说明（选填）" style="min-height:64px"></textarea>
          <span class="char-count" id="cnt2">0/200</span>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="footer">
  <span class="footer-tip">带 * 为必填项</span>
  <button class="btn btn-default" onclick="handleCancel()">取消</button>
  <button class="btn btn-default" onclick="handleDraft(this)">保存草稿</button>
  <button class="btn btn-primary" id="submitBtn" onclick="handleSubmit()">提交订单</button>
</div>
<div class="overlay" id="overlay">
  <div class="modal">
    <div class="modal-icon" style="color:var(--func-success)">&#10003;</div>
    <div class="modal-title">提交成功</div>
    <div class="modal-desc">订单 #ORD-20240106 已创建，负责人将在 1 个工作日内跟进。</div>
    <button class="modal-btn" onclick="document.getElementById('overlay').classList.remove('show')">返回列表</button>
  </div>
</div>
<script>
function cnt(el,id,max){const l=el.value.length,e=document.getElementById(id);e.textContent=l+'/'+max;e.style.color=l>max*.9?'var(--func-warning)':'var(--text-tertiary)'}
document.getElementById('cnt1').textContent=document.getElementById('desc').value.length+'/500';
function validate(){
  let ok=true;
  const p=document.getElementById('phone'),pe=document.getElementById('phoneErr');
  if(!p.value.trim()){p.classList.add('err');pe.style.display='block';pe.textContent='联系电话不能为空';ok=false}
  else{p.classList.remove('err');pe.style.display='none'}
  return ok;
}
function handleSubmit(){
  if(!validate()){document.getElementById('phone').scrollIntoView({behavior:'smooth',block:'center'});return}
  const b=document.getElementById('submitBtn');
  b.innerHTML='<div class="spin"></div> 提交中...';b.disabled=true;
  setTimeout(()=>{b.innerHTML='提交订单';b.disabled=false;document.getElementById('overlay').classList.add('show')},1800)
}
function handleDraft(b){const t=b.innerHTML;b.innerHTML='已保存';b.style.color='var(--func-success)';b.style.borderColor='var(--func-success)';setTimeout(()=>{b.innerHTML=t;b.style.color='';b.style.borderColor=''},2000)}
function handleCancel(){if(confirm('确认放弃已填写的内容？'))alert('返回列表页')}
</script>
</body>
</html>
```

---

## 7.3 详情页模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>详情页模板</title>
<style>
:root{
  --brand-primary:#1677FF;--brand-primary-hover:#4096FF;--brand-primary-bg:#E6F4FF;
  --func-success:#52C41A;--func-success-bg:#F6FFED;--func-warning:#FAAD14;--func-warning-bg:#FFFBE6;
  --func-error:#FF4D4F;--func-error-bg:#FFF2F0;--func-info:#1677FF;--func-info-bg:#E6F4FF;
  --text-primary:#1F1F1F;--text-secondary:#595959;--text-tertiary:#8C8C8C;
  --bg-page:#F5F5F5;--bg-card:#FFFFFF;--bg-hover:#F0F0F0;
  --border-default:#D9D9D9;
  --font:'PingFang SC','Microsoft YaHei',sans-serif;
  --radius-md:4px;--radius-lg:8px;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.06);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);font-size:14px;color:var(--text-primary);background:var(--bg-page);min-height:100vh}
.nav{height:56px;background:var(--bg-card);border-bottom:1px solid var(--border-default);display:flex;align-items:center;padding:0 24px;gap:12px;box-shadow:var(--shadow-sm);position:sticky;top:0;z-index:100}
.nav-logo{font-size:15px;font-weight:600;color:var(--brand-primary)}
.nav-sep{width:1px;height:18px;background:var(--border-default)}
.nav-sub{font-size:13px;color:var(--text-secondary)}
.nav-avatar{margin-left:auto;width:30px;height:30px;border-radius:50%;background:var(--brand-primary);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center}
.content{max-width:960px;margin:0 auto;padding:24px}
.breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);margin-bottom:14px}
.breadcrumb a{color:var(--text-tertiary);cursor:pointer;text-decoration:none}
.breadcrumb a:hover{color:var(--brand-primary)}
/* 页头 */
.page-header{background:var(--bg-card);border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:16px;box-shadow:var(--shadow-sm);display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.header-left{display:flex;flex-direction:column;gap:10px}
.header-title-row{display:flex;align-items:center;gap:10px}
.page-title{font-size:20px;font-weight:600}
.order-no{font-size:14px;color:var(--text-tertiary);font-weight:400}
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:2px;font-size:12px;font-weight:500}
.tag-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.tag-success{background:var(--func-success-bg);color:var(--func-success)}.tag-success .tag-dot{background:var(--func-success)}
.tag-warning{background:var(--func-warning-bg);color:var(--func-warning)}.tag-warning .tag-dot{background:var(--func-warning)}
.tag-error{background:var(--func-error-bg);color:var(--func-error)}.tag-error .tag-dot{background:var(--func-error)}
.tag-info{background:var(--func-info-bg);color:var(--func-info)}.tag-info .tag-dot{background:var(--func-info)}
.tag-default{background:#F5F5F5;color:var(--text-tertiary)}.tag-default .tag-dot{background:var(--text-tertiary)}
.header-meta{display:flex;align-items:center;gap:16px;font-size:12px;color:var(--text-tertiary)}
.meta-item{display:flex;align-items:center;gap:4px}
.header-actions{display:flex;gap:8px;flex-shrink:0;align-items:flex-start}
.btn{height:32px;padding:0 14px;border-radius:var(--radius-md);font-size:13px;font-family:var(--font);cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;white-space:nowrap}
.btn-primary{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}
.btn-primary:hover{background:var(--brand-primary-hover);border-color:var(--brand-primary-hover)}
.btn-default{background:var(--bg-card);color:var(--text-primary);border-color:var(--border-default)}
.btn-default:hover{color:var(--brand-primary);border-color:var(--brand-primary);background:var(--brand-primary-bg)}
.btn-danger{background:var(--func-error-bg);color:var(--func-error);border-color:var(--func-error)}
.btn-danger:hover{background:var(--func-error);color:#fff}
/* 卡片 */
.card{background:var(--bg-card);border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
.card-title{font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card-bar{width:3px;height:14px;background:var(--brand-primary);border-radius:2px;flex-shrink:0}
/* 信息网格 */
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 24px}
.info-item{display:flex;flex-direction:column;gap:4px}
.info-label{font-size:12px;color:var(--text-tertiary)}
.info-value{font-size:14px;color:var(--text-primary);font-weight:500}
.info-value.link{color:var(--brand-primary);cursor:pointer}
.info-value.link:hover{text-decoration:underline}
.info-full{grid-column:1/-1}
/* 金额高亮 */
.amount{font-size:22px;font-weight:700;color:var(--text-primary)}
.amount-unit{font-size:14px;font-weight:400;color:var(--text-secondary)}
/* 头像 */
.user-cell{display:flex;align-items:center;gap:8px}
.avatar{width:24px;height:24px;border-radius:50%;color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
/* Tab */
.tab-nav{display:flex;border-bottom:1px solid var(--border-default);margin-bottom:16px}
.tab-item{padding:10px 16px;font-size:13px;color:var(--text-secondary);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap}
.tab-item:hover{color:var(--brand-primary)}
.tab-item.active{color:var(--brand-primary);border-bottom-color:var(--brand-primary);font-weight:500}
.tab-panel{display:none}
.tab-panel.active{display:block}
/* 时间轴 */
.timeline{display:flex;flex-direction:column;gap:0}
.tl-item{display:flex;gap:14px;padding-bottom:20px;position:relative}
.tl-item:last-child{padding-bottom:0}
.tl-left{display:flex;flex-direction:column;align-items:center;flex-shrink:0}
.tl-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;z-index:1;flex-shrink:0}
.tl-dot.success{background:var(--func-success-bg);color:var(--func-success);border:2px solid var(--func-success)}
.tl-dot.active{background:var(--brand-primary);color:#fff;box-shadow:0 0 0 3px var(--brand-primary-bg)}
.tl-dot.pending{background:var(--bg-page);color:var(--text-tertiary);border:2px solid var(--border-default)}
.tl-line{width:2px;background:var(--border-default);flex:1;margin:4px 0}
.tl-line.done{background:var(--func-success)}
.tl-item:last-child .tl-line{display:none}
.tl-right{flex:1;padding-top:4px}
.tl-title{font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:3px}
.tl-title.pending{color:var(--text-tertiary);font-weight:400}
.tl-meta{font-size:12px;color:var(--text-tertiary);margin-bottom:6px}
.tl-comment{font-size:12px;color:var(--text-secondary);background:#F8F9FA;border-radius:var(--radius-md);padding:8px 10px;border-left:3px solid var(--border-default)}
/* 文件列表 */
.file-list{display:flex;flex-direction:column;gap:8px}
.file-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border-default);border-radius:var(--radius-md);transition:all .15s}
.file-item:hover{border-color:var(--brand-primary);background:var(--brand-primary-bg)}
.file-icon{width:32px;height:32px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.file-icon.pdf{background:#FFF2F0;color:var(--func-error)}
.file-icon.word{background:#E6F4FF;color:var(--brand-primary)}
.file-icon.excel{background:#F6FFED;color:var(--func-success)}
.file-name{font-size:13px;color:var(--text-primary);font-weight:500;flex:1}
.file-size{font-size:12px;color:var(--text-tertiary)}
.file-btn{height:26px;padding:0 10px;border-radius:var(--radius-md);font-size:12px;font-family:var(--font);cursor:pointer;border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-secondary);transition:all .15s}
.file-btn:hover{border-color:var(--brand-primary);color:var(--brand-primary);background:var(--brand-primary-bg)}
/* 确认弹窗 */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;align-items:center;justify-content:center}
.overlay.show{display:flex}
.modal{background:var(--bg-card);border-radius:12px;padding:28px 24px;box-shadow:0 8px 24px rgba(0,0,0,.15);animation:popIn .25s ease;width:360px}
@keyframes popIn{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
.modal-title{font-size:16px;font-weight:600;margin-bottom:8px}
.modal-desc{font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.6}
.modal-btns{display:flex;justify-content:flex-end;gap:8px}
</style>
</head>
<body>
<div class="nav">
  <div class="nav-logo">管理后台</div>
  <div class="nav-sep"></div>
  <div class="nav-sub">B端 Skill — 详情页模板</div>
  <div class="nav-avatar">张</div>
</div>
<div class="content">
  <div class="breadcrumb"><a>首页</a> / <a>订单管理</a> / <span style="color:var(--text-secondary)">订单详情</span></div>

  <!-- 页头 -->
  <div class="page-header">
    <div class="header-left">
      <div class="header-title-row">
        <div class="page-title">订单详情</div>
        <div class="order-no">#ORD-20240101</div>
        <span class="tag tag-warning"><span class="tag-dot"></span>审批中</span>
      </div>
      <div class="header-meta">
        <div class="meta-item">创建人：张三</div>
        <div class="meta-item">创建时间：2024-01-01 09:30</div>
        <div class="meta-item">最后更新：2024-01-02 14:20</div>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn btn-default" onclick="document.getElementById('cancelOverlay').classList.add('show')">撤销申请</button>
      <button class="btn btn-default">编辑</button>
      <button class="btn btn-primary">催办</button>
    </div>
  </div>

  <!-- 基本信息 -->
  <div class="card">
    <div class="card-title"><div class="card-bar"></div>基本信息</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">客户名称</div>
        <div class="info-value link">皓月设计公司</div>
      </div>
      <div class="info-item">
        <div class="info-label">联系人</div>
        <div class="info-value">李总</div>
      </div>
      <div class="info-item">
        <div class="info-label">联系电话</div>
        <div class="info-value">138****8888</div>
      </div>
      <div class="info-item">
        <div class="info-label">订单类型</div>
        <div class="info-value">标准采购</div>
      </div>
      <div class="info-item">
        <div class="info-label">负责人</div>
        <div class="info-value"><div class="user-cell"><div class="avatar" style="background:#52C41A">李</div>李四</div></div>
      </div>
      <div class="info-item">
        <div class="info-label">优先级</div>
        <div class="info-value"><span class="tag tag-warning"><span class="tag-dot"></span>中</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">合同金额</div>
        <div class="info-value"><span class="amount">128,000</span><span class="amount-unit"> 元</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">预计交付</div>
        <div class="info-value">2024-03-31</div>
      </div>
      <div class="info-item">
        <div class="info-label">服务项目</div>
        <div class="info-value">系统开发、数据迁移、文档交付</div>
      </div>
      <div class="info-item info-full">
        <div class="info-label">订单说明</div>
        <div class="info-value" style="font-weight:400;color:var(--text-secondary);line-height:1.6">本次订单为皓月设计公司采购 B 端管理系统，包含用户权限、数据报表及移动端适配模块，要求 2024 年 Q1 完成交付验收。</div>
      </div>
    </div>
  </div>

  <!-- 关联信息 Tab -->
  <div class="card">
    <div class="card-title"><div class="card-bar"></div>关联信息</div>
    <div class="tab-nav">
      <div class="tab-item active" onclick="switchTab(this,'tab-flow')">审批流程</div>
      <div class="tab-item" onclick="switchTab(this,'tab-files')">相关附件</div>
      <div class="tab-item" onclick="switchTab(this,'tab-log')">操作日志</div>
    </div>

    <!-- Tab1：审批流程 -->
    <div class="tab-panel active" id="tab-flow">
      <div class="timeline">
        <div class="tl-item">
          <div class="tl-left">
            <div class="tl-dot success">&#10003;</div>
            <div class="tl-line done"></div>
          </div>
          <div class="tl-right">
            <div class="tl-title">发起申请</div>
            <div class="tl-meta"><div class="user-cell" style="display:inline-flex"><div class="avatar" style="background:#1677FF;width:18px;height:18px;font-size:9px">张</div>&nbsp;张三</div> &nbsp; 2024-01-01 09:30</div>
          </div>
        </div>
        <div class="tl-item">
          <div class="tl-left">
            <div class="tl-dot success">&#10003;</div>
            <div class="tl-line done"></div>
          </div>
          <div class="tl-right">
            <div class="tl-title">部门审批</div>
            <div class="tl-meta"><div class="user-cell" style="display:inline-flex"><div class="avatar" style="background:#52C41A;width:18px;height:18px;font-size:9px">李</div>&nbsp;李四（已通过）</div> &nbsp; 2024-01-01 14:20</div>
            <div class="tl-comment">同意，资料完整，请继续流转。</div>
          </div>
        </div>
        <div class="tl-item">
          <div class="tl-left">
            <div class="tl-dot active">3</div>
            <div class="tl-line"></div>
          </div>
          <div class="tl-right">
            <div class="tl-title">主管审批 <span style="font-size:11px;background:var(--func-warning-bg);color:var(--func-warning);padding:1px 6px;border-radius:2px;font-weight:400;margin-left:4px">当前节点</span></div>
            <div class="tl-meta"><div class="user-cell" style="display:inline-flex"><div class="avatar" style="background:#722ED1;width:18px;height:18px;font-size:9px">王</div>&nbsp;王五（待审批）</div></div>
          </div>
        </div>
        <div class="tl-item">
          <div class="tl-left">
            <div class="tl-dot pending">4</div>
            <div class="tl-line"></div>
          </div>
          <div class="tl-right">
            <div class="tl-title pending">财务审批</div>
            <div class="tl-meta">赵六（待处理）</div>
          </div>
        </div>
        <div class="tl-item">
          <div class="tl-left">
            <div class="tl-dot pending">5</div>
          </div>
          <div class="tl-right">
            <div class="tl-title pending">总经理审批</div>
            <div class="tl-meta">陈总（待处理）</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab2：相关附件 -->
    <div class="tab-panel" id="tab-files">
      <div class="file-list">
        <div class="file-item">
          <div class="file-icon pdf">PDF</div>
          <div>
            <div class="file-name">皓月设计公司采购合同_v2.pdf</div>
            <div class="file-size">2.3 MB &nbsp;·&nbsp; 2024-01-01 上传</div>
          </div>
          <button class="file-btn">下载</button>
          <button class="file-btn">预览</button>
        </div>
        <div class="file-item">
          <div class="file-icon word">DOC</div>
          <div>
            <div class="file-name">需求说明书_皓月设计.docx</div>
            <div class="file-size">856 KB &nbsp;·&nbsp; 2024-01-01 上传</div>
          </div>
          <button class="file-btn">下载</button>
          <button class="file-btn">预览</button>
        </div>
        <div class="file-item">
          <div class="file-icon excel">XLS</div>
          <div>
            <div class="file-name">报价清单_2024Q1.xlsx</div>
            <div class="file-size">124 KB &nbsp;·&nbsp; 2024-01-02 上传</div>
          </div>
          <button class="file-btn">下载</button>
          <button class="file-btn">预览</button>
        </div>
      </div>
    </div>

    <!-- Tab3：操作日志 -->
    <div class="tab-panel" id="tab-log">
      <div style="display:flex;flex-direction:column;gap:0">
        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #F5F5F5">
          <div style="font-size:12px;color:var(--text-tertiary);width:130px;flex-shrink:0">2024-01-02 14:20</div>
          <div style="font-size:13px;color:var(--text-secondary)"><span style="color:var(--text-primary);font-weight:500">李四</span> 审批通过，意见：同意，资料完整，请继续流转。</div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #F5F5F5">
          <div style="font-size:12px;color:var(--text-tertiary);width:130px;flex-shrink:0">2024-01-01 14:05</div>
          <div style="font-size:13px;color:var(--text-secondary)"><span style="color:var(--text-primary);font-weight:500">系统</span> 流转至部门审批节点，审批人：李四</div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #F5F5F5">
          <div style="font-size:12px;color:var(--text-tertiary);width:130px;flex-shrink:0">2024-01-01 10:20</div>
          <div style="font-size:13px;color:var(--text-secondary)"><span style="color:var(--text-primary);font-weight:500">张三</span> 补充上传附件：报价清单_2024Q1.xlsx</div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0">
          <div style="font-size:12px;color:var(--text-tertiary);width:130px;flex-shrink:0">2024-01-01 09:30</div>
          <div style="font-size:13px;color:var(--text-secondary)"><span style="color:var(--text-primary);font-weight:500">张三</span> 创建订单并发起审批</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 撤销确认弹窗 -->
<div class="overlay" id="cancelOverlay">
  <div class="modal">
    <div class="modal-title">确认撤销申请？</div>
    <div class="modal-desc">撤销后订单将回到草稿状态，已完成的审批节点将被清空，需重新发起审批流程。</div>
    <div class="modal-btns">
      <button class="btn btn-default" onclick="document.getElementById('cancelOverlay').classList.remove('show')">再想想</button>
      <button class="btn btn-danger" onclick="document.getElementById('cancelOverlay').classList.remove('show')">确认撤销</button>
    </div>
  </div>
</div>

<script>
function switchTab(el,panelId){
  document.querySelectorAll('.tab-item').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(panelId).classList.add('active');
}
</script>
</body>
</html>
```

