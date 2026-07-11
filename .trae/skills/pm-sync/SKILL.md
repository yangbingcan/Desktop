---
name: "pm-sync"
description: "项目管理系统进度自动同步。Agent 在开发对话中自动调用本地 REST API 更新需求/BUG状态。触发：需求开发开始/完成、BUG发现/修复时自动同步。"
---

# 项目管理系统 — Agent 自动同步技能

> 此 Skill 让 Agent 在所有开发对话中自动将进度同步到本地项目管理系统。

## 系统信息

- **地址**: http://localhost:8000
- **API文档**: http://localhost:8000/docs
- **健康检查**: `curl -s http://localhost:8000/api/health` (返回 `{"status":"ok"}` 表示在线)

## 操作原则

1. **每个关键动作都要同步** — 开始开发、开发完成、发现BUG、修复BUG
2. **Agent 操作必须传 `changed_by: "agent"`** — 所有 PUT 请求必须包含此字段
3. **comment 要写清楚做了什么** — 用中文简要描述，方便事后追溯
4. **先 GET 确认状态，再 PUT 更新** — 避免覆盖其他变更

## API 合约

### 创建需求（用户提新功能时）
```bash
echo '{"title":"功能标题","description":"功能描述","priority":"P0","source":"agent"}' \
  | curl -s -X POST http://localhost:8000/api/projects/{项目ID}/requirements \
    -H "Content-Type: application/json" -d @-
```

### 更新需求状态（Agent 核心操作）
```bash
# status可选: in_progress / review / done
echo '{"status":"in_progress","comment":"开始开发：技术方案已确定","changed_by":"agent"}' \
  | curl -s -X PUT http://localhost:8000/api/requirements/{需求ID} \
    -H "Content-Type: application/json" -d @-
```

### 创建BUG
```bash
echo '{"title":"BUG标题","severity":"major","description":"详细描述","source":"agent"}' \
  | curl -s -X POST http://localhost:8000/api/projects/{项目ID}/bugs \
    -H "Content-Type: application/json" -d @-
```

### 修复BUG
```bash
echo '{"status":"fixed","comment":"修复说明","changed_by":"agent"}' \
  | curl -s -X PUT http://localhost:8000/api/bugs/{BUG_ID} \
    -H "Content-Type: application/json" -d @-
```

### 查看项目状态
```bash
curl -s http://localhost:8000/api/projects/{项目ID}/dashboard | python -m json.tool
```

## 操作时机映射

| Agent 动作 | API 调用 | 参数 |
|-----------|---------|------|
| 开始开发新功能 | PUT /api/requirements/{id} | `{"status":"in_progress","comment":"...","changed_by":"agent"}` |
| 功能开发完成 | PUT /api/requirements/{id} | `{"status":"review","comment":"...","changed_by":"agent"}` |
| 用户验收通过 | PUT /api/requirements/{id} | `{"status":"done","comment":"...","changed_by":"agent"}` |
| 发现BUG | POST /api/projects/{pid}/bugs | `{"title":"...","severity":"...","source":"agent"}` |
| BUG修复完成 | PUT /api/bugs/{id} | `{"status":"fixed","comment":"...","changed_by":"agent"}` |

## 枚举值参考

### 需求状态: backlog → in_progress → review → done
### 需求优先级: P0(紧急) P1(高) P2(中) P3(低)
### BUG状态: open → in_progress → fixed → closed / wontfix
### BUG严重度: critical major minor trivial
### 项目状态: active archived completed

## 注意事项

- 使用 Bash curl 时用管道 `echo '...' | curl -d @-` 方式传JSON，避免中文编码问题
- 不要用 PowerShell Invoke-RestMethod 传中文（会乱码）
- 操作前先用 `curl -s http://localhost:8000/api/health` 确认服务在线
- 如果服务不在线，Agent 应尝试重启服务而非跳过同步
