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

    <ElFormItem label="自建 LoadBalance">
      <ElSwitch
        :model-value="form.selfLoadBalance"
        :disabled="readOnly || !form.highAvailability"
        size="small"
        @update:model-value="emit('update:form', { ...form, selfLoadBalance: $event as boolean })"
      />
      <div class="form-tip form-tip--block">启用 haproxy + keepalived 自建负载均衡</div>
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
        <ElRadio value="ipvs" disabled>ipvs</ElRadio>
      </ElRadioGroup>
      <div class="form-tip form-tip--block"
        >默认使用 iptables 模式，ipvs 的转发性能更高。选择之后无法修改</div
      >
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
  const lockImmutableFields = computed(() => props.lockImmutableFields)
  const formRef = ref<FormInstance>()

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
    kubeProxyMode: [{ required: true, message: '请选择 Kube-proxy 模式', trigger: 'change' }]
  }

  function onHighAvailabilityChange(enabled: boolean | string | number) {
    if (readOnly.value) return
    const highAvailability = Boolean(enabled)
    emit('update:form', {
      ...props.form,
      highAvailability,
      selfLoadBalance: highAvailability ? props.form.selfLoadBalance : false,
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
</style>
