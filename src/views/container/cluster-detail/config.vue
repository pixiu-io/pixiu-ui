<template>
  <div class="config-page">
    <div v-if="kind === 'cm'" class="cluster-toolbar">
      <ElButton v-ripple @click="goCreateConfigMap">新建 ConfigMap</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput
          v-model="cmSearchForm.name"
          clearable
          placeholder="请输入名称"
          class="cluster-toolbar__search"
          @keyup.enter="runCmSearch"
          @clear="runCmSearch"
        />
        <div
          class="cluster-toolbar-search-btn"
          role="button"
          tabindex="0"
          title="搜索"
          @click="forceCmSearch"
          @keyup.enter="forceCmSearch"
        >
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader
          v-model:columns="cmColumnChecks"
          :loading="cmLoading"
          layout="size,columns,settings"
          @refresh="onCmRefresh"
        />
      </div>
    </div>
    <div v-else class="cluster-toolbar">
      <ElButton v-ripple @click="goCreateSecret">新建 Secret</ElButton>
      <div class="cluster-toolbar__right">
        <ElInput
          v-model="secSearchForm.name"
          clearable
          placeholder="请输入名称"
          class="cluster-toolbar__search"
          @keyup.enter="runSecSearch"
          @clear="runSecSearch"
        />
        <div
          class="cluster-toolbar-search-btn"
          role="button"
          tabindex="0"
          title="搜索"
          @click="forceSecSearch"
          @keyup.enter="forceSecSearch"
        >
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader
          v-model:columns="secColumnChecks"
          :loading="secLoading"
          layout="size,columns,settings"
          @refresh="onSecRefresh"
        />
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
      :title="certDialogMode === 'unbind' ? '解除域名' : '关联域名'"
      width="700px"
      align-center
      :close-on-click-modal="false"
      destroy-on-close
      class="cert-domain-dialog"
      header-class="cert-domain-dialog-header"
      body-class="cert-domain-dialog-body"
    >
      <ElAlert
        type="info"
        :closable="false"
        show-icon
        class="quota-alert"
        :description="
          certDialogMode === 'unbind'
            ? '解除域名和证书的绑定关系，勾选需要解除的域名，进行解绑。'
            : '关联域名可将 TLS Secret 绑定到 Ingress 的 HTTPS 证书。'
        "
      />
      <div v-if="certSecret" class="cert-domain-dialog__hint">
        <template v-if="certDialogMode === 'unbind'">
          解除 Secret <b>{{ certSecret.name }}</b
          >（{{ certSecret.namespace }}）已关联的域名
        </template>
        <template v-else>
          为 Secret <b>{{ certSecret.name }}</b
          >（{{ certSecret.namespace }}）绑定域名
        </template>
      </div>
      <ElTable
        ref="certTableRef"
        v-loading="certLoading"
        :data="certDomainOptions"
        stripe
        row-key="rowKey"
        class="cert-domain-dialog__table"
        empty-text="当前命名空间下未找到域名（Ingress）"
        @selection-change="onCertSelectionChange"
      >
        <ElTableColumn type="selection" width="30" />
        <ElTableColumn label="域名" prop="host" min-width="220" show-overflow-tooltip />
        <ElTableColumn label="命名空间" prop="namespace" width="140" show-overflow-tooltip />
        <ElTableColumn label="Ingress" prop="ingressName" min-width="160" show-overflow-tooltip />
      </ElTable>
      <template #footer>
        <ElButton @click="certDialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="certSaving"
          :disabled="certLoading || checkedDomains.length === 0"
          @click="submitBindCertificate"
          >{{ certDialogMode === 'unbind' ? '解除绑定' : '确定' }}</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog
      v-model="replaceCertVisible"
      title="替换证书"
      width="760px"
      align-center
      :close-on-click-modal="false"
      destroy-on-close
      class="replace-cert-dialog"
      header-class="cert-domain-dialog-header"
      body-class="cert-domain-dialog-body"
      @closed="resetReplaceCertForm"
    >
      <div v-if="replaceCertSecret" class="replace-cert-dialog__hint">
        替换 Secret <b>{{ replaceCertSecret.name }}</b
        >（{{ replaceCertSecret.namespace }}）的 TLS 证书与私钥
      </div>
      <div class="tls-panes">
        <div class="tls-pane">
          <div class="tls-pane-header">
            <span class="tls-pane-label">证书（tls.crt）</span>
            <ElButton link type="primary" class="kv-add-btn" @click="importReplaceCertFile('cert')"
              >文件导入</ElButton
            >
          </div>
          <ElInput
            v-model="replaceCertForm.cert"
            type="textarea"
            :rows="12"
            :class="{ 'tls-input-error': replaceCertValidated && !replaceCertForm.cert.trim() }"
            placeholder="请粘贴 PEM 格式证书内容"
          />
          <span v-if="replaceCertValidated && !replaceCertForm.cert.trim()" class="tls-field-error"
            >证书不能为空</span
          >
        </div>
        <div class="tls-pane">
          <div class="tls-pane-header">
            <span class="tls-pane-label">私钥（tls.key）</span>
            <ElButton link type="primary" class="kv-add-btn" @click="importReplaceCertFile('key')"
              >文件导入</ElButton
            >
          </div>
          <ElInput
            v-model="replaceCertForm.key"
            type="textarea"
            :rows="12"
            :class="{ 'tls-input-error': replaceCertValidated && !replaceCertForm.key.trim() }"
            placeholder="请粘贴 PEM 格式私钥内容"
          />
          <span v-if="replaceCertValidated && !replaceCertForm.key.trim()" class="tls-field-error"
            >私钥不能为空</span
          >
        </div>
      </div>
      <template #footer>
        <ElButton @click="replaceCertVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="replaceCertSaving" @click="submitReplaceCert"
          >保存</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog
      v-model="syncNsVisible"
      title="同步到命名空间"
      width="660px"
      align-center
      :close-on-click-modal="false"
      destroy-on-close
      class="sync-ns-dialog"
      header-class="cert-domain-dialog-header"
      body-class="cert-domain-dialog-body"
      footer-class="sync-ns-dialog-footer"
      @closed="resetSyncNsDialog"
    >
      <ElAlert
        type="info"
        :closable="false"
        show-icon
        class="quota-alert"
        description="将当前 Secret 同步到其他命名空间。"
      />
      <div v-if="syncNsSecret" class="sync-ns-dialog__hint">
        同步 Secret <b>{{ syncNsSecret.name }}</b
        >（源命名空间：{{ syncNsSecret.namespace }}）
      </div>
      <ElTable
        ref="syncNsTableRef"
        v-loading="syncNsLoading"
        :data="syncNsRows"
        stripe
        row-key="name"
        max-height="360"
        class="sync-ns-dialog__table"
        empty-text="暂无可用命名空间"
        @selection-change="onSyncNsSelectionChange"
      >
        <ElTableColumn type="selection" width="30" />
        <ElTableColumn label="命名空间" prop="name" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="sync-ns-cell">{{ row.name }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <span class="sync-ns-status" :class="row.exists ? 'is-exists' : 'is-empty'">{{
              row.exists ? '已存在' : '未同步'
            }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="更新时间" width="168">
          <template #default="{ row }">
            <span class="sync-ns-cell">{{ row.updateTime || '-' }}</span>
          </template>
        </ElTableColumn>
      </ElTable>
      <template #footer>
        <div class="sync-ns-dialog__footer">
          <ElCheckbox v-model="syncNsForce" class="sync-ns-force">强制同步</ElCheckbox>
          <div class="sync-ns-dialog__footer-actions">
            <ElButton @click="syncNsVisible = false">取消</ElButton>
            <ElButton
              type="primary"
              :loading="syncNsSaving"
              :disabled="syncNsLoading || !syncNsCanSubmit"
              @click="submitSyncNs"
              >确认同步</ElButton
            >
          </div>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import {
    ElAlert,
    ElButton,
    ElCard,
    ElCheckbox,
    ElDialog,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElPopover,
    ElTable,
    ElTableColumn,
    ElTabs,
    ElTabPane,
    ElTooltip
  } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import { computed, h, inject, nextTick, ref, watch } from 'vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
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
    patchK8sSecret,
    createK8sSecret,
    type K8sSecret
  } from '@/api/kubernetes/secret'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import {
    fetchK8sIngressList,
    fetchK8sIngress,
    patchK8sIngress,
    type K8sIngress
  } from '@/api/kubernetes/ingress'
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
  const certDomainOptions = ref<DomainOption[]>([])
  const checkedDomains = ref<string[]>([])
  const certTableRef = ref<{
    toggleRowSelection: (row: DomainOption, selected?: boolean) => void
    clearSelection: () => void
  } | null>(null)

  interface DomainOption {
    host: string
    ingressName: string
    namespace: string
    rowKey: string
  }

  function onCertSelectionChange(rows: DomainOption[]) {
    checkedDomains.value = rows.map((r) => r.rowKey)
  }

  async function openCertDialog(row: K8sSecret, mode: 'bind' | 'unbind' = 'bind') {
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!ns || !name) return
    certSecret.value = { name, namespace: ns }
    certDialogMode.value = mode
    certDomainOptions.value = []
    checkedDomains.value = []
    certDialogVisible.value = true
    certLoading.value = true
    try {
      const cluster = String(route.query.cluster ?? '')
      const { items } = await fetchK8sIngressList(cluster, { page: 1, limit: 9999, namespace: ns })
      const seen = new Set<string>()
      const preChecked = new Set<string>()
      const opts: DomainOption[] = []
      for (const ing of items) {
        const ingName = ing.metadata?.name ?? ''
        const ingNs = ing.metadata?.namespace ?? ns
        for (const tls of ing.spec?.tls ?? []) {
          const isBound = tls.secretName === name
          for (const host of tls.hosts ?? []) {
            if (!host || seen.has(host)) continue
            seen.add(host)
            if (mode === 'unbind' && !isBound) continue
            const rowKey = `${ingName}:${host}`
            opts.push({ host, ingressName: ingName, namespace: ingNs, rowKey })
            if (isBound) preChecked.add(rowKey)
          }
        }
        if (mode === 'bind') {
          for (const rule of ing.spec?.rules ?? []) {
            const host = rule.host
            if (!host || seen.has(host)) continue
            seen.add(host)
            opts.push({
              host,
              ingressName: ingName,
              namespace: ingNs,
              rowKey: `${ingName}:${host}`
            })
          }
        }
      }
      certDomainOptions.value = opts
      await nextTick()
      certTableRef.value?.clearSelection?.()
      for (const opt of opts) {
        if (preChecked.has(opt.rowKey)) {
          certTableRef.value?.toggleRowSelection(opt, true)
        }
      }
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
          const newHosts = hosts.filter(
            (h) =>
              !existingTls.some((t) => t.secretName === secretName && (t.hosts ?? []).includes(h))
          )
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
      ElMessage.success(
        isUnbind
          ? `已解除 ${selected.length} 个域名的证书绑定`
          : `已为 ${selected.length} 个域名绑定证书「${secretName}」`
      )
      certDialogVisible.value = false
    } catch (e: any) {
      ElMessage.error(
        e?.response?.data?.message || e?.message || (isUnbind ? '解除绑定失败' : '绑定证书失败')
      )
    } finally {
      certSaving.value = false
    }
  }

  // ── Replace TLS certificate ──
  const replaceCertVisible = ref(false)
  const replaceCertSaving = ref(false)
  const replaceCertValidated = ref(false)
  const replaceCertSecret = ref<{ name: string; namespace: string } | null>(null)
  const replaceCertForm = ref({ cert: '', key: '' })

  function openReplaceCertDialog(row: K8sSecret) {
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!ns || !name) return
    if (row.type !== 'kubernetes.io/tls') {
      ElMessage.warning('仅支持 TLS 类型 Secret 替换证书')
      return
    }
    replaceCertSecret.value = { name, namespace: ns }
    replaceCertForm.value = { cert: '', key: '' }
    replaceCertValidated.value = false
    replaceCertVisible.value = true
  }

  function resetReplaceCertForm() {
    replaceCertSecret.value = null
    replaceCertForm.value = { cert: '', key: '' }
    replaceCertValidated.value = false
    replaceCertSaving.value = false
  }

  function importReplaceCertFile(target: 'cert' | 'key') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pem,.crt,.key,.txt'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = String(e.target?.result ?? '')
        if (target === 'cert') replaceCertForm.value.cert = content
        else replaceCertForm.value.key = content
      }
      reader.readAsText(file)
    }
    input.click()
  }

  async function submitReplaceCert() {
    replaceCertValidated.value = true
    const cert = replaceCertForm.value.cert.trim()
    const key = replaceCertForm.value.key.trim()
    if (!cert || !key) return
    if (!replaceCertSecret.value) return
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.error('缺少集群参数')
      return
    }
    replaceCertSaving.value = true
    try {
      await patchK8sSecret(
        cluster,
        replaceCertSecret.value.namespace,
        replaceCertSecret.value.name,
        {
          stringData: {
            'tls.crt': cert,
            'tls.key': key
          }
        }
      )
      ElMessage.success('证书已更新')
      replaceCertVisible.value = false
      refreshSecData()
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || e?.message || '更新证书失败')
    } finally {
      replaceCertSaving.value = false
    }
  }

  function certMoreClick(item: ButtonMoreItem, row: K8sSecret) {
    if (item.key === 'bind') {
      openCertDialog(row, 'bind')
    } else if (item.key === 'unbind') {
      openCertDialog(row, 'unbind')
    } else if (item.key === 'replace') {
      openReplaceCertDialog(row)
    } else if (item.key === 'sync-ns') {
      openSyncNsDialog(row)
    }
  }

  // ── 同步到命名空间 ──
  interface SyncNsRow {
    name: string
    exists: boolean
    /** 目标命名空间已存在同名 Secret 时的创建/更新时间展示 */
    updateTime: string
  }

  const syncNsVisible = ref(false)
  const syncNsLoading = ref(false)
  const syncNsSaving = ref(false)
  /** 强制同步：已存在则覆盖为源内容，不存在则创建 */
  const syncNsForce = ref(false)
  const syncNsSecret = ref<{ name: string; namespace: string } | null>(null)
  const syncNsSource = ref<K8sSecret | null>(null)
  const syncNsRows = ref<SyncNsRow[]>([])
  /** 打开弹窗时已存在同名 Secret 的命名空间（确认时默认跳过创建） */
  const syncNsExistingSet = ref<Set<string>>(new Set())
  const syncNsChecked = ref<string[]>([])
  const syncNsTableRef = ref<{
    toggleRowSelection: (row: SyncNsRow, selected?: boolean) => void
    clearSelection: () => void
  } | null>(null)

  const syncNsCreateTargets = computed(() =>
    syncNsChecked.value.filter((ns) => !syncNsExistingSet.value.has(ns))
  )

  const syncNsCanSubmit = computed(() => {
    if (syncNsForce.value) return syncNsChecked.value.length > 0
    return syncNsCreateTargets.value.length > 0
  })

  function onSyncNsSelectionChange(rows: SyncNsRow[]) {
    syncNsChecked.value = rows.map((r) => r.name)
  }

  function resetSyncNsDialog() {
    syncNsSecret.value = null
    syncNsSource.value = null
    syncNsRows.value = []
    syncNsExistingSet.value = new Set()
    syncNsChecked.value = []
    syncNsForce.value = false
    syncNsLoading.value = false
    syncNsSaving.value = false
  }

  async function openSyncNsDialog(row: K8sSecret) {
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!ns || !name) return
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.error('缺少集群参数')
      return
    }
    syncNsSecret.value = { name, namespace: ns }
    syncNsVisible.value = true
    syncNsLoading.value = true
    syncNsRows.value = []
    syncNsChecked.value = []
    try {
      const [source, nsRes, sameNameRes] = await Promise.all([
        fetchK8sSecret(cluster, ns, name),
        fetchK8sNamespaceList(cluster, { page: 1, limit: 9999 }),
        fetchK8sSecretList(cluster, { page: 1, limit: 9999, name })
      ])
      syncNsSource.value = source
      const existingByNs = new Map<string, string>()
      for (const s of sameNameRes.items) {
        const n = s.metadata?.namespace
        if (!n) continue
        existingByNs.set(n, formatNodeCreationTime(s.metadata?.creationTimestamp))
      }
      syncNsExistingSet.value = new Set(existingByNs.keys())
      const rows: SyncNsRow[] = (nsRes.items ?? [])
        .map((item) => item.metadata?.name)
        .filter((n): n is string => !!n && n !== ns)
        .sort((a, b) => a.localeCompare(b))
        .map((n) => ({
          name: n,
          exists: existingByNs.has(n),
          updateTime: existingByNs.get(n) ?? ''
        }))
      syncNsRows.value = rows
      await nextTick()
      syncNsTableRef.value?.clearSelection?.()
      for (const r of rows) {
        if (r.exists) syncNsTableRef.value?.toggleRowSelection(r, true)
      }
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || e?.message || '加载命名空间失败')
      syncNsVisible.value = false
    } finally {
      syncNsLoading.value = false
    }
  }

  async function submitSyncNs() {
    if (!syncNsSecret.value || !syncNsSource.value) return
    const checked = syncNsChecked.value
    if (!checked.length) {
      ElMessage.warning('请选择命名空间')
      return
    }
    const force = syncNsForce.value
    const createTargets = syncNsCreateTargets.value
    const updateTargets = force
      ? checked.filter((ns) => syncNsExistingSet.value.has(ns))
      : []
    const targets = force ? checked : createTargets
    if (!targets.length) {
      ElMessage.warning(force ? '请选择命名空间' : '没有需要新建的命名空间')
      return
    }
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.error('缺少集群参数')
      return
    }
    const source = syncNsSource.value
    const secretName = syncNsSecret.value.name
    const bodyBase = {
      apiVersion: 'v1',
      kind: 'Secret',
      type: source.type || 'Opaque',
      data: source.data ?? {},
      metadata: {
        name: secretName,
        labels: source.metadata?.labels,
        annotations: source.metadata?.annotations
      }
    }
    const patchBody = {
      type: source.type || 'Opaque',
      data: source.data ?? {},
      metadata: {
        labels: source.metadata?.labels,
        annotations: source.metadata?.annotations
      }
    }
    syncNsSaving.value = true
    try {
      const results = await Promise.allSettled(
        targets.map((targetNs) => {
          if (syncNsExistingSet.value.has(targetNs)) {
            return patchK8sSecret(cluster, targetNs, secretName, patchBody)
          }
          return createK8sSecret(cluster, targetNs, {
            ...bodyBase,
            metadata: { ...bodyBase.metadata, namespace: targetNs }
          })
        })
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      if (fail === 0) {
        if (force && updateTargets.length > 0 && createTargets.length > 0) {
          ElMessage.success(
            `已创建 ${createTargets.length} 个、覆盖更新 ${updateTargets.length} 个命名空间`
          )
        } else if (force && updateTargets.length > 0) {
          ElMessage.success(`已覆盖更新 ${ok} 个命名空间`)
        } else {
          ElMessage.success(`已同步到 ${ok} 个命名空间`)
        }
        syncNsVisible.value = false
      } else if (ok > 0) {
        ElMessage.warning(`成功 ${ok} 个，失败 ${fail} 个`)
      } else {
        const firstErr = results.find((r) => r.status === 'rejected') as
          | PromiseRejectedResult
          | undefined
        ElMessage.error(
          (firstErr?.reason as any)?.response?.data?.message ||
            (firstErr?.reason as Error)?.message ||
            '同步失败'
        )
      }
      refreshSecData()
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || e?.message || '同步失败')
    } finally {
      syncNsSaving.value = false
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
          {
            key: `f${i}`,
            style:
              'font-size:12px;font-weight:400;line-height:1.8;color:var(--el-text-color-regular);white-space:nowrap'
          },
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
      h(
        'span',
        {
          class: 'icon-action',
          style:
            'flex-shrink:0;cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
          title: '复制',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            navigator.clipboard.writeText(name)
            ElMessage.success('已复制')
          }
        },
        [h(CopyDocument, { style: 'width:12px;height:12px' })]
      )
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
      h(
        'span',
        {
          class: 'icon-action',
          style:
            'flex-shrink:0;cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
          title: '复制',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            navigator.clipboard.writeText(name)
            ElMessage.success('已复制')
          }
        },
        [h(CopyDocument, { style: 'width:12px;height:12px' })]
      )
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
        if (!cluster)
          return {
            code: 200,
            data: {
              records: [] as (K8sConfigMap & { rowKey: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        // 拉取全部资源（不带 fieldSelector），本地模糊搜索
        const { items: allItems } = await fetchK8sConfigMapList(cluster, {
          page: 1,
          limit: 999999,
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
        let list = filtered
          .slice(start, end)
          .map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `cm-${i}` }))
        if (cmSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '',
              tb = b.metadata?.creationTimestamp ?? ''
            return cmSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return {
          code: 200,
          data: {
            records: list,
            total: filtered.length,
            current: params.current,
            size: params.size
          }
        }
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
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: K8sConfigMap) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void openYamlDialog(
                      'cm',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? ''
                    )
                },
                () => '查看YAML'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void deleteResource(
                      'cm',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? '',
                      onCmRefresh
                    )
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const cmVisibleColumns = computed(() =>
    cmColumns.value.filter(
      (c: any) => !(selectedNamespace.value && c.prop === 'metadata.namespace')
    )
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
  function onCmRefresh() {
    refreshCmData()
  }
  function onCmSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') {
      cmSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null
      getCmData()
    }
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
        if (!cluster)
          return {
            code: 200,
            data: {
              records: [] as (K8sSecret & { rowKey: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        // 拉取全部资源（不带 fieldSelector），本地模糊搜索
        const { items: allItems } = await fetchK8sSecretList(cluster, {
          page: 1,
          limit: 999999,
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
        let list = filtered
          .slice(start, end)
          .map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `sec-${i}` }))
        if (secSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '',
              tb = b.metadata?.creationTimestamp ?? ''
            return secSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return {
          code: 200,
          data: {
            records: list,
            total: filtered.length,
            current: params.current,
            size: params.size
          }
        }
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
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.type ?? 'Opaque'
            )
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
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 150,
          fixed: 'right',
          formatter: (row: K8sSecret) => {
            const isTls = row.type === 'kubernetes.io/tls'
            return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void openYamlDialog(
                      'sec',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? ''
                    )
                },
                () => '查看YAML'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void deleteResource(
                      'sec',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? '',
                      onSecRefresh
                    )
                },
                () => '删除'
              ),
              h(ArtButtonMore, {
                list: [
                  { key: 'bind', label: '关联域名', icon: 'ri:link', disabled: !isTls },
                  { key: 'unbind', label: '解除域名', icon: 'ri:link-unlink', disabled: !isTls },
                  {
                    key: 'replace',
                    label: '替换证书',
                    icon: 'ri:file-shield-2-line',
                    disabled: !isTls
                  },
                  { key: 'sync-ns', label: '同步到命名空间', icon: 'ri:share-forward-box-line' }
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
    secColumns.value.filter(
      (c: any) => !(selectedNamespace.value && c.prop === 'metadata.namespace')
    )
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
  function onSecRefresh() {
    refreshSecData()
  }
  function onSecSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') {
      secSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null
      getSecData()
    }
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

  .cert-domain-dialog__hint {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }

  .cert-domain-dialog__table {
    width: 100%;
    max-height: 420px;
  }

  .cert-domain-dialog__table :deep(.el-table__cell) {
    font-size: 13px;
  }

  .cert-domain-dialog__table :deep(.el-table__empty-text) {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 50px;
  }

  /* 与集群列表/Secret 列表一致：selection 宽 30，不额外加大左右 padding */
  .cert-domain-dialog__table :deep(.el-table-column--selection .cell) {
    padding-left: 10px;
    padding-right: 0;
  }

  /* 与配额管理弹窗一致：header / body / 说明栏上下距 */
  :global(.cert-domain-dialog-header) {
    padding: 10px 24px 0 !important;
    margin-bottom: 0 !important;
  }

  :global(.cert-domain-dialog-body) {
    padding: 0 24px 12px !important;
  }

  .replace-cert-dialog__hint {
    margin: 15px 0 12px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }

  .tls-panes {
    display: flex;
    gap: 16px;
    width: 100%;
  }

  .tls-pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tls-pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .tls-pane-label {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .kv-add-btn {
    font-size: 12px;
    padding: 0;
    height: auto;
    align-self: flex-start;
  }

  .tls-input-error :deep(.el-textarea__inner) {
    border-color: var(--el-color-danger) !important;
  }

  .tls-field-error {
    font-size: 12px;
    color: var(--el-color-danger);
  }

  .sync-ns-dialog__hint {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 400;
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }

  .sync-ns-dialog__hint b {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .sync-ns-dialog__table {
    width: 100%;
  }

  .sync-ns-dialog__table :deep(.el-table) {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .sync-ns-dialog__table :deep(.el-table th.el-table__cell) {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }

  .sync-ns-dialog__table :deep(.el-table td.el-table__cell) {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .sync-ns-dialog__table :deep(.el-table__empty-text) {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .sync-ns-dialog__table :deep(.el-table-column--selection .cell) {
    padding-left: 10px;
    padding-right: 0;
  }

  .sync-ns-cell {
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }

  .sync-ns-status {
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
  }

  .sync-ns-status.is-exists {
    color: var(--el-color-success);
  }

  .sync-ns-status.is-empty {
    color: var(--el-text-color-secondary);
  }

  .sync-ns-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
  }

  .sync-ns-dialog__footer-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  /* 与 body 左右 24px、表格 selection cell padding-left 10px 对齐 */
  :global(.sync-ns-dialog-footer) {
    padding: 8px 24px 16px !important;
  }

  .sync-ns-force {
    margin-left: 10px;
    height: auto;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .sync-ns-force :deep(.el-checkbox__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
    padding-left: 8px;
  }
</style>
