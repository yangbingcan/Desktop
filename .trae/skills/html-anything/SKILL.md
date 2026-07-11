---
name: html-anything
description: >
  html-anything 技能 —— 用 AI 将任何内容生成精美单文件 HTML，支持 78 个专业模板，一键导出微信/X/知乎/PNG。
  触发词：html-anything、HTML Anything、生成 HTML、做网页、做海报、做 PPT、做图文、做报告、做简历、做 dashboard、做数据报告、做营销页、做落地页、小红书图文、杂志文章、营销海报、Keynote、幻灯片、数据可视化、prototype、landing page、resume、invoice、周报、会议纪要。
  当用户说"用 html-anything 做..."、"帮我生成一个..."、"做成 HTML"、"输出 HTML 页面"时触发。
---

# html-anything — AI HTML 创作引擎

> 将任何内容（Markdown / 文字 / 数据）变成设计精美的单文件 HTML。
> 基于 [nexu-io/html-anything](https://github.com/nexu-io/html-anything) 开源项目（Apache 2.0）。

## 使用流程

1. **用户说要做什么**（如："帮我做一个杂志文章"、"生成一个营销海报"）
2. **匹配模板**：从下方目录找到最匹配的模板名称
3. **读取模板**：`Read` 工具读取 `templates/skills/<模板名>/SKILL.md`
4. **生成 HTML**：严格按模板 SKILL.md 中的中文提示词（【模板: ...】部分）生成单文件 HTML
5. **输出**：将完整 HTML 写入文件，用 `preview_url` 预览，或用 `deliver_attachments` 交付

## 模板目录（78 个）

### 📖 文章 / Article（3）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| article-magazine | 杂志文章 | Substack/Medium 高级感长文，适合公众号、博客 |
| blog-post | 博客长文 | 杂志感长文，含 masthead、hero、pull quote |
| digital-eguide | 电子指南 | 两页跨页电子指南，封面+课程页 |

### 🃏 卡片 / Card（8）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| card-xiaohongshu | 小红书图文卡片 | 多张联排可滑动，3:4 竖版 |
| card-twitter | Twitter 分享卡 | 推特金句/数据卡 |
| social-x-post-card | X 帖子卡 | 拟真 X 推文卡片 + 互动数据 |
| social-carousel | 社交媒体三联 | 三张方形卡片轮播 |
| social-spotify-card | Spotify 播放卡 | 专辑封面+进度条+播放控制 |
| social-reddit-card | Reddit 帖子卡 | 拟真 Reddit 帖子卡 |
| frame-macos-notification | macOS 通知 | 拟真 macOS 通知 banner |
| vfx-text-cursor | VFX 文字光标 | 光标拖光+彩色像散射线 |

### 📊 仪表板 / Dashboard（7）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| dashboard | 管理后台仪表板 | 侧栏+顶栏+KPI 网格 |
| live-dashboard | 团队仪表板 | Notion 风，KPI+sparkline+任务表 |
| flowai-team-dashboard | FlowAI 团队管理 | 三 tab 团队管理后台 |
| social-media-dashboard | 社媒创作者仪表板 | 平台切换+粉丝KPI+增长曲线 |
| social-media-matrix | 社媒矩阵追踪面板 | 电影感多平台社媒分析 |
| team-okrs | 团队 OKR 追踪 | 季度 banner+目标+KR 进度条 |
| kanban-board | 看板 / Kanban | Todo/进行中/审查/Done 四列 |

### 📈 数据 / Data（2）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| data-report | 数据可视化报告 | CSV/Excel/JSON → 可视化报告页 |
| experiment-readout | 实验复盘 | A/B 实验 → 决策建议 |

### 📄 文档 / Doc（7）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| exec-briefing-memo | 高管决策简报 | Decision needed + recommendation |
| hr-onboarding | 新员工入职页 | 首周日程+buddy+学习路径 |
| eng-runbook | 工程 Runbook | 服务概述+alerts+dashboards |
| docs-page | 技术文档页 | 三栏：侧导航+正文+右TOC |
| doc-kami-parchment | Kami 羊皮纸文档 | 暖羊皮纸底+墨蓝单色 |
| meeting-notes | 会议纪要 | 出席+议程+决议+action items |
| competitive-teardown | 竞品拆解 | 定位图+功能矩阵+价格对比 |

### 📧 邮件 / Email（1）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| email-marketing | 营销邮件 | 产品发布邮件，含 masthead+hero+CTA |

### 💰 财务 / Finance（2）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| finance-report | 季度财报 | Masthead+KPI+收入图+P&L 表 |
| invoice | 可打印发票 | 标准发票：明细+税+总额 |

### 📱 移动端 / Mobile（3）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| mobile-app | iPhone App 单屏 | 像素级 iPhone 15 Pro 边框 |
| mobile-onboarding | App 引导多屏 | 三个手机框：splash/value-prop/sign-in |
| gamified-app | 游戏化 App 多屏 | 封面/任务/详情，暗色舞台 |

### 🖼️ 海报 / Poster（5）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| poster-hero | 营销海报 | 竖版 1080×1920，强视觉冲击 |
| magazine-poster | 杂志风海报 | Sunday-paper 风格，大字 serif |
| mockup-device-3d | iPhone×MacBook 立体展架 | 3D 设备展示架 |
| sprite-animation | 像素动画解说 | 纯 CSS 循环像素动画 |
| frame-liquid-bg-hero | 流体背景 Hero 帧 | WebGL 风流体置换背景 |

### 🔧 原型 / Prototype（8）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| prototype-web | Web 产品原型 | 可点击原型，含导航+hero+特性+CTA |
| saas-landing | SaaS Landing | 单页落地页，hero/features/social-proof/pricing |
| pricing-page | 定价页 | 三档定价+特性对比表+FAQ |
| web-proto-soft | Apple Soft 原型 | 银/奶 canvas+双层斜面卡片 |
| web-proto-editorial | Editorial 原型 | 暖色单色+serif display |
| web-proto-brutalist | Brutalist 原型 | Swiss industrial-print 风 |
| waitlist-page | 等候名单页 | 极简产品预发布落地页 |
| wireframe-sketch | 手绘线框图 | 网格背景+marker 笔触 |

### 📄 简历 / Resume（1）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| resume-modern | 极简简历 | A4 单页，适合打印或导出 PDF |

### 📽️ 幻灯片 / Slides（21）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| ppt-keynote | Keynote 风格 PPT | 苹果 Keynote 级别幻灯片 |
| deck-pitch | 投资人 Pitch Deck | 10 页融资 deck |
| deck-product-launch | 产品发布 Keynote | 暗 hero+亮内容，橙→桃 accent |
| deck-tech-sharing | 技术分享 Deck | GitHub-dark+终端代码块 |
| deck-simple | 通用 Simple Deck | 通用 horizontal-swipe deck |
| deck-blueprint | 蓝图架构 Deck | 奶油纸+锈红+蓝图网格 |
| deck-swiss-international | 瑞士国际主义 Deck | 16 列网格+单一饱和 accent |
| deck-xhs-pastel | 马卡龙慢生活 Deck | 奶油底+柔光 blob+圆角卡片 |
| deck-xhs-post | 小红书图文 Deck | 9 页 3:4 竖版图文 |
| deck-xhs-white | 白底杂志风 Deck | 纯白+彩虹 bar+渐变文字 |
| deck-obsidian-claude | GitHub Dark 紫渐变 Deck | 紫蓝环境光+三色渐变标题 |
| deck-graphify-dark | 暗底图谱 Deck | 深夜渐变+SVG 力导向图谱 |
| deck-hermes-cyber | Cyber Terminal Deck | 黑底+CRT 网格扫描线 |
| deck-replit | Replit Slides 风 Deck | 八套主题 |
| deck-open-slide-canvas | 1920 画布自由 Deck | 1920×1080 画布自由组合 |
| deck-course-module | 课程/培训 Deck | 暖纸背景+MCQ 自测页 |
| deck-presenter-mode | 演讲者模式 Deck | tokyo-night 默认，演讲者模式 |
| deck-dir-key-nav | 极简方向键 Keynote | 8 页单色背景+Mono 箭头 |
| deck-magazine-web | 杂志风网页 PPT | WebGL 流体背景+衬线 display |
| deck-guizang-editorial | 贵赞编辑墨水 Deck | 电子杂志×电子墨水，5 套调色板 |
| weekly-update | 团队周报 Deck | 6-8 页横向滑动周报 |

### 🎬 视频帧 / Video（7）
| 模板名 | 中文名 | 说明 |
|--------|--------|------|
| video-hyperframes | Hyperframes 视频脚本 | Remotion 兼容连续帧动画 |
| frame-glitch-title | 故障艺术标题帧 | 数字故障/像散偏移/数据腐败标题 |
| frame-light-leak-cinema | 胶片漏光电影帧 | 胶片漏光+颗粒噪点，电影感 |
| frame-logo-outro | 品牌 Logo 收尾帧 | Logo 分块组装+ glow bloom |
| frame-data-chart-nyt | NYT 风数据图表帧 | NYT-newsroom 排版+编辑级图表 |
| frame-flowchart-sticky | 便利贴流程图帧 | SVG 曲线连接+便利贴节点 |
| motion-frames | 动效英雄帧 | 可循环 CSS 动效组合 |

## 设计规范（生成 HTML 时必须遵守）

- **单文件输出**：所有 CSS 内联或用 `<style>` 块，不依赖外部 CDN（Tailwind CDN 除外）
- **中文字体优先**：`font-family: "Noto Sans SC", "PingFang SC", system-ui, sans-serif`
- **8px 基线栅格**：所有间距/尺寸是 8 的倍数
- **对比度 ≥ 4.5**:1**（WCAG AA）**
- **禁止占位文本**：不允许 `lorem ipsum`，必须用用户真实内容
- **Tailwind CSS CDN**：可引入 `<script src="https://cdn.tailwindcss.com"></script>`
- **Google Fonts**：可引入 `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">`

## 导出支持

生成 HTML 后，可进一步：
- **微信公众号**：用 `juice` 内联 CSS 后复制粘贴
- **X/Twitter**：用 `modern-screenshot` 渲染成 2× 高清 PNG
- **知乎**：LaTeX 公式转为 `<img>` 占位符
- **直接交付**：`deliver_attachments` 发送 .html 文件
