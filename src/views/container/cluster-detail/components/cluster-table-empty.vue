<template>
  <div class="cluster-table-empty">{{ CLUSTER_TABLE_EMPTY_MESSAGE }}</div>
</template>

<script setup lang="ts">
  import { CLUSTER_TABLE_EMPTY_MESSAGE } from '../constants/table'

  defineOptions({ name: 'ClusterTableEmpty' })
</script>

<style scoped>
  .cluster-table-empty {
    padding: 0 20px;
    line-height: 50px;
    font-size: 12px !important;
    color: var(--el-text-color-secondary);
    text-align: center;
  }
</style>
