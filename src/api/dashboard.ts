import { pixiuAxios } from '@/api/container'

export type DashboardPanelStatus = 'success' | 'no_data' | 'metric_missing' | 'error'
export type DashboardPanelKind = 'stat' | 'gauge' | 'bar' | 'line' | 'status' | 'empty'

export interface DashboardSection {
  id: string
  title: string
  icon: string
  children?: string[]
}

export interface DashboardPanelDefinition {
  id: string
  section: string
  title: string
  description?: string
  kind: DashboardPanelKind
  unit?: string
  span: number
  required_metrics?: string[]
}

export interface DashboardDefinition {
  sections: DashboardSection[]
  panels: DashboardPanelDefinition[]
}

export interface DashboardFilters {
  namespace?: string
  node?: string
  workload_kind?: string
  workload_name?: string
  pod?: string
}

export interface DashboardWorkloadOption {
  kind: string
  name: string
}

export interface DashboardVariables {
  namespaces: string[]
  nodes: string[]
  workloads: DashboardWorkloadOption[]
  pods: string[]
}

export interface DashboardPoint {
  timestamp: number
  value: string
}

export interface DashboardSeries {
  metric: Record<string, string>
  values: DashboardPoint[]
}

export interface DashboardPanelResult {
  id: string
  status: DashboardPanelStatus
  message?: string
  series: DashboardSeries[]
}

export interface DashboardQueryResult {
  datasource_id: number
  started_at: number
  ended_at: number
  results: DashboardPanelResult[]
}

async function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  const response = (await promise) as {
    data: { code: number; result: T; message?: string }
  }
  const { code, result, message } = response.data
  if (code !== 200) throw new Error(message || '仪表盘请求失败')
  return result as T
}

export function fetchDashboardDefinition(): Promise<DashboardDefinition> {
  return unwrap<DashboardDefinition>(pixiuAxios.get('/pixiu/dashboard/definition'))
}

export function fetchDashboardVariables(
  datasourceId: number,
  filters: DashboardFilters
): Promise<DashboardVariables> {
  return unwrap<DashboardVariables>(
    pixiuAxios.get('/pixiu/dashboard/variables', {
      params: { datasource_id: datasourceId, ...filters }
    })
  )
}

export function fetchDashboardQuery(payload: {
  datasourceId: number
  panelIds: string[]
  start: number
  end: number
  step: number
  filters: DashboardFilters
}): Promise<DashboardQueryResult> {
  return unwrap<DashboardQueryResult>(
    pixiuAxios.post('/pixiu/dashboard/query', {
      datasource_id: payload.datasourceId,
      panel_ids: payload.panelIds,
      start: payload.start,
      end: payload.end,
      step: payload.step,
      filters: payload.filters
    })
  )
}
