<!-- 集群概览：资源概览、用量曲线、组件摘要（Mock） -->
<template>
  <div class="cluster-overview">
    <ElTabs v-model="innerTab" class="cluster-overview-tabs">
      <ElTabPane label="概览" name="main">
        <div class="overview-main-grid">
          <div class="overview-main-left">
            <section class="section-title" style="margin-top: 10px">资源概览</section>
            <ElRow :gutter="16">
              <ElCol :xs="24" :sm="12">
                <ElCard shadow="never" class="resource-card">
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
                        height="100px"
                        :data="nodeRingData"
                        :radius="['55%', '85%']"
                        :border-radius="7"
                        :center-text="nodeCenterText"
                        :center-text-font-size="16"
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
              <ElCol :xs="24" :sm="12">
                <ElCard shadow="never" class="resource-card">
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
                        height="100px"
                        :data="wlRingData"
                        :radius="['55%', '85%']"
                        :border-radius="7"
                        :center-text="wlCenterText"
                        :center-text-font-size="16"
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

            <section class="section-title" style="margin-top: 10px">用量概览</section>
            <ElCard shadow="never" class="usage-status-card">
              <div class="usage-overview-head">
                <div class="usage-overview-head__sub">过去24小时内每小时平均数据</div>
                <ElLink type="primary" underline="never" @click="go('prometheus')"
                  >查看监控详情</ElLink
                >
              </div>
              <ElRow :gutter="16">
                <ElCol :xs="24" :lg="12" class="usage-overview-col">
                  <div class="usage-col">
                    <div class="usage-col__title">CPU利用率</div>
                    <div class="usage-col__value">
                      <span>{{ fmt(cpuUtilPercent, '%', 2) }}</span>
                      <svg
                        v-if="cpuUtilTrend === 'up'"
                        class="usage-col__trend is-up"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path fill="currentColor" :d="TREND_ARROW_PATH" />
                      </svg>
                      <svg
                        v-else-if="cpuUtilTrend === 'down'"
                        class="usage-col__trend is-down is-flip"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path fill="currentColor" :d="TREND_ARROW_PATH" />
                      </svg>
                    </div>
                    <ul class="usage-col__stats usage-col__stats--row">
                      <li>
                        <span>CPU使用量</span>
                        <strong>{{ fmt(cpuUsageCores, '核', 2) }}</strong>
                      </li>
                      <li>
                        <span>CPU总核数</span>
                        <strong>{{ fmt(cpuTotalCores, '核', 2) }}</strong>
                      </li>
                      <li>
                        <span>CPU分配率</span>
                        <strong>{{ fmtGauge(cpuRequestCommitPercent, '%', 2) }}</strong>
                      </li>
                    </ul>
                  </div>
                </ElCol>
                <ElCol :xs="24" :lg="12" class="usage-overview-col">
                  <div class="usage-col">
                    <div class="usage-col__title">内存利用率（含Cache）</div>
                    <div class="usage-col__value">
                      <span>{{ fmt(memUtilWithCachePercent, '%', 2) }}</span>
                      <svg
                        v-if="memUtilTrend === 'up'"
                        class="usage-col__trend is-up"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path fill="currentColor" :d="TREND_ARROW_PATH" />
                      </svg>
                      <svg
                        v-else-if="memUtilTrend === 'down'"
                        class="usage-col__trend is-down is-flip"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path fill="currentColor" :d="TREND_ARROW_PATH" />
                      </svg>
                    </div>
                    <ul class="usage-col__stats usage-col__stats--row">
                      <li>
                        <span>内存使用量（含Cache）</span>
                        <strong>{{ fmt(memUsageWithCacheGib, 'GB', 2) }}</strong>
                      </li>
                      <li>
                        <span>内存使用量（不含Cache）</span>
                        <strong>{{ fmt(memUsageGib, 'GB', 2) }}</strong>
                      </li>
                    </ul>
                    <ul class="usage-col__stats usage-col__stats--row usage-col__stats--row-sub">
                      <li>
                        <span>内存利用率（不含Cache）</span>
                        <strong>{{ fmt(memUtilPercent, '%', 2) }}</strong>
                      </li>
                      <li>
                        <span>内存总和</span>
                        <strong>{{ fmt(memTotalGib, 'GB', 2) }}</strong>
                      </li>
                    </ul>
                  </div>
                </ElCol>
              </ElRow>
            </ElCard>
          </div>

          <aside class="overview-main-right">
            <section class="section-title" style="margin-top: 10px">已安装组件</section>
            <ElCard shadow="never" class="installed-components-card">
              <div class="installed-components__summary">
                <div class="installed-components__stat">
                  <span class="installed-components__stat-label">总数</span>
                  <span class="installed-components__stat-value">{{ compSummary.total }}</span>
                </div>
                <div class="installed-components__stat">
                  <span class="installed-components__stat-label">运行中</span>
                  <span class="installed-components__stat-value">{{ compSummary.running }}</span>
                </div>
                <div class="installed-components__stat">
                  <span class="installed-components__stat-label">可升级</span>
                  <span class="installed-components__stat-value">{{
                    compSummary.upgradable == null ? '-' : compSummary.upgradable
                  }}</span>
                </div>
              </div>
              <div class="installed-components__icons">
                <div
                  v-for="item in installedComponentIcons"
                  :key="item.id"
                  class="installed-components__icon"
                  :style="{ background: item.color }"
                  :title="item.name"
                >
                  <ArtSvgIcon :icon="item.icon" />
                </div>
              </div>
              <div class="installed-components__recommend-title">常用组件推荐</div>
              <div class="installed-components__recommend-list">
                <div
                  v-for="item in recommendedComponents"
                  :key="item.name"
                  class="installed-components__recommend-item"
                >
                  <div
                    class="installed-components__recommend-icon"
                    :style="{ background: item.color }"
                  >
                    <ArtSvgIcon :icon="item.icon" />
                  </div>
                  <div class="installed-components__recommend-main">
                    <div class="installed-components__recommend-head">
                      <span class="installed-components__recommend-name">{{ item.name }}</span>
                      <span class="installed-components__recommend-tag">{{ item.tag }}</span>
                    </div>
                    <div class="installed-components__recommend-desc">{{ item.desc }}</div>
                  </div>
                  <ElLink
                    type="primary"
                    underline="never"
                    class="installed-components__recommend-link"
                    @click="openRecommendLink(item)"
                  >
                    了解详情
                    <ArtSvgIcon icon="ri:arrow-right-s-line" />
                  </ElLink>
                </div>
              </div>
            </ElCard>
          </aside>
        </div>

        <section class="section-title" style="margin-top: 10px">用量趋势（近 24 小时）</section>
        <ElCard shadow="never" class="usage-overview-card">
          <div class="usage-overview-grid">
            <MetricChartPanel
              title="CPU 利用率（%）"
              :data="cpuUtilPercent"
              :x-axis-data="cpuUtilLabels"
              :is-empty="!cpuUtilPercent.length"
              :silent-update="usageChartSilentUpdate"
              :axis-font-size="10"
              height="120px"
              plain
              :expand-time-range="usageTimeRange"
              @expand-time-range-change="onUsageTimeRangeChange"
            />
            <MetricChartPanel
              title="内存利用率（%）"
              :data="memUtilPercent"
              :x-axis-data="cpuUtilLabels"
              :is-empty="!memUtilPercent.length"
              :silent-update="usageChartSilentUpdate"
              :axis-font-size="10"
              height="120px"
              plain
              :expand-time-range="usageTimeRange"
              @expand-time-range-change="onUsageTimeRangeChange"
            />
            <MetricChartPanel
              title="CPU 使用量（核）"
              :data="cpuUsageCores"
              :x-axis-data="cpuUtilLabels"
              :is-empty="!cpuUsageCores.length"
              :silent-update="usageChartSilentUpdate"
              :axis-font-size="10"
              height="120px"
              plain
              :expand-time-range="usageTimeRange"
              @expand-time-range-change="onUsageTimeRangeChange"
            />
            <MetricChartPanel
              title="内存使用量（GB）"
              :data="memUsageGib"
              :x-axis-data="cpuUtilLabels"
              :is-empty="!memUsageGib.length"
              :silent-update="usageChartSilentUpdate"
              :axis-font-size="10"
              height="120px"
              plain
              :expand-time-range="usageTimeRange"
              @expand-time-range-change="onUsageTimeRangeChange"
            />
          </div>
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
              <div v-else-if="kubeconfigContent" class="kubeconfig-hidden"
                >KubeConfig 内容已隐藏</div
              >
              <ElEmpty v-else description="暂无 KubeConfig 内容" :image-size="80" />
            </div>
          </ElCard>

          <ElCard shadow="never" class="basic-info-card mt-2">
            <template #header>
              <div style="display: flex; align-items: center; justify-content: space-between">
                <div class="proxy-header-left">
                  <span class="basic-info-card__title">外部访问</span>
                  <ElSwitch
                    :model-value="proxyEnabled"
                    :loading="proxyLoading || proxyFormLoading"
                    :disabled="!ctx.id"
                    @change="onProxyToggle"
                  />
                  <span class="info-dl__switch-text">{{ proxyEnabled ? '已开启' : '未开启' }}</span>
                  <span v-if="proxyFull?.expire_at" class="proxy-expire-text">
                    过期时间 {{ formatProxyExpireAt(proxyFull.expire_at) }}
                  </span>
                </div>
                <div v-if="proxyFull" class="kubeconfig-actions">
                  <ElLink
                    v-if="!proxyKubeconfigVisible"
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="proxyKubeconfigVisible = true"
                  >
                    显示
                  </ElLink>
                  <ElLink
                    v-else
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="proxyKubeconfigVisible = false"
                  >
                    隐藏
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="copyProxyKubeconfig"
                  >
                    拷贝
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    class="kubeconfig-action"
                    @click="downloadProxyKubeconfig"
                  >
                    下载
                  </ElLink>
                </div>
              </div>
            </template>
            <div v-loading="proxyLoading" class="kubeconfig-body">
              <pre v-if="proxyFull?.kubeconfig && proxyKubeconfigVisible" class="kubeconfig-pre">{{
                proxyFull.kubeconfig
              }}</pre>
              <div v-else-if="proxyFull?.kubeconfig" class="kubeconfig-hidden">
                代理 KubeConfig 内容已隐藏
              </div>
              <ElEmpty
                v-else
                description="未开启，启用后可通过外网 kubectl 连接集群"
                :image-size="80"
              />
            </div>
          </ElCard>
        </div>
      </ElTabPane>

      <ElTabPane label="监控" name="monitor">
        <ClusterMonitorMetrics
          v-if="innerTab === 'monitor' && isOverviewRoute"
          :cluster-name="ctx.name"
        />
      </ElTabPane>
    </ElTabs>

    <ElDialog v-model="proxyDialogVisible" title="启用外部访问" width="460px" destroy-on-close>
      <ElForm label-width="90px">
        <ElFormItem label="过期时间">
          <ElDatePicker
            v-model="proxyForm.expiresAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            class="w-full"
            placeholder="留空则使用默认配置"
            :disabled-date="disablePastDate"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="proxyDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="proxyFormLoading" @click="submitProxyCreate"
          >确定</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { inject, computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    decodeKubeConfigBase64,
    fetchProtectCluster,
    fetchUpdateClusterAlias,
    fetchClusterByName,
    fetchGetClusterKubeconfig,
    fetchGetProxyKubeconfig,
    fetchCreateProxyKubeconfig,
    fetchRevokeAccessToken,
    PixiuApiError,
    type KubeconfigResponse,
    type ProxyKubeconfigResponse
  } from '@/api/container'
  import { fetchPlanWithResources, type PlanResourcesDetail } from '@/api/plan'
  import {
    fetchClusterBasicNetwork,
    fetchClusterDetailInfo,
    type ClusterBasicNetwork,
    type ClusterDetailInfo,
    type ClusterOverviewK8sStats
  } from '@/api/kubernetes/cluster-overview-stats'
  import { useClusterUsagePrometheus } from '@/hooks/kubernetes/useClusterUsagePrometheus'
  import {
    getDefaultMetricsTimeRange,
    METRICS_TIME_PRESETS,
    type MetricsTimeRange
  } from '@/utils/metrics/time-range'
  import { fetchClusterResourceOverviewFromPrometheus } from '@/hooks/kubernetes/useClusterResourceOverviewPrometheus'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import ClusterMonitorMetrics from '@/views/container/cluster/modules/cluster-monitor-metrics.vue'
  import { clusterDetailContextKey, clusterDetailRefreshKey } from './context'
  import { getCronJobApiVersion } from '@/utils/kubernetes/cronjob'
  import { notifyError } from '@/utils/sys/notify'

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

  const OVERVIEW_TAB_NAMES = new Set(['main', 'basic', 'api', 'monitor'])

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
      const stats = await fetchClusterResourceOverviewFromPrometheus(cluster)
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
        fetchClusterResourceOverviewFromPrometheus(cluster),
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

  // 外网代理相关状态
  const proxyLoading = ref(false)
  const proxyFull = ref<ProxyKubeconfigResponse | null>(null)
  const proxyKubeconfigVisible = ref(false)
  const proxyEnabled = computed(() => proxyFull.value !== null)
  const loadedProxyCluster = ref('')

  const proxyDialogVisible = ref(false)
  const proxyFormLoading = ref(false)
  const proxyForm = ref({ expiresAt: '' })

  function disablePastDate(date: Date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date.getTime() < today.getTime()
  }

  function formatProxyExpireAt(value: string) {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

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
      notifyError(e, '获取 Kubeconfig 失败')
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

  // 外网代理
  async function loadProxyKubeconfig(force = false) {
    const clusterId = ctx.value.id
    if (!clusterId) return
    const clusterKey = `${ctx.value.name}:${clusterId}`
    if (!force && !proxyLoading.value && loadedProxyCluster.value === clusterKey) return

    proxyLoading.value = true
    proxyKubeconfigVisible.value = false
    try {
      const data = await fetchGetProxyKubeconfig(clusterId)
      proxyFull.value = data
      loadedProxyCluster.value = clusterKey
    } catch {
      proxyFull.value = null
      loadedProxyCluster.value = ''
    } finally {
      proxyLoading.value = false
    }
  }

  async function onProxyToggle(val: string | number | boolean) {
    if (val) {
      proxyForm.value = { expiresAt: '' }
      proxyDialogVisible.value = true
    } else {
      // 关闭：确认后删除 token 记录
      if (!proxyFull.value?.jti) return
      try {
        await ElMessageBox.confirm('关闭后将删除代理凭证，该 KubeConfig 立即失效。', '确认关闭', {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          type: 'warning'
        })
      } catch {
        return
      }
      proxyLoading.value = true
      try {
        await fetchRevokeAccessToken(ctx.value.id, proxyFull.value.jti)
        proxyFull.value = null
        proxyKubeconfigVisible.value = false
        loadedProxyCluster.value = ''
        ElMessage.success('已关闭外部访问')
      } catch (e: unknown) {
        if (e instanceof PixiuApiError && e.notified) return
        notifyError(e, '关闭失败')
      } finally {
        proxyLoading.value = false
      }
    }
  }

  function copyProxyKubeconfig() {
    if (!proxyFull.value?.kubeconfig) {
      ElMessage.warning('暂无代理 KubeConfig 内容')
      return
    }
    copyText(proxyFull.value.kubeconfig)
  }

  function downloadProxyKubeconfig() {
    if (!proxyFull.value?.kubeconfig) {
      ElMessage.warning('暂无代理 KubeConfig 内容')
      return
    }
    const name = proxyFull.value.cluster_name || ctx.value.name || 'kubeconfig'
    const blob = new Blob([proxyFull.value.kubeconfig], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function submitProxyCreate() {
    if (proxyForm.value.expiresAt) {
      const expireMs = new Date(proxyForm.value.expiresAt).getTime()
      if (Number.isNaN(expireMs) || expireMs <= Date.now()) {
        ElMessage.warning('过期时间必须晚于当前时间')
        return
      }
    }
    proxyFormLoading.value = true
    try {
      await fetchCreateProxyKubeconfig(ctx.value.id, {
        expires_at: proxyForm.value.expiresAt || undefined
      })
      proxyDialogVisible.value = false
      // 创建成功后强制 GET，刷新页面缓存与开关状态
      await loadProxyKubeconfig(true)
      ElMessage.success('已开启外部访问')
    } catch (e: unknown) {
      if (e instanceof PixiuApiError && e.notified) return
      notifyError(e, '开启失败')
    } finally {
      proxyFormLoading.value = false
    }
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
      notifyError(e, '更新失败')
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
      notifyError(e, '操作失败')
    } finally {
      protectSaving.value = false
    }
  }

  const nodeRingData = computed(() => {
    const { controlPlane, worker } = k8sOverview.value.nodes
    return [
      { name: '管控节点', value: controlPlane },
      { name: '工作节点', value: worker }
    ]
  })

  const nodeTotal = computed(() =>
    nodeRingData.value.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  )
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
    wlRingData.value.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
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

  /** 用量趋势时间范围：默认最近 24 小时；最大化弹窗内可调整，由 hook 内 watch 触发重新查询 */
  const usageTimeRange = ref<MetricsTimeRange>(
    METRICS_TIME_PRESETS.find((p) => p.key === '24h')?.getRange(new Date()) ??
      getDefaultMetricsTimeRange()
  )

  const {
    chartReady: usageChartReady,
    cpuTimeLabels: cpuUtilLabels,
    cpuUtilPercent,
    memUtilPercent,
    cpuUsageCores,
    memUsageGib,
    cpuTotalCores,
    memTotalGib,
    memUsageWithCacheGib,
    memUtilWithCachePercent,
    cpuRequestCommitPercent,
    startRefresh: startUsageOverviewRefresh,
    stopRefresh: stopUsageOverviewRefresh,
    resetCharts: resetUsageOverviewCharts
  } = useClusterUsagePrometheus(clusterName, usageTimeRange)

  /** 取数组最后一项作为当前值；空或非数字返回 null */
  function lastOf(arr: number[]): number | null {
    const n = arr[arr.length - 1]
    return Number.isFinite(n) ? n : null
  }

  /** 格式化趋势数组末项当前值：数据未就绪显示 '-'，否则数值 + 单位 */
  function fmt(arr: number[], unit: string, digits = 2): string {
    const v = lastOf(arr)
    return v === null ? '-' : `${v.toFixed(digits)}${unit}`
  }

  /** 格式化 gauge 标量当前值：0 视为未就绪显示 '-'（cluster.cpu_requests 空面板返回 0） */
  function fmtGauge(v: number, unit: string, digits = 2): string {
    return v === 0 ? '-' : `${v.toFixed(digits)}${unit}`
  }

  type UtilTrend = 'up' | 'down' | ''
  const TREND_HOLD_MS = 10000
  /** 弯曲向上实心箭头（下降时垂直翻转），贴近产品截图样式 */
  const TREND_ARROW_PATH =
    'M12 2 L19 12 H14.3 C13.9 16.2 11.8 19.6 7 22.6 L5.6 21 C9.8 18.3 11.4 15.4 11.4 12 H5 Z'

  const cpuUtilTrend = ref<UtilTrend>('')
  const memUtilTrend = ref<UtilTrend>('')
  let prevCpuUtil: number | null = null
  let prevMemUtil: number | null = null
  let cpuTrendTimer: ReturnType<typeof setTimeout> | undefined
  let memTrendTimer: ReturnType<typeof setTimeout> | undefined

  function applyUtilTrend(next: number | null, kind: 'cpu' | 'mem') {
    if (next === null) return
    const prev = kind === 'cpu' ? prevCpuUtil : prevMemUtil
    if (kind === 'cpu') prevCpuUtil = next
    else prevMemUtil = next
    if (prev === null || next === prev) return

    const trendRef = kind === 'cpu' ? cpuUtilTrend : memUtilTrend
    trendRef.value = next > prev ? 'up' : 'down'

    if (kind === 'cpu') {
      if (cpuTrendTimer) clearTimeout(cpuTrendTimer)
      cpuTrendTimer = setTimeout(() => {
        cpuUtilTrend.value = ''
        cpuTrendTimer = undefined
      }, TREND_HOLD_MS)
    } else {
      if (memTrendTimer) clearTimeout(memTrendTimer)
      memTrendTimer = setTimeout(() => {
        memUtilTrend.value = ''
        memTrendTimer = undefined
      }, TREND_HOLD_MS)
    }
  }

  watch(
    () => lastOf(cpuUtilPercent.value),
    (next) => applyUtilTrend(next, 'cpu')
  )
  watch(
    () => lastOf(memUtilWithCachePercent.value),
    (next) => applyUtilTrend(next, 'mem')
  )

  onUnmounted(() => {
    if (cpuTrendTimer) clearTimeout(cpuTrendTimer)
    if (memTrendTimer) clearTimeout(memTrendTimer)
  })

  const usageChartSilentUpdate = ref(true)

  /** 最大化弹窗内调整时间范围：更新 usageTimeRange，hook 内 watch 触发静默刷新 */
  function onUsageTimeRangeChange(range: MetricsTimeRange) {
    usageTimeRange.value = range
  }

  watch(usageChartReady, () => {})

  function stopOverviewBackgroundLoads() {
    stopUsageOverviewRefresh()
    resetUsageOverviewCharts()
    usageChartSilentUpdate.value = true
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
    if (tab === 'api') {
      void loadKubeconfig()
      void loadProxyKubeconfig()
    }
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

  /** 已安装组件（概览右侧卡片，暂用展示数据） */
  const installedComponentIcons = [
    { id: 'cni', name: 'CNI', icon: 'ri:share-line', color: '#6C63FF' },
    { id: 'coredns', name: 'CoreDNS', icon: 'ri:home-4-line', color: '#4C8DFF' },
    { id: 'metrics', name: 'Metrics Server', icon: 'ri:bar-chart-2-line', color: '#2BBBAD' },
    { id: 'ingress', name: 'Ingress', icon: 'ri:door-open-line', color: '#5B8DEF' },
    { id: 'storage', name: '存储插件', icon: 'ri:hard-drive-2-line', color: '#7B61FF' },
    { id: 'monitor', name: '监控', icon: 'ri:pulse-line', color: '#3D8BFF' },
    { id: 'log', name: '日志', icon: 'ri:file-list-3-line', color: '#5C6BC0' },
    { id: 'security', name: '安全', icon: 'ri:shield-check-line', color: '#26A69A' },
    { id: 'dns', name: 'DNS', icon: 'ri:earth-line', color: '#42A5F5' }
  ]

  const recommendedComponents = [
    {
      name: '部署工程',
      tag: '部署',
      desc: '基于 Ansible 的 Kubernetes 集群与云原生应用快速部署',
      icon: 'ri:calendar-schedule-line',
      color: '#F5A623',
      link: 'https://github.com/pixiu-io/kubez-ansible'
    },
    {
      name: 'PixiuHub',
      tag: '加速',
      desc: '加速容器镜像拉取，缩短部署耗时',
      icon: 'ri:flashlight-line',
      color: '#7C6AF0',
      link: 'https://hub.pixiuio.com/'
    },
    {
      name: '应用商店',
      tag: '应用',
      desc: '一键部署常用云原生应用与中间件',
      icon: 'ri:store-2-line',
      color: '#3D8BFF',
      route: '/appstore'
    }
  ]

  const compSummary = computed(() => ({
    total: installedComponentIcons.length,
    running: installedComponentIcons.length,
    upgradable: null as number | null
  }))

  function go(path: string) {
    router.push({ path: `/container/${path}`, query: { ...route.query } })
  }

  function openRecommendLink(item: { link?: string; route?: string }) {
    if (item.route) {
      router.push(item.route)
      return
    }
    if (item.link) {
      window.open(item.link, '_blank', 'noopener,noreferrer')
      return
    }
    go('helm')
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  }
</script>

<style scoped>
  .cluster-overview-tabs :deep(.el-tabs__header) {
    margin: 0 0 4px;
    flex-shrink: 0;
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
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .overview-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 16px;
    align-items: stretch;
  }

  .overview-main-left {
    min-width: 0;
  }

  .overview-main-right {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .installed-components-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
    border-radius: 8px;
  }

  .installed-components-card :deep(.el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 16px;
  }

  .installed-components__summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }

  .installed-components__stat-label {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .installed-components__stat-value {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .installed-components__icons {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 18px;
  }

  .installed-components__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    color: #fff;
    font-size: 18px;
  }

  .installed-components__recommend-title {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .installed-components__recommend-list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
  }

  .installed-components__recommend-item {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .installed-components__recommend-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    color: #fff;
    font-size: 16px;
  }

  .installed-components__recommend-main {
    flex: 1;
    min-width: 0;
  }

  .installed-components__recommend-head {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .installed-components__recommend-name {
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .installed-components__recommend-tag {
    flex-shrink: 0;
    padding: 0 6px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .installed-components__recommend-desc {
    margin-top: 2px;
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .installed-components__recommend-link {
    display: inline-flex;
    flex-shrink: 0;
    gap: 0;
    align-items: center;
    font-size: 12px;
  }

  @media (max-width: 1200px) {
    .overview-main-grid {
      grid-template-columns: 1fr;
    }

    .overview-main-right {
      min-height: 360px;
    }
  }

  .resource-card {
    border-radius: 8px;
    overflow: visible;
    height: 100%;
  }

  .resource-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: visible;
    padding-bottom: 12px;
  }

  .resource-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .resource-card__title {
    font-size: 12px;
    font-weight: 600;
  }

  .resource-card__body {
    display: flex;
    flex: 1;
    flex-direction: row;
    gap: 12px;
    align-items: center;
    overflow: visible;
  }

  .resource-card__chart {
    flex: 0 0 100px;
    width: 100px;
    margin-left: 8px;
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
    margin-bottom: 4px;
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
    margin-top: auto;
    padding-top: 4px;
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

  .usage-status-card {
    border-radius: 8px;
    border: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color);
  }

  .usage-status-card :deep(.el-card__body) {
    padding: 16px;
    padding-bottom: 5px;
  }

  .usage-status-card :deep(.el-row) {
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .usage-status-card :deep(.usage-overview-col) {
    padding-left: 0 !important;
    padding-right: 16px !important;
  }

  .usage-status-card :deep(.usage-overview-col + .usage-overview-col) {
    padding-left: 16px !important;
    padding-right: 0 !important;
  }

  .usage-empty-card :deep(.el-card__body) {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 156px;
    padding: 16px;
  }

  .usage-overview-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .usage-overview-head__sub {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .usage-overview-head :deep(.el-link__inner) {
    font-size: 12px;
  }

  .usage-col {
    padding: 4px 0 12px;
    border-radius: 8px;
  }

  .usage-col__title {
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .usage-col__value {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-top: 6px;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--el-text-color-primary);
  }

  .usage-col__trend {
    flex-shrink: 0;
    width: 18px;
    height: 20px;
    margin-left: 4px;
    overflow: visible;
  }

  .usage-col__trend.is-up {
    color: var(--el-color-danger);
  }

  .usage-col__trend.is-down {
    color: var(--el-color-success);
  }

  .usage-col__trend.is-flip {
    transform: scaleY(-1);
  }

  .usage-col__stats {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .usage-col__stats li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .usage-col__stats li + li {
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .usage-col__stats strong {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  /* CPU 子指标横排：三项一行，竖线分隔 */
  .usage-col__stats--row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 2px;
  }

  .usage-col__stats--row li {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-height: 24px;
    height: auto;
    padding: 0;
    position: relative;
  }

  .usage-col__stats--row li + li {
    border-top: none;
  }

  .usage-col__stats--row li span {
    margin-right: 4px;
  }

  .usage-col__stats--row strong {
    color: var(--el-text-color-regular);
  }

  .usage-col__stats--row li::after {
    content: '';
    display: block;
    align-self: center;
    width: 1px;
    height: 16px;
    margin: 0 10px;
    background: var(--el-border-color-lighter);
  }

  .usage-col__stats--row li:last-child::after {
    display: none;
  }

  /* 内存第二行子指标与第一行间距 */
  .usage-col__stats--row-sub {
    margin-top: 2px;
  }

  .usage-col__stats--row-sub li {
    min-height: 24px;
  }

  @media (max-width: 991.98px) {
    .usage-overview-col + .usage-overview-col {
      margin-top: 12px;
    }
  }

  .usage-empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 0;
  }

  .usage-empty-state__icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    font-size: 22px;
    color: var(--el-text-color-placeholder);
    background: var(--el-fill-color-light);
    border-radius: 50%;
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

  .proxy-header-left {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .proxy-expire-text {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
</style>
