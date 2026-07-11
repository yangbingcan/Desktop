---
name: wechat-miniprogram-login
description: 微信小程序一键登录实现指南。在需要实现微信登录功能、排查登录问题、或了解uniCloud微信登录流程时调用。
agent_created: true
---
# 微信小程序一键登录技能

## 技能概述

本技能记录瑜伽馆管理端小程序的微信登录实现方案，基于 uni-app (Vue 2) + uniCloud 阿里云 + uni-id-pages 模块。

## 本项目实际实现

### 架构说明

- **项目类型**：管理端小程序（`admin/` 目录）
- **技术栈**：uni-app Vue 2 + uniCloud 阿里云
- **登录模块**：uni-id-pages（内置微信登录）
- **云对象**：uni-id-co（uni-id-pages 自带）
- **用户表**：uni-id-users（uni-id 自带）

### 登录流程

```
用户点击「微信登录」
    → uni.login({ provider: 'weixin' }) 获取 code
    → uni-id-co 云对象 loginByWeixin(code)
    → 云端用 appid+appsecret+code 换取 openid
    → 查询/创建 uni-id-users 记录
    → 生成 Token 返回前端
    → 前端保存 Token，跳转首页
```

### 关键文件

| 文件 | 作用 |
|------|------|
| `uni_modules/uni-id-pages/pages/login/login-withoutpwd.vue` | 登录页面（微信一键登录入口） |
| `uni_modules/uni-id-pages/common/store.js` | 用户状态管理（已加容错） |
| `uni_modules/uni-id-pages/init.js` | 初始化逻辑（已加容错） |
| `uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/` | 登录云对象 |
| `uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common/` | Token 生成校验 |
| `uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/uni-id/config.json` | 微信 AppID/Secret 配置 |

### 关键配置

**uni-id/config.json 中 mp-weixin 配置**（已填入真实值）：

```json
{
  "mp-weixin": {
    "oauth": {
      "weixin": {
        "appid": "wx0f4cc11815792a23",
        "appsecret": "b46f011cf00b27065419c662ecf80b1f"
      }
    }
  }
}
```

**tokenSecret**（已修改为随机字符串）：

```json
{
  "tokenSecret": "yJ8kL3mN6oP9qR2sT5uV8wX1yZ4aB7cD0eF3gH6i"
}
```

### 容错处理（已修改）

由于云空间可能未关联，以下文件已加容错：

1. **App.vue**：`uniIdPageInit()` 包裹 try-catch，初始化失败不阻塞启动
2. **store.js**：`uniCloud.database()` 和 `uniCloud.importObject()` 加空值检查
3. **init.js**：`db.on()`、`uniIdCo` 调用加空值检查

### 云函数上传顺序

1. 上传公共模块（按顺序）：
   - `uni_modules/uni-config-center/.../uni-config-center`
   - `uni_modules/uni-id-common/.../uni-id-common`
   - `uni_modules/uni-cloud-s2s/.../uni-cloud-s2s`
   - `uni_modules/uni-open-bridge-common/.../uni-open-bridge-common`
2. 上传云对象：
   - `uni_modules/uni-id-pages/.../uni-id-co`
   - `uni_modules/uni-captcha/.../uni-captcha-co`
3. 初始化数据库：
   - `uniCloud-aliyun/database` → 初始化云数据库

### 路由配置

**pages.json 中登录相关配置**：

```json
{
  "uniIdRouter": {
    "loginPage": "uni_modules/uni-id-pages/pages/login/login-withoutpwd",
    "needLogin": [
      "pages/index/index",
      "pages/manage/course/schedule/index",
      "pages/manage/member/list/index",
      "pages/my/index"
    ],
    "resToLogin": true
  }
}
```

- `needLogin`：需要登录才能访问的页面
- `resToLogin: true`：未登录自动跳转登录页

### 退出登录

在 `pages/my/index.vue` 中调用：

```javascript
const uniIdPagesStore = require('@/uni_modules/uni-id-pages/common/store')
await uniIdPagesStore.mutations.logout()
uni.reLaunch({ url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd' })
```

---

## 常见问题排查

### 问题1：MODULE_NOT_FOUND: Cannot find module 'uni-id-common'

**原因**：公共模块未上传或上传顺序错误

**解决**：按上面"云函数上传顺序"重新上传

### 问题2：微信登录返回 errcode

| errcode | 说明 | 解决方案 |
|---------|------|---------|
| 40029 | code 无效 | code 只能用一次，检查是否重复使用 |
| 40163 | code 已使用 | 重新获取 code |
| 40013 | appid 无效 | 检查 config.json 中 appid 是否正确 |

### 问题3：Page "pages/index/index" has not been registered yet

**原因**：App.vue onLaunch 中 uniIdPageInit() 抛异常导致页面注册失败

**解决**：已加 try-catch 容错，确保初始化失败不阻塞启动

### 问题4：Cannot read property 'collection' of undefined

**原因**：云空间未关联时 `uniCloud.database()` 返回 undefined

**解决**：已加空值检查 `const db = uniCloud.database ? uniCloud.database() : null`

---

## 快速检查清单

- [x] 微信小程序后台已配置服务器域名
- [x] uni-id 配置文件包含正确的 appid 和 appsecret
- [x] tokenSecret 已修改为随机字符串
- [x] 云函数已上传并安装依赖
- [x] App.vue 已加容错处理
- [x] store.js 已加空值检查
- [x] init.js 已加空值检查
- [x] pages.json needLogin 配置正确

---

**技能版本**：v2.0
**更新日期**：2026-05-25
**适用项目**：瑜伽馆管理端小程序（uni-app Vue 2 + uniCloud 阿里云）

## 更新记录

| 版本 | 日期 | 更新内容 |
|-----|------|---------|
| v2.0 | 2026-05-25 | 根据瑜伽馆管理端实际实现重写，记录真实文件路径和配置 |
| v1.1 | 2026-03-29 | 添加 uni-app 与 uni-app x 差异说明 |
| v1.0 | 2026-03-29 | 初始版本 |
