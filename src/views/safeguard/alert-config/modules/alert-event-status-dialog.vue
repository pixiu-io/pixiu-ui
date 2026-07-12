<template>
  <ElDialog v-model="dialogVisible" title="更新事件状态" width="420px" align-center destroy-on-close>
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="88px">
      <ElFormItem label="事件 ID">
        <span class="event-id-text">{{ eventData?.id ?? '-' }}</span>
      </ElFormItem>
      <ElFormItem label="规则名称">
        <span class="event-id-text">{{ eventData?.ruleName ?? '-' }}</span>
      </ElFormItem>
      <ElFormItem label="目标状态" prop="status">
        <ElSelect v-model="formData.status" class="w-full">
          <ElOption
            v-for="(meta, value) in AlertEventStatusMap"
            :key="value"
            :label="meta.label"
            :value="Number(value)"
          />
        </ElSelect>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    AlertEventStatusMap,
    fetchUpdateAlertEventStatus,
    type AlertEventItem,
    type AlertEventStatus
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'

  defineOptions({ name: 'AlertEventStatusDialog' })

  const props = defineProps<{ eventData?: AlertEventItem | null }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ success: [] }>()

  const dialogVisible = computed({
    get: () => visible.value,
    set: (value) => {
      visible.value = value
    }
  })

  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const formData = ref<{ status: AlertEventStatus }>({ status: 3 })

  const rules: FormRules = {
    status: [{ required: true, message: '请选择状态', trigger: 'change' }]
  }

  watch(
    () => visible.value,
    (open) => {
      if (!open || !props.eventData) return
      formData.value.status = props.eventData.status
      formRef.value?.clearValidate()
    }
  )

  async function handleSubmit() {
    if (!formRef.value || !props.eventData) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      await fetchUpdateAlertEventStatus(props.eventData.id, {
        resourceVersion: props.eventData.resourceVersion,
        status: formData.value.status
      })
      ElMessage.success('状态更新成功')
      emit('success')
      dialogVisible.value = false
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '更新失败')
      }
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped>
  .event-id-text {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  :deep(.el-form-item__label) {
    font-size: 12px;
  }
</style>
