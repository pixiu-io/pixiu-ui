<template>
  <div class="svc-create-page">
    <div class="svc-create-header">
      <ElButton text class="svc-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="svc-create-header-divider" />
      <ClusterResourceBreadcrumb
        parent-path="/container/storage"
        parent-label="存储管理"
        current-label="创建 StorageClass"
      />
    </div>

    <ElCard class="svc-create-card">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="140px" class="svc-form">
        <!-- ── 基础配置 ── -->
        <ElDivider content-position="left" class="svc-section-divider-top">基础配置</ElDivider>

        <ElFormItem label="名称" prop="name">
          <div class="svc-field-col">
            <ElInput
              v-model="form.name"
              placeholder="请输入 StorageClass 名称"
              style="width: 300px"
            />
            <div class="svc-field-tip"
              >最长 63
              个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾</div
            >
          </div>
        </ElFormItem>

        <!-- ── 配置 ── -->

        <ElFormItem label="Provisioner" prop="provisioner">
          <div class="svc-field-col">
            <ElInput
              v-model="form.provisioner"
              placeholder="请输入 provisioner"
              style="width: 300px"
            />
            <div class="svc-field-tip"
              >指定用于创建 PV 的存储插件，如 localstorage.csi.caoyingjunz.io</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="存储参数" prop="parameters">
          <div class="svc-field-col" style="width: 100%">
            <div class="cm-data-actions" style="margin-top: 0">
              <ElButton link type="primary" class="kv-add-btn" @click="addParam">手动增加</ElButton>
            </div>
            <div v-if="form.parameters.length" class="cm-data-table">
              <div class="cm-data-header">
                <span class="cm-col-key">参数名</span>
                <span class="cm-col-eq"></span>
                <span class="cm-col-val">参数值</span>
                <span class="cm-col-del"></span>
              </div>
              <div v-for="(item, idx) in form.parameters" :key="`param-${idx}`" class="cm-data-row">
                <ElInput v-model="item.key" class="cm-col-key" placeholder="key" />
                <span class="cm-col-eq-text">=</span>
                <ElInput v-model="item.value" class="cm-col-val" placeholder="value" />
                <ElButton
                  link
                  class="kv-del-btn cm-col-del"
                  @click="form.parameters.splice(idx, 1)"
                >
                  <ElIcon><Close /></ElIcon>
                </ElButton>
              </div>
            </div>
          </div>
        </ElFormItem>

        <ElFormItem label="绑定模式" prop="volumeBindingMode">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.volumeBindingMode" class="sc-radio-group">
              <ElRadioButton value="Immediate">立即绑定</ElRadioButton>
              <ElRadioButton value="WaitForFirstConsumer">等待调度</ElRadioButton>
            </ElRadioGroup>
            <div v-if="form.volumeBindingMode === 'Immediate'" class="svc-field-tip"
              >直接进行 PersistentVolume 分配和绑定，绑定速度更快，推荐单可用区集群使用</div
            >
            <div v-else class="svc-field-tip"
              >延迟 PersistentVolume 的分配和绑定，直到使用该 PersistentVolume 的 Pod 被调度</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="挂载配置">
          <div class="svc-field-col" style="width: 100%">
            <div class="cm-data-actions" style="margin-top: 0">
              <ElButton link type="primary" class="kv-add-btn" @click="form.mountOptions.push('')"
                >手动增加</ElButton
              >
            </div>
            <div v-if="form.mountOptions.length" class="cm-data-table">
              <div class="cm-data-header">
                <span class="cm-col-mo">挂载选项</span>
                <span class="cm-col-del"></span>
              </div>
              <div v-for="(item, idx) in form.mountOptions" :key="`mo-${idx}`" class="cm-data-row">
                <ElInput
                  v-model="form.mountOptions[idx]"
                  class="cm-col-mo"
                  placeholder="如 hard、nfsvers=4.1"
                />
                <ElButton
                  link
                  class="kv-del-btn cm-col-del"
                  @click="form.mountOptions.splice(idx, 1)"
                >
                  <ElIcon><Close /></ElIcon>
                </ElButton>
              </div>
            </div>
            <div class="svc-field-tip"
              >挂载到节点时传递给 mount 命令的额外参数，如 hard、nfsvers=4.1</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="回收策略" prop="reclaimPolicy">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.reclaimPolicy" class="sc-radio-group">
              <ElRadioButton value="Delete">删除</ElRadioButton>
              <ElRadioButton value="Retain">保留</ElRadioButton>
            </ElRadioGroup>
            <div v-if="form.reclaimPolicy === 'Delete'" class="svc-field-tip sc-tip-danger"
              >PVC 删除时会同步删除存储资源</div
            >
            <div v-else class="svc-field-tip sc-tip-warning"
              >PVC 删除时保留对应存储资源，如需删除请自行退还资源</div
            >
          </div>
        </ElFormItem>
      </ElForm>

      <div class="svc-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建 StorageClass</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sStorageClass } from '@/api/kubernetes/storageclass'
  import ClusterResourceBreadcrumb from '../components/cluster-resource-breadcrumb.vue'

  defineOptions({ name: 'StorageClassCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))

  const submitting = ref(false)
  const formRef = ref<FormInstance>()

  const form = ref({
    name: '',
    provisioner: '',
    reclaimPolicy: 'Retain',
    volumeBindingMode: 'WaitForFirstConsumer',
    parameters: [] as Array<{ key: string; value: string }>,
    mountOptions: [] as string[]
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入 StorageClass 名称', trigger: 'blur' },
      { min: 1, max: 63, message: '长度 1-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    provisioner: [{ required: true, message: '请输入 Provisioner', trigger: 'blur' }]
  }

  function addParam() {
    form.value.parameters.push({ key: '', value: '' })
  }

  function buildManifest() {
    const f = form.value
    const parameters = f.parameters.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = key.trim()
      if (k) acc[k] = value
      return acc
    }, {})
    const mountOptions = f.mountOptions.map((o) => o.trim()).filter(Boolean)
    const manifest: Record<string, unknown> = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'StorageClass',
      metadata: { name: f.name.trim() },
      provisioner: f.provisioner.trim(),
      reclaimPolicy: f.reclaimPolicy,
      volumeBindingMode: f.volumeBindingMode
    }
    if (Object.keys(parameters).length) manifest.parameters = parameters
    if (mountOptions.length) manifest.mountOptions = mountOptions
    return manifest
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
      await createK8sStorageClass(cluster.value, manifest)
      ElMessage.success(`StorageClass（${form.value.name}）创建成功`)
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/storage', query: { cluster: cluster.value, tab: 'sc' } })
  }
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

  .svc-form :deep(.el-input__inner) {
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

  .svc-field-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }

  .sc-tip-danger {
    color: var(--el-color-danger);
  }

  .sc-tip-warning {
    color: var(--el-color-warning);
  }

  .svc-create-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  /* ── 参数/挂载配置表格 ── */
  .cm-data-table {
    width: 100%;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    overflow: hidden;
  }

  .cm-data-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }

  .cm-data-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .cm-col-key {
    width: 280px;
    flex-shrink: 0;
  }

  .cm-col-eq {
    width: 20px;
    flex-shrink: 0;
  }

  .cm-col-eq-text {
    width: 20px;
    flex-shrink: 0;
    text-align: center;
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }

  .cm-col-val {
    flex: 1;
    min-width: 0;
  }

  .cm-col-mo {
    flex: 1;
    min-width: 0;
  }

  .cm-col-del {
    width: 28px;
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

  .cm-data-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
</style>
