<template>
  <div class="config-page">
    <div v-if="kind === 'cm'" class="cluster-toolbar">
      <ElButton v-ripple @click="goCreateConfigMap">新建 ConfigMap</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput v-model="cmSearchForm.name" clearable placeholder="请输入名称" class="cluster-toolbar__search" @keyup.enter="runCmSearch" @clear="runCmSearch" />
        <div class="cluster-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceCmSearch" @keyup.enter="forceCmSearch">
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader v-model:columns="cmColumnChecks" :loading="cmLoading" layout="size,columns,settings" @refresh="onCmRefresh" />
      </div>
    </div>
    <div v-else class="cluster-toolbar">
      <ElButton v-ripple @click="goCreateSecret">新建 Secret</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput v-model="secSearchForm.name" clearable placeholder="请输入名称" class="cluster-toolbar__search" @keyup.enter="runSecSearch" @clear="runSecSearch" />
        <div class="cluster-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceSecSearch" @keyup.enter="forceSecSearch">
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader v-model:columns="secColumnChecks" :loading="secLoading" layout="size,columns,settings" @refresh="onSecRefresh" />
      </div>
    </div>

<ElCard class="art-table-card">
      <ElTabs v-model="kind" class="config-tabs">
        <!-- ── ConfigMap Tab ── -->
        <ElTabPane label="ConfigMap" name="cm">

          <ArtTable
            :show-table-header="false"
            row-key="rowKey"
            :loading="cmLoading"
            :data="cmData"
            :columns="cmVisibleColumns"
            :pagination="cmPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="cmHandleSizeChange"
            @pagination:current-change="cmHandleCurrentChange"
            @sort-change="onCmSortChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <!-- ── Secret Tab ── -->
        <ElTabPane label="Secret" name="sec">

          <ArtTable
            :show-table-header="false"
            row-key="rowKey"
            :loading="secLoading"
            :data="secData"
            :columns="secVisibleColumns"
            :pagination="secPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="secHandleSizeChange"
            @pagination:current-change="secHandleCurrentChange"
            @sort-change="onSecSortChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <!-- YAML readonly dialog -->
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

    <ElDialog
      v-model="certDialogVisible"
      :title="certDialogMode === 'unbind' ? '解除域名证书' : '关联域名证书'"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="certSecret" style="margin-bottom:12px;font-size:13px;color:var(--el-text-color-regular)">
        <template v-if="certDialogMode === 'unbind'">
          解除 Secret <b>{{ certSecret.name }}</b>（{{ certSecret.namespace }}）已关联的域名
        </template>
        <template v-else>
          为 Secret <b>{{ certSecret.name }}</b>（{{ certSecret.namespace }}）绑定域名
        </template>
      </div>
      <div v-loading="certLoading" style="max-height:360px;overflow-y:auto">
        <template v-if="!certLoading && certDomainOptions.length === 0">
          <div style="text-align:center;padding:24px 0;color:var(--el-text-color-placeholder);font-size:13px">
            当前命名空间下未找到域名（Ingress）
          </div>
        </template>
        <ElCheckboxGroup v-model="checkedDomains" class="cert-domain-list">
          <div v-for="opt in certDomainOptions" :key="`${opt.ingressName}:${opt.host}`" style="padding:4px 0">
            <ElCheckbox :label="`${opt.ingressName}:${opt.host}`" :value="`${opt.ingressName}:${opt.host}`">
              <span style="font-size:13px">{{ opt.host }}</span>
              <span style="font-size:11px;color:var(--el-text-color-placeholder);margin-left:6px">({{ opt.ingressName }})</span>
            </ElCheckbox>
          </div>
        </ElCheckboxGroup>
      </div>
      <template #footer>
        <ElButton @click="certDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="certSaving" :disabled="certLoading || checkedDomains.length === 0" @click="submitBindCertificate">确定</ElButton>
      </template>
    </ElDialog>
  </div>

</template>

<script setup lang="ts">
  import {
    ElButton,
    ElCard,
    ElCheckbox,
    ElCheckboxGroup,
    ElDialog,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElPopover,
    ElTabs,
    ElTabPane,
    ElTooltip
  } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import { computed, h, inject, ref, watch } from 'vue'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { useClusterDetailNamespaceRefresh } from '@/hooks/core/useClusterDetailNamespaceRefresh'
  import {
    fetchK8sConfigMapList,
    fetchK8sConfigMap,
    deleteK8sConfigMap,
    type K8sConfigMap
  } from '@/api/kubernetes/configmap'
  import {
    fetchK8sSecretList,
    fetchK8sSecret,
    deleteK8sSecret,
    type K8sSecret
  } from '@/api/kubernetes/secret'
  import { fetchK8sIngressList, fetchK8sIngress, patchK8sIngress, type K8sIngress } from '@/api/kubernetes/ingress'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { clusterDetailNamespaceKey } from './context'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'

  defineOptions({ name: 'ClusterDetailConfig' })

  const route = useRoute()
  const router = useRouter()
  const kind = ref(route.query.tab === 'sec' ? 'sec' : 'cm')

  // ── ConfigMap tab state ──
  const cmSearchForm = ref<{ name?: string }>({})
  const cmSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── Secret tab state ──
  const secSearchForm = ref<{ name?: string }>({})
  const secSortOrder = ref<'ascending' | 'descending' | null>(null)
  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  // ── YAML dialog state ──
  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSaving = ref(false)
  const currentYamlKind = ref<'cm' | 'sec'>('cm')

  // ── Certificate binding dialog ──
  const certDialogVisible = ref(false)
  const certSecret = ref<{ name: string; namespace: string } | null>(null)
  const certLoading = ref(false)
  const certSaving = ref(false)
  const certDialogMode = ref<'bind' | 'unbind'>('bind')
  const certDomainOptions = ref<Array<{ host: string; ingressName: string }>>([])
  const checkedDomains = ref<string[]>([])

  interface DomainOption {
    host: string
    ingressName: string
  }

  async function openCertDialog(row: K8sSecret, mode: 'bind' | 'unbind' = 'bind') {
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!ns || !name) return
    certSecret.value = { name, namespace: ns }
    certDialogMode.value = mode
    certDomainOptions.value = []
    certDialogVisible.value = true
    certLoading.value = true
    try {
      const cluster = String(route.query.cluster ?? '')
      const { items } = await fetchK8sIngressList(cluster, { page: 1, limit: 9999, namespace: ns })
      const seen = new Set<string>()
      const preChecked = new Set<string>()
      const opts: Array<{ host: string; ingressName: string }> = []
      for (const ing of items) {
        const ingName = ing.metadata?.name ?? ''
        for (const tls of ing.spec?.tls ?? []) {
          const isBound = tls.secretName === name
          for (const host of tls.hosts ?? []) {
            if (!host || seen.has(host)) continue
            seen.add(host)
            if (mode === 'unbind' && !isBound) continue
            opts.push({ host, ingressName: ingName })
            if (isBound) preChecked.add(`${ingName}:${host}`)
          }
        }
        if (mode === 'bind') {
          for (const rule of ing.spec?.rules ?? []) {
            const host = rule.host
            if (!host || seen.has(host)) continue
            seen.add(host)
            opts.push({ host, ingressName: ingName })
          }
        }
      }
      certDomainOptions.value = opts
      checkedDomains.value = mode === 'bind' ? [...preChecked] : []
    } catch (e: any) {
      ElMessage.error(e?.message || '获取域名列表失败')
      certDialogVisible.value = false
    } finally {
      certLoading.value = false
    }
  }

  async function submitBindCertificate() {
    if (!checkedDomains.value.length || !certSecret.value) return
    const cluster = String(route.query.cluster ?? '')
    const ns = certSecret.value.namespace
    const secretName = certSecret.value.name
    const isUnbind = certDialogMode.value === 'unbind'
    certSaving.value = true
    try {
      const selected = checkedDomains.value.map((key) => {
        const [ingressName, host] = key.split(':', 2)
        return { ingressName, host }
      })
      const byIngress = new Map<string, string[]>()
      for (const opt of selected) {
        if (!byIngress.has(opt.ingressName)) byIngress.set(opt.ingressName, [])
        byIngress.get(opt.ingressName)!.push(opt.host)
      }
      for (const [ingName, hosts] of byIngress) {
        const ing = await fetchK8sIngress(cluster, ns, ingName)
        const existingTls = ing.spec?.tls ?? []
        const selectedHostSet = new Set(hosts)
        if (isUnbind) {
          // 从 TLS 条目中移除选中的 hosts，若条目无剩余 hosts 则整条删除
          const newTls = existingTls
            .map((t) => {
              const remaining = (t.hosts ?? []).filter((h) => !selectedHostSet.has(h))
              if (remaining.length === 0) return null
              return { ...t, hosts: remaining }
            })
            .filter(Boolean)
          await patchK8sIngress(cluster, ns, ingName, { spec: { tls: newTls } })
        } else {
          // 已绑定相同 secretName 的域名无需重复 PATCH
          const alreadyBound = existingTls.some(
            (t) => t.secretName === secretName && t.hosts?.some((h) => selectedHostSet.has(h))
          )
          const newHosts = hosts.filter((h) => !existingTls.some((t) => t.secretName === secretName && (t.hosts ?? []).includes(h)))
          if (!alreadyBound && newHosts.length === 0) continue
          if (newHosts.length === 0) continue
          let newTls = [...existingTls]
          for (let i = 0; i < newTls.length; i++) {
            const tls = newTls[i]
            if (tls && newHosts.some((h) => (tls.hosts ?? []).includes(h))) {
              newTls[i] = { ...tls, secretName, hosts: tls.hosts }
            }
          }
          const coveredHosts = new Set(newTls.flatMap((t) => t?.hosts ?? []))
          const extraHosts = newHosts.filter((h) => !coveredHosts.has(h))
          for (const host of extraHosts) {
            newTls.push({ hosts: [host], secretName })
          }
          await patchK8sIngress(cluster, ns, ingName, { spec: { tls: newTls } })
        }
      }
      ElMessage.success(isUnbind ? `已解除 ${selected.length} 个域名的证书绑定` : `已为 ${selected.length} 个域名绑定证书「${secretName}」`)
      certDialogVisible.value = false
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || e?.message || (isUnbind ? '解除绑定失败' : '绑定证书失败'))
    } finally {
      certSaving.value = false
    }
  }

  function certMoreClick(item: ButtonMoreItem, row: K8sSecret) {
    if (item.key === 'bind') {
      openCertDialog(row, 'bind')
    } else if (item.key === 'unbind') {
      openCertDialog(row, 'unbind')
    }
  }

  function goCreateConfigMap() {
    router.push({
      path: '/container/configmap-create',
      query: { cluster: String(route.query.cluster ?? ''), namespace: selectedNamespace.value }
    })
  }

  function goCreateSecret() {
    router.push({
      path: '/container/secret-create',
      query: { cluster: String(route.query.cluster ?? ''), namespace: selectedNamespace.value }
    })
  }

  // ── Render helpers ──
  function renderNsCell(ns: string) {
    const isSystem = ns === 'default' || ns.startsWith('kube-')
    return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, ns),
      isSystem
        ? h('span', {
            style:
              'font-size:11px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-7);flex-shrink:0'
          }, '系统')
        : null
    ])
  }

  function renderKvCell(lines: string[]) {
    const lineStyle =
      'font-size:12px;font-weight:400;line-height:1.5;color:var(--el-text-color-regular);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
    const moreStyle =
      'font-size:12px;font-weight:400;line-height:1.5;color:var(--el-text-color-placeholder)'
    const emptyStyle =
      'font-size:12px;font-weight:400;line-height:1.5;color:var(--el-text-color-placeholder);letter-spacing:0.02em'
    if (!lines.length) return h('span', { style: emptyStyle }, '-')
    const preview = lines.slice(0, 2)
    const hasMore = lines.length > 2
    const trigger = h('div', [
      ...preview.map((t, i) => h('div', { key: `p${i}`, style: lineStyle }, t)),
      ...(hasMore ? [h('div', { style: moreStyle }, '...')] : [])
    ])
    const body = h(
      'div',
      { style: 'max-height:300px;overflow-y:auto;padding:4px 0' },
      lines.map((t, i) =>
        h(
          'div',
          { key: `f${i}`, style: 'font-size:12px;font-weight:400;line-height:1.8;color:var(--el-text-color-regular);white-space:nowrap' },
          t
        )
      )
    )
    return h(
      ElPopover,
      { placement: 'top-start', width: 360, trigger: 'hover', showAfter: 200, teleported: true },
      { reference: () => trigger, default: () => body }
    )
  }

  /** ConfigMap 名称：可点击打开 YAML（与「查看YAML」一致，当前无独立详情页） */
  function renderConfigMapNameCell(row: K8sConfigMap) {
    const name = row.metadata?.name ?? '-'
    const ns = row.metadata?.namespace ?? ''
    return h('div', { style: 'display:flex;align-items:center;min-width:0;gap:8px' }, [
      h(
        ElTooltip,
        { content: name, placement: 'top', showAfter: 300 },
        {
          default: () =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style:
                  'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:100%',
                onClick: () => void openYamlDialog('cm', ns, name)
              },
              () => name
            )
        }
      ),
      h('span', {
        class: 'icon-action',
        style:
          'flex-shrink:0;cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
        title: '复制',
        onClick: (e: MouseEvent) => {
          e.stopPropagation()
          navigator.clipboard.writeText(name)
          ElMessage.success('已复制')
        }
      }, [h(CopyDocument, { style: 'width:12px;height:12px' })])
    ])
  }

  /** Secret 名称：可点击打开 YAML */
  function renderSecretNameCell(row: K8sSecret) {
    const name = row.metadata?.name ?? '-'
    const ns = row.metadata?.namespace ?? ''
    return h('div', { style: 'display:flex;align-items:center;min-width:0;gap:8px' }, [
      h(
        ElTooltip,
        { content: name, placement: 'top', showAfter: 300 },
        {
          default: () =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style:
                  'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:100%',
                onClick: () => void openYamlDialog('sec', ns, name)
              },
              () => name
            )
        }
      ),
      h('span', {
        class: 'icon-action',
        style:
          'flex-shrink:0;cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
        title: '复制',
        onClick: (e: MouseEvent) => {
          e.stopPropagation()
          navigator.clipboard.writeText(name)
          ElMessage.success('已复制')
        }
      }, [h(CopyDocument, { style: 'width:12px;height:12px' })])
    ])
  }

  // ── YAML dialog ──
  async function openYamlDialog(k: 'cm' | 'sec', ns: string, name: string) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !ns || !name) return
    currentYamlKind.value = k
    try {
      let resource: unknown
      if (k === 'cm') resource = await fetchK8sConfigMap(cluster, ns, name)
      else resource = await fetchK8sSecret(cluster, ns, name)
      yamlText.value = yaml.dump(resource, { quotingType: '"' })
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
      if (currentYamlKind.value === 'cm') getCmData()
      else getSecData()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      yamlSaving.value = false
    }
  }

  // ── Delete resource ──
  async function deleteResource(k: 'cm' | 'sec', ns: string, name: string, refresh: () => void) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !ns || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 "${name}" 吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      if (k === 'cm') await deleteK8sConfigMap(cluster, ns, name)
      else await deleteK8sSecret(cluster, ns, name)
      ElMessage.success('删除成功')
      refresh()
    } catch {
      // user cancel
    }
  }

  // ── ConfigMap useTable ──
  type CmParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: cmColumns,
    columnChecks: cmColumnChecks,
    data: cmData,
    loading: cmLoading,
    pagination: cmPagination,
    getData: getCmData,
    replaceSearchParams: replaceCmSearchParams,
    handleSizeChange: cmHandleSizeChange,
    handleCurrentChange: cmHandleCurrentChange,
    refreshData: refreshCmData
  } = useTable({
    core: {
      immediate: true,
      apiFn: async (params: CmParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sConfigMap & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        // 拉取全部资源（不带 fieldSelector），本地模糊搜索
        const { items: allItems } = await fetchK8sConfigMapList(cluster, {
          page: 1, limit: 999999,
          namespace: selectedNamespace.value || undefined
        })
        // 本地模糊筛选
        const keyword = (params.name ?? '').trim().toLowerCase()
        const filtered = keyword
          ? allItems.filter((r) => (r.metadata?.name ?? '').toLowerCase().includes(keyword))
          : allItems
        // 本地分页
        const start = (params.current - 1) * params.size
        const end = start + params.size
        let list = filtered.slice(start, end).map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `cm-${i}` }))
        if (cmSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '', tb = b.metadata?.creationTimestamp ?? ''
            return cmSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total: filtered.length, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 200,
          formatter: (row: K8sConfigMap) => renderConfigMapNameCell(row)
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: 160,
          formatter: (row: K8sConfigMap) => {
            const labels = row.metadata?.labels ?? {}
            const lines = Object.entries(labels).map(([k, v]) => `${k}: ${v}`)
            return renderKvCell(lines)
          }
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sConfigMap) => renderNsCell(row.metadata?.namespace ?? '-')
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sConfigMap) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: K8sConfigMap) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openYamlDialog('cm', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '查看YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteResource('cm', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onCmRefresh) }, () => '删除')
            ])
        }
      ]
    }
  })

  const cmVisibleColumns = computed(() =>
    cmColumns.value.filter((c: any) => !(selectedNamespace.value && c.prop === 'metadata.namespace'))
  )
  function runCmSearch() {
    const name = (cmSearchForm.value.name ?? '').trim() || undefined
    replaceCmSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getCmData()
  }
  function forceCmSearch() {
    const name = (cmSearchForm.value.name ?? '').trim() || undefined
    replaceCmSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getCmData()
  }
  function onCmRefresh() { refreshCmData() }
  function onCmSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { cmSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getCmData() }
  }

  // ── Secret useTable ──
  type SecParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: secColumns,
    columnChecks: secColumnChecks,
    data: secData,
    loading: secLoading,
    pagination: secPagination,
    getData: getSecData,
    replaceSearchParams: replaceSecSearchParams,
    handleSizeChange: secHandleSizeChange,
    handleCurrentChange: secHandleCurrentChange,
    refreshData: refreshSecData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: SecParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sSecret & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        // 拉取全部资源（不带 fieldSelector），本地模糊搜索
        const { items: allItems } = await fetchK8sSecretList(cluster, {
          page: 1, limit: 999999,
          namespace: selectedNamespace.value || undefined
        })
        // 本地模糊筛选
        const keyword = (params.name ?? '').trim().toLowerCase()
        const filtered = keyword
          ? allItems.filter((r) => (r.metadata?.name ?? '').toLowerCase().includes(keyword))
          : allItems
        // 本地分页
        const start = (params.current - 1) * params.size
        const end = start + params.size
        let list = filtered.slice(start, end).map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `sec-${i}` }))
        if (secSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '', tb = b.metadata?.creationTimestamp ?? ''
            return secSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total: filtered.length, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 200,
          formatter: (row: K8sSecret) => renderSecretNameCell(row)
        },
        {
          prop: 'type',
          label: '类型',
          width: 280,
          showOverflowTooltip: true,
          formatter: (row: K8sSecret) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.type ?? 'Opaque')
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sSecret) => renderNsCell(row.metadata?.namespace ?? '-')
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sSecret) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation',
          label: '操作',
          width: 150,
          fixed: 'right',
          formatter: (row: K8sSecret) => {
            const isTls = row.type === 'kubernetes.io/tls'
            return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openYamlDialog('sec', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '查看YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteResource('sec', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onSecRefresh) }, () => '删除'),
              h(ArtButtonMore, {
                list: [
                  { key: 'bind', label: '关联域名', icon: 'ri:link', disabled: !isTls },
                  { key: 'unbind', label: '解除域名', icon: 'ri:link-unlink', disabled: !isTls }
                ],
                onClick: (item: ButtonMoreItem) => certMoreClick(item, row)
              })
            ])
          }
        }
      ]
    }
  })

  const secVisibleColumns = computed(() =>
    secColumns.value.filter((c: any) => !(selectedNamespace.value && c.prop === 'metadata.namespace'))
  )
  function runSecSearch() {
    const name = (secSearchForm.value.name ?? '').trim() || undefined
    replaceSecSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getSecData()
  }
  function forceSecSearch() {
    const name = (secSearchForm.value.name ?? '').trim() || undefined
    replaceSecSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getSecData()
  }
  function onSecRefresh() { refreshSecData() }
  function onSecSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { secSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getSecData() }
  }

  // ── Tab lazy loading ──
  watch(kind, (val) => {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    if (val === 'sec') getSecData()
    router.replace({ query: { ...route.query, tab: val } })
  })

  watch(
    () => String(route.query.cluster ?? ''),
    (cluster) => {
      if (!cluster) return
      if (kind.value === 'sec') getSecData()
    },
    { immediate: true }
  )

  useClusterDetailNamespaceRefresh('config', () => {
    if (kind.value === 'cm') getCmData()
    if (kind.value === 'sec') getSecData()
  })

  function refreshActiveConfigTab() {
    if (kind.value === 'cm') refreshCmData()
    else refreshSecData()
  }

  useSkipFirstActivatedRefresh(refreshActiveConfigTab)
</script>

<style>
  .config-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .config-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .config-page .art-table .el-table {
    margin-top: 10px;
    font-size: 13px;
  }
  .config-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }


  .config-page .el-tabs__header {
    margin: 0 0 4px;
    flex-shrink: 0;
  }
  .config-page .el-tabs__nav-wrap::after {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }
  .config-page .el-tabs__item {
    height: 40px;
    line-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }
  .config-page .el-tabs__item.is-active {
    color: var(--el-color-primary);
    font-weight: 600;
  }
  .config-page .el-tabs__active-bar {
    height: 2px;
    border-radius: 2px 2px 0 0;
  }

  .config-page .art-table-card {
    flex: 1;
    min-height: 0;
  }

  .config-page .art-table-card > .el-card__body {
    padding-top: 12px;
  }
</style>

<style scoped>
  .config-page {
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
  .cluster-toolbar__filters {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cluster-toolbar__ns-select {
    width: 180px;
  }
  .cluster-toolbar__search {
    width: 200px;
  }
  .cluster-toolbar-search-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .cluster-toolbar-search-btn:hover {
    border-color: var(--el-color-primary);
  }
</style>
