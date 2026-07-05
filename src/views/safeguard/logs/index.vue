<template>
  <div class="monitor-logs-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      description="查询集群业务日志，支持 Loki 与 Elasticsearch 数据源。"
      @close="alertVisible = false"
    />
    <section
      v-if="!selectedClusterName || !hasConfiguredDatasource"
      class="monitor-logs-header"
      :style="{ marginTop: alertVisible ? '0' : '10px', marginBottom: '10px' }"
    >
      <div class="monitor-logs-header__cluster">
        <span class="monitor-logs-header__cluster-label">集群选择</span>
        <ElSelect
          v-model="selectedClusterName"
          filterable
          :filter-method="filterCluster"
          clearable
          placeholder="请选择集群"
          class="monitor-logs-header__cluster-select"
          :loading="clusterLoading"
        >
          <ElOption
            v-for="item in filteredClusterOptions"
            :key="item.name"
            :label="formatClusterLabel(item)"
            :value="item.name"
          />
        </ElSelect>
      </div>
    </section>

    <ClusterDetailLogs
      v-if="selectedClusterName"
      :key="selectedClusterName"
      compact-placeholder
      @datasource-state-change="hasConfiguredDatasource = $event"
    >
      <template #before-datasource>
        <div class="monitor-logs-header__cluster monitor-logs-header__cluster--embedded">
          <span class="monitor-logs-header__cluster-label">集群选择</span>
          <ElSelect
            v-model="selectedClusterName"
            filterable
            :filter-method="filterCluster"
            clearable
            placeholder="请选择集群"
            class="monitor-logs-header__cluster-select"
            :loading="clusterLoading"
          >
            <ElOption
              v-for="item in filteredClusterOptions"
              :key="item.name"
              :label="formatClusterLabel(item)"
              :value="item.name"
            />
          </ElSelect>
        </div>
      </template>
    </ClusterDetailLogs>
    <ElEmpty v-else description="请选择集群后开始查询日志" class="monitor-logs-empty" />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, provide, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElAlert } from 'element-plus'
  import { fetchClusterList, type ClusterItem } from '@/api/container'
  import ClusterDetailLogs from '@/views/container/cluster-detail/logs.vue'
  import {
    clusterDetailContextKey,
    clusterNameSeed,
    type ClusterDetailContext
  } from '@/views/container/cluster-detail/context'

  defineOptions({ name: 'MonitorLogs' })

  const alertVisible = ref(true)

  const route = useRoute()
  const router = useRouter()

  const clusterLoading = ref(false)
  const clusterOptions = ref<ClusterItem[]>([])
  const filteredClusterOptions = ref<ClusterItem[]>([])
  const selectedClusterName = ref('')
  const hasConfiguredDatasource = ref(false)

  const ctx = computed<ClusterDetailContext>(() => {
    const name = selectedClusterName.value
    const row = clusterOptions.value.find((item) => item.name === name)
    return {
      name,
      aliasName: row?.aliasName ?? name,
      id: row?.id ?? 0,
      resourceVersion: row?.resourceVersion ?? 0,
      status: row?.status ?? 0,
      version: row?.version ?? '-',
      clusterType: row?.clusterType ?? 0,
      planId: row?.planId ?? 0,
      isProtected: row?.isProtected ?? false,
      createTime: row?.createTime ?? '-',
      nodeCount: row?.nodeCount ?? 0,
      nodeReady: row?.nodeReady ?? 0,
      nodeNotReady: row?.nodeNotReady ?? 0,
      permissionId: row?.permissionId ?? 0,
      seed: clusterNameSeed(name)
    }
  })

  provide(clusterDetailContextKey, ctx)

  function formatClusterLabel(item: ClusterItem) {
    return item.aliasName && item.aliasName !== item.name
      ? item.aliasName
      : item.name
  }

  function filterCluster(query: string) {
    if (query) {
      const lowerQuery = query.toLowerCase()
      filteredClusterOptions.value = clusterOptions.value.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          (item.aliasName && item.aliasName.toLowerCase().includes(lowerQuery))
      )
    } else {
      filteredClusterOptions.value = clusterOptions.value
    }
  }

  async function loadClusters() {
    clusterLoading.value = true
    try {
      const limit = 200
      const acc: ClusterItem[] = []
      let page = 1
      let total = Number.POSITIVE_INFINITY
      while (acc.length < total) {
        const res = await fetchClusterList({ page, limit })
        acc.push(...res.items)
        total = res.total ?? acc.length
        if (!res.items.length) break
        page += 1
      }
      clusterOptions.value = acc
      filteredClusterOptions.value = acc
    } finally {
      clusterLoading.value = false
    }
  }

  function syncClusterQuery(name: string) {
    const nextQuery = { ...route.query }
    if (name) nextQuery.cluster = name
    else delete nextQuery.cluster
    router.replace({ query: nextQuery })
  }

  watch(selectedClusterName, (name) => {
    syncClusterQuery(name)
  })

  onMounted(async () => {
    await loadClusters()
    const fromQuery = String(route.query.cluster ?? '')
    if (fromQuery && clusterOptions.value.some((item) => item.name === fromQuery)) {
      selectedClusterName.value = fromQuery
      return
    }
    if (clusterOptions.value.length > 0) {
      selectedClusterName.value = clusterOptions.value[0].name
    }
  })
</script>

<style scoped>
  .monitor-logs-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .monitor-logs-header {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 0;
  }

  .monitor-logs-header__cluster {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }

  .monitor-logs-header__cluster--embedded {
    margin-right: 6px;
  }

  .monitor-logs-header__cluster-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .monitor-logs-header__cluster-select {
    width: 280px;
    max-width: 100%;
  }

  .monitor-logs-empty {
    flex: none;
    min-height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
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
