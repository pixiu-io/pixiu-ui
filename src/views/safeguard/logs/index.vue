<template>
  <div class="monitor-logs-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      description="查询外部数据源日志，支持 Loki 与 Elasticsearch 数据源。"
      @close="alertVisible = false"
    />
    <ClusterDetailLogs
      key="external-logs"
      compact-placeholder
      external-only
      @datasource-state-change="hasConfiguredDatasource = $event"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElAlert } from 'element-plus'
  import ClusterDetailLogs from '@/views/container/cluster-detail/logs.vue'

  defineOptions({ name: 'MonitorLogs' })

  const alertVisible = ref(true)
  const hasConfiguredDatasource = ref(false)
</script>

<style scoped>
  .monitor-logs-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .monitor-logs-page :deep(.logs-console:not(.logs-console--placeholder)) {
    flex: 1;
    min-height: 0;
    height: 100%;
    max-height: 100%;
  }

  .quota-alert {
    flex-shrink: 0;
  }
</style>
