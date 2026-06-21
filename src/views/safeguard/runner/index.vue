<template>
  <div class="runner-page art-full-height">
    <ElAlert
      type="info"
      :closable="false"
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      :description="tabDescription"
    />

    <div class="runner-toolbar-outer" v-if="activeTab === 'runner'">
      <ElButton v-ripple @click="showRunnerDrawer">添加 Runner</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <div class="runner-toolbar__filters">
          <ElInput
            v-model="runnerSearchForm.nameSelector"
            clearable
            placeholder="请输入 Runner 名称"
            class="runner-toolbar__search"
            @keyup.enter="handleRunnerSearch"
            @clear="resetRunnerSearchParams"
          />
          <div
            class="runner-toolbar-search-btn"
            role="button"
            tabindex="0"
            title="搜索"
            @click="handleRunnerSearch"
            @keyup.enter="handleRunnerSearch"
          >
            <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
          </div>
        </div>
        <ArtTableHeader v-model:columns="runnerColumnChecks" :loading="runnerLoading" @refresh="refreshRunnerData" />
      </div>
    </div>
    <div class="runner-toolbar-outer" v-else>
      <ElButton v-ripple @click="showDistributionDrawer">添加系统</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <div class="runner-toolbar__filters">
          <ElInput
            v-model="distributionSearchForm.nameSelector"
            clearable
            placeholder="请输入操作系统名称"
            class="runner-toolbar__search"
            @keyup.enter="handleDistributionSearch"
            @clear="resetDistributionSearchParams"
          />
          <div
            class="runner-toolbar-search-btn"
            role="button"
            tabindex="0"
            title="搜索"
            @click="handleDistributionSearch"
            @keyup.enter="handleDistributionSearch"
          >
            <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
          </div>
        </div>
        <ArtTableHeader v-model:columns="distributionColumnChecks" :loading="distributionLoading" @refresh="refreshDistributionData" />
      </div>
    </div>

    <ElCard class="art-table-card">
      <ElTabs v-model="activeTab" class="runner-tabs" @tab-change="handleTabChange">
        <ElTabPane label="Runner" name="runner">
          <ArtTable
            row-key="id"
            :loading="runnerLoading"
            :data="runnerData"
            :columns="runnerColumns"
            :pagination="runnerPagination"
            :pagination-options="tablePaginationOptions"
            @pagination:size-change="handleRunnerSizeChange"
            @pagination:current-change="handleRunnerCurrentChange"
          >
            <template #gmtCreate="{ row }">
              <span class="runner-table-time">{{ row.gmtCreate || '-' }}</span>
            </template>
            <template #status="{ row }">
              <ElTag :type="RunnerStatusMap[row.status]?.type || 'info'">
                {{ RunnerStatusMap[row.status]?.label || '未知' }}
              </ElTag>
            </template>
            <template #operation="{ row }">
              <div class="runner-table-actions">
                <ElLink type="primary" underline="never" @click="editRunner(row)">编辑</ElLink>
                <ElLink type="primary" underline="never" @click="deleteRunner(row)">删除</ElLink>
              </div>
            </template>
          </ArtTable>
        </ElTabPane>

        <ElTabPane label="支持系统" name="distribution">
          <ArtTable
            row-key="id"
            :loading="distributionLoading"
            :data="distributionData"
            :columns="distributionColumns"
            :pagination="distributionPagination"
            :pagination-options="tablePaginationOptions"
            @pagination:size-change="handleDistributionSizeChange"
            @pagination:current-change="handleDistributionCurrentChange"
          >
            <template #family="{ row }">
              <div class="runner-os-family">
                <ArtSvgIcon
                  :icon="osIcon(row.family)"
                  class="os-icon"
                  :style="{ color: osBrandColors[row.family] }"
                />
                <span class="os-name">{{ row.family }}</span>
              </div>
            </template>
            <template #gmtCreate="{ row }">
              <span class="runner-table-time">{{ row.gmtCreate || '-' }}</span>
            </template>
            <template #gmtModified="{ row }">
              <span class="runner-table-time">{{ row.gmtModified || '-' }}</span>
            </template>
            <template #operation="{ row }">
              <div class="runner-table-actions">
                <ElLink type="primary" underline="never" @click="editDistribution(row)">编辑</ElLink>
                <ElLink type="primary" underline="never" @click="deleteDistribution(row)">删除</ElLink>
              </div>
            </template>
          </ArtTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <RunnerDrawer v-model="runnerDrawerVisible" :edit-id="runnerEditId" @success="refreshRunnerData" />
    <DistributionDrawer
      v-model="distributionDrawerVisible"
      :edit-id="distributionEditId"
      @success="refreshDistributionData"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import {
    ElAlert,
    ElButton,
    ElCard,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElTabPane,
    ElTabs,
    ElTag
  } from 'element-plus'
  import {
    fetchGetRunnerList,
    fetchDeleteRunner,
    type RunnerItem,
    RunnerStatusMap
  } from '@/api/runner'
  import {
    fetchGetDistributionList,
    fetchDeleteDistribution,
    type DistributionItem
  } from '@/api/distribution'
  import { PixiuApiError } from '@/api/container'
  import RunnerDrawer from './modules/runner-drawer.vue'
  import DistributionDrawer from '../distribution/modules/distribution-drawer.vue'

  defineOptions({ name: 'RunnerManage' })

  type RunnerTab = 'runner' | 'distribution'

  const route = useRoute()
  const router = useRouter()
  const activeTab = ref<RunnerTab>('runner')
  const distributionLoaded = ref(false)

  const tablePaginationOptions = {
    align: 'right' as const,
    hideOnEmpty: false,
    layout: 'total, prev, pager, next, sizes, jumper'
  }

  const tabDescription = computed(() =>
    activeTab.value === 'distribution'
      ? '管理部署支持的操作系统发行版，并为每种系统配置对应的 Runner 镜像。'
      : '管理执行部署任务的 Runner 环境，支持创建、编辑与删除 Runner 实例。'
  )

  const osIconMap: Record<string, string> = {
    CentOS: 'ri:centos-fill',
    Ubuntu: 'simple-icons:ubuntu',
    Debian: 'simple-icons:debian',
    openEuler: 'ri:openbase-fill',
    RockyLinux: 'simple-icons:rockylinux'
  }

  const osBrandColors: Record<string, string> = {
    CentOS: '#932279',
    Ubuntu: '#E95420',
    Debian: '#A81D33',
    openEuler: '#0067C0',
    RockyLinux: '#10B981'
  }

  function osIcon(os: string) {
    return osIconMap[os] ?? 'ri:ubuntu-line'
  }

  function resolveTab(tab: unknown): RunnerTab {
    return tab === 'distribution' ? 'distribution' : 'runner'
  }

  function syncTabFromRoute() {
    activeTab.value = resolveTab(route.query.tab)
  }

  function handleTabChange(tab: string | number) {
    const nextTab = resolveTab(tab)
    if (nextTab === 'distribution' && !distributionLoaded.value) {
      distributionLoaded.value = true
      getDistributionData()
    }

    router.replace({
      path: route.path,
      query: nextTab === 'runner' ? {} : { tab: nextTab }
    })
  }

  watch(
    () => route.query.tab,
    () => {
      const tab = resolveTab(route.query.tab)
      if (activeTab.value === tab) return
      activeTab.value = tab
      if (tab === 'distribution' && !distributionLoaded.value) {
        distributionLoaded.value = true
        getDistributionData()
      }
    }
  )

  syncTabFromRoute()

  const runnerSearchForm = ref({ nameSelector: undefined as string | undefined })
  const runnerDrawerVisible = ref(false)
  const runnerEditId = ref<number | undefined>(undefined)

  const {
    columns: runnerColumns,
    columnChecks: runnerColumnChecks,
    data: runnerData,
    loading: runnerLoading,
    pagination: runnerPagination,
    getData: getRunnerData,
    replaceSearchParams: replaceRunnerSearchParams,
    resetSearchParams: resetRunnerSearchParams,
    handleSizeChange: handleRunnerSizeChange,
    handleCurrentChange: handleRunnerCurrentChange,
    refreshData: refreshRunnerData
  } = useTable({
    core: {
      apiFn: async (params: { current: number; size: number; nameSelector?: string }) => {
        return await fetchGetRunnerList({
          current: params.current,
          size: params.size,
          nameSelector: params.nameSelector
        })
      },
      apiParams: {
        current: 1,
        size: 10,
        ...runnerSearchForm.value
      },
      columnsFactory: () => [
        { prop: 'name', label: '名称', minWidth: 180 },
        { prop: 'status', label: '状态', minWidth: 100, useSlot: true },
        { prop: 'engineImage', label: '镜像', minWidth: 300 },
        { prop: 'description', label: '描述', minWidth: 200 },
        { prop: 'gmtCreate', label: '创建时间', minWidth: 180, useSlot: true },
        { prop: 'operation', label: '操作', minWidth: 90, fixed: 'right', useSlot: true }
      ]
    }
  })

  const handleRunnerSearch = () => {
    replaceRunnerSearchParams({ nameSelector: runnerSearchForm.value.nameSelector })
    getRunnerData()
  }

  function showRunnerDrawer() {
    runnerEditId.value = undefined
    runnerDrawerVisible.value = true
  }

  function editRunner(row: RunnerItem) {
    runnerEditId.value = row.id
    runnerDrawerVisible.value = true
  }

  async function deleteRunner(row: RunnerItem) {
    try {
      await ElMessageBox.confirm(`确定要删除 Runner ${row.name} 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await fetchDeleteRunner(row.id)
      ElMessage.success('删除成功')
      refreshRunnerData()
    } catch (error) {
      if (error !== 'cancel' && (!(error instanceof PixiuApiError) || !error.notified)) {
        ElMessage.error(error instanceof Error ? error.message : '删除失败')
      }
    }
  }

  const distributionSearchForm = ref({ nameSelector: undefined as string | undefined })
  const distributionDrawerVisible = ref(false)
  const distributionEditId = ref<number | undefined>(undefined)

  const {
    columns: distributionColumns,
    columnChecks: distributionColumnChecks,
    data: distributionData,
    loading: distributionLoading,
    pagination: distributionPagination,
    getData: getDistributionData,
    replaceSearchParams: replaceDistributionSearchParams,
    resetSearchParams: resetDistributionSearchParams,
    handleSizeChange: handleDistributionSizeChange,
    handleCurrentChange: handleDistributionCurrentChange,
    refreshData: refreshDistributionData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: { current: number; size: number; nameSelector?: string }) => {
        return await fetchGetDistributionList({
          current: params.current,
          size: params.size,
          nameSelector: params.nameSelector
        })
      },
      apiParams: {
        current: 1,
        size: 10,
        ...distributionSearchForm.value
      },
      columnsFactory: () => [
        { prop: 'family', label: '系统家族', minWidth: 150, useSlot: true },
        { prop: 'name', label: '系统名称', minWidth: 180 },
        { prop: 'runner', label: 'Runner', minWidth: 300 },
        { prop: 'gmtCreate', label: '创建时间', minWidth: 180, useSlot: true },
        { prop: 'gmtModified', label: '更新时间', minWidth: 180, useSlot: true },
        { prop: 'operation', label: '操作', minWidth: 90, fixed: 'right', useSlot: true }
      ]
    }
  })

  if (activeTab.value === 'distribution') {
    distributionLoaded.value = true
    getDistributionData()
  }

  const handleDistributionSearch = () => {
    replaceDistributionSearchParams({ nameSelector: distributionSearchForm.value.nameSelector })
    getDistributionData()
  }

  function showDistributionDrawer() {
    distributionEditId.value = undefined
    distributionDrawerVisible.value = true
  }

  function editDistribution(row: DistributionItem) {
    distributionEditId.value = row.id
    distributionDrawerVisible.value = true
  }

  async function deleteDistribution(row: DistributionItem) {
    try {
      await ElMessageBox.confirm(`确定要删除操作系统 ${row.name} 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await fetchDeleteDistribution(row.id)
      ElMessage.success('删除成功')
      refreshDistributionData()
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(error instanceof Error ? error.message : '删除失败')
      }
    }
  }
</script>

<style scoped lang="less">
  .runner-page :deep(.art-table-card > .el-card__body) {
    padding-top: 8px;
  }

  .runner-page :deep(.el-table th),
  .runner-page :deep(.el-table td) {
    font-size: 12px;
  }

  .runner-toolbar-outer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .runner-tabs :deep(.el-tabs__header) {
    margin: 0 0 4px;
  }

  .runner-tabs :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }

  .runner-tabs :deep(.el-tabs__item) {
    height: 40px;
    line-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .runner-tabs :deep(.el-tabs__item.is-active) {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .runner-tabs :deep(.el-tabs__active-bar) {
    height: 2px;
    border-radius: 2px 2px 0 0;
  }

  .runner-tabs :deep(.el-tabs__content) {
    padding-top: 0;
  }

  .runner-table-header {
    margin-top: 12px;
    margin-bottom: 4px;
  }

  .runner-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .runner-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .runner-toolbar__search {
    width: 280px;
    max-width: 100%;
  }

  .runner-toolbar-search-btn {
    flex-shrink: 0;
    display: flex;
    width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 6px;
    background: color-mix(in srgb, var(--art-gray-300) 55%, transparent);
    color: var(--el-text-color-secondary);
    transition: background-color 0.15s ease;
  }

  .runner-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .runner-toolbar-search-btn:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }

  .runner-table-time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .runner-table-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: nowrap;
    font-size: 12px;

    :deep(.el-link) {
      font-size: 12px;
    }
  }

  .runner-os-family {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .os-icon {
    font-size: 18px;
  }

  .os-name {
    font-weight: 400;
    color: var(--el-text-color-primary);
  }
</style>
