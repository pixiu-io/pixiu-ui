<!-- 集群概览：资源概览、用量曲线、组件摘要（Mock） -->
<template>
  <div class="cluster-overview">
    <ElTabs v-model="innerTab" class="cluster-overview-tabs">
      <ElTabPane label="概览" name="main">
        <section class="section-title">资源概览</section>
        <ElRow :gutter="16">
          <ElCol :xs="24" :lg="12">
            <ElCard shadow="never" class="resource-card" v-loading="resourceOverviewLoading">
              <div class="resource-card__head">
                <span class="resource-card__title">节点</span>
                <ElLink
                  type="primary"
                  underline="never"
                  style="font-size: 12px"
                  @click="go('nodes')"
                  >查看节点列表</ElLink
                >
              </div>
              <div class="resource-card__body">
                <div class="resource-card__chart">
                  <ArtRingChart
                    height="152px"
                    :data="nodeRingData"
                    :radius="['48%', '66%']"
                    :border-radius="7"
                    :center-text="nodeCenterText"
                    :center-text-font-size="14"
                    :show-label="false"
                  />
                </div>
                <ul class="resource-card__stats">
                  <li v-for="n in nodeStats" :key="n.label">
                    <span class="dot" :style="{ background: n.color }" />
                    <span>{{ n.label }}</span>
                    <strong
                      >{{ n.value
                      }}<span class="resource-card__pct">（{{ n.percent }}%）</span></strong
                    >
                  </li>
                </ul>
              </div>
              <div class="resource-card__foot">
                <ElButton text size="small" @click="go('nodes')">创建节点</ElButton>
              </div>
            </ElCard>
          </ElCol>
          <ElCol :xs="24" :lg="12">
            <ElCard shadow="never" class="resource-card" v-loading="resourceOverviewLoading">
              <div class="resource-card__head">
                <span class="resource-card__title">工作负载</span>
                <ElLink
                  type="primary"
                  underline="never"
                  style="font-size: 12px"
                  @click="go('workloads')"
                  >查看列表</ElLink
                >
              </div>
              <div class="resource-card__body">
                <div class="resource-card__chart">
                  <ArtRingChart
                    height="152px"
                    :data="wlRingData"
                    :radius="['48%', '66%']"
                    :border-radius="7"
                    :center-text="wlCenterText"
                    :center-text-font-size="14"
                    :show-label="false"
                  />
                </div>
                <ul class="resource-card__stats">
                  <li v-for="w in wlStats" :key="w.label">
                    <span class="dot" :style="{ background: w.color }" />
                    <span>{{ w.label }}</span>
                    <strong
                      >{{ w.value
                      }}<span class="resource-card__pct">（{{ w.percent }}%）</span></strong
                    >
                  </li>
                </ul>
              </div>
              <div class="resource-card__foot">
                <ElButton text size="small" @click="go('workloads')">创建工作负载</ElButton>
              </div>
            </ElCard>
          </ElCol>
        </ElRow>

        <section class="section-title mt-6">用量概览（近 24 小时）</section>
        <ElCard v-loading="usageOverviewInitialLoading" shadow="never" class="usage-overview-card">
          <div class="usage-overview-grid">
            <MetricChartPanel
              title="CPU 利用率（%）"
              :data="cpuUtilPercent"
              :x-axis-data="cpuUtilLabels"
              :is-empty="!cpuUtilPercent.length"
              :silent-update="usageChartSilentUpdate"
              height="160px"
              plain
            />
            <MetricChartPanel
              title="内存利用率（%）"
              :data="memUtilPercent"
              :x-axis-data="memUtilLabels"
              :is-empty="!memUtilPercent.length"
              :silent-update="usageChartSilentUpdate"
              height="160px"
              plain
            />
            <MetricChartPanel
              title="CPU 使用量（核）"
              :data="cpuUsageCores"
              :x-axis-data="cpuUtilLabels"
              :is-empty="!cpuUsageCores.length"
              :silent-update="usageChartSilentUpdate"
              height="160px"
              plain
            />
            <MetricChartPanel
              title="内存使用量（GB）"
              :data="memUsageGib"
              :x-axis-data="memUtilLabels"
              :is-empty="!memUsageGib.length"
              :silent-update="usageChartSilentUpdate"
              height="160px"
              plain
            />
          </div>
        </ElCard>

        <section class="section-title mt-6">已安装组件</section>
        <ElCard shadow="never" class="components-card">
          <ElRow :gutter="16">
            <ElCol :span="8">
              <div class="comp-stat">
                <span class="comp-stat__label">组件总数</span>
                <span class="comp-stat__value">{{ compSummary.total }}</span>
              </div>
            </ElCol>
            <ElCol :span="8">
              <div class="comp-stat">
                <span class="comp-stat__label">运行中</span>
                <span class="comp-stat__value text-success">{{ compSummary.running }}</span>
              </div>
            </ElCol>
            <ElCol :span="8">
              <div class="comp-stat">
                <span class="comp-stat__label">可升级</span>
                <span class="comp-stat__value text-warning">{{ compSummary.upgradable }}</span>
              </div>
            </ElCol>
          </ElRow>
        </ElCard>
      </ElTabPane>

      <ElTabPane label="基本信息" name="basic">
        <div class="basic-panel">
          <ElCard shadow="never" class="basic-info-card">
            <template #header>
              <span class="basic-info-card__title">集群信息</span>
            </template>
            <ElRow :gutter="48">
              <ElCol :xs="24" :md="12">
                <dl class="info-dl">
                  <div class="info-dl__row">
                    <dt>集群名称</dt>
                    <dd>
                      <span>{{ ctx.aliasName }}</span>
                      <ElButton
                        v-if="ctx.id"
                        link
                        type="primary"
                        class="info-dl__edit"
                        @click="openAliasDialog"
                      >
                        <ArtSvgIcon icon="ri:edit-line" />
                      </ElButton>
                    </dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>集群 ID</dt>
                    <dd>{{ ctx.name }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>Kubernetes 版本</dt>
                    <dd>{{ ctx.version || '-' }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>部署类型</dt>
                    <dd>{{ clusterTypeLabel }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>状态</dt>
                    <dd>{{ statusTag.text }}</dd>
                  </div>
                  <div v-if="ctx.clusterType === 1" class="info-dl__row">
                    <dt>部署计划 ID</dt>
                    <dd>{{ ctx.planId || '-' }}</dd>
                  </div>
                </dl>
              </ElCol>
              <ElCol :xs="24" :md="12">
                <dl class="info-dl">
                  <div class="info-dl__row">
                    <dt>高可用</dt>
                    <dd class="info-dl__switch">
                      <ElSwitch
                        :model-value="clusterDetail.haMode === 'ha'"
                        disabled
                        size="small"
                      />
                      <span class="info-dl__switch-text">{{
                        clusterDetail.haMode === 'ha' ? '已开启' : '未开启'
                      }}</span>
                    </dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>删除保护</dt>
                    <dd class="info-dl__switch">
                      <ElSwitch
                        :model-value="ctx.isProtected"
                        :disabled="!ctx.id || protectSaving"
                        size="small"
                        @change="onProtectChange"
                      />
                      <span class="info-dl__switch-text">{{
                        ctx.isProtected ? '已开启' : '未开启'
                      }}</span>
                    </dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>创建时间</dt>
                    <dd>{{ ctx.createTime || '-' }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>容器运行时</dt>
                    <dd>{{
                      planDetail?.config?.runtime?.runtime || clusterDetail.containerRuntime
                    }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>集群描述</dt>
                    <dd>{{ planDetail?.description || (ctx as any).description || '-' }}</dd>
                  </div>
                </dl>
              </ElCol>
            </ElRow>
          </ElCard>

          <ElCard shadow="never" class="basic-info-card">
            <template #header>
              <span class="basic-info-card__title">节点和网络信息</span>
            </template>
            <ElRow :gutter="48">
              <ElCol :xs="24" :md="12">
                <dl class="info-dl">
                  <div class="info-dl__row">
                    <dt>节点规模</dt>
                    <dd>
                      <span>{{ basicNodeTotal }} 个</span>
                      <ElLink
                        type="primary"
                        underline="never"
                        class="info-dl__link"
                        @click="go('nodes')"
                        >查看节点列表</ElLink
                      >
                    </dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>Service IP 段</dt>
                    <dd>{{
                      planDetail?.config?.network?.service_network || basicNetwork.serviceCidr
                    }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>容器网络</dt>
                    <dd>{{ planDetail?.config?.network?.pod_network || basicNetwork.podCidr }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>kube-proxy 转发模式</dt>
                    <dd>{{
                      planDetail?.config?.network?.network_interface || clusterDetail.kubeProxyMode
                    }}</dd>
                  </div>
                </dl>
              </ElCol>
              <ElCol :xs="24" :md="12">
                <dl class="info-dl">
                  <div class="info-dl__row">
                    <dt>操作系统</dt>
                    <dd>{{ planDetail?.config?.os_image || clusterDetail.osImage }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>CNI</dt>
                    <dd>{{ planDetail?.config?.network?.cni || clusterDetail.cni }}</dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>DNS域</dt>
                    <dd>
                      <span>{{ basicNetwork.clusterDns }}</span>
                      <ElButton
                        link
                        class="info-dl__copy"
                        @click="copyText(basicNetwork.clusterDns)"
                      >
                        <ArtSvgIcon icon="ri:file-copy-line" style="font-size: 13px" />
                      </ElButton>
                    </dd>
                  </div>
                  <div class="info-dl__row">
                    <dt>监听端口</dt>
                    <dd>{{ clusterDetail.apiServerPort }}</dd>
                  </div>
                </dl>
              </ElCol>
            </ElRow>
          </ElCard>
        </div>

        <ElDialog v-model="aliasDialogVisible" title="修改集群名称" width="420px" destroy-on-close>
          <ElForm label-width="88px" @submit.prevent>
            <ElFormItem label="集群名称">
              <ElInput v-model="aliasEditValue" maxlength="64" show-word-limit />
            </ElFormItem>
          </ElForm>
          <template #footer>
            <ElButton @click="aliasDialogVisible = false">取消</ElButton>
            <ElButton type="primary" :loading="aliasSaving" @click="saveAlias">确定</ElButton>
          </template>
        </ElDialog>
      </ElTabPane>

      <ElTabPane label="API Server" name="api">
        <div class="basic-panel">
          <ElCard shadow="never" class="basic-info-card">
            <template #header>
              <span class="basic-info-card__title">用户说明</span>
            </template>
            <div class="info-dl">
              <div class="info-dl__row">
                <dt>连接方式</dt>
                <dd>通过 Kubectl 连接 Kubernetes 集群</dd>
              </div>
              <div class="info-dl__row">
                <dt>操作指引</dt>
                <dd>
                  <span
                    >请将 Kubeconfig 文件放置于本地 {{ kubeconfigPathHint }}，或通过环境变量 export
                    KUBECONFIG 指定路径。</span
                  >
                  <ElButton link class="info-dl__copy" @click="copyText(kubeconfigPathHint)">
                    <ArtSvgIcon icon="ri:file-copy-line" style="font-size: 13px" />
                  </ElButton>
                </dd>
              </div>
            </div>
          </ElCard>

          <ElCard shadow="never" class="basic-info-card mt-2">
            <template #header>
              <div style="display: flex; align-items: center; justify-content: space-between">
                <span class="basic-info-card__title">集群 KubeConfig</span>
                <div class="kubeconfig-actions">
                  <ElLink
                    v-if="!kubeconfigVisible"
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="kubeconfigVisible = true"
                  >
                    显示
                  </ElLink>
                  <ElLink
                    v-else
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="kubeconfigVisible = false"
                  >
                    隐藏
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="copyKubeconfig"
                  >
                    拷贝
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="downloadKubeconfig"
                  >
                    下载
                  </ElLink>
                </div>
              </div>
            </template>
            <div v-loading="kubeconfigLoading" class="kubeconfig-body">
              <pre v-if="kubeconfigContent && kubeconfigVisible" class="kubeconfig-pre">{{
                kubeconfigContent
              }}</pre>
              <div v-else-if="kubeconfigContent" class="kubeconfig-hidden">KubeConfig 内容已隐藏</div>
              <ElEmpty v-else description="暂无 KubeConfig 内容" :image-size="80" />
            </div>
          </ElCard>
        </div>
      </ElTabPane>
    </ElTabs>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { inject, computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    decodeKubeConfigBase64,
    fetchProtectCluster,
    fetchUpdateClusterAlias,
    fetchClusterByName,
    fetchGetClusterKubeconfig,
    PixiuApiError,
    type KubeconfigResponse
  } from '@/api/container'
  import { fetchPlanWithResources, type PlanResourcesDetail } from '@/api/plan'
  import {
    fetchClusterBasicNetwork,
    fetchClusterDetailInfo,
    fetchClusterOverviewK8sStats,
    type ClusterBasicNetwork,
    type ClusterDetailInfo,
    type ClusterOverviewK8sStats
  } from '@/api/kubernetes/cluster-overview-stats'
  import { useClusterNodesUsageMetrics } from '@/hooks/kubernetes/useClusterNodesUsageMetrics'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import { clusterDetailContextKey, clusterDetailRefreshKey } from './context'
  import { getCronJobApiVersion } from '@/utils/kubernetes/cronjob'

  defineOptions({ name: 'ClusterDetailOverview' })

  const router = useRouter()
  const route = useRoute()
  const ctxRef = inject(clusterDetailContextKey)
  const refreshCluster = inject(clusterDetailRefreshKey)
  const ctx = computed(() => ctxRef!.value)
  const cronJobApiVersion = computed(() => getCronJobApiVersion(ctx.value?.version))

  const innerTab = ref('main')

  const OVERVIEW_ROUTE_NAME = 'ClusterDetailOverview'
  const isOverviewRoute = computed(() => route.name === OVERVIEW_ROUTE_NAME)

  const OVERVIEW_TAB_NAMES = new Set(['main', 'basic', 'api'])

  watch(
    () => route.query.overviewTab,
    (raw: any) => {
      const t = Array.isArray(raw) ? raw[0] : raw
      if (typeof t === 'string' && t === 'kubeconfig') {
        innerTab.value = 'api'
        return
      }
      innerTab.value = typeof t === 'string' && OVERVIEW_TAB_NAMES.has(t) ? t : 'main'
    },
    { immediate: true }
  )

  const resourceOverviewLoading = ref(false)
  const k8sOverview = ref<ClusterOverviewK8sStats>({
    nodes: { controlPlane: 0, worker: 0, total: 0 },
    workloads: {
      deployment: 0,
      statefulSet: 0,
      daemonSet: 0,
      cronJob: 0,
      job: 0
    }
  })

  // 缓存当前已加载的集群概览数据，避免重复请求
  const loadedOverviewCluster = ref('')

  async function loadClusterResourceOverview(force = false) {
    if (resourceOverviewLoading.value) return
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !isOverviewRoute.value) return
    if (!force && loadedOverviewCluster.value === cluster) return

    resourceOverviewLoading.value = true
    try {
      const stats = await fetchClusterOverviewK8sStats(cluster, force, cronJobApiVersion.value)
      k8sOverview.value = stats
      loadedOverviewCluster.value = cluster
    } catch {
      k8sOverview.value = {
        nodes: { controlPlane: 0, worker: 0, total: 0 },
        workloads: { deployment: 0, statefulSet: 0, daemonSet: 0, cronJob: 0, job: 0 }
      }
      loadedOverviewCluster.value = ''
    } finally {
      resourceOverviewLoading.value = false
    }
  }

  const basicLoading = ref(false)
  const basicNetwork = ref<ClusterBasicNetwork>({
    serviceCidr: '-',
    clusterDns: '-',
    podCidr: '-'
  })
  const planDetail = ref<PlanResourcesDetail | null>(null)
  const planLoading = ref(false)
  const clusterDetail = ref<ClusterDetailInfo>({
    osImage: '-',
    containerRuntime: '-',
    kubeProxyMode: '-',
    apiServerPort: '-',
    haMode: '-',
    cni: '-'
  })
  const aliasDialogVisible = ref(false)
  const aliasEditValue = ref('')
  const aliasSaving = ref(false)
  const protectSaving = ref(false)

  // 缓存当前已加载的基本信息集群，避免重复请求
  const loadedBasicCluster = ref('')

  async function loadBasicInfo(force = false) {
    if (basicLoading.value) return
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !isOverviewRoute.value) return
    if (!force && loadedBasicCluster.value === cluster) return

    basicLoading.value = true
    // 并行发起统计和网络信息请求
    try {
      const [stats, network] = await Promise.all([
        fetchClusterOverviewK8sStats(cluster, force, cronJobApiVersion.value),
        fetchClusterBasicNetwork(cluster)
      ])
      k8sOverview.value = stats
      basicNetwork.value = network
      loadedOverviewCluster.value = cluster
      loadedBasicCluster.value = cluster
    } catch {
      // 失败不更新 loadedBasicCluster，允许重试
    } finally {
      basicLoading.value = false
    }

    fetchClusterDetailInfo(cluster, undefined)
      .then((detail) => {
        clusterDetail.value = detail
      })
      .catch(() => {})

    if (ctx.value.clusterType === 1 && ctx.value.planId) {
      planLoading.value = true
      fetchPlanWithResources(ctx.value.planId)
        .then((plan) => {
          planDetail.value = plan
        })
        .catch(() => {
          planDetail.value = null
        })
        .finally(() => {
          planLoading.value = false
        })
    }
  }

  const kubeconfigPathHint = '~/.kube/<下载的kubeconfig>'

  // Kubeconfig 相关状态
  const kubeconfigLoading = ref(false)
  const kubeconfigContent = ref('')
  const kubeconfigVisible = ref(false)
  const kubeconfigData = ref<KubeconfigResponse | null>(null)
  const loadedKubeconfigCluster = ref('')

  async function resolveClusterId(): Promise<number> {
    if (ctx.value.id) return ctx.value.id
    const name = ctx.value.name
    if (!name) return 0
    const item = await fetchClusterByName(name)
    return item?.id ?? 0
  }

  function decodeKubeconfigContent(encoded: string): string {
    if (!encoded) return ''
    try {
      return decodeKubeConfigBase64(encoded)
    } catch {
      return encoded
    }
  }

  async function loadKubeconfig(force = false) {
    if (kubeconfigLoading.value) return
    const clusterKey = `${ctx.value.name}:${ctx.value.id}`
    if (!force && loadedKubeconfigCluster.value === clusterKey) return

    kubeconfigLoading.value = true
    kubeconfigContent.value = ''
    kubeconfigVisible.value = false
    try {
      const clusterId = await resolveClusterId()
      if (!clusterId) {
        ElMessage.warning('集群 ID 未就绪，请稍后重试')
        return
      }

      const data = await fetchGetClusterKubeconfig(clusterId)
      kubeconfigData.value = data
      kubeconfigContent.value = decodeKubeconfigContent(data.content)
      loadedKubeconfigCluster.value = clusterKey
    } catch (e: unknown) {
      kubeconfigContent.value = ''
      if (e instanceof PixiuApiError && e.notified) return
      ElMessage.error(e instanceof Error ? e.message : '获取 Kubeconfig 失败')
    } finally {
      kubeconfigLoading.value = false
    }
  }

  function copyKubeconfig() {
    if (!kubeconfigContent.value) {
      ElMessage.warning('暂无 Kubeconfig 内容')
      return
    }
    copyText(kubeconfigContent.value)
  }

  function downloadKubeconfig() {
    if (!kubeconfigContent.value) {
      ElMessage.warning('暂无 Kubeconfig 内容')
      return
    }

    const fileName = `${kubeconfigData.value?.cluster_name || ctx.value.name || 'kubeconfig'}.yaml`
    const blob = new Blob([kubeconfigContent.value], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const STATUS_MAP = {
    0: { type: 'success' as const, text: '运行中' },
    1: { type: 'primary' as const, text: '部署中' },
    2: { type: 'info' as const, text: '等待部署' },
    3: { type: 'danger' as const, text: '部署失败' },
    4: { type: 'warning' as const, text: '集群失联' }
  }

  const statusTag = computed(() => {
    const s = ctx.value.status
    return STATUS_MAP[s as keyof typeof STATUS_MAP] ?? { type: 'info' as const, text: '未知' }
  })

  const clusterTypeLabel = computed(() => (ctx.value.clusterType === 1 ? '自建集群' : '标准集群'))

  const basicNodeTotal = computed(() =>
    Math.max(ctx.value.nodeCount, k8sOverview.value.nodes.total)
  )

  function openAliasDialog() {
    aliasEditValue.value = ctx.value.aliasName
    aliasDialogVisible.value = true
  }

  async function saveAlias() {
    const name = aliasEditValue.value.trim()
    if (!name) {
      ElMessage.warning('请输入集群名称')
      return
    }
    if (!ctx.value.id) return
    aliasSaving.value = true
    try {
      await fetchUpdateClusterAlias(ctx.value.id, ctx.value.resourceVersion, name)
      ElMessage.success('集群名称已更新')
      aliasDialogVisible.value = false
      await refreshCluster?.()
      const q = { ...route.query, aliasName: name }
      router.replace({ path: route.path, query: q })
    } catch (e: unknown) {
      if (e instanceof PixiuApiError && e.notified) return
      ElMessage.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      aliasSaving.value = false
    }
  }

  async function onProtectChange(val: string | number | boolean) {
    if (!ctx.value.id) return
    const next = Boolean(val)
    protectSaving.value = true
    try {
      await fetchProtectCluster(ctx.value.id, ctx.value.resourceVersion, next)
      ElMessage.success(next ? '已开启删除保护' : '已关闭删除保护')
      await refreshCluster?.()
    } catch (e: unknown) {
      if (e instanceof PixiuApiError && e.notified) return
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      protectSaving.value = false
    }
  }

  const seed = computed(() => ctx.value.seed)

  const nodeRingData = computed(() => {
    const { controlPlane, worker } = k8sOverview.value.nodes
    return [
      { name: '管控节点', value: controlPlane },
      { name: '工作节点', value: worker }
    ]
  })

  const nodeTotal = computed(() => k8sOverview.value.nodes.total)
  const nodeCenterText = computed(() => String(nodeTotal.value))

  function buildRingStats(data: { name: string; value: number }[], colors: string[]) {
    const total = data.reduce((sum, item) => sum + item.value, 0) || 1
    return data.map((item, i) => ({
      label: item.name,
      value: item.value,
      percent: Math.round((item.value / total) * 100),
      color: colors[i]
    }))
  }

  const nodeStats = computed(() =>
    buildRingStats(nodeRingData.value, ['var(--el-color-primary)', 'var(--el-color-success)'])
  )

  const wlRingData = computed(() => {
    const w = k8sOverview.value.workloads
    return [
      { name: 'Deployment', value: w.deployment },
      { name: 'StatefulSet', value: w.statefulSet },
      { name: 'DaemonSet', value: w.daemonSet },
      { name: 'CronJob', value: w.cronJob },
      { name: 'Job', value: w.job }
    ]
  })

  const wlTotal = computed(() =>
    Object.values(k8sOverview.value.workloads).reduce((a: any, b: any) => a + b, 0)
  )
  const wlCenterText = computed(() => String(wlTotal.value))

  const wlStats = computed(() =>
    buildRingStats(wlRingData.value, [
      'var(--el-color-primary)',
      'var(--el-color-success)',
      'var(--el-color-warning)',
      'var(--el-color-info)',
      'var(--el-color-danger)'
    ])
  )

  const clusterName = computed(() => ctx.value.name)

  const {
    loading: usageOverviewLoading,
    chartReady: usageChartReady,
    cpuTimeLabels: cpuUtilLabels,
    memoryTimeLabels: memUtilLabels,
    cpuUtilPercent,
    cpuUsageCores,
    memUtilPercent,
    memUsageGib,
    startRefresh: startUsageOverviewRefresh,
    stopRefresh: stopUsageOverviewRefresh,
    resetCharts: resetUsageOverviewCharts
  } = useClusterNodesUsageMetrics(clusterName)

  const usageOverviewInitialLoading = computed(
    () => usageOverviewLoading.value && !usageChartReady.value
  )

  const usageChartSilentUpdate = ref(false)
  let usageChartAnimateTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleUsageChartSilentUpdate() {
    if (usageChartAnimateTimer) clearTimeout(usageChartAnimateTimer)
    usageChartAnimateTimer = setTimeout(() => {
      usageChartSilentUpdate.value = true
      usageChartAnimateTimer = null
    }, 1500)
  }

  watch(usageChartReady, (ready: any) => {
    if (ready && !usageChartSilentUpdate.value) scheduleUsageChartSilentUpdate()
  })

  function stopOverviewBackgroundLoads() {
    stopUsageOverviewRefresh()
    resetUsageOverviewCharts()
    usageChartSilentUpdate.value = false
    if (usageChartAnimateTimer) {
      clearTimeout(usageChartAnimateTimer)
      usageChartAnimateTimer = null
    }
  }

  /** 仅在概览路由且 KeepAlive 激活时拉取各 Tab 数据，避免切到节点管理等页仍发统计请求 */
  function syncOverviewTabLoads() {
    if (!isOverviewRoute.value) {
      stopOverviewBackgroundLoads()
      return
    }

    const cluster = ctx.value.name
    if (!cluster) return

    const tab = innerTab.value
    if (tab === 'main') {
      void loadClusterResourceOverview()
      startUsageOverviewRefresh()
    } else {
      stopOverviewBackgroundLoads()
    }
    if (tab === 'basic') void loadBasicInfo()
    if (tab === 'api') void loadKubeconfig()
  }

  watch(
    () => [ctx.value.name, ctx.value.id, innerTab.value, route.name] as const,
    () => {
      syncOverviewTabLoads()
    },
    { immediate: true }
  )

  // 集群版本就绪后，重新加载 CronJob 统计（此前因版本未知被跳过）
  watch(cronJobApiVersion, (v: any, prev: any) => {
    if (v && !prev) syncOverviewTabLoads()
  })

  onActivated(() => {
    // watch(immediate:true) 在初次挂载时已执行。
    // 如果是 KeepAlive 重新激活，且 watch 依赖没变，则手动触发一次同步
    syncOverviewTabLoads()
  })

  onDeactivated(() => {
    stopOverviewBackgroundLoads()
  })

  onUnmounted(() => {
    stopOverviewBackgroundLoads()
  })

  const compSummary = computed(() => ({
    total: 18 + (seed.value % 7),
    running: 16 + (seed.value % 5),
    upgradable: 2
  }))

  function go(path: string) {
    router.push({ path: `/container/${path}`, query: { ...route.query } })
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  }
</script>

<style scoped>
  .cluster-overview-tabs :deep(.el-tabs__header) {
    margin: 0 0 4px;
  }

  .cluster-overview-tabs :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }

  .cluster-overview-tabs :deep(.el-tabs__item) {
    height: 40px;
    line-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .cluster-overview-tabs :deep(.el-tabs__item.is-active) {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .cluster-overview-tabs :deep(.el-tabs__active-bar) {
    height: 2px;
    border-radius: 2px 2px 0 0;
  }

  .section-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .resource-card {
    border-radius: 8px;
    overflow: visible;
  }

  .resource-card :deep(.el-card__body) {
    overflow: visible;
  }

  .resource-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .resource-card__title {
    font-size: 14px;
    font-weight: 600;
  }

  .resource-card__body {
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: center;
    overflow: visible;
  }

  .resource-card__chart {
    flex: 0 0 152px;
    width: 152px;
    margin-left: 12px;
    overflow: visible;
  }

  .resource-card__stats {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .resource-card__stats li {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .resource-card__stats li:last-child {
    margin-bottom: 0;
  }

  .resource-card__stats strong {
    margin-left: auto;
    color: var(--el-text-color-regular);
    font-weight: 400;
    white-space: nowrap;
  }

  .resource-card__pct {
    margin-left: 2px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .resource-card__foot {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .chart-card__title {
    font-size: 14px;
    font-weight: 600;
  }

  .usage-overview-card {
    border-radius: 8px;
    border: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color);
  }

  .usage-overview-card :deep(.el-card__body) {
    padding: 16px;
  }

  .usage-overview-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .usage-overview-grid > :deep(.metric-chart-panel) {
    min-width: 0;
  }

  .usage-overview-grid > :deep(.metric-chart-panel__header) {
    margin-bottom: 4px;
  }

  .usage-overview-grid > :deep(.metric-chart-panel__title) {
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
  }

  .usage-overview-grid > :deep(.metric-chart-panel__maximize) {
    margin-top: -2px;
  }

  .components-card {
    border-radius: 8px;
  }

  .comp-stat {
    text-align: center;
    padding: 12px 0;
  }

  .comp-stat__label {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }

  .comp-stat__value {
    font-size: 22px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .text-success {
    color: var(--el-color-success);
  }

  .text-warning {
    color: var(--el-color-warning);
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
  }

  .mt-6 {
    margin-top: 24px;
  }

  .basic-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px 0 16px;
  }

  .basic-info-card {
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }

  .basic-info-card :deep(.el-card__header) {
    padding: 14px 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .basic-info-card :deep(.el-card__body) {
    padding: 20px 20px 24px;
  }

  .basic-info-card__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .info-dl {
    margin: 0;
  }

  .info-dl__row {
    display: flex;
    align-items: center;
    margin-bottom: 0;
    height: 38px;
    font-size: 12px;
    line-height: 20px;
  }

  .info-dl__row:last-child {
    margin-bottom: 0;
  }

  .info-dl__row dt {
    flex: 0 0 150px;
    margin: 0;
    padding-left: 8px;
    color: var(--el-text-color-regular);
    font-weight: 400;
  }

  .info-dl__row dd {
    flex: 1;
    min-width: 0;
    margin: 0;
    color: var(--el-text-color-primary);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .info-dl__edit {
    padding: 0;
    height: auto;
    font-size: 14px;
  }

  .info-dl__copy {
    padding: 0;
    height: auto;
    color: var(--el-text-color-secondary);
  }

  .info-dl__copy:hover {
    color: var(--el-color-primary);
  }

  .info-dl__link {
    font-size: 12px;
  }

  .info-dl__switch {
    gap: 10px;
  }

  .info-dl__switch-text {
    color: var(--el-text-color-regular);
    font-size: 12px;
  }

  .kubeconfig-actions {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }

  .kubeconfig-action {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
  }

  .kubeconfig-action :deep(.el-link__inner) {
    font-size: 12px;
  }

  .kubeconfig-body {
    min-height: 480px;
  }

  .kubeconfig-hidden {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 440px;
    padding: 16px;
    background: var(--el-bg-color-page);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .kubeconfig-pre {
    margin: 0;
    padding: 16px;
    background: var(--el-bg-color-page);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
    word-wrap: break-word;
    min-height: 440px;
  }
</style>
