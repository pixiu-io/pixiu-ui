<template>
  <div class="svc-create-page">
    <div class="svc-create-header">
      <ElButton text class="svc-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="svc-create-header-divider" />
      <ClusterResourceBreadcrumb
        parent-path="/container/config"
        parent-label="配置管理"
        current-label="创建 ConfigMap"
      />
    </div>

    <ElCard class="svc-create-card">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="140px" class="svc-form">
        <!-- ── 基础配置 ── -->
        <ElDivider content-position="left" class="svc-section-divider-top">基础配置</ElDivider>

        <ElFormItem label="名称" prop="name">
          <div class="svc-field-col">
            <ElInput v-model="form.name" placeholder="请输入 ConfigMap 名称" style="width: 300px" />
            <div class="svc-field-tip"
              >最长 63
              个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾</div
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

        <!-- ── 配置项 ── -->
        <ElDivider content-position="left">配置项</ElDivider>

        <ElFormItem prop="data">
          <template #label>
            <span>内容</span>
          </template>
          <div class="svc-field-col" style="width: 100%">
            <div class="cm-data-table">
              <div class="cm-data-header">
                <span class="cm-col-key">
                  变量名
                  <ElTooltip
                    content="只能包含字母、数字及分隔符（-、_、.），且必须以字母或数字开头和结尾"
                    placement="top"
                  >
                    <ElIcon class="cm-header-tip-icon"><QuestionFilled /></ElIcon>
                  </ElTooltip>
                </span>
                <span class="cm-col-eq"></span>
                <span class="cm-col-val">变量值</span>
                <span class="cm-col-del"></span>
              </div>
              <div v-for="(item, idx) in form.data" :key="`data-${idx}`" class="cm-data-row">
                <ElInput
                  v-model="item.key"
                  class="cm-col-key"
                  @paste="(e: ClipboardEvent) => onKeyPaste(e, idx)"
                />
                <span class="cm-col-eq-text">=</span>
                <ElInput
                  v-model="item.value"
                  type="textarea"
                  :rows="focusedIdx === idx ? 8 : 2"
                  class="cm-col-val"
                  @focus="focusedIdx = idx"
                  @blur="focusedIdx = -1"
                />
                <ElButton link class="kv-del-btn cm-col-del" @click="() => { form.data.splice(idx, 1); $nextTick(() => formRef?.validateField('data')) }">
                  <ElIcon><Close /></ElIcon>
                </ElButton>
              </div>
            </div>
            <div class="svc-field-tip" style="margin-top: 6px"
              >只能包含字母、数字及分隔符（"-"、"_"、"."）；变量名为空时，在变量名中粘贴一行或多行key=value或key:
              value的键值对可以实现快速批量输入</div
            >
            <div class="cm-data-actions">
              <ElButton link type="primary" class="kv-add-btn" @click="addDataRow"
                >手动增加</ElButton
              >
            </div>
          </div>
        </ElFormItem>
      </ElForm>

      <div class="svc-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建 ConfigMap</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close, QuestionFilled } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sConfigMap } from '@/api/kubernetes/configmap'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import ClusterResourceBreadcrumb from '../components/cluster-resource-breadcrumb.vue'

  defineOptions({ name: 'ConfigMapCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))

  const namespaces = ref<string[]>([])
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const focusedIdx = ref(-1)

  const form = ref({
    name: '',
    namespace: '',
    data: [{ key: '', value: '' }] as Array<{ key: string; value: string }>
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入 ConfigMap 名称', trigger: 'blur' },
      { min: 1, max: 63, message: '长度 1-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }],
    data: [
      {
        validator: (_rule, value: Array<{ key: string; value: string }>, callback) => {
          const filled = value.filter((d) => d.key.trim())
          if (!filled.length) return callback(new Error('请至少添加一条配置项'))
          const keyPattern = /^[a-zA-Z0-9._-]+$/
          const invalid = filled.find((d) => !keyPattern.test(d.key.trim()))
          if (invalid) return callback(new Error(`变量名 "${invalid.key}" 格式不正确`))
          callback()
        },
        trigger: 'change'
      }
    ]
  }

  function addDataRow() {
    form.value.data.push({ key: '', value: '' })
    void nextTick(() => formRef.value?.validateField('data'))
  }

  // 批量粘贴：当 key 为空时，解析 key=value 或 key: value 格式
  function onKeyPaste(e: ClipboardEvent, idx: number) {
    const text = e.clipboardData?.getData('text') ?? ''
    const lines = text
      .trim()
      .split('\n')
      .filter((l) => l.trim())
    if (lines.length < 2 && !text.includes('=') && !text.includes(': ')) return

    const parsed = lines
      .map((line) => {
        const eqIdx = line.indexOf('=')
        const colonIdx = line.indexOf(': ')
        if (eqIdx > 0)
          return { key: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1).trim() }
        if (colonIdx > 0)
          return { key: line.slice(0, colonIdx).trim(), value: line.slice(colonIdx + 2).trim() }
        return null
      })
      .filter(Boolean) as Array<{ key: string; value: string }>

    if (parsed.length > 0 && !form.value.data[idx].key) {
      e.preventDefault()
      form.value.data.splice(idx, 1, ...parsed)
    }
  }

  function buildManifest() {
    const f = form.value
    const data = f.data.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = key.trim()
      if (k) acc[k] = value
      return acc
    }, {})
    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: f.name.trim(),
        namespace: f.namespace
      },
      data
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
      await createK8sConfigMap(cluster.value, form.value.namespace, manifest)
      ElMessage.success(`ConfigMap（${form.value.name}）创建成功`)
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/config', query: { cluster: cluster.value } })
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
  /* ── 复用 service-create 的公共结构样式 ── */
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
  .svc-form :deep(.el-select__selected-item) {
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

  .kv-btn-divider {
    font-size: 12px;
    color: var(--el-border-color-darker);
    user-select: none;
    line-height: 1;
  }

  .svc-create-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  /* ── ConfigMap 内容配置区 ── */
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
    display: flex;
    align-items: center;
    gap: 4px;
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

  .cm-col-del {
    width: 28px;
    flex-shrink: 0;
  }

  .cm-header-tip-icon {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    cursor: help;
  }

  .cm-data-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
</style>
