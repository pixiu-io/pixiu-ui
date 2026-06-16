<template>
  <div class="dd">
    <!-- ── Overview card ── -->
    <ElCard class="dd-card dd-card--overview" v-loading="loading">
      <!-- Header bar -->
      <div class="dd-hd">
        <ElButton :icon="ArrowLeft" text @click="goBack">返回</ElButton>
        <el-divider direction="vertical" class="dd-vdv dd-vdv--cluster" />
        <span class="dd-title"
          ><span class="dd-title__kind">负载类型:</span
          ><span class="dd-title__value">{{ workloadKind }}</span></span
        >
        <ElTag :type="isReady ? 'success' : 'warning'" effect="light" class="dd-title-status">
          {{ isReady ? '运行中' : '更新中' }}
        </ElTag>
        <el-divider direction="vertical" class="dd-vdv" />
        <div class="dd-cluster-wrap">
          <span class="dd-cluster-label">集群:</span>
          <span class="dd-cluster-value">{{ clusterDisplayName }}</span>
        </div>
        <div class="dd-hd-actions">
          <ElButton v-if="supportsScale" v-ripple @click="scaleVisible = true">扩缩容</ElButton>
          <ArtButtonMore
            :list="[
              { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }
            ]"
            @click="onMoreClick"
          />
        </div>
      </div>
      <div class="dd-section-title">基本信息</div>

      <template v-if="!loading && workload">
        <!-- Info grid -->
        <div class="dd-info-grid">
          <div class="dd-info-cell">
            <span class="dd-k">名称</span>
            <span class="dd-v">{{ workload?.metadata?.name }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">创建时间</span>
            <span class="dd-v">{{ formatTime(workload?.metadata?.creationTimestamp) }}</span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">命名空间</span>
            <span class="dd-v">
              {{ namespace }}
              <el-tag
                v-if="isSystemNamespace"
                size="small"
                type="info"
                effect="light"
                style="margin-left: 6px"
              >
                系统
              </el-tag>
            </span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">策略</span>
            <span class="dd-v">
              <el-tag size="small" effect="plain">{{ strategyType }}</el-tag>
            </span>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">选择器</span>
            <div class="dd-tag-group">
              <template v-if="selectorEntries.length">
                <el-tag
                  v-for="item in selectorEntries"
                  :key="item.key"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="mono-tag"
                >
                  {{ item.key }}:{{ item.value }}
                </el-tag>
              </template>
              <span v-else class="dd-empty">-</span>
            </div>
          </div>
          <div class="dd-info-cell">
            <span class="dd-k">滚动升级策略</span>
            <div v-if="rollingUpdateValues" class="dd-v dd-ru-lines">
              <div>超过期望的Pod数量:{{ rollingUpdateValues.maxSurge }}</div>
              <div>不可用Pod最大数量:{{ rollingUpdateValues.maxUnavailable }}</div>
            </div>
            <span v-else class="dd-v">-</span>
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
                >
                  {{ item.key }}:{{ item.value }}
                </el-tag>
                <el-button
                  v-if="hasMoreAnnotations"
                  link
                  type="primary"
                  class="dd-more-btn"
                  @click="showAllAnnotations = !showAllAnnotations"
                >
                  {{ showAllAnnotations ? '收起' : '更多' }}
                </el-button>
              </template>
              <span v-else class="dd-empty">-</span>
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
                >
                  {{ item.key }}:{{ item.value }}
                </el-tag>
                <el-button
                  v-if="hasMoreLabels"
                  link
                  type="primary"
                  class="dd-more-btn"
                  @click="showAllLabels = !showAllLabels"
                >
                  {{ showAllLabels ? '收起' : '更多' }}
                </el-button>
              </template>
              <span v-else class="dd-empty">-</span>
            </div>
          </div>
        </div>
      </template>
    </ElCard>

    <!-- ── Detail tabs card ── -->
    <ElCard v-if="false" class="dd-card dd-card--tabs">
      <el-tabs v-model="activeTab" class="dd-tabs">
        <!-- 容器组 -->
        <el-tab-pane name="pods">
          <template #label> 容器组 </template>
          <div class="dd-pods-toolbar">
            <div class="dd-pods-toolbar__left">
              <el-button
                size="small"
                class="dd-refresh-btn"
                :loading="podsLoading"
                @click="loadPods"
                >刷新</el-button
              >
            </div>
            <div class="dd-pods-toolbar__right">
              <el-input
                v-model="podSearchKeyword"
                clearable
                placeholder="请输入名称"
                class="dd-pods-toolbar__search"
              />
            </div>
          </div>
          <el-table
            :data="filteredPods"
            v-loading="podsLoading"
            size="small"
            stripe
            class="dd-table"
          >
            <el-table-column label="名称" min-width="200">
              <template #default="{ row }">
                <el-link type="primary" :underline="false" class="mono" @click="goToPodDetail(row)">{{ row.metadata?.name }}</el-link>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="podStatusType(formatPodDisplayStatus(row))" size="small" effect="light">{{
                  formatPodDisplayStatus(row)
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="Ready" width="90">
              <template #default="{ row }"
                >{{ podReadyCount(row) }} / {{ row.spec?.containers?.length ?? 0 }}</template
              >
            </el-table-column>
            <el-table-column label="重启次数" width="90">
              <template #default="{ row }">{{ podRestartCount(row) }}</template>
            </el-table-column>
            <el-table-column label="所在节点" min-width="140">
              <template #default="{ row }"
                ><span class="mono">{{ row.spec?.nodeName || '-' }}</span></template
              >
            </el-table-column>
            <el-table-column label="Pod IP" width="130">
              <template #default="{ row }"
                ><span class="mono">{{ row.status?.podIP || '-' }}</span></template
              >
            </el-table-column>
            <el-table-column label="创建时间" width="160">
              <template #default="{ row }">{{
                formatTime(row.metadata?.creationTimestamp)
              }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 访问方式 -->
        <el-tab-pane label="访问方式" name="services">
          <div class="dd-toolbar">
            <el-button
              size="small"
              class="dd-refresh-btn"
              :loading="servicesLoading"
              @click="loadServices"
              >刷新</el-button
            >
          </div>
          <el-table
            :data="matchedServices"
            v-loading="servicesLoading"
            size="small"
            stripe
            class="dd-table"
          >
            <el-table-column label="名称" min-width="160">
              <template #default="{ row }"
                ><span class="mono">{{ row.metadata?.name }}</span></template
              >
            </el-table-column>
            <el-table-column label="类型" width="120">
              <template #default="{ row }"
                ><el-tag size="small" effect="plain">{{ row.spec?.type }}</el-tag></template
              >
            </el-table-column>
            <el-table-column label="Cluster IP" width="140">
              <template #default="{ row }"
                ><span class="mono">{{ row.spec?.clusterIP || '-' }}</span></template
              >
            </el-table-column>
            <el-table-column label="端口" min-width="200">
              <template #default="{ row }">
                <span v-for="p in row.spec?.ports ?? []" :key="p.port" class="port-pill">
                  {{ p.port }}:{{ p.targetPort }}/{{ p.protocol }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="160">
              <template #default="{ row }">{{
                formatTime(row.metadata?.creationTimestamp)
              }}</template>
            </el-table-column>
          </el-table>
          <div v-if="!servicesLoading && matchedServices.length === 0" class="dd-empty-tip"
            >暂无匹配的 Service</div
          >
        </el-tab-pane>

        <!-- 容器管理 -->
        <el-tab-pane label="容器管理" name="containers">
          <div v-for="container in containers" :key="container.name" class="ct-card">
            <div class="ct-card__head">
              <span class="ct-name">{{ container.name }}</span>
              <el-tag size="small" type="info" effect="plain">容器</el-tag>
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
                      <span class="mono env-v">{{
                        e.value ?? (e.valueFrom ? '[来自引用]' : '')
                      }}</span>
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
            <el-button
              size="small"
              class="dd-refresh-btn"
              :loading="eventsLoading"
              @click="loadEvents"
              >刷新</el-button
            >
          </div>
          <el-table :data="events" v-loading="eventsLoading" size="small" stripe class="dd-table">
            <el-table-column label="类型" width="90">
              <template #default="{ row }">
                <el-tag
                  :type="row.type === 'Warning' ? 'warning' : 'success'"
                  size="small"
                  effect="light"
                  >{{ row.type }}</el-tag
                >
              </template>
            </el-table-column>
            <el-table-column label="原因" width="150" prop="reason" />
            <el-table-column label="对象" width="200">
              <template #default="{ row }"
                >{{ row.involvedObject?.kind }}/{{ row.involvedObject?.name }}</template
              >
            </el-table-column>
            <el-table-column label="消息" min-width="300" prop="message" show-overflow-tooltip />
            <el-table-column label="次数" width="70" prop="count" />
            <el-table-column label="最近发生" width="160">
              <template #default="{ row }">{{
                formatTime(row.lastTimestamp || row.eventTime)
              }}</template>
            </el-table-column>
          </el-table>
          <div v-if="!eventsLoading && events.length === 0" class="dd-empty-tip">暂无相关事件</div>
        </el-tab-pane>

        <!-- 历史版本 -->
        <el-tab-pane label="历史版本" name="history">
          <div class="dd-toolbar">
            <el-button
              size="small"
              class="dd-refresh-btn"
              :loading="historyLoading"
              @click="loadHistory"
              >刷新</el-button
            >
          </div>
          <el-table
            :data="replicaSets"
            v-loading="historyLoading"
            size="small"
            stripe
            class="dd-table"
          >
            <el-table-column label="版本" width="200">
              <template #default="{ row }"
                ><span class="mono">{{ row.metadata?.name }}</span></template
              >
            </el-table-column>
            <el-table-column label="版本号" width="90">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{
                  row.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '-'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="期望/就绪" width="120">
              <template #default="{ row }"
                >{{ row.status?.readyReplicas ?? 0 }} / {{ row.spec?.replicas ?? 0 }}</template
              >
            </el-table-column>
            <el-table-column label="镜像" min-width="240" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="mono">{{
                  (row.spec?.template?.spec?.containers ?? []).map((c: any) => c.image).join(', ')
                }}</span>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="160">
              <template #default="{ row }">{{
                formatTime(row.metadata?.creationTimestamp)
              }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 日志 -->
        <el-tab-pane label="日志" name="logs">
          <div class="dd-log-bar">
            <el-select
              v-model="logPod"
              placeholder="选择 Pod"
              size="small"
              style="width: 220px"
              @change="onLogPodChange"
            >
              <el-option
                v-for="p in pods"
                :key="p.metadata?.name"
                :label="p.metadata?.name"
                :value="p.metadata?.name"
              />
            </el-select>
            <el-select
              v-model="logContainer"
              placeholder="选择容器"
              size="small"
              style="width: 160px"
              :disabled="!logPod"
            >
              <el-option v-for="c in logContainerOptions" :key="c" :label="c" :value="c" />
            </el-select>
            <el-select v-model="logTailLines" size="small" style="width: 120px">
              <el-option label="最近 100 行" :value="100" />
              <el-option label="最近 200 行" :value="200" />
              <el-option label="最近 500 行" :value="500" />
              <el-option label="最近 1000 行" :value="1000" />
            </el-select>
            <el-button
              size="small"
              type="primary"
              :loading="logLoading"
              :disabled="!logPod || !logContainer"
              @click="fetchLogs"
              >获取日志</el-button
            >
          </div>
          <div class="dd-log-view" ref="logViewerRef">
            <div v-if="logLoading" class="dd-log-state"
              ><el-icon class="is-loading"><Loading /></el-icon> 加载日志…</div
            >
            <pre v-else-if="logContent" class="dd-log-txt">{{ logContent }}</pre>
            <div v-else class="dd-log-state">请选择 Pod 和容器后获取日志</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </ElCard>

    <div class="dd-workloads-copy">
      <ClusterDetailWorkloads
        deploy-tab-label="容器组"
        deploy-data-mode="pod"
        :deploy-namespace="namespace"
        :deploy-label-selector="podSelector"
        show-workload-metrics-tab
        :metrics-namespace="namespace"
        :metrics-label-selector="podSelector"
        :show-deploy-create="false"
        sts-tab-label="访问方式"
        ds-tab-label="日志"
        job-tab-label="事件"
        cj-tab-label="版本记录"
        sts-data-mode="services"
        ds-data-mode="logs"
        job-data-mode="events"
        cj-data-mode="history"
        :mirror-namespace="namespace"
        :mirror-selector="podSelector"
        :mirror-resource-name="name"
        :mirror-event-kind="workloadKind"
        :mirror-containers="containers"
        :initial-tab="initialTab"
      />
    </div>

    <!-- Scale Dialog -->
    <el-dialog v-model="scaleVisible" title="扩缩容" width="380px">
      <div style="padding: 8px 0">
        <div style="font-size: 14px; margin-bottom: 12px; color: var(--el-text-color-regular)"
          >当前实例数：<strong>{{ desiredReplicas }}</strong></div
        >
        <el-input-number
          v-model="scaleTarget"
          :min="0"
          :max="100"
          size="default"
          controls-position="right"
          style="width: 100%"
        />
      </div>
      <template #footer>
        <el-button @click="scaleVisible = false">取消</el-button>
        <el-button type="primary" :loading="scaling" @click="handleScale">确认</el-button>
      </template>
    </el-dialog>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="编辑 YAML"
      :yaml="yamlContent"
      :read-only="false"
      footer-mode="edit"
      confirm-text="保存"
      width="900px"
      :editor-height="520"
      :submit-loading="yamlSaving"
      @save="onDeploymentDetailYamlSave"
    />
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft, Loading } from '@element-plus/icons-vue'
  import { ElMessageBox } from 'element-plus'
  import { useRouter, useRoute } from 'vue-router'
  import { inject, watch } from 'vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ClusterDetailWorkloads from '../workloads.vue'
  import { clusterDetailContextKey } from '../context'
  import { getCronJobApiVersion } from '@/utils/kubernetes/cronjob'
  import { buildClusterRouteQuery } from '@/utils/navigation/cluster-query'
  import { kubeProxyAxios } from '@/api/kubeProxy'
  import {
    fetchK8sDeployment,
    patchK8sDeployment,
    deleteK8sDeployment
  } from '@/api/kubernetes/deployment'
  import type { K8sDeployment } from '@/api/kubernetes/deployment'
  import {
    fetchK8sStatefulSet,
    patchK8sStatefulSet,
    deleteK8sStatefulSet
  } from '@/api/kubernetes/statefulset'
  import type { K8sStatefulSet } from '@/api/kubernetes/statefulset'
  import { fetchK8sDaemonSet, deleteK8sDaemonSet } from '@/api/kubernetes/daemonset'
  import type { K8sDaemonSet } from '@/api/kubernetes/daemonset'
  import { fetchK8sJob, deleteK8sJob } from '@/api/kubernetes/job'
  import type { K8sJob } from '@/api/kubernetes/job'
  import { fetchK8sCronJob, deleteK8sCronJob } from '@/api/kubernetes/cronjob'
  import type { K8sCronJob } from '@/api/kubernetes/cronjob'
  import { fetchK8sPodList } from '@/api/kubernetes/pod'
  import type { K8sPod } from '@/api/kubernetes/pod'
  import { formatPodDisplayStatus, podStatusTagType } from '@/utils/kubernetes/podDisplay'
  import { fetchK8sServiceList } from '@/api/kubernetes/service'
  import type { K8sService } from '@/api/kubernetes/service'
  import {
    fetchAggregatedEventList,
    fetchKubeRawEventList,
    getAggregatedEventKind
  } from '@/api/kubernetes/events'
  import { fetchK8sReplicaSetList } from '@/api/kubernetes/replicaset'
  import type { K8sReplicaSet } from '@/api/kubernetes/replicaset'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import YAML from 'js-yaml'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'

  const router = useRouter()
  const route = useRoute()

  const cluster = computed(() => String(route.query.cluster ?? ''))
  const namespace = computed(() => String(route.query.namespace ?? ''))
  const name = computed(() => String(route.query.name ?? ''))
  const workloadKind = computed(() => {
    const path = route.path
    if (path.includes('statefulset-detail')) return 'StatefulSet'
    if (path.includes('daemonset-detail')) return 'DaemonSet'
    if (path.includes('job-detail')) return 'Job'
    if (path.includes('cronjob-detail')) return 'CronJob'
    return 'Deployment'
  })
  const DETAIL_TAB_TO_KIND: Record<string, string> = {
    events: 'job',
    history: 'cj',
    logs: 'ds',
    services: 'sts',
    pods: 'deploy'
  }
  const initialTab = computed(() => {
    const tab = String(route.query.tab ?? '')
    return DETAIL_TAB_TO_KIND[tab] ?? tab
  })
  const isSystemNamespace = computed(() => namespace.value === 'default' || namespace.value.startsWith('kube-'))

  const clusterDetailCtx = inject(clusterDetailContextKey, undefined)
  const cronJobApiVersion = computed(() => getCronJobApiVersion(clusterDetailCtx?.value?.version))
  const clusterAlias = computed(() => clusterDetailCtx?.value?.aliasName || cluster.value)
  const clusterDisplayName = computed(() => {
    const name = cluster.value
    const alias = clusterDetailCtx?.value?.aliasName
    if (alias && alias !== name) return `${alias}(${name})`
    return name
  })

  // ── Core data ──
  const loading = ref(true)
  type WorkloadUnion = K8sDeployment | K8sStatefulSet | K8sDaemonSet | K8sJob | K8sCronJob
  const workload = ref<WorkloadUnion | null>(null)

  /** 详情页主 Tab（与 workloads 列表的 ?tab=deploy|sts|… 区分开） */
  const DETAIL_MAIN_TAB_NAMES = new Set(['pods', 'services', 'containers', 'events', 'history', 'logs'])
  const tabFromRoute = String(route.query.tab ?? '')
  const activeTab = ref(DETAIL_MAIN_TAB_NAMES.has(tabFromRoute) ? tabFromRoute : 'pods')

  watch(
    () => String(route.query.tab ?? ''),
    (t) => {
      if (DETAIL_MAIN_TAB_NAMES.has(t)) activeTab.value = t
    }
  )

  // ── Computed ──
  const readyReplicas = computed(
    () => (workload.value as K8sDeployment | K8sStatefulSet | undefined)?.status?.readyReplicas ?? 0
  )
  const desiredReplicas = computed(
    () => (workload.value as K8sDeployment | K8sStatefulSet | undefined)?.spec?.replicas ?? 0
  )
  const supportsScale = computed(
    () => workloadKind.value === 'Deployment' || workloadKind.value === 'StatefulSet'
  )
  const strategyType = computed(() => {
    if (workloadKind.value === 'Deployment') {
      return (workload.value as K8sDeployment | undefined)?.spec?.strategy?.type || 'RollingUpdate'
    }
    if (workloadKind.value === 'StatefulSet') return 'RollingUpdate'
    if (workloadKind.value === 'DaemonSet') return 'RollingUpdate'
    if (workloadKind.value === 'Job') return 'OneTime'
    if (workloadKind.value === 'CronJob') return 'Cron'
    return '-'
  })
  const isReady = computed(
    () => readyReplicas.value === desiredReplicas.value && desiredReplicas.value > 0
  )
  const containers = computed(() => {
    if (!workload.value) return []
    if (workloadKind.value === 'CronJob') {
      return ((workload.value as K8sCronJob).spec?.jobTemplate?.spec?.template?.spec?.containers ??
        []) as any[]
    }
    return (((workload.value as any).spec?.template?.spec?.containers ?? []) as any[])
  })
  const showAllLabels = ref(false)
  const showAllAnnotations = ref(false)
  const selectorLabelMap = computed<Record<string, string>>(() => {
    if (!workload.value) return {}
    if (workloadKind.value === 'Deployment' || workloadKind.value === 'StatefulSet' || workloadKind.value === 'DaemonSet') {
      return ((workload.value as K8sDeployment | K8sStatefulSet | K8sDaemonSet).spec?.selector
        ?.matchLabels ?? {}) as Record<string, string>
    }
    if (workloadKind.value === 'Job') {
      return (((workload.value as K8sJob).spec as any)?.template?.metadata?.labels ?? {}) as Record<
        string,
        string
      >
    }
    return (((workload.value as K8sCronJob).spec?.jobTemplate?.spec as any)?.template?.metadata
      ?.labels ?? {}) as Record<string, string>
  })
  const podSelector = computed(() => {
    return Object.entries(selectorLabelMap.value)
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
  })
  const selectorEntries = computed(() =>
    Object.entries(selectorLabelMap.value).map(([key, value]) => ({ key, value }))
  )
  const annotationEntries = computed(() =>
    Object.entries((workload.value?.metadata?.annotations ?? {}) as Record<string, string>).map(
      ([key, value]) => ({ key, value })
    )
  )
  const labelEntries = computed(() =>
    Object.entries((workload.value?.metadata?.labels ?? {}) as Record<string, string>).map(
      ([key, value]) => ({ key, value })
    )
  )
  const hasMoreLabels = computed(() => labelEntries.value.length > 3)
  const hasMoreAnnotations = computed(() => annotationEntries.value.length > 3)
  const visibleLabelEntries = computed(() =>
    showAllLabels.value || !hasMoreLabels.value
      ? labelEntries.value
      : labelEntries.value.slice(0, 2)
  )
  const visibleAnnotationEntries = computed(() =>
    showAllAnnotations.value || !hasMoreAnnotations.value
      ? annotationEntries.value
      : annotationEntries.value.slice(0, 2)
  )
  const rollingUpdateValues = computed(() => {
    const ru = (workload.value as K8sDeployment | undefined)?.spec?.strategy?.rollingUpdate
    if (!ru) return null
    return {
      maxSurge: String(ru.maxSurge ?? '25%'),
      maxUnavailable: String(ru.maxUnavailable ?? '25%')
    }
  })

  // CPU/Mem aggregation
  function parseCpuMilli(s: string): number {
    if (!s) return 0
    if (s.endsWith('m')) return parseInt(s)
    return parseFloat(s) * 1000
  }
  function parseMemBytes(s: string): number {
    if (!s) return 0
    const units: Record<string, number> = {
      Ki: 1024,
      Mi: 1024 ** 2,
      Gi: 1024 ** 3,
      Ti: 1024 ** 4,
      K: 1000,
      M: 1000 ** 2,
      G: 1000 ** 3
    }
    for (const [u, mul] of Object.entries(units)) {
      if (s.endsWith(u)) return parseFloat(s) * mul
    }
    return parseFloat(s)
  }
  function fmtCpu(m: number) {
    return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(2)}`
  }
  function fmtMem(b: number) {
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)}Gi`
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)}Mi`
    if (b >= 1024) return `${(b / 1024).toFixed(0)}Ki`
    return `${b}B`
  }

  const aggregatedCpu = computed(() => {
    let reqM = 0,
      limM = 0,
      hasReq = false,
      hasLim = false
    for (const c of containers.value) {
      if (c.resources?.requests?.cpu) {
        reqM += parseCpuMilli(c.resources.requests.cpu)
        hasReq = true
      }
      if (c.resources?.limits?.cpu) {
        limM += parseCpuMilli(c.resources.limits.cpu)
        hasLim = true
      }
    }
    return { request: hasReq ? fmtCpu(reqM) : '', limit: hasLim ? fmtCpu(limM) : '' }
  })
  const aggregatedMem = computed(() => {
    let reqB = 0,
      limB = 0,
      hasReq = false,
      hasLim = false
    for (const c of containers.value) {
      if (c.resources?.requests?.memory) {
        reqB += parseMemBytes(c.resources.requests.memory)
        hasReq = true
      }
      if (c.resources?.limits?.memory) {
        limB += parseMemBytes(c.resources.limits.memory)
        hasLim = true
      }
    }
    return { request: hasReq ? fmtMem(reqB) : '', limit: hasLim ? fmtMem(limB) : '' }
  })

  function containerResources(c: any) {
    return [
      {
        type: 'Request',
        cpu: c.resources?.requests?.cpu || '无限制',
        memory: c.resources?.requests?.memory || '无限制'
      },
      {
        type: 'Limit',
        cpu: c.resources?.limits?.cpu || '无限制',
        memory: c.resources?.limits?.memory || '无限制'
      }
    ]
  }

  function probeDesc(probe: any): string {
    if (probe.httpGet) return `HTTP GET ${probe.httpGet.path} :${probe.httpGet.port}`
    if (probe.tcpSocket) return `TCP :${probe.tcpSocket.port}`
    if (probe.exec) return `Exec: ${(probe.exec.command ?? []).join(' ')}`
    return JSON.stringify(probe)
  }

  // ── Time format ──
  function formatTime(ts?: string): string {
    if (!ts) return '-'
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // ── Pods tab ──
  const pods = ref<K8sPod[]>([])
  const podsLoading = ref(false)
  const podSearchKeyword = ref('')
  const filteredPods = computed(() => {
    const keyword = podSearchKeyword.value.trim().toLowerCase()
    if (!keyword) return pods.value
    return pods.value.filter((pod) =>
      String(pod.metadata?.name ?? '')
        .toLowerCase()
        .includes(keyword)
    )
  })
  async function loadPods() {
    if (!podSelector.value) return
    podsLoading.value = true
    try {
      const base = `/pixiu/proxy/${encodeURIComponent(cluster.value)}/api/v1/namespaces/${encodeURIComponent(namespace.value)}/pods`
      const { data } = await kubeProxyAxios.get<{ items?: K8sPod[] }>(base, {
        params: { labelSelector: podSelector.value, limit: 200 }
      })
      pods.value = data.items ?? []
    } catch {
      pods.value = []
    } finally {
      podsLoading.value = false
    }
  }
  function podStatusType(status: string) {
    return podStatusTagType(status)
  }
  function podReadyCount(pod: K8sPod): number {
    return (pod.status?.containerStatuses ?? []).filter((s: any) => s.ready).length
  }
  function podRestartCount(pod: K8sPod): number {
    return (pod.status?.containerStatuses ?? []).reduce(
      (sum: number, s: any) => sum + (s.restartCount ?? 0),
      0
    )
  }

  // ── Services tab ──
  const matchedServices = ref<K8sService[]>([])
  const servicesLoading = ref(false)
  async function loadServices() {
    servicesLoading.value = true
    try {
      const { items } = await fetchK8sServiceList(cluster.value, {
        page: 1,
        limit: 999999,
        namespace: namespace.value
      })
      const deployLabels =
        ((workload.value as K8sDeployment | K8sStatefulSet | K8sDaemonSet | undefined)?.spec
          ?.selector?.matchLabels as Record<string, string> | undefined) ??
        {}
      matchedServices.value = items.filter((svc) => {
        const sel = svc.spec?.selector ?? {}
        if (!Object.keys(sel).length) return false
        return Object.entries(sel).every(([k, v]) => deployLabels[k] === v)
      })
    } catch {
      matchedServices.value = []
    } finally {
      servicesLoading.value = false
    }
  }

  // ── Events tab ──
  const events = ref<any[]>([])
  const eventsLoading = ref(false)
  async function loadEvents() {
    eventsLoading.value = true
    try {
      const aggregateKind = getAggregatedEventKind(workloadKind.value)
      const { items } = aggregateKind
        ? await fetchAggregatedEventList(
            cluster.value,
            namespace.value,
            name.value,
            aggregateKind
          )
        : await fetchKubeRawEventList(cluster.value, {
            namespace: namespace.value,
            name: name.value,
            kind: workloadKind.value,
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

  // ── History tab ──
  const replicaSets = ref<K8sReplicaSet[]>([])
  const historyLoading = ref(false)
  async function loadHistory() {
    historyLoading.value = true
    try {
      const { items } = await fetchK8sReplicaSetList(cluster.value, {
        namespace: namespace.value,
        labelSelector: podSelector.value
      })
      replicaSets.value = items
        .filter((rs) =>
          (rs.metadata?.ownerReferences ?? []).some(
            (o) => o.kind === 'Deployment' && o.name === name.value
          )
        )
        .sort((a, b) => {
          const ra = parseInt(a.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? '0')
          const rb = parseInt(b.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? '0')
          return rb - ra
        })
    } catch {
      replicaSets.value = []
    } finally {
      historyLoading.value = false
    }
  }

  // ── Logs tab ──
  const logPod = ref('')
  const logContainer = ref('')
  const logTailLines = ref(100)
  const logLoading = ref(false)
  const logContent = ref('')
  const logViewerRef = ref<HTMLElement>()
  const logContainerOptions = computed(() => {
    const pod = pods.value.find((p) => p.metadata?.name === logPod.value)
    return (pod?.spec?.containers ?? []).map((c: any) => c.name).filter(Boolean)
  })
  function onLogPodChange() {
    logContainer.value = logContainerOptions.value[0] ?? ''
    logContent.value = ''
  }
  async function fetchLogs() {
    if (!logPod.value || !logContainer.value) return
    logLoading.value = true
    try {
      const url = `/pixiu/proxy/${encodeURIComponent(cluster.value)}/api/v1/namespaces/${encodeURIComponent(namespace.value)}/pods/${encodeURIComponent(logPod.value)}/log`
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

  // ── Actions ──
  const scaleVisible = ref(false)
  const scaleTarget = ref(0)
  const scaling = ref(false)
  async function handleScale() {
    if (!supportsScale.value) return
    scaling.value = true
    try {
      if (workloadKind.value === 'Deployment') {
        await patchK8sDeployment(cluster.value, namespace.value, name.value, {
          spec: { replicas: scaleTarget.value }
        })
      } else if (workloadKind.value === 'StatefulSet') {
        await patchK8sStatefulSet(cluster.value, namespace.value, name.value, {
          spec: { replicas: scaleTarget.value }
        })
      }
      ElMessage.success('扩缩容成功')
      scaleVisible.value = false
      await loadWorkload()
    } catch (e: any) {
      ElMessage.error(e.message)
    } finally {
      scaling.value = false
    }
  }

  async function handleDelete() {
    try {
      await ElMessageBox.confirm(`确认删除 ${workloadKind.value} "${name.value}"? 此操作不可撤销。`, '删除', {
        type: 'warning',
        confirmButtonText: '确认删除',
        confirmButtonClass: 'el-button--danger'
      })
      if (workloadKind.value === 'Deployment')
        await deleteK8sDeployment(cluster.value, namespace.value, name.value)
      else if (workloadKind.value === 'StatefulSet')
        await deleteK8sStatefulSet(cluster.value, namespace.value, name.value)
      else if (workloadKind.value === 'DaemonSet')
        await deleteK8sDaemonSet(cluster.value, namespace.value, name.value)
      else if (workloadKind.value === 'Job') await deleteK8sJob(cluster.value, namespace.value, name.value)
      else if (workloadKind.value === 'CronJob')
        await deleteK8sCronJob(cluster.value, namespace.value, name.value, cronJobApiVersion.value)
      ElMessage.success('已删除')
      goBack()
    } catch {
      /* cancel */
    }
  }

  function onMoreClick(item: ButtonMoreItem) {
    if (item.key === 'delete') {
      void handleDelete()
    }
  }

  const yamlVisible = ref(false)
  const yamlContent = ref('')
  const yamlSaving = ref(false)
  async function openYamlEditor() {
    try {
      let obj: WorkloadUnion
      if (workloadKind.value === 'Deployment') {
        obj = await fetchK8sDeployment(cluster.value, namespace.value, name.value)
      } else if (workloadKind.value === 'StatefulSet') {
        obj = await fetchK8sStatefulSet(cluster.value, namespace.value, name.value)
      } else if (workloadKind.value === 'DaemonSet') {
        obj = await fetchK8sDaemonSet(cluster.value, namespace.value, name.value)
      } else if (workloadKind.value === 'Job') {
        obj = await fetchK8sJob(cluster.value, namespace.value, name.value)
      } else {
        obj = await fetchK8sCronJob(cluster.value, namespace.value, name.value, cronJobApiVersion.value)
      }
      yamlContent.value = YAML.dump(obj)
      yamlVisible.value = true
    } catch (e: any) {
      ElMessage.error('获取 YAML 失败')
    }
  }
  async function saveYaml() {
    yamlSaving.value = true
    try {
      await updateK8sResourceFromYaml(cluster.value, yamlContent.value)
      ElMessage.success('保存成功')
      yamlVisible.value = false
      await loadWorkload()
    } catch (e: any) {
      ElMessage.error(e.message || '保存失败')
    } finally {
      yamlSaving.value = false
    }
  }

  function onDeploymentDetailYamlSave(text: string) {
    yamlContent.value = text
    void saveYaml()
  }

  // ── Navigation ──
  const KIND_TO_TAB: Record<string, string> = {
    Deployment: 'deploy',
    StatefulSet: 'sts',
    DaemonSet: 'ds',
    Job: 'job',
    CronJob: 'cj'
  }
  function goToPodDetail(pod: { metadata?: { name?: string; namespace?: string } }) {
    router.push({
      path: '/container/pod-detail',
      query: {
        cluster: cluster.value,
        namespace: pod.metadata?.namespace ?? namespace.value,
        pod: pod.metadata?.name ?? ''
      }
    })
  }
  function goBack() {
    const tab = KIND_TO_TAB[workloadKind.value] ?? 'deploy'
    router.push({
      path: '/container/workloads',
      query: buildClusterRouteQuery(route, { cluster: cluster.value, tab })
    })
  }

  // ── Load data ──
  async function loadWorkload() {
    loading.value = true
    try {
      if (workloadKind.value === 'Deployment') {
        workload.value = await fetchK8sDeployment(cluster.value, namespace.value, name.value)
      } else if (workloadKind.value === 'StatefulSet') {
        workload.value = await fetchK8sStatefulSet(cluster.value, namespace.value, name.value)
      } else if (workloadKind.value === 'DaemonSet') {
        workload.value = await fetchK8sDaemonSet(cluster.value, namespace.value, name.value)
      } else if (workloadKind.value === 'Job') {
        workload.value = await fetchK8sJob(cluster.value, namespace.value, name.value)
      } else {
        workload.value = await fetchK8sCronJob(cluster.value, namespace.value, name.value, cronJobApiVersion.value)
      }
      scaleTarget.value = ((workload.value as K8sDeployment | K8sStatefulSet | undefined)?.spec?.replicas ?? 0)
    } catch (e: any) {
      ElMessage.error(`获取 ${workloadKind.value} 详情失败`)
    } finally {
      loading.value = false
    }
  }

  // Tab change lazy loading
  watch(
    activeTab,
    async (tab) => {
      if (tab === 'pods' && pods.value.length === 0) await loadPods()
      if (tab === 'services' && matchedServices.value.length === 0) await loadServices()
      if (tab === 'events' && events.value.length === 0) await loadEvents()
      if (tab === 'history' && replicaSets.value.length === 0) await loadHistory()
      if (tab === 'logs' && pods.value.length === 0) await loadPods()
    },
    { immediate: true }
  )

  onMounted(async () => {
    await loadWorkload()
    if (podSelector.value) loadPods()
  })

  watch(
    () => workload.value?.metadata?.uid,
    () => {
      showAllLabels.value = false
      showAllAnnotations.value = false
    }
  )
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
    color: var(--el-text-color-regular);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
    flex-shrink: 1;
  }
  .dd-title__kind {
    font-size: var(--el-menu-item-font-size, 14px);
    font-weight: var(--el-menu-item-font-weight, 400);
    color: var(--el-text-color-regular);
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
    font-weight: var(--el-menu-item-font-weight, 400);
    color: var(--el-text-color-regular);
    flex-shrink: 0;
  }
  .dd-cluster-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
    font-weight: var(--el-menu-item-font-weight, 400);
  }
  .dd-ns-tag {
    margin-left: 8px;
    flex-shrink: 0;
  }
  .dd-meta {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .dd-meta__lbl {
    color: var(--el-text-color-secondary);
  }
  .dd-meta__val {
    color: var(--el-text-color-primary);
  }
  .dd-meta__val--primary {
    color: var(--el-color-primary);
    font-weight: 500;
  }
  .dd-meta__sep {
    margin: 0 8px;
    color: var(--el-text-color-placeholder);
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
    color: var(--el-text-color-primary);
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
  .dd-info-cell--span {
    grid-column: span 2;
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
  .dd-ru-lines {
    line-height: 1.7;
  }
  .c-ok {
    color: var(--el-color-success);
    font-weight: 600;
  }
  .c-warn {
    color: var(--el-color-warning);
    font-weight: 600;
  }
  .c-sep {
    color: var(--el-text-color-placeholder);
  }

  /* ── Meta row (labels / selectors / images) ── */
  .dd-meta-row {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 2px 0 6px;
  }
  .dd-meta-item {
    display: flex;
    align-items: flex-start;
    padding: 8px 16px 8px 45px;
    gap: 0;
  }
  .dd-k--block {
    padding-top: 2px;
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
  .tab-badge {
    margin-left: 4px;
    vertical-align: middle;
  }
  .tab-badge :deep(.el-badge__content) {
    transform: none;
    position: static;
    display: inline-block;
  }

  /* ── Common table ── */
  .dd-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }
  .dd-pods-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .dd-pods-toolbar__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dd-pods-toolbar__right {
    display: flex;
    align-items: center;
    margin-left: auto;
  }
  .dd-pods-toolbar__search {
    width: 260px;
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
  .dd-table :deep(.el-table__row:hover > td.el-table__cell) {
    background-color: var(--el-fill-color-lighter);
  }
  .dd-empty-tip {
    text-align: center;
    padding: 36px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .port-pill {
    display: inline-block;
    margin-right: 6px;
    font-size: 12px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    background: var(--el-fill-color-lighter);
    border-radius: 4px;
    padding: 1px 5px;
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
  .ct-icon {
    color: var(--el-color-primary);
    font-size: 15px;
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

  /* Env vars */
  .env-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 13px;
    padding: 2px 0;
  }
  .env-k {
    color: var(--el-color-primary);
    min-width: 140px;
  }
  .env-eq {
    color: var(--el-text-color-placeholder);
  }
  .env-v {
    color: var(--el-text-color-primary);
    word-break: break-all;
  }

  /* Volume mounts */
  .mount-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    padding: 2px 0;
  }
  .mount-name {
    color: var(--el-color-primary);
  }
  .mount-arrow {
    color: var(--el-text-color-placeholder);
    font-size: 12px;
  }
  .mount-path {
    color: var(--el-text-color-secondary);
  }

  /* Probes */
  .probe-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    padding: 2px 0;
  }
  .probe-desc {
    color: var(--el-text-color-regular);
  }

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
  .link-text {
    color: var(--el-color-primary);
    cursor: pointer;
  }
  .dd-workloads-copy {
    margin-top: -8px;
  }

  .dd-workloads-copy :deep(.workloads-tabs .el-tabs__header) {
    margin-bottom: 8px;
  }

  .dd-workloads-copy :deep(.workloads-tabs .el-tabs__content) {
    padding-top: 0;
  }

  .dd-workloads-copy :deep(.art-table-card > .el-card__body) {
    padding-top: 12px;
  }
</style>
