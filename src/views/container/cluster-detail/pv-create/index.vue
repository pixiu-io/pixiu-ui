<template>
  <div class="svc-create-page">
    <div class="svc-create-header">
      <ElButton text class="svc-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="svc-create-header-divider" />
      <ElBreadcrumb separator="/">
        <ElBreadcrumbItem :to="{ path: '/container/storage', query: { cluster, tab: 'pv' } }"
          >存储管理</ElBreadcrumbItem
        >
        <ElBreadcrumbItem>创建 PersistentVolume</ElBreadcrumbItem>
      </ElBreadcrumb>
    </div>

    <ElCard class="svc-create-card">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="160px" class="svc-form">
        <!-- ── 基础配置 ── -->
        <ElDivider content-position="left" class="svc-section-divider-top">基础配置</ElDivider>

        <ElFormItem label="名称" prop="name">
          <div class="svc-field-col">
            <ElInput v-model="form.name" placeholder="请输入 PersistentVolume 名称" style="width: 300px" />
            <div class="svc-field-tip"
              >最长 253 个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母或数字开头和结尾</div
            >
          </div>
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

        <ElFormItem label="容量" prop="storage">
          <div class="svc-field-col">
            <ElInput v-model="form.storage" placeholder="如 10Gi、500Mi" style="width: 300px" />
            <div class="svc-field-tip"
              >设置该 PersistentVolume 可提供的存储容量，单位支持 Mi、Gi、Ti</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="访问模式" prop="accessModes">
          <div class="svc-field-col">
            <ElCheckboxGroup v-model="form.accessModes">
              <ElCheckbox value="ReadWriteOnce">ReadWriteOnce</ElCheckbox>
              <ElCheckbox value="ReadOnlyMany">ReadOnlyMany</ElCheckbox>
              <ElCheckbox value="ReadWriteMany">ReadWriteMany</ElCheckbox>
              <ElCheckbox value="ReadWriteOncePod">ReadWriteOncePod</ElCheckbox>
            </ElCheckboxGroup>
            <div class="svc-field-tip"
              >ReadWriteOnce：单节点读写；ReadOnlyMany：多节点只读；ReadWriteMany：多节点读写；ReadWriteOncePod：单 Pod 独占读写（需 K8s 1.22+）</div
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
              >Filesystem：将卷挂载为目录，适用于大多数场景；Block：将卷直接作为裸块设备挂载，适用于数据库等需要直接 I/O 的场景</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="回收策略">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.reclaimPolicy" class="sc-radio-group">
              <ElRadioButton value="Retain">保留（Retain）</ElRadioButton>
              <ElRadioButton value="Delete">删除（Delete）</ElRadioButton>
              <ElRadioButton value="Recycle">回收（Recycle）</ElRadioButton>
            </ElRadioGroup>
            <div v-if="form.reclaimPolicy === 'Retain'" class="svc-field-tip"
              >PVC 释放后 PV 数据保留，需手动删除或复用</div
            >
            <div v-else-if="form.reclaimPolicy === 'Delete'" class="svc-field-tip sc-tip-danger"
              >PVC 释放后同步删除底层存储资源</div
            >
            <div v-else class="svc-field-tip sc-tip-warning"
              >PVC 释放后自动清空数据（已废弃，仅部分存储插件支持）</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="存储类（StorageClass）">
          <div class="svc-field-col">
            <ElInput v-model="form.storageClassName" placeholder="可选，与 PVC 对应的 StorageClass 名称" style="width: 300px" />
            <div class="svc-field-tip"
              >填写后 PVC 只有指定相同 StorageClass 时才可绑定该 PV；留空表示不关联 StorageClass</div
            >
          </div>
        </ElFormItem>

        <!-- ── 存储源 ── -->
        <ElDivider content-position="left">存储源</ElDivider>

        <ElFormItem label="存储源类型" prop="volumeType">
          <div class="svc-field-col">
            <ElRadioGroup v-model="form.volumeType" class="sc-radio-group">
              <ElRadioButton value="hostPath">HostPath</ElRadioButton>
              <ElRadioButton value="nfs">NFS</ElRadioButton>
              <ElRadioButton value="csi">CSI</ElRadioButton>
            </ElRadioGroup>
            <div v-if="form.volumeType === 'hostPath'" class="svc-field-tip"
              >直接使用节点上的文件系统路径，适用于单节点测试环境</div
            >
            <div v-else-if="form.volumeType === 'nfs'" class="svc-field-tip"
              >通过 NFS 协议挂载远端存储，支持多节点共享访问</div
            >
            <div v-else class="svc-field-tip"
              >通过 CSI 驱动挂载外部存储系统，推荐生产环境使用</div
            >
          </div>
        </ElFormItem>

        <!-- hostPath -->
        <template v-if="form.volumeType === 'hostPath'">
          <ElFormItem label="节点路径" prop="hostPath">
            <div class="svc-field-col">
              <ElInput v-model="form.hostPath" placeholder="如 /data/pv" style="width: 300px" />
              <div class="svc-field-tip">节点本地文件系统绝对路径，路径不存在时将自动创建</div>
            </div>
          </ElFormItem>
        </template>

        <!-- NFS -->
        <template v-if="form.volumeType === 'nfs'">
          <ElFormItem label="NFS 服务地址" prop="nfsServer">
            <div class="svc-field-col">
              <ElInput v-model="form.nfsServer" placeholder="如 192.168.1.100" style="width: 300px" />
              <div class="svc-field-tip">NFS 服务端的 IP 地址或域名</div>
            </div>
          </ElFormItem>
          <ElFormItem label="NFS 导出路径" prop="nfsPath">
            <div class="svc-field-col">
              <ElInput v-model="form.nfsPath" placeholder="如 /exports/data" style="width: 300px" />
              <div class="svc-field-tip">NFS 服务端导出（export）的绝对路径</div>
            </div>
          </ElFormItem>
          <ElFormItem label="只读挂载">
            <ElSwitch v-model="form.nfsReadOnly" />
            <span class="svc-field-tip" style="margin-left: 8px">开启后以只读方式挂载 NFS 卷</span>
          </ElFormItem>
        </template>

        <!-- CSI -->
        <template v-if="form.volumeType === 'csi'">
          <ElFormItem label="CSI 驱动名称" prop="csiDriver">
            <div class="svc-field-col">
              <ElInput v-model="form.csiDriver" placeholder="如 disk.csi.aliyun.com" style="width: 300px" />
              <div class="svc-field-tip">与 StorageClass provisioner 字段对应的 CSI 驱动名称</div>
            </div>
          </ElFormItem>
          <ElFormItem label="Volume Handle" prop="csiVolumeHandle">
            <div class="svc-field-col">
              <ElInput v-model="form.csiVolumeHandle" placeholder="存储系统中的卷唯一标识" style="width: 300px" />
              <div class="svc-field-tip">CSI 驱动中标识底层存储卷的唯一 ID，由存储系统分配</div>
            </div>
          </ElFormItem>
          <ElFormItem label="只读挂载">
            <ElSwitch v-model="form.csiReadOnly" />
            <span class="svc-field-tip" style="margin-left: 8px">开启后 CSI 驱动以只读方式挂载卷</span>
          </ElFormItem>
        </template>
      </ElForm>

      <div class="svc-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建 PersistentVolume</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sPV } from '@/api/kubernetes/pv'

  defineOptions({ name: 'PVCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))

  const submitting = ref(false)
  const formRef = ref<FormInstance>()

  const form = ref({
    name: '',
    labels: [] as Array<{ key: string; value: string }>,
    annotations: [] as Array<{ key: string; value: string }>,
    storage: '',
    accessModes: ['ReadWriteOnce'] as string[],
    volumeMode: 'Filesystem' as 'Filesystem' | 'Block',
    reclaimPolicy: 'Retain' as 'Retain' | 'Delete' | 'Recycle',
    storageClassName: '',
    volumeType: 'hostPath' as 'hostPath' | 'nfs' | 'csi',
    hostPath: '',
    nfsServer: '',
    nfsPath: '',
    nfsReadOnly: false,
    csiDriver: '',
    csiVolumeHandle: '',
    csiReadOnly: false
  })

  const rules = computed<FormRules>(() => ({
    name: [
      { required: true, message: '请输入 PersistentVolume 名称', trigger: 'blur' },
      { min: 1, max: 253, message: '长度 1-253', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    storage: [
      { required: true, message: '请输入存储容量，如 10Gi', trigger: 'blur' },
      {
        pattern: /^\d+(\.\d+)?(Ki|Mi|Gi|Ti|Pi|Ei|m|k|M|G|T|P|E)?$/,
        message: '格式如 10Gi、500Mi、1Ti',
        trigger: 'blur'
      }
    ],
    accessModes: [{ required: true, type: 'array', min: 1, message: '请至少选择一种访问模式', trigger: 'change' }],
    volumeType: [{ required: true, message: '请选择存储源类型', trigger: 'change' }],
    hostPath: [
      {
        required: form.value.volumeType === 'hostPath',
        message: '请输入节点路径',
        trigger: 'blur'
      }
    ],
    nfsServer: [
      {
        required: form.value.volumeType === 'nfs',
        message: '请输入 NFS 服务地址',
        trigger: 'blur'
      }
    ],
    nfsPath: [
      {
        required: form.value.volumeType === 'nfs',
        message: '请输入 NFS 导出路径',
        trigger: 'blur'
      }
    ],
    csiDriver: [
      {
        required: form.value.volumeType === 'csi',
        message: '请输入 CSI 驱动名称',
        trigger: 'blur'
      }
    ],
    csiVolumeHandle: [
      {
        required: form.value.volumeType === 'csi',
        message: '请输入 Volume Handle',
        trigger: 'blur'
      }
    ]
  }))

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
      capacity: { storage: f.storage.trim() },
      accessModes: f.accessModes,
      volumeMode: f.volumeMode,
      persistentVolumeReclaimPolicy: f.reclaimPolicy
    }

    if (f.storageClassName.trim()) spec.storageClassName = f.storageClassName.trim()

    if (f.volumeType === 'hostPath') {
      spec.hostPath = { path: f.hostPath.trim() }
    } else if (f.volumeType === 'nfs') {
      spec.nfs = {
        server: f.nfsServer.trim(),
        path: f.nfsPath.trim(),
        readOnly: f.nfsReadOnly
      }
    } else if (f.volumeType === 'csi') {
      spec.csi = {
        driver: f.csiDriver.trim(),
        volumeHandle: f.csiVolumeHandle.trim(),
        readOnly: f.csiReadOnly
      }
    }

    return {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: {
        name: f.name.trim(),
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
      await createK8sPV(cluster.value, manifest)
      ElMessage.success(`PersistentVolume（${form.value.name}）创建成功`)
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/storage', query: { cluster: cluster.value, tab: 'pv' } })
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

  .sc-tip-danger {
    color: var(--el-color-danger);
  }

  .sc-tip-warning {
    color: var(--el-color-warning);
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

  /* ── Radio 按钮组 ── */
  .sc-radio-group {
    display: inline-flex;
  }

  .sc-radio-group :deep(.el-radio-button) {
    display: flex;
  }

  .sc-radio-group :deep(.el-radio-button__inner) {
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    box-sizing: border-box;
    font-size: 13px;
    padding: 0 14px;
    height: 32px;
    line-height: 30px;
    font-weight: 400;
    color: var(--el-text-color-regular);
    background: transparent;
    border: 1px solid var(--el-border-color);
    border-left: 1px solid var(--el-border-color);
    border-radius: 0 !important;
    box-shadow: none !important;
    transition: border-color 0.15s, color 0.15s;
  }

  .sc-radio-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
    border-radius: 4px 0 0 4px !important;
  }

  .sc-radio-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 4px 4px 0 !important;
  }

  .sc-radio-group :deep(.el-radio-button__inner:hover) {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  .sc-radio-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: var(--el-bg-color) !important;
    color: var(--el-color-primary) !important;
    font-weight: 500 !important;
    border-color: var(--el-color-primary) !important;
    box-shadow: none !important;
    position: relative;
    z-index: 1;
  }
</style>
