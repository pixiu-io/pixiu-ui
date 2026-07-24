<!-- 授权管理页面 -->
<template>
  <div class="permission-page art-full-height">
    <ElAlert
      type="info"
      :closable="false"
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      description="为 Kubernetes 集群添加用户授权，支持管理员、只读和自定义三种权限类型。"
    />
    <div
      class="permission-toolbar"
      style="
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      "
    >
      <ElButton @click="showGrantDrawer" v-ripple>添加权限</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.clusterName"
          clearable
          placeholder="请输入集群名称"
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
        :pagination-options="{
          align: 'right',
          hideOnEmpty: false,
          layout: 'total, prev, pager, next, sizes, jumper'
        }"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <PermissionGrantDrawer v-model="grantDrawerVisible" :edit-permission-id="editPermissionId" @success="refreshData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref } from 'vue'
  import { useTable } from '@/hooks/core/useTable'
  import { ElAlert, ElButton, ElInput, ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { useRouter } from 'vue-router'
  import {
    fetchDeletePermission,
    fetchPermissionList,
    fetchBatchDeletePermissions,
    fetchGetClusterKubeconfig,
    type PermissionListItem
  } from '@/api/system-manage'
  import PermissionGrantDrawer from './modules/permission-grant-drawer.vue'

  defineOptions({ name: 'PermissionManage' })

  const router = useRouter()
  const searchForm = ref({ clusterName: undefined as string | undefined })
  const grantDrawerVisible = ref(false)
  const editPermissionId = ref<number | undefined>(undefined)

  const formatExpiration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '-'
    const units = [
      { label: '年', value: 365 * 24 * 3600 },
      { label: '月', value: 30 * 24 * 3600 },
      { label: '天', value: 24 * 3600 },
      { label: '时', value: 3600 }
    ]

    let remaining = seconds
    let result = ''

    for (const unit of units) {
      const val = Math.floor(remaining / unit.value)
      if (val > 0) {
        result += `${val}${unit.label}`
        remaining %= unit.value
      }
    }

    return result || '不足1小时'
  }

  const checkIsExpired = (updateTime: string, expirationSeconds: number) => {
    if (!updateTime || !expirationSeconds) return false
    const updateDate = new Date(updateTime)
    if (isNaN(updateDate.getTime())) return false

    const expireTime = updateDate.getTime() + expirationSeconds * 1000
    return Date.now() > expireTime
  }

  const pTypeMap: Record<number, string> = {
    0: '只读',
    1: '自定义',
    2: '管理员'
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
      apiFn: async (params: { current: number; size: number; clusterName?: string }) => {
        const { total, items } = await fetchPermissionList({
          page: params.current,
          limit: params.size,
          clusterName: params.clusterName
        })
        return {
          records: items,
          total,
          current: params.current,
          size: params.size
        }
      },
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'clusterAliasName',
          label: '集群',
          minWidth: 180,
          formatter: (row: any) =>
            h('div', { style: 'line-height:1.8' }, [
              h('span', { style: 'font-size:13px;color:var(--el-color-primary)' }, row.clusterAliasName || row.clusterName),
              h('div', {
                style: 'color:var(--el-text-color-secondary);font-size:12px'
              }, row.clusterName)
            ])
        },
        {
          prop: 'userName',
          label: '用户',
          minWidth: 120,
          formatter: (row: any) =>
            h('span', { class: 'user-name', style: { fontSize: '12px' } }, row.userName)
        },
        {
          prop: 'pType',
          label: '授权类型',
          minWidth: 100,
          formatter: (row: any) =>
            h(
              'span',
              { class: 'p-type', style: { fontSize: '12px' } },
              pTypeMap[row.pType] ?? row.pType
            )
        },
        {
          prop: 'namespace',
          label: '命名空间',
          minWidth: 150,
          formatter: (row: any) => {
            // 如果是自定义类型且有 targetNamespaces，则显示多个标签
            if (row.pType === 1 && row.targetNamespaces && Array.isArray(row.targetNamespaces) && row.targetNamespaces.length > 0) {
              return h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, 
                row.targetNamespaces
                  .filter((ns: any) => typeof ns === 'string' && ns != null)
                  .map((ns: string) => 
                    h(ElTag, { type: 'info', size: 'small', effect: 'light' }, () => ns)
                  )
              )
            }
            // 其他类型显示单个标签
            const namespace = row.namespace || '全部命名空间'
            return h(ElTag, { type: 'info', size: 'small', effect: 'light' }, () => namespace)
          }
        },
        {
          prop: 'expirationSeconds',
          label: '有效期',
          minWidth: 200,
          formatter: (row: any) => {
            const isExpired = checkIsExpired(row.updateTime, row.expirationSeconds)
            return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
              h('span', { style: { fontSize: '12px' } }, formatExpiration(row.expirationSeconds)),
              h(
                ElTag,
                {
                  type: isExpired ? 'danger' : 'primary',
                  size: 'small',
                  effect: 'light'
                },
                () => (isExpired ? '已过期' : '有效')
              )
            ])
          }
        },
        {
          prop: 'createTime',
          label: '创建时间',
          minWidth: 160,
          formatter: (row: any) =>
            h('span', { class: 'create-time', style: { fontSize: '12px' } }, row.createTime ?? '-')
        },
        {
          prop: 'updateTime',
          label: '更新时间',
          minWidth: 160,
          formatter: (row: any) =>
            h('span', { class: 'update-time', style: { fontSize: '12px' } }, row.updateTime ?? '-')
        },
        {
          prop: 'operation',
          label: '操作',
          minWidth: 200,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => viewPermission(row)
                },
                () => '修改'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => downloadKubeconfig(row)
                },
                () => '下载 Kubeconfig'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => deletePermission(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ clusterName: searchForm.value.clusterName })
    getData()
  }

  function showGrantDrawer() {
    editPermissionId.value = undefined
    grantDrawerVisible.value = true
  }

  async function viewPermission(row: { id: number }) {
    editPermissionId.value = row.id
    grantDrawerVisible.value = true
  }

  async function downloadKubeconfig(row: PermissionListItem) {
    try {
      if (!row.clusterId) {
        ElMessage.warning('集群 ID 不存在')
        return
      }
      const kubeconfig = await fetchGetClusterKubeconfig(row.clusterId)
      if (!kubeconfig.content) {
        ElMessage.warning('暂无 Kubeconfig 内容')
        return
      }
      
      // 对 content 进行 base64 解码
      let decodedContent = kubeconfig.content
      try {
        decodedContent = atob(kubeconfig.content)
      } catch (e) {
        // 如果解码失败，可能已经是明文，直接使用原内容
        console.warn('Base64 解码失败，使用原始内容:', e)
      }
      
      const blob = new Blob([decodedContent], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // 使用后端返回的 cluster_name，或者 row 中的集群名称
      const fileName = kubeconfig.cluster_name || row.clusterName || row.clusterAliasName || row.name || 'kubeconfig'
      a.download = `${fileName}.yaml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      if (e.notified) return
      ElMessage.error(e.message || '下载 Kubeconfig 失败')
    }
  }

  async function deletePermission(row: PermissionListItem) {
    try {
      const user = row.userName || '-'
      const cluster = row.clusterAliasName || row.clusterName || '-'
      await ElMessageBox.confirm(`确认取消集群（${cluster}）对 ${user} 的授权吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await fetchDeletePermission(row.id)
      ElMessage.success('删除成功')
      refreshData()
    } catch (e: any) {
      if (e === 'cancel' || e === 'close') return
      if (e.notified) return
      ElMessage.error(e.message || '删除失败')
    }
  }
</script>

<style lang="scss" scoped>
  .permission-page :deep(.user-name),
  .permission-page :deep(.cluster-name),
  .permission-page :deep(.p-type),
  .permission-page :deep(.namespace),
  .permission-page :deep(.create-time) {
    font-size: 12px;
  }

  .permission-page :deep(.art-table-card > .el-card__body) {
    padding-top: 12px;
    padding-bottom: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }


  .permission-page :deep(.art-table) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto !important;
    overflow: visible;
  }

  .permission-page :deep(.art-table .el-table) {
    flex: 1 1 0;
    min-height: 0;
    height: 100% !important;
  }

  .permission-page :deep(.custom-pagination) {
    flex: 0 0 auto;
    margin-top: 10px;
    margin-bottom: 0;
    padding-bottom: 4px;
    box-sizing: border-box;
  }

  .permission-page :deep(.el-pagination) {
    padding: 0;
  }

  .permission-toolbar {
    flex-shrink: 0;
  }

  .quota-alert {
    flex-shrink: 0;
  }
</style>
