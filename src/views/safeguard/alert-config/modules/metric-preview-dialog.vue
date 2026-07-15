<!-- 告警条件：数据预览 -->
<template>
  <ElDialog
    v-model="visible"
    title="数据预览"
    width="720px"
    align-center
    destroy-on-close
    class="metric-preview-dialog"
    @opened="runPreview"
  >
    <div class="metric-preview">
      <div class="metric-preview__expr">
        <span class="metric-preview__label">查询表达式</span>
        <code class="metric-preview__code">{{ composedQuery || '-' }}</code>
      </div>

      <div v-if="!datasource" class="metric-preview__hint">请先选择告警数据源</div>
      <div v-else-if="!composedQuery" class="metric-preview__hint">请填写 PromQL 与告警条件</div>
      <div v-else-if="loading" v-loading="true" class="metric-preview__loading" />
      <ElAlert v-else-if="error" type="error" :title="error" show-icon :closable="false" />
      <template v-else>
        <div class="metric-preview__summary">
          <span>查询耗时: {{ durationMs }}ms</span>
          <span>结果数: {{ tableData.length }}</span>
        </div>
        <ElTable
          :data="tableData"
          size="small"
          :max-height="tableMaxHeight"
          empty-text="暂无匹配数据"
          class="metric-preview__table"
        >
          <ElTableColumn prop="time" label="Time" width="176" />
          <ElTableColumn label="指标" min-width="260">
            <template #default="{ row }">
              <div class="metric-preview__metric">
                <span class="metric-preview__metric-name">{{ row.metricName }}</span>
                <template v-if="row.labels.length">
                  <span>{</span>
                  <template v-for="(label, i) in row.labels" :key="`${label.key}-${i}`">
                    <span v-if="i > 0">, </span>
                    <span class="metric-preview__label-key">{{ label.key }}</span>=
                    <span class="metric-preview__label-val">"{{ label.value }}"</span>
                  </template>
                  <span>}</span>
                </template>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="value" label="值" width="120" />
        </ElTable>
      </template>
    </div>

    <template #footer>
      <ElButton @click="visible = false">关闭</ElButton>
      <ElButton type="primary" :loading="loading" :disabled="!canPreview" @click="runPreview">
        刷新
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { ElAlert, ElMessage } from 'element-plus'
  import {
    resolveDatasourceUrl,
    type DatasourceHeader,
    type DatasourceItem
  } from '@/api/datasource'
  import {
    fetchPrometheusInstantQuery,
    type PrometheusInstantResult
  } from '@/api/kubernetes/prometheus'

  defineOptions({ name: 'MetricPreviewDialog' })

  const props = defineProps<{
    promQl: string
    condition: string
    datasource?: DatasourceItem | null
  }>()

  const visible = defineModel<boolean>({ default: false })

  const loading = ref(false)
  const error = ref('')
  const durationMs = ref(0)
  const result = ref<PrometheusInstantResult | null>(null)

  const composedQuery = computed(() => {
    const promQl = props.promQl.trim()
    const condition = props.condition.trim()
    if (!promQl || !condition) return ''
    return `${promQl} ${condition}`
  })

  const canPreview = computed(() => Boolean(props.datasource && composedQuery.value))

  /** 表头约 40px + 每行约 36px，可视区域最多 10 行，超出纵向滚动 */
  const tableMaxHeight = 40 + 10 * 36

  const tableData = computed(() => {
    if (!result.value?.result?.length) return []
    return result.value.result.map((item) => {
      const { metricName, labels } = parseMetricLabels(item.metric ?? {})
      const point = item.value ?? item.values?.[item.values.length - 1]
      return {
        time: point ? formatTimestamp(point[0]) : '-',
        value: point ? formatPointValue(point[1]) : '-',
        metricName,
        labels
      }
    })
  })

  function parseMetricLabels(metric: Record<string, string>): {
    metricName: string
    labels: Array<{ key: string; value: string }>
  } {
    const metricName = metric.__name__ || 'metric'
    const labels = Object.entries(metric)
      .filter(([key]) => key !== '__name__')
      .map(([key, value]) => ({ key, value: String(value ?? '') }))
    return { metricName, labels }
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString('zh-CN')
  }

  function formatPointValue(value: string): string {
    const num = Number(value)
    if (!Number.isFinite(num)) return value
    if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) < 0.01)) {
      return num.toExponential(2)
    }
    return Number(num.toFixed(6)).toString()
  }

  function buildExternalAuthHeader(datasource: DatasourceItem): string {
    const username =
      datasource.config.log?.userName?.trim() || datasource.config.alert?.userName?.trim() || ''
    const password = datasource.config.log?.password ?? datasource.config.alert?.password ?? ''
    if (!username && !password) return ''
    return `Basic ${btoa(`${username}:${password}`)}`
  }

  function applyExternalDatasourceHeaders(
    target: Record<string, string>,
    headers: DatasourceHeader[] | undefined
  ) {
    for (const header of headers ?? []) {
      const key = header.key.trim()
      if (!key) continue
      target[key] = header.value
    }
  }

  function getExternalProxyHeaders(datasource: DatasourceItem): Record<string, string> {
    const headers: Record<string, string> = {}
    const authHeader = buildExternalAuthHeader(datasource)
    if (authHeader) {
      headers['X-Pixiu-Proxy-Authorization'] = authHeader
    }
    applyExternalDatasourceHeaders(headers, datasource.config.headers)
    return headers
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

  async function runPreview() {
    if (!props.datasource) {
      error.value = '请先选择告警数据源'
      return
    }
    if (!composedQuery.value) {
      error.value = '请填写 PromQL 与告警条件'
      return
    }

    const dsUrl = resolveDatasourceUrl(props.datasource)
    if (!dsUrl) {
      error.value = '数据源地址无效'
      return
    }
    if (!props.datasource.external && !props.datasource.clusterName) {
      error.value = '内部数据源缺少关联集群'
      return
    }

    loading.value = true
    error.value = ''
    result.value = null
    const t0 = performance.now()
    try {
      const res = await fetchPrometheusInstantQuery(
        dsUrl,
        composedQuery.value,
        Math.floor(Date.now() / 1000),
        buildPrometheusRequestOptions(props.datasource)
      )
      durationMs.value = Math.round(performance.now() - t0)
      if (res.status === 'success') {
        result.value = res.data
      } else {
        error.value = res.error || '查询失败'
      }
    } catch (e) {
      durationMs.value = Math.round(performance.now() - t0)
      const msg = e instanceof Error ? e.message : '请求异常'
      error.value = msg
      ElMessage.error(msg)
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped lang="scss">
  .metric-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 180px;
    margin-top: -20px;
  }

  .metric-preview__expr {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .metric-preview__label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .metric-preview__code {
    display: block;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    font-size: 12px;
    line-height: 1.5;
    word-break: break-all;
    white-space: pre-wrap;
    color: var(--el-text-color-primary);
  }

  .metric-preview__hint,
  .metric-preview__summary {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .metric-preview__summary {
    display: flex;
    gap: 16px;
  }

  .metric-preview__loading {
    min-height: 160px;
  }

  .metric-preview__table {
    width: 100%;

    :deep(.el-table__body-wrapper) {
      overflow-y: auto;
    }
  }

  .metric-preview__metric {
    font-size: 12px;
    line-height: 1.4;
    word-break: break-all;
  }

  .metric-preview__metric-name {
    font-weight: 500;
  }

  .metric-preview__label-key {
    color: var(--el-color-primary);
  }

  .metric-preview__label-val {
    color: var(--el-color-success);
  }
</style>
