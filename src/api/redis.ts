import { pixiuAxios } from '@/api/container'

/** Redis 连接探测结果 */
export interface RedisPingResult {
  connected: boolean
  latencyMs: number
  message?: string
  address?: string
  version?: string
  db?: number
}

/** Redis 实例概览 */
export interface RedisInfoResult {
  redisVersion: string
  redisMode: string
  os: string
  uptimeInSeconds: number
  usedMemoryHuman: string
  connectedClients: number
  keyspaceHits: number
  keyspaceMisses: number
  totalKeys: number
  raw: string
}

/** SCAN 扫描出的 key 概览 */
export interface RedisKeyItem {
  key: string
  type: string
  ttl: number
  /** 值预览：string 为截断后的值文本，集合类为空 */
  valuePreview?: string
  /** 预览是否被截断 */
  previewTruncated?: boolean
  /** string 为字节长度，集合类为元素数量 */
  length?: number
}

/** SCAN 分页结果 */
export interface RedisScanResult {
  page: number
  pageSize: number
  hasMore: boolean
  keys: RedisKeyItem[]
}

/** 单个 key 的详情（只读） */
export interface RedisKeyDetail {
  key: string
  type: string
  ttl: number
  encoding?: string
  sizeBytes: number
  value: unknown
  truncated?: boolean
}

interface RedisScanParams {
  session: string
  page?: number
  pageSize?: number
  match?: string
  db?: number
}

interface BackendRedisPing {
  connected?: boolean
  latency_ms?: number
  message?: string
  address?: string
  version?: string
  db?: number
}

interface BackendRedisInfo {
  redis_version?: string
  redis_mode?: string
  os?: string
  uptime_in_seconds?: number
  used_memory_human?: string
  connected_clients?: number
  keyspace_hits?: number
  keyspace_misses?: number
  total_keys?: number
  raw?: string
}

interface BackendRedisKeyItem {
  key?: string
  type?: string
  ttl?: number
  value_preview?: string
  preview_truncated?: boolean
  length?: number
}

interface BackendRedisScan {
  page?: number
  page_size?: number
  has_more?: boolean
  keys?: BackendRedisKeyItem[] | null
}

interface BackendRedisKeyDetail {
  key?: string
  type?: string
  ttl?: number
  encoding?: string
  size_bytes?: number
  value?: unknown
  truncated?: boolean
}

function unwrap<T>(res: { data: { code: number; result?: T; message?: string } }, fallbackMsg: string): T {
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || fallbackMsg)
  return result as T
}

/** 连接探测 */
export async function fetchRedisPing(datasourceId: number): Promise<RedisPingResult> {
  const res = await pixiuAxios.get(`/pixiu/redis/${datasourceId}/ping`)
  const data = unwrap<BackendRedisPing>(res, 'Redis 连接探测失败')
  return normalizePing(data)
}

/** 临时连通性探测（创建数据源前，不依赖已保存的数据源） */
export async function fetchRedisPingAdhoc(payload: {
  mode?: 'standalone' | 'sentinel' | 'cluster'
  address?: string
  addresses?: string[]
  masterName?: string
  password?: string
  sentinelPassword?: string
  db?: number
}): Promise<RedisPingResult> {
  const res = await pixiuAxios.post('/pixiu/redis/ping', {
    mode: payload.mode ?? 'standalone',
    address: payload.address ?? '',
    addresses: payload.addresses ?? [],
    master_name: payload.masterName ?? '',
    password: payload.password ?? '',
    sentinel_password: payload.sentinelPassword ?? '',
    db: payload.db ?? 0
  })
  const data = unwrap<BackendRedisPing>(res, 'Redis 连接探测失败')
  return normalizePing(data)
}

function normalizePing(data: BackendRedisPing | undefined): RedisPingResult {
  return {
    connected: Boolean(data?.connected),
    latencyMs: data?.latency_ms ?? 0,
    message: data?.message ?? '',
    address: data?.address ?? '',
    version: data?.version ?? '',
    db: data?.db ?? 0
  }
}

/** 实例概览（db 缺省为数据源配置的默认库） */
export async function fetchRedisInfo(datasourceId: number, db?: number): Promise<RedisInfoResult> {
  const res = await pixiuAxios.get(`/pixiu/redis/${datasourceId}/info`, {
    params: { db }
  })
  const data = unwrap<BackendRedisInfo>(res, '获取 Redis 实例信息失败')
  return {
    redisVersion: data?.redis_version ?? '',
    redisMode: data?.redis_mode ?? '',
    os: data?.os ?? '',
    uptimeInSeconds: data?.uptime_in_seconds ?? 0,
    usedMemoryHuman: data?.used_memory_human ?? '',
    connectedClients: data?.connected_clients ?? 0,
    keyspaceHits: data?.keyspace_hits ?? 0,
    keyspaceMisses: data?.keyspace_misses ?? 0,
    totalKeys: data?.total_keys ?? 0,
    raw: data?.raw ?? ''
  }
}

/** SCAN 会话式分页扫描 key */
export async function fetchRedisKeys(
  datasourceId: number,
  params: RedisScanParams
): Promise<RedisScanResult> {
  const res = await pixiuAxios.get(`/pixiu/redis/${datasourceId}/keys`, {
    params: {
      session: params.session,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
      match: params.match ?? undefined,
      db: params.db
    }
  })
  const data = unwrap<BackendRedisScan>(res, '扫描 Redis Key 失败')
  return {
    page: data?.page ?? 1,
    pageSize: data?.page_size ?? 10,
    hasMore: Boolean(data?.has_more),
    keys: (data?.keys ?? []).map((item) => ({
      key: item.key ?? '',
      type: item.type ?? 'unknown',
      ttl: item.ttl ?? -1,
      valuePreview: item.value_preview ?? '',
      previewTruncated: Boolean(item.preview_truncated),
      length: item.length ?? 0
    }))
  }
}

/** 查看单个 key 详情 */
export async function fetchRedisKeyDetail(datasourceId: number, key: string, db?: number): Promise<RedisKeyDetail> {
  const res = await pixiuAxios.get(`/pixiu/redis/${datasourceId}/key`, {
    params: { key, db }
  })
  const data = unwrap<BackendRedisKeyDetail>(res, '获取 Key 详情失败')
  return {
    key: data?.key ?? key,
    type: data?.type ?? 'unknown',
    ttl: data?.ttl ?? -1,
    encoding: data?.encoding ?? '',
    sizeBytes: data?.size_bytes ?? 0,
    value: data?.value,
    truncated: Boolean(data?.truncated)
  }
}

/** 新增 Key（string 类型；key 已存在时后端拒绝） */
export async function fetchRedisCreateKey(
  datasourceId: number,
  payload: { key: string; value?: string; ttl?: number; db?: number }
): Promise<void> {
  const res = await pixiuAxios.post(`/pixiu/redis/${datasourceId}/key`, {
    key: payload.key,
    value: payload.value ?? '',
    ttl: payload.ttl ?? 0,
    db: payload.db
  })
  unwrap(res, '新增 Key 失败')
}

/** 删除 Key */
export async function fetchRedisDeleteKey(datasourceId: number, key: string, db?: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/redis/${datasourceId}/key`, {
    params: { key, db }
  })
  unwrap(res, '删除 Key 失败')
}

/** 批量删除 Key，返回实际删除数量 */
export async function fetchRedisDeleteKeys(
  datasourceId: number,
  keys: string[],
  db?: number
): Promise<number> {
  const res = await pixiuAxios.delete(`/pixiu/redis/${datasourceId}/keys`, {
    params: { db },
    data: { keys }
  })
  const data = unwrap<{ deleted?: number }>(res, '批量删除 Key 失败')
  return data?.deleted ?? 0
}

/** 修改 string 类型 Key 的值（保持原 TTL） */
export async function fetchRedisUpdateKeyValue(
  datasourceId: number,
  payload: { key: string; value: string; db?: number }
): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/redis/${datasourceId}/key`, {
    key: payload.key,
    value: payload.value,
    db: payload.db
  })
  unwrap(res, '修改 Key 值失败')
}

/** 修改 Key TTL（>=0 设置过期，-1 永久化） */
export async function fetchRedisSetKeyTTL(
  datasourceId: number,
  payload: { key: string; ttl: number; db?: number }
): Promise<void> {
  const res = await pixiuAxios.post(`/pixiu/redis/${datasourceId}/key/ttl`, payload)
  unwrap(res, '修改 TTL 失败')
}
