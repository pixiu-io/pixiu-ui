<!-- 数据源管理页面 -->
<template>
  <div class="datasource-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      description="管理日志和告警数据源，支持 Loki、Elasticsearch、Prometheus 等类型。"
      @close="alertVisible = false"
    />
    <div
      class="datasource-toolbar"
      :style="{
        marginTop: alertVisible ? '0' : '10px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }"
    >
      <ElButton @click="showDrawer" v-ripple>添加数据源</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.nameSelector"
          clearable
          placeholder="请输入数据源名称"
          style="width: 240px"
          @keyup.enter="handleSearch"
          @clear="resetSearchParams"
        />
        <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />
      </div>
    </div>
    <ElCard class="art-table-card">
      <ArtTable
        row-key="id"
        :show-table-header="false"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="tablePaginationOptions"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <DatasourceDrawer v-model="drawerVisible" :edit-id="editId" @success="refreshData" />
  </div>
</template>

<script setup lang="ts">
  import { h, ref } from 'vue'
  import { useTable } from '@/hooks/core/useTable'
  import { ElAlert, ElButton, ElInput, ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import {
    fetchGetDatasourceList,
    fetchDeleteDatasource,
    resolveDatasourceUrl,
    type DatasourceItem,
    DatasourceTypeMap,
    DatasourceSubTypeMap
  } from '@/api/datasource'
  import { PixiuApiError, fetchClusterList } from '@/api/container'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import DatasourceDrawer from './modules/datasource-drawer.vue'

  defineOptions({ name: 'DatasourceManage' })

  const subTypeIconMap: Record<string, { icon: string; color: string }> = {
    loki: { icon: 'simple-icons:grafana', color: '#F46800' },
    es: { icon: 'simple-icons:elasticsearch', color: '#005571' },
    prometheus: { icon: 'simple-icons:prometheus', color: '#E6522C' }
  }

  function getSubTypeIcon(subType: string) {
    return subTypeIconMap[subType] ?? { icon: 'ri:database-2-line', color: '#606266' }
  }

  const clusterAliasMap = ref<Record<string, string>>({})
  let clusterAliasLoadPromise: Promise<void> | null = null

  function getClusterAlias(clusterName: string): string {
    if (!clusterName) return '-'
    return clusterAliasMap.value[clusterName] || clusterName
  }

  async function loadClusterAliasMap() {
    if (clusterAliasLoadPromise) return clusterAliasLoadPromise
    clusterAliasLoadPromise = (async () => {
      try {
        const limit = 500
        let page = 1
        const map: Record<string, string> = {}
        let total = 0
        do {
          const { items, total: t } = await fetchClusterList({ page, limit })
          total = t
          for (const cluster of items) {
            map[cluster.name] = cluster.aliasName || cluster.name
          }
          page++
        } while ((page - 1) * limit < total)
        clusterAliasMap.value = map
      } catch {
        // 集群列表加载失败时静默处理
      }
    })()
    return clusterAliasLoadPromise
  }

  const searchForm = ref({ nameSelector: undefined as string | undefined })
  const drawerVisible = ref(false)
  const editId = ref<number | undefined>(undefined)
  const alertVisible = ref(true)

  const tablePaginationOptions = {
    align: 'right' as const,
    hideOnEmpty: false
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: async (params: { current: number; size: number; nameSelector?: string }) => {
        await loadClusterAliasMap()
        return await fetchGetDatasourceList({
          current: params.current,
          size: params.size,
          nameSelector: params.nameSelector
        })
      },
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 280,
          formatter: (row: DatasourceItem) => {
            const iconMeta = getSubTypeIcon(row.subType)
            const subTypeLabel = DatasourceSubTypeMap[row.subType] || row.subType
            const displayUrl = resolveDatasourceUrl(row)
            const titleChildren = [
              h('span', { class: 'datasource-name-cell__title-text' }, row.name)
            ]
            if (row.isDefault) {
              titleChildren.push(
                h(
                  ElTag,
                  {
                    type: 'primary',
                    size: 'small',
                    effect: 'light',
                    class: 'datasource-name-cell__default-tag'
                  },
                  () => 'default'
                )
              )
            }
            return h('div', { class: 'datasource-name-cell' }, [
              h('div', { class: 'datasource-name-cell__logo' }, [
                h(ArtSvgIcon, {
                  icon: iconMeta.icon,
                  class: 'datasource-name-cell__logo-icon',
                  style: { color: iconMeta.color }
                })
              ]),
              h('div', { class: 'datasource-name-cell__info' }, [
                h('div', { class: 'datasource-name-cell__title' }, titleChildren),
                h('div', { class: 'datasource-name-cell__meta' }, [
                  h('span', { class: 'datasource-name-cell__type' }, subTypeLabel),
                  h('span', { class: 'datasource-name-cell__sep' }, '|'),
                  h('span', { class: 'datasource-name-cell__url' }, displayUrl)
                ])
              ])
            ])
          }
        },
        {
          prop: 'clusterName',
          label: '关联集群',
          minWidth: 140,
          formatter: (row: DatasourceItem) =>
            h('span', { style: { fontSize: '12px' } }, getClusterAlias(row.clusterName))
        },
        {
          prop: 'type',
          label: '类型',
          minWidth: 80,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px' } }, DatasourceTypeMap[row.type]?.label || '未知')
        },
        {
          prop: 'gmtCreate',
          label: '创建时间',
          minWidth: 160,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px' } }, row.gmtCreate || '-')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 88,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => editDatasource(row)
                },
                () => '编辑'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => deleteDatasource(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ nameSelector: searchForm.value.nameSelector })
    getData()
  }

  function showDrawer() {
    editId.value = undefined
    drawerVisible.value = true
  }

  function editDatasource(row: DatasourceItem) {
    editId.value = row.id
    drawerVisible.value = true
  }

  async function deleteDatasource(row: DatasourceItem) {
    try {
      await ElMessageBox.confirm(`确定要删除数据源 ${row.name} 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await fetchDeleteDatasource(row.id)
      ElMessage.success('删除成功')
      refreshData()
    } catch (error) {
      if (error !== 'cancel' && (!(error instanceof PixiuApiError) || !error.notified)) {
        ElMessage.error(error instanceof Error ? error.message : '删除失败')
      }
    }
  }
</script>

<style lang="scss" scoped>
  .datasource-page :deep(.art-table-card > .el-card__body) {
    padding-top: 8px;
    padding-bottom: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .datasource-page :deep(.art-table) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto !important;
    overflow: visible;
  }

  .datasource-page :deep(.art-table .el-table) {
    flex: 1 1 0;
    min-height: 0;
    height: 100% !important;
  }

  .datasource-page :deep(.custom-pagination) {
    flex: 0 0 auto;
    margin-top: 10px;
    margin-bottom: 0;
    padding-bottom: 4px;
    box-sizing: border-box;
  }

  .datasource-page :deep(.el-pagination) {
    padding: 0;
  }

  .datasource-page :deep(.el-table th),
  .datasource-page :deep(.el-table td) {
    font-size: 12px;
  }

  .datasource-toolbar {
    flex-shrink: 0;
  }

  .quota-alert {
    flex-shrink: 0;
  }

  .datasource-page :deep(.datasource-name-cell) {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 4px 0;
  }

  .datasource-page :deep(.datasource-name-cell__logo) {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
  }

  .datasource-page :deep(.datasource-name-cell__logo-icon) {
    width: 22px;
    height: 22px;
    font-size: 22px;
  }

  .datasource-page :deep(.datasource-name-cell__info) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .datasource-page :deep(.datasource-name-cell__title) {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--el-text-color-primary);
  }

  .datasource-page :deep(.datasource-name-cell__title-text) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .datasource-page :deep(.datasource-name-cell__meta) {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
  }

  .datasource-page :deep(.datasource-name-cell__type) {
    flex-shrink: 0;
  }

  .datasource-page :deep(.datasource-name-cell__sep) {
    flex-shrink: 0;
    color: var(--el-border-color);
  }

  .datasource-page :deep(.datasource-name-cell__url) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .datasource-page :deep(.datasource-name-cell__default-tag) {
    flex-shrink: 0;
  }
</style>
