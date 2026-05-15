<template>
  <ElForm
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="140px"
    label-position="right"
    class="step-basic"
  >
    <ElDivider content-position="left" class="section-divider-top">基础配置</ElDivider>

    <ElFormItem label="部署名称" prop="name">
      <ElInput
        :model-value="form.name"
        placeholder="请输入部署名称"
        clearable
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, name: $event })"
      />
    </ElFormItem>

    <ElFormItem label="Kubernetes 版本" prop="kubernetesVersion">
      <ElSelect
        :model-value="form.kubernetesVersion"
        placeholder="请选择 Kubernetes 版本"
        style="width: 280px"
        filterable
        allow-create
        default-first-option
        :reserve-keyword="false"
        :disabled="readOnly || lockImmutableFields"
        @update:model-value="emit('update:form', { ...form, kubernetesVersion: $event })"
      >
        <ElOption v-for="v in k8sVersions" :key="v" :label="v" :value="v" />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="容器运行时" prop="runtime">
      <ElRadioGroup
        :model-value="form.runtime"
        :disabled="readOnly"
        @update:model-value="
          emit('update:form', { ...form, runtime: $event as 'docker' | 'containerd' })
        "
      >
        <ElRadio value="containerd">
          <span class="runtime-label">containerd</span>
          <ElTag size="small" type="success" class="runtime-tag">推荐</ElTag>
        </ElRadio>
        <ElRadio value="docker">
          <span class="runtime-label">docker</span>
        </ElRadio>
      </ElRadioGroup>
    </ElFormItem>

    <ElFormItem label="操作系统" prop="osType">
      <div class="os-selector">
        <ElSelect
          :model-value="form.osType"
          placeholder="选择OS类型"
          style="width: 180px"
          :loading="osLoading"
          :disabled="readOnly"
          @update:model-value="onOsTypeChange"
        >
          <ElOption v-for="os in osTypes" :key="os" :label="osLabels[os] ?? os" :value="os" />
        </ElSelect>
        <ElSelect
          :model-value="form.osImage"
          placeholder="选择版本"
          style="width: 200px; margin-left: 10px"
          :disabled="readOnly || !form.osType"
          @update:model-value="emit('update:form', { ...form, osImage: $event })"
        >
          <ElOption v-for="img in currentOsImages" :key="img" :label="img" :value="img" />
        </ElSelect>
      </div>
    </ElFormItem>

    <ElFormItem label="描述">
      <ElInput
        :model-value="form.description"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 6 }"
        placeholder="可选，描述此集群的用途"
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, description: $event })"
      />
    </ElFormItem>

    <ElDivider content-position="left">网络配置</ElDivider>

    <ElFormItem label="节点网口" prop="networkInterface">
      <ElInput
        :model-value="form.networkInterface"
        placeholder="eth0"
        style="width: 240px"
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, networkInterface: $event })"
      />
      <span class="form-tip">默认使用 eth0，请填写实际网卡名</span>
    </ElFormItem>

    <ElFormItem label="容器网络插件" prop="cni">
      <ElSelect
        :model-value="form.cni"
        placeholder="请选择 CNI 插件"
        style="width: 240px"
        :disabled="readOnly || lockImmutableFields"
        @update:model-value="emit('update:form', { ...form, cni: $event })"
      >
        <ElOption label="Calico" value="calico" />
        <ElOption label="Flannel" value="flannel" />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="容器网络" prop="podNetwork">
      <div class="cidr-block">
        <div class="cidr-row">
          <span class="cidr-label">CIDR</span>
          <ElInput
            :model-value="podParts[0]"
            class="cidr-first"
            maxlength="3"
            :disabled="readOnly || lockImmutableFields"
            @update:model-value="onPodPartChange(0, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput
            :model-value="podParts[1]"
            class="cidr-second"
            maxlength="3"
            :disabled="readOnly || lockImmutableFields || !canEditPodPart(1)"
            @update:model-value="onPodPartChange(1, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput
            :model-value="podParts[2]"
            class="cidr-fixed"
            maxlength="3"
            :disabled="readOnly || lockImmutableFields || !canEditPodPart(2)"
            @update:model-value="onPodPartChange(2, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput :model-value="podParts[3]" class="cidr-fixed" disabled />
          <span class="ip-slash">/</span>
          <ElSelect
            :model-value="podMask"
            class="cidr-mask"
            :disabled="readOnly || lockImmutableFields"
            @update:model-value="onPodMaskChange"
          >
            <ElOption v-for="m in podMaskOptions" :key="m" :label="String(m)" :value="m" />
          </ElSelect>
        </div>
        <div class="cidr-hint">创建后无法更改</div>
      </div>
    </ElFormItem>

    <ElFormItem label="Service IP 段" prop="serviceNetwork">
      <div class="service-ip-block">
        <div class="service-ip-inputs">
          <ElInput
            :model-value="svcParts[0]"
            class="ip-part"
            maxlength="3"
            :disabled="readOnly || lockImmutableFields"
            @update:model-value="onSvcPartChange(0, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput
            :model-value="svcParts[1]"
            class="ip-part"
            maxlength="3"
            :disabled="readOnly || lockImmutableFields || !canEditSvcPart(1)"
            @update:model-value="onSvcPartChange(1, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput
            :model-value="svcParts[2]"
            class="ip-part"
            maxlength="3"
            :disabled="readOnly || lockImmutableFields || !canEditSvcPart(2)"
            @update:model-value="onSvcPartChange(2, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput :model-value="svcParts[3]" class="ip-part" maxlength="3" disabled />
          <span class="ip-slash">/</span>
          <ElSelect
            :model-value="svcMask"
            class="ip-mask"
            :disabled="readOnly || lockImmutableFields"
            @update:model-value="onSvcMaskChange"
          >
            <ElOption v-for="m in maskOptions" :key="m" :label="String(m)" :value="m" />
          </ElSelect>
        </div>
        <div class="service-ip-warning">
          <ElIcon class="warning-icon"><WarningFilled /></ElIcon>
          创建后不支持修改，指定 Kubernetes Service 分配的 IP 段，不能与 VPC 网段冲突
        </div>
      </div>
    </ElFormItem>
  </ElForm>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { WarningFilled } from '@element-plus/icons-vue'
  import { fetchPlanDistributions } from '@/api/plan'

  export interface NodeConfig {
    name: string
    role: ('master' | 'node')[]
    ip: string
    authType: 'password' | 'key'
    user: string
    password: string
    privateKey: string
  }

  export interface DeployClusterForm {
    name: string
    kubernetesVersion: string
    runtime: 'docker' | 'containerd'
    osType: string
    osImage: string
    description: string
    networkInterface: string
    cni: string
    podNetwork: string
    serviceNetwork: string
    highAvailability: boolean
    selfLoadBalance: boolean
    apiServerAddress: string
    apiServerPort: number
    kubeProxyMode: 'iptables' | 'ipvs'
    metricsServer: boolean
    ingressNginx: boolean
    nodes: NodeConfig[]
    enablePrometheus: boolean
    enableLogging: boolean
  }

  defineOptions({ name: 'StepBasic' })

  const props = withDefaults(
    defineProps<{ form: DeployClusterForm; readOnly?: boolean; lockImmutableFields?: boolean }>(),
    {
      readOnly: false,
      lockImmutableFields: false
    }
  )
  const emit = defineEmits<{ 'update:form': [DeployClusterForm] }>()
  const readOnly = computed(() => props.readOnly)
  const lockImmutableFields = computed(() => props.lockImmutableFields)

  const formRef = ref<FormInstance>()

  const k8sVersions = ['1.30.3', '1.29.7', '1.28.12', '1.27.16', '1.26.15']

  const osLabels: Record<string, string> = {
    centos: 'CentOS',
    ubuntu: 'Ubuntu',
    debian: 'Debian',
    openEuler: 'openEuler',
    rocky: 'Rocky Linux'
  }

  const osLoading = ref(false)
  const distributions = ref<Record<string, string[]>>({})

  const osTypes = computed(() => Object.keys(distributions.value))
  const currentOsImages = computed(() => distributions.value[props.form.osType] ?? [])

  onMounted(async () => {
    osLoading.value = true
    try {
      distributions.value = await fetchPlanDistributions()
    } catch {
      // 加载失败时使用默认值
      distributions.value = {
        centos: ['centos7'],
        ubuntu: ['ubuntu20.04', 'ubuntu22.04'],
        debian: ['debian11'],
        rocky: ['rocky9.2', 'rocky9.3']
      }
    } finally {
      osLoading.value = false
    }
  })

  function onOsTypeChange(osType: string) {
    const images = distributions.value[osType] ?? []
    emit('update:form', { ...props.form, osType, osImage: images[0] ?? '' })
  }

  // ── 容器子网 ──
  const podMaskOptions = [8, 16, 24]

  const podParts = computed(() => {
    const cidr = props.form.podNetwork || '172.30.0.0/16'
    const [ip] = cidr.split('/')
    const parts = (ip ?? '172.30.0.0').split('.')
    return [parts[0] ?? '172', parts[1] ?? '30', parts[2] ?? '0', parts[3] ?? '0']
  })

  const podMask = computed(() => {
    const cidr = props.form.podNetwork || '172.30.0.0/16'
    const mask = cidr.split('/')[1]
    return mask ? Number(mask) : 16
  })

  function getEditablePartCountByMask(mask: number): number {
    if (mask <= 8) return 1
    if (mask <= 16) return 2
    return 3
  }

  function normalizeCidrParts(parts: string[], mask: number): string[] {
    const editableCount = getEditablePartCountByMask(mask)
    return parts.map((part, idx) => (idx < editableCount ? part : '0'))
  }

  function canEditPodPart(idx: number): boolean {
    return idx < getEditablePartCountByMask(podMask.value)
  }

  function buildPodCidr(parts: string[], mask: number): string {
    const normalizedParts = normalizeCidrParts(parts, mask)
    return `${normalizedParts[0]}.${normalizedParts[1]}.${normalizedParts[2]}.${normalizedParts[3]}/${mask}`
  }

  function onPodPartChange(idx: number, val: string) {
    if (readOnly.value) return
    const parts = normalizeCidrParts([...podParts.value], podMask.value)
    parts[idx] = val
    emit('update:form', { ...props.form, podNetwork: buildPodCidr(parts, podMask.value) })
  }

  function onPodMaskChange(mask: number) {
    if (readOnly.value) return
    emit('update:form', {
      ...props.form,
      podNetwork: buildPodCidr(normalizeCidrParts(podParts.value, mask), mask)
    })
  }

  // ── Service IP 段 ──
  const maskOptions = [8, 16, 24]

  const svcParts = computed(() => {
    const cidr = props.form.serviceNetwork || '10.254.0.0/16'
    const [ip] = cidr.split('/')
    const parts = (ip ?? '10.254.0.0').split('.')
    return [parts[0] ?? '10', parts[1] ?? '254', parts[2] ?? '0', '0']
  })

  const svcMask = computed(() => {
    const cidr = props.form.serviceNetwork || '10.254.0.0/16'
    const mask = cidr.split('/')[1]
    return mask ? Number(mask) : 16
  })

  function buildSvcCidr(parts: string[], mask: number): string {
    const normalizedParts = normalizeCidrParts(parts, mask)
    return `${normalizedParts[0]}.${normalizedParts[1]}.${normalizedParts[2]}.0/${mask}`
  }

  function canEditSvcPart(idx: number): boolean {
    return idx < getEditablePartCountByMask(svcMask.value)
  }

  function onSvcPartChange(idx: number, val: string) {
    if (readOnly.value) return
    const parts = normalizeCidrParts([...svcParts.value], svcMask.value)
    parts[idx] = val
    emit('update:form', { ...props.form, serviceNetwork: buildSvcCidr(parts, svcMask.value) })
  }

  function onSvcMaskChange(mask: number) {
    if (readOnly.value) return
    emit('update:form', {
      ...props.form,
      serviceNetwork: buildSvcCidr(normalizeCidrParts(svcParts.value, mask), mask)
    })
  }

  function validateCidr(_r: unknown, value: string, cb: (err?: Error) => void) {
    const cidrRe = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!value || !cidrRe.test(value)) {
      cb(new Error('请输入有效的 CIDR 格式，如 10.244.0.0/16'))
    } else {
      cb()
    }
  }

  const rules: FormRules = {
    name: [{ required: true, message: '请输入集群名称', trigger: 'blur' }],
    kubernetesVersion: [{ required: true, message: '请选择 Kubernetes 版本', trigger: 'change' }],
    runtime: [{ required: true, message: '请选择容器运行时', trigger: 'change' }],
    osType: [{ required: true, message: '请选择操作系统', trigger: 'change' }],
    networkInterface: [{ required: true, message: '请输入节点网口名称', trigger: 'blur' }],
    cni: [{ required: true, message: '请选择容器网络插件', trigger: 'change' }],
    podNetwork: [{ required: true, validator: validateCidr, trigger: 'blur' }],
    serviceNetwork: [{ required: true, validator: validateCidr, trigger: 'change' }]
  }

  async function validate(): Promise<boolean> {
    if (!formRef.value) return false
    try {
      await formRef.value.validate()
      if (!props.form.osImage) {
        ElMessage.warning('请选择操作系统版本')
        return false
      }
      return true
    } catch {
      return false
    }
  }

  defineExpose({ validate })
</script>

<style scoped>
  .step-basic {
    max-width: 680px;
    padding-top: 8px;
  }

  .step-basic :deep(.el-form-item) {
    margin-bottom: 22px;
  }

  .step-basic :deep(.el-form-item__label) {
    color: var(--el-text-color-regular);
    font-size: 14px;
  }

  .os-selector {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
  }

  .runtime-label {
    margin-right: 4px;
  }

  .runtime-tag {
    vertical-align: middle;
  }

  .section-divider-top {
    margin-top: 5px;
  }

  .form-tip {
    margin-left: 10px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    white-space: nowrap;
  }

  .cidr-block {
    background: var(--el-fill-color-light);
    border-radius: 6px;
    padding: 14px 16px;
    width: 100%;
    box-sizing: border-box;
  }

  .cidr-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .cidr-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    margin-right: 6px;
    white-space: nowrap;
  }

  .cidr-first {
    width: 80px;
    flex-shrink: 0;
  }

  .cidr-second {
    width: 80px;
    flex-shrink: 0;
  }

  .cidr-fixed {
    width: 60px;
    flex-shrink: 0;
  }

  .cidr-fixed :deep(.el-input__inner) {
    text-align: center;
  }

  .cidr-mask {
    width: 76px;
    flex-shrink: 0;
  }

  .cidr-hint {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .service-ip-block {
    width: 100%;
  }

  .service-ip-inputs {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
  }

  .ip-part {
    width: 68px;
  }

  .ip-part :deep(.el-input__inner) {
    text-align: center;
  }

  .ip-dot {
    font-size: 14px;
    color: var(--el-text-color-regular);
    padding: 0 2px;
  }

  .ip-slash {
    font-size: 14px;
    color: var(--el-text-color-regular);
    padding: 0 4px;
  }

  .ip-mask {
    width: 80px;
  }

  .service-ip-hints {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .service-ip-warning {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-color-danger);
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 1.5;
  }

  .warning-icon {
    font-size: 13px;
    flex-shrink: 0;
  }
</style>
