import { pixiuAxios } from '@/api/container'

export type AlertRuleType = 1 | 2
export type AlertSeverity = 1 | 2 | 3
export type AlertScopeType = 1 | 2 | 3 | 4
export type AlertEventStatus = 1 | 2 | 3 | 4
export type AlertChannelType = 1 | 2 | 3 | 4 | 5
export type AlertNotificationStatus = 0 | 1 | 2

export const AlertRuleTypeMap: Record<AlertRuleType, string> = {
  1: 'Metric',
  2: 'Log'
}

export const AlertSeverityMap: Record<
  AlertSeverity,
  { label: string; type: 'info' | 'warning' | 'danger' | 'success' }
> = {
  1: { label: 'P0', type: 'danger' },
  2: { label: 'P1', type: 'warning' },
  3: { label: 'P2', type: 'info' }
}

export const AlertScopeTypeMap: Record<AlertScopeType, string> = {
  1: '全局',
  2: '集群',
  3: '租户',
  4: '自定义'
}

export const AlertEventStatusMap: Record<
  AlertEventStatus,
  { label: string; type: 'danger' | 'success' | 'warning' | 'info' }
> = {
  1: { label: '触发中', type: 'danger' },
  2: { label: '已恢复', type: 'success' },
  3: { label: '已确认', type: 'warning' },
  4: { label: '已解决', type: 'info' }
}

export const AlertChannelTypeMap: Record<AlertChannelType, string> = {
  1: '邮件',
  2: '钉钉',
  3: '企业微信',
  4: 'Webhook',
  5: '飞书'
}

export const AlertNotificationStatusMap: Record<
  AlertNotificationStatus,
  { label: string; type: 'info' | 'success' | 'danger' }
> = {
  0: { label: '待发送', type: 'info' },
  1: { label: '成功', type: 'success' },
  2: { label: '失败', type: 'danger' }
}

interface BackendMeta {
  id: number
  resource_version?: number
  gmt_create?: string
  gmt_modified?: string
}

interface BackendPageResult<T> {
  page?: number
  limit?: number
  total?: number
  items?: T[] | null
}

export interface AlertRuleItem {
  id: number
  resourceVersion: number
  name: string
  description: string
  ruleType: AlertRuleType
  duration: number
  evalInterval: number
  notifyRepeatStep: number
  notifyMaxNumber: number
  severity: AlertSeverity
  scopeType: AlertScopeType
  scopeValue: string
  notifyChannels: string
  notifyTemplate: string
  ruleConfig: string
  enableDaysOfWeek: string
  enableStime: string
  enableEtime: string
  datasourceId: number
  enabled: boolean
  createdBy: string
  extension: string
  gmtCreate: string
  gmtModified: string
}

export interface AlertChannelItem {
  id: number
  resourceVersion: number
  name: string
  description: string
  channelType: AlertChannelType
  config: string
  enabled: boolean
  createdBy: string
  extension: string
  gmtCreate: string
  gmtModified: string
}

export interface AlertSilenceItem {
  id: number
  resourceVersion: number
  name: string
  matchLabels: string
  matchExpressions: string
  startsAt: string
  endsAt: string
  enabled: boolean
  createdBy: string
  comment: string
  extension: string
  gmtCreate: string
  gmtModified: string
}

export interface AlertEventItem {
  id: number
  resourceVersion: number
  ruleId: number
  ruleName: string
  status: AlertEventStatus
  severity: AlertSeverity
  triggerValue: string
  triggerExpr: string
  resourceType: string
  resourceName: string
  resourceNamespace: string
  clusterId: number
  tenantId: number
  recoverValue: string
  recoverTime?: string
  labels: string
  annotations: string
  extension: string
  gmtCreate: string
  gmtModified: string
}

export interface AlertNotificationItem {
  id: number
  resourceVersion: number
  eventId: number
  ruleId: number
  channel: AlertChannelType
  receiver: string
  title: string
  content: string
  status: AlertNotificationStatus
  retryCount: number
  errorMsg: string
  extension: string
  gmtCreate: string
  gmtModified: string
}

export interface AlertListParams {
  page?: number
  limit?: number
  current?: number
  size?: number
  nameSelector?: string
  severity?: AlertSeverity
  ruleId?: number
  eventId?: number
  clusterId?: number
  status?: AlertEventStatus
  channelType?: AlertChannelType
  enabled?: boolean
}

export interface AlertListResult<T> {
  records: T[]
  total: number
  current: number
  size: number
}

function resolvePage(params: AlertListParams = {}) {
  return {
    page: params.page ?? params.current ?? 1,
    limit: params.limit ?? params.size ?? 10
  }
}

export function formatAlertDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatDateTime(dateStr?: string): string {
  return formatAlertDateTime(dateStr)
}

function unwrapList<T>(result: BackendPageResult<T>, page: number, limit: number): AlertListResult<T> {
  return {
    records: result?.items ?? [],
    total: result?.total ?? 0,
    current: page,
    size: limit
  }
}

function toAlertRule(item: BackendMeta & Record<string, unknown>): AlertRuleItem {
  return {
    id: item.id,
    resourceVersion: (item.resource_version as number) ?? 0,
    name: (item.name as string) ?? '',
    description: (item.description as string) ?? '',
    ruleType: (item.rule_type as AlertRuleType) ?? 1,
    duration: (item.duration as number) ?? 0,
    evalInterval: (item.eval_interval as number) ?? 15,
    notifyRepeatStep: (item.notify_repeat_step as number) ?? 5,
    notifyMaxNumber: (item.notify_max_number as number) ?? 0,
    severity: (item.severity as AlertSeverity) ?? 2,
    scopeType: (item.scope_type as AlertScopeType) ?? 1,
    scopeValue: (item.scope_value as string) ?? '',
    notifyChannels: (item.notify_channels as string) ?? '',
    notifyTemplate: (item.notify_template as string) ?? '',
    ruleConfig: (item.rule_config as string) ?? '',
    enableDaysOfWeek: (item.enable_days_of_week as string) ?? '',
    enableStime: (item.enable_stime as string) || '00:00',
    enableEtime: (item.enable_etime as string) || '00:00',
    datasourceId: (item.datasource_id as number) ?? 0,
    enabled: Boolean(item.enabled),
    createdBy: (item.created_by as string) ?? '',
    extension: (item.extension as string) ?? '',
    gmtCreate: formatDateTime(item.gmt_create as string),
    gmtModified: formatDateTime(item.gmt_modified as string)
  }
}

function toAlertChannel(item: BackendMeta & Record<string, unknown>): AlertChannelItem {
  return {
    id: item.id,
    resourceVersion: (item.resource_version as number) ?? 0,
    name: (item.name as string) ?? '',
    description: (item.description as string) ?? '',
    channelType: (item.channel_type as AlertChannelType) ?? 4,
    config: (item.config as string) ?? '',
    enabled: Boolean(item.enabled),
    createdBy: (item.created_by as string) ?? '',
    extension: (item.extension as string) ?? '',
    gmtCreate: formatDateTime(item.gmt_create as string),
    gmtModified: formatDateTime(item.gmt_modified as string)
  }
}

function toAlertSilence(item: BackendMeta & Record<string, unknown>): AlertSilenceItem {
  return {
    id: item.id,
    resourceVersion: (item.resource_version as number) ?? 0,
    name: (item.name as string) ?? '',
    matchLabels: (item.match_labels as string) ?? '',
    matchExpressions: (item.match_expressions as string) ?? '',
    startsAt: (item.starts_at as string) ?? '',
    endsAt: (item.ends_at as string) ?? '',
    enabled: Boolean(item.enabled),
    createdBy: (item.created_by as string) ?? '',
    comment: (item.comment as string) ?? '',
    extension: (item.extension as string) ?? '',
    gmtCreate: formatDateTime(item.gmt_create as string),
    gmtModified: formatDateTime(item.gmt_modified as string)
  }
}

function toAlertEvent(item: BackendMeta & Record<string, unknown>): AlertEventItem {
  return {
    id: item.id,
    resourceVersion: (item.resource_version as number) ?? 0,
    ruleId: (item.rule_id as number) ?? 0,
    ruleName: (item.rule_name as string) ?? '',
    status: (item.status as AlertEventStatus) ?? 1,
    severity: (item.severity as AlertSeverity) ?? 2,
    triggerValue: (item.trigger_value as string) ?? '',
    triggerExpr: (item.trigger_expr as string) ?? '',
    resourceType: (item.resource_type as string) ?? '',
    resourceName: (item.resource_name as string) ?? '',
    resourceNamespace: (item.resource_namespace as string) ?? '',
    clusterId: (item.cluster_id as number) ?? 0,
    tenantId: (item.tenant_id as number) ?? 0,
    recoverValue: (item.recover_value as string) ?? '',
    recoverTime: item.recover_time ? formatDateTime(item.recover_time as string) : undefined,
    labels: (item.labels as string) ?? '',
    annotations: (item.annotations as string) ?? '',
    extension: (item.extension as string) ?? '',
    gmtCreate: formatDateTime(item.gmt_create as string),
    gmtModified: formatDateTime(item.gmt_modified as string)
  }
}

function toAlertNotification(item: BackendMeta & Record<string, unknown>): AlertNotificationItem {
  return {
    id: item.id,
    resourceVersion: (item.resource_version as number) ?? 0,
    eventId: (item.event_id as number) ?? 0,
    ruleId: (item.rule_id as number) ?? 0,
    channel: (item.channel as AlertChannelType) ?? 4,
    receiver: (item.receiver as string) ?? '',
    title: (item.title as string) ?? '',
    content: (item.content as string) ?? '',
    status: (item.status as AlertNotificationStatus) ?? 0,
    retryCount: (item.retry_count as number) ?? 0,
    errorMsg: (item.error_msg as string) ?? '',
    extension: (item.extension as string) ?? '',
    gmtCreate: formatDateTime(item.gmt_create as string),
    gmtModified: formatDateTime(item.gmt_modified as string)
  }
}

async function request<T>(promise: Promise<{ data: { code: number; result?: T; message?: string } }>, fallback: string) {
  const res = await promise
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || fallback)
  return result
}

// ---------- Rules ----------

export async function fetchGetAlertRuleList(params: AlertListParams = {}): Promise<AlertListResult<AlertRuleItem>> {
  const { page, limit } = resolvePage(params)
  const result = await request<BackendPageResult<BackendMeta & Record<string, unknown>>>(
    pixiuAxios.get('/pixiu/alerts/rules', {
      params: {
        page,
        limit,
        nameSelector: params.nameSelector,
        severity: params.severity
      }
    }),
    '获取告警规则列表失败'
  )
  return {
    ...unwrapList(result ?? {}, page, limit),
    records: (result?.items ?? []).map(toAlertRule)
  }
}

export async function fetchGetAlertRule(id: number): Promise<AlertRuleItem> {
  const result = await request<BackendMeta & Record<string, unknown>>(
    pixiuAxios.get(`/pixiu/alerts/rules/${id}`),
    '获取告警规则详情失败'
  )
  return toAlertRule(result ?? { id })
}

export async function fetchCreateAlertRule(payload: Record<string, unknown>): Promise<void> {
  await request(pixiuAxios.post('/pixiu/alerts/rules', payload), '创建告警规则失败')
}

export async function fetchUpdateAlertRule(id: number, payload: Record<string, unknown>): Promise<void> {
  await request(pixiuAxios.put(`/pixiu/alerts/rules/${id}`, payload), '更新告警规则失败')
}

export async function fetchDeleteAlertRule(id: number): Promise<void> {
  await request(pixiuAxios.delete(`/pixiu/alerts/rules/${id}`), '删除告警规则失败')
}

// ---------- Channels ----------

export async function fetchGetAlertChannelList(params: AlertListParams = {}): Promise<AlertListResult<AlertChannelItem>> {
  const { page, limit } = resolvePage(params)
  const result = await request<BackendPageResult<BackendMeta & Record<string, unknown>>>(
    pixiuAxios.get('/pixiu/alerts/channels', {
      params: {
        page,
        limit,
        nameSelector: params.nameSelector,
        channel_type: params.channelType,
        enabled: params.enabled
      }
    }),
    '获取通知渠道列表失败'
  )
  return {
    ...unwrapList(result ?? {}, page, limit),
    records: (result?.items ?? []).map(toAlertChannel)
  }
}

export async function fetchGetAlertChannel(id: number): Promise<AlertChannelItem> {
  const result = await request<BackendMeta & Record<string, unknown>>(
    pixiuAxios.get(`/pixiu/alerts/channels/${id}`),
    '获取通知渠道详情失败'
  )
  return toAlertChannel(result ?? { id })
}

export async function fetchCreateAlertChannel(payload: Record<string, unknown>): Promise<void> {
  await request(pixiuAxios.post('/pixiu/alerts/channels', payload), '创建通知渠道失败')
}

export async function fetchUpdateAlertChannel(id: number, payload: Record<string, unknown>): Promise<void> {
  await request(pixiuAxios.put(`/pixiu/alerts/channels/${id}`, payload), '更新通知渠道失败')
}

export async function fetchDeleteAlertChannel(id: number): Promise<void> {
  await request(pixiuAxios.delete(`/pixiu/alerts/channels/${id}`), '删除通知渠道失败')
}

export async function fetchPingAlertChannel(payload: Record<string, unknown>): Promise<void> {
  await request(pixiuAxios.post('/pixiu/alerts/channels/ping', payload), '连通性测试失败')
}

// ---------- Silences ----------

export async function fetchGetAlertSilenceList(params: AlertListParams = {}): Promise<AlertListResult<AlertSilenceItem>> {
  const { page, limit } = resolvePage(params)
  const result = await request<BackendPageResult<BackendMeta & Record<string, unknown>>>(
    pixiuAxios.get('/pixiu/alerts/silences', {
      params: {
        page,
        limit,
        nameSelector: params.nameSelector,
        enabled: params.enabled
      }
    }),
    '获取静默规则列表失败'
  )
  return {
    ...unwrapList(result ?? {}, page, limit),
    records: (result?.items ?? []).map(toAlertSilence)
  }
}

export async function fetchGetAlertSilence(id: number): Promise<AlertSilenceItem> {
  const result = await request<BackendMeta & Record<string, unknown>>(
    pixiuAxios.get(`/pixiu/alerts/silences/${id}`),
    '获取静默规则详情失败'
  )
  return toAlertSilence(result ?? { id })
}

export async function fetchCreateAlertSilence(payload: Record<string, unknown>): Promise<void> {
  await request(pixiuAxios.post('/pixiu/alerts/silences', payload), '创建静默规则失败')
}

export async function fetchUpdateAlertSilence(id: number, payload: Record<string, unknown>): Promise<void> {
  await request(pixiuAxios.put(`/pixiu/alerts/silences/${id}`, payload), '更新静默规则失败')
}

export async function fetchDeleteAlertSilence(id: number): Promise<void> {
  await request(pixiuAxios.delete(`/pixiu/alerts/silences/${id}`), '删除静默规则失败')
}

// ---------- Events ----------

export async function fetchGetAlertEventList(params: AlertListParams = {}): Promise<AlertListResult<AlertEventItem>> {
  const { page, limit } = resolvePage(params)
  const result = await request<BackendPageResult<BackendMeta & Record<string, unknown>>>(
    pixiuAxios.get('/pixiu/alerts/events', {
      params: {
        page,
        limit,
        rule_id: params.ruleId,
        severity: params.severity,
        cluster_id: params.clusterId,
        status: params.status
      }
    }),
    '获取告警事件列表失败'
  )
  return {
    ...unwrapList(result ?? {}, page, limit),
    records: (result?.items ?? []).map(toAlertEvent)
  }
}

export async function fetchGetAlertEvent(id: number): Promise<AlertEventItem> {
  const result = await request<BackendMeta & Record<string, unknown>>(
    pixiuAxios.get(`/pixiu/alerts/events/${id}`),
    '获取告警事件详情失败'
  )
  return toAlertEvent(result ?? { id })
}

export async function fetchUpdateAlertEventStatus(
  id: number,
  payload: { resourceVersion: number; status: AlertEventStatus }
): Promise<void> {
  await request(
    pixiuAxios.put(`/pixiu/alerts/events/${id}/status`, {
      resource_version: payload.resourceVersion,
      status: payload.status
    }),
    '更新告警事件状态失败'
  )
}

// ---------- Notifications ----------

export async function fetchGetAlertNotificationList(
  params: AlertListParams = {}
): Promise<AlertListResult<AlertNotificationItem>> {
  const { page, limit } = resolvePage(params)
  const result = await request<BackendPageResult<BackendMeta & Record<string, unknown>>>(
    pixiuAxios.get('/pixiu/alerts/notifications', {
      params: {
        page,
        limit,
        rule_id: params.ruleId,
        event_id: params.eventId
      }
    }),
    '获取通知记录列表失败'
  )
  return {
    ...unwrapList(result ?? {}, page, limit),
    records: (result?.items ?? []).map(toAlertNotification)
  }
}
