<!-- Pixiu 平台工作台 -->
<template>
  <WorkbenchOverview
    :loading="loading"
    :trend-loading="trendLoading"
    :trend-range-days="trendRangeDays"
    :summary="summary"
    :resource-summary="resourceSummary"
    :last-updated-at="lastUpdatedAt"
    :cluster-rows="clusterRows"
    :risk-rows="riskRows"
    :alert-feed="alertFeed"
    :event-feed="eventFeed"
    :cpu-trend-labels="cpuTrendLabels"
    :cpu-trend-values="cpuTrendValues"
    :memory-trend-labels="memoryTrendLabels"
    :memory-trend-values="memoryTrendValues"
    :network-trend-labels="networkTrendLabels"
    :network-trend-values="networkTrendValues"
    :network-tx-trend-values="networkTxTrendValues"
    :network-rx-trend-values="networkRxTrendValues"
    :disk-trend-values="diskTrendValues"
    @update:trend-range-days="setTrendRange"
  />
</template>

<script setup lang="ts">
  import { onMounted } from 'vue'
  import WorkbenchOverview from './modules/workbench-overview.vue'
  import { useWorkbenchPage } from './useWorkbenchPage'

  defineOptions({ name: 'Console' })

  const {
    loading,
    trendLoading,
    trendRangeDays,
    clusterRows,
    summary,
    resourceSummary,
    lastUpdatedAt,
    riskRows,
    alertFeed,
    eventFeed,
    cpuTrendLabels,
    cpuTrendValues,
    memoryTrendLabels,
    memoryTrendValues,
    networkTrendLabels,
    networkTrendValues,
    networkTxTrendValues,
    networkRxTrendValues,
    diskTrendValues,
    load,
    setTrendRange
  } = useWorkbenchPage()

  onMounted(() => {
    void load()
  })
</script>