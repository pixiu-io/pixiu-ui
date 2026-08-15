<template>
  <ElForm
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="140px"
    label-position="right"
    class="step-network"
  >
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
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, cni: $event })"
      >
        <ElOption label="Calico" value="calico" />
        <ElOption label="Flannel" value="flannel" />
        <ElOption label="Cilium" value="cilium" />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="容器子网" prop="podNetwork">
      <ElInput
        :model-value="form.podNetwork"
        placeholder="10.244.0.0/16"
        style="width: 240px"
        :disabled="readOnly"
        @update:model-value="emit('update:form', { ...form, podNetwork: $event })"
      />
      <span class="form-tip">Pod 网络 CIDR，不能与节点网段冲突</span>
    </ElFormItem>

    <ElFormItem label="Service IP 段" prop="serviceNetwork">
      <div class="service-ip-block">
        <div class="service-ip-inputs">
          <ElInput
            :model-value="svcParts[0]"
            class="ip-part"
            maxlength="3"
            :disabled="readOnly"
            @update:model-value="onSvcPartChange(0, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput
            :model-value="svcParts[1]"
            class="ip-part"
            maxlength="3"
            :disabled="readOnly"
            @update:model-value="onSvcPartChange(1, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput
            :model-value="svcParts[2]"
            class="ip-part"
            maxlength="3"
            :disabled="readOnly"
            @update:model-value="onSvcPartChange(2, $event)"
          />
          <span class="ip-dot">.</span>
          <ElInput :model-value="svcParts[3]" class="ip-part" maxlength="3" disabled />
          <span class="ip-slash">/</span>
          <ElSelect
            :model-value="svcMask"
            class="ip-mask"
            :disabled="readOnly"
            @update:model-value="onSvcMaskChange"
          >
            <ElOption v-for="m in maskOptions" :key="m" :label="String(m)" :value="m" />
          </ElSelect>
        </div>
        <div class="service-ip-hints">
          推荐网段：
          <ElLink
            v-for="hint in svcHints"
            :key="hint"
            type="primary"
            underline="never"
            class="hint-link"
            :disabled="readOnly"
            @click="applySvcHint(hint)"
            >{{ hint }}</ElLink
          >
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
  import type { DeployClusterForm } from './StepBasic.vue'

  defineOptions({ name: 'StepNetwork' })

  const props = withDefaults(defineProps<{ form: DeployClusterForm; readOnly?: boolean }>(), {
    readOnly: false
  })
  const emit = defineEmits<{ 'update:form': [DeployClusterForm] }>()
  const readOnly = computed(() => props.readOnly)

  const formRef = ref<FormInstance>()

  const maskOptions = [8, 12, 16, 17, 18, 19, 20, 24]
  const svcHints = ['10.96.0.0/12', '10.0.0.0/16', '172.16.0.0/16']

  // 解析 serviceNetwork 为分段
  const svcParts = computed(() => {
    const cidr = props.form.serviceNetwork || '10.96.0.0/12'
    const [ip] = cidr.split('/')
    const parts = (ip ?? '10.96.0').split('.')
    return [parts[0] ?? '10', parts[1] ?? '96', parts[2] ?? '0', '0']
  })

  const svcMask = computed(() => {
    const cidr = props.form.serviceNetwork || '10.96.0.0/12'
    const mask = cidr.split('/')[1]
    return mask ? Number(mask) : 12
  })

  function buildSvcCidr(parts: string[], mask: number): string {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/${mask}`
  }

  function onSvcPartChange(idx: number, val: string) {
    if (readOnly.value) return
    const parts = [...svcParts.value]
    parts[idx] = val
    emit('update:form', {
      ...props.form,
      serviceNetwork: buildSvcCidr(parts, svcMask.value)
    })
  }

  function onSvcMaskChange(mask: number) {
    if (readOnly.value) return
    emit('update:form', {
      ...props.form,
      serviceNetwork: buildSvcCidr(svcParts.value, mask)
    })
  }

  function applySvcHint(cidr: string) {
    if (readOnly.value) return
    emit('update:form', { ...props.form, serviceNetwork: cidr })
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
    networkInterface: [{ required: true, message: '请输入节点网口名称', trigger: 'blur' }],
    cni: [{ required: true, message: '请选择容器网络插件', trigger: 'change' }],
    podNetwork: [{ required: true, validator: validateCidr, trigger: 'blur' }],
    serviceNetwork: [{ required: true, validator: validateCidr, trigger: 'change' }]
  }

  async function validate(): Promise<boolean> {
    if (!formRef.value) return false
    try {
      await formRef.value.validate()
      return true
    } catch {
      return false
    }
  }

  defineExpose({ validate })
</script>

<style scoped>
  .step-network {
    max-width: 680px;
    padding-top: 8px;
  }

  .step-network :deep(.el-form-item) {
    margin-bottom: 22px;
  }

  .step-network :deep(.el-form-item__label) {
    color: var(--el-text-color-regular);
    font-size: 14px;
  }

  .form-tip {
    margin-left: 10px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    white-space: nowrap;
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

  .hint-link {
    font-size: 12px;
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
