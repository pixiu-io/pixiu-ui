<template>
  <div class="auth-page">
    <div v-if="kind === 'clusterrole'" class="cluster-toolbar">
      <ElButton v-ripple @click="onRbacGenerator">新建策略</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput v-model="crSearchForm.name" clearable placeholder="请输入名称" class="cluster-toolbar__search" @keyup.enter="runCrSearch" @clear="runCrSearch" />
        <div class="cluster-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceCrSearch" @keyup.enter="forceCrSearch">
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader v-model:columns="crColumnChecks" :loading="crLoading" layout="size,columns,settings" @refresh="onCrRefresh" />
      </div>
    </div>
    <div v-else-if="kind === 'clusterrolebinding'" class="cluster-toolbar">
      <ElButton v-ripple @click="onRbacGenerator">新建策略</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput v-model="crbSearchForm.name" clearable placeholder="请输入名称" class="cluster-toolbar__search" @keyup.enter="runCrbSearch" @clear="runCrbSearch" />
        <div class="cluster-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceCrbSearch" @keyup.enter="forceCrbSearch">
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader v-model:columns="crbColumnChecks" :loading="crbLoading" layout="size,columns,settings" @refresh="onCrbRefresh" />
      </div>
    </div>
    <div v-else-if="kind === 'role'" class="cluster-toolbar">
      <ElButton v-ripple @click="onRbacGenerator">新建策略</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput v-model="roleSearchForm.name" clearable placeholder="请输入名称" class="cluster-toolbar__search" @keyup.enter="runRoleSearch" @clear="runRoleSearch" />
        <div class="cluster-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceRoleSearch" @keyup.enter="forceRoleSearch">
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader v-model:columns="roleColumnChecks" :loading="roleLoading" layout="size,columns,settings" @refresh="onRoleRefresh" />
      </div>
    </div>
    <div v-else-if="kind === 'rolebinding'" class="cluster-toolbar">
      <ElButton v-ripple @click="onRbacGenerator">新建策略</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput v-model="rbSearchForm.name" clearable placeholder="请输入名称" class="cluster-toolbar__search" @keyup.enter="runRbSearch" @clear="runRbSearch" />
        <div class="cluster-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceRbSearch" @keyup.enter="forceRbSearch">
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader v-model:columns="rbColumnChecks" :loading="rbLoading" layout="size,columns,settings" @refresh="onRbRefresh" />
      </div>
    </div>
    <div v-else class="cluster-toolbar">
      <ElButton v-ripple @click="onRbacGenerator">新建策略</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput v-model="saSearchForm.name" clearable placeholder="请输入名称" class="cluster-toolbar__search" @keyup.enter="runSaSearch" @clear="runSaSearch" />
        <div class="cluster-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceSaSearch" @keyup.enter="forceSaSearch">
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader v-model:columns="saColumnChecks" :loading="saLoading" layout="size,columns,settings" @refresh="onSaRefresh" />
      </div>
    </div>

<ElCard class="art-table-card">
      <ElTabs v-model="kind" class="auth-tabs">
        <ElTabPane label="ClusterRole" name="clusterrole">
          <ArtTable
            :show-table-header="false"
            row-key="rowKey"
            :loading="crLoading"
            :data="crData"
            :columns="crColumns"
            :pagination="crPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="crHandleSizeChange"
            @pagination:current-change="crHandleCurrentChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <ElTabPane label="ClusterRoleBinding" name="clusterrolebinding">
          <ArtTable
            :show-table-header="false"
            row-key="rowKey"
            :loading="crbLoading"
            :data="crbData"
            :columns="crbColumns"
            :pagination="crbPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="crbHandleSizeChange"
            @pagination:current-change="crbHandleCurrentChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <ElTabPane label="Role" name="role">
          <ArtTable
            :show-table-header="false"
            row-key="rowKey"
            :loading="roleLoading"
            :data="roleData"
            :columns="roleVisibleColumns"
            :pagination="rolePagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="roleHandleSizeChange"
            @pagination:current-change="roleHandleCurrentChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <ElTabPane label="RoleBinding" name="rolebinding">
          <ArtTable
            :show-table-header="false"
            row-key="rowKey"
            :loading="rbLoading"
            :data="rbData"
            :columns="rbVisibleColumns"
            :pagination="rbPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="rbHandleSizeChange"
            @pagination:current-change="rbHandleCurrentChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <ElTabPane label="ServiceAccount" name="serviceaccount">
          <ArtTable
            :show-table-header="false"
            row-key="rowKey"
            :loading="saLoading"
            :data="saData"
            :columns="saVisibleColumns"
            :pagination="saPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="saHandleSizeChange"
            @pagination:current-change="saHandleCurrentChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="查看 YAML"
      :yaml="yamlText"
      footer-mode="edit"
      width="900px"
      :editor-height="480"
      :submit-loading="yamlSaving"
      @save="onYamlSave"
    />
  </div>

</template>

<script setup lang="ts">
  import {
    ElButton,
    ElCard,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElPopover,
    ElTabPane,
    ElTabs
  } from 'element-plus'
  import { h, computed, inject, ref, watch } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { useClusterDetailNamespaceRefresh } from '@/hooks/core/useClusterDetailNamespaceRefresh'
  import yaml from 'js-yaml'
  import {
    deleteK8sClusterRole,
    deleteK8sClusterRoleBinding,
    deleteK8sRole,
    deleteK8sRoleBinding,
    deleteK8sServiceAccount,
    fetchK8sClusterRole,
    fetchK8sClusterRoleBinding,
    fetchK8sClusterRoleBindingList,
    fetchK8sClusterRoleList,
    fetchK8sRole,
    fetchK8sRoleBinding,
    fetchK8sRoleBindingList,
    fetchK8sRoleList,
    fetchK8sServiceAccount,
    fetchK8sServiceAccountList,
    type K8sRbacObject
  } from '@/api/kubernetes/rbac'
  import { clusterDetailNamespaceKey } from './context'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'

  defineOptions({ name: 'ClusterDetailAuth' })

  type AuthTab = 'clusterrole' | 'clusterrolebinding' | 'role' | 'rolebinding' | 'serviceaccount'

  /** RBAC 列表：名称短、Labels 长，提高 Labels 的 minWidth 占比，避免名称列吃掉过多横向空间 */
  const RBAC_COL = {
    nameMin: 132,
    labelsMin: 380,
    nsWidth: 148,
    opWidth: 148
  } as const

  const route = useRoute()
  const router = useRouter()
  const authTabs: AuthTab[] = ['clusterrole', 'clusterrolebinding', 'role', 'rolebinding', 'serviceaccount']
  const kind = ref<AuthTab>(
    (authTabs as string[]).includes(route.query.tab as string) ? (route.query.tab as AuthTab) : 'clusterrole'
  )
  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  const crSearchForm = ref<{ name?: string }>({})
  const crbSearchForm = ref<{ name?: string }>({})
  const roleSearchForm = ref<{ name?: string }>({})
  const rbSearchForm = ref<{ name?: string }>({})
  const saSearchForm = ref<{ name?: string }>({})

  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSaving = ref(false)

  function renderKvCell(lines: string[]) {
    const lineStyle =
      'box-sizing:border-box;width:100%;min-width:0;max-width:100%;font-size:12px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--el-text-color-regular)'
    const triggerStyle =
      'box-sizing:border-box;width:100%;min-width:0;max-width:100%;cursor:default'
    const moreStyle = 'font-size:12px;line-height:1.5;color:var(--el-text-color-placeholder)'
    if (!lines.length) return h('span', { style: lineStyle }, '-')
    const preview = lines.slice(0, 2)
    const hasMore = lines.length > 2
    const trigger = h('div', { style: triggerStyle }, [
      ...preview.map((t, i) => h('div', { key: `p${i}`, style: lineStyle }, t)),
      ...(hasMore ? [h('div', { style: moreStyle }, '...')] : [])
    ])
    const body = h(
      'div',
      { style: 'max-height:300px;overflow-x:hidden;overflow-y:auto;padding:4px 0' },
      lines.map((t, i) =>
        h(
          'div',
          {
            key: `f${i}`,
            style:
              'padding:2px 0;font-size:12px;line-height:1.5;color:var(--el-text-color-regular);word-break:break-all'
          },
          t
        )
      )
    )
    return h(
      ElPopover,
      {
        placement: 'top-start',
        width: 'auto',
        popperStyle: 'max-width:min(440px,90vw);padding:8px 12px;box-sizing:border-box',
        trigger: 'hover',
        showAfter: 200,
        teleported: true
      },
      { reference: () => trigger, default: () => body }
    )
  }

  function labelsCell(row: K8sRbacObject) {
    const labels = row.metadata?.labels ?? {}
    const lines = Object.entries(labels).map(([k, v]) => `${k}: ${v}`)
    return renderKvCell(lines)
  }

  function nameLinkYaml(
    row: K8sRbacObject,
    tab: AuthTab,
    onOpen: (t: AuthTab, row: K8sRbacObject) => void
  ) {
    const name = row.metadata?.name ?? '-'
    return h(
      'div',
      {
        style:
          'min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
      },
      [
        h(
          ElLink,
          {
            type: 'primary',
            underline: 'never',
            style: 'font-size:12px',
            title: name,
            onClick: () => onOpen(tab, row)
          },
          () => name
        )
      ]
    )
  }

  function opCell(
    row: K8sRbacObject,
    tab: AuthTab,
    onOpen: (t: AuthTab, row: K8sRbacObject) => void,
    onDel: (t: AuthTab, row: K8sRbacObject) => void
  ) {
    return h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => onOpen(tab, row)
        },
        () => '查看YAML'
      ),
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => onDel(tab, row)
        },
        () => '删除'
      )
    ])
  }

  function nsCell(row: K8sRbacObject) {
    const ns = row.metadata?.namespace ?? '-'
    const isSystem = ns === 'default' || ns.startsWith('kube-')
    return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, ns),
      isSystem
        ? h(
            'span',
            {
              style:
                'font-size:11px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-7);flex-shrink:0'
            },
            '系统'
          )
        : null
    ])
  }

  const currentYamlTab = ref<AuthTab>('clusterrole')

  async function openYaml(tab: AuthTab, row: K8sRbacObject) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!cluster || !name) return
    currentYamlTab.value = tab
    try {
      let obj: unknown
      if (tab === 'clusterrole') obj = await fetchK8sClusterRole(cluster, name)
      else if (tab === 'clusterrolebinding') obj = await fetchK8sClusterRoleBinding(cluster, name)
      else if (tab === 'role') {
        if (!ns) return
        obj = await fetchK8sRole(cluster, ns, name)
      } else if (tab === 'rolebinding') {
        if (!ns) return
        obj = await fetchK8sRoleBinding(cluster, ns, name)
      } else {
        if (!ns) return
        obj = await fetchK8sServiceAccount(cluster, ns, name)
      }
      yamlText.value = yaml.dump(obj, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  function onYamlSave(text: string) {
    yamlText.value = text
    void saveYaml()
  }

  async function saveYaml() {
    const cluster = String(route.query.cluster ?? '')
    yamlSaving.value = true
    try {
      await updateK8sResourceFromYaml(cluster, yamlText.value)
      ElMessage.success('保存成功')
      yamlVisible.value = false
      if (currentYamlTab.value === 'clusterrole') onCrRefresh()
      else if (currentYamlTab.value === 'clusterrolebinding') refreshCrbData()
      else if (currentYamlTab.value === 'role') onRoleRefresh()
      else if (currentYamlTab.value === 'rolebinding') onRbRefresh()
      else onSaRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      yamlSaving.value = false
    }
  }

  async function deleteRow(tab: AuthTab, row: K8sRbacObject, refresh: () => void) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!cluster || !name) return
    try {
      await ElMessageBox.confirm(`确定删除「${name}」吗？此操作不可恢复。`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      if (tab === 'clusterrole') await deleteK8sClusterRole(cluster, name)
      else if (tab === 'clusterrolebinding') await deleteK8sClusterRoleBinding(cluster, name)
      else if (tab === 'role') {
        if (!ns) return
        await deleteK8sRole(cluster, ns, name)
      } else if (tab === 'rolebinding') {
        if (!ns) return
        await deleteK8sRoleBinding(cluster, ns, name)
      } else {
        if (!ns) return
        await deleteK8sServiceAccount(cluster, ns, name)
      }
      ElMessage.success('删除成功')
      refresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  function onRbacGenerator() {
    ElMessage.info('新建策略：可结合「YAML创建」或 kubectl 生成 Role/ClusterRole 清单。')
  }

  type PagedParams = { current: number; size: number; name?: string }

  const emptyRecords = (size: number) => ({
    code: 200 as const,
    data: { records: [] as (K8sRbacObject & { rowKey: string })[], total: 0, current: 1, size }
  })

  const {
    columns: crColumns,
    columnChecks: crColumnChecks,
    data: crData,
    loading: crLoading,
    pagination: crPagination,
    getData: getCrData,
    replaceSearchParams: replaceCrSearchParams,
    handleSizeChange: crHandleSizeChange,
    handleCurrentChange: crHandleCurrentChange,
    refreshData: refreshCrData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: PagedParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return emptyRecords(params.size)
        const { items, total } = await fetchK8sClusterRoleList(cluster, {
          page: params.current,
          limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({
          ...row,
          rowKey: row.metadata?.uid ?? row.metadata?.name ?? `cr-${i}`
        }))
        return { code: 200, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: RBAC_COL.nameMin,
          formatter: (row: K8sRbacObject) => nameLinkYaml(row, 'clusterrole', openYaml)
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: RBAC_COL.labelsMin,
          formatter: (row: K8sRbacObject) => labelsCell(row)
        },
        {
          prop: 'operation',
          label: '操作',
          width: RBAC_COL.opWidth,
          fixed: 'right',
          align: 'right',
          formatter: (row: K8sRbacObject) =>
            opCell(row, 'clusterrole', openYaml, (t, r) => void deleteRow(t, r, onCrRefresh))
        }
      ]
    }
  })

  const {
    columns: crbColumns,
    columnChecks: crbColumnChecks,
    data: crbData,
    loading: crbLoading,
    pagination: crbPagination,
    getData: getCrbData,
    replaceSearchParams: replaceCrbSearchParams,
    handleSizeChange: crbHandleSizeChange,
    handleCurrentChange: crbHandleCurrentChange,
    refreshData: refreshCrbData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: PagedParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return emptyRecords(params.size)
        const { items, total } = await fetchK8sClusterRoleBindingList(cluster, {
          page: params.current,
          limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({
          ...row,
          rowKey: row.metadata?.uid ?? row.metadata?.name ?? `crb-${i}`
        }))
        return { code: 200, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: RBAC_COL.nameMin,
          formatter: (row: K8sRbacObject) => nameLinkYaml(row, 'clusterrolebinding', openYaml)
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: RBAC_COL.labelsMin,
          formatter: (row: K8sRbacObject) => labelsCell(row)
        },
        {
          prop: 'operation',
          label: '操作',
          width: RBAC_COL.opWidth,
          fixed: 'right',
          align: 'right',
          formatter: (row: K8sRbacObject) =>
            opCell(
              row,
              'clusterrolebinding',
              openYaml,
              (t, r) => void deleteRow(t, r, onCrbRefresh)
            )
        }
      ]
    }
  })

  const {
    columns: roleColumns,
    columnChecks: roleColumnChecks,
    data: roleData,
    loading: roleLoading,
    pagination: rolePagination,
    getData: getRoleData,
    replaceSearchParams: replaceRoleSearchParams,
    handleSizeChange: roleHandleSizeChange,
    handleCurrentChange: roleHandleCurrentChange,
    refreshData: refreshRoleData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: PagedParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return emptyRecords(params.size)
        const { items, total } = await fetchK8sRoleList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: selectedNamespace.value || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({
          ...row,
          rowKey: `${row.metadata?.namespace ?? ''}:${row.metadata?.name ?? `role-${i}`}`
        }))
        return { code: 200, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: RBAC_COL.nameMin,
          formatter: (row: K8sRbacObject) => nameLinkYaml(row, 'role', openYaml)
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: RBAC_COL.nsWidth,
          formatter: (row: K8sRbacObject) => nsCell(row)
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: RBAC_COL.labelsMin,
          formatter: (row: K8sRbacObject) => labelsCell(row)
        },
        {
          prop: 'operation',
          label: '操作',
          width: RBAC_COL.opWidth,
          fixed: 'right',
          align: 'right',
          formatter: (row: K8sRbacObject) =>
            opCell(row, 'role', openYaml, (t, r) => void deleteRow(t, r, onRoleRefresh))
        }
      ]
    }
  })

  const roleVisibleColumns = computed(() =>
    roleColumns.value.filter(
      (c: { prop?: string }) => !(selectedNamespace.value && c.prop === 'metadata.namespace')
    )
  )

  const {
    columns: rbColumns,
    columnChecks: rbColumnChecks,
    data: rbData,
    loading: rbLoading,
    pagination: rbPagination,
    getData: getRbData,
    replaceSearchParams: replaceRbSearchParams,
    handleSizeChange: rbHandleSizeChange,
    handleCurrentChange: rbHandleCurrentChange,
    refreshData: refreshRbData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: PagedParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return emptyRecords(params.size)
        const { items, total } = await fetchK8sRoleBindingList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: selectedNamespace.value || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({
          ...row,
          rowKey: `${row.metadata?.namespace ?? ''}:${row.metadata?.name ?? `rb-${i}`}`
        }))
        return { code: 200, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: RBAC_COL.nameMin,
          formatter: (row: K8sRbacObject) => nameLinkYaml(row, 'rolebinding', openYaml)
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: RBAC_COL.nsWidth,
          formatter: (row: K8sRbacObject) => nsCell(row)
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: RBAC_COL.labelsMin,
          formatter: (row: K8sRbacObject) => labelsCell(row)
        },
        {
          prop: 'operation',
          label: '操作',
          width: RBAC_COL.opWidth,
          fixed: 'right',
          align: 'right',
          formatter: (row: K8sRbacObject) =>
            opCell(row, 'rolebinding', openYaml, (t, r) => void deleteRow(t, r, onRbRefresh))
        }
      ]
    }
  })

  const rbVisibleColumns = computed(() =>
    rbColumns.value.filter(
      (c: { prop?: string }) => !(selectedNamespace.value && c.prop === 'metadata.namespace')
    )
  )

  const {
    columns: saColumns,
    columnChecks: saColumnChecks,
    data: saData,
    loading: saLoading,
    pagination: saPagination,
    getData: getSaData,
    replaceSearchParams: replaceSaSearchParams,
    handleSizeChange: saHandleSizeChange,
    handleCurrentChange: saHandleCurrentChange,
    refreshData: refreshSaData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: PagedParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return emptyRecords(params.size)
        const { items, total } = await fetchK8sServiceAccountList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: selectedNamespace.value || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({
          ...row,
          rowKey: `${row.metadata?.namespace ?? ''}:${row.metadata?.name ?? `sa-${i}`}`
        }))
        return { code: 200, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: RBAC_COL.nameMin,
          formatter: (row: K8sRbacObject) => nameLinkYaml(row, 'serviceaccount', openYaml)
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: RBAC_COL.nsWidth,
          formatter: (row: K8sRbacObject) => nsCell(row)
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: RBAC_COL.labelsMin,
          formatter: (row: K8sRbacObject) => labelsCell(row)
        },
        {
          prop: 'operation',
          label: '操作',
          width: RBAC_COL.opWidth,
          fixed: 'right',
          align: 'right',
          formatter: (row: K8sRbacObject) =>
            opCell(row, 'serviceaccount', openYaml, (t, r) => void deleteRow(t, r, onSaRefresh))
        }
      ]
    }
  })

  const saVisibleColumns = computed(() =>
    saColumns.value.filter(
      (c: { prop?: string }) => !(selectedNamespace.value && c.prop === 'metadata.namespace')
    )
  )

  function runCrSearch() {
    replaceCrSearchParams({ name: (crSearchForm.value.name ?? '').trim() || undefined })
    getCrData()
  }
  function forceCrSearch() {
    replaceCrSearchParams({ name: (crSearchForm.value.name ?? '').trim() || undefined })
    getCrData()
  }
  function onCrRefresh() {
    refreshCrData()
  }

  function runCrbSearch() {
    replaceCrbSearchParams({ name: (crbSearchForm.value.name ?? '').trim() || undefined })
    getCrbData()
  }
  function forceCrbSearch() {
    replaceCrbSearchParams({ name: (crbSearchForm.value.name ?? '').trim() || undefined })
    getCrbData()
  }
  function onCrbRefresh() {
    refreshCrbData()
  }

  function runRoleSearch() {
    replaceRoleSearchParams({
      name: (roleSearchForm.value.name ?? '').trim() || undefined
    })
    getRoleData()
  }
  function forceRoleSearch() {
    replaceRoleSearchParams({
      name: (roleSearchForm.value.name ?? '').trim() || undefined
    })
    getRoleData()
  }
  function onRoleRefresh() {
    refreshRoleData()
  }

  function runRbSearch() {
    replaceRbSearchParams({
      name: (rbSearchForm.value.name ?? '').trim() || undefined
    })
    getRbData()
  }
  function forceRbSearch() {
    replaceRbSearchParams({
      name: (rbSearchForm.value.name ?? '').trim() || undefined
    })
    getRbData()
  }
  function onRbRefresh() {
    refreshRbData()
  }

  function runSaSearch() {
    replaceSaSearchParams({
      name: (saSearchForm.value.name ?? '').trim() || undefined
    })
    getSaData()
  }
  function forceSaSearch() {
    replaceSaSearchParams({
      name: (saSearchForm.value.name ?? '').trim() || undefined
    })
    getSaData()
  }
  function onSaRefresh() {
    refreshSaData()
  }

  function refreshActiveTab() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    if (kind.value === 'clusterrole') getCrData()
    else if (kind.value === 'clusterrolebinding') getCrbData()
    else if (kind.value === 'role') getRoleData()
    else if (kind.value === 'rolebinding') getRbData()
    else getSaData()
  }

  watch(kind, (val) => {
    router.replace({ query: { ...route.query, tab: val } })
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    if (val === 'clusterrole') getCrData()
    else if (val === 'clusterrolebinding') getCrbData()
    else if (val === 'role') getRoleData()
    else if (val === 'rolebinding') getRbData()
    else getSaData()
  })

  useClusterDetailNamespaceRefresh('auth', () => {
    if (kind.value === 'role') getRoleData()
    if (kind.value === 'rolebinding') getRbData()
    if (kind.value === 'serviceaccount') getSaData()
  })

  watch(
    () => String(route.query.cluster ?? ''),
    (cluster) => {
      if (cluster) refreshActiveTab()
    },
    { immediate: true }
  )

  useSkipFirstActivatedRefresh(refreshActiveTab)
</script>

<style>
  .auth-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .auth-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .auth-page .art-table .el-table {
    margin-top: 10px;
    font-size: 13px;
  }
  .auth-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
  /* 名称列 ellipsis：让单元格在 flex 布局下可被压缩 */
  .auth-page .art-table .el-table .el-table__cell > .cell {
    min-width: 0;
  }

  .auth-page .el-tabs__header {
    margin: 0 0 4px;
    flex-shrink: 0;
  }
  .auth-page .el-tabs__nav-wrap::after {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }
  .auth-page .el-tabs__item {
    height: 40px;
    line-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }
  .auth-page .el-tabs__item.is-active {
    color: var(--el-color-primary);
    font-weight: 600;
  }
  .auth-page .el-tabs__active-bar {
    height: 2px;
    border-radius: 2px 2px 0 0;
  }

  .auth-page .art-table-card {
    flex: 1;
    min-height: 0;
  }

  .auth-page .art-table-card > .el-card__body {
    padding-top: 8px;
  }
</style>

<style scoped>
  .auth-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .cluster-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    margin-bottom: 10px;
    flex-shrink: 0;
    gap: 12px;
  }

  .cluster-toolbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cluster-toolbar__search {
    width: 250px;
    max-width: 100%;
  }

  .cluster-toolbar-search-btn {
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

  .cluster-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .cluster-toolbar-search-btn:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }
</style>
