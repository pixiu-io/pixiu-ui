import { ref } from 'vue'

const STORAGE_KEY = 'pixiu-realtime-query-history'
const MAX_ITEMS = 50

export interface QueryHistoryRecord {
  id: string
  promql: string
  selectedDsId: number | undefined
  sourceFilter: 'internal' | 'external'
  timeRangeMinutes: number
  resultMode: 'table' | 'graph'
  datasourceName: string
  createdAt: number
}

export type QueryHistoryParams = Omit<QueryHistoryRecord, 'id' | 'createdAt'>

function loadHistory(): QueryHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveHistory(records: QueryHistoryRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // localStorage 满或其他异常，静默失败
  }
}

function isDuplicate(a: QueryHistoryParams, b: QueryHistoryRecord): boolean {
  return (
    a.promql === b.promql &&
    a.selectedDsId === b.selectedDsId &&
    a.sourceFilter === b.sourceFilter &&
    a.timeRangeMinutes === b.timeRangeMinutes &&
    a.resultMode === b.resultMode
  )
}

export function useQueryHistory() {
  const history = ref<QueryHistoryRecord[]>(loadHistory())
  const showHistory = ref(false)

  function persist() {
    saveHistory(history.value)
  }

  function addRecord(params: QueryHistoryParams): void {
    const now = Date.now()
    const existingIndex = history.value.findIndex((item) => isDuplicate(params, item))

    if (existingIndex !== -1) {
      // 去重：更新 createdAt 并移到最前
      const [existing] = history.value.splice(existingIndex, 1)
      existing.createdAt = now
      existing.datasourceName = params.datasourceName
      history.value.unshift(existing)
    } else {
      const record: QueryHistoryRecord = {
        id: now.toString(36) + Math.random().toString(36).slice(2, 8),
        ...params,
        createdAt: now
      }
      history.value.unshift(record)
    }

    // 截断到 MAX_ITEMS
    if (history.value.length > MAX_ITEMS) {
      history.value = history.value.slice(0, MAX_ITEMS)
    }

    persist()
  }

  function removeRecord(id: string): void {
    history.value = history.value.filter((item) => item.id !== id)
    persist()
  }

  function clearAll(): void {
    history.value = []
    persist()
  }

  function toggleHistory(): void {
    showHistory.value = !showHistory.value
  }

  function closeHistory(): void {
    showHistory.value = false
  }

  return {
    history,
    showHistory,
    addRecord,
    removeRecord,
    clearAll,
    toggleHistory,
    closeHistory
  }
}
