# 管用GL - 授权注册管理系统

## 项目简介

管用GL 是一套独立的**授权注册管理系统**，提供用户认证、授权码管理、角色权限、系统配置等核心功能。

本系统从茶叶店管理项目中独立出来，可作为通用桌面应用的授权管理模块。

## 技术栈

| 层级 | 技术 |
|:---|:---|
| 前端框架 | React 18 + TypeScript |
| UI 组件库 | Ant Design 5 |
| 样式方案 | Tailwind CSS 3 |
| 状态管理 | Zustand 5 |
| 桌面壳 | Tauri 2.x |
| 后端逻辑 | Rust（Tauri Command） |
| 数据库 | SQLite（rusqlite + r2d2 连接池） |

## 核心功能模块

### 1. 用户认证（auth）
- 用户登录（支持 bcrypt + 向后兼容 SHA-256）
- Token 管理（HMAC-SHA256 签名，24h 过期）
- 密码修改
- 当前用户信息查询

### 2. 授权码管理（license）
- **离线 HMAC 签名验证**：无需网络，不依赖第三方服务
- **机器绑定**：授权码绑定到特定机器（MAC + hostname 指纹）
- **有效期管理**：支持永久授权和限期授权
- **签名防伪**：HMAC-SHA256 签名，防止篡改
- **本地持久化**：激活状态存储在 license.json
- **授权日志**：记录激活/注销操作

### 3. 用户管理（users）
- 用户 CRUD
- 启用/禁用用户
- 重置密码
- 随机密码生成

### 4. 角色权限（roles）
- 角色 CRUD
- 权限分配（dashboard / permission / user_manage / settings / system_log）
- 用户-角色关联

### 5. 操作日志（operation_logs）
- 记录用户操作行为
- 日志查询/删除/清理
- 页面访问记录

### 6. 系统配置（system_config）
- 系统参数管理
- 公司 Logo 上传
- 数据库备份/恢复
- 系统信息查询
- 存储空间查询

## 授权码生成工具

`license-gen-tool/` 目录包含独立的授权码生成工具：

```bash
cd license-gen-tool
cargo build --release
# 生成授权码
./target/release/license-gen-tool --machine-id <机器指纹> --expiry 2099-12-31
```

## 目录结构

```
zhuceshouquan/
├── src/                     # React 前端源码
│   ├── app/                 # 应用入口
│   ├── components/          # 公共组件
│   │   ├── auth/            # 认证组件
│   │   ├── common/          # 通用组件
│   │   └── layout/          # 布局组件
│   ├── hooks/               # 自定义 Hooks
│   ├── pages/               # 页面
│   │   ├── auth/            # 登录/激活
│   │   ├── dashboard/       # 仪表盘
│   │   ├── permission/      # 权限管理
│   │   ├── settings/        # 系统设置
│   │   ├── system/          # 系统日志
│   │   └── user/            # 用户管理
│   ├── services/            # API 服务层
│   ├── stores/              # Zustand 状态管理
│   ├── styles/              # 样式文件
│   └── utils/               # 工具函数
├── src-tauri/               # Rust 后端源码
│   ├── src/
│   │   ├── auth.rs          # 用户认证
│   │   ├── license.rs       # 授权码管理
│   │   ├── users.rs         # 用户管理
│   │   ├── roles.rs         # 角色权限
│   │   ├── database.rs      # 数据库管理
│   │   ├── models.rs        # 数据模型
│   │   ├── operation_logs.rs # 操作日志
│   │   ├── system_config.rs # 系统配置
│   │   ├── server.rs        # HTTP 服务（可选）
│   │   └── bin/             # 授权码生成工具
│   ├── icons/               # 应用图标
│   └── tauri.conf.json     # Tauri 配置
├── license-gen-tool/       # 授权码生成工具
├── dist/                   # 构建产物
└── public/                 # 静态资源
```

## 开发指南

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build

# 运行测试
npm test

# 类型检查
npm run typecheck
```

## 版本历史

- v0.6.0 - 当前版本（从茶叶店管理项目独立）
