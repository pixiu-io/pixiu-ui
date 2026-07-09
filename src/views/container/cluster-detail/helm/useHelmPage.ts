import yaml from 'js-yaml'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
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
  type HelmReleaseItem,
  type HelmRepository
} from '@/api/helm'
import { useClusterDetailNamespaceRefresh } from '@/hooks/core/useClusterDetailNamespaceRefresh'
import { clusterDetailNamespaceKey } from '../context'
import { filterByName, summarizeReleases, type HelmPageView } from './shared'

function readCachedNamespace(cluster: string): string | null {
  try {
    const v = localStorage.getItem(`pixiu-ns-${cluster}`)
    return v && v !== 'undefined' && v !== 'null' ? v : null
  } catch {
    return null
  }
}

export function useHelmPage() {
  const route = useRoute()
  const globalNs = inject(clusterDetailNamespaceKey)

  const activeView = ref<HelmPageView>('releases')
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  const releaseLoading = ref(false)
  const releaseSearch = ref('')
  const allReleases = ref<HelmReleaseItem[]>([])

  const repoLoading = ref(false)
  const repoSearch = ref('')
  const allRepos = ref<HelmRepository[]>([])
  const selectedRepoId = ref<number | null>(null)

  const releaseStats = computed(() => summarizeReleases(allReleases.value))
  const filteredReleases = computed(() => filterByName(allReleases.value, releaseSearch.value))
  const filteredRepos = computed(() => filterByName(allRepos.value, repoSearch.value))
  const selectedRepo = computed(
    () => filteredRepos.value.find((item) => item.id === selectedRepoId.value) ?? filteredRepos.value[0] ?? null
  )

  const releaseFormVisible = ref(false)
  const releaseFormMode = ref<'install' | 'upgrade'>('install')
  const releaseFormSubmitting = ref(false)
  const releaseForm = ref({ name: '', chart: '', version: '' })
  const releaseFormValuesText = ref('')

  const historyVisible = ref(false)
  const historyLoading = ref(false)
  const historyRows = ref<HelmReleaseItem[]>([])
  const historyReleaseName = ref('')

  const detailRelease = ref<HelmReleaseItem | null>(null)
  const detailVisible = ref(false)

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

  function parseValuesText(): Record<string, unknown> | undefined {
    const raw = releaseFormValuesText.value.trim()
    if (!raw) return undefined
    try {
      const loaded = yaml.load(raw)
      if (loaded == null) return undefined
      if (typeof loaded !== 'object' || Array.isArray(loaded)) {
        throw new Error('Values 须为 YAML 对象')
      }
      return loaded as Record<string, unknown>
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Values 须为 YAML 对象') throw e
      throw new Error('Values 须为合法 YAML')
    }
  }

  let releaseRequestSeq = 0
  let inflightReleaseKey = ''
  let loadedReleaseKey = ''

  async function loadReleases() {
    const c = cluster.value
    const ns = selectedNamespace.value
    if (!c || !ns) {
      allReleases.value = []
      loadedReleaseKey = ''
      return
    }

    // layout 尚未从 localStorage 恢复命名空间时，跳过临时的 default，避免重复请求
    const cachedNs = readCachedNamespace(c)
    if (ns === 'default' && cachedNs && cachedNs !== 'default') {
      return
    }

    const key = `${c}::${ns}`
    if (key === loadedReleaseKey || key === inflightReleaseKey) {
      return
    }

    inflightReleaseKey = key
    const requestSeq = ++releaseRequestSeq
    releaseLoading.value = true
    try {
      allReleases.value = await fetchHelmReleaseList(c, ns)
      if (requestSeq !== releaseRequestSeq) return
      loadedReleaseKey = key
    } catch (e: unknown) {
      if (requestSeq !== releaseRequestSeq) return
      allReleases.value = []
      loadedReleaseKey = ''
      ElMessage.error(e instanceof Error ? e.message : '获取 Release 列表失败')
    } finally {
      if (requestSeq === releaseRequestSeq) {
        releaseLoading.value = false
      }
      if (inflightReleaseKey === key) {
        inflightReleaseKey = ''
      }
    }
  }

  async function loadRepos() {
    repoLoading.value = true
    try {
      allRepos.value = await fetchHelmRepositoryList()
      if (!selectedRepoId.value && allRepos.value.length) {
        selectedRepoId.value = allRepos.value[0]?.id ?? null
      }
    } catch (e: unknown) {
      allRepos.value = []
      ElMessage.error(e instanceof Error ? e.message : '获取仓库列表失败')
    } finally {
      repoLoading.value = false
    }
  }

  function refreshCurrentView() {
    loadedReleaseKey = ''
    if (activeView.value === 'releases') {
      void loadReleases()
      return
    }
    void loadRepos()
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
        ElMessage.success('部署成功')
      } else {
        await upgradeHelmRelease(c, ns, body)
        ElMessage.success('升级成功')
      }
      releaseFormVisible.value = false
      loadedReleaseKey = ''
      await loadReleases()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      releaseFormSubmitting.value = false
    }
  }

  async function confirmUninstall(row: HelmReleaseItem) {
    try {
      await ElMessageBox.confirm(`确认卸载 Release "${row.name}"?`, '卸载应用', { type: 'warning' })
      await uninstallHelmRelease(cluster.value, selectedNamespace.value, row.name)
      ElMessage.success('卸载成功')
      detailVisible.value = false
      loadedReleaseKey = ''
      await loadReleases()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '卸载失败')
    }
  }

  async function openReleaseDetail(row: HelmReleaseItem) {
    detailRelease.value = row
    detailVisible.value = true
    historyReleaseName.value = row.name
    historyLoading.value = true
    try {
      historyRows.value = await fetchHelmReleaseHistory(
        cluster.value,
        selectedNamespace.value,
        row.name
      )
    } catch (e: unknown) {
      historyRows.value = []
      ElMessage.error(e instanceof Error ? e.message : '获取修订历史失败')
    } finally {
      historyLoading.value = false
    }
  }

  async function openHistoryDialog(row: HelmReleaseItem) {
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
      ElMessage.error(e instanceof Error ? e.message : '获取修订历史失败')
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
      await ElMessageBox.confirm(`确认回滚到修订版本 ${ver}?`, '版本回滚', { type: 'warning' })
      await rollbackHelmRelease(
        cluster.value,
        selectedNamespace.value,
        historyReleaseName.value,
        ver
      )
      ElMessage.success('回滚成功')
      historyVisible.value = false
      detailVisible.value = false
      loadedReleaseKey = ''
      await loadReleases()
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
      await loadRepos()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      repoFormSubmitting.value = false
    }
  }

  async function confirmDeleteRepo(row: HelmRepository) {
    try {
      await ElMessageBox.confirm(`确认删除仓库 "${row.name}"?`, '删除仓库', { type: 'warning' })
      await deleteHelmRepository(row.id)
      ElMessage.success('删除成功')
      if (selectedRepoId.value === row.id) {
        selectedRepoId.value = null
      }
      await loadRepos()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  watch(
    () => cluster.value,
    (c) => {
      if (!c || !selectedNamespace.value) {
        allReleases.value = []
        loadedReleaseKey = ''
        return
      }
      loadedReleaseKey = ''
      void loadReleases()
    },
    { immediate: true, flush: 'post' }
  )

  useClusterDetailNamespaceRefresh('helm', () => {
    loadedReleaseKey = ''
    void loadReleases()
  })

  watch(activeView, (view) => {
    if (view === 'repos') {
      void loadRepos()
    }
  })

  watch(filteredRepos, (repos) => {
    if (!repos.length) {
      selectedRepoId.value = null
      return
    }
    if (!repos.some((item) => item.id === selectedRepoId.value)) {
      selectedRepoId.value = repos[0]?.id ?? null
    }
  })

  return {
    activeView,
    cluster,
    selectedNamespace,
    releaseLoading,
    releaseSearch,
    filteredReleases,
    releaseStats,
    repoLoading,
    repoSearch,
    filteredRepos,
    selectedRepo,
    selectedRepoId,
    releaseFormVisible,
    releaseFormMode,
    releaseFormSubmitting,
    releaseForm,
    releaseFormValuesText,
    historyVisible,
    historyLoading,
    historyRows,
    detailRelease,
    detailVisible,
    repoFormVisible,
    repoFormSubmitting,
    repoForm,
    refreshCurrentView,
    loadReleases,
    loadRepos,
    openInstallDialog,
    openUpgradeDialog,
    resetReleaseForm,
    submitReleaseForm,
    confirmUninstall,
    openReleaseDetail,
    openHistoryDialog,
    confirmRollback,
    openRepoDialog,
    resetRepoForm,
    submitRepoForm,
    confirmDeleteRepo
  }
}
