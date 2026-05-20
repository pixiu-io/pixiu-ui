<template>
  <div class="helm-page">
    <ElCard class="art-table-card">
      <ElTabs v-model="activeKind" class="helm-tabs">
        <ElTabPane label="Release" name="release">
          <ArtTableHeader
            v-model:columns="releaseColumnChecks"
            :loading="releaseLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onReleaseRefresh"
          >
            <template #left>
              <div class="helm-toolbar">
                <ElButton v-ripple @click="openInstallDialog">安装</ElButton>
                <ElButton
                  v-ripple
                  type="danger"
                  plain
                  :disabled="!selectedReleases.length"
                  @click="batchUninstall"
                >
                  卸载
                </ElButton>
                <div class="helm-toolbar__filters">
                  <ElInput
                    v-model="releaseSearchForm.name"
                    clearable
                    placeholder="请输入 Release 名称"
                    class="helm-toolbar__search"
                    @keyup.enter="runReleaseSearch"
                    @clear="runReleaseSearch"
                  />
                  <div
                    class="helm-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="runReleaseSearch"
                    @keyup.enter="runReleaseSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="releaseLoading"
            :data="releaseData"
            :columns="releaseColumns"
            :pagination="releasePagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @selection-change="onReleaseSelectionChange"
            @pagination:size-change="releaseHandleSizeChange"
            @pagination:current-change="releaseHandleCurrentChange"
          >
            <template #empty>
              <ClusterTableEmpty />
            </template>
          </ArtTable>
        </ElTabPane>

        <ElTabPane label="仓库" name="repo">
          <ArtTableHeader
            v-model:columns="repoColumnChecks"
            :loading="repoLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onRepoRefresh"
          >
            <template #left>
              <div class="helm-toolbar">
                <ElButton v-ripple @click="openRepoDialog()">新建</ElButton>
                <div class="helm-toolbar__filters">
                  <ElInput
                    v-model="repoSearchForm.name"
                    clearable
                    placeholder="请输入仓库名称"
                    class="helm-toolbar__search"
                    @keyup.enter="runRepoSearch"
                    @clear="runRepoSearch"
                  />
                  <div
                    class="helm-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="runRepoSearch"
                    @keyup.enter="runRepoSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="repoLoading"
            :data="repoData"
            :columns="repoColumns"
            :pagination="repoPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="repoHandleSizeChange"
            @pagination:current-change="repoHandleCurrentChange"
          >
            <template #empty>
              <ClusterTableEmpty />
            </template>
          </ArtTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <ElDialog
      v-model="releaseFormVisible"
      :title="releaseFormMode === 'install' ? '安装 Release' : '升级 Release'"
      width="520px"
      destroy-on-close
      @close="resetReleaseForm"
    >
      <ElForm label-width="88px">
        <ElFormItem label="名称" required>
          <ElInput
            v-model="releaseForm.name"
            :disabled="releaseFormMode === 'upgrade'"
            placeholder="Release 名称"
          />
        </ElFormItem>
        <ElFormItem label="Chart" required>
          <ElInput v-model="releaseForm.chart" placeholder="例如 nginx 或 repo/chart" />
        </ElFormItem>
        <ElFormItem label="版本" required>
          <ElInput v-model="releaseForm.version" placeholder="Chart 版本" />
        </ElFormItem>
        <ElFormItem label="Values">
          <ElInput
            v-model="releaseFormValuesText"
            type="textarea"
            :rows="6"
            placeholder="JSON 格式，可选"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="releaseFormVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="releaseFormSubmitting" @click="submitReleaseForm">
          确认
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="historyVisible" title="历史版本" width="720px" destroy-on-close>
      <ElTable v-loading="historyLoading" :data="historyRows" size="small" stripe>
        <ElTableColumn label="版本" prop="version" width="80" />
        <ElTableColumn label="状态" width="110">
          <template #default="{ row }">
            <ElTag
              :type="row.info?.status === 'deployed' ? 'success' : 'warning'"
              size="small"
              effect="light"
            >
              {{ row.info?.status || '-' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Chart" min-width="160">
          <template #default="{ row }">{{ formatChartLabel(row.chart) }}</template>
        </ElTableColumn>
        <ElTableColumn label="更新时间" min-width="160">
          <template #default="{ row }">{{ formatHelmTime(row.info?.last_deployed) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElLink type="primary" underline="never" @click="confirmRollback(row)">回滚</ElLink>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElDialog>

    <ElDialog
      v-model="repoFormVisible"
      :title="repoForm.id ? '编辑仓库' : '新建仓库'"
      width="520px"
      destroy-on-close
      @close="resetRepoForm"
    >
      <ElForm label-width="88px">
        <ElFormItem label="名称" required>
          <ElInput v-model="repoForm.name" placeholder="仓库名称" />
        </ElFormItem>
        <ElFormItem label="URL" required>
          <ElInput v-model="repoForm.url" placeholder="Chart 仓库地址" />
        </ElFormItem>
        <ElFormItem label="用户名">
          <ElInput v-model="repoForm.username" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="密码">
          <ElInput v-model="repoForm.password" type="password" show-password placeholder="可选" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="repoFormVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="repoFormSubmitting" @click="submitRepoForm">确认</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import {
    ElButton,
    ElDialog,
    ElForm,
    ElFormItem,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElTabPane,
    ElTabs,
    ElTable,
    ElTableColumn,
    ElTag
  } from 'element-plus'
  import { computed, h, inject, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    createHelmRepository,
    deleteHelmRepository,
    fetchHelmReleaseHistory,
    fetchHelmReleaseList,
    fetchHelmRepositoryList,
    installHelmRelease,
    rollbackHelmRelease,
    uninstallHelmRelease,
    updateHelmRepository,
    upgradeHelmRelease,
    type HelmReleaseChartMeta,
    type HelmReleaseItem,
    type HelmRepository
  } from '@/api/helm'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
  import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { clusterDetailNamespaceKey } from './context'

  defineOptions({ name: 'ClusterDetailHelm' })

  const route = useRoute()
  const activeKind = ref<'release' | 'repo'>('release')
  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')
  const cluster = computed(() => String(route.query.cluster ?? ''))

  const selectedReleases = ref<HelmReleaseItem[]>([])
  const releaseSearchForm = ref<{ name?: string }>({})
  const allReleases = ref<HelmReleaseItem[]>([])

  const historyVisible = ref(false)
  const historyLoading = ref(false)
  const historyRows = ref<HelmReleaseItem[]>([])
  const historyReleaseName = ref('')

  const releaseFormVisible = ref(false)
  const releaseFormMode = ref<'install' | 'upgrade'>('install')
  const releaseFormSubmitting = ref(false)
  const releaseForm = ref({ name: '', chart: '', version: '' })
  const releaseFormValuesText = ref('')

  const repoSearchForm = ref<{ name?: string }>({})
  const allRepos = ref<HelmRepository[]>([])
  const repoFormVisible = ref(false)
  const repoFormSubmitting = ref(false)
  const repoForm = ref({
    id: 0,
    name: '',
    url: '',
    username: '',
    password: '',
    resource_version: 0
  })

  function formatChartLabel(chart?: HelmReleaseChartMeta): string {
    const name = chart?.metadata?.name ?? ''
    const ver = chart?.metadata?.version ?? ''
    if (!name && !ver) return '-'
    return ver ? `${name}-${ver}` : name
  }

  function formatHelmTime(ts?: string): string {
    if (!ts) return '-'
    return formatNodeCreationTime(ts)
  }

  function filterByName<T extends { name?: string }>(list: T[], keyword: string): T[] {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return list
    return list.filter((item) => String(item.name ?? '').toLowerCase().includes(kw))
  }

  function parseValuesText(): Record<string, unknown> | undefined {
    const raw = releaseFormValuesText.value.trim()
    if (!raw) return undefined
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      throw new Error('Values 须为合法 JSON')
    }
  }

  type PageParams = { current: number; size: number; name?: string }

  const {
    columns: releaseColumns,
    columnChecks: releaseColumnChecks,
    data: releaseData,
    loading: releaseLoading,
    pagination: releasePagination,
    getData: getReleaseData,
    replaceSearchParams: replaceReleaseSearchParams,
    handleSizeChange: releaseHandleSizeChange,
    handleCurrentChange: releaseHandleCurrentChange,
    refreshData: refreshReleaseData
  } = useTable({
    core: {
      immediate: true,
      apiFn: async (params: PageParams) => {
        const c = cluster.value
        const ns = selectedNamespace.value
        if (!c || !ns) {
          return {
            code: 200,
            data: { records: [] as HelmReleaseItem[], total: 0, current: params.current, size: params.size }
          }
        }
        try {
          allReleases.value = await fetchHelmReleaseList(c, ns)
        } catch (e: unknown) {
          allReleases.value = []
          throw e
        }
        const filtered = filterByName(allReleases.value, params.name ?? '')
        const total = filtered.length
        const start = (params.current - 1) * params.size
        const records = filtered.slice(start, start + params.size).map((row, i) => ({
          ...row,
          rowKey: `${row.name}-${start + i}`
        }))
        return {
          code: 200,
          data: { records, total, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'name',
          label: '实例名称',
          minWidth: 160,
          formatter: (row: HelmReleaseItem) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-color-primary);cursor:default' },
              row.name ?? '-'
            )
        },
        {
          prop: 'info.status',
          label: '状态',
          width: 110,
          formatter: (row: HelmReleaseItem) => {
            const status = row.info?.status ?? '-'
            const type = status === 'deployed' ? 'success' : status === 'failed' ? 'danger' : 'warning'
            return h(ElTag, { type, size: 'small', effect: 'light' }, () => status)
          }
        },
        {
          prop: 'chart',
          label: 'Chart',
          minWidth: 180,
          showOverflowTooltip: true,
          formatter: (row: HelmReleaseItem) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatChartLabel(row.chart))
        },
        {
          prop: 'version',
          label: '版本',
          width: 80,
          formatter: (row: HelmReleaseItem) =>
            h('span', { style: 'font-size:12px' }, String(row.version ?? '-'))
        },
        {
          prop: 'chart.metadata.appVersion',
          label: 'APP版本',
          width: 100,
          formatter: (row: HelmReleaseItem) =>
            h('span', { style: 'font-size:12px' }, row.chart?.metadata?.appVersion ?? '-')
        },
        {
          prop: 'info.first_deployed',
          label: '部署时间',
          width: 170,
          formatter: (row: HelmReleaseItem) =>
            h('span', { style: 'font-size:12px' }, formatHelmTime(row.info?.first_deployed))
        },
        {
          prop: 'info.last_deployed',
          label: '更新时间',
          width: 170,
          formatter: (row: HelmReleaseItem) =>
            h('span', { style: 'font-size:12px' }, formatHelmTime(row.info?.last_deployed))
        },
        {
          prop: 'operation',
          label: '操作',
          width: 220,
          fixed: 'right',
          formatter: (row: HelmReleaseItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => openHistory(row) },
                () => '历史版本'
              ),
              h(
                ElLink,
                { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => openUpgradeDialog(row) },
                () => '升级'
              ),
              h(
                ElLink,
                { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => confirmUninstall(row) },
                () => '卸载'
              )
            ])
        }
      ]
    }
  })

  const {
    columns: repoColumns,
    columnChecks: repoColumnChecks,
    data: repoData,
    loading: repoLoading,
    pagination: repoPagination,
    getData: getRepoData,
    replaceSearchParams: replaceRepoSearchParams,
    handleSizeChange: repoHandleSizeChange,
    handleCurrentChange: repoHandleCurrentChange,
    refreshData: refreshRepoData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: PageParams) => {
        try {
          allRepos.value = await fetchHelmRepositoryList()
        } catch (e: unknown) {
          allRepos.value = []
          throw e
        }
        const filtered = filterByName(allRepos.value, params.name ?? '')
        const total = filtered.length
        const start = (params.current - 1) * params.size
        const records = filtered.slice(start, start + params.size).map((row) => ({
          ...row,
          rowKey: String(row.id)
        }))
        return {
          code: 200,
          data: { records, total, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 140,
          formatter: (row: HelmRepository) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-primary)' }, row.name)
        },
        {
          prop: 'url',
          label: 'URL',
          minWidth: 240,
          showOverflowTooltip: true,
          formatter: (row: HelmRepository) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.url)
        },
        {
          prop: 'username',
          label: '用户名',
          width: 120,
          formatter: (row: HelmRepository) =>
            h('span', { style: 'font-size:12px' }, row.username || '-')
        },
        {
          prop: 'gmt_create',
          label: '创建时间',
          width: 170,
          formatter: (row: HelmRepository) =>
            h('span', { style: 'font-size:12px' }, formatHelmTime(row.gmt_create))
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: HelmRepository) =>
            h('div', { style: 'display:flex;gap:12px' }, [
              h(
                ElLink,
                { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => openRepoDialog(row) },
                () => '编辑'
              ),
              h(
                ElLink,
                { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => confirmDeleteRepo(row) },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  function onReleaseSelectionChange(rows: HelmReleaseItem[]) {
    selectedReleases.value = rows
  }

  function runReleaseSearch() {
    replaceReleaseSearchParams({ name: (releaseSearchForm.value.name ?? '').trim() || undefined })
    getReleaseData()
  }

  function onReleaseRefresh() {
    selectedReleases.value = []
    refreshReleaseData()
  }

  function runRepoSearch() {
    replaceRepoSearchParams({ name: (repoSearchForm.value.name ?? '').trim() || undefined })
    getRepoData()
  }

  function onRepoRefresh() {
    refreshRepoData()
  }

  function openInstallDialog() {
    if (!cluster.value || !selectedNamespace.value) {
      ElMessage.warning('请先选择集群与命名空间')
      return
    }
    releaseFormMode.value = 'install'
    releaseForm.value = { name: '', chart: '', version: '' }
    releaseFormValuesText.value = ''
    releaseFormVisible.value = true
  }

  function openUpgradeDialog(row: HelmReleaseItem) {
    releaseFormMode.value = 'upgrade'
    releaseForm.value = {
      name: row.name,
      chart: row.chart?.metadata?.name ?? '',
      version: row.chart?.metadata?.version ?? ''
    }
    releaseFormValuesText.value = ''
    releaseFormVisible.value = true
  }

  function resetReleaseForm() {
    releaseForm.value = { name: '', chart: '', version: '' }
    releaseFormValuesText.value = ''
  }

  async function submitReleaseForm() {
    const c = cluster.value
    const ns = selectedNamespace.value
    if (!c || !ns) return
    const { name, chart, version } = releaseForm.value
    if (!name.trim() || !chart.trim() || !version.trim()) {
      ElMessage.warning('请填写名称、Chart 和版本')
      return
    }
    let values: Record<string, unknown> | undefined
    try {
      values = parseValuesText()
    } catch (e: unknown) {
      ElMessage.warning(e instanceof Error ? e.message : 'Values 格式错误')
      return
    }
    releaseFormSubmitting.value = true
    try {
      const body = { name: name.trim(), chart: chart.trim(), version: version.trim(), values }
      if (releaseFormMode.value === 'install') {
        await installHelmRelease(c, ns, body)
        ElMessage.success('安装成功')
      } else {
        await upgradeHelmRelease(c, ns, body)
        ElMessage.success('升级成功')
      }
      releaseFormVisible.value = false
      onReleaseRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      releaseFormSubmitting.value = false
    }
  }

  async function confirmUninstall(row: HelmReleaseItem) {
    try {
      await ElMessageBox.confirm(`确认卸载 Release "${row.name}"?`, '卸载', { type: 'warning' })
      await uninstallHelmRelease(cluster.value, selectedNamespace.value, row.name)
      ElMessage.success('卸载成功')
      onReleaseRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '卸载失败')
    }
  }

  async function batchUninstall() {
    if (!selectedReleases.value.length) return
    try {
      await ElMessageBox.confirm(
        `确认卸载选中的 ${selectedReleases.value.length} 个 Release?`,
        '批量卸载',
        { type: 'warning' }
      )
      for (const row of selectedReleases.value) {
        await uninstallHelmRelease(cluster.value, selectedNamespace.value, row.name)
      }
      ElMessage.success('批量卸载成功')
      onReleaseRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '卸载失败')
    }
  }

  async function openHistory(row: HelmReleaseItem) {
    historyReleaseName.value = row.name
    historyVisible.value = true
    historyLoading.value = true
    try {
      historyRows.value = await fetchHelmReleaseHistory(
        cluster.value,
        selectedNamespace.value,
        row.name
      )
    } catch (e: unknown) {
      historyRows.value = []
      ElMessage.error(e instanceof Error ? e.message : '获取历史版本失败')
    } finally {
      historyLoading.value = false
    }
  }

  async function confirmRollback(row: HelmReleaseItem) {
    const ver = row.version
    if (ver == null) {
      ElMessage.warning('版本号无效')
      return
    }
    try {
      await ElMessageBox.confirm(`确认回滚到版本 ${ver}?`, '版本回滚', { type: 'warning' })
      await rollbackHelmRelease(
        cluster.value,
        selectedNamespace.value,
        historyReleaseName.value,
        ver
      )
      ElMessage.success('回滚成功')
      historyVisible.value = false
      onReleaseRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '回滚失败')
    }
  }

  function openRepoDialog(row?: HelmRepository) {
    if (row) {
      repoForm.value = {
        id: row.id,
        name: row.name,
        url: row.url,
        username: row.username ?? '',
        password: '',
        resource_version: row.resource_version
      }
    } else {
      repoForm.value = { id: 0, name: '', url: '', username: '', password: '', resource_version: 0 }
    }
    repoFormVisible.value = true
  }

  function resetRepoForm() {
    repoForm.value = { id: 0, name: '', url: '', username: '', password: '', resource_version: 0 }
  }

  async function submitRepoForm() {
    const { id, name, url, username, password, resource_version } = repoForm.value
    if (!name.trim() || !url.trim()) {
      ElMessage.warning('请填写名称和 URL')
      return
    }
    repoFormSubmitting.value = true
    try {
      if (id) {
        await updateHelmRepository(id, {
          name: name.trim(),
          url: url.trim(),
          username: username.trim() || undefined,
          password: password || undefined,
          resource_version
        })
        ElMessage.success('更新成功')
      } else {
        await createHelmRepository({
          name: name.trim(),
          url: url.trim(),
          username: username.trim() || undefined,
          password: password || undefined
        })
        ElMessage.success('创建成功')
      }
      repoFormVisible.value = false
      onRepoRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      repoFormSubmitting.value = false
    }
  }

  async function confirmDeleteRepo(row: HelmRepository) {
    try {
      await ElMessageBox.confirm(`确认删除仓库 "${row.name}"?`, '删除', { type: 'warning' })
      await deleteHelmRepository(row.id)
      ElMessage.success('删除成功')
      onRepoRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  watch(
    () => [cluster.value, selectedNamespace.value] as const,
    () => {
      selectedReleases.value = []
      replaceReleaseSearchParams({ name: undefined })
      getReleaseData()
    }
  )

  watch(activeKind, (kind) => {
    if (kind === 'repo') getRepoData()
  })
</script>

<style scoped>
  .helm-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .helm-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .helm-toolbar__search {
    width: 280px;
    max-width: 100%;
  }

  .helm-toolbar-search-btn {
    flex-shrink: 0;
    display: flex;
    width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 6px;
    background: color-mix(in srgb, var(--art-gray-300) 55%, transparent);
    color: var(--el-text-color-secondary);
    transition: background-color 0.15s ease;
  }

  .helm-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .helm-tabs :deep(.el-tabs__header) {
    margin-top: -6px;
    margin-bottom: 8px;
  }

  .helm-page > .art-table-card :deep(> .el-card__body) {
    padding-top: 12px;
  }
</style>
