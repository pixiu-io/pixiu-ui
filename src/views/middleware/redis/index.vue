<!-- Redis 管理页面（第一版：只读浏览，外部直连数据源） -->
<template>
  <div class="redis-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      description="管理 Redis 数据源，支持连接探测、实例概览与 Key 浏览维护（新增/删除/修改 TTL）。请先在数据源管理中添加 Redis 类型数据源。"
      @close="alertVisible = false"
    />

    <section class="redis-top-card">
      <div class="redis-rule-bar">
        <div class="redis-rule-main">
          <div class="redis-rule-left">
            <span class="redis-rule-label">实例名称</span>
            <span class="redis-datasource-wrap">
              <ElSelect
                v-model="selectedDsId"
                class="redis-rule-select redis-ds-select"
                placeholder="请选择 Redis 数据源"
                :loading="dsLoading"
                clearable
                @change="onDsChange"
              >
                <template #label="{ value }">
                  <span v-if="value && selectedDatasource" class="redis-ds-option">
                    <span class="redis-ds-logo is-redis">
                      <ArtSvgIcon icon="simple-icons:redis" class="redis-ds-logo-icon" />
                    </span>
                    <span class="redis-ds-option-name">{{ selectedDatasource.name }}</span>
                  </span>
                </template>
                <ElOption
                  v-for="ds in dsList"
                  :key="ds.id"
                  :label="ds.name"
                  :value="ds.id"
                >
                  <span class="redis-ds-option">
                    <span class="redis-ds-logo is-redis">
                      <ArtSvgIcon icon="simple-icons:redis" class="redis-ds-logo-icon" />
                    </span>
                    <span class="redis-ds-option-name">{{ ds.name }}</span>
                  </span>
                </ElOption>
              </ElSelect>
              <div v-if="selectedDatasource" class="redis-health-info">
                <span class="redis-health-info-item">
                  连接状态：<span class="redis-health-status-value" :class="pingBadgeClass">{{ pingStatusText }}</span>
                </span>
                <span v-if="pingData?.connected" class="redis-health-info-item">延迟：{{ pingData.latencyMs }}ms</span>
                <span v-if="infoData?.redisVersion" class="redis-health-info-item">版本：{{ infoData.redisVersion }}</span>
                <span v-if="infoData?.redisMode" class="redis-health-info-item">模式：{{ infoData.redisMode }}</span>
                <span v-if="infoData?.usedMemoryHuman" class="redis-health-info-item">内存：{{ infoData.usedMemoryHuman }}</span>
                <span v-if="infoData" class="redis-health-info-item">客户端连接数：{{ infoData.connectedClients }}</span>
                <span v-if="infoData" class="redis-health-info-item">Key 总数（DB {{ currentDb }}）：{{ infoData.totalKeys }}</span>
                <span v-if="isClusterMode" class="redis-cluster-tip">cluster 模式：INFO/DBSIZE 为单节点视角，数据量统计仅代表单个节点</span>
              </div>
            </span>
          </div>
        </div>
        <div v-if="pingData && !pingData.connected && pingData.message" class="redis-health-error">
          {{ pingData.message }}
        </div>
      </div>
    </section>

    <div class="redis-body">
      <div class="redis-keys-toolbar">
        <div class="redis-keys-toolbar__left">
          <ElButton
            v-ripple
            class="redis-btn-create"
            :disabled="!isConnected || keysLoading"
            @click="openCreateDialog"
          >
            新增 Key
          </ElButton>
          <ElButton
            v-ripple
            :loading="batchDeleteLoading"
            :disabled="!isConnected || keysLoading || selectedRows.length === 0"
            @click="handleBatchDelete"
          >
            批量删除{{ selectedRows.length ? `（${selectedRows.length}）` : '' }}
          </ElButton>
        </div>
        <div class="redis-keys-toolbar__right">
          <ElInput
            v-model="matchPattern"
            clearable
            placeholder="Key 匹配模式，如 user:*"
            class="redis-keys-toolbar__search"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <ElButton v-ripple @click="handleSearch">搜索</ElButton>
          <ArtTableHeader
            v-model:columns="keyColumnChecks"
            :loading="keysLoading"
            full-class="redis-page"
            @refresh="resetScan"
          />
        </div>
      </div>
      <div class="redis-content">
      <aside class="redis-db-side" :class="{ 'is-collapsed': isDbCollapsed }">
        <div class="redis-db-side__header">
          <div v-if="!isDbCollapsed" class="redis-db-side__title">逻辑库</div>
          <button
            type="button"
            class="redis-db-side__toggle"
            :title="isDbCollapsed ? '展开逻辑库列表' : '折叠逻辑库列表'"
            @click="isDbCollapsed = !isDbCollapsed"
          >
            <ElIcon :size="16">
              <component :is="isDbCollapsed ? Expand : Fold" />
            </ElIcon>
          </button>
        </div>
        <template v-if="!isDbCollapsed">
          <ElInput
            v-model="dbSearch"
            clearable
            placeholder="搜索逻辑库"
            class="redis-db-side__search"
          />
          <div class="redis-db-list">
            <button
              v-for="n in filteredDBs"
              :key="n"
              type="button"
              class="redis-db-item"
              :class="{ 'is-active': currentDb === n }"
              :disabled="!isConnected || (isClusterMode && n !== 0)"
              @click="selectDb(n)"
            >
              <ArtSvgIcon icon="ri:database-2-line" style="width: 14px; height: 14px;" />
              <span>DB{{ n }}</span>
            </button>
            <div v-if="!filteredDBs.length" class="redis-db-side__empty">无匹配逻辑库</div>
          </div>
        </template>
      </aside>
      <div class="redis-main">
    <ElCard class="art-table-card art-table-card--after-toolbar">
      <div class="redis-keys-table-wrap">
        <div class="redis-keys-table-scroll">
          <ElTable
            ref="keysTableRef"
            :data="keyList"
            class="redis-keys-table"
            style="width: 100%"
            :size="tableSize"
            :stripe="isZebra"
            :border="isBorder"
            :header-cell-style="headerCellStyle"
            empty-text="请先选择 Redis 数据源"
            v-loading="keysLoading"
            @selection-change="onSelectionChange"
            @row-click="handleViewKey"
          >
            <ElTableColumn type="selection" width="30" />
            <ElTableColumn
              v-if="isKeyColVisible('key')"
              prop="key"
              label="Key"
              min-width="180"
              show-overflow-tooltip
            />
            <ElTableColumn v-if="isKeyColVisible('type')" prop="type" label="类型" width="110">
              <template #default="{ row }">{{ row.type }}</template>
            </ElTableColumn>
            <ElTableColumn v-if="isKeyColVisible('ttl')" label="TTL" width="140">
              <template #default="{ row }">{{ formatTTL(row.ttl) }}</template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <div class="redis-ops">
                  <ElLink type="primary" underline="never" style="font-size:12px" @click.stop="handleViewKey(row as RedisKeyItem)">
                    查看
                  </ElLink>
                  <ElLink
                    v-if="(row as RedisKeyItem).type === 'string'"
                    type="primary"
                    underline="never"
                    style="font-size:12px"
                    @click.stop="openEditDialog(row as RedisKeyItem)"
                  >
                    编辑
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    style="font-size:12px"
                    @click.stop="openTtlDialog(row as RedisKeyItem)"
                  >
                    TTL
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    style="font-size:12px"
                    @click.stop="handleDeleteKey(row as RedisKeyItem)"
                  >
                    删除
                  </ElLink>
                </div>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <div class="pagination custom-pagination right">
          <ElPagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :disabled="keysLoading"
            :page-sizes="[10, 20, 30, 50, 100]"
            :total="paginationTotal"
            :background="true"
            :pager-count="5"
            layout="total, prev, pager, next, sizes, jumper"
            @current-change="handleCurrentChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </div>
    </ElCard>
      </div>
      </div>
    </div>

    <!-- Key 详情抽屉 -->
    <ElDrawer v-model="detailVisible" title="Key 详情" size="560px" destroy-on-close>
      <div v-loading="detailLoading" class="redis-detail">
        <template v-if="keyDetail">
          <ElDescriptions :column="1" border size="small" class="redis-detail__meta">
            <ElDescriptionsItem label="Key">{{ keyDetail.key }}</ElDescriptionsItem>
            <ElDescriptionsItem label="类型">{{ keyDetail.type }}</ElDescriptionsItem>
            <ElDescriptionsItem label="TTL">{{ formatTTL(keyDetail.ttl) }}</ElDescriptionsItem>
            <ElDescriptionsItem v-if="keyDetail.encoding" label="编码">{{ keyDetail.encoding }}</ElDescriptionsItem>
            <ElDescriptionsItem label="内存占用">{{ formatSize(keyDetail.sizeBytes) }}</ElDescriptionsItem>
          </ElDescriptions>

          <ElAlert
            v-if="keyDetail.truncated"
            type="warning"
            :closable="false"
            show-icon
            class="redis-detail__truncated"
            description="值过大，已截断展示（字符串最多 4096 字符 / 集合最多 100 个元素）"
          />

          <div class="redis-detail__value-title">
            值
            <ElButton
              v-if="keyDetail.type === 'string'"
              type="primary"
              link
              size="small"
              class="redis-detail__value-edit"
              @click="openEditFromDetail"
            >
              编辑
            </ElButton>
          </div>
          <!-- string -->
          <ElInput
            v-if="keyDetail.type === 'string'"
            :model-value="String(keyDetail.value ?? '')"
            type="textarea"
            :rows="10"
            readonly
            class="redis-detail__value-mono"
          />
          <!-- hash -->
          <ElTable
            v-else-if="keyDetail.type === 'hash'"
            :data="hashEntries"
            size="small"
            max-height="400"
            border
          >
            <ElTableColumn prop="field" label="Field" min-width="160" show-overflow-tooltip />
            <ElTableColumn prop="value" label="Value" min-width="220" show-overflow-tooltip />
          </ElTable>
          <!-- list / set / zset -->
          <ElTable
            v-else-if="['list', 'set', 'zset'].includes(keyDetail.type)"
            :data="collectionEntries"
            size="small"
            max-height="400"
            border
          >
            <ElTableColumn prop="index" label="#" width="60" align="right" />
            <ElTableColumn prop="value" label="元素" min-width="300" show-overflow-tooltip />
          </ElTable>
          <!-- 其他类型 -->
          <ElInput
            v-else
            :model-value="typeof keyDetail.value === 'string' ? keyDetail.value : JSON.stringify(keyDetail.value)"
            type="textarea"
            :rows="6"
            readonly
          />
        </template>
      </div>
    </ElDrawer>

    <!-- 新增 Key 弹窗 -->
    <ElDialog v-model="createVisible" title="新增 Key" width="480px" destroy-on-close>
      <ElForm label-width="90px" label-position="left">
        <ElFormItem label="Key" required>
          <ElInput
            v-model="createForm.key"
            placeholder="请输入 Key 名称"
            maxlength="512"
            show-word-limit
            clearable
          />
        </ElFormItem>
        <ElFormItem label="Value">
          <ElInput
            v-model="createForm.value"
            type="textarea"
            :rows="6"
            placeholder="可选，string 类型的值"
          />
        </ElFormItem>
        <ElFormItem label="TTL（秒）">
          <ElInputNumber
            v-model="createForm.ttl"
            :min="0"
            :max="31536000"
            controls-position="right"
            class="redis-num-input"
          />
          <div class="redis-form-hint">0 表示永不过期</div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="createVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="createLoading" @click="submitCreateKey">创建</ElButton>
      </template>
    </ElDialog>

    <!-- 修改 TTL 弹窗 -->
    <ElDialog v-model="ttlVisible" title="修改 TTL" width="440px" destroy-on-close>
      <ElForm label-width="90px">
        <ElFormItem label="过期策略">
          <ElRadioGroup v-model="ttlForm.mode" class="redis-ttl-mode">
            <ElRadioButton value="expire">设置时间</ElRadioButton>
            <ElRadioButton value="persist">永不过期</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem v-if="ttlForm.mode === 'expire'" label="TTL">
          <ElInputNumber
            v-model="ttlForm.seconds"
            :min="1"
            :max="31536000"
            style="width: 120px"
          />
          <span style="font-size: 12px; color: var(--el-text-color-regular); margin-left: 4px">秒</span>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="ttlVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="ttlLoading" @click="submitTtl">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 编辑 Key 值弹窗（仅 string，保持原 TTL） -->
    <ElDialog v-model="editVisible" title="编辑 Key 值" width="520px" destroy-on-close body-class="redis-edit-dialog-body">
      <ElForm label-width="60px" label-position="left">
        <ElFormItem label="Key">
          <ElInput :model-value="editForm.key" disabled />
        </ElFormItem>
        <ElFormItem label="Value">
          <ElInput
            v-model="editForm.value"
            type="textarea"
            :rows="4"
            placeholder="string 类型的值"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="editLoading" @click="submitEditValue">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchDatasourceList, type DatasourceItem } from '@/api/datasource'
import {
  fetchRedisPing,
  fetchRedisInfo,
  fetchRedisKeys,
  fetchRedisKeyDetail,
  fetchRedisCreateKey,
  fetchRedisDeleteKey,
  fetchRedisDeleteKeys,
  fetchRedisUpdateKeyValue,
  fetchRedisSetKeyTTL,
  type RedisPingResult,
  type RedisInfoResult,
  type RedisKeyItem,
  type RedisKeyDetail
} from '@/api/redis'
import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
import { useTableStore } from '@/store/modules/table'
import type { ColumnOption } from '@/types'
import { Expand, Fold } from '@element-plus/icons-vue'

defineOptions({ name: 'MiddlewareRedis' })

const tableStore = useTableStore()
const { tableSize, isZebra, isBorder, isHeaderBackground } = storeToRefs(tableStore)

const headerCellStyle = computed(() => ({
  background: isHeaderBackground.value
    ? 'var(--el-fill-color-lighter)'
    : 'var(--default-box-color)'
}))

// ---- 数据源选择 ----
const alertVisible = ref(true)
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
      subType: 'redis'
    })
    dsList.value = items
  } catch (e: any) {
    ElMessage.error(e?.message || '获取 Redis 数据源列表失败')
  } finally {
    dsLoading.value = false
  }
}

loadDsList()

// ---- 连接探测与概览 ----
const pingLoading = ref(false)
const pingData = ref<RedisPingResult | null>(null)
const infoData = ref<RedisInfoResult | null>(null)

// ---- 逻辑库选择（DB0-DB15；cluster 模式仅 DB0） ----
const currentDb = ref(0)

// 逻辑库侧边栏折叠与搜索（样式对齐日志页字段列表）
const isDbCollapsed = ref(false)
const dbSearch = ref('')
const filteredDBs = computed(() => {
  const keyword = dbSearch.value.trim().toLowerCase()
  const all = Array.from({ length: 16 }, (_, i) => i)
  if (!keyword) return all
  return all.filter((db) => `db${db}`.includes(keyword) || String(db).includes(keyword))
})

const isClusterMode = computed(() => {
  if (infoData.value?.redisMode === 'cluster') return true
  return selectedDatasource.value?.config?.redis?.mode === 'cluster'
})

function defaultDbOf(ds: DatasourceItem | null): number {
  if (!ds) return 0
  if (ds.config?.redis?.mode === 'cluster') return 0
  const db = ds.config?.redis?.db
  return typeof db === 'number' && db >= 0 && db <= 15 ? db : 0
}

function onDbChange() {
  resetScan()
  loadOverview()
}

function selectDb(db: number) {
  if (db === currentDb.value) return
  currentDb.value = db
  onDbChange()
}

const pingBadgeClass = computed(() => {
  if (pingLoading.value) return 'is-loading'
  if (!pingData.value) return 'is-error'
  return pingData.value.connected ? 'is-green' : 'is-red'
})

const pingStatusText = computed(() => {
  if (pingLoading.value) return '...'
  if (!pingData.value) return 'N/A'
  return pingData.value.connected ? '已连接' : '连接失败'
})

async function loadOverview() {
  const ds = selectedDatasource.value
  if (!ds) {
    pingData.value = null
    infoData.value = null
    return
  }

  pingLoading.value = true
  pingData.value = null
  infoData.value = null
  try {
    const ping = await fetchRedisPing(ds.id)
    pingData.value = ping
    if (!ping.connected) return
    infoData.value = await fetchRedisInfo(ds.id, currentDb.value)
  } catch (e: any) {
    pingData.value = { connected: false, latencyMs: 0, message: e?.message || '连接探测失败' }
  } finally {
    pingLoading.value = false
  }
}

function onDsChange() {
  keyList.value = []
  detailVisible.value = false
  currentDb.value = defaultDbOf(selectedDatasource.value)
  if (selectedDsId.value) {
    loadOverview()
    resetScan()
  }
}

watch(selectedDsId, (id) => {
  if (!id) {
    pingData.value = null
    infoData.value = null
    keyList.value = []
    currentDb.value = 0
    cursor.value = 0
    nextCursor.value = 0
    pageStartCursors.value = [0]
    currentPage.value = 1
    loadedPage.value = 1
  }
})

// ---- Key 浏览（SCAN cursor 透传顺序翻页） ----
const matchPattern = ref('')
const keysLoading = ref(false)
const keyList = ref<RedisKeyItem[]>([])
const pageSize = ref(10)
/** 当前页请求使用的 SCAN cursor（0 = 从头扫描） */
const cursor = ref(0)
/** 当前页返回的下一游标，0 表示已扫描到底 */
const nextCursor = ref(0)
/** 每页起始 SCAN cursor，下标 = 页码 - 1 */
const pageStartCursors = ref<number[]>([0])
const currentPage = ref(1)
const loadedPage = ref(1)
/** 程序改页码时跳过 current-change，避免重复 SCAN */
let pagingSilent = false
const MAX_SCAN_HOPS = 40

// SCAN 无精确总数：扫完用已见条数；未过滤时用 INFO 的 totalKeys；未扫完则预留下一页（与 ES 一致允许 total=0）
const paginationTotal = computed(() => {
  const scanned = (loadedPage.value - 1) * pageSize.value + keyList.value.length
  if (nextCursor.value === 0) return scanned
  const infoTotal = infoData.value?.totalKeys ?? 0
  if (!matchPattern.value.trim() && infoTotal > scanned) return infoTotal
  return scanned + 1
})

const keyColumnChecks = ref<ColumnOption[]>([
  { prop: 'key', label: 'Key', checked: true },
  { prop: 'type', label: '类型', checked: true },
  { prop: 'ttl', label: 'TTL', checked: true }
])

function isKeyColVisible(prop: string) {
  const col = keyColumnChecks.value.find((item) => item.prop === prop)
  if (!col) return true
  if (col.visible !== undefined) return col.visible
  return col.checked ?? true
}

async function loadKeys() {
  const ds = selectedDatasource.value
  if (!ds) return
  keysLoading.value = true
  try {
    const result = await fetchRedisKeys(ds.id, {
      cursor: cursor.value,
      count: pageSize.value,
      match: matchPattern.value.trim() || undefined,
      db: currentDb.value
    })
    keyList.value = result.keys
    nextCursor.value = result.cursor
    loadedPage.value = currentPage.value
    if (result.cursor !== 0) {
      const next = [...pageStartCursors.value]
      next[currentPage.value] = result.cursor
      pageStartCursors.value = next
    }
  } catch (e: any) {
    keyList.value = []
    ElMessage.error(e?.message || '扫描 Key 失败')
  } finally {
    keysLoading.value = false
  }
}

/** 回到第 1 页（搜索/换 DB/换页大小/刷新/写操作后使用） */
function resetScan() {
  pagingSilent = true
  currentPage.value = 1
  loadedPage.value = 1
  cursor.value = 0
  nextCursor.value = 0
  pageStartCursors.value = [0]
  selectedRows.value = []
  keysTableRef.value?.clearSelection()
  const pending = selectedDatasource.value ? loadKeys() : Promise.resolve()
  void pending.finally(() => {
    pagingSilent = false
  })
}

function handleSearch() {
  resetScan()
}

async function goToPage(targetPage: number) {
  if (!selectedDatasource.value) return
  if (targetPage === loadedPage.value) {
    currentPage.value = targetPage
    return
  }
  if (targetPage < 1) {
    pagingSilent = true
    currentPage.value = 1
    pagingSilent = false
    return
  }

  if (pageStartCursors.value[targetPage - 1] !== undefined) {
    cursor.value = pageStartCursors.value[targetPage - 1]!
    currentPage.value = targetPage
    await loadKeys()
    return
  }

  const hops = targetPage - loadedPage.value
  if (hops > MAX_SCAN_HOPS) {
    ElMessage.warning('Redis SCAN 不支持跨度过远的跳页，请逐页翻阅或缩小匹配范围')
    pagingSilent = true
    currentPage.value = loadedPage.value
    pagingSilent = false
    return
  }

  while (loadedPage.value < targetPage && nextCursor.value !== 0) {
    const nextPage = loadedPage.value + 1
    const start = pageStartCursors.value[nextPage - 1]
    if (start === undefined) break
    cursor.value = start
    currentPage.value = nextPage
    await loadKeys()
  }

  if (loadedPage.value !== targetPage) {
    pagingSilent = true
    currentPage.value = loadedPage.value
    pagingSilent = false
  }
}

async function handleCurrentChange(page: number) {
  if (pagingSilent) return
  await goToPage(page)
}

function handlePageSizeChange() {
  resetScan()
}

function formatTTL(ttl: number): string {
  if (ttl === -1) return '永不过期'
  if (ttl === -2) return '已过期'
  return `${ttl}s`
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ---- Key 详情 ----
const detailVisible = ref(false)
const detailLoading = ref(false)
const keyDetail = ref<RedisKeyDetail | null>(null)

const hashEntries = computed(() => {
  if (!keyDetail.value || keyDetail.value.type !== 'hash') return []
  const value = keyDetail.value.value
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).map(([field, v]) => ({
    field,
    value: typeof v === 'string' ? v : JSON.stringify(v)
  }))
})

const collectionEntries = computed(() => {
  if (!keyDetail.value || !['list', 'set', 'zset'].includes(keyDetail.value.type)) return []
  const value = keyDetail.value.value
  if (!Array.isArray(value)) return []
  return value.map((item, index) => ({
    index: index + 1,
    value: typeof item === 'string' ? item : JSON.stringify(item)
  }))
})

async function handleViewKey(row: RedisKeyItem, column?: any) {
  // 点击多选列时不打开详情，避免与勾选操作冲突
  if (column?.type === 'selection') return
  const ds = selectedDatasource.value
  if (!ds) return

  detailVisible.value = true
  detailLoading.value = true
  keyDetail.value = null
  try {
    keyDetail.value = await fetchRedisKeyDetail(ds.id, row.key, currentDb.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取 Key 详情失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

// ---- 写操作：新增 / 删除 / 修改 TTL ----
const isConnected = computed(() => Boolean(pingData.value?.connected))

/** 写操作成功后刷新列表与概览 */
function refreshAfterWrite() {
  resetScan()
  loadOverview()
}

// 新增 Key
const createVisible = ref(false)
const createLoading = ref(false)
const createForm = ref({ key: '', value: '', ttl: 0 })

function openCreateDialog() {
  createForm.value = { key: '', value: '', ttl: 0 }
  createVisible.value = true
}

async function submitCreateKey() {
  const ds = selectedDatasource.value
  const key = createForm.value.key.trim()
  if (!ds || !key) {
    ElMessage.warning('请输入 Key 名称')
    return
  }
  createLoading.value = true
  try {
    await fetchRedisCreateKey(ds.id, {
      key,
      value: createForm.value.value,
      ttl: createForm.value.ttl || 0,
      db: currentDb.value
    })
    ElMessage.success('Key 创建成功')
    createVisible.value = false
    refreshAfterWrite()
  } catch (e: any) {
    ElMessage.error(e?.message || '新增 Key 失败')
  } finally {
    createLoading.value = false
  }
}

// 删除 Key
async function handleDeleteKey(row: RedisKeyItem) {
  const ds = selectedDatasource.value
  if (!ds) return
  try {
    await ElMessageBox.confirm(`确定删除 Key「${row.key}」吗？该操作不可恢复。`, '删除 Key', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
  } catch {
    return
  }
  try {
    await fetchRedisDeleteKey(ds.id, row.key, currentDb.value)
    ElMessage.success('Key 已删除')
    refreshAfterWrite()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除 Key 失败')
  }
}

// 批量删除 Key
const keysTableRef = ref<any>(null)
const selectedRows = ref<RedisKeyItem[]>([])
const batchDeleteLoading = ref(false)

function onSelectionChange(rows: RedisKeyItem[]) {
  selectedRows.value = rows
}

async function handleBatchDelete() {
  const ds = selectedDatasource.value
  if (!ds || selectedRows.value.length === 0) return
  const keys = selectedRows.value.map((row) => row.key)
  try {
    await ElMessageBox.confirm(
      `确定批量删除选中的 ${keys.length} 个 Key 吗？该操作不可恢复。`,
      '批量删除 Key',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return
  }
  batchDeleteLoading.value = true
  try {
    const deleted = await fetchRedisDeleteKeys(ds.id, keys, currentDb.value)
    ElMessage.success(`已删除 ${deleted} 个 Key`)
    keysTableRef.value?.clearSelection()
    refreshAfterWrite()
  } catch (e: any) {
    ElMessage.error(e?.message || '批量删除 Key 失败')
  } finally {
    batchDeleteLoading.value = false
  }
}

// 编辑 Key 值（仅 string，保持原 TTL）
const editVisible = ref(false)
const editLoading = ref(false)
const editForm = ref({ key: '', value: '' })

async function openEditDialog(row: RedisKeyItem) {
  const ds = selectedDatasource.value
  if (!ds) return
  editForm.value = { key: row.key, value: '' }
  editVisible.value = true
  editLoading.value = true
  try {
    const detail = await fetchRedisKeyDetail(ds.id, row.key, currentDb.value)
    editForm.value.value = typeof detail.value === 'string' ? detail.value : String(detail.value ?? '')
    if (detail.truncated) {
      ElMessage.warning('值过大已截断，保存将丢失截断部分，请谨慎')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '获取 Key 值失败')
    editVisible.value = false
  } finally {
    editLoading.value = false
  }
}

function openEditFromDetail() {
  const detail = keyDetail.value
  if (!detail || detail.type !== 'string') return
  editForm.value = {
    key: detail.key,
    value: typeof detail.value === 'string' ? detail.value : String(detail.value ?? '')
  }
  if (detail.truncated) {
    ElMessage.warning('值过大已截断，保存将丢失截断部分，请谨慎')
  }
  editVisible.value = true
}

async function submitEditValue() {
  const ds = selectedDatasource.value
  if (!ds) return
  editLoading.value = true
  try {
    await fetchRedisUpdateKeyValue(ds.id, {
      key: editForm.value.key,
      value: editForm.value.value,
      db: currentDb.value
    })
    ElMessage.success('Key 值修改成功')
    editVisible.value = false
    refreshAfterWrite()
  } catch (e: any) {
    ElMessage.error(e?.message || '修改 Key 值失败')
  } finally {
    editLoading.value = false
  }
}

// 修改 TTL
const ttlVisible = ref(false)
const ttlLoading = ref(false)
const ttlForm = ref<{ key: string; mode: 'expire' | 'persist'; seconds: number }>({
  key: '',
  mode: 'expire',
  seconds: 3600
})

function openTtlDialog(row: RedisKeyItem) {
  if (!isConnected.value) return
  ttlForm.value = {
    key: row.key,
    mode: row.ttl === -1 ? 'persist' : 'expire',
    seconds: row.ttl > 0 ? row.ttl : 3600
  }
  ttlVisible.value = true
}

async function submitTtl() {
  const ds = selectedDatasource.value
  if (!ds) return
  const ttl = ttlForm.value.mode === 'persist' ? -1 : ttlForm.value.seconds
  if (ttlForm.value.mode === 'expire' && (!ttl || ttl < 1)) {
    ElMessage.warning('请输入有效的 TTL 秒数')
    return
  }
  ttlLoading.value = true
  try {
    await fetchRedisSetKeyTTL(ds.id, { key: ttlForm.value.key, ttl, db: currentDb.value })
    ElMessage.success('TTL 修改成功')
    ttlVisible.value = false
    refreshAfterWrite()
  } catch (e: any) {
    ElMessage.error(e?.message || '修改 TTL 失败')
  } finally {
    ttlLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.redis-page {
  display: flex;
  flex-direction: column;
  height: var(--art-full-height);
  padding: 0;
  overflow: hidden;
}

/* ---- 顶部卡片 ---- */
.redis-top-card {
  flex-shrink: 0;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.redis-rule-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.redis-rule-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.redis-rule-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.redis-rule-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.redis-rule-select {
  width: 200px;
}

.redis-datasource-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.redis-health-info {
  display: flex;
  align-items: center;
  gap: 21px;
  flex-wrap: wrap;
  margin-left: 20px;
}

.redis-health-info-item {
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.redis-health-status-value.is-green {
  color: #16a34a;
}

.redis-health-status-value.is-red {
  color: #dc2626;
}

.redis-health-status-value.is-loading,
.redis-health-status-value.is-error {
  color: var(--el-text-color-placeholder);
}

.redis-health-error {
  font-size: 12px;
  color: #dc2626;
  word-break: break-all;
}

.redis-cluster-tip {
  font-size: 12px;
  line-height: 1.5;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  padding: 2px 8px;
  word-break: break-all;
}

.redis-ds-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.redis-ds-logo {
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

.redis-ds-logo.is-redis {
  color: #dc382d;
  background: #fef2f2;
}

.redis-ds-logo-icon {
  width: 14px;
  height: 14px;
}

.redis-ds-option-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 表格卡片 ---- */
.redis-page :deep(.art-table-card) {
  margin-top: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.redis-page :deep(.art-table-card > .el-card__body) {
  padding-top: 8px;
  padding-bottom: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.redis-keys-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0;
  margin-bottom: 0;
  flex-shrink: 0;
}

.redis-keys-toolbar__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.redis-keys-toolbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 新增 Key 按钮：蓝色边框（描边），disabled 时保持蓝边框蓝字 */
.redis-btn-create.el-button {
  --el-button-bg-color: transparent !important;
  --el-button-border-color: var(--el-color-primary) !important;
  --el-button-text-color: var(--el-color-primary) !important;
  --el-button-hover-bg-color: var(--el-color-primary) !important;
  --el-button-hover-border-color: var(--el-color-primary) !important;
  --el-button-hover-text-color: #fff !important;
  --el-button-active-bg-color: var(--el-color-primary-dark-2) !important;
  --el-button-active-border-color: var(--el-color-primary-dark-2) !important;
}

.redis-btn-create.el-button.is-disabled {
  --el-button-bg-color: transparent !important;
  --el-button-border-color: var(--el-color-primary) !important;
  --el-button-text-color: var(--el-color-primary) !important;
  opacity: 1;
}

.redis-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  margin-top: 12px;
  overflow: hidden;
}

.redis-content {
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.redis-db-side {
  width: 180px;
  flex-shrink: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-blank);
  overflow: hidden;
  position: relative;
  min-height: 0;
  color: var(--el-text-color-regular);
  transition: width 0.2s ease;

  &.is-collapsed {
    width: 44px;
    padding: 12px 6px;
    overflow: hidden;
  }

  &::after {
    content: '';
    position: absolute;
    top: 12px;
    right: 0;
    bottom: 12px;
    width: 1px;
    background: var(--el-border-color-lighter);
    pointer-events: none;
  }
}

.redis-db-side__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin-bottom: 10px;
}

.redis-db-side__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 0;
}

.redis-db-side__toggle {
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
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
  }
}

.redis-db-side.is-collapsed .redis-db-side__header {
  justify-content: center;
  margin-bottom: 0;
}

.redis-db-side.is-collapsed .redis-db-side__toggle {
  margin-left: 0;
}

.redis-db-side__search {
  margin-bottom: 8px;

  :deep(.el-input__wrapper) {
    min-height: 30px;
    padding-top: 1px;
    padding-bottom: 1px;
  }

  :deep(.el-input__inner),
  :deep(input) {
    font-size: 12px;
  }

  :deep(.el-input__inner::placeholder),
  :deep(input::placeholder) {
    font-size: 12px !important;
  }
}

.redis-db-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-right: -4px;
  padding-right: 4px;

  /* 细滚动条：平时隐藏滑块（覆盖全局 !important），悬停列表时显示 */
  &::-webkit-scrollbar {
    width: 4px !important;
  }

  &::-webkit-scrollbar-track {
    background-color: transparent !important;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent !important;
    border-radius: 2px;
    transition: background-color 0.2s ease;
  }

  &:hover::-webkit-scrollbar-thumb {
    background-color: rgb(0 0 0 / 0.18) !important;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: rgb(0 0 0 / 0.28) !important;
  }
}

.redis-db-side__empty {
  padding: 12px 4px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
}

.redis-db-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  flex-shrink: 0;
  padding: 0 12px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  .el-icon {
    font-size: 15px;
  }

  &:hover:not(:disabled):not(.is-active) {
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
  }

  &.is-active {
    background: var(--el-color-primary);
    color: #fff;
    font-weight: 500;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.redis-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.redis-keys-toolbar__search {
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

.redis-keys-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.redis-keys-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.redis-keys-table {
  width: 100%;
}

/* 操作列按钮间距对齐集群页面：flex + gap 12px */
.redis-ops {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
}

.redis-page :deep(.redis-keys-table th),
.redis-page :deep(.redis-keys-table td) {
  font-size: 12px;
}

.redis-page :deep(.redis-keys-table .el-table__empty-text) {
  font-size: 12px;
}

/* 分页样式对齐 ES / art-table（描边按钮 + 主色选中态） */
.redis-page .pagination.custom-pagination {
  display: flex;
  flex: 0 0 auto;
  margin-top: 10px;
  margin-bottom: 0;
  padding-bottom: 4px;
  box-sizing: border-box;

  &.right {
    justify-content: flex-end;
  }
}

.redis-page .pagination.custom-pagination :deep(.el-select) {
  width: 102px !important;
}

.redis-page .pagination.custom-pagination :deep(.el-pagination) {
  padding: 0;
}

.redis-page .pagination.custom-pagination :deep(.el-pagination .btn-prev),
.redis-page .pagination.custom-pagination :deep(.el-pagination .btn-next) {
  background-color: transparent !important;
  border: 1px solid var(--art-gray-300);
  transition: border-color 0.15s;

  &:hover:not(.is-disabled) {
    color: var(--theme-color);
    border-color: var(--theme-color);
  }
}

.redis-page .pagination.custom-pagination :deep(.el-pagination .el-pager li) {
  box-sizing: border-box;
  font-weight: 400 !important;
  background-color: transparent !important;
  border: 1px solid var(--art-gray-300);
  transition: border-color 0.15s;

  &.is-active {
    font-weight: 400;
    color: #fff !important;
    background-color: var(--theme-color) !important;
    border: 1px solid var(--theme-color);
  }

  &:hover:not(.is-disabled) {
    border-color: var(--theme-color);
  }
}

/* ---- 详情抽屉 ---- */
.redis-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
}

.redis-detail__truncated {
  margin-top: 4px;
}

.redis-detail__value-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.redis-detail__value-edit {
  font-weight: 400;
}

.redis-detail__value-mono :deep(textarea) {
  font-family: 'JetBrains Mono', Consolas, Menlo, monospace;
  font-size: 12px;
}

/* ---- 提示条 ---- */
.quota-alert {
  flex-shrink: 0;
  margin: 0 0 12px;
}

/* ---- 写操作弹窗 ---- */
.redis-form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 4px;
}

.redis-ttl-mode {
  --el-radio-button-checked-border-color: var(--el-color-primary);
  --el-radio-button-checked-bg-color: var(--el-bg-color-overlay);
  --el-radio-button-checked-text-color: var(--el-color-primary);
  display: flex;
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  overflow: hidden;
  box-sizing: border-box;
  margin-top: 0;
  margin-bottom: 0;

  :deep(.el-radio-button) {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
  }

  :deep(.el-radio-button__inner) {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    font-size: 12px;
    padding: 0 10px;
    line-height: 10px;
    font-weight: 400;
    color: var(--el-text-color-regular);
    background: transparent;
    border: 1px solid var(--el-border-color);
    border-radius: 0 !important;
    transition:
      border-color 0.15s,
      color 0.15s,
      background-color 0.15s;
  }

  :deep(.el-radio-button:first-child .el-radio-button__inner),
  :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 !important;
  }

  :deep(.el-radio-button__inner:hover) {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: var(--el-bg-color-overlay) !important;
    color: var(--el-color-primary) !important;
    font-weight: 500 !important;
    border-color: var(--el-color-primary) !important;
    box-shadow: none !important;
    position: relative;
    z-index: 1;
  }
}

.redis-num-input {
  width: 100%;

  :deep(.el-input__inner) {
    text-align: left;
  }
}

/* 新增/编辑/TTL 弹窗内字体统一 12px */
.redis-page :deep(.el-dialog .el-form-item__label),
.redis-page :deep(.el-dialog .el-input__inner),
.redis-page :deep(.el-dialog .el-radio__label) {
  font-size: 12px;
}

/* 编辑 Key 值弹窗：间距与输入框留白优化。
   ElDialog inheritAttrs:false 不透传 class，需用 body-class（Element Plus 官方，加在 el-dialog__body 上）
   + :global 高特异性选择器覆盖全局 padding:25px 0 !important */
:global(.el-dialog__body.redis-edit-dialog-body) {
  padding: 16px 32px 4px 20px !important;
}

:global(.redis-edit-dialog-body .el-form-item) {
  margin-bottom: 16px;
}

:global(.redis-edit-dialog-body .el-form-item__label) {
  padding-right: 12px;
  color: var(--el-text-color-primary);
}

:global(.redis-edit-dialog-body .el-input__inner),
:global(.redis-edit-dialog-body .el-textarea__inner) {
  font-size: 12px;
}

</style>
