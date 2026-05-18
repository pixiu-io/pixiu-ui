<template>
  <ElDialog
    v-model="visibleInner"
    :title="phase === 'choose' ? '选择集群类型' : '导入集群'"
    :width="phase === 'choose' ? '720px' : '640px'"
    align-center
    destroy-on-close
    :class="['cluster-add-dialog', { 'cluster-add-dialog--import': phase === 'import' }]"
    @closed="onClosed"
  >
    <template v-if="phase === 'choose'">
      <div class="type-grid">
        <button
          type="button"
          class="type-card"
          :class="{ 'is-active': picked === 'import' }"
          @click="picked = 'import'"
        >
          <div class="type-card-inner">
            <div class="type-title">导入集群</div>
            <p class="type-desc"
              >上传或粘贴 KubeConfig，将现有 Kubernetes 注册到容器服务统一管理。</p
            >
            <ul class="type-bullets">
              <li>多云管理，灵活接入各种计算资源</li>
              <li>对接现有 DevOps 系统，实现多云发布</li>
              <li>完全兼容开源 Kubernetes 集群</li>
              <li>生态开源 多云管理</li>
            </ul>
          </div>
        </button>
        <button
          type="button"
          class="type-card"
          :class="{ 'is-active': picked === 'self' }"
          @click="picked = 'self'"
        >
          <div class="type-card-inner">
            <div class="type-title">部署集群</div>
            <p class="type-desc"
              >通过向导配置地域、网络、节点等信息，创建部署计划并安装 Kubernetes。</p
            >
            <ul class="type-bullets">
              <li>标准原生 Kubernets 集群、丰富的自定义接口</li>
              <li>适用于高稳定性、定制化集群业务</li>
              <li>灵活的集群网络、容器调度</li>
              <li>标准K8s集群 支持原生节点</li>
            </ul>
          </div>
        </button>
      </div>
    </template>

    <template v-else>
      <ElForm
        ref="importFormRef"
        :model="importForm"
        :rules="importRules"
        label-width="100px"
        label-position="right"
        class="import-form"
      >
        <ElFormItem label="集群名称" prop="aliasName" class="import-form__first">
          <ElInput
            v-model="importForm.aliasName"
            placeholder="集群名称，例如生产环境 k8s 集群"
            clearable
          />
        </ElFormItem>
        <ElFormItem label="KubeConfig" prop="kubeRaw" class="kube-form-row">
          <div class="kube-config-block">
            <div v-show="kubeInputMode === 'file'" class="kube-panel">
              <ElUpload
                ref="uploadRef"
                class="kube-upload"
                drag
                :auto-upload="false"
                :limit="1"
                :on-change="onKubeFile"
                :on-remove="onKubeRemove"
                accept=".yaml,.yml,.conf,.config,text/plain"
              >
                <ElIcon class="upload-icon"><UploadFilled /></ElIcon>
                <div class="el-upload__text">将 kubeconfig 拖到此处，或 <em>点击选择文件</em></div>
              </ElUpload>
            </div>

            <div v-show="kubeInputMode === 'paste'" class="kube-panel">
              <ElInput
                v-model="importForm.kubeRaw"
                type="textarea"
                :rows="10"
                placeholder="请粘贴 kubeconfig 全文"
                class="kube-textarea"
                spellcheck="false"
              />
            </div>

            <ElRadioGroup v-model="kubeInputMode" class="kube-mode-group">
              <ElRadioButton label="file">上传文件</ElRadioButton>
              <ElRadioButton label="paste">粘贴内容</ElRadioButton>
            </ElRadioGroup>
          </div>
        </ElFormItem>
        <ElFormItem label="删除保护" class="protect-form-row">
          <div class="protect-block">
            <ElSwitch
              v-model="importForm.protected"
              inline-prompt
              active-text="开"
              inactive-text="关"
            />
            <p class="protect-hint">开启后不允许删除该集群</p>
          </div>
        </ElFormItem>
        <ElFormItem label="描述" class="desc-form-row">
          <ElInput
            v-model="importForm.description"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            placeholder="可选"
          />
        </ElFormItem>
      </ElForm>
    </template>

    <template #footer>
      <div v-if="phase === 'choose'" class="dialog-footer-btns dialog-footer-btns--choose">
        <ElButton @click="visibleInner = false">取消</ElButton>
        <ElButton type="primary" :disabled="!picked" @click="onNextFromChoose">下一步</ElButton>
      </div>
      <div v-else class="dialog-footer-btns dialog-footer-btns--import">
        <ElButton :loading="pingLoading" @click="onPing">测试连接</ElButton>
        <div class="footer-right">
          <ElButton @click="phase = 'choose'">上一步</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="onImportSubmit">确定</ElButton>
        </div>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type {
    FormInstance,
    FormRules,
    UploadFile,
    UploadFiles,
    UploadInstance
  } from 'element-plus'
  import { UploadFilled } from '@element-plus/icons-vue'
  import { useRouter } from 'vue-router'
  import { encodeKubeConfigBase64, fetchCreateCluster, fetchPingCluster } from '@/api/container'

  defineOptions({ name: 'ClusterAddDialog' })

  const props = defineProps<{ visible: boolean }>()
  const emit = defineEmits<{
    'update:visible': [boolean]
    success: []
  }>()

  const router = useRouter()

  const visibleInner = computed({
    get: () => props.visible,
    set: (v) => emit('update:visible', v)
  })

  type Phase = 'choose' | 'import'
  const phase = ref<Phase>('choose')
  type Pick = null | 'import' | 'self'
  const picked = ref<Pick>(null)

  const kubeInputMode = ref<'file' | 'paste'>('file')
  const uploadRef = ref<UploadInstance>()

  const importFormRef = ref<FormInstance>()
  const importForm = reactive({
    aliasName: '',
    kubeRaw: '',
    protected: true,
    description: ''
  })

  const importRules: FormRules = {
    aliasName: [
      { required: true, message: '请输入集群名称', trigger: 'blur' },
      { min: 2, max: 64, message: '长度 2～64 个字符', trigger: 'blur' }
    ],
    kubeRaw: [
      {
        validator: (_r, _v, cb) => {
          if (!importForm.kubeRaw.trim()) cb(new Error('请上传文件或粘贴 KubeConfig'))
          else cb()
        },
        trigger: 'blur'
      }
    ]
  }

  watch(kubeInputMode, (_v, prev) => {
    if (prev === undefined) return
    importForm.kubeRaw = ''
    nextTick(() => {
      uploadRef.value?.clearFiles()
      importFormRef.value?.clearValidate('kubeRaw')
    })
  })

  const submitLoading = ref(false)
  const pingLoading = ref(false)

  function resetState() {
    phase.value = 'choose'
    picked.value = null
    kubeInputMode.value = 'file'
    importForm.aliasName = ''
    importForm.kubeRaw = ''
    importForm.protected = true
    importForm.description = ''
    nextTick(() => uploadRef.value?.clearFiles())
  }

  function onClosed() {
    resetState()
  }

  function onNextFromChoose() {
    if (picked.value === 'self') {
      visibleInner.value = false
      router.push('/container/cluster/deploy')
      return
    }
    if (picked.value === 'import') {
      phase.value = 'import'
    }
  }

  function onKubeFile(file: UploadFile, _files: UploadFiles) {
    if (kubeInputMode.value !== 'file') return
    const raw = file.raw
    if (!raw) return
    const reader = new FileReader()
    reader.onload = () => {
      importForm.kubeRaw = typeof reader.result === 'string' ? reader.result : ''
      nextTick(() => importFormRef.value?.validateField('kubeRaw'))
    }
    reader.readAsText(raw)
  }

  function onKubeRemove() {
    importForm.kubeRaw = ''
  }

  async function onPing() {
    if (!importForm.kubeRaw.trim()) {
      ElMessage.warning(
        kubeInputMode.value === 'file'
          ? '请先选择并上传 kubeconfig 文件'
          : '请先粘贴 KubeConfig 内容'
      )
      return
    }
    pingLoading.value = true
    try {
      const b64 = encodeKubeConfigBase64(importForm.kubeRaw.trim())
      await fetchPingCluster(b64)
      ElMessage.success('Kubernetes API 连接正常')
    } catch (e: any) {
      ElMessage.error(e.message || '连接失败')
    } finally {
      pingLoading.value = false
    }
  }

  async function onImportSubmit() {
    if (!importFormRef.value) return
    await importFormRef.value.validate(async (valid) => {
      if (!valid) return
      const raw = importForm.kubeRaw.trim()
      if (!raw) {
        ElMessage.warning('请完成 KubeConfig（上传文件或粘贴内容）')
        return
      }
      submitLoading.value = true
      try {
        const b64 = encodeKubeConfigBase64(raw)
        await fetchCreateCluster({
          alias_name: importForm.aliasName.trim(),
          kube_config: b64,
          description: importForm.description.trim(),
          protected: importForm.protected,
          cluster_type: 0
        })
        ElMessage.success('集群导入成功')
        visibleInner.value = false
        emit('success')
      } catch (e: any) {
        ElMessage.error(e.message || '创建失败')
      } finally {
        submitLoading.value = false
      }
    })
  }
</script>

<style scoped>
  .type-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding-left: 10px;
    padding-right: 10px;
  }

  .type-card {
    margin: 0;
    padding: 0;
    border: 1px solid var(--el-border-color);
    border-radius: 10px;
    background: var(--el-fill-color-blank);
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      background 0.2s;
  }

  .type-card:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .type-card.is-active {
    border-color: var(--el-color-primary);
    background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-fill-color-blank));
    box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
  }

  .type-card-inner {
    padding: 20px 18px 22px;
  }

  .type-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
  }

  .type-desc {
    margin: 0 0 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.55;
  }

  .type-bullets {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 1.7;
  }

  .import-form {
    padding-top: 12px;
  }

  .import-form__first {
    margin-top: 6px;
  }

  .import-form :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  /* 标签与开关同一行对齐，不与下方说明一起垂直居中 */
  .import-form :deep(.protect-form-row.el-form-item) {
    align-items: flex-start;
  }

  .import-form :deep(.protect-form-row .el-form-item__label) {
    line-height: 32px;
    height: 32px;
    padding-top: 0;
    padding-bottom: 0;
    display: inline-flex;
    align-items: center;
  }

  .import-form :deep(.el-form-item__label) {
    font-size: 14px;
    color: var(--el-text-color-regular);
    padding-right: 12px;
  }

  .kube-config-block {
    width: 100%;
  }

  .kube-mode-group {
    --el-radio-button-checked-border-color: var(--el-color-primary);
    --el-radio-button-checked-bg-color: var(--el-bg-color-overlay);
    --el-radio-button-checked-text-color: var(--el-color-primary);
    display: flex;
    width: 200px;
    min-width: 200px;
    max-width: 200px;
    overflow: hidden;
    box-sizing: border-box;
    margin-top: 12px;
    margin-bottom: 0;
  }

  .kube-mode-group :deep(.el-radio-button) {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
  }

  .kube-mode-group :deep(.el-radio-button__inner) {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    font-size: 12px;
    padding: 0 10px;
    line-height: 10px;
    font-weight: 400;
    color: var(--el-text-color-regular);
    background: transparent;
    border: 1px solid var(--el-border-color);
    border-radius: 0 !important;
    transition: border-color 0.15s, color 0.15s, background-color 0.15s;
  }

  .kube-mode-group :deep(.el-radio-button:first-child .el-radio-button__inner),
  .kube-mode-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 !important;
  }

  .kube-mode-group :deep(.el-radio-button__inner:hover) {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  .kube-mode-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: var(--el-bg-color-overlay) !important;
    color: var(--el-color-primary) !important;
    font-weight: 500 !important;
    border-color: var(--el-color-primary) !important;
    box-shadow: none !important;
    position: relative;
    z-index: 1;
  }

  .kube-panel {
    width: 100%;
  }

  .kube-upload {
    width: 100%;
  }

  .kube-upload :deep(.el-upload) {
    width: 100%;
  }

  .kube-upload :deep(.el-upload-dragger) {
    width: 100%;
    padding: 22px 16px;
  }

  .upload-icon {
    font-size: 40px;
    color: var(--el-text-color-placeholder);
  }

  .kube-upload :deep(.el-upload__text em) {
    color: var(--el-color-primary);
    font-style: normal;
  }

  .kube-upload :deep(.el-upload__tip) {
    margin-top: 8px;
    line-height: 1.5;
  }

  .kube-textarea :deep(textarea) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .desc-form-row :deep(.el-textarea__inner) {
    min-height: 104px;
  }

  .protect-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .protect-hint {
    margin: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }

  .dialog-footer-btns {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }

  .dialog-footer-btns--choose {
    justify-content: flex-end;
  }

  .dialog-footer-btns--import {
    justify-content: space-between;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  @media (max-width: 720px) {
    .type-grid {
      grid-template-columns: 1fr;
    }

    .dialog-footer-btns--import {
      flex-direction: column;
      align-items: stretch;
    }

    .footer-right {
      margin-left: 0;
      justify-content: flex-end;
    }
  }
</style>

<style>
  /*
   * 与「新建菜单」弹窗一致：ArtForm 外层为 section.px-4（Tailwind 1rem = 16px 左右内边距）。
   * 此处对 body/footer 使用相同水平留白，避免全局 body 仅上下 padding 时与菜单表单错位。
   */
  .cluster-add-dialog--import .el-dialog__body {
    padding: 10px 16px 12px 16px !important;
  }

  .cluster-add-dialog--import .el-dialog__footer {
    padding: 12px 16px 16px 16px !important;
  }
</style>
