<template>
  <div class="svc-create-page">
    <div class="svc-create-header">
      <ElButton text class="svc-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="svc-create-header-divider" />
      <ElBreadcrumb separator="/">
        <ElBreadcrumbItem :to="{ path: '/container/storage', query: { cluster, tab: 'pvc' } }"
          >存储管理</ElBreadcrumbItem
        >
        <ElBreadcrumbItem>创建 PersistentVolumeClaim</ElBreadcrumbItem>
      </ElBreadcrumb>
    </div>

    <ElCard class="svc-create-card">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="160px" class="svc-form">
        <!-- ── 基础配置 ── -->
        <ElDivider content-position="left" class="svc-section-divider-top">基础配置</ElDivider>

        <ElFormItem label="名称" prop="name">
          <div class="svc-field-col">
            <ElInput v-model="form.name" placeholder="请输入 PersistentVolumeClaim 名称" style="width: 300px" />
            <div class="svc-field-tip"
              >最长 253 个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母或数字开头和结尾</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="命名空间" prop="namespace">
          <ElSelect
            v-model="form.namespace"
            filterable
            placeholder="请选择命名空间"
            style="width: 300px"
          >
            <ElOption v-for="ns in namespaces" :key="ns" :label="ns" :value="ns" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="Labels">
          <div class="svc-field-col">
            <div class="kv-list">
              <div v-for="(item, idx) in form.labels" :key="`lbl-${idx}`" class="kv-row">
                <ElInput v-model="item.key" placeholder="key" />
                <ElInput v-model="item.value" placeholder="value" />
                <ElButton link class="kv-del-btn" @click="form.labels.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
              <ElButton link type="primary" class="kv-add-btn" @click="form.labels.push({ key: '', value: '' })"
                >新增</ElButton
              >
            </div>
          </div>
        </ElFormItem>

        <ElFormItem label="Annotations">
          <div class="svc-field-col">
            <div class="kv-list">
              <div v-for="(item, idx) in form.annotations" :key="`ann-${idx}`" class="kv-row">
                <ElInput v-model="item.key" placeholder="key" />
                <ElInput v-model="item.value" placeholder="value" />
                <ElButton link class="kv-del-btn" @click="form.annotations.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
              <ElButton link type="primary" class="kv-add-btn" @click="form.annotations.push({ key: '', value: '' })"
                >新增</ElButton
              >
            </div>
          </div>
        </ElFormItem>

        <!-- ── 存储配置 ── -->
        <ElDivider content-position="left">存储配置</ElDivider>

        <ElFormItem label="请求容量" prop="storage">
          <div class="svc-field-col">
            <ElInput v-model="form.storage" placeholder="如 10Gi、500Mi" style="width: 300px" />
            <div class="svc-field-tip"
              >声明需要的存储容量，Kubernetes 将寻找满足该容量要求的 PersistentVolume 进行绑定</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="访问模式" prop="accessModes">
          <div class="svc-field-col">
            <ElCheckboxGroup v-model="form.accessModes">
              <ElCheckbox value="ReadWriteOnce">ReadWriteOnce</ElCheckbox>
              <ElCheckbox value="ReadOnlyMany">ReadOnlyMany</ElCheckbox>
              <ElCheckbox value="ReadWriteMany">ReadWriteMany</ElCheckbox>
            </ElCheckboxGroup>
            <div class="svc-field-tip"
              >ReadWriteOnce：单节点读写；ReadOnlyMany：多节点只读；ReadWriteMany：多节点读写</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="卷模式">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.volumeMode" class="sc-radio-group">
              <ElRadioButton value="Filesystem">文件系统（Filesystem）</ElRadioButton>
              <ElRadioButton value="Block">块设备（Block）</ElRadioButton>
            </ElRadioGroup>
            <div class="svc-field-tip"
              >需与绑定的 PersistentVolume 卷模式一致，否则绑定失败</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="存储类（StorageClass）">
          <div class="svc-field-col">
            <ElInput
              v-model="form.storageClassName"
              placeholder="可选，指定 StorageClass 名称"
              style="width: 300px"
            />
            <div class="svc-field-tip"
              >指定后仅匹配相同 StorageClass 的 PV；留空则匹配所有无 StorageClass 的 PV；填写
              <code style="font-size:11px">""</code> 表示明确禁用 StorageClass</div
            >
          </div>
        </ElFormItem>

        <!-- ── 绑定配置 ── -->
        <ElDivider content-position="left">绑定配置（可选）</ElDivider>

        <ElFormItem label="指定 PV">
          <div class="svc-field-col">
            <ElInput
              v-model="form.volumeName"
              placeholder="可选，填写后将直接绑定指定 PV"
              style="width: 300px"
            />
            <div class="svc-field-tip"
              >填写 PersistentVolume 名称可跳过自动匹配逻辑，直接绑定到该 PV；留空由 Kubernetes 自动选择匹配的 PV</div
            >
          </div>
        </ElFormItem>
      </ElForm>

      <div class="svc-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建 PersistentVolumeClaim</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sPVC } from '@/api/kubernetes/pvc'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'

  defineOptions({ name: 'PVCCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))

  const namespaces = ref<string[]>([])
  const submitting = ref(false)
  const formRef = ref<FormInstance>()

  const form = ref({
    name: '',
    namespace: '',
    labels: [] as Array<{ key: string; value: string }>,
    annotations: [] as Array<{ key: string; value: string }>,
    storage: '',
    accessModes: ['ReadWriteOnce'] as string[],
    volumeMode: 'Filesystem' as 'Filesystem' | 'Block',
    storageClassName: '',
    volumeName: ''
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入 PersistentVolumeClaim 名称', trigger: 'blur' },
      { min: 1, max: 253, message: '长度 1-253', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }],
    storage: [
      { required: true, message: '请输入请求容量，如 10Gi', trigger: 'blur' },
      {
        pattern: /^\d+(\.\d+)?(Ki|Mi|Gi|Ti|Pi|Ei|m|k|M|G|T|P|E)?$/,
        message: '格式如 10Gi、500Mi、1Ti',
        trigger: 'blur'
      }
    ],
    accessModes: [{ required: true, type: 'array', min: 1, message: '请至少选择一种访问模式', trigger: 'change' }]
  }

  function kvToObj(list: Array<{ key: string; value: string }>): Record<string, string> {
    return list.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = key.trim()
      if (k) acc[k] = value.trim()
      return acc
    }, {})
  }

  function buildManifest() {
    const f = form.value
    const labels = kvToObj(f.labels)
    const annotations = kvToObj(f.annotations)

    const spec: Record<string, unknown> = {
      accessModes: f.accessModes,
      volumeMode: f.volumeMode,
      resources: {
        requests: { storage: f.storage.trim() }
      }
    }

    if (f.storageClassName.trim()) spec.storageClassName = f.storageClassName.trim()
    if (f.volumeName.trim()) spec.volumeName = f.volumeName.trim()

    return {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: f.name.trim(),
        namespace: f.namespace,
        ...(Object.keys(labels).length ? { labels } : {}),
        ...(Object.keys(annotations).length ? { annotations } : {})
      },
      spec
    }
  }

  async function submit() {
    const valid = await formRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return
    if (!cluster.value) {
      ElMessage.warning('缺少集群参数')
      return
    }
    submitting.value = true
    try {
      const manifest = buildManifest()
      await createK8sPVC(cluster.value, form.value.namespace, manifest)
      ElMessage.success(`PersistentVolumeClaim（${form.value.name}）创建成功`)
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/storage', query: { cluster: cluster.value, tab: 'pvc' } })
  }

  async function loadNamespaces() {
    if (!cluster.value) return
    try {
      const { items } = await fetchK8sNamespaceList(cluster.value, { page: 1, limit: 500 })
      namespaces.value = items.map((n) => n.metadata.name).sort()
    } catch {
      namespaces.value = []
    }
    form.value.namespace = defaultNamespace.value || namespaces.value[0] || 'default'
  }

  onMounted(() => {
    void loadNamespaces()
  })
</script>

<style scoped>
  .svc-create-page {
    padding: 0 clamp(16px, 4vw, 48px) 0;
  }

  .svc-create-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
    margin-left: calc(-1 * clamp(16px, 4vw, 48px));
  }

  .svc-create-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px 0 2px;
  }

  .svc-create-header-divider {
    margin: 0 12px;
    height: 16px;
  }

  .svc-create-card :deep(.el-card__body) {
    padding: 16px 20px;
  }

  .svc-form {
    max-width: 960px;
    padding-top: 4px;
  }

  .svc-form :deep(.el-form-item) {
    margin-bottom: 22px;
  }

  .svc-form :deep(.el-form-item__label) {
    font-size: 12px;
    padding-right: 16px;
    color: var(--el-text-color-regular);
  }

  .svc-form :deep(.el-form-item__content) {
    align-items: flex-start;
  }

  .svc-form :deep(.el-input__inner),
  .svc-form :deep(.el-select__placeholder),
  .svc-form :deep(.el-select__selected-item),
  .svc-form :deep(.el-radio__label),
  .svc-form :deep(.el-checkbox__label) {
    font-size: 12px;
  }

  .svc-section-divider-top {
    margin-top: 5px;
  }

  .svc-field-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
  }

  .svc-field-col .svc-field-tip {
    margin-top: 0;
  }

  .svc-field-tip {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    line-height: 1.5;
    margin-top: 4px;
  }

  .kv-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
  }

  .kv-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kv-row :deep(.el-input) {
    width: 200px;
    flex-shrink: 0;
  }

  .kv-del-btn {
    padding: 4px;
    color: var(--el-text-color-secondary);
  }

  .kv-add-btn {
    font-size: 12px;
    padding: 0;
    height: auto;
    align-self: flex-start;
  }

  .svc-create-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }

</style>
