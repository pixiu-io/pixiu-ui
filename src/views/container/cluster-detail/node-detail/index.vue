<template>
  <div class="nd">
    <ElCard class="nd-card nd-card--overview" v-loading="loading">
      <div class="nd-hd">
        <ElButton :icon="ArrowLeft" text @click="goBack">返回</ElButton>
        <el-divider direction="vertical" class="nd-vdv nd-vdv--cluster" />
        <span class="nd-title">
          <span class="nd-title__kind">资源类型:</span>
          <span class="nd-title__value">Node</span>
        </span>
        <ElTag :type="statusTagType" effect="light" class="nd-title-status">
          {{ statusText }}
        </ElTag>
        <el-divider direction="vertical" class="nd-vdv" />
        <div class="nd-cluster-wrap">
          <span class="nd-cluster-label">集群:</span>
          <span class="nd-cluster-value">{{ clusterAlias }}</span>
        </div>
        <div class="nd-hd-actions">
          <ElButton v-ripple @click="openRemoteLoginSameAsHost">远程登录</ElButton>
          <ElButton v-ripple @click="yamlVisible = true">查看YAML</ElButton>
          <ArtButtonMore
            :list="[
              { key: 'labels', label: '标签管理', icon: 'ri:price-tag-3-line' },
              {
                key: 'schedule',
                label: node?.spec?.unschedulable ? '开启调度' : '禁止调度',
                icon: 'ri:compass-3-line'
              },
              { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }
            ]"
            @click="onMoreClick"
          />
        </div>
      </div>

      <div class="nd-section-title">基本信息</div>
      <template v-if="!loading && node">
        <div class="nd-info-grid">
          <div class="nd-info-cell">
            <span class="nd-k">节点名称</span>
            <span class="nd-v nd-v--with-tag">
              <span>{{ node.metadata.name }}</span>
              <ElTag size="small" :type="nodeTypeTagType" effect="light">{{ nodeTypeTagText }}</ElTag>
            </span>
          </div>
          <div class="nd-info-cell"><span class="nd-k">操作系统</span><span class="nd-v">{{ node.status?.nodeInfo?.osImage || '-' }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">创建时间</span><span class="nd-v">{{ formatNodeCreationTime(node.metadata.creationTimestamp) }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">运行状态</span><span class="nd-v">{{ runningStatusText }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">容器运行时</span><span class="nd-v">{{ formatContainerRuntime(node) }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">kubelet版本</span><span class="nd-v">{{ formatKubeletVersion(node) }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">PodCIDRs</span><span class="nd-v">{{ podCidrsText }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">内核版本</span><span class="nd-v">{{ kernelVersionText }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">IP地址</span><span class="nd-v">{{ formatNodeInternalIp(node) }}</span></div>
          <div class="nd-info-cell">
            <span class="nd-k">标签</span>
            <div class="nd-tag-group">
              <template v-if="visibleLabelEntries.length">
                <el-tag
                  v-for="item in visibleLabelEntries"
                  :key="item.key"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="nd-mono-tag"
                >
                  {{ item.key }}:{{ item.value }}
                </el-tag>
                <el-button
                  v-if="hasMoreLabels"
                  link
                  type="primary"
                  class="nd-more-btn"
                  @click="showAllLabels = !showAllLabels"
                >
                  {{ showAllLabels ? '收起' : '更多' }}
                </el-button>
              </template>
              <span v-else class="nd-empty">-</span>
            </div>
          </div>
          <div class="nd-info-cell">
            <span class="nd-k">注释</span>
            <div class="nd-tag-group">
              <template v-if="visibleAnnotationEntries.length">
                <el-tag
                  v-for="item in visibleAnnotationEntries"
                  :key="item.key"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="nd-mono-tag"
                >
                  {{ item.key }}:{{ item.value }}
                </el-tag>
                <el-button
                  v-if="hasMoreAnnotations"
                  link
                  type="primary"
                  class="nd-more-btn"
                  @click="showAllAnnotations = !showAllAnnotations"
                >
                  {{ showAllAnnotations ? '收起' : '更多' }}
                </el-button>
              </template>
              <span v-else class="nd-empty">-</span>
            </div>
          </div>
        </div>
      </template>
    </ElCard>

    <div class="nd-workloads-copy">
      <ClusterDetailWorkloads
        deploy-tab-label="容器组"
        deploy-data-mode="pod"
        :deploy-node-name="name"
        :show-deploy-create="false"
        sts-tab-label="访问方式"
        ds-tab-label="日志"
        job-tab-label="事件"
        cj-tab-label="版本记录"
        :show-sts-tab="false"
        :show-ds-tab="false"
        :show-cj-tab="false"
        :show-node-status-tab="true"
        :show-node-resource-tab="true"
        :show-node-metrics-tab="true"
        sts-data-mode="services"
        ds-data-mode="logs"
        job-data-mode="events"
        cj-data-mode="history"
        :mirror-resource-name="name"
        mirror-event-kind="Node"
        :mirror-event-namespaced="false"
        :node-status-rows="conditionRows"
        :node-resource="nodeResource"
        :node-resource-rows="nodeResourceRows"
        :metrics-node="node"
      />
    </div>

    <HostRemoteSsh ref="hostRemoteSshRef" />

    <K8sYamlDialog
      v-model="yamlVisible"
      title="查看 YAML"
      :yaml="yamlText"
      read-only
      width="900px"
      :editor-height="520"
    />

    <ElDialog v-model="labelVisible" title="标签管理" width="720px" @close="resetLabelForm">
      <div v-for="(item, index) in labelRows" :key="index" class="label-row">
        <ElInput v-model="item.key" placeholder="键" class="label-row__key" />
        <ElInput v-model="item.value" placeholder="值" class="label-row__val" />
        <ElButton text type="primary" @click="labelRows.splice(index, 1)">删除</ElButton>
      </div>
      <ElButton text type="primary" class="mt-2" @click="labelRows.push({ key: '', value: '' })"
        >+ 添加</ElButton
      >
      <template #footer>
        <ElButton @click="labelVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="labelSubmitting" @click="submitLabels">确认</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft } from '@element-plus/icons-vue'
  import { ElInput, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { computed, inject, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import YAML from 'js-yaml'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ClusterDetailWorkloads from '../workloads.vue'
  import { clusterDetailContextKey } from '../context'
  import {
    fetchK8sNode,
    patchK8sNode,
    deleteK8sNode,
    type K8sNode
  } from '@/api/kubernetes/node'
  import { kubeProxyAxios } from '@/api/kubeProxy'
  import HostRemoteSsh from '@/views/safeguard/host/modules/host-remote-ssh.vue'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import {
    formatContainerRuntime,
    formatKubeletVersion,
    formatNodeCreationTime,
    formatNodeInternalIp,
    formatNodeStatusText,
    nodeStatusTagType
  } from '@/utils/kubernetes/nodeDisplay'

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const name = computed(() => String(route.query.name ?? ''))
  const clusterDetailCtx = inject(clusterDetailContextKey, undefined)
  const clusterAlias = computed(() => clusterDetailCtx?.value?.aliasName || cluster.value)

  const loading = ref(true)
  const node = ref<K8sNode | null>(null)
  const statusText = computed(() => (node.value ? formatNodeStatusText(node.value) : '未知'))
  const statusTagType = computed(() => nodeStatusTagType(statusText.value))
  const runningStatusText = computed(() => {
    if (!node.value?.status?.conditions?.length) return 'Unknown'
    const ready = node.value.status.conditions.find((c) => c.type === 'Ready')
    if (!ready) return 'Unknown'
    return ready.status === 'True' ? 'Running' : 'NotReady'
  })
  const podCidrsText = computed(() => {
    const values = node.value?.spec?.podCIDRs?.filter(Boolean) ?? []
    if (values.length) return values.join(', ')
    return node.value?.spec?.podCIDR || '-'
  })
  const kernelVersionText = computed(() => node.value?.status?.nodeInfo?.kernelVersion || '-')
  const nodeRole = computed(() => {
    const labels = node.value?.metadata?.labels ?? {}
    if ('node-role.kubernetes.io/control-plane' in labels || 'node-role.kubernetes.io/master' in labels)
      return '管控'
    return '工作节点'
  })
  const nodeTypeTagText = computed(() => (nodeRole.value === '管控' ? '管控节点' : '工作节点'))
  const nodeTypeTagType = computed(() => (nodeRole.value === '管控' ? 'danger' : 'success'))
  const showAllLabels = ref(false)
  const showAllAnnotations = ref(false)
  const labelEntries = computed(() =>
    Object.entries((node.value?.metadata?.labels ?? {}) as Record<string, string>).map(
      ([key, value]) => ({ key, value })
    )
  )
  const annotationEntries = computed(() =>
    Object.entries((node.value?.metadata?.annotations ?? {}) as Record<string, string>).map(
      ([key, value]) => ({ key, value })
    )
  )
  const hasMoreLabels = computed(() => labelEntries.value.length > 3)
  const hasMoreAnnotations = computed(() => annotationEntries.value.length > 3)
  const visibleLabelEntries = computed(() =>
    showAllLabels.value || !hasMoreLabels.value ? labelEntries.value : labelEntries.value.slice(0, 2)
  )
  const visibleAnnotationEntries = computed(() =>
    showAllAnnotations.value || !hasMoreAnnotations.value
      ? annotationEntries.value
      : annotationEntries.value.slice(0, 2)
  )

  const yamlVisible = ref(false)
  const yamlText = ref('')
  const labelVisible = ref(false)
  const labelRows = ref<{ key: string; value: string }[]>([])
  const labelSubmitting = ref(false)
  const allocatedResourceMap = ref<Record<string, { req: number; lim: number; total: number }>>({})

  const conditionRows = computed(() => {
    const rows = (node.value?.status?.conditions ?? []) as Array<{
      type?: string
      status?: string
      lastHeartbeatTime?: string
      lastTransitionTime?: string
      reason?: string
      message?: string
    }>
    return rows.map((r) => ({
      type: r.type || '-',
      status: r.status || '-',
      lastHeartbeatTime: formatDateTime(r.lastHeartbeatTime),
      lastTransitionTime: formatDateTime(r.lastTransitionTime),
      reason: r.reason || '-',
      message: r.message || '-'
    }))
  })

  function formatDateTime(ts?: string): string {
    if (!ts) return '-'
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ts
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  function parseCpuToMillicores(raw: string): number {
    if (!raw) return 0
    if (raw.endsWith('n')) return Math.round(parseFloat(raw) / 1000000)
    if (raw.endsWith('u')) return Math.round(parseFloat(raw) / 1000)
    if (raw.endsWith('m')) return Math.round(parseFloat(raw))
    const n = Number(raw)
    return Number.isFinite(n) ? Math.round(n * 1000) : 0
  }

  function parseMemoryToBytes(raw: string): number {
    if (!raw) return 0
    const m = String(raw).match(/^([\d.]+)([a-zA-Z]+)?$/)
    if (!m) return 0
    const n = parseFloat(m[1] || '0')
    const u = (m[2] || '').toLowerCase()
    const map: Record<string, number> = {
      ki: 1024,
      mi: 1024 ** 2,
      gi: 1024 ** 3,
      ti: 1024 ** 4,
      pi: 1024 ** 5,
      k: 1000,
      m: 1000 ** 2,
      g: 1000 ** 3,
      t: 1000 ** 4
    }
    return Math.round(n * (map[u] || 1))
  }

  function formatMillicores(v: number): string {
    if (!v) return '0m'
    return v >= 1000 ? `${(v / 1000).toFixed(2)} Core` : `${v}m`
  }

  function formatBytes(v: number): string {
    if (!v) return '0 B'
    if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} Gi`
    if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(2)} Mi`
    if (v >= 1024) return `${(v / 1024).toFixed(2)} Ki`
    return `${v} B`
  }

  const cpuAllocatableMillicores = computed(() =>
    parseCpuToMillicores(String(node.value?.status?.allocatable?.cpu ?? '0'))
  )
  const memoryAllocatableBytes = computed(() =>
    parseMemoryToBytes(String(node.value?.status?.allocatable?.memory ?? '0'))
  )
  const nodeResource = computed(() => ({
    cpuPercent: 0,
    memoryPercent: 0,
    cpuRequested: '0',
    cpuTotal: formatMillicores(cpuAllocatableMillicores.value),
    memoryRequested: '0',
    memoryTotal: formatBytes(memoryAllocatableBytes.value)
  }))
  const nodeResourceRows = computed(() => {
    const map = allocatedResourceMap.value
    return [
      { key: 'cpu', name: 'cpu', formatter: formatMillicores },
      { key: 'memory', name: 'memory', formatter: formatBytes },
      { key: 'ephemeral-storage', name: 'ephemeral-storage', formatter: formatBytes },
      { key: 'hugepages-1Gi', name: 'hugepages-1Gi', formatter: formatBytes },
      { key: 'hugepages-2Mi', name: 'hugepages-2Mi', formatter: formatBytes }
    ].map((item) => {
      const row = map[item.key] ?? { req: 0, lim: 0, total: 0 }
      const reqPct = row.total > 0 ? Number(((row.req / row.total) * 100).toFixed(0)) : 0
      const limPct = row.total > 0 ? Number(((row.lim / row.total) * 100).toFixed(0)) : 0
      return {
        resource: item.name,
        requestText: `${item.formatter(row.req)} (${reqPct}%)`,
        limitText: `${item.formatter(row.lim)} (${limPct}%)`,
        requestPercent: reqPct,
        limitPercent: limPct
      }
    })
  })
  async function loadAllocatedResources() {
    if (!node.value?.metadata?.name) return
    const clusterName = cluster.value
    const nodeName = node.value.metadata.name
    try {
      const { data } = await kubeProxyAxios.get<{ items?: any[] }>(
        `/pixiu/proxy/${encodeURIComponent(clusterName)}/api/v1/pods`,
        { params: { fieldSelector: `spec.nodeName=${nodeName}`, limit: 1000 } }
      )
      const pods = data.items ?? []
      const summary: Record<string, { req: number; lim: number; total: number }> = {}
      const allocatable = node.value.status?.allocatable ?? {}
      const resourceKeys = ['cpu', 'memory', 'ephemeral-storage', 'hugepages-1Gi', 'hugepages-2Mi']
      for (const r of resourceKeys) {
        const raw = String((allocatable as Record<string, string | undefined>)[r] ?? '0')
        const total = r === 'cpu' ? parseCpuToMillicores(raw) : parseMemoryToBytes(raw)
        summary[r] = { req: 0, lim: 0, total }
      }
      for (const pod of pods) {
        const containers = pod?.spec?.containers ?? []
        for (const container of containers) {
          const requests = container?.resources?.requests ?? {}
          const limits = container?.resources?.limits ?? {}
          for (const r of resourceKeys) {
            const reqRaw = String((requests as Record<string, string | undefined>)[r] ?? '')
            const limRaw = String((limits as Record<string, string | undefined>)[r] ?? '')
            if (reqRaw) {
              summary[r].req += r === 'cpu' ? parseCpuToMillicores(reqRaw) : parseMemoryToBytes(reqRaw)
            }
            if (limRaw) {
              summary[r].lim += r === 'cpu' ? parseCpuToMillicores(limRaw) : parseMemoryToBytes(limRaw)
            }
          }
        }
      }
      allocatedResourceMap.value = summary
    } catch {
      allocatedResourceMap.value = {}
    }
  }

  async function loadNode() {
    loading.value = true
    try {
      node.value = await fetchK8sNode(cluster.value, name.value)
      yamlText.value = YAML.dump(node.value)
    } catch (e: any) {
      ElMessage.error(e.message || '加载节点失败')
    } finally {
      loading.value = false
      showAllLabels.value = false
      showAllAnnotations.value = false
    }
  }

  function resetLabelForm() {
    labelRows.value = []
  }
  function openLabelDialog() {
    const labels = node.value?.metadata?.labels ?? {}
    labelRows.value = Object.keys(labels).map((k) => ({ key: k, value: String(labels[k]) }))
    if (!labelRows.value.length) labelRows.value.push({ key: '', value: '' })
    labelVisible.value = true
  }
  async function submitLabels() {
    if (!node.value) return
    labelSubmitting.value = true
    try {
      const newLabels: Record<string, string | null> = {}
      for (const item of labelRows.value) {
        if (item.key.trim()) newLabels[item.key.trim()] = item.value
      }
      const oldLabels = node.value.metadata.labels ?? {}
      for (const key of Object.keys(oldLabels)) {
        if (!(key in newLabels)) newLabels[key] = null
      }
      await patchK8sNode(cluster.value, node.value.metadata.name, { metadata: { labels: newLabels } })
      ElMessage.success('标签更新成功')
      labelVisible.value = false
      await loadNode()
    } catch (e: any) {
      ElMessage.error(e.message || '更新失败')
    } finally {
      labelSubmitting.value = false
    }
  }

  async function toggleSchedule() {
    if (!node.value) return
    try {
      await patchK8sNode(cluster.value, node.value.metadata.name, {
        spec: { unschedulable: !node.value.spec?.unschedulable }
      })
      ElMessage.success('调度状态已更新')
      await loadNode()
    } catch (e: any) {
      ElMessage.error(e.message || '操作失败')
    }
  }

  async function deleteNodeConfirm() {
    if (!node.value) return
    try {
      await ElMessageBox.confirm(`确定删除节点 "${node.value.metadata.name}" 吗？`, '删除节点', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sNode(cluster.value, node.value.metadata.name)
      ElMessage.success('删除成功')
      goBack()
    } catch {
      // cancel
    }
  }

  function onMoreClick(item: ButtonMoreItem) {
    if (item.key === 'delete') void deleteNodeConfirm()
    if (item.key === 'labels') openLabelDialog()
    if (item.key === 'schedule') void toggleSchedule()
  }

  function goBack() {
    router.push({ path: '/container/nodes', query: { cluster: cluster.value } })
  }

  const hostRemoteSshRef = ref<InstanceType<typeof HostRemoteSsh> | null>(null)

  /** 与主机管理「远程登陆」一致：确认框 + WS 仅 host，服务端按 IP 查 nodes 表 */
  function openRemoteLoginSameAsHost() {
    if (!node.value) return
    const ip = formatNodeInternalIp(node.value).trim()
    if (!ip || ip === '-') {
      ElMessage.warning('该节点暂无 IP，无法远程登录')
      return
    }
    hostRemoteSshRef.value?.openByIp(ip)
  }

  onMounted(async () => {
    await loadNode()
    await loadAllocatedResources()
  })
</script>

<style scoped>
  .nd {
    display: flex;
    flex-direction: column;
    gap: 15px;
    min-height: 100%;
  }
  .nd-card {
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter) !important;
  }
  .nd-card :deep(.el-card__body) {
    padding: 0;
  }
  .nd-card--overview :deep(.el-card__body) {
    padding-top: 15px;
  }
  .nd-hd {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 14px;
    height: 46px;
    min-width: 0;
  }
  .nd-vdv {
    margin: 0 8px;
    height: 18px;
    flex-shrink: 0;
  }
  .nd-vdv--cluster {
    margin: 0 15px;
  }
  .nd-title {
    display: inline-flex;
    align-items: center;
    gap: 15px;
    margin-left: 4px;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
  .nd-title__value {
    color: var(--el-color-primary);
  }
  .nd-title-status {
    margin-left: 20px;
  }
  .nd-cluster-wrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .nd-cluster-label {
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
  .nd-cluster-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }
  .nd-hd-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .nd-section-title {
    padding: 4px 14px 2px 45px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
  .nd-info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: 6px 10px 10px 40px;
    column-gap: 12px;
    row-gap: 2px;
  }
  .nd-info-cell {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 10px;
    min-width: 0;
  }
  .nd-k {
    width: 78px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.7;
  }
  .nd-v {
    flex: 1;
    font-size: 13px;
    color: var(--el-text-color-primary);
    line-height: 1.7;
    word-break: break-all;
    min-width: 0;
  }
  .nd-v--with-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .nd-tag-group {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    min-height: 24px;
    align-items: center;
  }
  .nd-mono-tag {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
  }
  .nd-more-btn {
    height: 24px;
    padding: 0 2px;
    font-size: 12px;
  }
  .nd-empty {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
  .label-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .label-row__key {
    flex: 1;
    max-width: 300px;
  }
  .label-row__val {
    flex: 1;
    max-width: 300px;
  }
  .mt-2 {
    margin-top: 8px;
  }
  .nd-workloads-copy {
    margin-top: -8px;
  }
</style>
