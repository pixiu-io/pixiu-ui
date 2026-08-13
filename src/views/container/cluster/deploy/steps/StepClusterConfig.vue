<template>
  <ElForm
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="150px"
    label-position="right"
    class="step-cluster-config"
  >
    <ElDivider content-position="left" class="section-divider-top" style="margin-top: 24px"
      >高级配置</ElDivider
    >

    <ElFormItem label="高可用" prop="highAvailability">
      <ElSwitch
        :model-value="form.highAvailability"
        :disabled="readOnly"
        size="small"
        @update:model-value="onHighAvailabilityChange"
      />
      <div class="form-tip form-tip--block">
        启用高可用 Kubernetes 集群，推荐 master 节点数为 3
      </div>
    </ElFormItem>

    <ElFormItem label="自建 LoadBalance" class="lb-form-item">
      <div class="lb-config-block">
        <div class="lb-enable-row">
          <ElSwitch
            :model-value="form.selfLoadBalance"
            :disabled="readOnly || !form.highAvailability"
            size="small"
            @update:model-value="onSelfLoadBalanceChange"
          />
          <span class="lb-enable-tip">启用 haproxy + keepalived 自建负载均衡</span>
        </div>
        <ElFormItem
          v-if="form.selfLoadBalance"
          prop="keepalivedVirtualRouterId"
          class="runtime-dir-form-item"
          label-width="0"
        >
          <ElInput
            :model-value="form.keepalivedVirtualRouterId"
            placeholder="请输入 virtual_router_id"
            class="runtime-dir-input"
            clearable
            maxlength="3"
            inputmode="numeric"
            :disabled="readOnly"
            @update:model-value="onKeepalivedVirtualRouterIdChange"
          />
          <div class="form-tip form-tip--block">
            虚拟路由ID：0-255的任意值，首次使用推荐使用68。但是要保证同网段下唯一
          </div>
        </ElFormItem>
      </div>
    </ElFormItem>

    <ElFormItem label="ApiServer 地址" prop="apiServerAddress">
      <ElInput
        :model-value="form.apiServerAddress"
        placeholder="kubernetes apiserver 的地址，非高可用可不填"
        style="width: 360px"
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, apiServerAddress: $event })"
      />
      <div class="form-tip form-tip--block"
        >指定时需要在云平台上开启该地址到 master 节点的 6443 端口 4 层转发。自建负载均衡时，填入 VIP
        地址。
      </div>
    </ElFormItem>

    <ElFormItem label="监听端口" prop="apiServerPort">
      <ElInputNumber
        :model-value="form.apiServerPort"
        :min="1"
        :max="65535"
        :precision="0"
        :disabled="readOnly"
        style="width: 120px"
        @update:model-value="
          emit('update:form', { ...form, apiServerPort: Number($event || 6443) })
        "
      />
      <div class="form-tip form-tip--block"
        >ApiServer 监听端口, 默认 6443; 启用 haproxy + keepalived 时, 监听端口推荐使用 8443
      </div>
    </ElFormItem>

    <ElFormItem label="Kube-proxy 模式" prop="kubeProxyMode">
      <ElRadioGroup
        :model-value="form.kubeProxyMode"
        :disabled="readOnly"
        @update:model-value="
          emit('update:form', { ...form, kubeProxyMode: $event as 'iptables' | 'ipvs' })
        "
      >
        <ElRadio value="iptables">iptables</ElRadio>
        <ElRadio value="ipvs">ipvs</ElRadio>
      </ElRadioGroup>
      <div class="form-tip form-tip--block"
        >默认使用 iptables 模式，ipvs 的转发性能更高。选择之后无法修改</div
      >
    </ElFormItem>

    <ElFormItem label="自定义证书有效期" class="cert-period-form-item">
      <div class="cert-period-block">
        <div class="cert-period-enable-row">
          <ElSwitch
            :model-value="form.certificatePeriodEnabled"
            :disabled="readOnly"
            size="small"
            @update:model-value="onCertificatePeriodEnabledChange"
          />
          <span class="cert-period-enable-tip"
            >开启后可自定义集群证书与根证书有效期（仅 Kubernetes 1.31+ 支持）</span
          >
        </div>
        <div v-if="form.certificatePeriodEnabled" class="cert-period-fields">
          <div class="cert-period-field-group">
            <span class="cert-period-field-label">证书有效期</span>
            <ElFormItem
              prop="certificateValidityPeriod"
              class="cert-period-field-form-item"
              label-width="0"
            >
              <div class="cert-period-input-wrap">
                <ElInputNumber
                  :model-value="form.certificateValidityPeriod"
                  :min="1"
                  :precision="0"
                  :disabled="readOnly"
                  @update:model-value="onCertificateValidityPeriodChange"
                />
                <span class="cert-period-unit">年</span>
              </div>
            </ElFormItem>
          </div>
          <div class="cert-period-field-group">
            <span class="cert-period-field-label cert-period-field-label--ca">根证书有效期</span>
            <ElFormItem
              prop="caCertificateValidityPeriod"
              class="cert-period-field-form-item"
              label-width="0"
            >
              <div class="cert-period-input-wrap">
                <ElInputNumber
                  :model-value="form.caCertificateValidityPeriod"
                  :min="1"
                  :precision="0"
                  :disabled="readOnly"
                  @update:model-value="onCaCertificateValidityPeriodChange"
                />
                <span class="cert-period-unit">年</span>
              </div>
            </ElFormItem>
          </div>
        </div>
      </div>
    </ElFormItem>

    <ElFormItem label="自建 NFS" class="nfs-form-item">
      <div class="nfs-config-block">
        <div class="nfs-enable-row">
          <ElCheckbox
            :model-value="form.nfsEnabled"
            :disabled="readOnly"
            @update:model-value="onNfsEnabledChange as any"
          >
            启用
          </ElCheckbox>
          <span class="nfs-enable-tip"
            >（部署 NFS Server 并创建 StorageClass，需配置 storage 角色节点）</span
          >
        </div>
        <div v-if="form.nfsEnabled" class="nfs-fields">
          <div class="nfs-field-row">
            <span class="nfs-field-label">StorageClass:</span>
            <ElInput
              :model-value="form.nfsStorageClassName"
              placeholder="请输入 NFS 存储名称"
              class="nfs-field-input"
              clearable
              :disabled="readOnly"
              @update:model-value="emit('update:form', { ...form, nfsStorageClassName: $event })"
            />
          </div>
          <div class="nfs-field-row">
            <span class="nfs-field-label">StorageDataDir:</span>
            <ElFormItem prop="nfsStorageDataDir" class="nfs-field-form-item" label-width="0">
              <ElInput
                :model-value="form.nfsStorageDataDir"
                placeholder="请输入 NFS 存储的文件夹路径"
                class="nfs-field-input"
                clearable
                :disabled="readOnly"
                @update:model-value="emit('update:form', { ...form, nfsStorageDataDir: $event })"
              />
            </ElFormItem>
          </div>
        </div>
      </div>
    </ElFormItem>

    <ElFormItem label="Metrics Server">
      <ElCheckbox
        :model-value="form.metricsServer"
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, metricsServer: $event as boolean })"
      >
        启用
      </ElCheckbox>
      <div class="form-tip form-tip--block">
        收集和资源指标数据的核心组件，它从各节点的 Kubelet 采集 CPU、内存等资源使用情况，并通过
        Metrics API 提供给 HPA（水平 Pod 自动伸缩）和 kubectl top 等工具使用
      </div>
    </ElFormItem>

    <ElFormItem label="Nginx Ingress">
      <ElCheckbox
        :model-value="form.ingressNginx"
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, ingressNginx: $event as boolean })"
      >
        启用
      </ElCheckbox>
      <div class="form-tip form-tip--block">
        Kubernetes 集群中基于 Nginx 的反向代理组件，用于管理外部流量接入
      </div>
    </ElFormItem>
  </ElForm>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import type { DeployClusterForm } from './StepBasic.vue'

  defineOptions({ name: 'StepClusterConfig' })

  const props = withDefaults(
    defineProps<{ form: DeployClusterForm; readOnly?: boolean; lockImmutableFields?: boolean }>(),
    {
      readOnly: false,
      lockImmutableFields: false
    }
  )
  const emit = defineEmits<{ 'update:form': [DeployClusterForm] }>()
  const form = computed(() => props.form)
  const readOnly = computed(() => props.readOnly)
  const formRef = ref<FormInstance>()

  function onNfsEnabledChange(checked: boolean) {
    emit('update:form', {
      ...props.form,
      nfsEnabled: checked,
      nfsStorageClassName: checked ? props.form.nfsStorageClassName : '',
      nfsStorageDataDir: checked ? props.form.nfsStorageDataDir : ''
    })
    nextTick(() => {
      formRef.value?.clearValidate('nfsStorageDataDir')
    })
  }

  /** 解析 Kubernetes 版本主/次版本号（兼容可选 v 前缀与缺失 patch） */
  function parseK8sVersion(raw: string): { major: number; minor: number } | null {
    const v = (raw ?? '').trim().replace(/^[vV]/, '')
    const m = v.match(/^(\d+)\.(\d+)/)
    if (!m) return null
    return { major: Number(m[1]), minor: Number(m[2]) }
  }

  function isK8sVersionGte131(raw: string): boolean {
    const p = parseK8sVersion(raw)
    if (!p) return false
    return p.major > 1 || (p.major === 1 && p.minor >= 31)
  }

  function onCertificatePeriodEnabledChange(enabled: boolean | string | number) {
    const on = Boolean(enabled)
    if (on && !isK8sVersionGte131(props.form.kubernetesVersion)) {
      ElMessage.warning('Kubernetes 版本不符合要求，自定义证书有效期仅支持 1.31+')
      return
    }
    emit('update:form', {
      ...props.form,
      certificatePeriodEnabled: on,
      certificateValidityPeriod: on
        ? props.form.certificateValidityPeriod || 1
        : props.form.certificateValidityPeriod,
      caCertificateValidityPeriod: on
        ? props.form.caCertificateValidityPeriod || 10
        : props.form.caCertificateValidityPeriod
    })
    nextTick(() => {
      formRef.value?.clearValidate(['certificateValidityPeriod', 'caCertificateValidityPeriod'])
      if (on) {
        void formRef.value?.validateField('certificateValidityPeriod')
        void formRef.value?.validateField('caCertificateValidityPeriod')
      }
    })
  }

  // 部署环境切换到低于 1.31 的版本时，自动关闭自定义证书有效期
  watch(
    () => props.form.kubernetesVersion,
    (ver) => {
      if (!props.form.certificatePeriodEnabled) return
      if (isK8sVersionGte131(ver)) return
      emit('update:form', {
        ...props.form,
        certificatePeriodEnabled: false
      })
      nextTick(() => {
        formRef.value?.clearValidate(['certificateValidityPeriod', 'caCertificateValidityPeriod'])
      })
    }
  )

  function onCertificateValidityPeriodChange(value: number | undefined) {
    emit('update:form', {
      ...props.form,
      certificateValidityPeriod: Number.isFinite(value) ? Math.floor(Number(value)) : 1
    })
    nextTick(() => {
      void formRef.value?.validateField('certificateValidityPeriod')
      void formRef.value?.validateField('caCertificateValidityPeriod')
    })
  }

  function onCaCertificateValidityPeriodChange(value: number | undefined) {
    emit('update:form', {
      ...props.form,
      caCertificateValidityPeriod: Number.isFinite(value) ? Math.floor(Number(value)) : 10
    })
    nextTick(() => {
      void formRef.value?.validateField('caCertificateValidityPeriod')
    })
  }

  function validateCertificateValidityPeriod(
    _r: unknown,
    value: number,
    cb: (err?: Error) => void
  ) {
    if (!props.form.certificatePeriodEnabled) {
      cb()
      return
    }
    if (!Number.isInteger(value) || value < 1) {
      cb(new Error('请输入大于 0 的整数'))
      return
    }
    cb()
  }

  function validateCaCertificateValidityPeriod(
    _r: unknown,
    value: number,
    cb: (err?: Error) => void
  ) {
    if (!props.form.certificatePeriodEnabled) {
      cb()
      return
    }
    if (!Number.isInteger(value) || value < 1) {
      cb(new Error('请输入大于 0 的整数'))
      return
    }
    if (value <= props.form.certificateValidityPeriod) {
      cb(new Error('根证书有效期必须大于证书有效期'))
      return
    }
    cb()
  }

  function validateNfsStorageDataDir(_r: unknown, value: string, cb: (err?: Error) => void) {
    if (!props.form.nfsEnabled) {
      cb()
      return
    }
    const v = (value ?? '').trim()
    if (!v) {
      cb()
      return
    }
    if (!v.startsWith('/')) {
      cb(new Error('请输入以 / 开头的 Linux 文件夹路径'))
      return
    }
    cb()
  }

  function normalizeKeepalivedVirtualRouterId(raw: string): string {
    const digits = String(raw ?? '').replace(/\D/g, '')
    if (!digits) return ''
    return String(Math.min(255, Number(digits)))
  }

  function onKeepalivedVirtualRouterIdChange(value: string) {
    emit('update:form', {
      ...props.form,
      keepalivedVirtualRouterId: normalizeKeepalivedVirtualRouterId(value)
    })
  }

  function validateKeepalivedVirtualRouterId(
    _r: unknown,
    value: string,
    cb: (err?: Error) => void
  ) {
    if (!props.form.selfLoadBalance) {
      cb()
      return
    }
    const v = (value ?? '').trim()
    if (!v) {
      cb(new Error('请输入 virtual_router_id'))
      return
    }
    if (!/^\d+$/.test(v)) {
      cb(new Error('请输入 0-255 之间的整数'))
      return
    }
    const n = Number(v)
    if (n < 0 || n > 255) {
      cb(new Error('请输入 0-255 之间的整数'))
      return
    }
    cb()
  }

  function onSelfLoadBalanceChange(enabled: boolean | string | number) {
    if (readOnly.value) return
    const selfLoadBalance = Boolean(enabled)
    emit('update:form', {
      ...props.form,
      selfLoadBalance,
      keepalivedVirtualRouterId: selfLoadBalance ? props.form.keepalivedVirtualRouterId : ''
    })
    nextTick(() => {
      if (selfLoadBalance) {
        formRef.value?.validateField('keepalivedVirtualRouterId')
      } else {
        formRef.value?.clearValidate('keepalivedVirtualRouterId')
      }
    })
  }

  const rules: FormRules = {
    highAvailability: [
      {
        required: true,
        validator: (_rule, value: unknown, callback: (err?: Error) => void) => {
          if (typeof value !== 'boolean') {
            callback(new Error('请选择是否启用高可用'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ],
    apiServerAddress: [
      {
        validator: (_rule, value: unknown, callback: (err?: Error) => void) => {
          const v = String(value ?? '').trim()
          if (!v) {
            callback()
            return
          }

          const ipv4Re =
            /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
          const domainRe =
            /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/

          if (!ipv4Re.test(v) && !domainRe.test(v)) {
            callback(new Error('ApiServer 地址格式不正确，请输入 IPv4 地址或域名'))
            return
          }
          callback()
        },
        trigger: ['blur', 'change']
      }
    ],
    apiServerPort: [{ required: true, message: '请输入监听端口', trigger: 'change' }],
    kubeProxyMode: [{ required: true, message: '请选择 Kube-proxy 模式', trigger: 'change' }],
    nfsStorageDataDir: [{ validator: validateNfsStorageDataDir, trigger: ['blur', 'change'] }],
    certificateValidityPeriod: [
      { validator: validateCertificateValidityPeriod, trigger: ['blur', 'change'] }
    ],
    caCertificateValidityPeriod: [
      { validator: validateCaCertificateValidityPeriod, trigger: ['blur', 'change'] }
    ],
    keepalivedVirtualRouterId: [
      { validator: validateKeepalivedVirtualRouterId, trigger: ['blur', 'change'] }
    ]
  }

  function onHighAvailabilityChange(enabled: boolean | string | number) {
    if (readOnly.value) return
    const highAvailability = Boolean(enabled)
    emit('update:form', {
      ...props.form,
      highAvailability,
      selfLoadBalance: highAvailability ? props.form.selfLoadBalance : false,
      keepalivedVirtualRouterId: highAvailability ? props.form.keepalivedVirtualRouterId : '',
      apiServerPort: highAvailability ? 8443 : 6443
    })
  }

  async function validate(): Promise<boolean> {
    if (!formRef.value) return false
    try {
      await formRef.value.validate()
      if (
        props.form.highAvailability &&
        !props.form.selfLoadBalance &&
        !props.form.apiServerAddress.trim()
      ) {
        ElMessage.warning('高可用模式下建议配置 ApiServer 地址，或开启自建 LoadBalance')
      }
      return true
    } catch {
      return false
    }
  }

  defineExpose({ validate })
</script>

<style scoped>
  .step-cluster-config {
    width: 100%;
    max-width: none;
    padding-top: 0;
  }

  .step-cluster-config :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  .step-cluster-config :deep(.el-form-item__label) {
    font-size: 12px;
  }

  .section-divider-top {
    margin-top: 0;
  }

  .form-tip {
    flex-basis: 100%;
    width: 100%;
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    line-height: 1.5;
  }

  .form-tip--block {
    display: block;
    flex-basis: 100%;
    width: 100%;
    margin-left: 0;
    margin-top: 6px;
    white-space: normal;
    line-height: 1.5;
  }
  .step-cluster-config :deep(.el-checkbox__label) {
    font-size: 12px;
  }

  .cert-period-form-item :deep(.el-form-item__content) {
    align-items: flex-start;
  }

  .cert-period-block {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 32px;
  }

  .cert-period-enable-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    min-height: 32px;
    gap: 8px;
  }

  .cert-period-enable-tip {
    font-size: 12px;
    line-height: 32px;
    color: var(--el-text-color-placeholder);
  }

  .cert-period-fields {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 16px 24px;
    margin-top: 10px;
  }

  .cert-period-field-group {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
  }

  .cert-period-field-label {
    flex-shrink: 0;
    width: 72px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 1;
    white-space: nowrap;
  }

  .cert-period-field-label--ca {
    width: 96px;
  }

  .cert-period-field-form-item {
    margin-bottom: 0 !important;
  }

  .cert-period-field-form-item :deep(.el-form-item__content) {
    margin-left: 0 !important;
    min-height: 32px;
    line-height: 32px;
    display: flex;
    align-items: center;
  }

  .cert-period-field-form-item :deep(.el-form-item__error) {
    position: static;
    padding-top: 4px;
    line-height: 1.2;
  }

  /* 与 workloads 更新副本数弹窗中「期望副本数」一致：默认左右 +/- */
  .cert-period-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
  }

  .cert-period-unit {
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 32px;
    flex-shrink: 0;
  }

  .nfs-form-item :deep(.el-form-item__content) {
    align-items: flex-start;
  }

  .nfs-config-block {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 32px;
  }

  .nfs-enable-row {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    max-width: 100%;
    min-height: 32px;
    line-height: 32px;
  }

  .nfs-enable-row :deep(.el-checkbox) {
    flex-shrink: 0;
    height: 32px;
    margin-right: 0;
  }

  .nfs-enable-row :deep(.el-checkbox__label) {
    font-size: 12px;
    padding-right: 0;
    line-height: 32px;
  }

  .nfs-enable-tip {
    flex: 1;
    min-width: 0;
    margin: 0 0 0 4px;
    font-size: 12px;
    line-height: 32px;
    color: var(--el-text-color-placeholder);
    white-space: normal;
  }

  .nfs-fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
    padding-left: 0;
  }

  .nfs-field-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-height: 32px;
  }

  .nfs-field-form-item {
    flex: 1;
    margin-bottom: 0;
  }

  .nfs-field-form-item :deep(.el-form-item__label) {
    display: none;
  }

  .nfs-field-form-item :deep(.el-form-item__content) {
    margin-left: 0 !important;
    line-height: normal;
  }

  .nfs-field-form-item :deep(.el-form-item__error) {
    position: static;
    padding-top: 4px;
  }

  .nfs-field-label {
    flex-shrink: 0;
    width: 108px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 32px;
    white-space: nowrap;
  }

  .nfs-field-input {
    width: 320px;
  }

  .nfs-field-input :deep(.el-input__inner),
  .nfs-field-input :deep(.el-input__wrapper) {
    font-size: 12px;
  }

  .nfs-field-input :deep(.el-input__inner::placeholder),
  .nfs-field-input :deep(.el-input__wrapper input::placeholder) {
    font-size: 12px !important;
    opacity: 1;
  }

  .lb-form-item :deep(.el-form-item__content) {
    align-items: flex-start;
  }

  .lb-config-block {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 32px;
  }

  .lb-enable-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    min-height: 32px;
    line-height: 32px;
  }

  .lb-enable-tip {
    margin-left: 8px;
    font-size: 12px;
    line-height: 32px;
    color: var(--el-text-color-placeholder);
  }

  .runtime-dir-form-item {
    width: 100%;
    margin-top: 10px;
    margin-bottom: 0;
  }

  .runtime-dir-form-item :deep(.el-form-item__label) {
    display: none;
  }

  .runtime-dir-form-item :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .runtime-dir-input {
    width: 280px;
  }

  .runtime-dir-input :deep(.el-input__inner),
  .runtime-dir-input :deep(.el-input__wrapper) {
    font-size: 12px;
  }

  .runtime-dir-input :deep(.el-input__inner::placeholder),
  .runtime-dir-input :deep(.el-input__wrapper input::placeholder) {
    font-size: 12px !important;
    opacity: 1;
  }
</style>
