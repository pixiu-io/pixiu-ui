<template>
  <ElCard shadow="never">
    <template #header>
      <span class="page-hd">Prometheus 监控</span>
    </template>
    <div class="prometheus-placeholder">
      <ElEmpty description="开发中，敬请期待" />
    </div>
  </ElCard>
</template>

<script setup lang="ts">
  defineOptions({ name: 'ClusterDetailPrometheus' })
</script>

<style scoped>
  .page-hd {
    font-size: 15px;
    font-weight: 600;
  }

  .prometheus-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 320px;
  }
</style>
