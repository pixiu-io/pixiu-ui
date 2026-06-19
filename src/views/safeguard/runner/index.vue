<template>
  <div class="runner-page art-full-height">
    <ElTabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
      <ElTabPane label="Runner" name="runner">
        <div class="tab-content">
          <ElAlert
            type="info"
            :closable="false"
            show-icon
            class="quota-alert"
            style="margin: 5px 0 20px 0"
            description="管理执行部署任务的 Runner 环境"
          />
          <div
            class="runner-toolbar"
            style="
              margin-bottom: 10px;
              display: flex;
              align-items: center;
              justify-content: space-between;
            "
          >
            <ElButton @click="showRunnerDrawer" v-ripple>添加 Runner</ElButton>
            <div style="display: flex; align-items: center; gap: 8px">
              <ElInput
                v-model="runnerSearchForm.nameSelector"
                clearable
                placeholder="请输入 Runner 名称"
                style="width: 240px"
                @keyup.enter="handleRunnerSearch"
                @clear="resetRunnerSearchParams"
              />
              <ArtTableHeader v-model:columns="runnerColumnChecks" :loading="runnerLoading" @refresh="refreshRunnerData" />
            </div>
          </div>
          <ElCard class="art-table-card">
            <ArtTable
              row-key="id"
              :loading="runnerLoading"
              :data="runnerData"
              :columns="runnerColumns"
              :pagination="runnerPagination"
              :pagination-options="{
                align: 'right',
                hideOnEmpty: false,
                layout: 'total, prev, pager, next, sizes, jumper'
              }"
              @pagination:size-change="handleRunnerSizeChange"
              @pagination:current-change="handleRunnerCurrentChange"
            >
              <template #gmtCreate="{ row }">
                <span style="font-size: 12px">{{ row.gmtCreate || '-' }}</span>
              </template>
              <template #gmtModified="{ row }">
                <span style="font-size: 12px">{{ row.gmtModified || '-' }}</span>
              </template>
              <template #status="{ row }">
                <ElTag :type="RunnerStatusMap[row.status]?.type || 'info'">
                  {{ RunnerStatusMap[row.status]?.label || '未知' }}
                </ElTag>
              </template>
              <template #operation="{ row }">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:nowrap">
                  <ElLink
                    type="primary"
                    underline="never"
                    style="font-size:12px"
                    @click="editRunner(row)"
                  >
                    编辑
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    style="font-size:12px"
                    @click="deleteRunner(row)"
                  >
                    删除
                  </ElLink>
                </div>
              </template>
            </ArtTable>
          </ElCard>
        </div>
      </ElTabPane>

      <ElTabPane label="操作系统" name="distribution">
        <div class="tab-content">
          <ElAlert
            type="info"
            :closable="false"
            show-icon
            class="quota-alert"
            style="margin: 5px 0 20px 0"
            description="管理部署支持的操作系统发行版"
          />
          <div
            class="distribution-toolbar"
            style="
              margin-bottom: 10px;
              display: flex;
              align-items: center;
              justify-content: space-between;
            "
          >
            <ElButton @click="showDistributionDrawer" v-ripple>添加系统</ElButton>
            <div style="display: flex; align-items: center; gap: 8px">
              <ElInput
                v-model="distributionSearchForm.nameSelector"
                clearable
                placeholder="请输入操作系统名称"
                style="width: 240px"
                @keyup.enter="handleDistributionSearch"
                @clear="resetDistributionSearchParams"
              />
              <ArtTableHeader
                v-model:columns="distributionColumnChecks"
                :loading="distributionLoading"
                @refresh="refreshDistributionData"
              />
            </div>
          </div>
          <ElCard class="art-table-card">
            <ArtTable
              row-key="id"
              :loading="distributionLoading"
              :data="distributionData"
              :columns="distributionColumns"
              :pagination="distributionPagination"
              :pagination-options="{
                align: 'right',
                hideOnEmpty: false,
                layout: 'total, prev, pager, next, sizes, jumper'
              }"
              @pagination:size-change="handleDistributionSizeChange"
              @pagination:current-change="handleDistributionCurrentChange"
            >
              <template #family="{ row }">
                <div style="display:flex;align-items:center;gap:8px">
                  <ArtSvgIcon
                    :icon="osIcon(row.family)"
                    :style="{ fontSize: '18px', color: osBrandColors[row.family] || '#606266' }"
                  />
                  <span style="font-size: 13px">{{ row.family }}</span>
                </div>
              </template>
              <template #gmtCreate="{ row }">
                <span style="font-size: 12px">{{ row.gmtCreate || '-' }}</span>
              </template>
              <template #gmtModified="{ row }">
                <span style="font-size: 12px">{{ row.gmtModified || '-' }}</span>
              </template>
              <template #operation="{ row }">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:nowrap">
                  <ElLink
                    type="primary"
                    underline="never"
                    style="font-size:12px"
                    @click="editDistribution(row)"
                  >
                    编辑
                  </ElLink>
                  <ElLink
                    type="primary"
                    underline="never"
                    style="font-size:12px"
                    @click="deleteDistribution(row)"
                  >
                    删除
                  </ElLink>
                </div>
              </template>
            </ArtTable>
          </ElCard>
        </div>
      </ElTabPane>
    </ElTabs>

    <RunnerDrawer v-model="runnerDrawerVisible" :edit-id="runnerEditId" @success="refreshRunnerData" />
    <DistributionDrawer
      v-model="distributionDrawerVisible"
      :edit-id="distributionEditId"
      @success="refreshDistributionData"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { ElAlert, ElButton, ElInput, ElLink, ElMessage, ElMessageBox, ElTabPane, ElTabs, ElTag } from 'element-plus'
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

  const osIconMap: Record<string, string> = {
    centos: 'ri:centos-fill',
    ubuntu: 'simple-icons:ubuntu',
    debian: 'simple-icons:debian',
    openEuler: 'ri:openbase-fill',
    rocky: 'simple-icons:rockylinux'
  }

  const osBrandColors: Record<string, string> = {
    centos: '#932279',
    ubuntu: '#E95420',
    debian: '#A81D33',
    openEuler: '#0067C0',
    rocky: '#10B981'
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

  function handleTabChange(tab: RunnerTab) {
    if (tab === 'distribution' && !distributionLoaded.value) {
      distributionLoaded.value = true
      getDistributionData()
    }

    router.replace({
      path: route.path,
      query: tab === 'runner' ? {} : { tab }
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
        {
          prop: 'name',
          label: '名称',
          minWidth: 180
        },
        {
          prop: 'engineImage',
          label: '镜像',
          minWidth: 300
        },
        {
          prop: 'status',
          label: '状态',
          minWidth: 100,
          useSlot: true
        },
        {
          prop: 'description',
          label: '描述',
          minWidth: 200
        },
        {
          prop: 'gmtCreate',
          label: '创建时间',
          minWidth: 180,
          useSlot: true
        },
        {
          prop: 'gmtModified',
          label: '更新时间',
          minWidth: 180,
          useSlot: true
        },
        {
          prop: 'operation',
          label: '操作',
          minWidth: 90,
          fixed: 'right',
          useSlot: true
        }
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
        {
          prop: 'family',
          label: '系统家族',
          minWidth: 150,
          useSlot: true
        },
        {
          prop: 'name',
          label: '系统名称',
          minWidth: 180
        },
        {
          prop: 'runner',
          label: 'Runner',
          minWidth: 300
        },
        {
          prop: 'gmtCreate',
          label: '创建时间',
          minWidth: 180,
          useSlot: true
        },
        {
          prop: 'gmtModified',
          label: '更新时间',
          minWidth: 180,
          useSlot: true
        },
        {
          prop: 'operation',
          label: '操作',
          minWidth: 90,
          fixed: 'right',
          useSlot: true
        }
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
  .runner-page {
    padding: 0 16px;

    .tab-content {
      padding: 8px 0;
    }
  }
</style>
