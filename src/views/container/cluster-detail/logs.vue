<template>
  <div
    class="logs-console art-table-card"
    :class="{ 'logs-console--placeholder': isPlaceholderState }"
  >
    <div v-if="!detectResolved" class="logs-loading-state">
      <div class="logs-loading-card" v-loading="true" element-loading-text="正在加载日志数据源..." />
    </div>

    <div v-else-if="!hasConfiguredDatasource" class="logs-unavailable-state">
      <el-icon class="logs-unavailable-icon" :size="48">
        <Document />
      </el-icon>
      <div class="logs-unavailable-title">暂未开启</div>
      <div class="logs-unavailable-desc">当前集群暂未开启日志功能，您可前往数据源页面开启</div>
      <ElButton type="primary" size="small" class="logs-unavailable-btn" @click="goToDatasource">
        前往开启
      </ElButton>
    </div>

    <template v-else>
      <section class="logs-console__top-card">
        <div class="logs-console__rule-bar">
        <div class="logs-console__rule-main">
          <div class="logs-console__rule-left">
            <slot name="before-datasource" />
            <span class="logs-console__rule-label">数据源</span>
            <ElSelect
              v-model="selectedDatasourceId"
              placeholder="请选择数据源"
              class="logs-console__rule-select"
              :loading="datasourceLoading"
            >
              <template #label="{ value }">
                <span
                  v-if="value && getDatasourceById(Number(value))"
                  class="logs-console__datasource-option"
                >
                  <span
                    class="logs-console__datasource-logo"
                    :class="`is-${getDatasourceById(Number(value))?.subType}`"
                  >
                    <ArtSvgIcon
                      :icon="subTypeMeta[getDatasourceById(Number(value))!.subType].icon"
                      class="logs-console__datasource-logo-icon"
                    />
                  </span>
                  <span class="logs-console__datasource-name">
                    {{ getDatasourceById(Number(value))?.name }}
                  </span>
                </span>
              </template>
              <ElOption
                v-for="item in datasourceOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              >
                <span class="logs-console__datasource-option">
                  <span class="logs-console__datasource-logo" :class="`is-${item.subType}`">
                    <ArtSvgIcon
                      :icon="subTypeMeta[item.subType].icon"
                      class="logs-console__datasource-logo-icon"
                    />
                  </span>
                  <span class="logs-console__datasource-name">{{ item.name }}</span>
                </span>
              </ElOption>
            </ElSelect>
          </div>
          <ElButton link type="primary" class="logs-console__external-link" disabled>
            在日志服务中查看更多
            <ElIcon class="logs-console__external-link-icon"><Link /></ElIcon>
          </ElButton>
        </div>
        <div class="logs-console__query-toolbar">
          <div class="logs-console__query-toolbar-left">
            <span class="logs-console__query-mode">语句模式</span>
            <ElButton text size="small" disabled>收藏夹</ElButton>
            <ElButton text size="small" disabled>历史记录</ElButton>
            <ElButton text size="small" disabled>语句模板</ElButton>
          </div>
          <div class="logs-console__query-toolbar-right">
            <ElButton text size="small" disabled>推荐仪表盘</ElButton>
            <span class="logs-console__hot-tag">HOT</span>
            <ElButton text size="small" disabled>告警</ElButton>
            <ElButton text size="small" disabled>采集配置</ElButton>
            <ElButton text size="small" disabled>索引配置</ElButton>
            <ElButton text size="small" disabled>更多</ElButton>
          </div>
        </div>
        <div class="logs-console__query-body">
          <ElInput
            v-model="queryDraft"
            :placeholder="queryDraftPlaceholder"
            class="logs-query-input"
            clearable
            @input="handleQueryDraftInput"
            @keyup.enter="loadLogs"
          />
          <ElSelect v-model="timeRangeMinutes" class="logs-time-range">
            <ElOption :value="15" label="近15分钟" />
            <ElOption :value="60" label="近1小时" />
            <ElOption :value="360" label="近6小时" />
            <ElOption :value="1440" label="近24小时" />
          </ElSelect>
          <ElButton
            type="primary"
            class="logs-search-btn"
            :icon="Search"
            :loading="loading"
            :disabled="!canQuery"
            @click="loadLogs"
          >
            搜索
          </ElButton>
        </div>
        <div v-if="isLokiDatasource" class="logs-console__query-actions">
          <span v-if="isLokiDatasource" class="logs-console__query-link" @click="addFilter">添加条件</span>
          <span v-if="queryDirty" class="logs-console__query-link" @click="resetQueryDraft">恢复生成</span>
        </div>
        <div v-if="isLokiDatasource && filters.length" class="logs-filter-list">
          <div v-for="filter in filters" :key="filter.id" class="logs-filter-row">
            <ElSelect
              v-model="filter.key"
              placeholder="标签"
              class="logs-filter-key"
              filterable
              @change="onFilterKeyChange(filter)"
            >
              <ElOption v-for="item in labelKeys" :key="item" :label="item" :value="item" />
            </ElSelect>
            <ElSelect v-model="filter.operator" class="logs-filter-operator">
              <ElOption v-for="item in operatorOptions" :key="item" :label="item" :value="item" />
            </ElSelect>
            <ElSelect
              v-model="filter.value"
              placeholder="标签值"
              class="logs-filter-value"
              filterable
              allow-create
              default-first-option
              :loading="filter.loading"
              @visible-change="(visible) => visible && ensureFilterValues(filter)"
            >
              <ElOption
                v-for="item in filter.options"
                :key="`${filter.key}-${item}`"
                :label="item"
                :value="item"
              />
            </ElSelect>
            <span class="logs-console__query-link" @click="removeFilter(filter.id)">删除</span>
          </div>
        </div>
        </div>
      </section>

      <section
        class="logs-console__results"
        :class="{ 'is-fields-collapsed': isFieldsCollapsed }"
      >
        <div class="logs-console__results-tabs">
          <button
            type="button"
            class="logs-console__result-tab"
            :class="{ 'is-active': resultPanelTab === 'logs' }"
            @click="resultPanelTab = 'logs'"
          >
            原始日志
          </button>
          <button
            type="button"
            class="logs-console__result-tab"
            :class="{ 'is-active': resultPanelTab === 'chart' }"
            @click="resultPanelTab = 'chart'"
          >
            统计图表
          </button>
        </div>

        <div class="logs-console__results-body">
        <aside class="logs-console__fields" :class="{ 'is-collapsed': isFieldsCollapsed }">
          <div class="logs-console__fields-header">
            <div v-if="!isFieldsCollapsed" class="logs-console__fields-title">字段列表</div>
            <button
              type="button"
              class="logs-console__fields-toggle"
              :title="isFieldsCollapsed ? '展开字段列表' : '折叠字段列表'"
              @click="isFieldsCollapsed = !isFieldsCollapsed"
            >
              <ElIcon :size="16">
                <component :is="isFieldsCollapsed ? Expand : Fold" />
              </ElIcon>
            </button>
          </div>
          <template v-if="!isFieldsCollapsed">
          <ElInput
            v-model="fieldSearch"
            clearable
            placeholder="搜索字段"
            class="logs-console__fields-search"
          />
          <div class="logs-field-tree">
            <div
              v-for="field in filteredFieldKeys"
              :key="field"
              class="logs-field-node"
              :class="{ 'is-expanded': expandedFieldKey === field }"
            >
              <button type="button" class="logs-field-node__head" @click="toggleFieldExpand(field)">
                <ElIcon class="logs-field-node__arrow">
                  <CaretBottom v-if="expandedFieldKey === field" />
                  <CaretRight v-else />
                </ElIcon>
                <span class="logs-field-node__name" :title="field">{{ field }}</span>
                <span
                  v-if="getSelectedFieldValues(field).length"
                  class="logs-field-node__badge"
                >
                  {{ getSelectedFieldValues(field).length }}
                </span>
              </button>
              <div v-if="expandedFieldKey === field" class="logs-field-node__body">
                <ElInput
                  :model-value="getFieldValueSearch(field)"
                  placeholder="搜索值"
                  size="small"
                  clearable
                  class="logs-field-node__search"
                  @update:model-value="setFieldValueSearch(field, $event)"
                />
                <div class="logs-field-node__options">
                  <label
                    v-for="value in getFilteredFieldValues(field)"
                    :key="`${field}-${value}`"
                    class="logs-field-node__option"
                  >
                    <ElCheckbox
                      :model-value="isFieldValueSelected(field, value)"
                      @change="(checked: boolean) => toggleFieldValue(field, value, checked)"
                    />
                    <span class="logs-field-node__value" :title="value">{{ value }}</span>
                  </label>
                  <div v-if="!getFilteredFieldValues(field).length" class="logs-field-node__empty">
                    暂无值
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!filteredFieldKeys.length" class="logs-console__fields-empty">
              {{ logs.length ? '未匹配到字段' : '暂无字段' }}
            </div>
          </div>
          </template>
        </aside>

        <main class="logs-console__main">
          <div class="logs-console__main-header">
            <div class="logs-console__main-header-top">
              <span class="logs-console__count">
                日志条数 {{ displayLogs.length }}
                <span
                  v-if="hasActiveFieldFilters && displayLogs.length !== logs.length"
                  class="logs-console__count-filtered"
                >
                  / {{ logs.length }}
                </span>
              </span>
              <div class="logs-console__main-toolbar">
                <ElButton text size="small" disabled>添加到仪表盘</ElButton>
                <ElButton text size="small" disabled>添加告警策略</ElButton>
                <ElButton
                  text
                  size="small"
                  :icon="Download"
                  class="logs-console__download-btn"
                  :disabled="!displayLogs.length"
                  @click="downloadLogs"
                >
                  下载
                </ElButton>
              </div>
            </div>
            <div v-if="resultPanelTab === 'logs'" class="logs-trend-chart">
              <div v-if="showTrendChart" class="logs-trend-chart__panel">
                <button type="button" class="logs-trend-chart__toggle" @click="showTrendChart = false">
                  <ElIcon><Hide /></ElIcon>
                  隐藏图表
                </button>
                <div class="logs-trend-chart__plot">
                  <div class="logs-trend-chart__bars">
                    <div
                      v-for="item in trendChartData"
                      :key="item.key"
                      class="logs-trend-chart__bar-wrap"
                      :title="`${item.fullLabel}\n日志数量：${item.count}`"
                    >
                      <div
                        class="logs-trend-chart__bar"
                        :title="`${item.fullLabel}\n日志数量：${item.count}`"
                        :style="{
                          height: `${item.count ? Math.max(6, (item.count / maxTrendCount) * 100) : 0}%`
                        }"
                      />
                    </div>
                  </div>
                  <div class="logs-trend-chart__axis">
                    <span
                      v-for="item in trendChartData"
                      :key="`axis-${item.key}`"
                      class="logs-trend-chart__axis-label"
                      :title="item.showLabel ? item.fullLabel : ''"
                    >
                      {{ item.showLabel ? item.label : '' }}
                    </span>
                  </div>
                </div>
              </div>
              <button v-else type="button" class="logs-trend-chart__show" @click="showTrendChart = true">
                <ElIcon><View /></ElIcon>
                显示图表
              </button>
            </div>
            <div class="logs-console__view-mode">
              <div class="logs-console__view-mode-left">
                <div class="logs-view-segment">
                  <button
                    type="button"
                    class="logs-view-segment__item"
                    :class="{ 'is-active': resultViewMode === 'raw' }"
                    @click="resultViewMode = 'raw'"
                  >
                    原始
                  </button>
                  <button
                    type="button"
                    class="logs-view-segment__item"
                    :class="{ 'is-active': resultViewMode === 'table' }"
                    @click="resultViewMode = 'table'"
                  >
                    表格
                  </button>
                </div>
                <div class="logs-console__display-options">
                  <label class="logs-console__display-check">
                    <ElCheckbox v-model="wordWrap" />换行
                  </label>
                  <label class="logs-console__display-check">
                    <ElCheckbox v-model="showLineNumber" />行号
                  </label>
                  <label class="logs-console__display-check">
                    <ElCheckbox v-model="showLogTime" />日志时间
                  </label>
                </div>
              </div>
              <div v-if="resultViewMode === 'table'" class="logs-console__column-settings">
                <ElPopover placement="bottom-end" trigger="click" :width="156" popper-class="logs-column-settings-popper">
                  <template #reference>
                    <button type="button" class="logs-column-settings__trigger">
                      <ElIcon><Setting /></ElIcon>
                      显示列
                    </button>
                  </template>
                  <div class="logs-column-settings__panel">
                    <div
                      v-for="column in tableColumnOptions"
                      :key="column.key"
                      class="logs-column-settings__row"
                    >
                      <span>{{ column.label }}</span>
                      <ElSwitch v-model="tableColumnVisibility[column.key]" size="small" />
                    </div>
                  </div>
                </ElPopover>
              </div>
            </div>
          </div>

          <div v-if="resultPanelTab === 'chart'" class="logs-console__chart-panel">
            <div v-if="displayLogs.length" class="logs-trend-chart__panel is-large">
              <div class="logs-trend-chart__plot">
                <div class="logs-trend-chart__bars">
                  <div
                    v-for="item in trendChartData"
                    :key="`chart-${item.key}`"
                    class="logs-trend-chart__bar-wrap"
                    :title="`${item.label}: ${item.count}`"
                  >
                    <div
                      class="logs-trend-chart__bar"
                      :style="{
                        height: `${item.count ? Math.max(8, (item.count / maxTrendCount) * 100) : 0}%`
                      }"
                    />
                  </div>
                </div>
                <div class="logs-trend-chart__axis">
                  <span
                    v-for="item in trendChartData"
                    :key="`chart-axis-${item.key}`"
                    class="logs-trend-chart__axis-label"
                    :title="item.showLabel ? item.fullLabel : ''"
                  >
                    {{ item.showLabel ? item.label : '' }}
                  </span>
                </div>
              </div>
            </div>
            <ElEmpty v-else description="暂无统计数据，请先搜索日志" />
          </div>

          <template v-else>
            <div v-loading="loading" class="logs-console__content">
              <div v-if="resultViewMode === 'raw'" class="logs-raw-list">
                <div
                  v-for="(row, index) in displayLogs"
                  :key="row.id"
                  class="logs-raw-line"
                  :class="{ 'is-wrap': wordWrap }"
                >
                  <span v-if="showLineNumber" class="logs-raw-line__no">{{ index + 1 }}</span>
                  <span v-if="showLogTime" class="logs-raw-line__time">{{ row.time }}</span>
                  <span class="logs-raw-line__pod" :title="row.pod">{{ row.pod }}</span>
                  <span class="logs-raw-line__msg">{{ row.msg }}</span>
                </div>
                <div v-if="!displayLogs.length" class="logs-empty">{{ emptyText }}</div>
              </div>

              <ElTable
                v-else
                :data="displayLogs"
                :row-key="getLogRowKey"
                :expand-row-keys="expandedRowKeys"
                size="small"
                class="logs-table"
                :class="{ 'is-wrap': wordWrap }"
                @expand-change="handleExpandChange"
              >
                <template #empty>
                  <div class="logs-empty">{{ emptyText }}</div>
                </template>
                <ElTableColumn type="expand" width="44">
                  <template #default="{ row }">
                    <div class="logs-inline-detail">
                      <div class="logs-inline-detail__panel">
                        <div class="logs-inline-detail__panel-head">
                          <span class="logs-inline-detail__panel-title">字段</span>
                          <span class="logs-inline-detail__panel-count">
                            {{ getLogFieldEntries(row as LogTableRow).length }} 项
                          </span>
                        </div>
                        <div class="logs-field-grid">
                          <div
                            v-for="item in getLogFieldEntries(row as LogTableRow)"
                            :key="`${(row as LogTableRow).id}-${item.key}`"
                            class="logs-field-row"
                          >
                            <span class="logs-field-row__key">{{ item.key }}</span>
                            <span
                              class="logs-field-row__value"
                              :class="getFieldValueClass(item)"
                            >
                              {{ item.value }}
                            </span>
                            <button
                              type="button"
                              class="logs-field-row__copy"
                              title="复制"
                              @click="copyFieldValue(item.value)"
                            >
                              <ElIcon><DocumentCopy /></ElIcon>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="logs-inline-detail__panel">
                        <div class="logs-inline-detail__panel-head">
                          <span class="logs-inline-detail__panel-title">日志内容</span>
                          <button
                            type="button"
                            class="logs-inline-detail__copy-btn"
                            @click="copyFieldValue((row as LogTableRow).raw)"
                          >
                            <ElIcon><DocumentCopy /></ElIcon>
                            复制
                          </button>
                        </div>
                        <pre class="logs-inline-detail__code">{{ (row as LogTableRow).raw }}</pre>
                      </div>
                    </div>
                  </template>
                </ElTableColumn>
                <ElTableColumn v-if="tableColumnVisibility.time" prop="time" label="时间" width="190" show-overflow-tooltip />
                <ElTableColumn v-if="tableColumnVisibility.ns" prop="ns" label="命名空间" width="140" show-overflow-tooltip />
                <ElTableColumn v-if="tableColumnVisibility.pod" prop="pod" label="Pod" min-width="220" show-overflow-tooltip />
                <ElTableColumn
                  v-if="tableColumnVisibility.container"
                  prop="container"
                  label="容器"
                  width="180"
                  show-overflow-tooltip
                />
                <ElTableColumn v-if="tableColumnVisibility.msg" prop="msg" label="内容" min-width="420" show-overflow-tooltip />
                <ElTableColumn label="操作" width="90" fixed="right">
                  <template #default="{ row }">
                    <ElButton link type="primary" @click="toggleLogDetail(row as LogTableRow)">
                      {{ isExpanded(row as LogTableRow) ? '收起' : '详情' }}
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </div>
          </template>
        </main>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import {
    Search,
    Document,
    DocumentCopy,
    Download,
    Link,
    Fold,
    Expand,
    Hide,
    View,
    CaretRight,
    CaretBottom,
    Setting
  } from '@element-plus/icons-vue'
  import {
    fetchDatasourceList,
    resolveDatasourceUrl,
    type DatasourceItem,
    type DatasourceSubType
  } from '@/api/datasource'
  import { PixiuApiError } from '@/api/container'
  import { buildUpstreamBasicAuthorizationHeader, kubeProxyAxios } from '@/api/kubeProxy'
  import { fetchK8sService, fetchK8sServiceList, type K8sService } from '@/api/kubernetes/service'
  import { clusterDetailContextKey } from './context'

  const router = useRouter()

  defineOptions({ name: 'ClusterDetailLogs' })

  const props = withDefaults(
    defineProps<{
      /** 监控页：占位态使用紧凑卡片 */
      compactPlaceholder?: boolean
    }>(),
    {
      compactPlaceholder: false
    }
  )
  const emit = defineEmits<{
    datasourceStateChange: [hasConfiguredDatasource: boolean]
  }>()

  type ParsedDatasourceEndpoint = {
    serviceName: string
    namespace?: string
    host: string
    port: number
    protocol: 'http' | 'https'
    basePath: string
  }

  type LokiLabelOperator = '=' | '!=' | '=~' | '!~'

  interface LokiQueryRangeResponse {
    status?: string
    data?: {
      result?: Array<{
        stream?: Record<string, string>
        values?: Array<[string, string]>
      }>
    }
    error?: string
  }

  interface EsSearchHit {
    _id?: string
    _index?: string
    _source?: Record<string, unknown>
    sort?: Array<string | number>
    fields?: Record<string, unknown[]>
  }

  interface EsSearchResponse {
    hits?: {
      hits?: EsSearchHit[]
    }
    error?: {
      reason?: string
      root_cause?: Array<{ reason?: string }>
    }
  }

  interface LogTableRow {
    id: string
    time: string
    timestampMs: number | null
    ns: string
    pod: string
    container: string
    level: string
    msg: string
    raw: string
    labels: Record<string, string>
  }

  interface FilterRow {
    id: number
    key: string
    operator: LokiLabelOperator
    value: string
    options: string[]
    loading: boolean
  }

  const ctxRef = inject(clusterDetailContextKey)!
  const resultPanelTab = ref<'logs' | 'chart'>('logs')
  const resultViewMode = ref<'raw' | 'table'>('raw')
  const fieldSearch = ref('')
  const expandedFieldKey = ref('')
  const fieldValueSearchMap = ref<Record<string, string>>({})
  const selectedFieldFilters = ref<Record<string, string[]>>({})
  const isFieldsCollapsed = ref(false)
  const showLineNumber = ref(true)
  const showLogTime = ref(true)
  const wordWrap = ref(true)
  const showTrendChart = ref(true)

  type TableColumnKey = 'time' | 'ns' | 'pod' | 'container' | 'msg'

  const tableColumnOptions: Array<{ key: TableColumnKey; label: string }> = [
    { key: 'time', label: '时间' },
    { key: 'pod', label: 'POD' },
    { key: 'ns', label: '命名空间' },
    { key: 'container', label: '容器' },
    { key: 'msg', label: '内容' }
  ]

  const tableColumnVisibility = ref<Record<TableColumnKey, boolean>>({
    time: true,
    ns: true,
    pod: true,
    container: false,
    msg: true
  })

  const operatorOptions: LokiLabelOperator[] = ['=', '!=', '=~', '!~']
  const subTypeMeta: Record<DatasourceSubType, { label: string; icon: string }> = {
    loki: { label: 'Loki', icon: 'simple-icons:grafana' },
    es: { label: 'Elasticsearch', icon: 'simple-icons:elasticsearch' },
    prometheus: { label: 'Prometheus', icon: 'simple-icons:prometheus' }
  }

  const datasourceLoading = ref(false)
  const resolving = ref(false)
  const loading = ref(false)
  const detectResolved = ref(false)
  const errorMessage = ref('')

  const datasourceOptions = ref<DatasourceItem[]>([])
  const selectedDatasourceId = ref<number>()
  const timeRangeMinutes = ref(15)
  const lineLimit = ref(200)
  const keyword = ref('')
  const queryDraft = ref('')
  const queryDirty = ref(false)

  const resolvedService = ref<K8sService | null>(null)
  const resolvedServiceNamespace = ref('')
  const resolvedEndpoint = ref<ParsedDatasourceEndpoint | null>(null)

  const labelKeys = ref<string[]>([])
  const filters = ref<FilterRow[]>([])
  const filterSeed = ref(1)
  const labelValueCache = ref<Record<string, string[]>>({})

  const logs = ref<LogTableRow[]>([])
  const queryTimeRange = ref<{ start: number; end: number } | null>(null)
  const expandedRowKeys = ref<string[]>([])

  const currentCluster = computed(() => ctxRef.value.name)
  const selectedDatasource = computed(
    () => datasourceOptions.value.find((item) => item.id === selectedDatasourceId.value) ?? null
  )
  const isLokiDatasource = computed(() => selectedDatasource.value?.subType === 'loki')
  const isEsDatasource = computed(() => selectedDatasource.value?.subType === 'es')
  const filteredFieldKeys = computed(() => {
    const kw = fieldSearch.value.trim().toLowerCase()
    const keys = availableFieldKeys.value
    if (!kw) return keys
    return keys.filter((item) => item.toLowerCase().includes(kw))
  })
  const hasActiveFieldFilters = computed(() =>
    Object.values(selectedFieldFilters.value).some((values) => values.length > 0)
  )
  const displayLogs = computed(() => {
    const activeFilters = Object.entries(selectedFieldFilters.value).filter(
      ([, values]) => values.length > 0
    )
    if (!activeFilters.length) return logs.value

    return logs.value.filter((row) =>
      activeFilters.every(([field, values]) => values.includes(row.labels[field] ?? ''))
    )
  })
  const availableFieldKeys = computed(() => {
    const keys = new Set<string>()
    labelKeys.value.forEach((item) => keys.add(item))
    logs.value.forEach((row) => {
      Object.keys(row.labels).forEach((key) => keys.add(key))
    })
    return Array.from(keys).sort((a, b) => a.localeCompare(b))
  })
  const trendBucketCount = computed(() => {
    const minutes = timeRangeMinutes.value
    const seconds = minutes * 60
    // 按时间跨度自动计算桶数（约为原先 2 倍），每桶对应固定时间粒度
    let intervalSeconds: number
    if (minutes <= 15) intervalSeconds = 30
    else if (minutes <= 60) intervalSeconds = 150
    else if (minutes <= 360) intervalSeconds = 600
    else intervalSeconds = 1800
    return Math.max(2, Math.ceil(seconds / intervalSeconds))
  })
  const trendChartData = computed(() => {
    const bucketCount = trendBucketCount.value
    const rangeMinutes = timeRangeMinutes.value

    const logTimestamps = displayLogs.value
      .map((row) => row.timestampMs ?? parseLogTime(row.time))
      .filter((value): value is number => value != null)

    let start: number
    let end: number

    if (logTimestamps.length > 0) {
      start = Math.min(...logTimestamps)
      end = Math.max(...logTimestamps)
      const padding = Math.max(1000, (end - start) * 0.05)
      start -= padding
      end += padding
    } else {
      end = queryTimeRange.value?.end ?? Date.now()
      start = queryTimeRange.value?.start ?? end - rangeMinutes * 60 * 1000
    }

    const rangeMs = end - start
    if (rangeMs <= 0) return []

    const bucketMs = rangeMs / bucketCount
    const labelStep = getTrendAxisLabelStep(bucketCount, rangeMinutes)

    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = start + index * bucketMs
      return {
        key: `${bucketStart}-${index}`,
        label: formatTrendAxisLabel(bucketStart, rangeMinutes),
        fullLabel: formatDateTime(bucketStart),
        showLabel: shouldShowTrendAxisLabel(index, bucketCount, labelStep),
        count: 0
      }
    })

    for (const row of displayLogs.value) {
      const timestamp = row.timestampMs ?? parseLogTime(row.time)
      if (timestamp == null) continue
      const index = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor(((timestamp - start) / rangeMs) * bucketCount))
      )
      buckets[index].count += 1
    }

    return buckets
  })
  const maxTrendCount = computed(() => Math.max(...trendChartData.value.map((item) => item.count), 1))
  const queryDraftPlaceholder = computed(() =>
    isLokiDatasource.value
      ? '支持手写 LogQL，例如 {namespace="default"} |= "error"'
      : '支持 Lucene query_string，例如 kubernetes.namespace_name:"default" AND error'
  )
  const generatedQuery = computed(() => {
    if (isEsDatasource.value) {
      return keyword.value.trim()
    }

    const selectorParts = filters.value
      .map((item) => ({
        key: item.key.trim(),
        operator: item.operator,
        value: item.value.trim()
      }))
      .filter((item) => item.key && item.value)
      .map(
        (item) =>
          `${item.key}${item.operator}"${item.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      )

    const selector = selectorParts.length ? `{${selectorParts.join(', ')}}` : '{namespace=~".+"}'
    const text = keyword.value.trim()
    return text ? `${selector} |= "${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : selector
  })

  const effectiveQuery = computed(() => {
    const query = queryDirty.value ? queryDraft.value.trim() : generatedQuery.value
    if (isEsDatasource.value && !query) return '*'
    return query
  })
  const canQuery = computed(() => Boolean(selectedDatasource.value) && Boolean(effectiveQuery.value.trim()))
  const hasConfiguredDatasource = computed(() => datasourceOptions.value.length > 0)
  const isPlaceholderState = computed(() => {
    if (!props.compactPlaceholder) return false
    return !detectResolved.value || !hasConfiguredDatasource.value
  })
  const emptyText = computed(() => {
    if (!effectiveQuery.value) {
      return isEsDatasource.value ? '请输入 ES 查询语句' : '请输入 LogQL 查询语句'
    }
    if (loading.value) return '加载日志中...'
    return '暂无日志'
  })

  function syncQueryDraftFromDatasource() {
    if (queryDirty.value) return
    queryDraft.value = isEsDatasource.value ? '' : generatedQuery.value
  }

  function syncGeneratedQuery() {
    syncQueryDraftFromDatasource()
  }

  function handleQueryDraftInput() {
    queryDirty.value = queryDraft.value.trim() !== generatedQuery.value
  }

  function resetQueryDraft() {
    queryDraft.value = isEsDatasource.value ? '' : generatedQuery.value
    queryDirty.value = false
  }

  function resetFieldPanelState() {
    expandedFieldKey.value = ''
    fieldValueSearchMap.value = {}
    selectedFieldFilters.value = {}
  }

  function toggleFieldExpand(field: string) {
    expandedFieldKey.value = expandedFieldKey.value === field ? '' : field
  }

  function getFieldValueSearch(field: string) {
    return fieldValueSearchMap.value[field] ?? ''
  }

  function setFieldValueSearch(field: string, value: string) {
    fieldValueSearchMap.value = {
      ...fieldValueSearchMap.value,
      [field]: value
    }
  }

  function getFieldValues(field: string) {
    const values = new Set<string>()
    for (const row of logs.value) {
      const value = row.labels[field]
      if (value != null && value !== '') values.add(value)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }

  function getFilteredFieldValues(field: string) {
    const search = getFieldValueSearch(field).trim().toLowerCase()
    const values = getFieldValues(field)
    if (!search) return values
    return values.filter((item) => item.toLowerCase().includes(search))
  }

  function getSelectedFieldValues(field: string) {
    return selectedFieldFilters.value[field] ?? []
  }

  function isFieldValueSelected(field: string, value: string) {
    return getSelectedFieldValues(field).includes(value)
  }

  function toggleFieldValue(field: string, value: string, checked: boolean) {
    const current = [...getSelectedFieldValues(field)]
    if (checked) {
      if (!current.includes(value)) current.push(value)
    } else {
      const index = current.indexOf(value)
      if (index >= 0) current.splice(index, 1)
    }
    selectedFieldFilters.value = {
      ...selectedFieldFilters.value,
      [field]: current
    }
  }

  function addFieldFilter(key: string) {
    if (!isLokiDatasource.value) return
    if (filters.value.some((item) => item.key === key)) return
    filters.value.push({
      id: filterSeed.value++,
      key,
      operator: '=',
      value: '',
      options: [],
      loading: false
    })
    syncGeneratedQuery()
  }

  function addFilter() {
    filters.value.push({
      id: filterSeed.value++,
      key: '',
      operator: '=',
      value: '',
      options: [],
      loading: false
    })
    syncGeneratedQuery()
  }

  function removeFilter(id: number) {
    filters.value = filters.value.filter((item) => item.id !== id)
    syncGeneratedQuery()
  }

  function getDatasourceById(id: number) {
    return datasourceOptions.value.find((item) => item.id === id) ?? null
  }

  function onFilterKeyChange(filter: FilterRow) {
    filter.value = ''
    filter.options = []
    syncGeneratedQuery()
    void ensureFilterValues(filter)
  }

  function isIPAddress(hostname: string): boolean {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true
    if (hostname.includes(':') && !hostname.includes('.')) return true
    return false
  }

  function normalizeBasePath(pathname: string): string {
    const normalized = pathname.trim().replace(/\/+$/, '')
    if (!normalized || normalized === '/') return ''
    return normalized.startsWith('/') ? normalized : `/${normalized}`
  }

  function parseDatasourceEndpoint(rawUrl: string): ParsedDatasourceEndpoint | null {
    if (!rawUrl) return null
    try {
      const parsed = new URL(rawUrl)
      if (isIPAddress(parsed.hostname)) return null
      const protocol =
        parsed.protocol === 'https:' ? 'https' : parsed.protocol === 'http:' ? 'http' : null
      if (!protocol) return null
      const parts = parsed.hostname.split('.').filter(Boolean)
      if (!parts.length) return null
      const svcIndex = parts.indexOf('svc')
      const namespace =
        svcIndex >= 2 ? parts[1] : svcIndex === -1 && parts.length >= 2 ? parts[1] : ''
      const port =
        parsed.port && Number.parseInt(parsed.port, 10) > 0
          ? Number.parseInt(parsed.port, 10)
          : protocol === 'https'
            ? 443
            : 80
      return {
        serviceName: parts[0] ?? '',
        namespace,
        host: parsed.hostname,
        port,
        protocol,
        basePath: normalizeBasePath(parsed.pathname)
      }
    } catch {
      return null
    }
  }

  function serviceProxyBase(path: string): string {
    const endpoint = resolvedEndpoint.value
    const service = resolvedService.value?.metadata?.name
    const namespace = resolvedServiceNamespace.value
    if (!endpoint || !service || !namespace) return ''
    const requestPath = path.startsWith('/') ? path : `/${path}`
    return (
      `/pixiu/proxy/${encodeURIComponent(currentCluster.value)}/api/v1/namespaces/${encodeURIComponent(namespace)}` +
      `/services/${encodeURIComponent(service)}:${endpoint.port}/proxy${endpoint.basePath}${requestPath}`
    )
  }

  async function loadDatasources() {
    datasourceLoading.value = true
    try {
      const { items } = await fetchDatasourceList({ 
        page: 1, 
        limit: 200,
        clusterName: currentCluster.value,
        type: 0
      })
      datasourceOptions.value = items.filter(
        (item) => (item.subType === 'loki' || item.subType === 'es')
      )
      if (datasourceOptions.value.length > 0) {
        selectedDatasourceId.value =
          datasourceOptions.value.find((item) => item.isDefault)?.id ?? datasourceOptions.value[0]?.id
      } else {
        selectedDatasourceId.value = undefined
        errorMessage.value = ''
        resolvedService.value = null
        resolvedServiceNamespace.value = ''
        resolvedEndpoint.value = null
        labelKeys.value = []
        labelValueCache.value = {}
        logs.value = []
        expandedRowKeys.value = []
      }
      syncQueryDraftFromDatasource()
    } finally {
      datasourceLoading.value = false
    }
  }

  async function resolveServiceByEndpoint(endpoint: ParsedDatasourceEndpoint, skipErrorNotification = false): Promise<{
    service: K8sService
    namespace: string
  }> {
    if (endpoint.namespace) {
      return {
        service: await fetchK8sService(
          currentCluster.value,
          endpoint.namespace,
          endpoint.serviceName,
          skipErrorNotification
        ),
        namespace: endpoint.namespace
      }
    }

    const { items } = await fetchK8sServiceList(currentCluster.value, { 
      page: 1, 
      limit: 999999, 
      skipErrorNotification 
    })
    const matchedItems = items.filter((item) => item.metadata?.name === endpoint.serviceName)
    if (matchedItems.length > 1) {
      const names = matchedItems
        .map((item) => `${item.metadata?.name}.${item.metadata?.namespace ?? 'default'}`)
        .join(', ')
      throw new Error(`发现多个同名 Service，请在 URL 中带上命名空间。候选: ${names}`)
    }
    const matched = matchedItems[0]
    const namespace = matched?.metadata?.namespace ?? ''
    if (!matched || !namespace) {
      throw new Error(`未找到 Service ${endpoint.host}`)
    }
    return { service: matched, namespace }
  }

  async function loadLabelKeys() {
    const url = serviceProxyBase('/loki/api/v1/labels')
    if (!url) return
    const nowNs = Date.now() * 1_000_000
    const startNs = nowNs - timeRangeMinutes.value * 60 * 1_000_000_000
    const { data } = await kubeProxyAxios.get<{ status?: string; data?: string[]; error?: string }>(
      url,
      {
        params: {
          start: String(startNs),
          end: String(nowNs)
        }
      }
    )
    if (data?.status !== 'success') throw new Error(data?.error || '加载标签失败')
    labelKeys.value = (data.data ?? []).filter(Boolean).sort()
  }

  async function ensureFilterValues(filter: FilterRow) {
    const key = filter.key.trim()
    if (!key || !isLokiDatasource.value) return
    if (labelValueCache.value[key]) {
      filter.options = labelValueCache.value[key]
      return
    }
    if (!(await ensureServiceResolved(true))) return

    const url = serviceProxyBase(`/loki/api/v1/label/${encodeURIComponent(key)}/values`)
    if (!url) return
    const nowNs = Date.now() * 1_000_000
    const startNs = nowNs - timeRangeMinutes.value * 60 * 1_000_000_000
    filter.loading = true
    try {
      const { data } = await kubeProxyAxios.get<{
        status?: string
        data?: string[]
        error?: string
      }>(url, {
        params: {
          start: String(startNs),
          end: String(nowNs)
        }
      })
      if (data?.status !== 'success') throw new Error(data?.error || '加载标签值失败')
      const values = (data.data ?? []).filter(Boolean).sort()
      labelValueCache.value[key] = values
      filter.options = values
    } finally {
      filter.loading = false
    }
  }

  async function resolveServiceContext(
    skipErrorNotification = false,
    options: { resetState?: boolean } = {}
  ) {
    const { resetState = true } = options
    if (datasourceOptions.value.length === 0) return

    const datasource = selectedDatasource.value
    const rawUrl = datasource ? resolveDatasourceUrl(datasource) : ''

    if (resetState) {
      errorMessage.value = ''
      resolvedService.value = null
      resolvedServiceNamespace.value = ''
      resolvedEndpoint.value = null
      labelKeys.value = []
      labelValueCache.value = {}
      logs.value = []
      expandedRowKeys.value = []
    }

    if (!datasource) return
    if (!rawUrl) {
      errorMessage.value = '当前数据源未配置 config.log.url'
      return
    }

    const endpoint = parseDatasourceEndpoint(rawUrl)
    if (!endpoint?.serviceName) {
      errorMessage.value = '数据源 URL 不是合法的集群内 HTTP 地址'
      return
    }

    resolving.value = true
    try {
      const { service, namespace } = await resolveServiceByEndpoint(endpoint, skipErrorNotification)
      resolvedService.value = service
      resolvedServiceNamespace.value = namespace
      resolvedEndpoint.value = endpoint
      if (isLokiDatasource.value) {
        await loadLabelKeys()
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '解析日志 Service 失败'
      // 不显示 service not found 类型的错误信息
      if (!errorMsg.toLowerCase().includes('not found') && !errorMsg.toLowerCase().includes('services')) {
        errorMessage.value = errorMsg
      }
    } finally {
      resolving.value = false
    }
  }

  async function ensureServiceResolved(skipErrorNotification = false): Promise<boolean> {
    if (resolvedService.value && resolvedEndpoint.value) return true
    await resolveServiceContext(skipErrorNotification, { resetState: false })
    return Boolean(resolvedEndpoint.value)
  }

  async function refreshContext(skipErrorNotification = false, resolveService = false) {
    detectResolved.value = false
    await loadDatasources()
    if (resolveService && datasourceOptions.value.length > 0 && selectedDatasource.value) {
      await resolveServiceContext(skipErrorNotification)
    } else {
      errorMessage.value = ''
      resolvedService.value = null
      resolvedServiceNamespace.value = ''
      resolvedEndpoint.value = null
      labelKeys.value = []
      labelValueCache.value = {}
      logs.value = []
      expandedRowKeys.value = []
    }
    detectResolved.value = true
  }

  function goToDatasource() {
    router.push('/monitor/datasource')
  }

  function formatNsTimestamp(ns: string): string {
    const numeric = Number.parseInt(ns, 10)
    if (!Number.isFinite(numeric)) return ns
    const ms = Math.floor(numeric / 1_000_000)
    return formatDateTime(ms)
  }

  function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return String(timestamp)
    const pad = (value: number, size = 2) => String(value).padStart(size, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  }

  function formatTrendAxisLabel(timestamp: number, rangeMinutes: number): string {
    const date = new Date(timestamp)
    const pad = (value: number, size = 2) => String(value).padStart(size, '0')
    if (rangeMinutes <= 60) {
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }
    if (rangeMinutes <= 1440) {
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function getTrendAxisLabelStep(bucketCount: number, rangeMinutes: number): number {
    const maxLabels =
      rangeMinutes >= 1440 ? 7 : rangeMinutes >= 360 ? 9 : rangeMinutes >= 60 ? 10 : 12
    if (bucketCount <= maxLabels) return 1
    return Math.ceil(bucketCount / maxLabels)
  }

  function shouldShowTrendAxisLabel(index: number, bucketCount: number, step: number): boolean {
    if (index === 0 || index === bucketCount - 1) return true
    return index % step === 0
  }

  function parseLogTime(text: string): number | null {
    if (!text || text === '-') return null
    return parseTimestampToMs(text)
  }

  function parseTimestampToMs(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null

    let ms: number | null = null

    if (typeof value === 'number' && Number.isFinite(value)) {
      ms = value > 1_000_000_000_000 ? value : value * 1000
    } else if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return null
      const asNumber = Number(trimmed)
      if (Number.isFinite(asNumber)) {
        ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000
      } else {
        const spaceMatch = trimmed.match(
          /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-]\d{2}:?\d{2})?$/
        )
        if (spaceMatch) {
          const [, date, hour, minute, second, fraction = '0'] = spaceMatch
          const millisecond = fraction.padEnd(3, '0').slice(0, 3)
          const parsed = new Date(`${date}T${hour}:${minute}:${second}.${millisecond}`)
          if (!Number.isNaN(parsed.getTime())) ms = parsed.getTime()
        } else {
          const parsed = new Date(trimmed)
          if (!Number.isNaN(parsed.getTime())) ms = parsed.getTime()
        }
      }
    }

    return isValidTimestampMs(ms) ? ms : null
  }

  function isValidTimestampMs(value: number | null): value is number {
    if (value == null || !Number.isFinite(value)) return false
    // 过滤 ES 缺失字段时 sort 返回的 Long.MIN_VALUE 等哨兵值
    return value >= 946684800000 && value <= 4102444800000
  }

  function resolveEsTimestampMs(
    source: Record<string, unknown>,
    sort?: Array<string | number>,
    fields?: Record<string, unknown[]>
  ): number | null {
    if (fields) {
      for (const key of ['time', '@timestamp', 'timestamp']) {
        const values = fields[key]
        if (!Array.isArray(values) || !values.length) continue
        const ms = parseTimestampToMs(values[0])
        if (ms != null) return ms
      }
    }

    if (sort?.length) {
      for (const item of sort) {
        const ms = parseTimestampToMs(item)
        if (ms != null) return ms
      }
    }

    return parseTimestampToMs(
      getFirstValue(source, [
        'time',
        '@timestamp',
        'timestamp',
        'state.timestamp',
        'log.time',
        'date',
        'datetime',
        'event.created',
        'log.timestamp'
      ])
    )
  }

  function parseRequestError(error: unknown): string {
    if (typeof error === 'string') return error
    if (error && typeof error === 'object') {
      const axiosLike = error as { message?: string; response?: { data?: unknown } }
      const data = axiosLike.response?.data
      if (typeof data === 'string') return data || axiosLike.message || '请求失败'
      if (data && typeof data === 'object') {
        const payload = data as {
          message?: string
          error?: string
          reason?: string
          root_cause?: Array<{ reason?: string }>
        }
        return (
          payload.error ||
          payload.reason ||
          payload.root_cause?.[0]?.reason ||
          payload.message ||
          axiosLike.message ||
          '请求失败'
        )
      }
      if (axiosLike.message) return axiosLike.message
    }
    return '请求失败'
  }

  function getEsRequestHeaders(): Record<string, string> | undefined {
    const username = selectedDatasource.value?.config.log?.userName?.trim() ?? ''
    const password = selectedDatasource.value?.config.log?.password ?? ''
    if (!username && !password) {
      return undefined
    }
    return buildUpstreamBasicAuthorizationHeader(username, password)
  }

  async function loadLogs() {
    if (!canQuery.value) return

    resetFieldPanelState()
    loading.value = true
    try {
      if (!(await ensureServiceResolved())) return
      if (isEsDatasource.value) {
        await loadEsLogs()
      } else {
        await loadLokiLogs()
      }
    } catch (error) {
      logs.value = []
      if (error instanceof PixiuApiError && error.notified) return
      ElMessage.error(parseRequestError(error))
    } finally {
      loading.value = false
    }
  }

  async function loadLokiLogs() {
    const url = serviceProxyBase('/loki/api/v1/query_range')
    if (!url) return

    const nowMs = Date.now()
    const startMs = nowMs - timeRangeMinutes.value * 60 * 1000
    queryTimeRange.value = { start: startMs, end: nowMs }

    const nowNs = nowMs * 1_000_000
    const startNs = startMs * 1_000_000
    const { data } = await kubeProxyAxios.get<LokiQueryRangeResponse>(url, {
      params: {
        query: effectiveQuery.value,
        limit: lineLimit.value,
        start: String(startNs),
        end: String(nowNs),
        direction: 'BACKWARD'
      }
    })

    if (data?.status !== 'success') {
      throw new Error(data?.error || 'Loki 查询失败')
    }

    expandedRowKeys.value = []
    logs.value = (data.data?.result ?? [])
      .flatMap((stream, streamIndex) =>
        (stream.values ?? []).map(([timestamp, line], lineIndex) => {
          const labels = { ...(stream.stream ?? {}) }
          const level = resolveLogLevel(labels, line)
          const numeric = Number.parseInt(timestamp, 10)
          const timestampMs = Number.isFinite(numeric) ? Math.floor(numeric / 1_000_000) : null
          return {
            id: `${timestamp}-${streamIndex}-${lineIndex}`,
            time: formatNsTimestamp(timestamp),
            timestampMs,
            ns: stream.stream?.namespace || '-',
            pod: stream.stream?.pod || '-',
            container: stream.stream?.container || '-',
            level,
            msg: normalizeLogMessage(line, level),
            raw: line,
            labels
          }
        })
      )
      .sort((a, b) => (a.time < b.time ? 1 : -1))
  }

  async function loadEsLogs() {
    const url = serviceProxyBase('/_search')
    if (!url) return

    const now = new Date()
    const start = new Date(now.getTime() - timeRangeMinutes.value * 60 * 1000)
    queryTimeRange.value = { start: start.getTime(), end: now.getTime() }
    const query = effectiveQuery.value.trim()
    const must = query && query !== '*' ? [{ query_string: { query, analyze_wildcard: true } }] : []
    const esHeaders = getEsRequestHeaders()

    const { data } = await kubeProxyAxios.post<EsSearchResponse>(
      url,
      {
        size: lineLimit.value,
        docvalue_fields: [
          { field: 'time', format: 'epoch_millis' },
          { field: '@timestamp', format: 'epoch_millis' },
          { field: 'timestamp', format: 'epoch_millis' }
        ],
        sort: [
          { time: { order: 'desc', unmapped_type: 'date' } },
          { '@timestamp': { order: 'desc', unmapped_type: 'date' } },
          { timestamp: { order: 'desc', unmapped_type: 'date' } }
        ],
        query: {
          bool: {
            must,
            filter: [
              {
                bool: {
                  should: [
                    {
                      range: {
                        time: {
                          gte: start.toISOString(),
                          lte: now.toISOString(),
                          format: 'strict_date_optional_time'
                        }
                      }
                    },
                    {
                      range: {
                        '@timestamp': {
                          gte: start.toISOString(),
                          lte: now.toISOString(),
                          format: 'strict_date_optional_time'
                        }
                      }
                    },
                    {
                      range: {
                        timestamp: {
                          gte: start.toISOString(),
                          lte: now.toISOString(),
                          format: 'strict_date_optional_time'
                        }
                      }
                    }
                  ],
                  minimum_should_match: 1
                }
              }
            ]
          }
        }
      },
      esHeaders ? { headers: esHeaders } : undefined
    )

    if (data?.error) {
      throw new Error(
        data.error.reason || data.error.root_cause?.[0]?.reason || 'Elasticsearch 查询失败'
      )
    }

    expandedRowKeys.value = []
    logs.value = (data.hits?.hits ?? []).map(mapEsHitToRow)
  }

  function mapEsHitToRow(hit: EsSearchHit, index: number): LogTableRow {
    const source = hit._source && typeof hit._source === 'object' ? hit._source : {}
    const rawTimestamp = getFirstValue(source, ['time', '@timestamp', 'timestamp', 'state.timestamp', 'log.time', 'date'])
    let timestampMs = resolveEsTimestampMs(source, hit.sort, hit.fields)
    const message = getFirstValue(source, ['message', 'msg', 'log', 'log.message', 'event.original'])
    const labels = flattenRecord(source)
    const raw = JSON.stringify(source, null, 2)
    const originalMessage = stringifyValue(message, raw)
    const level = resolveLogLevel(labels, originalMessage)
    const time = timestampMs != null ? formatDateTime(timestampMs) : formatAnyTimestamp(rawTimestamp)
    if (timestampMs == null && time !== '-') {
      timestampMs = parseLogTime(time)
    }

    return {
      id: String(hit._id || `${hit._index || 'es'}-${index}`),
      time,
      timestampMs,
      ns: stringifyValue(
        getFirstValue(source, [
          'kubernetes.namespace_name',
          'kubernetes.namespace',
          'kubernetes.namespace.name',
          'namespace'
        ])
      ),
      pod: stringifyValue(
        getFirstValue(source, ['kubernetes.pod_name', 'kubernetes.pod.name', 'pod', 'pod_name'])
      ),
      container: stringifyValue(
        getFirstValue(source, [
          'kubernetes.container_name',
          'kubernetes.container.name',
          'container',
          'container_name'
        ])
      ),
      level,
      msg: normalizeLogMessage(originalMessage, level),
      raw,
      labels
    }
  }

  function getFirstValue(source: Record<string, unknown>, paths: string[]): unknown {
    for (const path of paths) {
      const value = getByPath(source, path)
      if (value !== undefined && value !== null && value !== '') return value
    }
    return undefined
  }

  function getByPath(source: Record<string, unknown>, path: string): unknown {
    const segments = path.split('.')
    let current: unknown = source
    for (const segment of segments) {
      if (!current || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[segment]
    }
    return current
  }

  function stringifyValue(value: unknown, fallback = '-'): string {
    if (value == null || value === '') return fallback
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }

  function flattenRecord(
    value: unknown,
    prefix = '',
    result: Record<string, string> = {}
  ): Record<string, string> {
    if (value == null) return result

    if (Array.isArray(value)) {
      if (prefix) result[prefix] = value.map((item) => stringifyValue(item, '')).join(', ')
      return result
    }

    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key
        flattenRecord(child, nextPrefix, result)
      }
      return result
    }

    if (prefix) {
      result[prefix] = stringifyValue(value, '')
    }
    return result
  }

  function formatAnyTimestamp(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const millis = value > 1_000_000_000_000 ? value : value * 1000
      return formatDateTime(millis)
    }
    if (typeof value === 'string' && value.trim()) {
      const asNumber = Number(value)
      if (Number.isFinite(asNumber)) {
        const millis = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000
        return formatDateTime(millis)
      }
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        return formatDateTime(parsed.getTime())
      }
      return value
    }
    return '-'
  }

  function getLogRowKey(row: LogTableRow) {
    return row.id
  }

  function handleExpandChange(row: LogTableRow, expanded: LogTableRow[] | boolean) {
    const isRowExpanded = Array.isArray(expanded)
      ? expanded.some((item) => item.id === row.id)
      : expanded
    expandedRowKeys.value = isRowExpanded ? [row.id] : []
  }

  function toggleLogDetail(row: LogTableRow) {
    const next = new Set(expandedRowKeys.value)
    if (next.has(row.id)) next.delete(row.id)
    else next.add(row.id)
    expandedRowKeys.value = Array.from(next)
  }

  function isExpanded(row: LogTableRow) {
    return expandedRowKeys.value.includes(row.id)
  }

  function getLogFieldEntries(row: LogTableRow) {
    return Object.entries(row.labels).map(([key, value]) => ({ key, value }))
  }

  function getFieldValueClass(item: { key: string; value: string }) {
    if (item.key !== 'level') return ''
    return getLevelTone(item.value)
  }

  function getLevelTone(level: string) {
    const normalized = level.trim().toUpperCase()
    if (!normalized) return ''
    if (normalized === 'ERROR' || normalized === 'FATAL' || normalized === 'CRITICAL') {
      return 'is-level-error'
    }
    if (normalized === 'WARN' || normalized === 'WARNING') return 'is-level-warn'
    if (normalized === 'INFO') return 'is-level-info'
    if (normalized === 'DEBUG' || normalized === 'TRACE') return 'is-level-debug'
    return ''
  }

  function pickLevelFromLabels(labels: Record<string, string>): string {
    for (const key of ['level', 'severity', 'log.level', 'log_level']) {
      const value = labels[key]?.trim()
      if (value) return value.toUpperCase()
    }
    return ''
  }

  function resolveLogLevel(labels: Record<string, string>, message: string): string {
    const fromLabels = pickLevelFromLabels(labels)
    if (fromLabels) return fromLabels

    try {
      const parsed = JSON.parse(message)
      if (parsed && typeof parsed === 'object') {
        const level = (parsed as Record<string, unknown>).level
        if (level != null && String(level).trim()) {
          return String(level).trim().toUpperCase()
        }
      }
    } catch {
      // keep raw message when payload is not JSON
    }

    return ''
  }

  function normalizeLogMessage(message: string, level: string): string {
    if (!level) return message

    const variants = new Set<string>([level.toUpperCase()])
    if (variants.has('WARN')) variants.add('WARNING')
    if (variants.has('WARNING')) variants.add('WARN')

    for (const variant of variants) {
      const pattern = new RegExp(`^\\[${variant}\\]\\s*`, 'i')
      if (pattern.test(message)) {
        return message.replace(pattern, '')
      }
    }

    return message.replace(
      /^\[(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)\]\s*/i,
      ''
    )
  }

  async function copyFieldValue(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      ElMessage.success('已复制')
    } catch {
      ElMessage.error('复制失败')
    }
  }

  function sanitizeFilenamePart(value: string) {
    return value.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'logs'
  }

  function formatDownloadTimestamp() {
    const date = new Date()
    const pad = (value: number, size = 2) => String(value).padStart(size, '0')
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  }

  function escapeCsvCell(value: string) {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }

  function buildRawLogContent(rows: LogTableRow[]) {
    return rows
      .map((row, index) => {
        const parts = []
        if (showLineNumber.value) parts.push(String(index + 1))
        if (showLogTime.value) parts.push(row.time)
        parts.push(row.pod)
        parts.push(row.msg)
        return parts.join('\t')
      })
      .join('\n')
  }

  function buildTableCsvContent(rows: LogTableRow[]) {
    const header = ['时间', '命名空间', 'Pod', '容器', '内容']
    const lines = rows.map((row) =>
      [row.time, row.ns, row.pod, row.container, row.msg].map((item) => escapeCsvCell(item ?? '')).join(',')
    )
    return [header.join(','), ...lines].join('\n')
  }

  function triggerDownload(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function downloadLogs() {
    if (!displayLogs.value.length) {
      ElMessage.warning('暂无可下载的日志')
      return
    }

    const datasourceName = sanitizeFilenamePart(
      selectedDatasource.value?.name ?? selectedDatasource.value?.subType ?? 'logs'
    )
    const clusterName = sanitizeFilenamePart(currentCluster.value || 'cluster')
    const timestamp = formatDownloadTimestamp()

    if (resultViewMode.value === 'raw') {
      triggerDownload(
        `${clusterName}-${datasourceName}-${timestamp}.txt`,
        buildRawLogContent(displayLogs.value),
        'text/plain'
      )
      return
    }

    triggerDownload(
      `${clusterName}-${datasourceName}-${timestamp}.csv`,
      buildTableCsvContent(displayLogs.value),
      'text/csv'
    )
  }

  watch(keyword, () => {
    if (!queryDirty.value && !isEsDatasource.value) {
      queryDraft.value = generatedQuery.value
    }
  })

  watch(
    filters,
    () => {
      if (isLokiDatasource.value) {
        syncGeneratedQuery()
      }
    },
    { deep: true }
  )

  watch(
    hasConfiguredDatasource,
    (value) => {
      emit('datasourceStateChange', value)
    },
    { immediate: true }
  )

  // 只在集群变化时刷新整个上下文，避免重复请求
  watch(
    currentCluster,
    async () => {
      queryDirty.value = false
      keyword.value = ''
      filters.value = []
      await refreshContext(true, false)
    },
    { immediate: true }
  )

  // 只在手动切换数据源时更新 service 上下文
  watch(selectedDatasourceId, (newVal, oldVal) => {
    if (!datasourceOptions.value.length || newVal === oldVal) return

    if (oldVal !== undefined) {
      filters.value = []
      errorMessage.value = ''
      resolvedService.value = null
      resolvedServiceNamespace.value = ''
      resolvedEndpoint.value = null
      labelKeys.value = []
      labelValueCache.value = {}
      logs.value = []
      expandedRowKeys.value = []
    }

    queryDirty.value = false
    keyword.value = ''
    syncQueryDraftFromDatasource()
  })
</script>

<style scoped>
  .logs-console {
    display: flex;
    flex-direction: column;
    margin-top: 0;
    gap: 20px;
    min-height: 0;
  }

  .logs-console:not(.logs-console--placeholder) {
    flex: 1;
    height: 100%;
    max-height: 100%;
  }

  .logs-console__top-card {
    flex-shrink: 0;
  }

  .logs-console.logs-console--placeholder {
    flex: none !important;
    align-self: stretch;
    gap: 0;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
    overflow: hidden;
  }

  .logs-console__top-card,
  .logs-console__results {
    border: none;
    border-radius: 8px;
    background: var(--el-bg-color);
    overflow: hidden;
    box-shadow: 0 4px 12px rgb(15 23 42 / 0.05);
  }

  .logs-console__rule-bar {
    padding: 12px 16px;
    background: var(--el-fill-color-blank);
  }

  .logs-console__rule-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .logs-console__rule-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .logs-console__external-link {
    font-size: 12px;
  }

  .logs-console__external-link-icon {
    margin-left: 4px;
  }

  .logs-console__rule-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .logs-console__rule-select {
    width: 220px;
    max-width: 100%;
  }

  .logs-console__datasource-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .logs-console__datasource-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    flex: none;
  }

  .logs-console__datasource-logo.is-loki {
    color: #f59e0b;
    background: #fff7ed;
  }

  .logs-console__datasource-logo.is-es {
    color: #2563eb;
    background: #eff6ff;
  }

  .logs-console__datasource-logo.is-prometheus {
    color: #f97316;
    background: #fff7ed;
  }

  .logs-console__datasource-logo-icon {
    width: 14px;
    height: 14px;
  }

  .logs-console__datasource-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logs-console__query-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-top: 20px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .logs-console__query-toolbar-left,
  .logs-console__query-toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    min-height: 20px;
  }

  .logs-console__query-toolbar-right {
    justify-content: flex-end;
  }

  .logs-console__query-mode {
    margin-right: 2px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    font-weight: 500;
    white-space: nowrap;
  }

  .logs-console__query-toolbar-left :deep(.el-button),
  .logs-console__query-toolbar-right :deep(.el-button),
  .logs-console__main-toolbar :deep(.el-button) {
    height: auto !important;
    padding: 0 !important;
    font-size: 12px !important;
    line-height: 1.2 !important;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .logs-console__main-toolbar :deep(.logs-console__download-btn.el-button:not(.is-disabled)) {
    color: var(--el-color-primary) !important;
  }

  .logs-console__query-toolbar-left :deep(.el-button.is-disabled),
  .logs-console__query-toolbar-right :deep(.el-button.is-disabled),
  .logs-console__main-toolbar :deep(.el-button.is-disabled) {
    opacity: 1;
    color: var(--el-text-color-secondary);
  }

  .logs-console__hot-tag {
    display: inline-flex;
    align-items: center;
    height: 16px;
    padding: 0 5px;
    border-radius: 2px;
    background: #f56c6c;
    color: #fff;
    font-size: 10px;
    line-height: 1;
    font-weight: 600;
    transform: translateY(-1px);
  }

  .logs-console__query-body {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: nowrap;
  }

  .logs-query-input {
    flex: 1;
    min-width: 0;
  }

  .logs-query-input :deep(.el-input__wrapper) {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 13px;
  }

  .logs-query-input :deep(.el-input__inner::placeholder),
  .logs-query-input :deep(input::placeholder) {
    font-size: 12px !important;
  }

  .logs-query-input :deep(.el-input__placeholder) {
    font-size: 12px !important;
  }

  .logs-console__query-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .logs-console__query-link {
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-color-primary);
    cursor: pointer;
    user-select: none;
  }

  .logs-console__query-link:hover {
    opacity: 0.85;
  }

  .logs-time-range {
    width: 140px;
    flex: none;
  }

  .logs-search-btn {
    flex: none;
    min-width: 88px;
  }

  .logs-filter-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }

  .logs-filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .logs-filter-key {
    width: 180px;
  }

  .logs-filter-operator {
    width: 100px;
  }

  .logs-filter-value {
    width: 260px;
    max-width: 100%;
  }

  .logs-console__results {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .logs-console__results-tabs {
    display: flex;
    align-items: flex-end;
    gap: 20px;
    flex-shrink: 0;
    padding: 12px 16px 0 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-blank);
  }

  .logs-console__results-body {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .logs-console__results.is-fields-collapsed .logs-console__results-body {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .logs-console__fields {
    padding: 12px;
    background: var(--el-fill-color-blank);
    overflow: auto;
    position: relative;
    min-height: 0;
    color: var(--el-text-color-regular);
  }

  .logs-console__fields.is-collapsed {
    padding: 12px 6px;
    overflow: hidden;
  }

  .logs-console__fields::after {
    content: '';
    position: absolute;
    top: 12px;
    right: 0;
    bottom: 12px;
    width: 1px;
    background: var(--el-border-color-lighter);
    pointer-events: none;
  }

  .logs-console__fields-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    margin-bottom: 10px;
  }

  .logs-console__fields-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 0;
  }

  .logs-console__fields-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    margin-left: auto;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .logs-console__fields-toggle:hover {
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
  }

  .logs-console__fields.is-collapsed .logs-console__fields-header {
    justify-content: center;
    margin-bottom: 0;
  }

  .logs-console__fields.is-collapsed .logs-console__fields-toggle {
    margin-left: 0;
  }

  .logs-console__fields-search {
    margin-bottom: 8px;
  }

  .logs-console__fields-search :deep(.el-input__wrapper) {
    min-height: 30px;
    padding-top: 1px;
    padding-bottom: 1px;
  }

  .logs-console__fields-search :deep(.el-input__inner),
  .logs-console__fields-search :deep(input) {
    font-size: 12px;
  }

  .logs-console__fields-search :deep(.el-input__inner::placeholder),
  .logs-console__fields-search :deep(input::placeholder) {
    font-size: 12px !important;
  }

  .logs-field-tree {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .logs-field-node {
    border-radius: 4px;
  }

  .logs-field-node__head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-height: 32px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--el-text-color-primary);
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .logs-field-node__head:hover {
    background: var(--el-fill-color-light);
  }

  .logs-field-node.is-expanded .logs-field-node__head {
    background: var(--el-color-primary-light-9);
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .logs-field-node__arrow {
    flex: none;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    transition: color 0.2s ease;
  }

  .logs-field-node__head:hover .logs-field-node__arrow,
  .logs-field-node.is-expanded .logs-field-node__arrow {
    color: var(--el-text-color-secondary);
  }

  .logs-field-node__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: inherit;
  }

  .logs-field-node__badge {
    flex: none;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--el-color-primary-light-8);
    color: var(--el-color-primary);
    font-size: 11px;
    font-weight: 500;
    line-height: 18px;
    text-align: center;
  }

  .logs-field-node__body {
    padding: 4px 8px 8px 26px;
    font-size: 12px;
  }

  .logs-field-node__search {
    margin-bottom: 6px;
    font-size: 12px;
  }

  .logs-field-node__search :deep(.el-input__wrapper) {
    min-height: 28px;
    background: var(--el-fill-color-blank);
    font-size: 12px;
  }

  .logs-field-node__search :deep(.el-input__inner),
  .logs-field-node__search :deep(input) {
    font-size: 12px !important;
    color: var(--el-text-color-regular);
  }

  .logs-field-node__search :deep(.el-input__inner::placeholder),
  .logs-field-node__search :deep(input::placeholder) {
    color: var(--el-text-color-placeholder);
    font-size: 12px !important;
  }

  .logs-field-node__options {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-height: 220px;
    overflow: auto;
    font-size: 12px;
  }

  .logs-field-node__option {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 5px 4px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    cursor: pointer;
  }

  .logs-field-node__option:hover {
    background: var(--el-fill-color-light);
  }

  .logs-field-node__option :deep(.el-checkbox) {
    height: 16px;
    margin-top: 2px;
    font-size: 12px;
  }

  .logs-field-node__option :deep(.el-checkbox__inner) {
    border-color: var(--el-border-color);
  }

  .logs-field-node__option :deep(.el-checkbox__label) {
    font-size: 12px;
    line-height: 1.5;
  }

  .logs-field-node__value {
    flex: 1;
    min-width: 0;
    font-size: 12px !important;
    line-height: 1.5;
    color: var(--el-text-color-regular);
    word-break: break-all;
  }

  .logs-field-node__empty {
    padding: 8px 4px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .logs-console__fields-empty {
    padding: 16px 8px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    text-align: center;
  }

  .logs-console__count-filtered {
    margin-left: 2px;
    color: var(--el-text-color-secondary);
  }

  .logs-console__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    background: var(--el-bg-color);
  }

  .logs-console__main-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    flex-shrink: 0;
    padding: 10px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .logs-console__main-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .logs-console__view-mode {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    flex-wrap: wrap;
  }

  .logs-console__view-mode-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .logs-console__column-settings {
    flex: none;
    margin-left: auto;
  }

  .logs-column-settings__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    box-sizing: border-box;
    height: 24px;
    padding: 0 10px;
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: 4px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-size: 12px;
    line-height: 22px;
    cursor: pointer;
  }

  .logs-column-settings__trigger .el-icon {
    font-size: 12px;
  }

  .logs-column-settings__trigger:hover {
    border-color: var(--el-color-primary-light-3);
    background: var(--el-color-primary-light-8);
  }

  .logs-column-settings__panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 2px 0;
    font-size: 12px;
  }

  .logs-column-settings__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }

  .logs-column-settings__row :deep(.el-switch) {
    height: 16px;
  }

  .logs-view-segment {
    display: inline-flex;
    align-items: stretch;
  }

  .logs-view-segment__item {
    position: relative;
    min-width: 52px;
    height: 24px;
    padding: 0 14px;
    border: 1px solid var(--el-border-color);
    margin-left: -1px;
    background: var(--el-bg-color);
    color: var(--el-text-color-regular);
    font-size: 12px;
    line-height: 22px;
    cursor: pointer;
  }

  .logs-view-segment__item:first-child {
    margin-left: 0;
    border-radius: 2px 0 0 2px;
  }

  .logs-view-segment__item:last-child {
    border-radius: 0 2px 2px 0;
  }

  .logs-view-segment__item.is-active {
    z-index: 1;
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
    background: var(--el-bg-color);
  }

  .logs-console__display-options {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .logs-console__display-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    user-select: none;
  }

  .logs-console__display-check :deep(.el-checkbox) {
    height: auto;
  }

  .logs-console__display-check :deep(.el-checkbox__label) {
    padding-left: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }

  .logs-console__result-tab {
    padding: 0 0 10px;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    position: relative;
  }

  .logs-console__result-tab.is-active {
    color: var(--el-color-primary);
    font-weight: 500;
  }

  .logs-console__result-tab.is-active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background: var(--el-color-primary);
  }

  .logs-console__main-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .logs-console__count {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .logs-trend-chart {
    width: 100%;
  }

  .logs-trend-chart__panel {
    position: relative;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    background: var(--el-fill-color-blank);
    overflow: hidden;
  }

  .logs-trend-chart__panel.is-large {
    width: 100%;
  }

  .logs-trend-chart__panel.is-large .logs-trend-chart__bars {
    height: 180px;
  }

  .logs-trend-chart__toggle,
  .logs-trend-chart__show {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: transparent;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .logs-trend-chart__toggle {
    position: absolute;
    top: 8px;
    left: 10px;
    z-index: 1;
  }

  .logs-trend-chart__show {
    padding: 4px 0;
    color: var(--el-color-primary);
  }

  .logs-trend-chart__toggle:hover,
  .logs-trend-chart__show:hover {
    color: var(--el-color-primary);
  }

  .logs-trend-chart__plot {
    padding: 28px 12px 8px;
  }

  .logs-trend-chart__bars {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    width: 100%;
    height: 88px;
    border-bottom: 1px solid var(--el-border-color);
    overflow-x: auto;
  }

  .logs-trend-chart__bar-wrap {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
    cursor: pointer;
  }

  .logs-trend-chart__bar {
    width: 70%;
    max-width: 14px;
    min-width: 6px;
    min-height: 0;
    border-radius: 1px 1px 0 0;
    background: var(--el-color-primary);
    opacity: 0.85;
    cursor: pointer;
  }

  .logs-trend-chart__axis {
    display: flex;
    align-items: flex-start;
    gap: 3px;
    width: 100%;
    margin-top: 6px;
    overflow: hidden;
  }

  .logs-trend-chart__axis-label {
    flex: 1;
    min-width: 0;
    font-size: 10px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .logs-console__chart-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    min-height: 0;
    overflow: auto;
  }

  .logs-console__content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .logs-raw-list {
    padding: 8px 0;
    font-size: 12px;
    line-height: 23px;
    color: var(--el-text-color-regular);
  }

  .logs-raw-line {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 4px 14px;
    border-bottom: 1px solid var(--el-border-color-extra-light);
    color: var(--el-text-color-regular);
  }

  .logs-raw-line:hover {
    background: var(--el-fill-color-light);
  }

  .logs-raw-line.is-wrap .logs-raw-line__msg {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .logs-raw-line__no {
    flex: none;
    width: 36px;
    color: var(--el-text-color-regular);
    text-align: right;
  }

  .logs-raw-line__time {
    flex: none;
    width: 190px;
    color: var(--el-text-color-regular);
  }

  .logs-raw-line__pod {
    flex: none;
    width: 170px;
    padding-right: 12px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .logs-raw-line.is-wrap .logs-raw-line__pod {
    white-space: normal;
    word-break: break-all;
  }

  .logs-raw-line__msg {
    flex: 1;
    min-width: 0;
    color: var(--el-text-color-regular);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .logs-loading-state,
  .logs-unavailable-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    padding: 56px 24px 48px;
    text-align: center;
  }

  .logs-loading-card {
    width: 100%;
    min-height: 120px;
  }

  .logs-unavailable-icon {
    margin-bottom: 12px;
    color: var(--el-color-primary);
  }

  .logs-unavailable-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .logs-unavailable-desc {
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  .logs-unavailable-btn.el-button {
    margin-top: 16px;
    flex: none;
    height: 30px !important;
    min-height: 30px !important;
    padding: 0 14px !important;
    font-size: 12px;
    line-height: 1 !important;
    border-radius: 0 !important;
  }

  .logs-unavailable-btn.el-button > span {
    line-height: 1;
  }

  .logs-empty {
    padding: 24px 14px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    text-align: center;
  }

  .logs-table :deep(.el-table__expanded-cell) {
    padding: 0;
    background: var(--el-fill-color-lighter);
  }

  .logs-table :deep(.el-table__body td.el-table__cell) {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .logs-table:not(.is-wrap) :deep(.el-table__body td.el-table__cell .cell) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .logs-table.is-wrap :deep(.el-table__body td.el-table__cell .cell) {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .logs-table :deep(.el-button.is-link) {
    font-size: 12px;
    padding: 0;
  }

  .logs-inline-detail {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) minmax(0, 1.35fr);
    gap: 12px;
    padding: 12px 16px 14px 52px;
    background: var(--el-fill-color-lighter);
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .logs-inline-detail__panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-bg-color);
    overflow: hidden;
  }

  .logs-inline-detail__panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--el-border-color-extra-light);
    background: var(--el-fill-color-blank);
  }

  .logs-inline-detail__panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .logs-inline-detail__panel-count {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .logs-inline-detail__copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .logs-inline-detail__copy-btn:hover {
    color: var(--el-color-primary);
  }

  .logs-field-grid {
    max-height: 260px;
    overflow: auto;
  }

  .logs-field-row {
    display: grid;
    grid-template-columns: 148px minmax(0, 1fr) 22px;
    gap: 10px;
    align-items: start;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.5;
    border-bottom: 1px solid var(--el-border-color-extra-light);
  }

  .logs-field-row:last-child {
    border-bottom: none;
  }

  .logs-field-row:nth-child(even) {
    background: var(--el-fill-color-lighter);
  }

  .logs-field-row:hover {
    background: var(--el-fill-color-light);
  }

  .logs-field-row__key {
    color: var(--el-text-color-regular);
    font-family: Consolas, 'Courier New', monospace;
    word-break: break-all;
  }

  .logs-field-row__value {
    color: var(--el-text-color-primary);
    font-family: Consolas, 'Courier New', monospace;
    word-break: break-all;
  }

  .logs-field-row__value.is-level-info {
    color: var(--el-color-primary);
    font-weight: 500;
  }

  .logs-field-row__value.is-level-warn {
    color: var(--el-color-warning);
    font-weight: 500;
  }

  .logs-field-row__value.is-level-error {
    color: var(--el-color-danger);
    font-weight: 500;
  }

  .logs-field-row__value.is-level-debug {
    color: var(--el-text-color-secondary);
  }

  .logs-field-row__copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease;
  }

  .logs-field-row:hover .logs-field-row__copy {
    opacity: 1;
  }

  .logs-field-row__copy:hover {
    background: var(--el-fill-color);
    color: var(--el-color-primary);
  }

  .logs-inline-detail__code {
    margin: 0;
    padding: 12px;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
    font-family: Consolas, 'Courier New', monospace;
    background: var(--el-fill-color-blank);
  }

  @media (max-width: 960px) {
    .logs-console__query-body {
      flex-wrap: wrap;
    }

    .logs-query-input {
      flex: 1 1 100%;
    }

    .logs-time-range {
      flex: 1;
      min-width: 120px;
    }

    .logs-console__results-body {
      grid-template-columns: 1fr;
    }

    .logs-console__fields {
      border-bottom: 1px solid var(--el-border-color-lighter);
      max-height: 220px;
    }

    .logs-console__fields::after {
      display: none;
    }

    .logs-inline-detail {
      grid-template-columns: 1fr;
      padding-left: 16px;
    }
  }
</style>
