<!-- 集群概览：资源概览、用量曲线、组件摘要（Mock） -->
<template>
  <div class="cluster-overview">
    <ElTabs v-model="innerTab" class="cluster-overview-tabs">
      <ElTabPane label="概览" name="main">
        <section class="section-title">资源概览</section>
        <ElRow :gutter="16">
          <ElCol :xs="24" :lg="12">
            <ElCard shadow="never" class="resource-card">
              <div class="resource-card__head">
                <span class="resource-card__title">节点</span>
                <ElLink type="primary" underline="never" @click="go('nodes')">查看节点列表</ElLink>
              </div>
              <div class="resource-card__body">
                <div class="resource-card__chart">
                  <ArtRingChart
                    height="180px"
                    :data="nodeRingData"
                    :radius="['52%', '72%']"
                    center-text="总数"
                    :show-label="true"
                  />
                </div>
                <ul class="resource-card__stats">
                  <li v-for="n in nodeStats" :key="n.label">
                    <span class="dot" :style="{ background: n.color }" />
                    <span>{{ n.label }}</span>
                    <strong>{{ n.value }}</strong>
                  </li>
                </ul>
              </div>
              <div class="resource-card__foot">
                <ElButton text type="primary" size="small" @click="go('nodes')">创建节点</ElButton>
              </div>
            </ElCard>
          </ElCol>
          <ElCol :xs="24" :lg="12">
            <ElCard shadow="never" class="resource-card">
              <div class="resource-card__head">
                <span class="resource-card__title">工作负载</span>
                <ElLink type="primary" underline="never" @click="go('workloads')">查看列表</ElLink>
              </div>
              <div class="resource-card__body">
                <div class="resource-card__chart">
                  <ArtRingChart
                    height="180px"
                    :data="wlRingData"
                    :radius="['52%', '72%']"
                    center-text="实例"
                    :show-label="true"
                  />
                </div>
                <ul class="resource-card__stats">
                  <li v-for="w in wlStats" :key="w.label">
                    <span class="dot" :style="{ background: w.color }" />
                    <span>{{ w.label }}</span>
                    <strong>{{ w.value }}</strong>
                  </li>
                </ul>
              </div>
              <div class="resource-card__foot">
                <ElButton text type="primary" size="small" @click="go('workloads')">创建工作负载</ElButton>
              </div>
            </ElCard>
          </ElCol>
        </ElRow>

        <section class="section-title mt-6">用量概览（近 24 小时）</section>
        <ElRow :gutter="16">
          <ElCol :xs="24" :md="12">
            <ElCard shadow="never" class="chart-card">
              <template #header>
                <span class="chart-card__title">CPU 利用率</span>
              </template>
              <ArtLineChart
                height="220px"
                :data="cpuSeries"
                :x-axis-data="hourLabels"
                :show-area-color="true"
                :show-legend="false"
              />
            </ElCard>
          </ElCol>
          <ElCol :xs="24" :md="12">
            <ElCard shadow="never" class="chart-card">
              <template #header>
                <span class="chart-card__title">内存利用率</span>
              </template>
              <ArtLineChart
                height="220px"
                :data="memSeries"
                :x-axis-data="hourLabels"
                :show-area-color="true"
                :show-legend="false"
              />
            </ElCard>
          </ElCol>
        </ElRow>

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
        <ElCard shadow="never" class="mt-2">
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem label="集群名称">{{ ctx.aliasName }}</ElDescriptionsItem>
            <ElDescriptionsItem label="集群标识">{{ ctx.name }}</ElDescriptionsItem>
            <ElDescriptionsItem label="Kubernetes 版本">{{ ctx.version }}</ElDescriptionsItem>
            <ElDescriptionsItem label="节点数">{{ ctx.nodeCount || '-' }}</ElDescriptionsItem>
          </ElDescriptions>
        </ElCard>
        <ElCard shadow="never" class="art-table-card mt-4">
          <template #header>
            <span class="card-title">节点列表</span>
          </template>
          <ElTable :data="nodeRows" stripe>
            <ElTableColumn prop="name" label="节点名称" min-width="200" />
            <ElTableColumn prop="role" label="角色" width="100">
              <template #default="{ row }">
                <ElTag :type="row.role === 'Master' ? 'primary' : 'info'" size="small">
                  {{ row.role }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="status" label="状态" width="100">
              <template #default="{ row }">
                <ElTag :type="row.status === 'Ready' ? 'success' : 'danger'" size="small">
                  {{ row.status }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="ip" label="IP 地址" width="130" />
            <ElTableColumn prop="cpu" label="CPU（核）" width="100" />
            <ElTableColumn prop="memory" label="内存（GB）" width="110" />
          </ElTable>
        </ElCard>
      </ElTabPane>

      <ElTabPane label="API Server" name="api">
        <ElCard shadow="never" class="mt-2">
          <ElDescriptions :column="1" border>
            <ElDescriptionsItem label="访问地址">https://{{ ctx.name }}.apiserver.pixiu.local:6443</ElDescriptionsItem>
            <ElDescriptionsItem label="证书认证">已启用</ElDescriptionsItem>
            <ElDescriptionsItem label="备注">以下为演示数据，实际以集群接入配置为准。</ElDescriptionsItem>
          </ElDescriptions>
        </ElCard>
      </ElTabPane>

      <ElTabPane label="监控" name="monitor">
        <ElRow :gutter="16" class="mt-2">
          <ElCol :span="12">
            <ElCard shadow="never">
              <template #header>API 请求 QPS（Mock）</template>
              <ArtLineChart height="200px" :data="qpsSeries" :x-axis-data="hourLabels" />
            </ElCard>
          </ElCol>
          <ElCol :span="12">
            <ElCard shadow="never">
              <template #header>etcd 延迟 ms（Mock）</template>
              <ArtLineChart height="200px" :data="etcdSeries" :x-axis-data="hourLabels" />
            </ElCard>
          </ElCol>
        </ElRow>
      </ElTabPane>
    </ElTabs>
  </div>
</template>

<script setup lang="ts">
  import { inject, computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import { clusterDetailContextKey } from './context'

  defineOptions({ name: 'ClusterDetailOverview' })

  const router = useRouter()
  const route = useRoute()
  const ctxRef = inject(clusterDetailContextKey)
  const ctx = computed(() => ctxRef!.value)

  const innerTab = ref('main')

  const OVERVIEW_TAB_NAMES = new Set(['main', 'basic', 'api', 'monitor'])

  watch(
    () => route.query.overviewTab,
    (raw) => {
      const t = Array.isArray(raw) ? raw[0] : raw
      innerTab.value = typeof t === 'string' && OVERVIEW_TAB_NAMES.has(t) ? t : 'main'
    },
    { immediate: true }
  )

  const seed = computed(() => ctx.value.seed)

  const nodeRingData = computed(() => [
    { name: '原生节点', value: 3 + (seed.value % 3) },
    { name: '超级节点', value: 1 },
    { name: '普通节点', value: 2 },
    { name: '已注册', value: seed.value % 2 }
  ])

  const nodeStats = computed(() => [
    { label: '原生节点', value: nodeRingData.value[0].value, color: 'var(--el-color-primary)' },
    { label: '超级节点', value: nodeRingData.value[1].value, color: 'var(--el-color-success)' },
    { label: '普通节点', value: nodeRingData.value[2].value, color: 'var(--el-color-warning)' },
    { label: '已注册', value: nodeRingData.value[3].value, color: 'var(--el-text-color-secondary)' }
  ])

  const wlRingData = computed(() => [
    { name: 'Deployment', value: 12 + (seed.value % 5) },
    { name: 'StatefulSet', value: 4 },
    { name: 'DaemonSet', value: 3 },
    { name: 'Job', value: 2 }
  ])

  const wlStats = computed(() =>
    wlRingData.value.map((x, i) => ({
      label: x.name,
      value: x.value,
      color: ['var(--el-color-primary)', 'var(--el-color-success)', 'var(--el-color-warning)', 'var(--el-color-info)'][i]
    }))
  )

  const hourLabels = computed(() =>
    Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
  )

  function wave(seed: number, len: number) {
    return Array.from({ length: len }, (_, i) => {
      const t = (i / len) * Math.PI * 2
      return Math.round(35 + seed * 3 + Math.sin(t + seed) * 12 + (i % 5))
    })
  }

  const cpuSeries = computed(() => wave(seed.value, 24))
  const memSeries = computed(() => wave(seed.value + 2, 24))
  const qpsSeries = computed(() => wave(seed.value + 1, 24).map((n) => n * 8))
  const etcdSeries = computed(() => wave(seed.value + 3, 24).map((n) => n / 10))

  const compSummary = computed(() => ({
    total: 18 + (seed.value % 7),
    running: 16 + (seed.value % 5),
    upgradable: 2
  }))

  const nodeRows = computed(() => {
    const n =
      ctx.value.nodeCount > 0 ? ctx.value.nodeCount : Math.max(1, (seed.value % 4) + 1)
    return Array.from({ length: n }, (_, i) => ({
      name: `node-${String(i + 1).padStart(2, '0')}.${ctx.value.aliasName}`,
      role: i === 0 ? 'Master' : 'Worker',
      status: i === 1 && ctx.value.status === 4 ? 'NotReady' : 'Ready',
      ip: `192.168.${seed.value % 200}.${10 + i}`,
      cpu: [4, 8, 16][i % 3],
      memory: [8, 16, 32][i % 3]
    }))
  })

  function go(path: string) {
    router.push({ path: `/container/${path}`, query: { ...route.query } })
  }
</script>

<style scoped>
  .cluster-overview-tabs :deep(.el-tabs__header) {
    margin-bottom: 16px;
  }

  .section-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .resource-card {
    border-radius: 8px;
  }

  .resource-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .resource-card__title {
    font-size: 15px;
    font-weight: 600;
  }

  .resource-card__body {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .resource-card__chart {
    flex: 0 0 200px;
    max-width: 100%;
  }

  .resource-card__stats {
    flex: 1;
    min-width: 160px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .resource-card__stats li {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .resource-card__stats strong {
    margin-left: auto;
    color: var(--el-text-color-primary);
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
</style>
