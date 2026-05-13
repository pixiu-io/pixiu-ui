<template>
  <div class="svc-create-page">
    <div class="svc-create-header">
      <ElButton text class="svc-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="svc-create-header-divider" />
      <ElBreadcrumb separator="/">
        <ElBreadcrumbItem :to="{ path: '/container/config', query: { cluster } }"
          >配置管理</ElBreadcrumbItem
        >
        <ElBreadcrumbItem>创建 Secret</ElBreadcrumbItem>
      </ElBreadcrumb>
    </div>

    <ElCard class="svc-create-card">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="140px" class="svc-form">
        <!-- ── 基础配置 ── -->
        <ElDivider content-position="left" class="svc-section-divider-top">基础配置</ElDivider>

        <ElFormItem label="名称" prop="name">
          <div class="svc-field-col">
            <ElInput v-model="form.name" placeholder="请输入 Secret 名称" style="width: 300px" />
            <div class="svc-field-tip"
              >最长 63
              个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="Secret 类型" prop="secretType">
          <ElRadioGroup v-model="form.secretType" class="pull-policy-group">
            <ElRadioButton value="Opaque">Opaque</ElRadioButton>
            <ElRadioButton value="kubernetes.io/tls">TLS 证书</ElRadioButton>
            <ElRadioButton value="kubernetes.io/dockerconfigjson"
              >Dockercfg（镜像仓库访问凭证）</ElRadioButton
            >
          </ElRadioGroup>
        </ElFormItem>

        <!-- ── 配置项 ── -->
        <ElDivider content-position="left">配置项</ElDivider>

        <ElFormItem label="生效范围" prop="scopeType">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.scopeType">
              <ElRadio value="specified">指定命名空间</ElRadio>
              <ElRadio value="all">存量所有命名空间</ElRadio>
            </ElRadioGroup>
            <div v-if="form.scopeType === 'all'" class="svc-field-tip"
              >不包括kube-system、kube-public和后续增量命名空间</div
            >

            <div v-if="form.scopeType === 'specified'" class="ns-picker">
              <div class="ns-picker-header">
                <span class="ns-picker-pane-title">当前集群有以下可用命名空间</span>
                <span class="ns-picker-sep">↔</span>
                <span class="ns-picker-pane-title">已选择（{{ selectedNsList.length }}）</span>
              </div>
              <div class="ns-picker-body">
                <!-- 左侧：可选列表 -->
                <div class="ns-picker-left">
                  <div class="ns-picker-search">
                    <ElInput
                      v-model="nsSearch"
                      placeholder="请输入命名空间"
                      clearable
                      style="width: 100%"
                    >
                      <template #prefix
                        ><ElIcon><Search /></ElIcon
                      ></template>
                    </ElInput>
                  </div>
                  <div class="ns-list">
                    <div class="ns-list-header" @click="toggleAll">
                      <ElCheckbox
                        :model-value="allChecked"
                        :indeterminate="indeterminate"
                        @click.prevent
                      />
                      <span>名称</span>
                    </div>
                    <div
                      v-for="(ns, idx) in filteredNsList"
                      :key="ns"
                      class="ns-list-row"
                      @click="(e) => toggleNs(ns, idx, e)"
                    >
                      <ElCheckbox :model-value="form.selectedNs.has(ns)" @click.prevent />
                      <span>{{ ns }}</span>
                    </div>
                    <div v-if="!filteredNsList.length" class="ns-list-empty">无匹配命名空间</div>
                  </div>
                  <div class="ns-picker-hint">支持按住 shift 键进行多选</div>
                </div>

                <!-- 中间箭头 -->
                <div class="ns-picker-arrow">↔</div>

                <!-- 右侧：已选列表 -->
                <div class="ns-picker-right">
                  <div class="ns-list">
                    <div class="ns-list-header">
                      <span>名称</span>
                    </div>
                    <div
                      v-for="ns in selectedNsList"
                      :key="ns"
                      class="ns-list-row ns-list-row--selected"
                    >
                      <span>{{ ns }}</span>
                      <ElButton link class="ns-remove-btn" @click.stop="removeNs(ns)">
                        <ElIcon><CircleClose /></ElIcon>
                      </ElButton>
                    </div>
                    <div v-if="!selectedNsList.length" class="ns-list-empty">未选择命名空间</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ElFormItem>

        <!-- ── 内容配置（Opaque）── -->
        <ElFormItem v-if="form.secretType === 'Opaque'" prop="data">
          <template #label><span>内容</span></template>
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
                <ElButton
                  link
                  class="kv-del-btn cm-col-del"
                  @click="
                    () => {
                      form.data.splice(idx, 1)
                      nextTick(() => formRef?.validateField('data'))
                    }
                  "
                >
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

        <!-- ── 内容配置（TLS 证书）── -->
        <ElFormItem v-else-if="form.secretType === 'kubernetes.io/tls'" label="内容">
          <div class="tls-panes">
            <div class="tls-pane">
              <div class="tls-pane-header">
                <span class="tls-pane-label">
                  证书
                  <ElTooltip content="PEM 格式的 TLS 证书（tls.crt）" placement="top">
                    <ElIcon class="cm-header-tip-icon"><QuestionFilled /></ElIcon>
                  </ElTooltip>
                </span>
                <ElButton link type="primary" class="kv-add-btn" @click="importFile('cert')"
                  >文件导入</ElButton
                >
              </div>
              <ElInput
                v-model="form.tlsCert"
                type="textarea"
                :rows="12"
                :class="{ 'tls-input-error': tlsValidated && !form.tlsCert.trim() }"
              />
              <span v-if="tlsValidated && !form.tlsCert.trim()" class="tls-field-error"
                >证书不能为空</span
              >
            </div>
            <div class="tls-pane">
              <div class="tls-pane-header">
                <span class="tls-pane-label">
                  私钥
                  <ElTooltip content="PEM 格式的私钥（tls.key）" placement="top">
                    <ElIcon class="cm-header-tip-icon"><QuestionFilled /></ElIcon>
                  </ElTooltip>
                </span>
                <ElButton link type="primary" class="kv-add-btn" @click="importFile('key')"
                  >文件导入</ElButton
                >
              </div>
              <ElInput
                v-model="form.tlsKey"
                type="textarea"
                :rows="12"
                :class="{ 'tls-input-error': tlsValidated && !form.tlsKey.trim() }"
              />
              <span v-if="tlsValidated && !form.tlsKey.trim()" class="tls-field-error"
                >私钥不能为空</span
              >
            </div>
          </div>
        </ElFormItem>

        <!-- ── 内容配置（Dockercfg）── -->
        <template v-else-if="form.secretType === 'kubernetes.io/dockerconfigjson'">
          <ElFormItem label="镜像仓库域名" prop="dockerServer">
            <div class="svc-field-col">
              <ElInput
                v-model="form.dockerServer"
                placeholder="请输入仓库域名或IP"
                style="width: 300px"
              />
              <div class="svc-field-tip"
                >请输入镜像仓库的域名或IP，不需要包含协议（http/https）和路径。</div
              >
            </div>
          </ElFormItem>
          <ElFormItem label="用户名" prop="dockerUsername">
            <ElInput
              v-model="form.dockerUsername"
              placeholder="输入登录镜像仓库的用户名"
              style="width: 300px"
            />
          </ElFormItem>
          <ElFormItem label="密码" prop="dockerPassword">
            <ElInput
              v-model="form.dockerPassword"
              type="password"
              show-password
              placeholder="请输入登录镜像仓库的密码"
              style="width: 300px"
            />
          </ElFormItem>
          <ElFormItem label="密码确认" prop="dockerConfirm">
            <ElInput
              v-model="form.dockerConfirm"
              type="password"
              show-password
              placeholder="请再次输入登录镜像仓库的密码"
              style="width: 300px"
            />
          </ElFormItem>
        </template>
      </ElForm>

      <div class="svc-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建 Secret</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, CircleClose, Close, QuestionFilled, Search } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sSecret } from '@/api/kubernetes/secret'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'

  defineOptions({ name: 'SecretCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))

  const allNsList = ref<string[]>([])
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const focusedIdx = ref(-1)
  const nsSearch = ref('')
  const lastCheckedIdx = ref(-1)
  const tlsValidated = ref(false)

  const form = ref({
    name: '',
    secretType: 'Opaque',
    scopeType: 'specified' as 'specified' | 'all',
    selectedNs: new Set<string>(),
    data: [{ key: '', value: '' }] as Array<{ key: string; value: string }>,
    // TLS
    tlsCert: '',
    tlsKey: '',
    // Docker
    dockerServer: '',
    dockerUsername: '',
    dockerPassword: '',
    dockerConfirm: ''
  })

  // ── 命名空间选择器 ──
  const filteredNsList = computed(() => {
    const q = nsSearch.value.trim().toLowerCase()
    return q ? allNsList.value.filter((ns) => ns.toLowerCase().includes(q)) : allNsList.value
  })

  const selectedNsList = computed(() => [...form.value.selectedNs])

  const allChecked = computed(() => {
    const f = filteredNsList.value
    return f.length > 0 && f.every((ns) => form.value.selectedNs.has(ns))
  })

  const indeterminate = computed(() => {
    const f = filteredNsList.value
    const cnt = f.filter((ns) => form.value.selectedNs.has(ns)).length
    return cnt > 0 && cnt < f.length
  })

  function toggleNs(ns: string, idx: number, e: MouseEvent) {
    const set = form.value.selectedNs
    if (e.shiftKey && lastCheckedIdx.value !== -1) {
      const start = Math.min(lastCheckedIdx.value, idx)
      const end = Math.max(lastCheckedIdx.value, idx)
      const check = !set.has(ns)
      filteredNsList.value.slice(start, end + 1).forEach((n) => {
        check ? set.add(n) : set.delete(n)
      })
    } else {
      set.has(ns) ? set.delete(ns) : set.add(ns)
      lastCheckedIdx.value = idx
    }
    // 触发响应式更新
    form.value.selectedNs = new Set(set)
  }

  function toggleAll() {
    const f = filteredNsList.value
    const set = form.value.selectedNs
    if (allChecked.value) {
      f.forEach((ns) => set.delete(ns))
    } else {
      f.forEach((ns) => set.add(ns))
    }
    form.value.selectedNs = new Set(set)
  }

  function removeNs(ns: string) {
    const set = new Set(form.value.selectedNs)
    set.delete(ns)
    form.value.selectedNs = set
  }

  // ── 配置项 ──
  function addDataRow() {
    form.value.data.push({ key: '', value: '' })
    void nextTick(() => formRef.value?.validateField('data'))
  }

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

  // ── 校验 ──
  const rules: FormRules = {
    name: [
      { required: true, message: '请输入 Secret 名称', trigger: 'blur' },
      { min: 1, max: 63, message: '长度 1-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    scopeType: [
      {
        validator: (_rule, _value, callback) => {
          if (form.value.scopeType === 'specified' && form.value.selectedNs.size === 0) {
            return callback(new Error('请至少选择一个命名空间'))
          }
          callback()
        },
        trigger: 'change'
      }
    ],
    data: [
      {
        validator: (_rule, value: Array<{ key: string; value: string }>, callback) => {
          if (form.value.secretType !== 'Opaque') return callback()
          const filled = value.filter((d) => d.key.trim())
          if (!filled.length) return callback(new Error('请至少添加一条配置项'))
          const keyPattern = /^[a-zA-Z0-9._-]+$/
          const invalid = filled.find((d) => !keyPattern.test(d.key.trim()))
          if (invalid) return callback(new Error(`变量名 "${invalid.key}" 格式不正确`))
          callback()
        },
        trigger: 'change'
      }
    ],
    dockerServer: [
      {
        validator: (_rule, value, callback) => {
          if (form.value.secretType !== 'kubernetes.io/dockerconfigjson') return callback()
          if (!value?.trim()) return callback(new Error('请输入镜像仓库域名或IP'))
          callback()
        },
        trigger: 'blur'
      }
    ],
    dockerUsername: [
      {
        validator: (_rule, value, callback) => {
          if (form.value.secretType !== 'kubernetes.io/dockerconfigjson') return callback()
          if (!value?.trim()) return callback(new Error('请输入用户名'))
          callback()
        },
        trigger: 'blur'
      }
    ],
    dockerPassword: [
      {
        validator: (_rule, value, callback) => {
          if (form.value.secretType !== 'kubernetes.io/dockerconfigjson') return callback()
          if (!value) return callback(new Error('请输入密码'))
          callback()
        },
        trigger: 'blur'
      }
    ],
    dockerConfirm: [
      {
        validator: (_rule, value, callback) => {
          if (form.value.secretType !== 'kubernetes.io/dockerconfigjson') return callback()
          if (!value) return callback(new Error('请确认密码'))
          if (value !== form.value.dockerPassword) return callback(new Error('两次密码不一致'))
          callback()
        },
        trigger: 'blur'
      }
    ]
  }

  // ── 构建 & 提交 ──
  function buildStringData(): Record<string, string> {
    const type = form.value.secretType
    if (type === 'kubernetes.io/tls') {
      return { 'tls.crt': form.value.tlsCert, 'tls.key': form.value.tlsKey }
    }
    if (type === 'kubernetes.io/dockerconfigjson') {
      const auth = btoa(`${form.value.dockerUsername}:${form.value.dockerPassword}`)
      const config = {
        auths: {
          [form.value.dockerServer]: {
            username: form.value.dockerUsername,
            password: form.value.dockerPassword,
            auth
          }
        }
      }
      return { '.dockerconfigjson': JSON.stringify(config) }
    }
    return form.value.data.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = key.trim()
      if (k) acc[k] = value
      return acc
    }, {})
  }

  function importFile(target: 'cert' | 'key') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pem,.crt,.key,.txt'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (target === 'cert') form.value.tlsCert = content
        else form.value.tlsKey = content
      }
      reader.readAsText(file)
    }
    input.click()
  }

  async function submit() {
    // TLS 手动校验
    if (form.value.secretType === 'kubernetes.io/tls') {
      tlsValidated.value = true
      if (!form.value.tlsCert.trim() || !form.value.tlsKey.trim()) return
    }
    const valid = await formRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return
    if (!cluster.value) {
      ElMessage.warning('缺少集群参数')
      return
    }

    const targetNs: string[] =
      form.value.scopeType === 'all'
        ? allNsList.value.filter((ns) => ns !== 'kube-system' && ns !== 'kube-public')
        : [...form.value.selectedNs]

    if (!targetNs.length) {
      ElMessage.warning('没有可用的目标命名空间')
      return
    }

    submitting.value = true
    try {
      const stringData = buildStringData()
      await Promise.all(
        targetNs.map((ns) =>
          createK8sSecret(cluster.value, ns, {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: { name: form.value.name.trim(), namespace: ns },
            type: form.value.secretType,
            stringData
          })
        )
      )
      ElMessage.success(
        targetNs.length > 1
          ? `Secret（${form.value.name}）已在 ${targetNs.length} 个命名空间中创建`
          : `Secret（${form.value.name}）创建成功`
      )
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/config', query: { cluster: cluster.value, tab: 'sec' } })
  }

  async function loadNamespaces() {
    if (!cluster.value) return
    try {
      const { items } = await fetchK8sNamespaceList(cluster.value, { page: 1, limit: 500 })
      allNsList.value = items.map((n) => n.metadata.name).sort()
    } catch {
      allNsList.value = []
    }
    // 默认选中传入的命名空间
    const ns = defaultNamespace.value || allNsList.value[0] || 'default'
    if (ns) form.value.selectedNs = new Set([ns])
  }

  onMounted(() => {
    void loadNamespaces()
  })
</script>

<style scoped>
  /* ── 复用 svc/cm 公共结构 ── */
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

  .svc-create-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  /* ── Secret 类型：与创建 Deployment「拉取策略」分段样式一致（宽度随文案自适应）── */
  .pull-policy-group {
    --el-radio-button-checked-border-color: var(--el-color-primary);
    --el-radio-button-checked-bg-color: var(--el-bg-color-overlay);
    --el-radio-button-checked-text-color: var(--el-color-primary);
    display: inline-flex;
    flex-wrap: nowrap;
    width: fit-content;
    max-width: 100%;
    box-sizing: border-box;
    vertical-align: middle;
  }

  .pull-policy-group :deep(.el-radio-button) {
    flex: 0 0 auto;
    display: inline-flex;
  }

  .pull-policy-group :deep(.el-radio-button__inner) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    text-align: center;
    font-size: 12px;
    line-height: 1.2;
    padding: 0 10px;
    height: 28px;
    white-space: nowrap;
    font-weight: 400;
    color: var(--el-text-color-regular);
    background: transparent;
    border: 1px solid var(--el-border-color);
    border-radius: 0 !important;
    transition:
      border-color 0.15s,
      color 0.15s,
      background-color 0.15s;
  }

  .pull-policy-group :deep(.el-radio-button:first-child .el-radio-button__inner),
  .pull-policy-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 !important;
  }

  .pull-policy-group :deep(.el-radio-button__inner:hover) {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  .pull-policy-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: var(--el-bg-color-overlay) !important;
    color: var(--el-color-primary) !important;
    font-weight: 500 !important;
    border-color: var(--el-color-primary) !important;
    box-shadow: none !important;
    position: relative;
    z-index: 1;
  }

  /* ── 生效范围：命名空间选择器 ── */
  .ns-picker {
    width: 100%;
    margin-top: 10px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    overflow: hidden;
  }

  .ns-picker-header {
    display: none; /* 标题直接嵌在两栏内顶部 */
  }

  .ns-picker-body {
    display: flex;
    align-items: stretch;
    min-height: 300px;
  }

  .ns-picker-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .ns-picker-arrow {
    width: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .ns-picker-right {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .ns-picker-search {
    padding: 8px 10px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
  }

  .ns-picker-search :deep(.el-input),
  .ns-picker-search :deep(.el-input__wrapper) {
    flex: 1;
    width: 100%;
  }

  .ns-picker-pane-title {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    padding: 0 10px;
  }

  .ns-list {
    flex: 1;
    overflow-y: auto;
  }

  .ns-list-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
    border-bottom: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
    user-select: none;
  }

  .ns-list-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    border-bottom: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }

  .ns-list-row:hover {
    background: var(--el-fill-color-light);
  }

  .ns-list-row--selected {
    cursor: default;
    justify-content: space-between;
  }

  .ns-remove-btn {
    padding: 0;
    color: var(--el-text-color-secondary);
    font-size: 16px;
  }

  .ns-list-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ns-picker-hint {
    padding: 6px 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    border-top: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-lighter);
  }

  /* ── ConfigMap 同款配置项 ── */
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

  /* ── TLS 证书内容配置 ── */
  .tls-panes {
    display: flex;
    gap: 16px;
    width: 100%;
  }

  .tls-pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tls-pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .tls-pane-label {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tls-input-error :deep(.el-textarea__inner) {
    border-color: var(--el-color-danger) !important;
  }

  .tls-field-error {
    font-size: 12px;
    color: var(--el-color-danger);
    line-height: 1.4;
  }
</style>
