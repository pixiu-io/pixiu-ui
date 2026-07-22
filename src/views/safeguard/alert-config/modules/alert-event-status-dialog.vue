<template>
  <ElDialog v-model="dialogVisible" :title="dialogTitle" width="420px" align-center destroy-on-close>
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="88px">
      <ElFormItem v-if="isBatch" label="已选事件">
        <span class="event-id-text">共 {{ events.length }} 条</span>
      </ElFormItem>
      <template v-else>
        <ElFormItem label="事件 ID">
          <span class="event-id-text">{{ singleEvent?.id ?? '-' }}</span>
        </ElFormItem>
        <ElFormItem label="规则名称">
          <span class="event-id-text">{{ singleEvent?.ruleName ?? '-' }}</span>
        </ElFormItem>
      </template>
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

  const props = defineProps<{ events?: AlertEventItem[] }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ success: [] }>()

  const dialogVisible = computed({
    get: () => visible.value,
    set: (value) => {
      visible.value = value
    }
  })

  const events = computed(() => props.events ?? [])
  const isBatch = computed(() => events.value.length > 1)
  const singleEvent = computed(() => events.value[0] ?? null)
  const dialogTitle = computed(() => (isBatch.value ? '处理事件' : '更新事件状态'))

  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const formData = ref<{ status: AlertEventStatus }>({ status: 3 })

  const rules: FormRules = {
    status: [{ required: true, message: '请选择状态', trigger: 'change' }]
  }

  watch(
    () => visible.value,
    (open) => {
      if (!open || !events.value.length) return
      formData.value.status = isBatch.value ? 3 : events.value[0].status
      formRef.value?.clearValidate()
    }
  )

  async function handleSubmit() {
    if (!formRef.value || !events.value.length) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      const results = await Promise.allSettled(
        events.value.map((item) =>
          fetchUpdateAlertEventStatus(item.id, {
            resourceVersion: item.resourceVersion,
            status: formData.value.status
          })
        )
      )
      const failed = results.filter((item) => item.status === 'rejected').length
      const succeeded = results.length - failed
      if (failed === 0) {
        ElMessage.success(isBatch.value ? `已更新 ${succeeded} 条事件状态` : '状态更新成功')
      } else if (succeeded === 0) {
        ElMessage.error('状态更新失败')
      } else {
        ElMessage.warning(`成功 ${succeeded} 条，失败 ${failed} 条`)
      }
      if (succeeded > 0) {
        emit('success')
        dialogVisible.value = false
      }
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
