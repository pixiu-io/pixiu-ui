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
              </div>
            </span>
          </div>
          <div class="redis-rule-right">
            <ElButton
              v-ripple
              size="small"
              :loading="pingLoading"
              :disabled="!selectedDatasource"
              @click="loadOverview"
            >
              刷新
            </ElButton>
          </div>
        </div>
        <div v-if="pingData && !pingData.connected && pingData.message" class="redis-health-error">
          {{ pingData.message }}
        </div>
      </div>
    </section>

    <div class="redis-body">
      <aside class="redis-db-side">
        <button
          v-for="n in 16"
          :key="n - 1"
          type="button"
          class="redis-db-item"
          :class="{ 'is-active': currentDb === n - 1 }"
          :disabled="!isConnected || (isClusterMode && n - 1 !== 0)"
          @click="selectDb(n - 1)"
        >
          <ArtSvgIcon icon="ri:database-2-line" style="width: 14px; height: 14px;" />
          <span>DB{{ n - 1 }}</span>
        </button>
      </aside>
      <div class="redis-main">
    <div class="redis-keys-toolbar">
      <div class="redis-keys-toolbar__left">
        <ElInput
          v-model="matchPattern"
          clearable
          placeholder="Key 匹配模式，如 user:*"
          class="redis-keys-toolbar__search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <ElButton v-ripple @click="handleSearch">搜索</ElButton>
        <ElButton
          v-ripple
          type="primary"
          :disabled="!isConnected || keysLoading"
          @click="openCreateDialog"
        >
          新增 Key
        </ElButton>
      </div>
      <div class="redis-keys-toolbar__right">
        <ArtTableHeader
          v-model:columns="keyColumnChecks"
          :loading="keysLoading"
          full-class="redis-page"
          @refresh="resetScan"
        />
      </div>
    </div>

    <ElCard class="art-table-card art-table-card--after-toolbar">
      <div class="redis-keys-table-wrap">
        <div class="redis-keys-table-scroll">
          <ElTable
            :data="keyList"
            class="redis-keys-table"
            style="width: 100%"
            :size="tableSize"
            :stripe="isZebra"
            :border="isBorder"
            :header-cell-style="headerCellStyle"
            empty-text="请先选择 Redis 数据源"
            v-loading="keysLoading"
            @row-click="handleViewKey"
          >
            <ElTableColumn
              v-if="isKeyColVisible('key')"
              prop="key"
              label="Key"
              min-width="320"
              show-overflow-tooltip
            />
            <ElTableColumn v-if="isKeyColVisible('type')" prop="type" label="类型" width="110">
              <template #default="{ row }">
                <ElTag size="small" :type="typeTagMap[row.type] ?? 'info'" effect="plain">
                  {{ row.type }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn v-if="isKeyColVisible('ttl')" label="TTL" width="140">
              <template #default="{ row }">{{ formatTTL(row.ttl) }}</template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <ElLink type="primary" underline="never" style="font-size:12px" @click.stop="handleViewKey(row as RedisKeyItem)">
                  查看
                </ElLink>
                <ElLink
                  type="primary"
                  underline="never"
                  style="font-size:12px; margin-left:12px"
                  @click.stop="openTtlDialog(row as RedisKeyItem)"
                >
                  TTL
                </ElLink>
                <ElLink
                  type="primary"
                  underline="never"
                  style="font-size:12px; margin-left:12px"
                  @click.stop="handleDeleteKey(row as RedisKeyItem)"
                >
                  删除
                </ElLink>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <div class="redis-keys-footer">
          <span class="redis-keys-footer__hint">第 {{ currentPage }} 页 · 本页 {{ keyList.length }} 条</span>
          <div class="redis-pager">
            <span class="redis-pager__label">每页</span>
            <ElSelect
              v-model="pageSize"
              class="redis-pager__sizes"
              :disabled="keysLoading || !selectedDatasource"
              @change="onPageSizeChange"
            >
              <ElOption v-for="s in pageSizeOptions" :key="s" :label="`${s} 条`" :value="s" />
            </ElSelect>
            <ElButton
              v-ripple
              plain
              size="small"
              :disabled="!canPrevPage || keysLoading || !selectedDatasource"
              @click="handlePrevPage"
            >
              上一页
            </ElButton>
            <ElButton
              v-ripple
              plain
              size="small"
              :disabled="!canNextPage || keysLoading || !selectedDatasource"
              @click="handleNextPage"
            >
              下一页
            </ElButton>
            <span class="redis-pager__label">前往</span>
            <ElInputNumber
              v-model="jumpPage"
              :min="1"
              :max="9999999"
              size="small"
              controls-position="right"
              class="redis-pager__jump"
              @keyup.enter="handleJump"
            />
            <ElButton v-ripple size="small" :disabled="keysLoading || !selectedDatasource" @click="handleJump">
              跳转
            </ElButton>
          </div>
        </div>
      </div>
    </ElCard>
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

          <div class="redis-detail__value-title">值</div>
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
      <ElForm label-width="90px">
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
            <ElRadio value="expire">设置过期时间</ElRadio>
            <ElRadio value="persist">永久化（移除过期时间）</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem v-if="ttlForm.mode === 'expire'" label="TTL（秒）">
          <ElInputNumber
            v-model="ttlForm.seconds"
            :min="1"
            :max="31536000"
            controls-position="right"
            class="redis-num-input"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="ttlVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="ttlLoading" @click="submitTtl">确定</ElButton>
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
  fetchRedisSetKeyTTL,
  type RedisPingResult,
  type RedisInfoResult,
  type RedisKeyItem,
  type RedisKeyDetail
} from '@/api/redis'
import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
import { useTableStore } from '@/store/modules/table'
import type { ColumnOption } from '@/types'

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
    scanSession.value = ''
    pageCache.value.clear()
    currentPage.value = 1
    hasMore.value = false
  }
})

// ---- Key 浏览（会话式分页） ----
const matchPattern = ref('')
const keysLoading = ref(false)
const keyList = ref<RedisKeyItem[]>([])
const pageSizeOptions = [10, 20, 30, 50, 100]
const pageSize = ref(10)
const currentPage = ref(1)
const jumpPage = ref(1)
const hasMore = ref(false)
/** SCAN 会话 ID：实例/DB/匹配/页大小变化时重新生成，后端据此对齐页边界 */
const scanSession = ref('')
/** 客户端页缓存，回跳已访问页零成本 */
const pageCache = ref(new Map<number, { keys: RedisKeyItem[]; hasMore: boolean }>())

const canPrevPage = computed(() => currentPage.value > 1)
const canNextPage = computed(() => hasMore.value)

const typeTagMap: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  string: 'primary',
  hash: 'success',
  list: 'warning',
  set: 'danger',
  zset: 'info'
}

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

function newSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function loadPage(page: number, force = false) {
  const ds = selectedDatasource.value
  if (!ds) return
  if (!force) {
    const cached = pageCache.value.get(page)
    if (cached) {
      keyList.value = cached.keys
      hasMore.value = cached.hasMore
      currentPage.value = page
      return
    }
  }
  keysLoading.value = true
  try {
    const result = await fetchRedisKeys(ds.id, {
      session: scanSession.value,
      page,
      pageSize: pageSize.value,
      match: matchPattern.value.trim() || undefined,
      db: currentDb.value
    })
    pageCache.value.set(page, { keys: result.keys, hasMore: result.hasMore })
    keyList.value = result.keys
    hasMore.value = result.hasMore
    currentPage.value = page
  } catch (e: any) {
    keyList.value = []
    ElMessage.error(e?.message || '扫描 Key 失败')
  } finally {
    keysLoading.value = false
  }
}

/** 重新生成会话并回到第 1 页（搜索/换 DB/换页大小/刷新/写操作后使用） */
function resetScan() {
  scanSession.value = newSessionId()
  pageCache.value.clear()
  currentPage.value = 1
  jumpPage.value = 1
  hasMore.value = false
  if (selectedDatasource.value) loadPage(1, true)
}

function handleSearch() {
  resetScan()
}

function handleNextPage() {
  if (!canNextPage.value) return
  loadPage(currentPage.value + 1)
}

function handlePrevPage() {
  if (!canPrevPage.value) return
  loadPage(currentPage.value - 1)
}

function handleJump() {
  const target = Math.floor(Number(jumpPage.value))
  if (!target || target < 1) {
    ElMessage.warning('请输入有效页码')
    return
  }
  if (target === currentPage.value) return
  loadPage(target)
}

function onPageSizeChange() {
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

async function handleViewKey(row: RedisKeyItem) {
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
  height: 100%;
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

.redis-rule-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
  margin-bottom: 12px;
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

.redis-body {
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex: 1;
  min-height: 0;
  margin-top: 12px;
}

.redis-db-side {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 6px 6px;
  background: var(--default-box-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  overflow-y: auto;
}

.redis-db-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
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

.redis-page :deep(.redis-keys-table th),
.redis-page :deep(.redis-keys-table td) {
  font-size: 12px;
}

.redis-page :deep(.redis-keys-table .el-table__empty-text) {
  font-size: 12px;
}

.redis-keys-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  margin-top: 10px;
  padding-bottom: 4px;
}

.redis-pager {
  display: flex;
  align-items: center;
  gap: 8px;
}

.redis-pager__label {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.redis-pager__sizes {
  width: 88px;
}

.redis-pager__jump {
  width: 96px;
}

.redis-keys-footer__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
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
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.redis-num-input {
  width: 100%;

  :deep(.el-input__inner) {
    text-align: left;
  }
}
</style>
