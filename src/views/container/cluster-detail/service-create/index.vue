<template>
  <div class="svc-create-page">
    <div class="svc-create-header">
      <ElButton text class="svc-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="svc-create-header-divider" />
      <ClusterResourceBreadcrumb
        parent-path="/container/services"
        parent-label="服务与路由"
        current-label="创建 Service"
      />
    </div>

    <ElCard class="svc-create-card">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="140px" class="svc-form">
        <!-- ── 基础配置 ── -->
        <ElDivider content-position="left" class="svc-section-divider-top">基础配置</ElDivider>

        <ElFormItem label="名称" prop="name">
          <div class="svc-field-col">
            <ElInput v-model="form.name" placeholder="请输入 Service 名称" style="width: 300px" />
            <div class="svc-field-tip"
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
          >
            <ElOption v-for="ns in namespaces" :key="ns" :label="ns" :value="ns" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="Labels">
          <div class="svc-field-col">
            <div class="kv-list">
              <div v-for="(item, idx) in form.labels" :key="`lbl-${idx}`" class="kv-row">
                <ElInput v-model="item.key" placeholder="key" />
                <ElInput v-model="item.value" placeholder="value" />
                <ElButton link class="kv-del-btn" @click="form.labels.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
              <ElButton
                link
                type="primary"
                class="kv-add-btn"
                @click="form.labels.push({ key: '', value: '' })"
                >新增</ElButton
              >
            </div>
            <div class="svc-field-tip"
              >键名不超过 63 个字符，只能包含字母、数字及分隔符（- _
              .），且必须以字母或数字开头和结尾</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="Annotations">
          <div class="svc-field-col">
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
            <div class="svc-field-tip"
              >值为字符串类型无长度限制，建议保持简短并避免换行、空格等特殊字符</div
            >
          </div>
        </ElFormItem>

        <!-- ── 访问设置 ── -->
        <ElDivider content-position="left">访问设置（Service）</ElDivider>

        <ElFormItem label="服务访问方式" prop="serviceType">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.serviceType">
              <ElRadio value="ClusterIP">仅在集群内访问</ElRadio>
              <ElRadio value="NodePort">主机端口访问</ElRadio>
              <ElRadio value="LoadBalancer">LoadBalancer</ElRadio>
            </ElRadioGroup>
            <div class="svc-field-tip">
              <template v-if="form.serviceType === 'ClusterIP'"
                >即 ClusterIP 类型，将提供一个可以被集群内其他服务或容器访问的入口，支持 TCP/UDP
                协议</template
              >
              <template v-else-if="form.serviceType === 'NodePort'"
                >即 NodePort 类型，将在所有节点上开放一个端口，集群外可通过
                &lt;NodeIP&gt;:&lt;NodePort&gt; 访问</template
              >
              <template v-else
                >即 LoadBalancer 类型，将在集群外部创建一个负载均衡器，分配公网或内网 IP</template
              >
            </div>
            <div v-if="form.serviceType === 'ClusterIP'" class="headless-row">
              <ElCheckbox v-model="form.headless">Headless Service</ElCheckbox>
              <span class="svc-field-tip headless-tip"
                >（Headless Service 将 clusterIP 设为 None，DNS 直接返回 Pod
                IP，只支持创建时选择，创建完成后不支持变更访问方式）</span
              >
            </div>
          </div>
        </ElFormItem>

        <!-- ── 端口映射 ── -->
        <ElFormItem label="端口映射" prop="ports">
          <div class="svc-field-col" style="width: 100%">
            <div v-if="form.ports.length" class="port-table-box">
              <div class="port-table-header">
                <span class="port-col-protocol">协议</span>
                <span class="port-col-port">Service 端口</span>
                <span class="port-col-port">容器端口</span>
                <span v-if="form.serviceType === 'NodePort'" class="port-col-port">节点端口</span>
                <span class="port-col-name">端口名称</span>
                <span class="port-col-action"></span>
              </div>
              <div v-for="(p, idx) in form.ports" :key="`port-${idx}`" class="port-table-row">
                <ElSelect v-model="p.protocol" class="port-col-protocol">
                  <ElOption label="TCP" value="TCP" />
                  <ElOption label="UDP" value="UDP" />
                </ElSelect>
                <ElInput
                  v-model="p.port"
                  class="port-col-port"
                  placeholder="建议与容器端口保持一致"
                  @input="(v: string) => (p.port = v.replace(/\D/g, ''))"
                />
                <ElInput
                  v-model="p.targetPort"
                  class="port-col-port"
                  placeholder="容器内程序监听端口"
                />
                <ElInput
                  v-if="form.serviceType === 'NodePort'"
                  v-model="p.nodePort"
                  class="port-col-port"
                  placeholder="30000-32767"
                  @input="(v: string) => (p.nodePort = v.replace(/\D/g, ''))"
                />
                <ElInput v-model="p.name" class="port-col-name" placeholder="可选" />
                <ElButton link class="kv-del-btn port-col-action" @click="form.ports.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
            </div>
            <ElButton link type="primary" class="kv-add-btn" @click="addPort">添加端口</ElButton>
            <div class="svc-field-tip"
              >Service 端口为对外暴露的端口，容器端口为 Pod 实际监听的端口（支持端口名）</div
            >
          </div>
        </ElFormItem>

        <!-- ── ExternalTrafficPolicy ── -->
        <ElFormItem
          v-if="form.serviceType === 'NodePort' || form.serviceType === 'LoadBalancer'"
          label="ExternalTrafficPolicy"
        >
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.externalTrafficPolicy">
              <ElRadio value="Cluster">Cluster</ElRadio>
              <ElRadio value="Local">Local</ElRadio>
            </ElRadioGroup>
            <div v-if="form.externalTrafficPolicy === 'Cluster'" class="svc-field-tip"
              >默认均衡转发到工作负载的所有Pod</div
            >
            <div v-else class="svc-field-tip etp-local-tip"
              >能够保留来源IP，并可以保证公网、VPC内网访问（LoadBalancer）和主机端口访问（NodePort）模式下流量仅在本节点转发。Local转发使部分没有业务Pod存在的节点健康检查失败，可能存在流量不均衡的转发的风险。</div
            >
          </div>
        </ElFormItem>

        <!-- ── 会话保持 ── -->
        <ElFormItem label="会话保持">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.sessionAffinity">
              <ElRadio value="None">不启用</ElRadio>
              <ElRadio value="ClientIP">ClientIP</ElRadio>
            </ElRadioGroup>
            <div v-if="form.sessionAffinity === 'ClientIP'" class="svc-field-tip"
              >基于客户端 IP 做会话保持，同一 IP 的请求将路由到同一个 Pod</div
            >
          </div>
        </ElFormItem>

        <ElFormItem v-if="form.sessionAffinity === 'ClientIP'" label="最大会话保持时间">
          <div class="svc-field-col">
            <div class="affinity-timeout-ctrl">
              <ElButton class="timeout-btn" @click="decreaseTimeout">−</ElButton>
              <span class="timeout-value">{{ form.sessionAffinityTimeout }}</span>
              <ElButton class="timeout-btn" @click="increaseTimeout">+</ElButton>
              <span class="timeout-unit">秒</span>
            </div>
            <div class="svc-field-tip">会话保持时间范围为0-86400</div>
          </div>
        </ElFormItem>

        <!-- ── Workload 绑定 ── -->
        <ElDivider content-position="left">Workload 绑定</ElDivider>

        <ElFormItem label="选择器（Selector）">
          <div class="svc-field-col">
            <div class="kv-list">
              <div v-for="(item, idx) in form.selector" :key="`sel-${idx}`" class="kv-row">
                <ElInput v-model="item.key" placeholder="key" />
                <ElInput v-model="item.value" placeholder="value" />
                <ElButton link class="kv-del-btn" @click="form.selector.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
              <div class="selector-actions">
                <ElButton
                  link
                  type="primary"
                  class="kv-add-btn"
                  @click="form.selector.push({ key: '', value: '' })"
                  >新增</ElButton
                >
                <span class="kv-btn-divider">|</span>
                <ElButton link type="primary" class="kv-add-btn" @click="openBindDialog"
                  >绑定Workload</ElButton
                >
              </div>
            </div>
            <div class="svc-field-tip"
              >用于匹配后端 Pod，键值对需与 Pod 的 Labels 一致，如 app=my-app</div
            >
          </div>
        </ElFormItem>
      </ElForm>

      <div class="svc-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建 Service</ElButton>
      </div>
    </ElCard>

    <!-- ── 绑定工作负载 Dialog ── -->
    <ElDialog
      v-model="bindDialogVisible"
      title="绑定Workload资源"
      width="420px"
      :close-on-click-modal="false"
    >
      <div class="bind-form-wrap">
        <div class="bind-form-row">
          <span class="bind-form-label">资源类型</span>
          <ElRadioGroup v-model="bindResourceType" @change="onBindTypeChange">
            <ElRadio value="deployment">deployment</ElRadio>
            <ElRadio value="statefulset">statefulset</ElRadio>
          </ElRadioGroup>
        </div>
        <div class="bind-form-row">
          <span class="bind-form-label">资源列表</span>
          <div class="bind-form-content">
            <ElSelect
              v-model="bindResourceName"
              style="width: 210px"
              :loading="bindLoading"
              placeholder="请选择"
              @change="onBindResourceChange"
            >
              <ElOption
                v-for="item in bindResourceList"
                :key="item.name"
                :label="item.name"
                :value="item.name"
              />
            </ElSelect>
            <div v-if="!bindResourceList.length && !bindLoading" class="bind-empty-tip"
              >无可用资源</div
            >
          </div>
        </div>
        <div class="bind-form-row bind-form-row--labels">
          <span class="bind-form-label">Labels</span>
          <div class="bind-labels">
            <template v-if="Object.keys(bindLabels).length">
              <div v-for="(v, k) in bindLabels" :key="k" class="bind-label-item"
                >{{ k }}: {{ v }}</div
              >
            </template>
            <span v-else class="bind-label-empty">-</span>
          </div>
        </div>
      </div>
      <template #footer>
        <ElButton @click="bindDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :disabled="!Object.keys(bindLabels).length" @click="confirmBind"
          >确认</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sService } from '@/api/kubernetes/service'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { fetchK8sDeploymentList } from '@/api/kubernetes/deployment'
  import { fetchK8sStatefulSetList } from '@/api/kubernetes/statefulset'
  import ClusterResourceBreadcrumb from '../components/cluster-resource-breadcrumb.vue'

  defineOptions({ name: 'ServiceCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))

  const namespaces = ref<string[]>([])
  const submitting = ref(false)
  const formRef = ref<FormInstance>()

  type PortEntry = {
    name: string
    protocol: string
    port: string
    targetPort: string
    nodePort: string
  }

  const form = ref({
    name: '',
    namespace: '',
    labels: [] as Array<{ key: string; value: string }>,
    annotations: [] as Array<{ key: string; value: string }>,
    serviceType: 'ClusterIP' as 'ClusterIP' | 'NodePort' | 'LoadBalancer',
    headless: false,
    selector: [] as Array<{ key: string; value: string }>,
    ports: [{ name: '', protocol: 'TCP', port: '', targetPort: '', nodePort: '' }] as PortEntry[],
    sessionAffinity: 'None' as 'None' | 'ClientIP',
    sessionAffinityTimeout: 30,
    externalTrafficPolicy: 'Cluster' as 'Cluster' | 'Local'
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入 Service 名称', trigger: 'blur' },
      { min: 1, max: 63, message: '长度 1-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }]
  }

  function addPort() {
    form.value.ports.push({ name: '', protocol: 'TCP', port: '', targetPort: '', nodePort: '' })
  }

  function decreaseTimeout() {
    form.value.sessionAffinityTimeout = Math.max(0, form.value.sessionAffinityTimeout - 1)
  }

  function increaseTimeout() {
    form.value.sessionAffinityTimeout = Math.min(86400, form.value.sessionAffinityTimeout + 1)
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
    const labels = kvToObj(f.labels)
    const annotations = kvToObj(f.annotations)
    const selector = kvToObj(f.selector)

    const ports = f.ports
      .map((p) => {
        const port = parseInt(p.port)
        if (!port || port < 1 || port > 65535) return null
        const targetPort = /^\d+$/.test(p.targetPort.trim())
          ? parseInt(p.targetPort.trim())
          : p.targetPort.trim() || port
        const entry: Record<string, unknown> = { protocol: p.protocol, port, targetPort }
        if (p.name.trim()) entry.name = p.name.trim()
        if (f.serviceType === 'NodePort' && p.nodePort) {
          const np = parseInt(p.nodePort)
          if (np >= 30000 && np <= 32767) entry.nodePort = np
        }
        return entry
      })
      .filter(Boolean)

    const spec: Record<string, unknown> = {
      type: f.serviceType,
      selector: Object.keys(selector).length ? selector : undefined,
      ports: ports.length ? ports : undefined,
      sessionAffinity: f.sessionAffinity
    }
    if (f.serviceType === 'ClusterIP' && f.headless) spec.clusterIP = 'None'
    if (f.serviceType === 'NodePort' || f.serviceType === 'LoadBalancer') {
      spec.externalTrafficPolicy = f.externalTrafficPolicy
    }
    if (f.sessionAffinity === 'ClientIP') {
      spec.sessionAffinityConfig = { clientIP: { timeoutSeconds: f.sessionAffinityTimeout } }
    }

    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: f.name.trim(),
        namespace: f.namespace,
        ...(Object.keys(labels).length ? { labels } : {}),
        ...(Object.keys(annotations).length ? { annotations } : {})
      },
      spec
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
    submitting.value = true
    try {
      const manifest = buildManifest()
      await createK8sService(cluster.value, form.value.namespace, manifest)
      ElMessage.success(`Service（${form.value.name}）创建成功`)
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/services', query: { cluster: cluster.value } })
  }

  // ── 绑定工作负载 ──
  const bindDialogVisible = ref(false)
  const bindResourceType = ref<'deployment' | 'statefulset'>('deployment')
  const bindResourceName = ref('')
  const bindResourceList = ref<Array<{ name: string; labels: Record<string, string> }>>([])
  const bindLoading = ref(false)
  const bindLabels = ref<Record<string, string>>({})

  async function loadBindResourceList() {
    if (!cluster.value || !form.value.namespace) return
    bindLoading.value = true
    bindResourceList.value = []
    bindResourceName.value = ''
    bindLabels.value = {}
    try {
      if (bindResourceType.value === 'deployment') {
        const { items } = await fetchK8sDeploymentList(cluster.value, {
          page: 1,
          limit: 500,
          namespace: form.value.namespace
        })
        bindResourceList.value = items.map((d) => ({
          name: d.metadata?.name ?? '',
          labels: d.spec?.template?.metadata?.labels ?? {}
        }))
      } else {
        const { items } = await fetchK8sStatefulSetList(cluster.value, {
          page: 1,
          limit: 500,
          namespace: form.value.namespace
        })
        bindResourceList.value = items.map((d) => ({
          name: d.metadata?.name ?? '',
          labels: d.spec?.template?.metadata?.labels ?? {}
        }))
      }
    } catch {
      bindResourceList.value = []
    } finally {
      bindLoading.value = false
    }
  }

  function openBindDialog() {
    bindResourceType.value = 'deployment'
    bindResourceName.value = ''
    bindLabels.value = {}
    bindDialogVisible.value = true
    void loadBindResourceList()
  }

  function onBindTypeChange() {
    void loadBindResourceList()
  }

  function onBindResourceChange(name: string) {
    const item = bindResourceList.value.find((r) => r.name === name)
    bindLabels.value = item?.labels ?? {}
  }

  function confirmBind() {
    form.value.selector = Object.entries(bindLabels.value).map(([key, value]) => ({ key, value }))
    bindDialogVisible.value = false
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
  }

  onMounted(() => {
    void loadNamespaces()
  })
</script>

<style scoped>
  .svc-create-page {
    padding: 0 clamp(16px, 4vw, 48px) 0;
  }

  .svc-create-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
    margin-left: calc(-1 * clamp(16px, 4vw, 48px));
  }

  .svc-create-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px 0 2px;
  }

  .svc-create-header-divider {
    margin: 0 12px;
    height: 16px;
  }

  .svc-create-card :deep(.el-card__body) {
    padding: 16px 20px;
  }

  /* ── Form ── */
  .svc-form {
    max-width: 960px;
    padding-top: 4px;
  }

  .svc-form :deep(.el-form-item) {
    margin-bottom: 22px;
  }

  /* label 12px */
  .svc-form :deep(.el-form-item__label) {
    font-size: 12px;
    padding-right: 16px;
    color: var(--el-text-color-regular);
  }

  /* form content area left-aligned */
  .svc-form :deep(.el-form-item__content) {
    align-items: flex-start;
  }

  /* all inputs / selects / radios / checkboxes 12px */
  .svc-form :deep(.el-input__inner),
  .svc-form :deep(.el-select__placeholder),
  .svc-form :deep(.el-select__selected-item),
  .svc-form :deep(.el-radio__label),
  .svc-form :deep(.el-checkbox__label) {
    font-size: 12px;
  }

  /* placeholder text 12px */
  .svc-form :deep(.el-input__placeholder) {
    font-size: 12px;
  }

  .svc-section-divider-top {
    margin-top: 5px;
  }

  /* ── Field col (tip below control) ── */
  .svc-field-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
  }

  .svc-field-tip {
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

  /* 新增按钮靠左，与输入框左边缘对齐 */
  .kv-add-btn {
    font-size: 12px;
    padding: 0;
    height: auto;
    align-self: flex-start;
  }

  /* ── Headless row ── */
  .headless-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  .headless-tip {
    white-space: nowrap;
    margin-left: 4px;
  }

  .etp-local-tip {
    white-space: nowrap;
  }

  /* ── Port table ── */
  .port-table-box {
    width: 100%;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    overflow: hidden;
    background: var(--el-bg-color-overlay);
  }

  .port-table-header,
  .port-table-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
  }

  .port-table-header {
    background: var(--el-fill-color-light);
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }

  .port-table-row {
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .port-col-name {
    width: 200px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .port-col-protocol {
    width: 80px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .port-col-port {
    width: 180px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .port-col-action {
    width: 28px;
    flex-shrink: 0;
    margin-left: auto;
  }

  /* ── Affinity timeout ── */
  .affinity-timeout-ctrl {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .timeout-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 0;
    border: none;
    background: var(--el-fill-color-light);
    font-size: 14px;
    flex-shrink: 0;
  }

  .timeout-value {
    min-width: 48px;
    text-align: center;
    font-size: 13px;
    padding: 0 8px;
    height: 32px;
    line-height: 32px;
    border-left: 1px solid var(--el-border-color);
    border-right: 1px solid var(--el-border-color);
    color: var(--el-text-color-primary);
  }

  .timeout-unit {
    font-size: 12px;
    margin-left: 8px;
    color: var(--el-text-color-regular);
  }

  /* ── Selector actions ── */
  .selector-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .kv-btn-divider {
    font-size: 12px;
    color: var(--el-border-color-darker);
    user-select: none;
    line-height: 1;
  }

  /* ── Bind workload dialog ── */
  .bind-form-wrap {
    padding: 8px 16px 0;
  }

  .bind-form-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
  }

  .bind-form-row--labels {
    align-items: flex-start;
  }

  .bind-form-label {
    width: 56px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-regular);
    padding-top: 5px;
    text-align: right;
  }

  .bind-form-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bind-empty-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .bind-labels {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 6px;
    min-height: 24px;
  }

  .bind-label-item {
    font-size: 12px;
    color: var(--el-text-color-primary);
    line-height: 1.6;
  }

  .bind-label-empty {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    padding-top: 1px;
  }

  /* dialog 内 Radio / Select 字体 12px */
  .bind-form-wrap :deep(.el-radio__label) {
    font-size: 12px;
  }

  .bind-form-wrap :deep(.el-select__placeholder),
  .bind-form-wrap :deep(.el-select__selected-item),
  .bind-form-wrap :deep(.el-input__inner) {
    font-size: 12px;
  }

  /* ── Footer ── */
  .svc-create-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }
</style>
