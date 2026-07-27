<template>
  <div class="ing-create-page">
    <div class="ing-create-header">
      <ElButton text class="ing-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="ing-create-header-divider" />
      <ClusterResourceBreadcrumb
        parent-path="/container/services"
        parent-label="服务与路由"
        :current-label="isEdit ? '更新 Ingress' : '创建 Ingress'"
      />
    </div>

    <ElCard class="ing-create-card">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="140px" class="ing-form">
        <!-- ── 基本信息 ── -->
        <ElDivider content-position="left" class="ing-section-divider-top">基本信息</ElDivider>

        <ElFormItem label="Ingress 名称" prop="name">
          <div class="ing-field-col">
            <ElInput
              v-model="form.name"
              placeholder="请输入 Ingress 名称"
              style="width: 300px"
              :disabled="isEdit"
            />
            <div class="ing-field-tip"
              >最长 63
              个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="命名空间" prop="namespace">
          <ElSelect
            v-model="form.namespace"
            filterable
            placeholder="请选择命名空间"
            style="width: 300px"
            :disabled="isEdit"
            @change="onNamespaceChange"
          >
            <ElOption v-for="ns in namespaces" :key="ns" :label="ns" :value="ns" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="Annotations">
          <div class="ing-field-col">
            <div class="kv-list">
              <div v-for="(item, idx) in form.annotations" :key="`ann-${idx}`" class="kv-row">
                <ElInput v-model="item.key" placeholder="key" />
                <ElInput v-model="item.value" placeholder="value" />
                <ElButton link class="kv-del-btn" @click="form.annotations.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
              <ElButton
                link
                type="primary"
                class="kv-add-btn"
                @click="form.annotations.push({ key: '', value: '' })"
                >新增</ElButton
              >
            </div>
            <div class="ing-field-tip">值为字符串类型，常用于配置 Nginx 等控制器的行为</div>
          </div>
        </ElFormItem>

        <ElFormItem label="IngressClass">
          <div class="ing-field-col">
            <ElInput
              v-model="form.ingressClassName"
              placeholder="输入 ingressClass"
              style="width: 300px"
            />
            <div class="ing-field-tip"
              >对应 IngressClass 资源名称，留空则使用集群默认 Ingress 控制器</div
            >
          </div>
        </ElFormItem>

        <!-- ── 转发规则相关配置 ── -->
        <ElDivider content-position="left">转发规则相关配置</ElDivider>

        <ElFormItem label="转发规则" prop="rules">
          <div class="ing-field-col" style="width: 100%">
            <div v-if="form.rules.length" class="rule-table-box">
              <div class="rule-table-header">
                <span class="rule-col-proto">协议</span>
                <span class="rule-col-listen">监听端口</span>
                <span class="rule-col-host">域名</span>
                <span class="rule-col-path">路径</span>
                <span class="rule-col-svc">后端服务</span>
                <span class="rule-col-port">服务端口</span>
                <span class="rule-col-action"></span>
              </div>
              <div v-for="(rule, idx) in form.rules" :key="`rule-${idx}`" class="rule-table-row">
                <ElSelect
                  v-model="rule.protocol"
                  class="rule-col-proto"
                  @change="(v: string) => onRuleProtoChange(rule, v)"
                >
                  <ElOption label="HTTP" value="HTTP" />
                  <ElOption label="HTTPS" value="HTTPS" />
                </ElSelect>
                <ElInput
                  v-model="rule.listenPort"
                  :class="['rule-col-listen', { 'rule-cell-error': ruleErrors[idx]?.listenPort }]"
                  placeholder="端口"
                  @input="
                    (v: string) => {
                      rule.listenPort = v.replace(/\D/g, '')
                      clearRuleError(idx, 'listenPort')
                    }
                  "
                />
                <ElInput
                  v-model="rule.host"
                  :class="['rule-col-host', { 'rule-cell-error': ruleErrors[idx]?.host }]"
                  placeholder="请输入域名"
                  @input="clearRuleError(idx, 'host')"
                />
                <ElInput
                  v-model="rule.path"
                  :class="['rule-col-path', { 'rule-cell-error': ruleErrors[idx]?.path }]"
                  placeholder="eg: /"
                  @input="clearRuleError(idx, 'path')"
                />
                <ElSelect
                  v-model="rule.serviceName"
                  :class="['rule-col-svc', { 'rule-cell-error': ruleErrors[idx]?.serviceName }]"
                  :loading="svcLoading"
                  clearable
                  placeholder="选择 Service"
                  @change="
                    (v: string) => {
                      onRuleSvcChange(rule, v)
                      clearRuleError(idx, 'serviceName')
                    }
                  "
                >
                  <ElOption
                    v-for="svc in serviceOptions"
                    :key="svc.name"
                    :label="svc.name"
                    :value="svc.name"
                  />
                </ElSelect>
                <ElSelect
                  v-model="rule.servicePort"
                  :class="['rule-col-port', { 'rule-cell-error': ruleErrors[idx]?.servicePort }]"
                  :disabled="!rule.serviceName"
                  placeholder="请输入服务端口"
                  allow-create
                  filterable
                  @change="clearRuleError(idx, 'servicePort')"
                >
                  <ElOption
                    v-for="port in getServicePorts(rule.serviceName)"
                    :key="port"
                    :label="port"
                    :value="port"
                  />
                </ElSelect>
                <ElButton link class="kv-del-btn rule-col-action" @click="removeRule(idx)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
            </div>
            <ElButton link type="primary" class="kv-add-btn" @click="addRule"
              >添加转发规则</ElButton
            >
            <div class="ing-field-tip">每条规则由域名+路径映射到一个 Service 的指定端口</div>
          </div>
        </ElFormItem>

        <ElFormItem label="TLS配置" class="tls-form-item">
          <div class="ing-field-col tls-field-col" style="width: 100%">
            <ElSwitch v-model="form.tlsEnabled" @change="onTlsEnabledChange" />
            <template v-if="form.tlsEnabled">
              <div v-if="form.tlsEntries.length" class="tls-table-box">
                <div class="tls-table-header">
                  <span class="tls-col-host">域名</span>
                  <span class="tls-col-secret">保密字典</span>
                </div>
                <div
                  v-for="(tls, idx) in form.tlsEntries"
                  :key="`tls-${idx}`"
                  class="tls-table-row"
                >
                  <ElSelect
                    v-model="tls.hosts"
                    :class="['tls-col-host', { 'rule-cell-error': tlsErrors[idx]?.hosts }]"
                    placeholder="请选择域名"
                    filterable
                    clearable
                    @change="clearTlsError(idx, 'hosts')"
                  >
                    <ElOption
                      v-for="h in tlsHostOptions"
                      :key="h"
                      :label="h"
                      :value="h"
                      :disabled="isTlsHostUsed(h, idx)"
                    />
                  </ElSelect>
                  <div class="tls-col-secret tls-secret-controls">
                    <ElSelect
                      v-model="tls.secretName"
                      :class="[
                        'tls-secret-select',
                        { 'rule-cell-error': tlsErrors[idx]?.secretName }
                      ]"
                      placeholder="请选择 TLS Secret"
                      filterable
                      clearable
                      :loading="tlsSecretLoading"
                      @change="clearTlsError(idx, 'secretName')"
                    >
                      <ElOption
                        v-for="s in tlsSecrets"
                        :key="s"
                        :label="s"
                        :value="s"
                        :disabled="isTlsSecretUsed(s, idx)"
                      />
                    </ElSelect>
                    <div class="tls-icon-group">
                      <ElButton link class="tls-icon-btn" title="刷新" @click="loadTlsSecrets">
                        <ElIcon><Refresh /></ElIcon>
                      </ElButton>
                      <ElButton link class="tls-icon-btn" title="删除" @click="removeTls(idx)">
                        <ElIcon><Close /></ElIcon>
                      </ElButton>
                    </div>
                  </div>
                </div>
              </div>
              <ElButton link type="primary" class="kv-add-btn" @click="addTls"
                >添加 TLS 配置</ElButton
              >
            </template>
          </div>
        </ElFormItem>
      </ElForm>

      <div class="ing-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">{{
          isEdit ? '更新 Ingress' : '创建 Ingress'
        }}</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close, Refresh } from '@element-plus/icons-vue'
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sIngress, patchK8sIngress, fetchK8sIngress } from '@/api/kubernetes/ingress'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { fetchK8sSecretList } from '@/api/kubernetes/secret'
  import { fetchK8sServiceList, type K8sService } from '@/api/kubernetes/service'
  import ClusterResourceBreadcrumb from '../components/cluster-resource-breadcrumb.vue'

  defineOptions({ name: 'IngressCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))
  const editName = computed(() => String(route.query.name ?? '').trim())
  const isEdit = computed(() => Boolean(editName.value))

  const namespaces = ref<string[]>([])
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const tlsSecrets = ref<string[]>([])
  const tlsSecretLoading = ref(false)

  type RuleEntry = {
    protocol: 'HTTP' | 'HTTPS'
    listenPort: string
    host: string
    path: string
    serviceName: string
    servicePort: string | number
  }

  type TlsEntry = {
    hosts: string
    secretName: string
  }

  const form = ref({
    name: '',
    namespace: '',
    ingressClassName: '',
    annotations: [] as Array<{ key: string; value: string }>,
    tlsEnabled: false,
    tlsEntries: [] as TlsEntry[],
    rules: [
      {
        protocol: 'HTTP' as 'HTTP' | 'HTTPS',
        listenPort: '80',
        host: '',
        path: '',
        serviceName: '',
        servicePort: '' as string | number
      }
    ] as RuleEntry[]
  })

  type RuleError = Partial<
    Record<'listenPort' | 'host' | 'path' | 'serviceName' | 'servicePort', boolean>
  >
  const ruleErrors = ref<RuleError[]>([{}])

  type TlsError = Partial<Record<'hosts' | 'secretName', boolean>>
  const tlsErrors = ref<TlsError[]>([])

  /** 转发规则中已填写的域名，供 TLS 域名下拉使用 */
  const tlsHostOptions = computed(() => {
    const set = new Set<string>()
    for (const r of form.value.rules) {
      const host = r.host.trim()
      if (host) set.add(host)
    }
    return [...set]
  })

  function isTlsSecretUsed(secret: string, currentIdx: number) {
    return form.value.tlsEntries.some(
      (t, i) => i !== currentIdx && t.secretName.trim() === secret
    )
  }

  function isTlsHostUsed(host: string, currentIdx: number) {
    return form.value.tlsEntries.some(
      (t, i) => i !== currentIdx && t.hosts.trim() === host
    )
  }

  function clearTlsError(idx: number, field: keyof TlsError) {
    if (tlsErrors.value[idx]) tlsErrors.value[idx][field] = false
  }

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入 Ingress 名称', trigger: 'blur' },
      { min: 1, max: 63, message: '长度 1-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }]
  }

  // ── 命名空间内的 Service 列表 ──
  const serviceOptions = ref<Array<{ name: string; ports: Array<string | number> }>>([])
  const svcLoading = ref(false)

  async function loadServices(ns: string) {
    if (!cluster.value || !ns) {
      serviceOptions.value = []
      return
    }
    svcLoading.value = true
    try {
      const { items } = await fetchK8sServiceList(cluster.value, {
        page: 1,
        limit: 999999,
        namespace: ns
      })
      serviceOptions.value = items.map((s: K8sService) => ({
        name: s.metadata?.name ?? '',
        ports: (s.spec?.ports ?? []).map((p) => p.port ?? p.name ?? '').filter(Boolean)
      }))
    } catch {
      serviceOptions.value = []
    } finally {
      svcLoading.value = false
    }
  }

  function getServicePorts(svcName: string): Array<string | number> {
    return serviceOptions.value.find((s) => s.name === svcName)?.ports ?? []
  }

  function onRuleProtoChange(rule: RuleEntry, proto: string) {
    rule.listenPort = proto === 'HTTPS' ? '443' : '80'
  }

  function onRuleSvcChange(rule: RuleEntry, svcName: string) {
    rule.servicePort = ''
    const ports = getServicePorts(svcName)
    if (ports.length === 1) rule.servicePort = ports[0]
  }

  function onNamespaceChange(ns: string) {
    void loadServices(ns)
    void loadTlsSecrets()
    // clear per-rule service selections when namespace changes
    form.value.rules.forEach((r) => {
      r.serviceName = ''
      r.servicePort = ''
    })
    form.value.tlsEntries.forEach((t) => {
      t.secretName = ''
    })
  }

  async function loadTlsSecrets() {
    const ns = form.value.namespace
    if (!cluster.value || !ns) {
      tlsSecrets.value = []
      return
    }
    tlsSecretLoading.value = true
    try {
      const { items } = await fetchK8sSecretList(cluster.value, {
        page: 1,
        limit: 999999,
        namespace: ns
      })
      tlsSecrets.value = items
        .filter((s) => s.type === 'kubernetes.io/tls')
        .map((s) => s.metadata?.name ?? '')
        .filter(Boolean)
        .sort()
    } catch {
      tlsSecrets.value = []
    } finally {
      tlsSecretLoading.value = false
    }
  }

  function onTlsEnabledChange(enabled: boolean | string | number) {
    if (enabled) {
      if (!form.value.tlsEntries.length) addTls()
      tlsErrors.value = form.value.tlsEntries.map(() => ({}))
      void loadTlsSecrets()
    } else {
      form.value.tlsEntries = []
      tlsErrors.value = []
    }
  }

  function removeTls(idx: number) {
    form.value.tlsEntries.splice(idx, 1)
    tlsErrors.value.splice(idx, 1)
    if (!form.value.tlsEntries.length) addTls()
  }

  function clearRuleError(idx: number, field: keyof RuleError) {
    if (ruleErrors.value[idx]) ruleErrors.value[idx][field] = false
  }

  function removeRule(idx: number) {
    form.value.rules.splice(idx, 1)
    ruleErrors.value.splice(idx, 1)
  }

  function addRule() {
    form.value.rules.push({
      protocol: 'HTTP',
      listenPort: '80',
      host: '',
      path: '',
      serviceName: '',
      servicePort: ''
    })
    ruleErrors.value.push({})
  }

  function addTls() {
    form.value.tlsEntries.push({ hosts: '', secretName: '' })
    tlsErrors.value.push({})
  }

  function kvToObj(list: Array<{ key: string; value: string }>): Record<string, string> {
    return list.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = key.trim()
      if (k) acc[k] = value.trim()
      return acc
    }, {})
  }

  function buildManifest() {
    const f = form.value
    const annotations = kvToObj(f.annotations)

    const specRules = f.rules
      .filter((r) => r.path.trim() || r.host.trim() || r.serviceName)
      .map((r) => {
        const port =
          typeof r.servicePort === 'number'
            ? { number: r.servicePort }
            : /^\d+$/.test(String(r.servicePort))
              ? { number: parseInt(String(r.servicePort)) }
              : { name: String(r.servicePort) }
        const entry: Record<string, unknown> = {
          http: {
            paths: [
              {
                path: r.path.trim() || '/',
                pathType: 'Prefix',
                backend: r.serviceName ? { service: { name: r.serviceName, port } } : undefined
              }
            ]
          }
        }
        if (r.host.trim()) entry.host = r.host.trim()
        return entry
      })

    const tls = f.tlsEnabled
      ? f.tlsEntries
          .filter((t) => t.hosts.trim() && t.secretName.trim())
          .map((t) => ({
            hosts: t.hosts
              .split(',')
              .map((h) => h.trim())
              .filter(Boolean),
            secretName: t.secretName.trim()
          }))
      : []

    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: f.name.trim(),
        namespace: f.namespace,
        ...(Object.keys(annotations).length ? { annotations } : {})
      },
      spec: {
        ...(f.ingressClassName.trim() ? { ingressClassName: f.ingressClassName.trim() } : {}),
        // 更新时需显式带上 tls（含空数组）以便清空原配置
        ...(f.tlsEnabled || isEdit.value ? { tls } : {}),
        rules: specRules.length ? specRules : undefined
      }
    }
  }

  async function submit() {
    const valid = await formRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return
    if (!cluster.value) {
      ElMessage.warning('缺少集群参数')
      return
    }

    // validate rule rows
    let ruleValid = true
    const newErrors: RuleError[] = form.value.rules.map((r) => {
      const e: RuleError = {}
      if (!r.listenPort.trim()) {
        e.listenPort = true
        ruleValid = false
      }
      if (!r.host.trim()) {
        e.host = true
        ruleValid = false
      }
      if (!r.path.trim()) {
        e.path = true
        ruleValid = false
      }
      if (!r.serviceName) {
        e.serviceName = true
        ruleValid = false
      }
      if (r.servicePort === '' || r.servicePort === null || r.servicePort === undefined) {
        e.servicePort = true
        ruleValid = false
      }
      return e
    })
    ruleErrors.value = newErrors
    if (!ruleValid) {
      ElMessage.warning('请完善转发规则中的必填项')
      return
    }
    if (form.value.tlsEnabled) {
      if (!tlsHostOptions.value.length) {
        ElMessage.warning('请先在转发规则中填写域名，再配置 TLS')
        return
      }
      if (!tlsSecrets.value.length) {
        ElMessage.warning('当前命名空间下无可用 TLS Secret，请先创建后再配置')
        return
      }
      if (!form.value.tlsEntries.length) {
        ElMessage.warning('请至少添加一条 TLS 配置')
        return
      }
      let tlsValid = true
      tlsErrors.value = form.value.tlsEntries.map((t) => {
        const e: TlsError = {}
        if (!t.hosts.trim()) {
          e.hosts = true
          tlsValid = false
        }
        if (!t.secretName.trim()) {
          e.secretName = true
          tlsValid = false
        }
        return e
      })
      if (!tlsValid) {
        ElMessage.warning('TLS 配置中的域名和保密字典不能为空')
        return
      }
    }
    submitting.value = true
    try {
      const manifest = buildManifest()
      if (isEdit.value) {
        await patchK8sIngress(cluster.value, form.value.namespace, editName.value, {
          metadata: {
            annotations: (manifest.metadata as { annotations?: Record<string, string> }).annotations
          },
          spec: (manifest as { spec: object }).spec
        })
        ElMessage.success(`Ingress（${form.value.name}）更新成功`)
      } else {
        await createK8sIngress(
          cluster.value,
          form.value.namespace,
          manifest as Parameters<typeof createK8sIngress>[2]
        )
        ElMessage.success(`Ingress（${form.value.name}）创建成功`)
      }
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : isEdit.value ? '更新失败' : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({
      path: '/container/services',
      query: { cluster: cluster.value, tab: 'ing' }
    })
  }

  async function loadNamespaces() {
    if (!cluster.value) return
    try {
      const { items } = await fetchK8sNamespaceList(cluster.value, { page: 1, limit: 500 })
      namespaces.value = items.map((n) => n.metadata.name).sort()
    } catch {
      namespaces.value = []
    }
    form.value.namespace = defaultNamespace.value || namespaces.value[0] || 'default'
    if (form.value.namespace) {
      void loadServices(form.value.namespace)
      void loadTlsSecrets()
    }
  }

  async function loadExistingIngress() {
    if (!isEdit.value || !cluster.value) return
    const ns = defaultNamespace.value || form.value.namespace
    if (!ns) return
    try {
      const ing = await fetchK8sIngress(cluster.value, ns, editName.value)
      form.value.name = ing.metadata?.name ?? editName.value
      form.value.namespace = ing.metadata?.namespace ?? ns
      form.value.ingressClassName = ing.spec?.ingressClassName ?? ''
      const anns = ing.metadata?.annotations ?? {}
      form.value.annotations = Object.entries(anns).map(([key, value]) => ({ key, value }))
      const tlsList = ing.spec?.tls ?? []
      if (tlsList.length) {
        form.value.tlsEnabled = true
        form.value.tlsEntries = tlsList.flatMap((t) => {
          const hosts = (t.hosts ?? []).filter(Boolean)
          if (!hosts.length) {
            return [{ hosts: '', secretName: t.secretName ?? '' }]
          }
          return hosts.map((h) => ({ hosts: h, secretName: t.secretName ?? '' }))
        })
        tlsErrors.value = form.value.tlsEntries.map(() => ({}))
      } else {
        form.value.tlsEnabled = false
        form.value.tlsEntries = []
        tlsErrors.value = []
      }
      const loadedRules: RuleEntry[] = []
      for (const rule of ing.spec?.rules ?? []) {
        const paths = rule.http?.paths ?? []
        if (!paths.length) {
          loadedRules.push({
            protocol: 'HTTP',
            listenPort: '80',
            host: rule.host ?? '',
            path: '/',
            serviceName: '',
            servicePort: ''
          })
          continue
        }
        for (const p of paths) {
          const port = p.backend?.service?.port
          loadedRules.push({
            protocol: 'HTTP',
            listenPort: '80',
            host: rule.host ?? '',
            path: p.path ?? '/',
            serviceName: p.backend?.service?.name ?? '',
            servicePort: port?.number ?? port?.name ?? ''
          })
        }
      }
      if (loadedRules.length) {
        form.value.rules = loadedRules
        ruleErrors.value = loadedRules.map(() => ({}))
      }
      await loadServices(form.value.namespace)
      await loadTlsSecrets()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载 Ingress 失败')
    }
  }

  onMounted(async () => {
    await loadNamespaces()
    if (isEdit.value) await loadExistingIngress()
  })
</script>

<style scoped>
  .ing-create-page {
    padding: 0 clamp(16px, 4vw, 48px) 0;
  }

  .ing-create-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
    margin-left: calc(-1 * clamp(16px, 4vw, 48px));
  }

  .ing-create-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px 0 2px;
  }

  .ing-create-header-divider {
    margin: 0 12px;
    height: 16px;
  }

  .ing-create-card :deep(.el-card__body) {
    padding: 16px 20px;
  }

  /* ── Form ── */
  .ing-form {
    max-width: 960px;
    padding-top: 4px;
  }

  .ing-form :deep(.el-form-item) {
    margin-bottom: 22px;
  }

  .ing-form :deep(.el-form-item__label) {
    font-size: 12px;
    padding-right: 16px;
    color: var(--el-text-color-regular);
  }

  .ing-form :deep(.el-form-item__content) {
    align-items: flex-start;
  }

  .ing-form :deep(.el-input__inner),
  .ing-form :deep(.el-select__placeholder),
  .ing-form :deep(.el-select__selected-item),
  .ing-form :deep(.el-radio__label),
  .ing-form :deep(.el-checkbox__label) {
    font-size: 12px;
  }

  .ing-form :deep(.el-input__placeholder) {
    font-size: 12px;
  }

  .ing-section-divider-top {
    margin-top: 5px;
  }

  /* ── Field col ── */
  .ing-field-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
  }

  .ing-field-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }

  /* ── KV list ── */
  .kv-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
  }

  .kv-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kv-row :deep(.el-input) {
    width: 200px;
    flex-shrink: 0;
  }

  .kv-del-btn {
    padding: 4px;
    color: var(--el-text-color-secondary);
  }

  .kv-del-btn:hover {
    color: var(--el-color-danger);
  }

  .kv-add-btn {
    font-size: 12px;
    padding: 0;
    height: auto;
    align-self: flex-start;
  }

  /* ── TLS ── */
  .tls-form-item {
    align-items: flex-start;
  }

  /* 与「转发规则」等表单项标签同宽右对齐，并与开关垂直居中 */
  .tls-form-item :deep(.el-form-item__label) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 32px;
    line-height: 32px;
    padding: 0 16px 0 0;
    box-sizing: border-box;
  }

  .tls-form-item :deep(.el-form-item__content) {
    align-items: flex-start;
    min-height: 32px;
    line-height: 32px;
  }

  .tls-field-col {
    gap: 8px;
  }

  .tls-field-col > :deep(.el-switch) {
    height: 32px;
    margin: 2px 0 0;
    display: inline-flex;
    align-items: center;
  }

  .tls-table-box {
    width: 100%;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    overflow: hidden;
    background: var(--el-bg-color-overlay);
    margin-bottom: 6px;
  }

  .tls-table-header,
  .tls-table-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    box-sizing: border-box;
  }

  .tls-table-header {
    background: var(--el-fill-color-light);
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }

  .tls-table-row {
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .tls-col-host {
    flex: 1 1 0;
    min-width: 140px;
    font-size: 12px;
  }

  .tls-col-secret {
    flex: 1 1 0;
    min-width: 180px;
    font-size: 12px;
  }

  .tls-secret-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .tls-secret-select {
    flex: 1 1 auto;
    min-width: 0;
  }

  .tls-icon-group {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .tls-icon-btn {
    padding: 4px;
    margin: 0 !important;
    color: var(--el-text-color-secondary);
  }

  .tls-icon-group :deep(.el-button + .el-button) {
    margin-left: 0 !important;
  }

  .tls-icon-btn:hover {
    color: var(--el-color-primary);
  }

  .tls-icon-btn + .tls-icon-btn:hover {
    color: var(--el-color-danger);
  }

  /* ── Rule table ── */
  .rule-table-box {
    width: 100%;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    overflow: hidden;
    background: var(--el-bg-color-overlay);
    margin-bottom: 6px;
  }

  .rule-table-header,
  .rule-table-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
  }

  .rule-table-header {
    background: var(--el-fill-color-light);
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }

  .rule-table-row {
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .rule-col-proto {
    width: 90px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .rule-col-listen {
    width: 90px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .rule-col-host {
    width: 160px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .rule-col-path {
    width: 110px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .rule-col-svc {
    width: 160px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .rule-col-port {
    width: 120px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .rule-col-action {
    width: 28px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .rule-cell-error :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset !important;
  }

  .rule-cell-error :deep(.el-select__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset !important;
  }

  /* ── Footer ── */
  .ing-create-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
</style>
