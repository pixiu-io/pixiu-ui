# 后端 API path 清单（菜单 permissions 标注依据）

> 来源：`pixiu/api/server/router/**` 各分组 `initRoutes` 中 `apiregistry.Group` 注册表。
> 后端 `buttons` 格式为 `METHOD:path`（见 `pkg/controller/user/user.go`：`apis[i].Method + ":" + apis[i].Path`），与前端 `permissionStore.hasAPI()` 匹配。
> 仅 `Persist=nil 或 true` 的条目会写入 `apis` 表，角色才能绑定、`buttons` 才会出现。

## 图例

- ✅ **持久化**：可注册到 apis 表，可用于菜单 `meta.permissions` 标注
- ⚠️ **不持久化**：`Persist=false`，不进入 apis 表，**不能**用于标注
- 🚫 **kube/代理维度**：集群资源维度接口，不用于菜单标注

---

## 部署计划 plan（/pixiu/plans）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/plans | 创建部署 | ✅ |
| PUT | /pixiu/plans/:planId | 更新部署 | ✅ |
| DELETE | /pixiu/plans/:planId | 删除部署 | ✅ |
| GET | /pixiu/plans/:planId | 部署详情 | ✅ |
| GET | /pixiu/plans | 部署列表 | ✅ |
| GET | /pixiu/plans/:planId/resources | 部署子资源 | ✅ |
| POST | /pixiu/plans/:planId/start | 启动 | ✅ |
| POST | /pixiu/plans/:planId/stop | 终止 | ✅ |
| POST | /pixiu/plans/:planId/destroy | 销毁 | ✅ |
| POST | /pixiu/plans/:planId/nodes | 部署节点 | ⚠️ |
| PUT | /pixiu/plans/:planId/nodes/:nodeId | 更新部署节点 | ⚠️ |
| DELETE | /pixiu/plans/:planId/nodes/:nodeId | 删除部署节点 | ⚠️ |
| GET | /pixiu/plans/:planId/nodes/:nodeId | 部署节点详情 | ⚠️ |
| GET | /pixiu/plans/:planId/nodes | 部署节点列表 | ⚠️ |
| POST | /pixiu/plans/:planId/tasks/:taskId | 执行任务 | ✅ |
| GET | /pixiu/plans/:planId/tasks | 查询任务 | ✅ |
| GET | /pixiu/plans/:planId/tasks/:taskId/logs | 部署日志 | ✅ |

---

## 节点管理 node（/pixiu/nodes）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/nodes | 创建节点 | ✅ |
| PUT | /pixiu/nodes/:nodeId | 更新节点 | ✅ |
| DELETE | /pixiu/nodes/:nodeId | 删除节点 | ✅ |
| GET | /pixiu/nodes/:nodeId | 查看详情 | ✅ |
| GET | /pixiu/nodes | 查看列表 | ✅ |

---

## 集群管理 cluster（/pixiu/clusters）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/clusters | 创建集群 | ✅ |
| PUT | /pixiu/clusters/:clusterId | 更新集群 | ✅ |
| DELETE | /pixiu/clusters/:clusterId | 删除集群 | ✅ |
| GET | /pixiu/clusters/:clusterId | 查看详情 | ✅ |
| GET | /pixiu/clusters | 查看列表 | ✅ |
| POST | /pixiu/clusters/ping | 连通测试 | ✅ |
| POST | /pixiu/clusters/protect/:clusterId | 删除保护 | ✅ |
| GET | /pixiu/clusters/:clusterId/kubeconfig | 查看 KubeConfig | ✅ |
| POST | /pixiu/clusters/:clusterId/proxy-kubeconfig | 生成代理 KubeConfig | ✅ |
| GET | /pixiu/clusters/:clusterId/proxy-kubeconfig | 获取代理 KubeConfig | ✅ |
| DELETE | /pixiu/clusters/:clusterId/access-tokens/:jti | 删除访问令牌 | ✅ |
| POST | /pixiu/clusters/:clusterId/permissions | 创建集群权限 | ✅ |
| GET | /pixiu/clusters/permissions | 集群权限列表 | ✅ |
| GET | /pixiu/clusters/permissions/:permissionId | 集群权限详情 | ✅ |
| PUT | /pixiu/clusters/permissions/:permissionId | 更新集群权限 | ✅ |
| DELETE | /pixiu/clusters/permissions/:permissionId | 删除集群权限 | ✅ |

> kube/代理维度：/pixiu/kubeproxy/**、/pixiu/proxy/**、/pixiu/indexer/**、/pixiu/external/**、/k8s/** 均属集群资源维度，不用于菜单标注。🚫

---

## 用户管理 user（/pixiu/users）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/users | 创建用户 | ✅ |
| GET | /pixiu/users | 用户列表 | ✅ |
| POST | /pixiu/users/login | 登录 | ✅ |
| GET | /pixiu/users/permissions | 当前用户权限 | ✅ |
| PUT | /pixiu/users/:userId | 更新用户 | ✅ |
| DELETE | /pixiu/users/:userId | 删除用户 | ✅ |
| GET | /pixiu/users/:userId | 用户详情 | ✅ |
| PUT | /pixiu/users/:userId/password | 修改密码 | ✅ |
| POST | /pixiu/users/:userId/logout | 登出 | ✅ |

> ⚠️ 登录/权限/密码等非页面主接口不用于菜单标注。

---

## 角色管理 role（/pixiu/roles）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/roles | 创建角色 | ✅ |
| PUT | /pixiu/roles/:roleId | 更新角色 | ✅ |
| DELETE | /pixiu/roles/:roleId | 删除角色 | ✅ |
| GET | /pixiu/roles/:roleId | 角色详情 | ✅ |
| GET | /pixiu/roles | 角色列表 | ✅ |
| GET | /pixiu/roles/:roleId/apis | 角色 API 权限 | ✅ |
| PUT | /pixiu/roles/:roleId/apis | 修改角色 API 权限 | ✅ |
| GET | /pixiu/roles/:roleId/api-scopes | 角色资源权限 | ✅ |
| PUT | /pixiu/roles/:roleId/api-scopes | 修改角色资源权限 | ✅ |

---

## 租户管理 tenant（/pixiu/tenants）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/tenants | 创建租户 | ✅ |
| PUT | /pixiu/tenants/:tenantId | 更新租户 | ✅ |
| DELETE | /pixiu/tenants/:tenantId | 删除租户 | ✅ |
| GET | /pixiu/tenants/:tenantId | 租户详情 | ✅ |
| GET | /pixiu/tenants | 租户列表 | ✅ |

---

## API 管理 apiresource（/pixiu/apis）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/apis | 创建 API | ✅ |
| PUT | /pixiu/apis/:apiId | 更新 API | ✅ |
| DELETE | /pixiu/apis/:apiId | 删除 API | ✅ |
| GET | /pixiu/apis/:apiId | API 详情 | ✅ |
| GET | /pixiu/apis | API 列表 | ✅ |

---

## 代理管理 agent（/pixiu/agents）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/agents | 创建代理 | ⚠️ |
| PUT | /pixiu/agents/:agentId | 更新代理 | ⚠️ |
| DELETE | /pixiu/agents/:agentId | 删除代理 | ⚠️ |
| GET | /pixiu/agents/:agentId | 代理详情 | ⚠️ |
| GET | /pixiu/agents | 代理列表 | ⚠️ |
| POST | /pixiu/agents/heartbeat | 心跳上报 | ⚠️ |
| GET | /pixiu/agents/claim | 认领作业 | ⚠️ |
| POST | /pixiu/agents/jobs/:jobId/logs | Agent 上报日志 | ⚠️ |
| POST | /pixiu/agents/jobs/:jobId/result | Agent 上报结果 | ⚠️ |
| GET | /pixiu/agents/jobs/:jobId/plan | Agent 拉取计划 | ⚠️ |

> ⚠️ 全组 Persist=false，不进入 apis 表，**不能**用于菜单标注。

---

## 审计 audit（/pixiu/audits）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| GET | /pixiu/audits | 审计列表 | ✅ |

---

## 数据源 datasource（/pixiu/datasources）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/datasources | 创建数据源 | ✅ |
| PUT | /pixiu/datasources/:datasourceId | 更新数据源 | ✅ |
| DELETE | /pixiu/datasources/:datasourceId | 删除数据源 | ✅ |
| GET | /pixiu/datasources | 数据源列表 | ✅ |
| GET | /pixiu/datasources/:datasourceId | 数据源详情 | ✅ |

---

## Runner（/pixiu/runners）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/runners | 创建 Runner | ✅ |
| PUT | /pixiu/runners/:runnerId | 更新 Runner | ✅ |
| DELETE | /pixiu/runners/:runnerId | 删除 Runner | ✅ |
| GET | /pixiu/runners/:runnerId | Runner 详情 | ✅ |
| GET | /pixiu/runners | Runner 列表 | ✅ |
| POST | /pixiu/runners/install | 安装 | ✅ |
| POST | /pixiu/runners/uninstall | 卸载 | ✅ |

---

## 操作系统 distribution（/pixiu/distributions）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/distributions | 创建操作系统 | ✅ |
| PUT | /pixiu/distributions/:distributionId | 更新操作系统 | ✅ |
| DELETE | /pixiu/distributions/:distributionId | 删除操作系统 | ✅ |
| GET | /pixiu/distributions | 操作系统列表 | ✅ |
| GET | /pixiu/distributions/:distributionId | 操作系统详情 | ✅ |

> ⚠️ 前端 `api/plan.ts` 引用 `GET /pixiu/os` 后端无对应路由注册，不标注。

---

## 智能助手 assistant

### providers（/pixiu/assistant/providers）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/assistant/providers | 创建 Provider | ✅ |
| PUT | /pixiu/assistant/providers/:providerId | 更新 Provider | ✅ |
| DELETE | /pixiu/assistant/providers/:providerId | 删除 Provider | ✅ |
| GET | /pixiu/assistant/providers | Provider 列表 | ✅ |
| GET | /pixiu/assistant/providers/:providerId | Provider 详情 | ✅ |

### accounts（/pixiu/assistant/accounts）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/assistant/accounts | 创建账号 | ✅ |
| PUT | /pixiu/assistant/accounts/:accountId | 更新账号 | ✅ |
| DELETE | /pixiu/assistant/accounts/:accountId | 删除账号 | ✅ |
| GET | /pixiu/assistant/accounts | 账号列表 | ✅ |
| GET | /pixiu/assistant/accounts/:accountId | 账号详情 | ✅ |

### conversations（/pixiu/assistant/conversations）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| DELETE | /pixiu/assistant/conversations/:conversationId | 删除会话 | ✅ |
| GET | /pixiu/assistant/conversations | 会话列表 | ✅ |
| GET | /pixiu/assistant/conversations/:conversationId | 会话详情 | ✅ |

### messages（/pixiu/assistant/messages）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| DELETE | /pixiu/assistant/messages/:messageId | 删除消息 | ✅ |
| GET | /pixiu/assistant/messages | 消息列表 | ✅ |
| GET | /pixiu/assistant/messages/:messageId | 消息详情 | ✅ |

### respond（/pixiu/assistant）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/assistant/respond/stream | 流式响应 | ✅ |

---

## Helm（/pixiu/helms）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/helms/repositories | 创建仓库 | ⚠️ |
| PUT | /pixiu/helms/repositories/:id | 更新仓库 | ⚠️ |
| DELETE | /pixiu/helms/repositories/:id | 删除仓库 | ⚠️ |
| GET | /pixiu/helms/repositories/:id | 仓库详情 | ⚠️ |
| GET | /pixiu/helms/repositories | 仓库列表 | ⚠️ |
| GET | /pixiu/helms/repositories/:id/charts | 仓库 Chart 列表 | ⚠️ |
| GET | /pixiu/helms/repositories/charts | 按 URL 获取 Chart | ⚠️ |
| GET | /pixiu/helms/repositories/values | 获取 Chart Values | ⚠️ |
| POST | /pixiu/helms/clusters/:cluster/namespaces/:namespace/releases | 安装 Release | ⚠️ |
| PUT | /pixiu/helms/clusters/:cluster/namespaces/:namespace/releases | 升级 Release | ⚠️ |
| DELETE | /pixiu/helms/clusters/:cluster/namespaces/:namespace/releases/:name | 卸载 Release | ⚠️ |
| GET | /pixiu/helms/clusters/:cluster/namespaces/:namespace/releases/:name | Release 详情 | ⚠️ |
| GET | /pixiu/helms/clusters/:cluster/namespaces/:namespace/releases | Release 列表 | ⚠️ |
| GET | /pixiu/helms/clusters/:cluster/namespaces/:namespace/releases/:name/history | Release 历史 | ⚠️ |
| POST | /pixiu/helms/clusters/:cluster/namespaces/:namespace/releases/:name/rollback | 回滚 Release | ⚠️ |

> ⚠️ 全组 Persist=false，不进入 apis 表，**不能**用于菜单标注。

---

## 告警 alert

### rules（/pixiu/alerts/rules）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/alerts/rules | 创建规则 | ✅ |
| PUT | /pixiu/alerts/rules/:ruleId | 更新规则 | ✅ |
| DELETE | /pixiu/alerts/rules/:ruleId | 删除规则 | ✅ |
| GET | /pixiu/alerts/rules | 规则列表 | ✅ |
| GET | /pixiu/alerts/rules/:ruleId | 规则详情 | ✅ |
| POST | /pixiu/alerts/rules/export | 导出规则 | ✅ |
| POST | /pixiu/alerts/rules/import | 导入规则 | ✅ |

### events（/pixiu/alerts/events）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| GET | /pixiu/alerts/events | 事件列表 | ✅ |
| GET | /pixiu/alerts/events/:eventId | 事件详情 | ✅ |
| PUT | /pixiu/alerts/events/:eventId/status | 更新事件状态 | ✅ |

### channels（/pixiu/alerts/channels）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/alerts/channels | 创建通道 | ✅ |
| PUT | /pixiu/alerts/channels/:channelId | 更新通道 | ✅ |
| DELETE | /pixiu/alerts/channels/:channelId | 删除通道 | ✅ |
| GET | /pixiu/alerts/channels | 通道列表 | ✅ |
| GET | /pixiu/alerts/channels/:channelId | 通道详情 | ✅ |
| POST | /pixiu/alerts/channels/ping | 通道连通测试 | ✅ |

### notifications（/pixiu/alerts/notifications）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| DELETE | /pixiu/alerts/notifications/:notificationId | 删除通知记录 | ✅ |
| GET | /pixiu/alerts/notifications | 通知记录列表 | ✅ |

### silences（/pixiu/alerts/silences）

| Method | Path | 说明 | 持久化 |
|--------|------|------|--------|
| POST | /pixiu/alerts/silences | 创建静默 | ✅ |
| PUT | /pixiu/alerts/silences/:silenceId | 更新静默 | ✅ |
| DELETE | /pixiu/alerts/silences/:silenceId | 删除静默 | ✅ |
| GET | /pixiu/alerts/silences | 静默列表 | ✅ |
| GET | /pixiu/alerts/silences/:silenceId | 静默详情 | ✅ |

---

## 其它

- `GET /pixiu/connect`：tunnel websocket 端点，非 apis 表资源，不标注。
- `GET /healthz`：健康检查，不标注。

---

## 前端菜单标注汇总（本次修改）

| 模块文件 | 菜单 | permissions 标注 |
|----------|------|-------------------|
| safeguard.ts | runner | `['GET:/pixiu/runners']` |
| safeguard.ts | host | `['GET:/pixiu/nodes']` |
| monitor.ts | alert-config | `['GET:/pixiu/alerts/rules']` |
| monitor.ts | datasource | `['GET:/pixiu/datasources']` |
| ai.ts | ai-account | `['GET:/pixiu/assistant/accounts']` |
| system.ts | role | `['GET:/pixiu/roles']` |
| system.ts | permission | `['GET:/pixiu/clusters/permissions']` |
| system.ts | audit | `['GET:/pixiu/audits']` |
| system.ts | user | `['GET:/pixiu/users']` |
| system.ts | tenant | `['GET:/pixiu/tenants']` |
| system.ts | api | `['GET:/pixiu/apis']` |

**不标注项**：dashboard 首页、container 集群资源模块（cluster/plan/agent 等）、safeguard/agent（isHide 且 agents 不持久化）、safeguard/distribution、runner-distribution（redirect）、monitor/realtime-query、monitor/logs（kube/external 维度）、appstore（无后端 API）、middleware（无后端 API）、user-center（isHide）。
