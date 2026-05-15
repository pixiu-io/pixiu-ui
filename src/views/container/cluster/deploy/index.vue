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
          <ElBreadcrumbItem :to="{ path: '/container/cluster' }">集群管理</ElBreadcrumbItem>
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
      <div class="deploy-create-main">
        <ElTabs v-model="activeTabName" tab-position="left" class="deploy-create-tabs">
          <ElTabPane label="集群信息" name="0">
            <StepBasic
              ref="stepBasicRef"
              :form="form"
              :read-only="isReadOnlyMode"
              :lock-immutable-fields="false"
              @update:form="form = $event"
            />
          </ElTabPane>
          <ElTabPane label="集群配置" name="1">
            <StepClusterConfig
              ref="stepClusterConfigRef"
              :form="form"
              :read-only="isReadOnlyMode"
              :lock-immutable-fields="false"
              @update:form="form = $event"
            />
          </ElTabPane>
          <ElTabPane label="节点" name="2">
            <StepNodes
              ref="stepNodesRef"
              :form="form"
              :read-only="isReadOnlyMode"
              @update:form="form = $event"
            />
          </ElTabPane>
          <ElTabPane label="信息确认" name="3">
            <StepConfirm
              ref="stepConfirmRef"
              :form="form"
              :read-only="isReadOnlyMode"
              @update:form="form = $event"
              @go-step="goToStep"
            />
          </ElTabPane>
        </ElTabs>
      </div>

      <div class="deploy-create-footer">
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
        <ElButton @click="goBack">{{ isDetailMode ? '返回列表' : '取消' }}</ElButton>
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
  const pageMode = computed(() => (queryMode.value ? queryMode.value : hasPlanId.value ? 'detail' : 'create'))
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
  const canStartDeploy = computed(() => Boolean(currentPlanId.value) && planStatusText.value !== '已成功')
  const lockImmutableFields = computed(
    () => isEditMode.value && planStatusText.value !== '未开始'
  )
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
    osType: '',
    osImage: '',
    description: '',
    networkInterface: 'eth0',
    cni: 'calico',
    podNetwork: '172.30.0.0/16',
    serviceNetwork: '10.254.0.0/16',
    highAvailability: false,
    selfLoadBalance: false,
    apiServerAddress: '',
    apiServerPort: 6443,
    kubeProxyMode: 'iptables',
    metricsServer: true,
    ingressNginx: false,
    nodes: [] as NodeConfig[],
    enablePrometheus: false,
    enableLogging: false
  })

  const form = ref<DeployClusterForm>(defaultForm())

  function detectOsTypeFromImage(osImage: string): string {
    const image = osImage.toLowerCase()
    if (image.startsWith('centos')) return 'centos'
    if (image.startsWith('ubuntu')) return 'ubuntu'
    if (image.startsWith('debian')) return 'debian'
    if (image.startsWith('openeuler')) return 'openEuler'
    if (image.startsWith('rocky')) return 'rocky'
    return ''
  }

  function mapNodeFromApi(node: any): NodeConfig {
    const authType = node?.auth?.type === 'key' ? 'key' : 'password'
    return {
      name: node?.name ?? '',
      role: (node?.role ?? []) as ('master' | 'node')[],
      ip: node?.ip ?? '',
      authType,
      user: node?.auth?.password?.user ?? 'root',
      password: node?.auth?.password?.password ?? '',
      privateKey: node?.auth?.key?.data ?? ''
    }
  }

  async function loadPlanDetail(planId: number) {
    try {
      const [detail, planMeta] = await Promise.all([fetchPlanWithResources(planId), fetchPlan(planId)])
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
      const apiServerPort = Number.isFinite(apiServerPortRaw) ? apiServerPortRaw : highAvailability ? 8443 : 6443
      form.value = {
        name: detail.name ?? '',
        kubernetesVersion: cfg.kubernetes?.kubernetes_version ?? '1.28.12',
        runtime: (cfg.runtime?.runtime ?? 'containerd') as 'docker' | 'containerd',
        osType: detectOsTypeFromImage(osImage),
        osImage,
        description: detail.description ?? '',
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
        metricsServer: Boolean(cfg.component?.metric_server?.enable),
        ingressNginx: Boolean(cfg.component?.ingress_nginx?.enable),
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
    if (!isReadOnlyMode.value) activeTabName.value = String(step)
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
    if (isDetailMode.value || isEditMode.value || isCopyMode.value) {
      router.push('/container/plan')
    } else {
      router.push('/container/cluster')
    }
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
      await ElMessageBox.confirm(`确定要启动计划 "${form.value.name || '-'}" 的部署任务吗？`, '启动部署', {
        confirmButtonText: '启动',
        cancelButtonText: '取消',
        type: 'warning'
      })
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
        kubernetes: {
          kubernetes_version: f.kubernetesVersion,
          // Backward-compatible: keep both old/new keys.
          high_availability: f.highAvailability,
          enable_ha: f.highAvailability,
          api_server: f.apiServerAddress || '',
          api_port: String(f.apiServerPort || 6443),
          enable_public_ip: Boolean(f.apiServerAddress)
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
        runtime: { runtime: f.runtime },
        component: {
          ...(f.enablePrometheus ? { prometheus: { enabled: true } } : {}),
          ...(f.enableLogging ? { logging: { enabled: true } } : {}),
          metric_server: { enable: f.metricsServer },
          ingress_nginx: { enable: f.ingressNginx }
        }
      },
      nodes
    }
  }

  async function onSubmit() {
    // 新建模式：提交前逐步校验；编辑模式：直接提交，由后端做最终校验
    if (!isEditMode.value) {
      for (let i = 0; i < 4; i++) {
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
        await fetchUpdatePlan(currentPlanId.value, {
          ...payload,
          resource_version: currentResourceVersion.value
        })
        ElMessage.success('部署修改成功')
        router.push({ path: '/container/cluster/deploy', query: { planId: String(currentPlanId.value) } })
      } else {
        await fetchCreatePlan(payload)
        ElMessage.success('部署集群创建成功')
        router.push('/container/plan')
      }
    } catch (e: unknown) {
      const err = e as Error
      ElMessage.error(err.message || (shouldSubmitAsUpdate.value ? '修改失败，请重试' : '创建失败，请重试'))
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

  .deploy-create-main {
    display: flex;
    gap: 14px;
  }

  .deploy-create-tabs {
    flex: 1;
    min-width: 0;
  }

  .deploy-create-tabs :deep(.el-tabs__content) {
    min-height: 420px;
    padding-top: 12px;
  }

  .deploy-create-footer {
    margin-top: 10px;
    display: flex;
    justify-content: center;
    gap: 10px;
  }
</style>
