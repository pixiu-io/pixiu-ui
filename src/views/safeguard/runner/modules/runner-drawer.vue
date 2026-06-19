<!-- Runner 管理：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="40%"
    destroy-on-close
    :show-close="false"
    class="runner-drawer"
  >
    <template #header>
      <div class="runner-drawer-header">
        <span class="runner-drawer-title">{{ isEdit ? '编辑 Runner' : '添加 Runner' }}</span>
        <ElButton text circle class="runner-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="runner-drawer-body">
      <ElForm :model="formData" :rules="rules" ref="formRef" label-width="120px" class="runner-form">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入名称" />
        </ElFormItem>
        <ElFormItem label="镜像" prop="engineImage">
          <ElInput v-model="formData.engineImage" placeholder="请输入镜像地址" />
        </ElFormItem>
        <ElFormItem label="描述" prop="description">
          <ElInput v-model="formData.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="runner-drawer-footer">
        <ElButton @click="closeDrawer">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close } from '@element-plus/icons-vue'
  import { ElIcon, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { computed, ref, watch } from 'vue'
  import {
    fetchCreateRunner,
    fetchGetRunner,
    fetchUpdateRunner,
    type CreateRunnerParams,
    type UpdateRunnerParams
  } from '@/api/runner'
  import { PixiuApiError } from '@/api/container'

  defineOptions({ name: 'RunnerDrawer' })

  interface FormData {
    name: string
    engineImage: string
    description?: string
  }

  const props = defineProps<{
    editId?: number
  }>()

  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{
    success: []
  }>()

  const isEdit = computed(() => props.editId != null && props.editId > 0)
  const editLoading = ref(false)
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const formData = ref<FormData>({
    name: '',
    engineImage: '',
    description: ''
  })
  const editResourceVersion = ref(0)

  const rules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    engineImage: [{ required: true, message: '请输入镜像', trigger: 'blur' }]
  }

  watch(visible, (val) => {
    if (val) {
      resetForm()
      if (isEdit.value && props.editId) {
        loadEditData(props.editId)
      }
    }
  })

  function resetForm() {
    formData.value = {
      name: '',
      engineImage: '',
      description: ''
    }
    editResourceVersion.value = 0
  }

  async function loadEditData(id: number) {
    editLoading.value = true
    try {
      const data = await fetchGetRunner(id)
      console.log('loadEditData 成功获取数据:', data)
      formData.value = {
        name: data.name,
        engineImage: data.engineImage,
        description: data.description
      }
      editResourceVersion.value = data.resourceVersion
      console.log('loadEditData 设置 editResourceVersion 为:', editResourceVersion.value)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '获取数据失败')
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  function closeDrawer() {
    visible.value = false
  }

  async function handleSubmit() {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (valid) {
        submitting.value = true
        try {
          if (isEdit.value && props.editId) {
            console.log('准备编辑 Runner, editId:', props.editId)
            console.log('editResourceVersion 的值:', editResourceVersion.value)
            const params: UpdateRunnerParams = {
              id: props.editId,
              resourceVersion: editResourceVersion.value,
              name: formData.value.name,
              engineImage: formData.value.engineImage,
              description: formData.value.description
            }
            console.log('准备调用 fetchUpdateRunner, params:', params)
            await fetchUpdateRunner(params.id, params)
            ElMessage.success('修改成功')
          } else {
            const params: CreateRunnerParams = {
              name: formData.value.name,
              engineImage: formData.value.engineImage,
              description: formData.value.description
            }
            await fetchCreateRunner(params)
            ElMessage.success('创建成功')
          }
          emit('success')
          closeDrawer()
        } catch (error) {
          console.log('handleSubmit 捕获到错误:', error)
          if (!(error instanceof PixiuApiError) || !error.notified) {
            ElMessage.error(error instanceof Error ? error.message : '操作失败')
          }
        } finally {
          submitting.value = false
        }
      }
    })
  }
</script>

<style scoped lang="less">
  .runner-drawer {
    :deep(.el-drawer__header) {
      margin-bottom: 0;
      padding: 20px 24px 12px;
    }
  }

  .runner-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .runner-drawer-title {
    font-size: 16px;
    font-weight: 600;
  }

  .runner-drawer-body {
    padding: 0 24px;
  }

  .runner-form {
    padding-top: 12px;
  }

  .runner-drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
</style>
