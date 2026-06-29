<template>
  <div class="deploy-create-page">
    <div class="deploy-create-header">
      <div class="deploy-create-header__left">
        <ElButton text class="deploy-create-back-btn" @click="goBack">
          <ElIcon><ArrowLeft /></ElIcon>
          <span>返回</span>
        </ElButton>
        <ElDivider direction="vertical" class="deploy-create-header-divider" />
        <ElBreadcrumb separator="/">
          <ElBreadcrumbItem :to="{ path: '/container/plan' }">部署</ElBreadcrumbItem>
          <ElBreadcrumbItem>{{ pageTitle }}</ElBreadcrumbItem>
        </ElBreadcrumb>
        <template v-if="hasPlanId && !isCopyMode">
          <ElDivider direction="vertical" class="deploy-create-header-divider" />
          <span class="deploy-create-status-label">状态:</span>
          <ElTag :type="planStatusTagType" effect="light" size="small">{{ planStatusText }}</ElTag>
        </template>
      </div>
      <div v-if="isDetailMode" class="deploy-create-header__right">
        <ElButton v-ripple :disabled="!canStartDeploy" @click="startCurrentPlan">开始部署</ElButton>
        <ElButton v-ripple @click="goEdit">编辑</ElButton>
      </div>
    </div>

    <ElCard class="deploy-create-card">
      <nav class="deploy-step-nav" aria-label="部署步骤">
        <template v-for="(step, index) in deploySteps" :key="step.key">
          <span v-if="index > 0" class="deploy-step-nav__chevron" aria-hidden="true">&gt;</span>
          <button
            type="button"
            class="deploy-step-nav__item"
            :class="{
              'is-active': currentStep === index,
              'is-done': currentStep > index,
              'is-clickable': canGoToStep(index)
            }"
            :disabled="!canGoToStep(index)"
            @click="onStepNavClick(index)"
          >
            <span class="deploy-step-nav__index">{{ index + 1 }}</span>
            <span class="deploy-step-nav__label">{{ step.label }}</span>
          </button>
        </template>
      </nav>

      <div class="deploy-create-main">
        <div v-show="currentStep === 0" class="deploy-step-pane">
          <StepBasic
            ref="stepBasicRef"
            :form="form"
            :read-only="isReadOnlyMode"
            :lock-immutable-fields="lockImmutableFields"
            @update:form="form = $event"
          />
        </div>
        <div v-show="currentStep === 1" class="deploy-step-pane">
          <StepClusterConfig
            ref="stepClusterConfigRef"
            :form="form"
            :read-only="isReadOnlyMode"
            :lock-immutable-fields="lockImmutableFields"
            @update:form="form = $event"
          />
        </div>
        <div v-show="currentStep === 2" class="deploy-step-pane">
          <StepNodes
            ref="stepNodesRef"
            :form="form"
            :read-only="isReadOnlyMode"
            @update:form="form = $event"
          />
        </div>
        <div v-show="currentStep === 3" class="deploy-step-pane">
          <StepConfirm
            ref="stepConfirmRef"
            :form="form"
            :read-only="isReadOnlyMode"
            @update:form="form = $event"
            @go-step="goToStep"
          />
        </div>
      </div>

      <div class="deploy-create-footer">
        <ElButton @click="goBack">{{ isDetailMode ? '返回列表' : '取消' }}</ElButton>
        <ElButton v-if="!isReadOnlyMode && currentStep > 0" :disabled="stepping" @click="prevStep"
          >上一步</ElButton
        >
        <ElButton
          v-if="!isReadOnlyMode && currentStep < 3"
          type="primary"
          :loading="stepping"
          @click="nextStep"
          >下一步</ElButton
        >
        <ElButton
          v-if="!isReadOnlyMode && currentStep === 3"
          type="primary"
          :loading="submitting"
          @click="onSubmit"
        >
          {{ isEditMode ? '确定修改' : '确认提交' }}
        </ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    fetchCreatePlan,
    fetchPlan,
    fetchPlanWithResources,
    fetchStartPlan,
    fetchUpdatePlan
  } from '@/api/plan'
  import StepBasic from './steps/StepBasic.vue'
  import StepNodes from './steps/StepNodes.vue'
  import StepClusterConfig from './steps/StepClusterConfig.vue'
  import StepConfirm from './steps/StepConfirm.vue'
  import type { DeployClusterForm, NodeConfig } from './steps/StepBasic.vue'

  defineOptions({ name: 'DeployClusterWizard' })

  type StepRef = { validate: () => Promise<boolean> } | null

  const route = useRoute()
  const router = useRouter()

  const currentPlanId = computed(() => Number(route.query.planId ?? 0))
  const queryMode = computed(() => String(route.query.mode ?? ''))
  const hasPlanId = computed(() => Number.isFinite(currentPlanId.value) && currentPlanId.value > 0)
  const pageMode = computed(() =>
    queryMode.value ? queryMode.value : hasPlanId.value ? 'detail' : 'create'
  )
  const isCreateMode = computed(() => !hasPlanId.value || pageMode.value === 'create')
  const isCopyMode = computed(() => hasPlanId.value && pageMode.value === 'copy')
  const isEditMode = computed(() => hasPlanId.value && pageMode.value === 'edit')
  const isDetailMode = computed(() => hasPlanId.value && pageMode.value === 'detail')
  const isReadOnlyMode = computed(() => isDetailMode.value)
  const pageTitle = computed(() => {
    if (isDetailMode.value) return '部署详情'
    if (isEditMode.value) return '修改部署'
    if (isCopyMode.value) return '拷贝部署'
    return '新建部署集群'
  })

  // activeTabName 是唯一状态源，currentStep 由它派生
  const activeTabName = ref('0')
  const currentStep = computed(() => Number(activeTabName.value))

  const deploySteps = [
    { key: 'basic', label: '集群信息' },
    { key: 'config', label: '高级配置' },
    { key: 'nodes', label: '新增节点' },
    { key: 'confirm', label: '信息确认' }
  ] as const

  function canGoToStep(index: number) {
    if (index === currentStep.value) return false
    if (isReadOnlyMode.value) return true
    return index < currentStep.value
  }

  function onStepNavClick(index: number) {
    if (!canGoToStep(index)) return
    activeTabName.value = String(index)
  }

  const stepping = ref(false)
  const submitting = ref(false)
  const currentResourceVersion = ref<number | null>(null)
  const planStatusText = ref('未开始')

  const planStatusTagType = computed(() => {
    if (planStatusText.value === '运行中') return 'primary'
    if (planStatusText.value === '已成功') return 'success'
    if (planStatusText.value === '已失败') return 'danger'
    return 'info'
  })
  const canStartDeploy = computed(
    () => Boolean(currentPlanId.value) && planStatusText.value !== '已成功'
  )
  const lockImmutableFields = computed(() => isEditMode.value && planStatusText.value !== '未开始')
  const shouldSubmitAsUpdate = computed(() => isEditMode.value)

  const stepBasicRef = ref<StepRef>(null)
  const stepClusterConfigRef = ref<StepRef>(null)
  const stepNodesRef = ref<StepRef>(null)
  const stepConfirmRef = ref<StepRef>(null)

  function getStepRef(idx: number): StepRef {
    const refs: StepRef[] = [
      stepBasicRef.value,
      stepClusterConfigRef.value,
      stepNodesRef.value,
      stepConfirmRef.value
    ]
    return refs[idx] ?? null
  }

  const defaultForm = (): DeployClusterForm => ({
    name: '',
    kubernetesVersion: '1.28.12',
    runtime: 'containerd',
    runtimeDir: '',
    customRuntimeDir: false,
    osType: 'ubuntu',
    osImage: '',
    description: '',
    protected: true,
    changeSelinux: true,
    registryMirror: '',
    nodeNamingMode: 'auto' as 'auto' | 'manual',
    networkInterface: 'eth0',
    cni: 'calico',
    podNetwork: '172.30.0.0/16',
    serviceNetwork: '10.254.0.0/16',
    highAvailability: false,
    selfLoadBalance: false,
    apiServerAddress: '',
    apiServerPort: 6443,
    kubeProxyMode: 'iptables',
    nfsEnabled: false,
    nfsStorageClassName: '',
    nfsStorageDataDir: '',
    metricsServer: true,
    ingressNginx: true,
    nodes: [] as NodeConfig[],
    enablePrometheus: false,
    enableLogging: false
  })

  const form = ref<DeployClusterForm>(defaultForm())

  function detectOsTypeFromImage(osImage: string): string {
    const image = osImage.toLowerCase()
    if (image.startsWith('centos')) return 'CentOS'
    if (image.startsWith('ubuntu')) return 'Ubuntu'
    if (image.startsWith('debian')) return 'Debian'
    if (image.startsWith('openeuler')) return 'OpenEuler'
    if (image.startsWith('rocky')) return 'RockyLinux'
    return ''
  }

  function mapNodeFromApi(node: any): NodeConfig {
    const authType = node?.auth?.type === 'key' ? 'key' : 'password'
    return {
      name: node?.name ?? '',
      role: (node?.role ?? []) as ('master' | 'node' | 'storage')[],
      ip: node?.ip ?? '',
      authType,
      user: node?.auth?.password?.user ?? 'root',
      password: node?.auth?.password?.password ?? '',
      privateKey: node?.auth?.key?.data ?? ''
    }
  }

  async function loadPlanDetail(planId: number) {
    try {
      const [detail, planMeta] = await Promise.all([
        fetchPlanWithResources(planId),
        fetchPlan(planId)
      ])
      planStatusText.value = planMeta.step || '未开始'
      const cfg = detail.config ?? {}
      const rv = planMeta.resourceVersion ?? detail.resource_version
      currentResourceVersion.value = rv == null ? null : Number(rv)
      const osImage = cfg.os_image ?? ''
      const highAvailability = Boolean(
        (cfg.kubernetes as any)?.high_availability ?? (cfg.kubernetes as any)?.enable_ha
      )
      const apiServerPortRaw = Number(
        (cfg.network as any)?.api_server_port ??
          (cfg.kubernetes as any)?.api_port ??
          (highAvailability ? 8443 : 6443)
      )
      const apiServerPort = Number.isFinite(apiServerPortRaw)
        ? apiServerPortRaw
        : highAvailability
          ? 8443
          : 6443
      const k8s = cfg.kubernetes ?? {}
      const dataDir = cfg.runtime?.data_dir ?? ''
      const setHostname =
        k8s.set_hostname ?? cfg.set_hostname ?? false
      form.value = {
        name: detail.name ?? '',
        kubernetesVersion: k8s.kubernetes_version ?? '1.28.12',
        runtime: (cfg.runtime?.runtime ?? 'containerd') as 'docker' | 'containerd',
        runtimeDir: dataDir,
        customRuntimeDir: Boolean(dataDir),
        osType: detectOsTypeFromImage(osImage),
        osImage,
        description: detail.description ?? '',
        protected: k8s.protect ?? cfg.protect ?? true,
        changeSelinux: k8s.change_selinux ?? cfg.change_selinux ?? true,
        registryMirror: k8s.image_repository ?? cfg.image_repository ?? '',
        nodeNamingMode: setHostname ? 'auto' : 'manual',
        networkInterface: cfg.network?.network_interface ?? 'eth0',
        cni: cfg.network?.cni ?? 'calico',
        podNetwork: cfg.network?.pod_network ?? '172.30.0.0/16',
        serviceNetwork: cfg.network?.service_network ?? '10.254.0.0/16',
        highAvailability,
        selfLoadBalance: highAvailability && Boolean((cfg.network as any)?.self_load_balance),
        apiServerAddress: String(
          (cfg.network as any)?.api_server_address ?? (cfg.kubernetes as any)?.api_server ?? ''
        ),
        apiServerPort,
        kubeProxyMode: 'iptables',
        nfsEnabled: Boolean((cfg.component as any)?.nfs?.enable),
        nfsStorageClassName: (cfg.component as any)?.nfs?.storage_class_name ?? '',
        nfsStorageDataDir: (cfg.component as any)?.nfs?.storage_data_dir ?? '',
        metricsServer: Boolean((cfg.component as any)?.metric_server?.enable),
        ingressNginx: Boolean((cfg.component as any)?.ingress_nginx?.enable),
        nodes: (detail.nodes ?? []).map(mapNodeFromApi),
        enablePrometheus: Boolean(cfg.component?.prometheus?.enabled),
        enableLogging: Boolean(cfg.component?.logging?.enabled)
      }
      // 进入部署详情默认落在「集群信息」
      activeTabName.value = '0'
    } catch (e: unknown) {
      const err = e as Error
      ElMessage.error(err.message || '加载部署详情失败')
    }
  }

  async function ensureResourceVersion(planId: number) {
    if (currentResourceVersion.value != null) return
    const planMeta = await fetchPlan(planId)
    const rv = planMeta.resourceVersion
    currentResourceVersion.value = rv == null ? null : Number(rv)
    if (!planStatusText.value || planStatusText.value === '未开始') {
      planStatusText.value = planMeta.step || '未开始'
    }
  }

  function goToStep(step: number) {
    if (isReadOnlyMode.value) {
      activeTabName.value = String(step)
      return
    }
    if (step <= currentStep.value) activeTabName.value = String(step)
  }

  async function nextStep() {
    const ref = getStepRef(currentStep.value)
    stepping.value = true
    try {
      if (ref) {
        const valid = await ref.validate()
        if (!valid) return
      }
      activeTabName.value = String(currentStep.value + 1)
    } finally {
      stepping.value = false
    }
  }

  function prevStep() {
    if (currentStep.value > 0) activeTabName.value = String(currentStep.value - 1)
  }

  function goBack() {
    router.push('/container/plan')
  }

  function goEdit() {
    if (!currentPlanId.value) return
    router.push({
      path: '/container/cluster/deploy',
      query: { planId: String(currentPlanId.value), mode: 'edit' }
    })
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message
    const maybe = error as {
      message?: string
      response?: { data?: { message?: string } | string }
    }
    const data = maybe?.response?.data
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data) as { message?: string }
        if (parsed?.message) return parsed.message
      } catch {
        // ignore parse failures
      }
      return data || fallback
    }
    if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message?: string }).message
      if (msg) return msg
    }
    if (maybe?.message) return maybe.message
    return fallback
  }

  async function startCurrentPlan() {
    if (!currentPlanId.value) return
    try {
      await ElMessageBox.confirm(
        `确定要启动计划 "${form.value.name || '-'}" 的部署任务吗？`,
        '启动部署',
        {
          confirmButtonText: '启动',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      await fetchStartPlan(currentPlanId.value)
      ElMessage.success(`计划 "${form.value.name || '-'}" 启动成功`)
      await loadPlanDetail(currentPlanId.value)
    } catch (e: unknown) {
      if (e === 'cancel' || e === 'close') return
      ElMessage.error(getErrorMessage(e, '启动失败'))
    }
  }

  function buildPlanPayload() {
    const f = form.value
    const nodes = f.nodes.map((n) => ({
      name: n.name,
      role: n.role as string[],
      cri: f.runtime,
      ip: n.ip,
      auth:
        n.authType === 'password'
          ? { type: 'password' as const, password: { user: n.user, password: n.password } }
          : { type: 'key' as const, key: { data: n.privateKey } }
    }))

    return {
      name: f.name,
      description: f.description,
      config: {
        os_image: f.osImage,
        description: f.description,
        kubernetes: {
          kubernetes_version: f.kubernetesVersion,
          // Backward-compatible: keep both old/new keys.
          high_availability: f.highAvailability,
          enable_ha: f.highAvailability,
          api_server: f.apiServerAddress || '',
          api_port: String(f.apiServerPort || 6443),
          enable_public_ip: Boolean(f.apiServerAddress),
          image_repository: f.registryMirror,
          set_hostname: f.nodeNamingMode === 'auto',
          protect: f.protected,
          change_selinux: f.changeSelinux
        },
        network: {
          network_interface: f.networkInterface,
          cni: f.cni,
          pod_network: f.podNetwork,
          service_network: f.serviceNetwork,
          api_server_address: f.apiServerAddress || undefined,
          api_server_port: f.apiServerPort,
          self_load_balance: f.selfLoadBalance,
          // Backward-compatible: keep both old/new keys.
          kube_proxy_mode: 'iptables',
          kube_proxy: 'iptables'
        },
        runtime: {
          runtime: f.runtime,
          data_dir: f.customRuntimeDir ? f.runtimeDir.trim() : ''
        },
        component: {
          ...(f.enablePrometheus ? { prometheus: { enabled: true } } : {}),
          ...(f.enableLogging ? { logging: { enabled: true } } : {}),
          metric_server: { enable: f.metricsServer },
          ingress_nginx: { enable: f.ingressNginx },
          ...(f.nfsEnabled
            ? {
                nfs: {
                  enable: true,
                  storage_class_name: f.nfsStorageClassName.trim(),
                  storage_data_dir: f.nfsStorageDataDir.trim()
                }
              }
            : {})
        }
      },
      nodes
    }
  }

  async function onSubmit() {
    // 提交前校验基础配置（含 Kubernetes 版本）；新建模式逐步校验全部步骤
    const basicRef = getStepRef(0)
    if (basicRef) {
      const basicValid = await basicRef.validate()
      if (!basicValid) {
        activeTabName.value = '0'
        return
      }
    }
    if (!isEditMode.value) {
      for (let i = 1; i < 4; i++) {
        const ref = getStepRef(i)
        if (ref) {
          const valid = await ref.validate()
          if (!valid) {
            activeTabName.value = String(i)
            return
          }
        }
      }
    }

    submitting.value = true
    try {
      const payload = buildPlanPayload()
      if (shouldSubmitAsUpdate.value) {
        await ensureResourceVersion(currentPlanId.value)
        if (currentResourceVersion.value == null) {
          ElMessage.error('缺少资源版本，无法修改，请重新进入页面后重试')
          return
        }
        // @ts-ignore
        await fetchUpdatePlan(currentPlanId.value, {
          ...payload,
          resource_version: currentResourceVersion.value
        })
        ElMessage.success('部署修改成功')
        router.push('/container/plan')
      } else {
        // @ts-ignore
        await fetchCreatePlan(payload)
        ElMessage.success('部署集群创建成功')
        router.push('/container/plan')
      }
    } catch (e: unknown) {
      const err = e as Error
      ElMessage.error(
        err.message || (shouldSubmitAsUpdate.value ? '修改失败，请重试' : '创建失败，请重试')
      )
    } finally {
      submitting.value = false
    }
  }

  onMounted(() => {
    if (isDetailMode.value || isEditMode.value || isCopyMode.value) {
      void loadPlanDetail(currentPlanId.value)
    }
  })
</script>

<style scoped>
  .deploy-create-page {
    padding: 0 clamp(16px, 4vw, 48px) 0;
  }

  .deploy-create-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
    margin-left: calc(-1 * clamp(16px, 4vw, 48px));
  }

  .deploy-create-header__left {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .deploy-create-header__right {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .deploy-create-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px 0 2px;
  }

  .deploy-create-header-divider {
    margin: 0 12px;
    height: 16px;
  }

  .deploy-create-status-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .deploy-create-card :deep(.el-card__body) {
    padding: 16px 20px;
  }

  @media (max-width: 1200px) {
    .deploy-create-page {
      padding-left: 20px;
      padding-right: 20px;
    }
    .deploy-create-header {
      margin-left: -20px;
    }
  }

  @media (max-width: 768px) {
    .deploy-create-page {
      padding-left: 12px;
      padding-right: 12px;
    }
    .deploy-create-header {
      margin-left: -12px;
    }
  }

  .deploy-step-nav {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 0;
    padding: 8px 0 12px;
    margin-bottom: 4px;
  }

  .deploy-step-nav__chevron {
    margin: 0 14px;
    font-size: 12px;
    line-height: 1;
    color: var(--el-text-color-placeholder);
    user-select: none;
  }

  .deploy-step-nav__item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px;
    border: none;
    background: transparent;
    cursor: default;
    font: inherit;
  }

  .deploy-step-nav__item.is-clickable:not(:disabled) {
    cursor: pointer;
  }

  .deploy-step-nav__item:disabled {
    cursor: default;
  }

  .deploy-step-nav__index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    color: var(--el-text-color-secondary);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    transition:
      background-color 0.2s,
      border-color 0.2s,
      color 0.2s;
  }

  .deploy-step-nav__label {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    transition: color 0.2s;
  }

  .deploy-step-nav__item.is-active .deploy-step-nav__index,
  .deploy-step-nav__item.is-done .deploy-step-nav__index {
    color: #fff;
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  .deploy-step-nav__item.is-active .deploy-step-nav__label {
    color: var(--el-color-primary);
    font-weight: 500;
  }

  .deploy-step-nav__item.is-done .deploy-step-nav__label {
    color: var(--el-text-color-regular);
  }

  .deploy-step-nav__item.is-clickable:hover .deploy-step-nav__label {
    color: var(--el-color-primary);
  }

  .deploy-create-main {
    width: 100%;
    min-height: 420px;
  }

  .deploy-step-pane {
    width: 100%;
    max-width: none;
  }

  .deploy-step-pane :deep(.el-form) {
    width: 100%;
    max-width: none;
  }

  .deploy-step-pane :deep(.el-form-item__label) {
    font-size: 12px;
    padding-right: 16px;
  }

  .deploy-step-pane :deep(.el-input__placeholder),
  .deploy-step-pane :deep(.el-textarea__placeholder) {
    font-size: 12px;
  }

  .deploy-step-pane :deep(.el-divider__text) {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .deploy-step-pane :deep(.section-divider-top) {
    margin-top: 0;
  }

  .deploy-create-footer {
    margin-top: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }
</style>
