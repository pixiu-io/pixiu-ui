<template>
  <div class="cluster-table-empty">{{ CLUSTER_TABLE_EMPTY_MESSAGE }}</div>
</template>

<script setup lang="ts">
  import { CLUSTER_TABLE_EMPTY_MESSAGE } from '../constants/table'

  defineOptions({ name: 'ClusterTableEmpty' })
</script>
