<!-- 静默规则：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="50%"
    destroy-on-close
    :show-close="false"
    class="alert-silence-drawer"
  >
    <template #header>
      <div class="alert-drawer-header">
        <span class="alert-drawer-title">{{ isEdit ? '编辑静默规则' : '添加静默规则' }}</span>
        <ElButton text circle class="alert-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="alert-drawer-body">
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="108px" class="alert-form">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入静默规则名称" />
        </ElFormItem>
        <ElFormItem label="开始时间" prop="startsAt">
          <ElDatePicker
            v-model="formData.startsAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            class="w-full"
            placeholder="选择开始时间"
          />
        </ElFormItem>
        <ElFormItem label="结束时间" prop="endsAt">
          <ElDatePicker
            v-model="formData.endsAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            class="w-full"
            placeholder="选择结束时间"
          />
        </ElFormItem>
        <ElFormItem label="匹配标签">
          <ElInput
            v-model="formData.matchLabels"
            type="textarea"
            :rows="3"
            placeholder='JSON，如 {"severity":"warning"}'
          />
        </ElFormItem>
        <ElFormItem label="匹配表达式">
          <ElInput
            v-model="formData.matchExpressions"
            type="textarea"
            :rows="3"
            placeholder="可选，高级匹配表达式"
          />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="formData.comment" type="textarea" :rows="2" placeholder="可选" />
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
    fetchCreateAlertSilence,
    fetchGetAlertSilence,
    fetchUpdateAlertSilence
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'

  defineOptions({ name: 'AlertSilenceDrawer' })

  const props = defineProps<{ editId?: number }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ success: [] }>()

  const isEdit = computed(() => props.editId != null && props.editId > 0)
  const editLoading = ref(false)
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const resourceVersion = ref(0)

  const formData = ref({
    name: '',
    matchLabels: '',
    matchExpressions: '',
    startsAt: '',
    endsAt: '',
    comment: '',
    enabled: true
  })

  const rules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    startsAt: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
    endsAt: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
  }

  function closeDrawer() {
    visible.value = false
  }

  async function loadDetail() {
    if (!isEdit.value || !props.editId) return
    editLoading.value = true
    try {
      const detail = await fetchGetAlertSilence(props.editId)
      resourceVersion.value = detail.resourceVersion
      formData.value = {
        name: detail.name,
        matchLabels: detail.matchLabels,
        matchExpressions: detail.matchExpressions,
        startsAt: detail.startsAt,
        endsAt: detail.endsAt,
        comment: detail.comment,
        enabled: detail.enabled
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载静默规则失败')
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  watch(
    () => visible.value,
    async (open) => {
      if (!open) return
      if (isEdit.value) {
        await loadDetail()
      } else {
        resourceVersion.value = 0
        formData.value = {
          name: '',
          matchLabels: '',
          matchExpressions: '',
          startsAt: '',
          endsAt: '',
          comment: '',
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
      if (isEdit.value && props.editId) {
        await fetchUpdateAlertSilence(props.editId, {
          resource_version: resourceVersion.value,
          name: formData.value.name,
          match_labels: formData.value.matchLabels,
          match_expressions: formData.value.matchExpressions,
          starts_at: formData.value.startsAt,
          ends_at: formData.value.endsAt,
          comment: formData.value.comment,
          enabled: formData.value.enabled
        })
        ElMessage.success('更新成功')
      } else {
        await fetchCreateAlertSilence({
          name: formData.value.name,
          match_labels: formData.value.matchLabels,
          match_expressions: formData.value.matchExpressions,
          starts_at: formData.value.startsAt,
          ends_at: formData.value.endsAt,
          comment: formData.value.comment,
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
