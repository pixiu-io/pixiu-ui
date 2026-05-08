<template>
  <div class="host-page art-full-height">
    <HostSearch v-model="searchForm" @search="handleSearch" @reset="handleReset" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="handleTableRefresh">
        <template #left>
          <ElButton v-ripple @click="openAddNodeDialog">新增节点</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        :row-key="hostRowKey"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="{ align: 'right' }"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDialog
      v-model="addNodeVisible"
      title="新增节点"
      width="540px"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      class="host-add-node-dialog"
      @closed="resetAddNodeForm"
    >
      <ElForm
        ref="addNodeFormRef"
        :model="addNodeForm"
        :rules="addNodeRules"
        label-width="100px"
        label-position="right"
      >
        <ElFormItem label="主机名称" prop="name">
          <ElInput v-model="addNodeForm.name" clearable placeholder="小写字母、数字、中划线" />
        </ElFormItem>
        <ElFormItem label="IP 地址" prop="ip">
          <ElInput v-model="addNodeForm.ip" clearable />
        </ElFormItem>
        <ElFormItem label="认证方式" prop="authType">
          <ElRadioGroup v-model="addNodeForm.authType">
            <ElRadio value="password">密码</ElRadio>
            <ElRadio value="key">密钥</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="用户名">
          <span class="host-add-node-fixed-user">root</span>
        </ElFormItem>
        <template v-if="addNodeForm.authType === 'password'">
          <ElFormItem label="密码" prop="password">
            <ElInput v-model="addNodeForm.password" type="password" show-password />
          </ElFormItem>
        </template>
        <template v-else>
          <ElFormItem label="私钥" prop="privateKey">
            <ElInput
              v-model="addNodeForm.privateKey"
              type="textarea"
              :rows="6"
              placeholder="请粘贴 SSH 私钥内容（PEM 格式）"
              spellcheck="false"
            />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <ElButton @click="addNodeVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="addNodeSubmitting" @click="submitAddNode">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, nextTick, onActivated, reactive, ref } from 'vue'
  import { CopyDocument } from '@element-plus/icons-vue'
  import { ElLink, ElMessage, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreatePlanNode,
    fetchPlanList,
    fetchPlanNodes,
    fetchPlanWithResources,
    type PlanNodeListItem
  } from '@/api/plan'
  import { useRoute, useRouter } from 'vue-router'
  import HostSearch from './modules/host-search.vue'

  defineOptions({ name: 'SafeguardHost' })

  const route = useRoute()
  const router = useRouter()

  const searchForm = ref<{ hostName?: string }>({})

  const PLAN_LIST_LIMIT = 500
  const NODE_FETCH_CONCURRENCY = 10

  async function fetchAllPlanNodesMerged(): Promise<PlanNodeListItem[]> {
    const { list } = await fetchPlanList({ page: 1, limit: PLAN_LIST_LIMIT })
    if (!list.length) return []
    const merged: PlanNodeListItem[] = []
    for (let i = 0; i < list.length; i += NODE_FETCH_CONCURRENCY) {
      const chunk = list.slice(i, i + NODE_FETCH_CONCURRENCY)
      const batches = await Promise.all(
        chunk.map(async (p) => {
          try {
            return await fetchPlanNodes(p.id)
          } catch {
            return [] as PlanNodeListItem[]
          }
        })
      )
      for (const nodes of batches) merged.push(...nodes)
    }
    return merged
  }

  const mergedNodesCache = ref<PlanNodeListItem[] | null>(null)

  async function loadMergedNodesCached(): Promise<PlanNodeListItem[]> {
    if (mergedNodesCache.value === null) {
      mergedNodesCache.value = await fetchAllPlanNodesMerged()
    }
    return mergedNodesCache.value
  }

  function hostRowKey(row: PlanNodeListItem) {
    return `${row.plan_id}-${row.id}`
  }

  function authTypeLabel(t?: string): string {
    if (t === 'password') return '密码'
    if (t === 'key') return '密钥'
    if (t === 'none') return '无'
    return t?.trim() ? String(t) : '—'
  }

  function authTagType(t?: string): 'success' | 'warning' | 'info' {
    if (t === 'password') return 'success'
    if (t === 'key') return 'warning'
    return 'info'
  }

  function goEditDeploy(planId: number) {
    if (!planId) return
    router.push({
      path: '/container/cluster/deploy',
      query: { planId: String(planId), mode: 'edit' }
    })
  }

  function hostMoreClick(item: ButtonMoreItem, row: PlanNodeListItem) {
    switch (item.key) {
      case 'copyName':
        void navigator.clipboard.writeText(row.name)
        ElMessage.success('已复制主机名称')
        break
      case 'copyIp':
        void navigator.clipboard.writeText(row.ip || '')
        ElMessage.success('已复制 IP')
        break
      default:
        break
    }
  }

  /** —— 新增节点对话框 —— */
  const addNodeVisible = ref(false)
  const addNodeFormRef = ref<FormInstance>()
  const addNodeSubmitting = ref(false)

  const addNodeEmpty = () => ({
    name: '',
    ip: '',
    authType: 'password' as 'password' | 'key',
    password: '',
    privateKey: ''
  })

  const addNodeForm = reactive(addNodeEmpty())

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/

  const addNodeRules: FormRules = {
    name: [
      { required: true, message: '请输入主机名称', trigger: 'blur' },
      {
        validator: (_r, value: string, cb) => {
          const hostname = String(value ?? '').trim()
          const hostnamePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
          if (!hostnamePattern.test(hostname)) {
            cb(
              new Error(
                '主机名称需符合 Linux 规范：1-63 位，小写字母/数字/中划线，且不能以中划线开头或结尾'
              )
            )
            return
          }
          cb()
        },
        trigger: 'blur'
      }
    ],
    ip: [
      { required: true, message: '请输入 IP 地址', trigger: 'blur' },
      {
        validator: (_r, value: string, cb) => {
          if (!ipPattern.test(value)) cb(new Error('请输入有效的 IP 地址'))
          else cb()
        },
        trigger: 'blur'
      }
    ],
    authType: [{ required: true, message: '请选择认证方式', trigger: 'change' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    privateKey: [{ required: true, message: '请粘贴私钥内容', trigger: 'blur' }]
  }

  function openAddNodeDialog() {
    Object.assign(addNodeForm, addNodeEmpty())
    addNodeVisible.value = true
    nextTick(() => addNodeFormRef.value?.clearValidate())
  }

  function resetAddNodeForm() {
    Object.assign(addNodeForm, addNodeEmpty())
    addNodeFormRef.value?.clearValidate()
  }

  async function submitAddNode() {
    if (!addNodeFormRef.value || addNodeSubmitting.value) return
    const valid = await addNodeFormRef.value
      .validate()
      .then(() => true)
      .catch(() => false)
    if (!valid || addNodeForm.planId == null) return

    addNodeSubmitting.value = true
    try {
      const resources = await fetchPlanWithResources(addNodeForm.planId)
      const rt = resources.config?.runtime?.runtime
      const cri = rt === 'docker' || rt === 'containerd' ? rt : 'containerd'

      const auth =
        addNodeForm.authType === 'password'
          ? {
              type: 'password' as const,
              password: { user: 'root', password: addNodeForm.password }
            }
          : { type: 'key' as const, key: { data: addNodeForm.privateKey } }

      await fetchCreatePlanNode(addNodeForm.planId, {
        name: addNodeForm.name.trim(),
        role: [...addNodeForm.role],
        cri,
        ip: addNodeForm.ip.trim(),
        auth
      })
      ElMessage.success('新增节点成功')
      addNodeVisible.value = false
      mergedNodesCache.value = null
      await handleTableRefresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '新增节点失败'
      ElMessage.error(msg)
    } finally {
      addNodeSubmitting.value = false
    }
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
      immediate: true,
      apiFn: async (params: { current: number; size: number; hostName?: string }) => {
        const all = await loadMergedNodesCached()
        const q = (params.hostName || '').trim().toLowerCase()
        let rows = all
        if (q) {
          rows = rows.filter(
            (r) => r.name.toLowerCase().includes(q) || (r.ip || '').toLowerCase().includes(q)
          )
        }
        const total = rows.length
        const start = (params.current - 1) * params.size
        const records = rows.slice(start, start + params.size)
        return {
          code: 200,
          data: { records, total, current: params.current, size: params.size }
        }
      },
      apiParams: {
        current: 1,
        size: 10,
        hostName: undefined as string | undefined
      },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '主机名称',
          minWidth: 200,
          formatter: (row: PlanNodeListItem) =>
            h('div', { style: 'line-height:1.8' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:14px',
                  onClick: () => goEditDeploy(row.plan_id)
                },
                () => row.name
              ),
              h(
                'div',
                {
                  style:
                    'display:flex;align-items:center;gap:4px;color:var(--el-text-color-secondary);font-size:12px'
                },
                [
                  h('span', `ID: ${row.id}`),
                  h(
                    'span',
                    {
                      class: 'icon-action',
                      style: 'cursor:pointer;display:inline-flex;align-items:center',
                      title: '复制 ID',
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        void navigator.clipboard.writeText(String(row.id))
                        ElMessage.success('已复制')
                      }
                    },
                    [h(CopyDocument, { style: 'width:12px;height:12px' })]
                  )
                ]
              )
            ])
        },
        {
          prop: 'ip',
          label: 'IP',
          minWidth: 140,
          formatter: (row: PlanNodeListItem) =>
            h('span', { style: 'font-size:13px;font-family:var(--el-font-family-mono,monospace)' }, row.ip || '—')
        },
        {
          prop: 'auth',
          label: '认证类型',
          width: 120,
          formatter: (row: PlanNodeListItem) => {
            const t = row.auth?.type
            return h(
              ElTag,
              { type: authTagType(t), size: 'small' },
              () => authTypeLabel(t)
            )
          }
        },
        {
          prop: 'operation',
          label: '操作',
          width: 200,
          fixed: 'right',
          formatter: (row: PlanNodeListItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => goEditDeploy(row.plan_id)
                },
                () => '编辑部署'
              ),
              h(ArtButtonMore, {
                list: [
                  { key: 'copyName', label: '复制主机名称', icon: 'ri:file-copy-line' },
                  { key: 'copyIp', label: '复制 IP', icon: 'ri:links-line' }
                ],
                onClick: (item: ButtonMoreItem) => hostMoreClick(item, row)
              })
            ])
        }
      ]
    }
  })

  function handleSearch(params: typeof searchForm.value) {
    replaceSearchParams({
      hostName: params.hostName
    })
    void getData()
  }

  function handleReset() {
    void resetSearchParams()
  }

  async function handleTableRefresh() {
    mergedNodesCache.value = null
    await refreshData()
  }

  onActivated(() => {
    mergedNodesCache.value = null
    void refreshData()
  })
</script>

<style>
  .host-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .host-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .host-page .art-table .el-table {
    font-size: 13px;
  }
  .host-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
  .host-add-node-fixed-user {
    color: var(--el-text-color-regular);
  }
</style>
