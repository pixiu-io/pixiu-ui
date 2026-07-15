import { nextTick, ref, type Ref } from 'vue'
import type { DatasourceItem } from '@/api/datasource'
import { resolveDatasourceUrl } from '@/api/datasource'
import { fetchPrometheusLabels, fetchPrometheusLabelValues } from '@/api/kubernetes/prometheus'

export type PromqlSuggestionKind = 'metric' | 'label' | 'operator' | 'value'

export interface PromqlSuggestion {
  value: string
  kind: PromqlSuggestionKind
  fullQuery: string
  cursorAfter: number
}

const PROMQL_MATCH_OPERATORS = ['=', '!=', '=~', '!~']

type PromqlAutocompleteContext =
  | { type: 'metric'; token: string; replaceStart: number }
  | { type: 'label-name'; token: string; replaceStart: number }
  | { type: 'label-operator'; labelName: string; token: string; replaceStart: number }
  | { type: 'label-value'; labelName: string; token: string; replaceStart: number; quoted: boolean }

interface UsePromqlAutocompleteOptions {
  promql: Ref<string>
  autocompleteEnabled: Ref<boolean>
  selectedDatasource: Ref<DatasourceItem | null | undefined>
  resolveTimeRange: () => { start: number; end: number }
  getExternalProxyHeaders: (datasource: DatasourceItem | null) => Record<string, string>
}

export function usePromqlAutocomplete(options: UsePromqlAutocompleteOptions) {
  const { promql, autocompleteEnabled, selectedDatasource, resolveTimeRange, getExternalProxyHeaders } =
    options

  const promqlAutocompleteRef = ref<{
    inputRef?: { ref?: HTMLInputElement }
    getData?: (queryString: string) => void
    focus?: () => void
    activated?: boolean | { value: boolean }
    suggestions?: PromqlSuggestion[]
  } | null>(null)
  const metricNameOptions = ref<string[]>([])
  const metricNamesLoading = ref(false)
  const metricNamesLoadedForDatasourceId = ref<number>()
  const labelNameCache = new Map<string, string[]>()
  const labelValueCache = new Map<string, string[]>()

  function clearAutocompleteCache() {
    metricNameOptions.value = []
    metricNamesLoadedForDatasourceId.value = undefined
    labelNameCache.clear()
    labelValueCache.clear()
  }

  async function prefetchAutocompleteData() {
    const ds = selectedDatasource.value
    if (!ds || !autocompleteEnabled.value) return
    await prefetchMetricNameOptions(ds)
  }

  async function prefetchMetricNames() {
    await prefetchAutocompleteData()
  }

  function buildPrometheusRequestOptions(datasource: DatasourceItem) {
    if (!datasource.external) {
      return {
        clusterName: datasource.clusterName || undefined
      }
    }
    return {
      headers: getExternalProxyHeaders(datasource)
    }
  }

  async function prefetchMetricNameOptions(ds: DatasourceItem) {
    if (metricNamesLoading.value) return
    if (metricNamesLoadedForDatasourceId.value === ds.id && metricNameOptions.value.length > 0) return

    metricNamesLoading.value = true
    try {
      const dsUrl = resolveDatasourceUrl(ds)
      if (!dsUrl) {
        metricNameOptions.value = []
        return
      }
      const { end, start } = resolveTimeRange()
      const res = await fetchPrometheusLabelValues(dsUrl, '__name__', {
        ...buildPrometheusRequestOptions(ds),
        start,
        end
      })
      metricNameOptions.value = res.status === 'success' ? (res.data ?? []) : []
      metricNamesLoadedForDatasourceId.value = ds.id
    } catch {
      metricNameOptions.value = []
    } finally {
      metricNamesLoading.value = false
    }
  }

  function extractMetricName(query: string, braceIdx: number): string | null {
    const beforeBrace = query.slice(0, braceIdx)
    const match = beforeBrace.match(/([a-zA-Z_:][a-zA-Z0-9_:]*)$/)
    return match?.[1] ?? null
  }

  function parseCompletedSelectorLabels(inside: string): Array<{ key: string; value: string }> {
    const labels: Array<{ key: string; value: string }> = []
    const regex = /(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"((?:\\.|[^"\\])*)"/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(inside)) !== null) {
      labels.push({ key: match[1], value: match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\') })
    }
    return labels
  }

  function escapeSelectorValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  }

  function buildMatchSelector(
    metricName: string,
    completedLabels: Array<{ key: string; value: string }>
  ): string {
    const parts = [`__name__="${escapeSelectorValue(metricName)}"`]
    for (const { key, value } of completedLabels) {
      if (key === '__name__') continue
      parts.push(`${key}="${escapeSelectorValue(value)}"`)
    }
    return `{${parts.join(',')}}`
  }

  async function loadLabelNamesForMetric(
    metricName: string,
    completedLabels: Array<{ key: string; value: string }>
  ): Promise<string[]> {
    const ds = selectedDatasource.value
    if (!ds) return []

    const usedKeys = new Set(completedLabels.map((item) => item.key))
    const cacheKey = `${ds.id}:${metricName}:${[...usedKeys].sort().join(',')}`
    const cached = labelNameCache.get(cacheKey)
    if (cached) return cached.filter((name) => !usedKeys.has(name))

    try {
      const dsUrl = resolveDatasourceUrl(ds)
      if (!dsUrl) return []
      const { end, start } = resolveTimeRange()
      const res = await fetchPrometheusLabels(dsUrl, {
        ...buildPrometheusRequestOptions(ds),
        start,
        end,
        match: [buildMatchSelector(metricName, completedLabels)]
      })
      const labels =
        res.status === 'success'
          ? (res.data ?? []).filter((name) => name !== '__name__' && !usedKeys.has(name))
          : []
      labelNameCache.set(cacheKey, labels)
      return labels
    } catch {
      return []
    }
  }

  async function loadLabelValues(
    labelName: string,
    metricName: string,
    completedLabels: Array<{ key: string; value: string }>
  ): Promise<string[]> {
    const ds = selectedDatasource.value
    if (!ds) return []

    const contextLabels = completedLabels.filter((item) => item.key !== labelName)
    const cacheKey = `${ds.id}:${metricName}:${labelName}:${contextLabels.map((item) => `${item.key}=${item.value}`).join(',')}`
    const cached = labelValueCache.get(cacheKey)
    if (cached) return cached

    try {
      const dsUrl = resolveDatasourceUrl(ds)
      if (!dsUrl) return []
      const { end, start } = resolveTimeRange()
      const res = await fetchPrometheusLabelValues(dsUrl, labelName, {
        ...buildPrometheusRequestOptions(ds),
        start,
        end,
        match: [buildMatchSelector(metricName, contextLabels)]
      })
      const values = res.status === 'success' ? (res.data ?? []) : []
      labelValueCache.set(cacheKey, values)
      return values
    } catch {
      return []
    }
  }

  function getNativeInput(): HTMLInputElement | null {
    return promqlAutocompleteRef.value?.inputRef?.ref ?? null
  }

  function getCursorPos(): number {
    const input = getNativeInput()
    if (input && input.selectionStart != null) return input.selectionStart
    return promql.value.length
  }

  /** 根据光标位置判断当前是否处于未闭合的 label selector 内 */
  function findSelectorBraceAtCursor(query: string, cursorPos: number): number {
    let depth = 0
    let openIdx = -1
    for (let i = 0; i < cursorPos; i++) {
      const ch = query[i]
      if (ch === '{') {
        if (depth === 0) openIdx = i
        depth++
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1)
        if (depth === 0) openIdx = -1
      }
    }
    return depth > 0 ? openIdx : -1
  }

  function getSelectorInside(
    query: string,
    cursorPos: number
  ): { braceIdx: number; inside: string } | null {
    const braceIdx = findSelectorBraceAtCursor(query, cursorPos)
    if (braceIdx < 0) return null
    return { braceIdx, inside: query.slice(braceIdx + 1, cursorPos) }
  }

  function parseAutocompleteContext(
    query: string,
    cursorPos = query.length
  ): PromqlAutocompleteContext | null {
    const selector = getSelectorInside(query, cursorPos)
    if (selector) {
      const { inside } = selector

      const quotedValueMatch = inside.match(
        /(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|!=|=~|!~)\s*"([^"]*)"?$/
      )
      if (quotedValueMatch) {
        const token = quotedValueMatch[3]
        return {
          type: 'label-value',
          labelName: quotedValueMatch[1],
          token,
          replaceStart: cursorPos - token.length,
          quoted: true
        }
      }

      const unquotedValueMatch = inside.match(
        /(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|!=|=~|!~)\s*([^",}\s]+)$/
      )
      if (unquotedValueMatch) {
        const token = unquotedValueMatch[3] ?? ''
        return {
          type: 'label-value',
          labelName: unquotedValueMatch[1],
          token,
          replaceStart: cursorPos - token.length,
          quoted: false
        }
      }

      const operatorMatch = inside.match(/(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([!=~]+)$/)
      if (operatorMatch) {
        const opToken = operatorMatch[2] ?? ''
        return {
          type: 'label-operator',
          labelName: operatorMatch[1],
          token: opToken,
          replaceStart: cursorPos - opToken.length
        }
      }

      const labelNameMatch = inside.match(/(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)$/)
      if (labelNameMatch) {
        const token = labelNameMatch[1]
        return {
          type: 'label-name',
          token,
          replaceStart: cursorPos - token.length
        }
      }

      if (/^(?:[^,]*,)?\s*$/.test(inside)) {
        return {
          type: 'label-name',
          token: '',
          replaceStart: cursorPos
        }
      }

      return null
    }

    let metricStart = 0
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (query[i] === '}') {
        metricStart = i + 1
        break
      }
    }
    const tail = query.slice(metricStart, cursorPos)
    const metricMatch = tail.match(/([a-zA-Z_:][a-zA-Z0-9_:]*)$/)
    if (!metricMatch) return null
    const token = metricMatch[1]
    return {
      type: 'metric',
      token,
      replaceStart: cursorPos - token.length
    }
  }

  async function loadLabelValuesForContext(
    query: string,
    cursorPos: number,
    labelName: string
  ): Promise<string[]> {
    const braceIdx = findSelectorBraceAtCursor(query, cursorPos)
    if (braceIdx < 0) return []
    const metricName = extractMetricName(query, braceIdx)
    if (!metricName) return []
    const inside = query.slice(braceIdx + 1, cursorPos)
    const completedLabels = parseCompletedSelectorLabels(inside)
    return loadLabelValues(labelName, metricName, completedLabels)
  }

  function getMetricLabelContext(
    query: string,
    cursorPos: number
  ): { metricName: string; completedLabels: Array<{ key: string; value: string }> } | null {
    const braceIdx = findSelectorBraceAtCursor(query, cursorPos)
    if (braceIdx < 0) return null
    const metricName = extractMetricName(query, braceIdx)
    if (!metricName) return null
    const inside = query.slice(braceIdx + 1, cursorPos)
    return { metricName, completedLabels: parseCompletedSelectorLabels(inside) }
  }

  function buildSuggestion(
    option: string,
    kind: PromqlSuggestionKind,
    ctx: PromqlAutocompleteContext,
    query: string,
    cursorPos: number
  ): PromqlSuggestion {
    const suffix = query.slice(cursorPos)

    if (ctx.type === 'label-operator') {
      const opSuffix = suffix.startsWith('"') ? suffix : `""${suffix}`
      const fullQuery = query.slice(0, ctx.replaceStart) + option + opSuffix
      return {
        value: option,
        kind,
        fullQuery,
        cursorAfter: ctx.replaceStart + option.length + 1
      }
    }

    if (ctx.type === 'label-name') {
      const fullQuery = query.slice(0, ctx.replaceStart) + option + '=' + suffix
      return {
        value: option,
        kind,
        fullQuery,
        cursorAfter: ctx.replaceStart + option.length + 1
      }
    }

    if (ctx.type === 'label-value') {
      let valueSuffix = suffix
      if (!valueSuffix.startsWith('"')) {
        valueSuffix = `"${valueSuffix}`
        if (!valueSuffix.includes('}')) {
          valueSuffix += '}'
        }
      }
      const fullQuery = query.slice(0, ctx.replaceStart) + option + valueSuffix
      return {
        value: option,
        kind,
        fullQuery,
        cursorAfter: ctx.replaceStart + option.length
      }
    }

    const fullQuery = query.slice(0, ctx.replaceStart) + option + suffix
    return {
      value: option,
      kind,
      fullQuery,
      cursorAfter: ctx.replaceStart + option.length
    }
  }

  function filterSuggestions(
    options: string[],
    token: string,
    kind: PromqlSuggestionKind,
    ctx: PromqlAutocompleteContext,
    query: string,
    cursorPos: number,
    limit = 50
  ): PromqlSuggestion[] {
    const keyword = token.toLowerCase()
    return options
      .filter((item) => !keyword || item.toLowerCase().includes(keyword))
      .slice(0, limit)
      .map((item) => buildSuggestion(item, kind, ctx, query, cursorPos))
  }

  function filterOperatorSuggestions(
    token: string,
    ctx: PromqlAutocompleteContext,
    query: string,
    cursorPos: number
  ): PromqlSuggestion[] {
    return PROMQL_MATCH_OPERATORS.filter((op) => !token || op.startsWith(token)).map((op) =>
      buildSuggestion(op, 'operator', ctx, query, cursorPos)
    )
  }

  function activateAutocomplete() {
    const ac = promqlAutocompleteRef.value
    if (!ac) return
    const activated = ac.activated
    if (activated && typeof activated === 'object' && 'value' in activated) {
      activated.value = true
    } else if (activated !== undefined) {
      ac.activated = true
    }
  }

  function triggerSuggestions() {
    nextTick(() => {
      activateAutocomplete()
      promqlAutocompleteRef.value?.getData?.(promql.value)
    })
  }

  function queryMetricSuggestions(queryString: string, cb: (items: PromqlSuggestion[]) => void) {
    if (!autocompleteEnabled.value) {
      cb([])
      return
    }

    const cursorPos = getCursorPos()
    const ctx = parseAutocompleteContext(queryString, cursorPos)
    if (!ctx) {
      cb([])
      return
    }

    if (ctx.type === 'metric') {
      void (async () => {
        const ds = selectedDatasource.value
        if (ds) await prefetchMetricNameOptions(ds)
        cb(filterSuggestions(metricNameOptions.value, ctx.token, 'metric', ctx, queryString, cursorPos))
      })()
      return
    }

    if (ctx.type === 'label-name') {
      void (async () => {
        const labelCtx = getMetricLabelContext(queryString, cursorPos)
        if (!labelCtx) {
          cb([])
          return
        }
        const labels = await loadLabelNamesForMetric(labelCtx.metricName, labelCtx.completedLabels)
        cb(filterSuggestions(labels, ctx.token, 'label', ctx, queryString, cursorPos))
      })()
      return
    }

    if (ctx.type === 'label-operator') {
      cb(filterOperatorSuggestions(ctx.token, ctx, queryString, cursorPos))
      return
    }

    void (async () => {
      const values = await loadLabelValuesForContext(queryString, cursorPos, ctx.labelName)
      cb(filterSuggestions(values, ctx.token, 'value', ctx, queryString, cursorPos))
    })()
  }

  function getSuggestionToken(): string {
    return parseAutocompleteContext(promql.value, getCursorPos())?.token ?? ''
  }

  function getSuggestionParts(value: string): Array<{ text: string; highlight: boolean }> {
    const token = getSuggestionToken()
    if (!token) return [{ text: value, highlight: false }]

    const lowerValue = value.toLowerCase()
    const lowerToken = token.toLowerCase()
    const start = lowerValue.indexOf(lowerToken)
    if (start < 0) return [{ text: value, highlight: false }]

    const end = start + token.length
    const parts: Array<{ text: string; highlight: boolean }> = []
    if (start > 0) parts.push({ text: value.slice(0, start), highlight: false })
    parts.push({ text: value.slice(start, end), highlight: true })
    if (end < value.length) parts.push({ text: value.slice(end), highlight: false })
    return parts
  }

  function getSuggestionIcon(kind: PromqlSuggestionKind): string {
    switch (kind) {
      case 'metric':
        return 'ri:line-chart-line'
      case 'label':
        return 'ri:price-tag-3-line'
      case 'operator':
        return 'ri:equal-line'
      case 'value':
        return 'ri:box-3-line'
      default:
        return 'ri:line-chart-line'
    }
  }

  function focusPromqlInput(position: number) {
    nextTick(() => {
      promqlAutocompleteRef.value?.focus?.()
      const input = getNativeInput()
      if (!input) return
      input.setSelectionRange(position, position)
    })
  }

  function onPromqlSuggestionSelect(item: PromqlSuggestion) {
    nextTick(() => {
      promql.value = item.fullQuery
      focusPromqlInput(item.cursorAfter)
      if (item.kind === 'label' || item.kind === 'operator') {
        nextTick(() => triggerSuggestions())
      }
    })
  }

  function hasActiveSuggestions(): boolean {
    const ac = promqlAutocompleteRef.value
    if (!ac) return false
    const activated = ac.activated
    const isActivated =
      typeof activated === 'object' && activated && 'value' in activated
        ? activated.value
        : Boolean(activated)
    return isActivated && (ac.suggestions?.length ?? 0) > 0
  }

  function onPromqlKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && hasActiveSuggestions()) {
      return
    }

    if (!autocompleteEnabled.value || event.key !== '{') return
    const input = (event.target as HTMLInputElement | null) ?? getNativeInput()
    if (!input) return

    const start = input.selectionStart ?? promql.value.length
    const end = input.selectionEnd ?? start
    const before = promql.value.slice(0, start)
    const after = promql.value.slice(end)

    if (after.startsWith('}')) {
      event.preventDefault()
      focusPromqlInput(start + 1)
      triggerSuggestions()
      return
    }

    event.preventDefault()
    promql.value = `${before}{}${after}`
    focusPromqlInput(start + 1)
    triggerSuggestions()
  }

  return {
    promqlAutocompleteRef,
    clearAutocompleteCache,
    prefetchMetricNames,
    queryMetricSuggestions,
    getSuggestionParts,
    getSuggestionIcon,
    onPromqlSuggestionSelect,
    onPromqlKeydown,
    hasActiveSuggestions
  }
}
