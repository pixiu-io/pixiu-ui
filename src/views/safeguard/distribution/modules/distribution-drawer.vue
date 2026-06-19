<!-- 操作系统管理：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="40%"
    destroy-on-close
    :show-close="false"
    class="distribution-drawer"
  >
    <template #header>
      <div class="distribution-drawer-header">
        <span class="distribution-drawer-title">{{ isEdit ? '编辑系统' : '添加系统' }}</span>
        <ElButton text circle class="distribution-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="distribution-drawer-body">
      <ElForm :model="formData" :rules="rules" ref="formRef" label-width="120px" class="distribution-form">
        <ElFormItem label="系统家族" prop="family">
          <ElSelect v-model="formData.family" placeholder="请选择系统家族" style="width: 100%" filterable>
            <template #label>
              <div v-if="formData.family" class="os-option">
                <ArtSvgIcon :icon="osIcon(formData.family)" class="os-option__logo" :style="{ color: osBrandColors[formData.family] || '#606266' }" />
                <span class="os-option__name">{{ osFamilies.find(f => f.value === formData.family)?.label ?? formData.family }}</span>
              </div>
            </template>
            <ElOption v-for="item in osFamilies" :key="item.value" :label="item.label" :value="item.value">
              <div class="os-option">
                <ArtSvgIcon :icon="osIcon(item.value)" class="os-option__logo" :style="{ color: osBrandColors[item.value] || '#606266' }" />
                <span class="os-option__name">{{ item.label }}</span>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="系统名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入系统名称" />
        </ElFormItem>
        <ElFormItem label="Runner" prop="runner">
          <ElInput v-model="formData.runner" placeholder="请输入 Runner" />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="distribution-drawer-footer">
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
    fetchCreateDistribution,
    fetchGetDistribution,
    fetchUpdateDistribution,
    type CreateDistributionParams,
    type UpdateDistributionParams
  } from '@/api/distribution'

  defineOptions({ name: 'DistributionDrawer' })

  interface FormData {
    family: string
    name: string
    runner: string
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
    family: '',
    name: '',
    runner: ''
  })
  const editResourceVersion = ref(0)

  // 系统家族选项
  const osFamilies = [
    { value: 'centos', label: 'CentOS' },
    { value: 'ubuntu', label: 'Ubuntu' },
    { value: 'debian', label: 'Debian' },
    { value: 'openEuler', label: 'OpenEuler' },
    { value: 'rocky', label: 'RockyLinux' }
  ]

  // 系统家族图标映射
  const osIconMap: Record<string, string> = {
    centos: 'ri:centos-fill',
    ubuntu: 'simple-icons:ubuntu',
    debian: 'simple-icons:debian',
    openEuler: 'ri:openbase-fill',
    rocky: 'simple-icons:rockylinux'
  }

  // 系统家族品牌色
  const osBrandColors: Record<string, string> = {
    centos: '#932279',
    ubuntu: '#E95420',
    debian: '#A81D33',
    openEuler: '#0067C0',
    rocky: '#10B981'
  }

  function osIcon(os: string) {
    return osIconMap[os] ?? 'ri:ubuntu-line'
  }

  function osBrandColor(os: string) {
    return osBrandColors[os] ?? '#606266'
  }

  const rules: FormRules = {
    family: [{ required: true, message: '请输入操作系统家族', trigger: 'blur' }],
    name: [{ required: true, message: '请输入发行版名称', trigger: 'blur' }],
    runner: [{ required: true, message: '请输入 Runner 镜像', trigger: 'blur' }]
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
      family: '',
      name: '',
      runner: ''
    }
    editResourceVersion.value = 0
  }

  async function loadEditData(id: number) {
    editLoading.value = true
    try {
      const data = await fetchGetDistribution(id)
      formData.value = {
        family: data.family,
        name: data.name,
        runner: data.runner
      }
      editResourceVersion.value = data.resourceVersion
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
            const params: UpdateDistributionParams = {
              id: props.editId,
              resourceVersion: editResourceVersion.value,
              family: formData.value.family,
              name: formData.value.name,
              runner: formData.value.runner
            }
            await fetchUpdateDistribution(params)
            ElMessage.success('修改成功')
          } else {
            const params: CreateDistributionParams = {
              family: formData.value.family,
              name: formData.value.name,
              runner: formData.value.runner
            }
            await fetchCreateDistribution(params)
            ElMessage.success('创建成功')
          }
          emit('success')
          closeDrawer()
        } catch (error) {
          ElMessage.error(error instanceof Error ? error.message : '操作失败')
        } finally {
          submitting.value = false
        }
      }
    })
  }
</script>

<style scoped lang="less">
  .distribution-drawer {
    :deep(.el-drawer__header) {
      margin-bottom: 0;
      padding: 20px 24px 12px;
    }
  }

  .distribution-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .distribution-drawer-title {
    font-size: 16px;
    font-weight: 600;
  }

  .distribution-drawer-body {
    padding: 0 24px;
  }

  .distribution-form {
    padding-top: 12px;
  }

  .distribution-drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .os-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 22px;
    line-height: 22px;
  }

  .os-option__logo {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    font-size: 16px;
  }

  .os-option__logo :deep(svg) {
    color: inherit;
  }

  .os-option__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .distribution-form :deep(.el-select__selected-item) {
    display: flex;
    align-items: center;
  }

  .distribution-form :deep(.el-select-dropdown__item) {
    height: auto;
    padding: 8px 12px;
  }
</style>
