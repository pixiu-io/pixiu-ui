import { pixiuAxios } from '@/api/container'

/** 单条定时任务（与后端 types.CronHpaJob 对应） */
export interface CronHpaJob {
  name: string
  /** 标准 5 段 cron 表达式（分 时 日 月 周），如 "0 9 * * *" */
  schedule: string
  target_size: number
  run_once?: boolean
  /** 最近一次应触发时刻（由调度器推进） */
  last_fire_time?: string
  /** Submitted / Succeed / Failed / Skipped */
  state?: string
  message?: string
}

/** 定时扩缩容规则（与后端 types.CronHpa 对应） */
export interface CronHpa {
  id: number
  gmt_create: string
  gmt_modified: string
  name: string
  cluster_name: string
  namespace: string
  /** Deployment / StatefulSet / HorizontalPodAutoscaler（兼容模式） */
  target_kind: string
  target_name: string
  jobs: CronHpaJob[]
  exclude_dates?: string[]
  /** active / paused */
  status: string
  description?: string
  create_user?: string
}

/** 创建/更新定时扩缩容规则请求 */
export interface CronHpaRequest {
  name: string
  cluster_name: string
  namespace: string
  target_kind: string
  target_name: string
  jobs: Array<{
    name: string
    schedule: string
    target_size: number
    run_once?: boolean
  }>
  exclude_dates?: string[]
  description?: string
}

/** 定时扩缩容执行历史 */
export interface CronHpaHistory {
  id: number
  cron_hpa_id: number
  job_name: string
  scheduled_time: string
  executed_at: string
  previous_replicas: number
  desired_replicas: number
  /** Succeed / Failed / Skipped */
  result: string
  message?: string
}

function unwrap<T>(
  res: { data: { code: number; result?: T; message?: string } },
  fallbackMsg: string
): T {
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || fallbackMsg)
  return result as T
}

const basePath = '/pixiu/extension/autoscaling/cronhpas'

/** 定时扩缩容规则列表（按集群/命名空间过滤） */
export async function fetchCronHpaList(params?: {
  cluster?: string
  namespace?: string
}): Promise<CronHpa[]> {
  const res = await pixiuAxios.get(basePath, {
    params: {
      cluster: params?.cluster || undefined,
      namespace: params?.namespace || undefined
    }
  })
  return unwrap<CronHpa[]>(res, '获取定时扩缩容规则列表失败') ?? []
}

/** 定时扩缩容规则详情 */
export async function fetchCronHpa(id: number): Promise<CronHpa> {
  const res = await pixiuAxios.get(`${basePath}/${id}`)
  return unwrap<CronHpa>(res, '获取定时扩缩容规则失败')
}

/** 创建定时扩缩容规则 */
export async function createCronHpa(req: CronHpaRequest): Promise<CronHpa> {
  const res = await pixiuAxios.post(basePath, req)
  return unwrap<CronHpa>(res, '创建定时扩缩容规则失败')
}

/** 更新定时扩缩容规则 */
export async function updateCronHpa(id: number, req: CronHpaRequest): Promise<CronHpa> {
  const res = await pixiuAxios.put(`${basePath}/${id}`, req)
  return unwrap<CronHpa>(res, '更新定时扩缩容规则失败')
}

/** 删除定时扩缩容规则 */
export async function deleteCronHpa(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`${basePath}/${id}`)
  unwrap(res, '删除定时扩缩容规则失败')
}

/** 暂停/恢复定时扩缩容规则 */
export async function setCronHpaStatus(id: number, status: 'active' | 'paused'): Promise<void> {
  const res = await pixiuAxios.put(`${basePath}/${id}/status`, { status })
  unwrap(res, '更新规则状态失败')
}

/** 定时扩缩容执行历史 */
export async function fetchCronHpaHistories(id: number, limit = 100): Promise<CronHpaHistory[]> {
  const res = await pixiuAxios.get(`${basePath}/${id}/histories`, { params: { limit } })
  return unwrap<CronHpaHistory[]>(res, '获取执行历史失败') ?? []
}
