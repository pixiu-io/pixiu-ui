<!-- 告警规则：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="50%"
    destroy-on-close
    :show-close="false"
    class="alert-rule-drawer"
  >
    <template #header>
      <div class="alert-drawer-header">
        <span class="alert-drawer-title">{{ isEdit ? '编辑告警规则' : '添加告警规则' }}</span>
        <ElButton text circle class="alert-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="alert-drawer-body">
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="108px" class="alert-form">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入规则名称" />
        </ElFormItem>
        <ElFormItem label="规则类型" prop="ruleType">
          <ElSelect v-model="formData.ruleType" class="w-full">
            <ElOption v-for="(label, value) in AlertRuleTypeMap" :key="value" :label="label" :value="Number(value)" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="严重级别" prop="severity">
          <ElSelect v-model="formData.severity" class="w-full">
            <ElOption
              v-for="(meta, value) in AlertSeverityMap"
              :key="value"
              :label="meta.label"
              :value="Number(value)"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="作用范围" prop="scopeType">
          <ElSelect v-model="formData.scopeType" class="w-full">
            <ElOption v-for="(label, value) in AlertScopeTypeMap" :key="value" :label="label" :value="Number(value)" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="formData.scopeType !== 1" label="范围值" prop="scopeValue">
          <ElInput v-model="formData.scopeValue" placeholder="集群名、租户 ID 等" />
        </ElFormItem>
        <ElFormItem label="指标名称">
          <ElInput v-model="formData.metricName" placeholder="可选，Prometheus 指标名" />
        </ElFormItem>
        <ElFormItem label="条件表达式" prop="conditionExpr">
          <ElInput
            v-model="formData.conditionExpr"
            type="textarea"
            :rows="3"
            placeholder="例如: value > 80"
          />
        </ElFormItem>
        <ElFormItem label="持续时长">
          <ElInputNumber v-model="formData.duration" :min="0" :step="1" class="w-full" />
          <span class="alert-form-hint">秒，0 表示立即触发</span>
        </ElFormItem>
        <ElFormItem label="评估间隔">
          <ElInputNumber v-model="formData.evalInterval" :min="15" :step="1" class="w-full" />
          <span class="alert-form-hint">秒，默认 15</span>
        </ElFormItem>
        <ElFormItem label="通知渠道">
          <ElSelect
            v-model="selectedChannelIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            class="w-full"
            placeholder="选择已配置的通知渠道"
          >
            <ElOption v-for="item in channelOptions" :key="item.id" :label="item.name" :value="item.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="通知模板">
          <ElInput v-model="formData.notifyTemplate" type="textarea" :rows="3" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput v-model="formData.description" type="textarea" :rows="2" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="启用">
          <ElSwitch v-model="formData.enabled" />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="alert-drawer-footer">
        <ElButton @click="closeDrawer">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close } from '@element-plus/icons-vue'
  import { computed, ref, watch } from 'vue'
  import { ElIcon, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    AlertRuleTypeMap,
    AlertScopeTypeMap,
    AlertSeverityMap,
    fetchCreateAlertRule,
    fetchGetAlertChannelList,
    fetchGetAlertRule,
    fetchUpdateAlertRule,
    type AlertChannelItem,
    type AlertRuleType,
    type AlertScopeType,
    type AlertSeverity
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'

  defineOptions({ name: 'AlertRuleDrawer' })

  const props = defineProps<{ editId?: number }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ success: [] }>()

  const isEdit = computed(() => props.editId != null && props.editId > 0)
  const editLoading = ref(false)
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const resourceVersion = ref(0)
  const channelOptions = ref<AlertChannelItem[]>([])
  const selectedChannelIds = ref<number[]>([])

  const formData = ref({
    name: '',
    description: '',
    ruleType: 1 as AlertRuleType,
    metricName: '',
    conditionExpr: '',
    duration: 0,
    evalInterval: 15,
    severity: 2 as AlertSeverity,
    scopeType: 1 as AlertScopeType,
    scopeValue: '',
    notifyTemplate: '',
    enabled: true
  })

  const rules: FormRules = {
    name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
    ruleType: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
    conditionExpr: [{ required: true, message: '请输入条件表达式', trigger: 'blur' }],
    severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }],
    scopeType: [{ required: true, message: '请选择作用范围', trigger: 'change' }]
  }

  async function loadChannelOptions() {
    const { records } = await fetchGetAlertChannelList({ page: 1, limit: 200, enabled: true })
    channelOptions.value = records
  }

  function parseChannelIds(raw: string): number[] {
    return raw
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((id) => id > 0)
  }

  function closeDrawer() {
    visible.value = false
  }

  async function loadDetail() {
    if (!isEdit.value || !props.editId) return
    editLoading.value = true
    try {
      const detail = await fetchGetAlertRule(props.editId)
      resourceVersion.value = detail.resourceVersion
      selectedChannelIds.value = parseChannelIds(detail.notifyChannels)
      formData.value = {
        name: detail.name,
        description: detail.description,
        ruleType: detail.ruleType,
        metricName: detail.metricName,
        conditionExpr: detail.conditionExpr,
        duration: detail.duration,
        evalInterval: detail.evalInterval,
        severity: detail.severity,
        scopeType: detail.scopeType,
        scopeValue: detail.scopeValue,
        notifyTemplate: detail.notifyTemplate,
        enabled: detail.enabled
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载规则详情失败')
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  watch(
    () => visible.value,
    async (open) => {
      if (!open) return
      await loadChannelOptions()
      if (isEdit.value) {
        await loadDetail()
      } else {
        resourceVersion.value = 0
        selectedChannelIds.value = []
        formData.value = {
          name: '',
          description: '',
          ruleType: 1,
          metricName: '',
          conditionExpr: '',
          duration: 0,
          evalInterval: 15,
          severity: 2,
          scopeType: 1,
          scopeValue: '',
          notifyTemplate: '',
          enabled: true
        }
      }
      formRef.value?.clearValidate()
    }
  )

  async function handleSubmit() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      const notifyChannels = selectedChannelIds.value.join(',')
      if (isEdit.value && props.editId) {
        await fetchUpdateAlertRule(props.editId, {
          resource_version: resourceVersion.value,
          name: formData.value.name,
          description: formData.value.description,
          rule_type: formData.value.ruleType,
          metric_name: formData.value.metricName,
          condition_expr: formData.value.conditionExpr,
          duration: formData.value.duration,
          eval_interval: formData.value.evalInterval,
          severity: formData.value.severity,
          scope_type: formData.value.scopeType,
          scope_value: formData.value.scopeValue,
          notify_channels: notifyChannels,
          notify_template: formData.value.notifyTemplate,
          enabled: formData.value.enabled
        })
        ElMessage.success('更新成功')
      } else {
        await fetchCreateAlertRule({
          name: formData.value.name,
          description: formData.value.description,
          rule_type: formData.value.ruleType,
          metric_name: formData.value.metricName,
          condition_expr: formData.value.conditionExpr,
          duration: formData.value.duration,
          eval_interval: formData.value.evalInterval,
          severity: formData.value.severity,
          scope_type: formData.value.scopeType,
          scope_value: formData.value.scopeValue,
          notify_channels: notifyChannels,
          notify_template: formData.value.notifyTemplate,
          enabled: formData.value.enabled
        })
        ElMessage.success('创建成功')
      }
      emit('success')
      closeDrawer()
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '提交失败')
      }
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped lang="scss">
  .alert-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .alert-drawer-title {
    font-size: 15px;
    font-weight: 600;
  }

  .alert-drawer-body {
    padding-right: 8px;
  }

  .alert-form-hint {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .alert-drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  :deep(.el-form-item__label),
  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 12px;
  }
</style>
