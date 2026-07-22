<!-- Elasticsearch 管理页面 -->
<template>
  <div class="es-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      description="管理 Elasticsearch 数据源，支持增删改查操作。请先选择 ES 类型数据源，再进行管理。"
      @close="alertVisible = false"
    />

    <section class="es-top-card">
      <div class="es-rule-bar">
        <div class="es-rule-main">
          <div class="es-rule-left">
            <span class="es-rule-label">实例名称</span>
            <span class="es-datasource-wrap">
              <ElSelect
                v-model="selectedDsId"
                class="es-rule-select es-ds-select"
                placeholder="请选择 Elasticsearch 数据源"
                :loading="dsLoading"
                clearable
                @change="onDsChange"
              >
                <template #label="{ value }">
                  <span v-if="value && selectedDatasource" class="es-ds-option">
                    <span class="es-ds-logo is-es">
                      <ArtSvgIcon icon="simple-icons:elasticsearch" class="es-ds-logo-icon" />
                    </span>
                    <span class="es-ds-option-name">{{ selectedDatasource.name }}</span>
                  </span>
                </template>
                <ElOption
                  v-for="ds in dsList"
                  :key="ds.id"
                  :label="ds.name"
                  :value="ds.id"
                >
                  <span class="es-ds-option">
                    <span class="es-ds-logo is-es">
                      <ArtSvgIcon icon="simple-icons:elasticsearch" class="es-ds-logo-icon" />
                    </span>
                    <span class="es-ds-option-name">{{ ds.name }}</span>
                  </span>
                </ElOption>
              </ElSelect>
              <div v-if="selectedDatasource" class="es-health-info">
                <span class="es-health-info-item">健康状态：<span class="es-health-status-value" :class="healthBadgeClass">{{ healthStatusText }}</span></span>
                <span v-if="healthData?.cluster_name" class="es-health-info-item">集群名称：{{ healthData.cluster_name }}</span>
                <span v-if="healthData?.version_number" class="es-health-info-item">版本：{{ healthData.version_number }}</span>
                <span class="es-health-info-item">在线节点数：{{ healthData?.number_of_nodes ?? '-' }}/{{ healthData?.number_of_data_nodes ?? '-' }}</span>
                <span class="es-health-info-item">总分片数：{{ healthData?.active_shards ?? '-' }}</span>
                <span class="es-health-info-item">未分配分片数：{{ healthData?.unassigned_shards ?? '-' }}</span>
              </div>
            </span>
          </div>
        </div>
      </div>
    </section>

    <div v-if="activeTab === 'index'" class="es-index-toolbar">
      <div class="es-index-toolbar__left">
        <ElButton v-ripple @click="handleCreateIndex">创建索引</ElButton>
        <ElButton v-ripple :disabled="!selectedIndices.length" @click="handleBatchDelete">批量删除</ElButton>
      </div>
      <div class="es-index-toolbar__right">
        <ElInput
          v-model="indexSearch"
          clearable
          placeholder="搜索索引名称"
          class="es-index-toolbar__search"
          @keyup.enter="handleIndexSearch"
          @clear="handleIndexSearch"
        />
        <ElSelect
          v-model="indexHealthFilter"
          clearable
          placeholder="健康状态"
          class="es-index-toolbar__sort"
          @change="handleIndexSearch"
        >
          <ElOption label="Green" value="green" />
          <ElOption label="Yellow" value="yellow" />
          <ElOption label="Red" value="red" />
        </ElSelect>
        <ElSelect
          v-model="indexSort"
          clearable
          placeholder="排序"
          class="es-index-toolbar__sort"
          @change="handleIndexSearch"
        >
          <ElOption label="索引名称" value="index:asc" />
          <ElOption label="存储大小 ↓" value="store.size:desc" />
          <ElOption label="存储大小 ↑" value="store.size:asc" />
          <ElOption label="文档数 ↓" value="docs.count:desc" />
          <ElOption label="文档数 ↑" value="docs.count:asc" />
        </ElSelect>
        <ArtTableHeader
          v-model:columns="indexColumnChecks"
          :loading="indexLoading"
          full-class="es-page"
          @refresh="fetchIndices"
        />
      </div>
    </div>

    <ElCard
      class="art-table-card"
      :class="{ 'art-table-card--after-toolbar': activeTab === 'index' }"
    >
      <ElTabs v-model="activeTab" class="es-tabs">
        <ElTabPane label="索引管理" name="index">
          <div class="es-index-table-wrap">
            <div class="es-index-table-scroll">
              <ElTable
                :data="pagedIndexData"
                class="es-index-table"
                style="width: 100%"
                :size="tableSize"
                :stripe="isZebra"
                :border="isBorder"
                :header-cell-style="headerCellStyle"
                empty-text="请先选择 Elasticsearch 数据源"
                v-loading="indexLoading"
                @selection-change="handleIndexSelectionChange"
              >
                <ElTableColumn type="selection" width="30" />
                <ElTableColumn
                  v-if="isIndexColVisible('index')"
                  prop="index"
                  label="索引名称"
                  min-width="260"
                  show-overflow-tooltip
                />
                <ElTableColumn v-if="isIndexColVisible('health')" prop="health" label="健康状态" min-width="100">
                  <template #default="{ row }">
                    <span :style="{ color: healthColorMap[row.health] || 'inherit' }">{{ healthLabelMap[row.health] || row.health }}</span>
                  </template>
                </ElTableColumn>
                <ElTableColumn v-if="isIndexColVisible('status')" prop="status" label="状态" width="70" />
                <ElTableColumn v-if="isIndexColVisible('pri')" prop="pri" label="主分片" min-width="90" align="right" />
                <ElTableColumn v-if="isIndexColVisible('rep')" prop="rep" label="副本" min-width="80" align="right" />
                <ElTableColumn
                  v-if="isIndexColVisible('docs_count')"
                  prop="docs_count"
                  label="文档数"
                  min-width="120"
                  align="right"
                />
                <ElTableColumn
                  v-if="isIndexColVisible('store_size')"
                  prop="store_size"
                  label="存储大小"
                  min-width="120"
                  align="right"
                />
                <ElTableColumn label="读写状态" width="80" align="center">
                  <template #default="{ row }">
                    <span :style="{ fontSize: '12px', color: row.read_only ? '#dc2626' : '#16a34a' }">
                      {{ row.read_only ? '只读' : '读写' }}
                    </span>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="130" fixed="right">
                  <template #default="{ row }">
                    <ElLink
                      type="primary"
                      :underline="false"
                      style="font-size:12px"
                      @click="handleToggleReadOnly(row)"
                    >
                      {{ row.read_only ? '解除只读' : '设为只读' }}
                    </ElLink>
                    <ElLink
                      type="primary"
                      :underline="false"
                      style="font-size:12px;margin-left:8px"
                      @click="handleDeleteIndex(row)"
                    >
                      删除
                    </ElLink>
                  </template>
                </ElTableColumn>
              </ElTable>
            </div>
            <div class="pagination custom-pagination right">
              <ElPagination
                v-model:current-page="indexPage"
                v-model:page-size="indexPageSize"
                :disabled="indexLoading"
                :page-sizes="[10, 20, 30, 50, 100]"
                :total="indexData.length"
                :background="true"
                layout="total, prev, pager, next, sizes, jumper"
              />
            </div>
          </div>
        </ElTabPane>
      </ElTabs>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ElAlert,
  ElButton,
  ElCard,
  ElInput,
  ElLink,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElSelect,
  ElOption,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs
} from 'element-plus'
import {
  fetchDatasourceList,
  resolveDatasourceUrl,
  type DatasourceItem
} from '@/api/datasource'
import { pixiuAxios } from '@/api/container'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { buildClusterServiceProxyPath } from '@/utils/datasource/clusterProxy'
import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
import { useTableStore } from '@/store/modules/table'
import type { ColumnOption } from '@/types'

defineOptions({ name: 'MiddlewareElasticsearch' })

const tableStore = useTableStore()
const { tableSize, isZebra, isBorder, isHeaderBackground } = storeToRefs(tableStore)

const headerCellStyle = computed(() => ({
  background: isHeaderBackground.value
    ? 'var(--el-fill-color-lighter)'
    : 'var(--default-box-color)'
}))

// ---- datasource selector ----
const dsLoading = ref(false)
const dsList = ref<DatasourceItem[]>([])
const selectedDsId = ref<number | undefined>(undefined)

const selectedDatasource = computed(() => {
  if (!selectedDsId.value) return null
  return dsList.value.find((ds) => ds.id === selectedDsId.value) ?? null
})

async function loadDsList() {
  dsLoading.value = true
  try {
    const { items } = await fetchDatasourceList({
      page: 1,
      limit: 200,
      subType: 'es'
    })
    dsList.value = items
  } finally {
    dsLoading.value = false
  }
}

function onDsChange() {
  // 切换数据源时只需要获取健康状态，不需要刷新列表
}

loadDsList()

// ---- health check ----
interface HealthData {
  status: 'green' | 'yellow' | 'red' | null
  number_of_nodes: number
  number_of_data_nodes: number
  active_primary_shards: number
  active_shards: number
  relocating_shards: number
  initializing_shards: number
  unassigned_shards: number
  cluster_name: string
  version_number: string
}

const healthData = ref<HealthData | null>(null)
const healthLoading = ref(false)

const healthBadgeClass = computed(() => {
  if (healthLoading.value) return 'is-loading'
  if (!healthData.value?.status) return 'is-error'
  return `is-${healthData.value.status}`
})

const healthText = computed(() => {
  if (healthLoading.value) return '...'
  if (!healthData.value?.status) return 'N/A'
  const map: Record<string, string> = { green: 'Green', yellow: 'Yellow', red: 'Red' }
  return map[healthData.value.status] ?? healthData.value.status
})

const healthStatusText = computed(() => {
  if (!healthData.value?.status) return 'N/A'
  const map: Record<string, string> = { green: '绿色', yellow: '黄色', red: '红色' }
  return map[healthData.value.status] ?? healthData.value.status
})

function buildExternalAuthHeader(ds: DatasourceItem): string {
  const username = ds.config.log?.userName?.trim() || ds.config.alert?.userName?.trim() || ''
  const password = ds.config.log?.password ?? ds.config.alert?.password ?? ''
  if (!username && !password) return ''
  return `Basic ${btoa(`${username}:${password}`)}`
}

function getExternalProxyHeaders(ds: DatasourceItem): Record<string, string> {
  const headers: Record<string, string> = {}
  const authHeader = buildExternalAuthHeader(ds)
  if (authHeader) {
    headers['X-Pixiu-Proxy-Authorization'] = authHeader
  }
  for (const header of ds.config.headers ?? []) {
    const key = header.key.trim()
    if (!key) continue
    headers[key] = header.value
  }
  return headers
}

async function fetchHealth() {
  const ds = selectedDatasource.value
  if (!ds) {
    healthData.value = null
    return
  }
  const dsUrl = resolveDatasourceUrl(ds)
  if (!dsUrl) {
    healthData.value = null
    return
  }

  healthLoading.value = true
  healthData.value = null
  try {
    let healthBody: any
    let versionBody: any
    if (ds.external) {
      const headers = getExternalProxyHeaders(ds)
      const baseUrl = dsUrl.replace(/\/+$/, '')
      const [healthRes, versionRes] = await Promise.all([
        pixiuAxios.get('/pixiu/external/_cluster/health', { params: { url: baseUrl }, headers }),
        pixiuAxios.get('/pixiu/external/', { params: { url: baseUrl }, headers })
      ])
      healthBody = healthRes.data?.result ?? healthRes.data
      versionBody = versionRes.data?.result ?? versionRes.data
    } else {
      const baseUrl = dsUrl.replace(/\/+$/, '')
      const [healthRes, versionRes] = await Promise.all([
        kubeProxyAxios.get(buildClusterServiceProxyPath(ds.clusterName, baseUrl, '/_cluster/health')),
        kubeProxyAxios.get(buildClusterServiceProxyPath(ds.clusterName, baseUrl, '/'))
      ])
      healthBody = healthRes.data?.result ?? healthRes.data
      versionBody = versionRes.data?.result ?? versionRes.data
    }
    healthData.value = {
      status: healthBody?.status ?? null,
      number_of_nodes: healthBody?.number_of_nodes ?? 0,
      number_of_data_nodes: healthBody?.number_of_data_nodes ?? 0,
      active_primary_shards: healthBody?.active_primary_shards ?? 0,
      active_shards: healthBody?.active_shards ?? 0,
      relocating_shards: healthBody?.relocating_shards ?? 0,
      initializing_shards: healthBody?.initializing_shards ?? 0,
      unassigned_shards: healthBody?.unassigned_shards ?? 0,
      cluster_name: healthBody?.cluster_name ?? '',
      version_number: versionBody?.version?.number ?? ''
    }
  } catch {
    healthData.value = null
  } finally {
    healthLoading.value = false
  }
}

watch(selectedDsId, () => {
  fetchHealth()
})

// ---- index management ----
const activeTab = ref('index')
const alertVisible = ref(true)

interface IndexItem {
  index: string
  health: string
  status: string
  pri: string
  rep: string
  docs_count: string
  store_size: string
  read_only: boolean
}

const indexData = ref<IndexItem[]>([])
const indexLoading = ref(false)
const selectedIndices = ref<IndexItem[]>([])
const indexSearch = ref('')
const indexHealthFilter = ref('')
const indexSort = ref('')
const indexPage = ref(1)
const indexPageSize = ref(10)

const healthLabelMap: Record<string, string> = { green: '绿色', yellow: '黄色', red: '红色' }
const healthColorMap: Record<string, string> = { green: '#16a34a', yellow: '#ca8a04', red: '#dc2626' }

const indexColumnChecks = ref<ColumnOption[]>([
  { prop: 'index', label: '索引名称', checked: true },
  { prop: 'health', label: '健康状态', checked: true },
  { prop: 'status', label: '状态', checked: true },
  { prop: 'pri', label: '主分片', checked: true },
  { prop: 'rep', label: '副本', checked: true },
  { prop: 'docs_count', label: '文档数', checked: true },
  { prop: 'store_size', label: '存储大小', checked: true }
])

function isIndexColVisible(prop: string) {
  const col = indexColumnChecks.value.find((item) => item.prop === prop)
  if (!col) return true
  if (col.visible !== undefined) return col.visible
  return col.checked ?? true
}

const pagedIndexData = computed(() => {
  const start = (indexPage.value - 1) * indexPageSize.value
  return indexData.value.slice(start, start + indexPageSize.value)
})

function handleCreateIndex() {
  // TODO: open create index drawer/dialog
}

async function handleBatchDelete() {
  if (!selectedIndices.value.length) return

  const names = selectedIndices.value.map((i) => i.index).join('、')
  const ds = selectedDatasource.value
  if (!ds) return
  const dsUrl = resolveDatasourceUrl(ds)
  if (!dsUrl) return

  try {
    await ElMessageBox.confirm(
      `确定删除以下 ${selectedIndices.value.length} 个索引吗？\n${names}\n\n此操作不可恢复。`,
      '批量删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        beforeClose: async (action, instance, done) => {
          if (action !== 'confirm') {
            done()
            return
          }
          instance.confirmButtonLoading = true
          const baseUrl = dsUrl.replace(/\/+$/, '')
          const total = selectedIndices.value.length
          let successCount = 0
          for (const row of selectedIndices.value) {
            try {
              if (ds.external) {
                const headers = getExternalProxyHeaders(ds)
                await pixiuAxios.delete('/pixiu/external', { params: { url: `${baseUrl}/${row.index}` }, headers })
              } else {
                const proxyPath = buildClusterServiceProxyPath(ds.clusterName, baseUrl, `/${encodeURIComponent(row.index)}`)
                await kubeProxyAxios.delete(proxyPath)
              }
              successCount++
            } catch {
              // continue
            }
          }
          instance.confirmButtonLoading = false
          selectedIndices.value = []
          fetchIndices()
          ElMessage.success(`成功删除 ${successCount}/${total} 个索引`)
          done()
        }
      }
    )
  } catch {
    // cancelled
  }
}

async function handleDeleteIndex(row: IndexItem) {
  const ds = selectedDatasource.value
  if (!ds) return

  const dsUrl = resolveDatasourceUrl(ds)
  if (!dsUrl) return

  try {
    await ElMessageBox.confirm(`确定删除索引「${row.index}」吗？此操作不可恢复。`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    const baseUrl = dsUrl.replace(/\/+$/, '')
    if (ds.external) {
      const headers = getExternalProxyHeaders(ds)
      await pixiuAxios.delete('/pixiu/external', { params: { url: `${baseUrl}/${row.index}` }, headers })
    } else {
      const proxyPath = buildClusterServiceProxyPath(
        ds.clusterName,
        baseUrl,
        `/${encodeURIComponent(row.index)}`
      )
      await kubeProxyAxios.delete(proxyPath)
    }
    ElMessage.success(`索引「${row.index}」已删除`)
    fetchIndices()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e?.response?.data?.message || e?.message || '删除失败')
    }
  }
}

function handleIndexSearch() {
  indexPage.value = 1
  fetchIndices()
}

function handleIndexSelectionChange(selection: IndexItem[]) {
  selectedIndices.value = selection
}

async function fetchIndices() {
  const ds = selectedDatasource.value
  if (!ds) return

  const dsUrl = resolveDatasourceUrl(ds)
  if (!dsUrl) return

  indexLoading.value = true
  indexData.value = []
  try {
    const baseUrl = dsUrl.replace(/\/+$/, '')
    const search = indexSearch.value.trim()
    const indexPattern = search ? `${search}*` : '*'

    let body: any
    if (ds.external) {
      const params: Record<string, string> = { url: baseUrl, format: 'json' }
      if (indexHealthFilter.value) {
        params.health = indexHealthFilter.value
      }
      if (indexSort.value) {
        params.s = indexSort.value
      }
      const headers = getExternalProxyHeaders(ds)
      const res = await pixiuAxios.get(`/pixiu/external/_cat/indices/${encodeURIComponent(indexPattern)}`, {
        params,
        headers
      })
      body = res.data?.result ?? res.data
    } else {
      let proxyPath = buildClusterServiceProxyPath(
        ds.clusterName,
        baseUrl,
        `/_cat/indices/${encodeURIComponent(indexPattern)}`
      )
      const queryParams: string[] = ['format=json']
      if (indexHealthFilter.value) {
        queryParams.push(`health=${encodeURIComponent(indexHealthFilter.value)}`)
      }
      if (indexSort.value) {
        queryParams.push(`s=${encodeURIComponent(indexSort.value)}`)
      }
      proxyPath = `${proxyPath}?${queryParams.join('&')}`
      const res = await kubeProxyAxios.get(proxyPath)
      body = res.data?.result ?? res.data
    }
    indexData.value = (Array.isArray(body) ? body : []).map((item: any) => ({
      index: item.index ?? item['index'] ?? '-',
      health: item.health ?? '-',
      status: item.status ?? '-',
      pri: item.pri ?? '-',
      rep: item.rep ?? '-',
      docs_count: item['docs.count'] ?? item.docs_count ?? '0',
      store_size: item['store.size'] ?? item.store_size ?? '-',
      read_only: false
    }))
    fetchReadOnlySettings()
  } catch {
    indexData.value = []
  } finally {
    indexLoading.value = false
  }
}

async function fetchReadOnlySettings() {
  const ds = selectedDatasource.value
  if (!ds) return
  const dsUrl = resolveDatasourceUrl(ds)
  if (!dsUrl) return

  try {
    let body: any
    const settingsPath =
      '/_settings/index.blocks.read_only,index.blocks.read_only_allow_delete?flat_settings=true'
    if (ds.external) {
      const headers = getExternalProxyHeaders(ds)
      const res = await pixiuAxios.get(
        '/pixiu/external/_settings/index.blocks.read_only,index.blocks.read_only_allow_delete',
        {
          params: { url: dsUrl.replace(/\/+$/, ''), flat_settings: 'true' },
          headers
        }
      )
      body = res.data?.result ?? res.data
    } else {
      const proxyPath = buildClusterServiceProxyPath(
        ds.clusterName,
        dsUrl.replace(/\/+$/, ''),
        settingsPath
      )
      const res = await kubeProxyAxios.get(proxyPath)
      body = res.data?.result ?? res.data
    }
    if (body && typeof body === 'object') {
      indexData.value = indexData.value.map((item) => ({
        ...item,
        read_only: isIndexReadOnlyFromSettings(body[item.index])
      }))
    }
  } catch {
    // keep defaults
  }
}

/** 解析 ES _settings 中的只读状态（兼容 flat / nested） */
function isIndexReadOnlyFromSettings(indexEntry: any): boolean {
  if (!indexEntry || typeof indexEntry !== 'object') return false
  const settings = indexEntry.settings
  if (!settings || typeof settings !== 'object') return false

  const truthy = (v: unknown) => v === true || v === 'true'

  // flat_settings=true: { "index.blocks.read_only": "true" }
  if (
    truthy(settings['index.blocks.read_only']) ||
    truthy(settings['index.blocks.read_only_allow_delete'])
  ) {
    return true
  }

  // nested: { index: { blocks: { read_only: "true" } } }
  const blocks = settings.index?.blocks
  if (blocks && typeof blocks === 'object') {
    if (truthy(blocks.read_only) || truthy(blocks.read_only_allow_delete)) {
      return true
    }
  }

  // partially flat under index: { index: { "blocks.read_only": "true" } }
  const indexSettings = settings.index
  if (indexSettings && typeof indexSettings === 'object') {
    if (
      truthy(indexSettings['blocks.read_only']) ||
      truthy(indexSettings['blocks.read_only_allow_delete'])
    ) {
      return true
    }
  }

  return false
}

async function handleToggleReadOnly(row: IndexItem) {
  const ds = selectedDatasource.value
  if (!ds) return
  const dsUrl = resolveDatasourceUrl(ds)
  if (!dsUrl) return

  const newState = !row.read_only
  try {
    const baseUrl = dsUrl.replace(/\/+$/, '')
    // ES 接受扁平键；解除时需同时清 read_only / read_only_allow_delete
    const payload = newState
      ? { 'index.blocks.read_only': true }
      : { 'index.blocks.read_only': null, 'index.blocks.read_only_allow_delete': null }
    if (ds.external) {
      const headers = getExternalProxyHeaders(ds)
      await pixiuAxios.put(`/pixiu/external/${encodeURIComponent(row.index)}/_settings`, payload, {
        params: { url: baseUrl },
        headers
      })
    } else {
      const proxyPath = buildClusterServiceProxyPath(
        ds.clusterName,
        baseUrl,
        `/${encodeURIComponent(row.index)}/_settings`
      )
      await kubeProxyAxios.put(proxyPath, payload)
    }
    row.read_only = newState
    ElMessage.success(`索引「${row.index}」已设为${newState ? '只读' : '读写'}`)
    // 再拉一次设置，避免本地状态与 ES 不一致
    await fetchReadOnlySettings()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
  }
}

watch(activeTab, (tab) => {
  if (tab === 'index') {
    fetchIndices()
  }
})

watch(selectedDsId, () => {
  indexPage.value = 1
  if (activeTab.value === 'index') {
    fetchIndices()
  }
})


</script>

<style lang="scss" scoped>
.es-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  overflow: hidden;
}

/* ---- top card ---- */
.es-top-card {
  flex-shrink: 0;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.es-rule-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.es-rule-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.es-rule-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.es-rule-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.es-rule-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.es-rule-select {
  width: 200px;
}

.es-datasource-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.es-health-info {
  display: flex;
  align-items: center;
  gap: 21px;
  flex-wrap: wrap;
  margin-left: 20px;
}

.es-health-info-item {
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.es-health-status-value.is-green {
  color: #16a34a;
}

.es-health-status-value.is-yellow {
  color: #ca8a04;
}

.es-health-status-value.is-red {
  color: #dc2626;
}

.es-health-status-value.is-loading,
.es-health-status-value.is-error {
  color: var(--el-text-color-placeholder);
}

.es-ds-select :deep(.el-select__wrapper) {
  min-height: 32px;
}

.es-ds-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.es-ds-logo {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.es-ds-logo.is-es {
  color: #2563eb;
  background: #eff6ff;
}

.es-ds-logo-icon {
  width: 14px;
  height: 14px;
}

.es-ds-option-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.es-ds-cluster-tag {
  flex-shrink: 0;
}

.es-health-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  flex-shrink: 0;
  padding: 0 8px;
  border-radius: 10px;
  height: 22px;
  line-height: 1;
}

.es-health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.es-health-badge.is-green {
  color: #16a34a;
  background: #f0fdf4;
  .es-health-dot { background: #16a34a; }
}

.es-health-badge.is-yellow {
  color: #ca8a04;
  background: #fefce8;
  .es-health-dot { background: #ca8a04; }
}

.es-health-badge.is-red {
  color: #dc2626;
  background: #fef2f2;
  .es-health-dot { background: #dc2626; }
}

.es-health-badge.is-loading {
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
  .es-health-dot { background: var(--el-text-color-placeholder); animation: es-pulse 1.2s infinite; }
}

.es-health-badge.is-error {
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
  .es-health-dot { background: var(--el-text-color-placeholder); }
}

@keyframes es-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* ---- table card ---- */
.es-page :deep(.art-table-card) {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.es-page :deep(.art-table-card--after-toolbar) {
  margin-top: 0;
}

.es-page :deep(.art-table-card > .el-card__body) {
  padding-top: 8px;
  padding-bottom: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.es-page :deep(.es-tabs) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.es-page :deep(.es-tabs .el-tabs__header) {
  margin: 0 0 12px;
  flex-shrink: 0;
}

.es-page :deep(.es-tabs .el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--el-border-color-lighter);
}

.es-page :deep(.es-tabs .el-tabs__item) {
  height: 40px;
  line-height: 40px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.es-page :deep(.es-tabs .el-tabs__item.is-active) {
  color: var(--el-color-primary);
  font-weight: 600;
}

.es-page :deep(.es-tabs .el-tabs__active-bar) {
  height: 2px;
  border-radius: 2px 2px 0 0;
}

.es-page :deep(.es-tabs .el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.es-page :deep(.es-tabs .el-tab-pane) {
  flex: 1;
  height: auto !important;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.es-page :deep(.es-tabs .art-table) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: auto !important;
  overflow: visible;
}

.es-page :deep(.es-tabs .art-table .el-table) {
  flex: 1 1 0;
  min-height: 0;
  height: 100% !important;
}

.custom-pagination {
  display: flex;
  flex: 0 0 auto;
  margin-top: 10px;
  margin-bottom: 0;
  padding-bottom: 4px;
  box-sizing: border-box;

  &.right {
    justify-content: flex-end;
  }

  :deep(.el-select) {
    width: 102px !important;
  }

  :deep(.el-pagination) {
    padding: 0;

    .btn-prev,
    .btn-next {
      background-color: transparent;
      border: 1px solid var(--art-gray-300);
      transition: border-color 0.15s;

      &:hover:not(.is-disabled) {
        color: var(--theme-color);
        border-color: var(--theme-color);
      }
    }

    li {
      box-sizing: border-box;
      font-weight: 400 !important;
      background-color: transparent;
      border: 1px solid var(--art-gray-300);
      transition: border-color 0.15s;

      &.is-active {
        font-weight: 400;
        color: #fff;
        background-color: var(--theme-color);
        border: 1px solid var(--theme-color);
      }

      &:hover:not(.is-disabled) {
        border-color: var(--theme-color);
      }
    }
  }
}

/* ---- index toolbar（对齐告警配置 alert-toolbar-outer） ---- */
.es-index-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.es-index-toolbar__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.es-index-toolbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.es-index-toolbar__search {
  width: 280px;

  :deep(.el-input__wrapper),
  :deep(.el-input__inner),
  :deep(.el-input__wrapper input) {
    font-size: 12px;
    color: var(--el-text-color-primary);
  }

  :deep(.el-input__inner::placeholder),
  :deep(.el-input__wrapper input::placeholder),
  :deep(input::placeholder) {
    font-size: 12px !important;
    color: var(--el-text-color-placeholder);
    opacity: 1;
  }
}

.es-index-toolbar__sort {
  width: 110px;

  :deep(.el-select__wrapper),
  :deep(.el-select__selected-item),
  :deep(.el-select__placeholder) {
    font-size: 12px;
  }
}

.es-index-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.es-index-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.es-index-table {
  width: 100%;
}

.es-page :deep(.es-tabs .el-table th),
.es-page :deep(.es-tabs .el-table td) {
  font-size: 12px;
}

.es-page :deep(.es-tabs .el-table__empty-text) {
  font-size: 12px;
}

/* ---- alert ---- */
.quota-alert {
  flex-shrink: 0;
  margin: 0 0 12px;
}
</style>
