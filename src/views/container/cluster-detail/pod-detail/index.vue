<template>
  <div class="dd">
    <!-- Overview card -->
    <ElCard class="dd-card dd-card--overview" v-loading="loading">
      <div class="dd-hd">
        <ElButton :icon="ArrowLeft" text @click="goBack">返回</ElButton>
        <el-divider direction="vertical" class="dd-vdv dd-vdv--cluster" />
        <span class="dd-title">
          <span class="dd-title__kind">资源类型:</span>
          <span class="dd-title__value">Pod</span>
        </span>
        <ElTag :type="phaseTagType" effect="light" class="dd-title-status">
          {{ pod?.status?.phase || '—' }}
        </ElTag>
        <el-divider direction="vertical" class="dd-vdv" />
        <div class="dd-cluster-wrap">
          <span class="dd-cluster-label">集群:</span>
          <span class="dd-cluster-value">{{ clusterAlias }}</span>
        </div>
        <div class="dd-hd-actions">
          <ElButton v-ripple @click="openLogin">登录</ElButton>
          <ElButton v-ripple @click="openYamlEditor">YAML</ElButton>
          <ArtButtonMore
            :list="[{ key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }]"
            @click="onMoreClick"
          />
        </div>
      </div>

      <div class="dd-section-title">基本信息</div>

      <template v-if="!loading && pod">
        <div class="dd-info-grid">
          <div class="dd-info-cell">
            <span class="dd-k">名称</span>
            <span class="dd-v">{{ podName }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">创建时间</span>
            <span class="dd-v">{{ formatTime(pod.metadata?.creationTimestamp) }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">命名空间</span>
            <span class="dd-v">
              {{ namespace }}
              <el-tag v-if="isSystemNamespace" size="small" type="info" effect="light" style="margin-left:6px">系统</el-tag>
            </span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">所在节点</span>
            <span class="dd-v">{{ pod.spec?.nodeName || '—' }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">Pod IP</span>
            <span class="dd-v">{{ pod.status?.podIP || '—' }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">宿主机 IP</span>
            <span class="dd-v">{{ pod.status?.hostIP || '—' }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">Ready</span>
            <span class="dd-v">{{ readyCount }} / {{ totalCount }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">重启次数</span>
            <span class="dd-v">{{ restartCount }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">注释</span>
            <div class="dd-tag-group">
              <template v-if="visibleAnnotationEntries.length">
                <el-tag
                  v-for="item in visibleAnnotationEntries"
                  :key="item.key"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="mono-tag"
                >{{ item.key }}:{{ item.value }}</el-tag>
                <el-button
                  v-if="hasMoreAnnotations"
                  link
                  type="primary"
                  class="dd-more-btn"
                  @click="showAllAnnotations = !showAllAnnotations"
                >{{ showAllAnnotations ? '收起' : '更多' }}</el-button>
              </template>
              <span v-else class="dd-empty">—</span>
            </div>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">标签</span>
            <div class="dd-tag-group">
              <template v-if="visibleLabelEntries.length">
                <el-tag
                  v-for="item in visibleLabelEntries"
                  :key="item.key"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="mono-tag"
                >{{ item.key }}:{{ item.value }}</el-tag>
                <el-button
                  v-if="hasMoreLabels"
                  link
                  type="primary"
                  class="dd-more-btn"
                  @click="showAllLabels = !showAllLabels"
                >{{ showAllLabels ? '收起' : '更多' }}</el-button>
              </template>
              <span v-else class="dd-empty">—</span>
            </div>
          </div>
        </div>
      </template>
    </ElCard>

    <!-- Tabs card -->
    <ElCard v-if="pod && !loading" class="dd-card dd-card--tabs">
      <el-tabs v-model="activeTab" class="dd-tabs">

        <!-- 容器管理 -->
        <el-tab-pane label="容器管理" name="containers">
          <div v-for="container in containers" :key="container.name" class="ct-card">
            <div class="ct-card__head">
              <span class="ct-name">{{ container.name }}</span>
              <el-tag size="small" type="info" effect="plain">容器</el-tag>
              <el-tag
                v-if="containerReadyMap[container.name]"
                size="small"
                type="success"
                effect="plain"
                style="margin-left:4px"
              >Ready</el-tag>
            </div>
            <div class="ct-body">
              <div class="ct-row">
                <span class="ct-k">镜像</span>
                <span class="ct-v mono">{{ container.image }}</span>
              </div>
              <template v-if="container.resources">
                <div class="ct-divider" />
                <div class="ct-row ct-row--top">
                  <span class="ct-k">资源配额</span>
                  <div class="ct-v">
                    <el-table :data="containerResources(container)" size="small" class="res-table">
                      <el-table-column prop="type" width="80" />
                      <el-table-column label="CPU" prop="cpu" />
                      <el-table-column label="内存" prop="memory" />
                    </el-table>
                  </div>
                </div>
              </template>
              <template v-if="container.env?.length">
                <div class="ct-divider" />
                <div class="ct-row ct-row--top">
                  <span class="ct-k">环境变量</span>
                  <div class="ct-v">
                    <div v-for="e in container.env" :key="e.name" class="env-row">
                      <span class="env-k">{{ e.name }}</span>
                      <span class="env-eq">=</span>
                      <span class="mono env-v">{{ e.value ?? (e.valueFrom ? '[来自引用]' : '') }}</span>
                    </div>
                  </div>
                </div>
              </template>
              <template v-if="container.volumeMounts?.length">
                <div class="ct-divider" />
                <div class="ct-row ct-row--top">
                  <span class="ct-k">挂载卷</span>
                  <div class="ct-v">
                    <div v-for="m in container.volumeMounts" :key="m.name" class="mount-row">
                      <span class="mono mount-name">{{ m.name }}</span>
                      <span class="mount-arrow">→</span>
                      <span class="mount-path">{{ m.mountPath }}</span>
                      <el-tag v-if="m.readOnly" size="small" type="info">只读</el-tag>
                    </div>
                  </div>
                </div>
              </template>
              <template v-if="container.livenessProbe || container.readinessProbe">
                <div class="ct-divider" />
                <div class="ct-row ct-row--top">
                  <span class="ct-k">健康检查</span>
                  <div class="ct-v">
                    <div v-if="container.livenessProbe" class="probe-row">
                      <el-tag size="small" type="success">存活探针</el-tag>
                      <span class="mono probe-desc">{{ probeDesc(container.livenessProbe) }}</span>
                    </div>
                    <div v-if="container.readinessProbe" class="probe-row">
                      <el-tag size="small" type="warning">就绪探针</el-tag>
                      <span class="mono probe-desc">{{ probeDesc(container.readinessProbe) }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div v-if="!containers.length" class="dd-empty-tip">暂无容器信息</div>
        </el-tab-pane>

        <!-- 事件 -->
        <el-tab-pane label="事件" name="events">
          <div class="dd-toolbar">
            <el-button size="small" class="dd-refresh-btn" :loading="eventsLoading" @click="loadEvents">刷新</el-button>
          </div>
          <el-table :data="events" v-loading="eventsLoading" size="small" stripe class="dd-table">
            <el-table-column label="类型" width="90">
              <template #default="{ row }">
                <el-tag :type="row.type === 'Warning' ? 'warning' : 'success'" size="small" effect="light">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="原因" width="150" prop="reason" />
            <el-table-column label="消息" min-width="300" prop="message" show-overflow-tooltip />
            <el-table-column label="次数" width="70" prop="count" />
            <el-table-column label="最近发生" width="160">
              <template #default="{ row }">{{ formatTime(row.lastTimestamp || row.eventTime) }}</template>
            </el-table-column>
          </el-table>
          <div v-if="!eventsLoading && events.length === 0" class="dd-empty-tip">暂无相关事件</div>
        </el-tab-pane>

        <!-- 日志 -->
        <el-tab-pane label="日志" name="logs">
          <div class="dd-log-bar">
            <el-select v-model="logContainer" placeholder="选择容器" size="small" style="width:200px">
              <el-option v-for="c in containerNames" :key="c" :label="c" :value="c" />
            </el-select>
            <el-select v-model="logTailLines" size="small" style="width:130px">
              <el-option label="最近 100 行" :value="100" />
              <el-option label="最近 200 行" :value="200" />
              <el-option label="最近 500 行" :value="500" />
              <el-option label="最近 1000 行" :value="1000" />
            </el-select>
            <el-button size="small" type="primary" :loading="logLoading" :disabled="!logContainer" @click="fetchLogs">获取日志</el-button>
          </div>
          <div class="dd-log-view" ref="logViewerRef">
            <div v-if="logLoading" class="dd-log-state">
              <el-icon class="is-loading"><Loading /></el-icon> 加载日志…
            </div>
            <pre v-else-if="logContent" class="dd-log-txt">{{ logContent }}</pre>
            <div v-else class="dd-log-state">请选择容器后获取日志</div>
          </div>
        </el-tab-pane>

      </el-tabs>
    </ElCard>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="查看 YAML"
      :yaml="yamlContent"
      read-only
      show-copy
      width="900px"
      :editor-height="520"
    />

    <!-- Remote webshell -->
    <PodRemoteWebshell ref="podWebshellRef" />
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft, Loading } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import PodRemoteWebshell from '../components/pod-remote-webshell.vue'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { clusterDetailContextKey } from '../context'
  import { fetchK8sPod, deleteK8sPod } from '@/api/kubernetes/pod'
  import { fetchKubeRawEventList } from '@/api/kubernetes/events'
  import { kubeProxyAxios } from '@/api/kubeProxy'
  import YAML from 'js-yaml'

  defineOptions({ name: 'PodDetail' })

  const route = useRoute()
  const router = useRouter()

  const cluster = computed(() => String(route.query.cluster ?? ''))
  const namespace = computed(() => String(route.query.namespace ?? ''))
  const podName = computed(() => String(route.query.pod ?? ''))
  const isSystemNamespace = computed(() => namespace.value === 'default' || namespace.value.startsWith('kube-'))

  const clusterCtx = inject(clusterDetailContextKey, undefined)
  const clusterAlias = computed(() => clusterCtx?.value?.aliasName || cluster.value)

  // ── Data ──
  const loading = ref(true)
  const pod = ref<any>(null)
  const activeTab = ref('containers')

  // ── Computed from pod ──
  const phaseTagType = computed(() => {
    const phase = pod.value?.status?.phase
    if (phase === 'Running') return 'success'
    if (phase === 'Pending') return 'warning'
    if (phase === 'Failed') return 'danger'
    return 'info'
  })

  const containers = computed<any[]>(() => pod.value?.spec?.containers ?? [])
  const containerNames = computed<string[]>(() => containers.value.map((c: any) => c.name).filter(Boolean))

  const containerReadyMap = computed<Record<string, boolean>>(() => {
    const statuses: any[] = pod.value?.status?.containerStatuses ?? []
    return Object.fromEntries(statuses.map((s: any) => [s.name, !!s.ready]))
  })

  const readyCount = computed(() => {
    const statuses: any[] = pod.value?.status?.containerStatuses ?? []
    return statuses.filter((s: any) => s.ready).length
  })
  const totalCount = computed(() => containers.value.length)
  const restartCount = computed(() => {
    const statuses: any[] = pod.value?.status?.containerStatuses ?? []
    return statuses.reduce((sum: number, s: any) => sum + (s.restartCount ?? 0), 0)
  })

  const showAllLabels = ref(false)
  const showAllAnnotations = ref(false)
  const labelEntries = computed(() =>
    Object.entries((pod.value?.metadata?.labels ?? {}) as Record<string, string>).map(([key, value]) => ({ key, value }))
  )
  const annotationEntries = computed(() =>
    Object.entries((pod.value?.metadata?.annotations ?? {}) as Record<string, string>).map(([key, value]) => ({ key, value }))
  )
  const hasMoreLabels = computed(() => labelEntries.value.length > 3)
  const hasMoreAnnotations = computed(() => annotationEntries.value.length > 3)
  const visibleLabelEntries = computed(() =>
    showAllLabels.value || !hasMoreLabels.value ? labelEntries.value : labelEntries.value.slice(0, 2)
  )
  const visibleAnnotationEntries = computed(() =>
    showAllAnnotations.value || !hasMoreAnnotations.value ? annotationEntries.value : annotationEntries.value.slice(0, 2)
  )

  // ── Events tab ──
  const events = ref<any[]>([])
  const eventsLoading = ref(false)
  async function loadEvents() {
    eventsLoading.value = true
    try {
      const { items } = await fetchKubeRawEventList(cluster.value, {
        namespace: namespace.value,
        name: podName.value,
        kind: 'Pod',
        namespaced: true,
        page: 1,
        limit: 100
      })
      events.value = items as any[]
    } catch {
      events.value = []
    } finally {
      eventsLoading.value = false
    }
  }

  // ── Logs tab ──
  const logContainer = ref('')
  const logTailLines = ref(100)
  const logLoading = ref(false)
  const logContent = ref('')
  const logViewerRef = ref<HTMLElement>()

  async function fetchLogs() {
    if (!logContainer.value) return
    logLoading.value = true
    try {
      const url = `/pixiu/proxy/${encodeURIComponent(cluster.value)}/api/v1/namespaces/${encodeURIComponent(namespace.value)}/pods/${encodeURIComponent(podName.value)}/log`
      const { data } = await kubeProxyAxios.get<string>(url, {
        params: { container: logContainer.value, tailLines: logTailLines.value },
        responseType: 'text'
      })
      logContent.value = data
      nextTick(() => {
        if (logViewerRef.value) logViewerRef.value.scrollTop = logViewerRef.value.scrollHeight
      })
    } catch (e: any) {
      logContent.value = `获取日志失败: ${e.message}`
    } finally {
      logLoading.value = false
    }
  }

  // ── Container helpers ──
  function containerResources(c: any) {
    return [
      { type: 'Request', cpu: c.resources?.requests?.cpu || '无限制', memory: c.resources?.requests?.memory || '无限制' },
      { type: 'Limit', cpu: c.resources?.limits?.cpu || '无限制', memory: c.resources?.limits?.memory || '无限制' }
    ]
  }

  function probeDesc(probe: any): string {
    if (probe.httpGet) return `HTTP GET ${probe.httpGet.path} :${probe.httpGet.port}`
    if (probe.tcpSocket) return `TCP :${probe.tcpSocket.port}`
    if (probe.exec) return `Exec: ${(probe.exec.command ?? []).join(' ')}`
    return JSON.stringify(probe)
  }

  // ── Time ──
  function formatTime(ts?: string): string {
    if (!ts) return '—'
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // ── YAML ──
  const yamlVisible = ref(false)
  const yamlContent = ref('')
  async function openYamlEditor() {
    try {
      const data = await fetchK8sPod(cluster.value, namespace.value, podName.value)
      yamlContent.value = YAML.dump(data)
      yamlVisible.value = true
    } catch {
      ElMessage.error('获取 YAML 失败')
    }
  }
  // ── Login ──
  const podWebshellRef = ref<InstanceType<typeof PodRemoteWebshell> | null>(null)
  function openLogin() {
    const names = containerNames.value
    if (!names.length) { ElMessage.warning('容器信息不完整'); return }
    void podWebshellRef.value?.open({
      cluster: cluster.value,
      namespace: namespace.value,
      pod: podName.value,
      container: names[0]
    })
  }

  // ── Delete ──
  async function handleDelete() {
    try {
      await ElMessageBox.confirm(`确认删除 Pod "${podName.value}"? 此操作不可撤销。`, '删除', {
        type: 'warning',
        confirmButtonText: '确认删除',
        confirmButtonClass: 'el-button--danger'
      })
      await deleteK8sPod(cluster.value, namespace.value, podName.value)
      ElMessage.success('已删除')
      goBack()
    } catch {
      // cancel
    }
  }

  function onMoreClick(item: ButtonMoreItem) {
    if (item.key === 'delete') void handleDelete()
  }

  // ── Navigation ──
  function goBack() {
    router.back()
  }

  // ── Tab lazy loading ──
  watch(activeTab, (tab) => {
    if (tab === 'events' && events.value.length === 0) void loadEvents()
    if (tab === 'logs' && !logContainer.value) logContainer.value = containerNames.value[0] ?? ''
  })

  watch(pod, () => {
    showAllLabels.value = false
    showAllAnnotations.value = false
    logContainer.value = containerNames.value[0] ?? ''
  })

  // ── Load ──
  onMounted(async () => {
    if (!cluster.value || !namespace.value || !podName.value) {
      ElMessage.error('参数不完整')
      return
    }
    loading.value = true
    try {
      pod.value = await fetchK8sPod(cluster.value, namespace.value, podName.value)
    } catch {
      ElMessage.error('获取 Pod 详情失败')
    } finally {
      loading.value = false
    }
  })
</script>

<style scoped>
  /* ── Root ── */
  .dd {
    display: flex;
    flex-direction: column;
    gap: 15px;
    min-height: 100%;
  }

  /* ── Card base ── */
  .dd-card {
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter) !important;
  }
  .dd-card :deep(.el-card__body) {
    padding: 0;
  }
  .dd-card--overview :deep(.el-card__body) {
    padding-top: 15px;
  }

  /* ── Header bar ── */
  .dd-hd {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 14px;
    height: 46px;
    flex-wrap: nowrap;
    min-width: 0;
  }
  .dd-vdv {
    margin: 0 8px;
    height: 18px;
    flex-shrink: 0;
  }
  .dd-vdv--cluster {
    margin: 0 15px;
  }
  .dd-title {
    display: inline-flex;
    align-items: center;
    gap: 15px;
    margin-left: 4px;
    font-size: var(--el-menu-item-font-size, 14px);
    font-weight: var(--el-menu-item-font-weight, 400);
    color: #c7c7d1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
    flex-shrink: 1;
  }
  .dd-title__kind {
    font-size: var(--el-menu-item-font-size, 14px);
    font-weight: var(--el-menu-item-font-weight, 400);
    color: #c7c7d1;
  }
  .dd-title__value {
    font-size: 14px;
    font-weight: var(--el-menu-item-font-weight, 400);
    color: var(--el-color-primary);
  }
  .dd-title-status {
    margin-left: 20px;
  }
  .dd-cluster-wrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    min-width: 0;
  }
  .dd-cluster-label {
    font-size: var(--el-menu-item-font-size, 14px);
    color: #c7c7d1;
    flex-shrink: 0;
  }
  .dd-cluster-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }
  .dd-hd-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
    padding-left: 16px;
  }
  .dd-section-title {
    padding: 4px 14px 2px 45px;
    font-size: 14px;
    font-weight: 500;
    color: #c7c7d1;
  }

  /* ── Info grid ── */
  .dd-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: 0;
    padding: 4px 0 8px;
    column-gap: 20px;
    row-gap: 2px;
  }
  .dd-info-cell {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 16px 6px 45px;
  }
  .dd-k {
    width: 96px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.8;
  }
  .dd-v {
    flex: 1;
    font-size: 13px;
    color: var(--el-text-color-primary);
    word-break: break-all;
    line-height: 1.7;
  }
  .dd-tag-group {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    min-height: 24px;
    align-items: center;
  }
  .dd-more-btn {
    height: 24px;
    padding: 0 2px;
    font-size: 12px;
  }
  .dd-empty {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
  .mono-tag {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
  }

  /* ── Tabs card ── */
  .dd-card--tabs :deep(.el-card__body) {
    padding: 0 14px;
  }
  .dd-tabs :deep(.el-tabs__header) {
    margin-bottom: 14px;
  }
  .dd-tabs :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: var(--el-border-color);
  }
  .dd-tabs :deep(.el-tabs__item) {
    height: 38px;
    line-height: 38px;
    font-size: 13px;
    font-weight: 500;
  }

  /* ── Common table ── */
  .dd-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }
  .dd-refresh-btn {
    border-radius: 6px;
    font-size: 12px;
    min-width: 52px;
  }
  .dd-table {
    border-radius: 6px;
    overflow: hidden;
  }
  .dd-table :deep(.el-table__header th.el-table__cell) {
    height: 38px;
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
    background-color: var(--el-fill-color-light);
  }
  .dd-table :deep(.el-table__body td.el-table__cell) {
    height: 38px;
    font-size: 12px;
  }
  .dd-empty-tip {
    text-align: center;
    padding: 36px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  /* ── Container card ── */
  .ct-card {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .ct-card__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 16px;
    background: var(--el-fill-color-lighter);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  .ct-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  .ct-body {
    padding: 0;
  }
  .ct-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 12px;
    padding: 8px 14px;
    align-items: center;
  }
  .ct-row--top {
    align-items: flex-start;
  }
  .ct-k {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    padding-top: 1px;
  }
  .ct-v {
    font-size: 13px;
    color: var(--el-text-color-primary);
    word-break: break-all;
  }
  .ct-divider {
    height: 1px;
    background: var(--el-border-color-extra-light);
    margin: 0 16px;
  }
  .res-table {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }
  .env-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 13px;
    padding: 2px 0;
  }
  .env-k { color: var(--el-color-primary); min-width: 140px; }
  .env-eq { color: var(--el-text-color-placeholder); }
  .env-v { color: var(--el-text-color-primary); word-break: break-all; }
  .mount-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    padding: 2px 0;
  }
  .mount-name { color: var(--el-color-primary); }
  .mount-arrow { color: var(--el-text-color-placeholder); font-size: 12px; }
  .mount-path { color: var(--el-text-color-secondary); }
  .probe-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    padding: 2px 0;
  }
  .probe-desc { color: var(--el-text-color-regular); }

  /* ── Logs ── */
  .dd-log-bar {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .dd-log-view {
    background: #13151a;
    border-radius: 8px;
    padding: 12px;
    min-height: 400px;
    max-height: 600px;
    overflow-y: auto;
    position: relative;
  }
  .dd-log-txt {
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 13px;
    line-height: 1.65;
    color: #d4d4d4;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
  }
  .dd-log-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: #6b7280;
    gap: 8px;
    font-size: 14px;
  }

  /* ── Misc ── */
  .mono {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
  }
</style>
