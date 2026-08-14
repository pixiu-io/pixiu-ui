<!-- Nacos 管理页面（配置管理 / 服务发现 / 命名空间） -->
<template>
  <div class="nacos-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="nacos-alert"
      description="管理 Nacos 数据源，支持配置管理、服务发现与命名空间管理。请先在「数据源管理」中添加 Nacos 类型数据源，再选择实例进行管理。"
      @close="alertVisible = false"
    />

    <section class="nacos-top-card">
      <div class="nacos-rule-bar">
        <div class="nacos-rule-left">
          <span class="nacos-rule-label">实例名称</span>
          <div class="nacos-datasource-wrap">
            <ElSelect
              v-model="selectedDsId"
              class="nacos-rule-select nacos-ds-select"
              placeholder="请选择 Nacos 数据源"
              :loading="dsLoading"
              clearable
              @change="onDsChange"
            >
              <template #label="{ value }">
                <span v-if="value && selectedDatasource" class="nacos-ds-option">
                  <span class="nacos-ds-logo">
                    <ArtSvgIcon icon="ri:settings-3-line" class="nacos-ds-logo-icon" />
                  </span>
                  <span class="nacos-ds-option-name">{{ selectedDatasource.name }}</span>
                </span>
              </template>
              <ElOption v-for="ds in dsList" :key="ds.id" :label="ds.name" :value="ds.id">
                <span class="nacos-ds-option">
                  <span class="nacos-ds-logo">
                    <ArtSvgIcon icon="ri:settings-3-line" class="nacos-ds-logo-icon" />
                  </span>
                  <span class="nacos-ds-option-name">{{ ds.name }}</span>
                </span>
              </ElOption>
            </ElSelect>
            <div v-if="selectedDatasource" class="nacos-state-info">
              <span class="nacos-state-info-item">
                连接状态：<span class="nacos-state-value" :class="connectBadgeClass">{{
                  connectStatusText
                }}</span>
              </span>
              <span v-if="serverState?.version" class="nacos-state-info-item"
                >版本：{{ serverState.version }}</span
              >
              <span v-if="serverState?.standalone_mode" class="nacos-state-info-item"
                >运行模式：{{ serverState.standalone_mode === 'true' ? '单机' : '集群' }}</span
              >
              <span v-if="authStateText" class="nacos-state-info-item"
                >鉴权：{{ authStateText }}</span
              >
              <span v-if="serverState?.datasource_platform" class="nacos-state-info-item"
                >存储：{{ serverState.datasource_platform }}</span
              >
              <span v-if="clusterNodes" class="nacos-state-info-item"
                >节点：{{ clusterNodes.up }}/{{ clusterNodes.total }}</span
              >
              <span v-if="namespaceList.length" class="nacos-state-info-item"
                >命名空间：{{ namespaceList.length }}</span
              >
              <span v-if="namingMetrics" class="nacos-state-info-item"
                >服务/实例：{{ namingMetrics.serviceCount ?? '-' }}/{{
                  namingMetrics.instanceCount ?? '-'
                }}</span
              >
              <span v-if="namingMetrics" class="nacos-state-info-item"
                >订阅/连接：{{ namingMetrics.subscribeCount ?? '-' }}/{{
                  namingMetrics.clientCount ?? '-'
                }}</span
              >
            </div>
          </div>
        </div>
        <div class="nacos-rule-right">
          <ElButton :loading="stateLoading" @click="loadInstance">
            <ArtSvgIcon icon="ri:refresh-line" class="nacos-refresh-icon" />
            刷新
          </ElButton>
        </div>
      </div>
    </section>

    <ElCard v-if="!dsList.length && !dsLoading" shadow="never" class="nacos-empty-card">
      <ElEmpty description="暂无 Nacos 数据源，请先在「数据源管理」中添加 Nacos 类型数据源" />
    </ElCard>

    <ElTabs v-else v-model="activeTab" class="nacos-tabs" @tab-change="onTabChange">
      <!-- 配置管理 -->
      <ElTabPane label="配置管理" name="config">
        <div class="nacos-toolbar">
          <div class="nacos-toolbar__left">
            <ElSelect
              v-model="configTenant"
              class="nacos-toolbar__namespace"
              placeholder="命名空间"
              @change="handleConfigSearch"
            >
              <ElOption
                v-for="ns in namespaceOptions"
                :key="ns.value"
                :label="ns.label"
                :value="ns.value"
              />
            </ElSelect>
            <ElButton
              v-ripple
              type="primary"
              :disabled="!selectedDatasource"
              @click="openCreateConfig"
            >
              新建配置
            </ElButton>
          </div>
          <div class="nacos-toolbar__right">
            <ElInput
              v-model="configDataIdFilter"
              clearable
              placeholder="Data ID"
              class="nacos-toolbar__search"
              @keyup.enter="handleConfigSearch"
              @clear="handleConfigSearch"
            />
            <ElInput
              v-model="configGroupFilter"
              clearable
              placeholder="Group"
              class="nacos-toolbar__search"
              @keyup.enter="handleConfigSearch"
              @clear="handleConfigSearch"
            />
            <ElButton @click="handleConfigSearch">查询</ElButton>
          </div>
        </div>

        <ElTable
          v-loading="configLoading"
          :data="configList"
          stripe
          size="small"
          class="nacos-table"
        >
          <ElTableColumn prop="dataId" label="Data ID" min-width="280" show-overflow-tooltip />
          <ElTableColumn prop="group" label="Group" width="180" show-overflow-tooltip />
          <ElTableColumn prop="type" label="格式" width="90">
            <template #default="{ row }">{{ row.type || 'text' }}</template>
          </ElTableColumn>
          <ElTableColumn prop="appName" label="应用" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.appName || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn label="更新时间" width="170">
            <template #default="{ row }">{{ formatUpdateTime(row.updateTime) }}</template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="180" fixed="right" class-name="nacos-action-col">
            <template #default="{ row }">
              <ElButton text type="primary" @click="openViewConfig(row as NacosConfigItem)"
                >查看</ElButton
              >
              <ElButton text type="primary" @click="openEditConfig(row as NacosConfigItem)"
                >编辑</ElButton
              >
              <ElButton text type="danger" @click="handleDeleteConfig(row as NacosConfigItem)"
                >删除</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>

        <div class="nacos-pagination">
          <ElPagination
            v-model:current-page="configPage"
            v-model:page-size="configPageSize"
            :total="configTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @size-change="handleConfigSearch"
            @current-change="fetchConfigs"
          />
        </div>
      </ElTabPane>

      <!-- 服务发现 -->
      <ElTabPane label="服务发现" name="service">
        <div class="nacos-toolbar">
          <div class="nacos-toolbar__left">
            <ElSelect
              v-model="serviceNamespaceId"
              class="nacos-toolbar__namespace"
              placeholder="命名空间"
              @change="fetchServices"
            >
              <ElOption
                v-for="ns in namespaceOptions"
                :key="ns.value"
                :label="ns.label"
                :value="ns.value"
              />
            </ElSelect>
          </div>
          <div class="nacos-toolbar__right">
            <ElInput
              v-model="serviceFilter"
              clearable
              placeholder="搜索服务名称"
              class="nacos-toolbar__search"
              @clear="() => {}"
            />
          </div>
        </div>

        <ElTable
          v-loading="serviceLoading"
          :data="pagedServices"
          stripe
          size="small"
          class="nacos-table"
        >
          <ElTableColumn prop="name" label="服务名称" min-width="240" show-overflow-tooltip />
          <ElTableColumn prop="clusterCount" label="集群数" width="90" align="right" />
          <ElTableColumn prop="ipCount" label="实例数" width="90" align="right" />
          <ElTableColumn prop="healthyInstanceCount" label="健康实例数" width="110" align="right" />
          <ElTableColumn label="保护阈值" width="100" align="center">
            <template #default="{ row }">
              <ElTag :type="row.triggerProtectThreshold ? 'warning' : 'info'" size="small">
                {{ row.triggerProtectThreshold ? '触发' : '未触发' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <ElButton text type="primary" @click="openInstances(row as NacosServiceItem)"
                >实例</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>

        <div class="nacos-pagination">
          <ElPagination
            v-model:current-page="servicePage"
            v-model:page-size="servicePageSize"
            :total="filteredServices.length"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
          />
        </div>
      </ElTabPane>

      <!-- 命名空间 -->
      <ElTabPane label="命名空间" name="namespace">
        <div class="nacos-toolbar">
          <div class="nacos-toolbar__left">
            <ElButton
              v-ripple
              type="primary"
              :disabled="!selectedDatasource"
              @click="nsCreateVisible = true"
            >
              新建命名空间
            </ElButton>
          </div>
        </div>

        <ElTable
          v-loading="namespaceLoading"
          :data="namespaceList"
          stripe
          size="small"
          class="nacos-table"
        >
          <ElTableColumn prop="namespaceShowName" label="命名空间名称" min-width="200">
            <template #default="{ row }">
              {{ row.namespaceShowName }}
              <ElTag v-if="row.namespace === ''" type="info" size="small">public</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="namespace" label="命名空间 ID" min-width="260" show-overflow-tooltip>
            <template #default="{ row }">{{ row.namespace || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn prop="configCount" label="配置数" width="100" align="right" />
          <ElTableColumn prop="quota" label="配额" width="100" align="right" />
          <ElTableColumn label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <ElButton
                text
                type="danger"
                :disabled="row.namespace === ''"
                @click="handleDeleteNamespace(row as NacosNamespace)"
              >
                删除
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </ElTabPane>
    </ElTabs>

    <!-- 查看配置 -->
    <ElDialog v-model="viewVisible" title="查看配置" width="760px" destroy-on-close>
      <div class="nacos-config-meta">
        <span>Data ID：{{ viewForm.dataId }}</span>
        <span>Group：{{ viewForm.group }}</span>
        <span v-if="viewForm.type">格式：{{ viewForm.type }}</span>
      </div>
      <ElInput
        v-loading="viewLoading"
        v-model="viewForm.content"
        type="textarea"
        readonly
        :rows="16"
        class="nacos-config-textarea"
      />
    </ElDialog>

    <!-- 新建 / 编辑配置 -->
    <ElDialog
      v-model="editVisible"
      :title="isEditConfig ? '编辑配置' : '新建配置'"
      width="760px"
      destroy-on-close
    >
      <ElForm
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="88px"
        label-position="left"
      >
        <ElFormItem label="Data ID" prop="dataId">
          <ElInput
            v-model="editForm.dataId"
            :disabled="isEditConfig"
            maxlength="255"
            placeholder="请输入 Data ID"
          />
        </ElFormItem>
        <ElFormItem label="Group" prop="group">
          <ElInput v-model="editForm.group" :disabled="isEditConfig" placeholder="请输入 Group" />
        </ElFormItem>
        <ElFormItem label="格式">
          <ElSelect v-model="editForm.type" class="w-full">
            <ElOption label="TEXT" value="text" />
            <ElOption label="JSON" value="json" />
            <ElOption label="YAML" value="yaml" />
            <ElOption label="XML" value="xml" />
            <ElOption label="HTML" value="html" />
            <ElOption label="Properties" value="properties" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="内容" prop="content">
          <ElInput
            v-model="editForm.content"
            type="textarea"
            :rows="14"
            placeholder="请输入配置内容"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="editSubmitting" @click="handlePublishConfig">
          保存
        </ElButton>
      </template>
    </ElDialog>

    <!-- 实例列表 -->
    <ElDrawer
      v-model="instanceVisible"
      :title="`实例列表 - ${currentService?.name ?? ''}`"
      size="55%"
      destroy-on-close
    >
      <ElTable v-loading="instanceLoading" :data="instanceList" stripe size="small">
        <ElTableColumn prop="ip" label="IP" min-width="140" />
        <ElTableColumn prop="port" label="端口" width="80" align="right" />
        <ElTableColumn prop="weight" label="权重" width="80" align="right" />
        <ElTableColumn prop="clusterName" label="集群" min-width="100" show-overflow-tooltip />
        <ElTableColumn label="健康" width="80" align="center">
          <template #default="{ row }">
            <ElTag :type="row.healthy ? 'success' : 'danger'" size="small">
              {{ row.healthy ? '健康' : '异常' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="启用" width="90" align="center">
          <template #default="{ row }">
            <ElSwitch
              :model-value="row.enabled"
              :loading="row.__toggling"
              @change="
                (val: string | number | boolean) =>
                  handleToggleInstance(row as ToggleableInstance, Boolean(val))
              "
            />
          </template>
        </ElTableColumn>
      </ElTable>
    </ElDrawer>

    <!-- 新建命名空间 -->
    <ElDialog v-model="nsCreateVisible" title="新建命名空间" width="520px" destroy-on-close>
      <ElForm
        ref="nsFormRef"
        :model="nsForm"
        :rules="nsRules"
        label-width="110px"
        label-position="left"
      >
        <ElFormItem label="命名空间名称" prop="namespaceShowName">
          <ElInput
            v-model="nsForm.namespaceShowName"
            maxlength="128"
            placeholder="请输入命名空间名称"
          />
        </ElFormItem>
        <ElFormItem label="命名空间 ID">
          <ElInput v-model="nsForm.namespace" placeholder="留空则自动生成" />
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput
            v-model="nsForm.namespaceDesc"
            type="textarea"
            :rows="3"
            maxlength="200"
            placeholder="请输入描述"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="nsCreateVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="nsSubmitting" @click="handleCreateNamespace">
          创建
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { fetchDatasourceList, type DatasourceItem } from '@/api/datasource'
  import {
    createNacosNamespace,
    deleteNacosConfig,
    deleteNacosNamespace,
    fetchNacosConfigDetail,
    fetchNacosConfigs,
    fetchNacosInstances,
    fetchNacosNamespaces,
    fetchNacosServerState,
    fetchNacosServices,
    fetchNacosClusterNodes,
    fetchNacosOperatorMetrics,
    getNacosAuthState,
    invalidateNacosToken,
    nacosErrorMessage,
    publishNacosConfig,
    updateNacosInstance,
    type NacosConfigItem,
    type NacosInstance,
    type NacosNamespace,
    type NacosServerState,
    type NacosServiceItem
  } from '@/api/nacos'

  defineOptions({ name: 'MiddlewareNacos' })

  type ToggleableInstance = NacosInstance & { __toggling?: boolean }

  // ---- 数据源选择 ----
  const alertVisible = ref(true)
  const activeTab = ref<'config' | 'service' | 'namespace'>('config')
  const dsList = ref<DatasourceItem[]>([])
  const dsLoading = ref(false)
  const selectedDsId = ref<number | undefined>(undefined)
  const selectedDatasource = computed(() =>
    dsList.value.find((item) => item.id === selectedDsId.value)
  )

  const serverState = ref<NacosServerState | null>(null)
  const stateLoading = ref(false)
  const connectOk = ref(false)
  const clusterNodes = ref<{ total: number; up: number } | null>(null)
  const namingMetrics = ref<{
    serviceCount?: number
    instanceCount?: number
    subscribeCount?: number
    clientCount?: number
  } | null>(null)

  const connectStatusText = computed(() => {
    if (!selectedDatasource.value) return '-'
    if (stateLoading.value) return '检测中'
    return connectOk.value ? '正常' : '异常'
  })
  const connectBadgeClass = computed(() =>
    stateLoading.value ? 'is-pending' : connectOk.value ? 'is-ok' : 'is-error'
  )
  const authStateText = computed(() => {
    if (!selectedDatasource.value || !connectOk.value) return ''
    const state = getNacosAuthState(selectedDatasource.value)
    return state === 'token' ? '已登录' : state === 'disabled' ? '免登录' : '未配置账号'
  })

  async function loadDatasources() {
    dsLoading.value = true
    try {
      const res = await fetchDatasourceList({ subType: 'nacos', page: 1, limit: 9999 })
      dsList.value = res.items ?? []
      if (!selectedDsId.value && dsList.value.length) {
        selectedDsId.value = dsList.value[0].id
        await loadInstance()
      }
    } catch (error) {
      ElMessage.error(nacosErrorMessage(error))
    } finally {
      dsLoading.value = false
    }
  }

  async function onDsChange() {
    invalidateNacosToken(selectedDsId.value ?? -1)
    resetTabState()
    await loadInstance()
  }

  function resetTabState() {
    serverState.value = null
    connectOk.value = false
    clusterNodes.value = null
    namingMetrics.value = null
    namespaceList.value = []
    configList.value = []
    configTotal.value = 0
    configPage.value = 1
    serviceList.value = []
  }

  // ---- 命名空间 ----
  const namespaceList = ref<NacosNamespace[]>([])
  const namespaceLoading = ref(false)
  const namespaceOptions = computed(() => [
    { value: '', label: 'public' },
    ...namespaceList.value
      .filter((item) => item.namespace !== '')
      .map((item) => ({ value: item.namespace, label: item.namespaceShowName }))
  ])

  async function fetchNamespaces() {
    const ds = selectedDatasource.value
    if (!ds) return
    namespaceLoading.value = true
    try {
      const res = await fetchNacosNamespaces(ds)
      namespaceList.value = res?.data ?? []
    } catch (error) {
      namespaceList.value = []
      throw error
    } finally {
      namespaceLoading.value = false
    }
  }

  // ---- 实例概览 ----
  async function loadInstance() {
    const ds = selectedDatasource.value
    if (!ds) return
    stateLoading.value = true
    connectOk.value = false
    try {
      serverState.value = await fetchNacosServerState(ds)
      connectOk.value = true
      await fetchNamespaces()
      await loadExtraStats()
      await loadActiveTab()
    } catch (error) {
      connectOk.value = false
      serverState.value = null
      ElMessage.error(`连接 Nacos 失败：${nacosErrorMessage(error)}`)
    } finally {
      stateLoading.value = false
    }
  }

  /** 拉取集群节点与服务发现运行指标，失败时静默（部分版本/部署不提供这些接口） */
  async function loadExtraStats() {
    const ds = selectedDatasource.value
    if (!ds) return
    const [nodes, metrics] = await Promise.all([
      fetchNacosClusterNodes(ds).catch(() => null),
      fetchNacosOperatorMetrics(ds).catch(() => null)
    ])
    const nodeList = Array.isArray(nodes) ? (nodes ?? []) : (nodes?.data ?? [])
    clusterNodes.value = nodeList.length
      ? {
          total: nodeList.length,
          up: nodeList.filter((item) => String(item.state ?? '').toUpperCase() === 'UP').length
        }
      : null
    namingMetrics.value =
      metrics && typeof metrics === 'object' && 'serviceCount' in metrics
        ? {
            serviceCount: toMetricNumber(metrics.serviceCount),
            instanceCount: toMetricNumber(metrics.instanceCount),
            subscribeCount: toMetricNumber(metrics.subscribeCount),
            clientCount: toMetricNumber(metrics.clientCount)
          }
        : null
  }

  function toMetricNumber(value: unknown): number | undefined {
    if (value == null || value === '') return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : undefined
  }

  async function onTabChange(tab: string | number) {
    if (!selectedDatasource.value || !connectOk.value) return
    if (tab === 'config' && !configLoaded.value) await fetchConfigs()
    if (tab === 'service' && !serviceList.value.length) await fetchServices()
  }

  async function loadActiveTab() {
    if (activeTab.value === 'config') await fetchConfigs()
    else if (activeTab.value === 'service') await fetchServices()
  }

  // ---- 配置管理 ----
  const configTenant = ref('')
  const configDataIdFilter = ref('')
  const configGroupFilter = ref('')
  const configList = ref<NacosConfigItem[]>([])
  const configLoading = ref(false)
  const configTotal = ref(0)
  const configPage = ref(1)
  const configPageSize = ref(10)
  const configLoaded = ref(false)

  function handleConfigSearch() {
    configPage.value = 1
    void fetchConfigs()
  }

  function formatUpdateTime(value?: string | number) {
    if (value == null || value === '') return '-'
    const timestamp =
      typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : Date.parse(value)
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return typeof value === 'string' ? value : '-'
    }
    const date = new Date(timestamp)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`
  }

  async function fetchConfigs() {
    const ds = selectedDatasource.value
    if (!ds) return
    configLoading.value = true
    try {
      const res = await fetchNacosConfigs(ds, {
        tenant: configTenant.value,
        dataId: configDataIdFilter.value.trim(),
        group: configGroupFilter.value.trim(),
        pageNo: configPage.value,
        pageSize: configPageSize.value
      })
      configList.value = res?.pageItems ?? []
      configTotal.value = res?.totalCount ?? 0
      configLoaded.value = true
      void enrichConfigs()
    } catch (error) {
      ElMessage.error(`获取配置列表失败：${nacosErrorMessage(error)}`)
    } finally {
      configLoading.value = false
    }
  }

  /** 列表接口不返回 length/部分字段，逐行拉详情补齐（应用名 / 格式 / 更新时间） */
  async function enrichConfigs() {
    const ds = selectedDatasource.value
    if (!ds) return
    const rows = configList.value
    await Promise.all(
      rows.map(async (row) => {
        try {
          const detail = await fetchNacosConfigDetail(ds, {
            dataId: row.dataId,
            group: row.group,
            tenant: configTenant.value
          })
          if (!detail) return
          if (typeof detail.content === 'string') row.length = detail.content.length
          if (!row.appName && detail.appName) row.appName = detail.appName
          if (!row.type && detail.type) row.type = detail.type
          if (detail.lastModifiedTime || detail.gmtModified) {
            row.updateTime = detail.lastModifiedTime || detail.gmtModified
          } else if (detail.modifyTime || detail.createTime) {
            row.updateTime = detail.modifyTime || detail.createTime
          }
        } catch {
          // 单行补齐失败不影响列表展示
        }
      })
    )
  }

  // 查看配置
  const viewVisible = ref(false)
  const viewLoading = ref(false)
  const viewForm = reactive({ dataId: '', group: '', type: '', content: '' })

  async function openViewConfig(row: NacosConfigItem) {
    const ds = selectedDatasource.value
    if (!ds) return
    viewForm.dataId = row.dataId
    viewForm.group = row.group
    viewForm.type = row.type ?? ''
    viewForm.content = ''
    viewVisible.value = true
    viewLoading.value = true
    try {
      const detail = await fetchNacosConfigDetail(ds, {
        dataId: row.dataId,
        group: row.group,
        tenant: configTenant.value
      })
      viewForm.content = detail?.content ?? ''
      if (detail?.type) viewForm.type = detail.type
    } catch (error) {
      ElMessage.error(`获取配置内容失败：${nacosErrorMessage(error)}`)
    } finally {
      viewLoading.value = false
    }
  }

  // 新建 / 编辑配置
  const editVisible = ref(false)
  const editSubmitting = ref(false)
  const isEditConfig = ref(false)
  const editFormRef = ref<FormInstance>()
  const editForm = reactive({ dataId: '', group: 'DEFAULT_GROUP', type: 'text', content: '' })
  const editRules: FormRules = {
    dataId: [{ required: true, message: '请输入 Data ID', trigger: 'blur' }],
    group: [{ required: true, message: '请输入 Group', trigger: 'blur' }],
    content: [{ required: true, message: '请输入配置内容', trigger: 'blur' }]
  }

  function openCreateConfig() {
    isEditConfig.value = false
    Object.assign(editForm, { dataId: '', group: 'DEFAULT_GROUP', type: 'text', content: '' })
    editVisible.value = true
  }

  async function openEditConfig(row: NacosConfigItem) {
    const ds = selectedDatasource.value
    if (!ds) return
    isEditConfig.value = true
    Object.assign(editForm, {
      dataId: row.dataId,
      group: row.group,
      type: row.type || 'text',
      content: ''
    })
    editVisible.value = true
    try {
      const detail = await fetchNacosConfigDetail(ds, {
        dataId: row.dataId,
        group: row.group,
        tenant: configTenant.value
      })
      editForm.content = detail?.content ?? ''
      if (detail?.type) editForm.type = detail.type
    } catch (error) {
      ElMessage.error(`获取配置内容失败：${nacosErrorMessage(error)}`)
      editVisible.value = false
    }
  }

  async function handlePublishConfig() {
    const ds = selectedDatasource.value
    if (!ds || !editFormRef.value) return
    const valid = await editFormRef.value.validate().catch(() => false)
    if (!valid) return
    editSubmitting.value = true
    try {
      const res = await publishNacosConfig(ds, {
        dataId: editForm.dataId.trim(),
        group: editForm.group.trim(),
        tenant: configTenant.value,
        content: editForm.content,
        type: editForm.type
      })
      if (res === true || res === 'true' || res?.code === 200 || res === undefined) {
        ElMessage.success(isEditConfig.value ? '配置已更新' : '配置已发布')
        editVisible.value = false
        await fetchConfigs()
      } else {
        ElMessage.error(`发布配置失败：${typeof res === 'string' ? res : JSON.stringify(res)}`)
      }
    } catch (error) {
      ElMessage.error(`发布配置失败：${nacosErrorMessage(error)}`)
    } finally {
      editSubmitting.value = false
    }
  }

  async function handleDeleteConfig(row: NacosConfigItem) {
    const ds = selectedDatasource.value
    if (!ds) return
    try {
      await ElMessageBox.confirm(
        `确定删除配置「${row.dataId}」（Group: ${row.group}）吗？\n\n此操作不可恢复。`,
        '删除配置',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    try {
      await deleteNacosConfig(ds, {
        dataId: row.dataId,
        group: row.group,
        tenant: configTenant.value
      })
      ElMessage.success('删除成功')
      await fetchConfigs()
    } catch (error) {
      ElMessage.error(`删除配置失败：${nacosErrorMessage(error)}`)
    }
  }

  // ---- 服务发现 ----
  const serviceNamespaceId = ref('')
  const serviceFilter = ref('')
  const serviceList = ref<NacosServiceItem[]>([])
  const serviceLoading = ref(false)
  const servicePage = ref(1)
  const servicePageSize = ref(10)

  const filteredServices = computed(() => {
    const keyword = serviceFilter.value.trim().toLowerCase()
    if (!keyword) return serviceList.value
    return serviceList.value.filter((item) => item.name?.toLowerCase().includes(keyword))
  })
  const pagedServices = computed(() => {
    const start = (servicePage.value - 1) * servicePageSize.value
    return filteredServices.value.slice(start, start + servicePageSize.value)
  })

  async function fetchServices() {
    const ds = selectedDatasource.value
    if (!ds) return
    serviceLoading.value = true
    servicePage.value = 1
    try {
      const res = await fetchNacosServices(ds, {
        namespaceId: serviceNamespaceId.value,
        pageNo: 1,
        pageSize: 1000
      })
      serviceList.value = (res?.doms ?? []).map((name) => ({ name }))
      // 补齐实例统计信息
      await Promise.all(
        serviceList.value.map(async (item) => {
          try {
            const detail = await fetchNacosInstances(ds, {
              serviceName: item.name,
              namespaceId: serviceNamespaceId.value
            })
            const hosts = detail?.hosts ?? []
            item.ipCount = hosts.length
            item.healthyInstanceCount = hosts.filter((host) => host.healthy).length
          } catch {
            item.ipCount = 0
            item.healthyInstanceCount = 0
          }
        })
      )
    } catch (error) {
      ElMessage.error(`获取服务列表失败：${nacosErrorMessage(error)}`)
    } finally {
      serviceLoading.value = false
    }
  }

  // 实例列表
  const instanceVisible = ref(false)
  const instanceLoading = ref(false)
  const instanceList = ref<ToggleableInstance[]>([])
  const currentService = ref<NacosServiceItem | null>(null)

  async function openInstances(row: NacosServiceItem) {
    const ds = selectedDatasource.value
    if (!ds) return
    currentService.value = row
    instanceVisible.value = true
    await loadInstances()
  }

  async function loadInstances() {
    const ds = selectedDatasource.value
    const service = currentService.value
    if (!ds || !service) return
    instanceLoading.value = true
    try {
      const res = await fetchNacosInstances(ds, {
        serviceName: service.name,
        namespaceId: serviceNamespaceId.value
      })
      instanceList.value = res?.hosts ?? []
    } catch (error) {
      ElMessage.error(`获取实例列表失败：${nacosErrorMessage(error)}`)
    } finally {
      instanceLoading.value = false
    }
  }

  async function handleToggleInstance(row: ToggleableInstance, val: boolean) {
    const ds = selectedDatasource.value
    const service = currentService.value
    if (!ds || !service) return
    row.__toggling = true
    try {
      await updateNacosInstance(ds, {
        serviceName: service.name,
        namespaceId: serviceNamespaceId.value,
        ip: row.ip,
        port: row.port,
        enabled: val,
        clusterName: row.clusterName,
        weight: row.weight
      })
      ElMessage.success(val ? '实例已启用' : '实例已下线')
      await loadInstances()
    } catch (error) {
      ElMessage.error(`更新实例失败：${nacosErrorMessage(error)}`)
    } finally {
      row.__toggling = false
    }
  }

  // ---- 命名空间管理 ----
  const nsCreateVisible = ref(false)
  const nsSubmitting = ref(false)
  const nsFormRef = ref<FormInstance>()
  const nsForm = reactive({ namespaceShowName: '', namespace: '', namespaceDesc: '' })
  const nsRules: FormRules = {
    namespaceShowName: [{ required: true, message: '请输入命名空间名称', trigger: 'blur' }]
  }

  async function handleCreateNamespace() {
    const ds = selectedDatasource.value
    if (!ds || !nsFormRef.value) return
    const valid = await nsFormRef.value.validate().catch(() => false)
    if (!valid) return
    nsSubmitting.value = true
    try {
      await createNacosNamespace(ds, {
        namespaceShowName: nsForm.namespaceShowName.trim(),
        namespace: nsForm.namespace,
        namespaceDesc: nsForm.namespaceDesc
      })
      ElMessage.success('命名空间创建成功')
      nsCreateVisible.value = false
      Object.assign(nsForm, { namespaceShowName: '', namespace: '', namespaceDesc: '' })
      await fetchNamespaces()
    } catch (error) {
      ElMessage.error(`创建命名空间失败：${nacosErrorMessage(error)}`)
    } finally {
      nsSubmitting.value = false
    }
  }

  async function handleDeleteNamespace(row: NacosNamespace) {
    const ds = selectedDatasource.value
    if (!ds) return
    try {
      await ElMessageBox.confirm(
        `确定删除命名空间「${row.namespaceShowName}」吗？\n其下的配置将被一并删除，此操作不可恢复。`,
        '删除命名空间',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    try {
      await deleteNacosNamespace(ds, row.namespace)
      ElMessage.success('删除成功')
      if (configTenant.value === row.namespace) configTenant.value = ''
      if (serviceNamespaceId.value === row.namespace) serviceNamespaceId.value = ''
      await fetchNamespaces()
    } catch (error) {
      ElMessage.error(`删除命名空间失败：${nacosErrorMessage(error)}`)
    }
  }

  onMounted(() => {
    void loadDatasources()
  })
</script>

<style scoped lang="less">
  .nacos-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .nacos-alert {
    border-radius: 8px;
  }

  .nacos-top-card {
    padding: 12px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
  }

  .nacos-rule-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .nacos-rule-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .nacos-rule-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nacos-rule-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    flex-shrink: 0;
  }

  .nacos-datasource-wrap {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .nacos-ds-select {
    width: 260px;
  }

  .nacos-ds-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .nacos-ds-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: rgba(58, 120, 255, 12%);
    color: #3a78ff;
    flex-shrink: 0;
  }

  .nacos-ds-logo-icon {
    width: 13px;
    height: 13px;
  }

  .nacos-ds-option-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nacos-state-info {
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .nacos-state-value {
    font-weight: 600;

    &.is-ok {
      color: #16a34a;
    }

    &.is-error {
      color: #dc2626;
    }

    &.is-pending {
      color: var(--el-text-color-secondary);
    }
  }

  .nacos-refresh-icon {
    width: 14px;
    height: 14px;
    margin-right: 2px;
  }

  .nacos-empty-card {
    border-radius: 12px;
  }

  .nacos-tabs {
    padding: 4px 16px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
  }

  .nacos-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .nacos-toolbar__left,
  .nacos-toolbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .nacos-toolbar__namespace {
    width: 220px;
  }

  .nacos-toolbar__search {
    width: 180px;
  }

  .nacos-table {
    border-radius: 8px;
  }

  .nacos-table :deep(.nacos-action-col .cell) {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  .nacos-table :deep(.nacos-action-col .el-button + .el-button) {
    margin-left: 8px;
  }

  .nacos-table :deep(.nacos-action-col .el-button) {
    padding: 4px 2px;
  }

  .nacos-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .nacos-config-meta {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .nacos-config-textarea :deep(.el-textarea__inner) {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 12px;
  }
</style>
