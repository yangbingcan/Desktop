# 项目配置

> 本文件存放项目特有配置，通用规范见 `.trae/rules/project_rules.md`。
> 新项目启动时，根据实际情况修改本文件内容。

---

## 基本信息

| 项目 | 内容 |
|------|------|
| 项目名称 | 管用GL（通用管理基础模板） |
| 技术栈 | Tauri 2 + React 18 + TypeScript + Ant Design 5 + TailwindCSS + Zustand + Rust + SQLite |
| 数据库版本 | SQLite 3 |

---

## 注释规范配置

### 文件头注释格式

| 语言 | 格式 | 示例 |
|------|------|------|
| TypeScript/TSX | `/** @file 简短中文描述 */` | `/** @file 商品列表页面 - 管理商品信息的增删改查 */` |
| Rust | `//! 简短中文描述` | `//! 商品数据模型定义` |

### 豁免文件

`*.d.ts`（纯类型声明）、`*.css`、`*.json`、自动生成的文件

---

## 版本管理配置

### 当前版本

| 端 | 当前版本 | 版本文件位置 |
|----|---------|------------|
| 桌面端 | v0.6.0 | `specs/releases/v0.6.0.md` |

### 版本号同步文件

| 文件 | 字段 |
|------|------|
| `GLTauriRust/package.json` | `version` |
| `GLTauriRust/src-tauri/Cargo.toml` | `version` |
| `GLTauriRust/src-tauri/tauri.conf.json` | `version` |

---

## 项目目录说明

| 目录 | 说明 |
|------|------|
| `GLTauriRust/` | Tauri 桌面端项目根目录 |
| `GLTauriRust/src/` | 前端源码（React + TypeScript） |
| `GLTauriRust/src-tauri/` | 后端源码（Rust） |
| `结构/` | 业务需求文档（按项目需要添加） |
