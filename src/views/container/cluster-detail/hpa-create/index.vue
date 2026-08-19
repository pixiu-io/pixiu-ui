<template>
  <div class="svc-create-page">
    <div class="svc-create-header">
      <ElButton text class="svc-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="svc-create-header-divider" />
      <ClusterResourceBreadcrumb
        parent-path="/container/autoscaling"
        parent-label="弹性伸缩"
        :current-label="isEdit ? '编辑HPA' : '创建HPA'"
      />
    </div>

    <ElCard v-loading="detailLoading" class="svc-create-card">
      <ElForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="140px"
        label-position="left"
        class="svc-form"
      >
        <!-- ── 基础配置 ── -->
        <ElDivider content-position="left" class="svc-section-divider-top">基础配置</ElDivider>

        <ElFormItem label="名称" prop="name">
          <div class="svc-field-col">
            <ElInput
              v-model="form.name"
              :disabled="isEdit"
              placeholder="请输入 HPA 名称"
              style="width: 300px"
            />
            <div class="svc-field-tip"
              >最长 63
              个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="命名空间" prop="namespace">
          <ElSelect
            v-model="form.namespace"
            :disabled="isEdit"
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
              <ElButton
                link
                type="primary"
                class="kv-add-btn"
                @click="form.labels.push({ key: '', value: '' })"
                >新增</ElButton
              >
            </div>
          </div>
        </ElFormItem>

        <!-- ── 目标工作负载 ── -->
        <ElDivider content-position="left">目标工作负载</ElDivider>

        <ElFormItem label="工作负载类型" prop="targetKind">
          <ElSelect v-model="form.targetKind" :disabled="isEdit" style="width: 300px">
            <ElOption label="Deployment" value="Deployment" />
            <ElOption label="StatefulSet" value="StatefulSet" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="工作负载名称" prop="targetName">
          <div class="svc-field-col">
            <ElSelect
              v-model="form.targetName"
              filterable
              :disabled="isEdit"
              :loading="targetLoading"
              placeholder="请选择工作负载"
              style="width: 300px"
            >
              <ElOption v-for="item in targetNames" :key="item" :label="item" :value="item" />
            </ElSelect>
            <div v-if="!targetNames.length && !targetLoading" class="svc-field-tip"
              >该命名空间下暂无可用的 {{ form.targetKind }} 资源</div
            >
          </div>
        </ElFormItem>

        <!-- ── 扩缩容配置 ── -->
        <ElDivider content-position="left">扩缩容配置</ElDivider>

        <ElFormItem label="最小副本数" prop="minReplicas">
          <ElInputNumber v-model="form.minReplicas" :min="1" :max="1000" style="width: 160px" />
        </ElFormItem>

        <ElFormItem label="最大副本数" prop="maxReplicas">
          <div class="svc-field-col">
            <ElInputNumber v-model="form.maxReplicas" :min="1" :max="1000" style="width: 160px" />
            <div class="svc-field-tip">自动扩缩容的副本数上限，需不小于最小副本数</div>
          </div>
        </ElFormItem>

        <!-- ── 触发策略 ── -->
        <ElDivider content-position="left">触发策略</ElDivider>

        <ElFormItem label="CPU 目标使用率" prop="cpuUtilization">
          <div class="svc-field-col">
            <div class="metric-enable-row">
              <ElCheckbox v-model="form.cpuEnabled">启用</ElCheckbox>
              <ElInputNumber
                v-model="form.cpuUtilization"
                :min="1"
                :max="100"
                :disabled="!form.cpuEnabled"
                style="width: 160px"
              />
            </div>
            <div class="svc-field-tip"
              >Pod 平均 CPU 使用率（使用量/requests）超过该阈值时扩容，低于时缩容；需集群已部署
              metrics-server（容器配置了 CPU Requests）</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="内存目标使用率">
          <div class="svc-field-col">
            <div class="metric-enable-row">
              <ElCheckbox v-model="form.memoryEnabled">启用</ElCheckbox>
              <ElInputNumber
                v-model="form.memoryUtilization"
                :min="1"
                :max="100"
                :disabled="!form.memoryEnabled"
                style="width: 160px"
              />
            </div>
            <div class="svc-field-tip"
              >Pod 平均 MEM 使用率（使用量/requests）超过该阈值时扩容，低于时缩容；需集群已部署
              metrics-server（容器配置了 MEMORY Requests）</div
            >
          </div>
        </ElFormItem>
      </ElForm>

      <div class="svc-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">{{
          isEdit ? '保存' : '创建'
        }}</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    createK8sHpa,
    fetchK8sHpa,
    updateK8sHpa,
    HPA_INITIAL_REPLICAS_ANNOTATION
  } from '@/api/kubernetes/hpa'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { fetchK8sDeployment, fetchK8sDeploymentList } from '@/api/kubernetes/deployment'
  import { fetchK8sStatefulSet, fetchK8sStatefulSetList } from '@/api/kubernetes/statefulset'
  import ClusterResourceBreadcrumb from '../components/cluster-resource-breadcrumb.vue'
  import { buildClusterRouteQuery } from '@/utils/navigation/cluster-query'
  import { notifyError } from '@/utils/sys/notify'

  defineOptions({ name: 'HpaCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))
  const editHpaName = computed(() => String(route.query.name ?? ''))
  const isEdit = computed(() => !!editHpaName.value)

  const namespaces = ref<string[]>([])
  const targetNames = ref<string[]>([])
  const targetLoading = ref(false)
  const submitting = ref(false)
  const detailLoading = ref(false)
  const formRef = ref<FormInstance>()

  const form = ref({
    name: '',
    namespace: '',
    labels: [] as Array<{ key: string; value: string }>,
    targetKind: 'Deployment' as 'Deployment' | 'StatefulSet',
    targetName: '',
    minReplicas: 1,
    maxReplicas: 10,
    cpuEnabled: false,
    cpuUtilization: 80,
    memoryEnabled: false,
    memoryUtilization: 80
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入 HPA 名称', trigger: 'blur' },
      { min: 1, max: 63, message: '长度 1-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }],
    targetName: [{ required: true, message: '请选择工作负载', trigger: 'change' }],
    maxReplicas: [
      {
        validator: (_rule, value: number, callback) => {
          if (value == null) return callback(new Error('请输入最大副本数'))
          if (value < form.value.minReplicas)
            return callback(new Error('最大副本数需不小于最小副本数'))
          callback()
        },
        trigger: 'blur'
      }
    ]
  }

  watch([() => form.value.namespace, () => form.value.targetKind], () => {
    // 编辑态回填期间不清空目标工作负载
    if (detailLoading.value) return
    form.value.targetName = ''
    void loadTargetNames()
  })

  // 最小副本数上调时自动修正最大副本数，避免校验冲突
  watch(
    () => form.value.minReplicas,
    (min) => {
      if (form.value.maxReplicas < min) form.value.maxReplicas = min
    }
  )

  async function loadTargetNames() {
    if (!cluster.value || !form.value.namespace) {
      targetNames.value = []
      return
    }
    targetLoading.value = true
    try {
      const params = { page: 1, limit: 999999, namespace: form.value.namespace }
      const { items } =
        form.value.targetKind === 'Deployment'
          ? await fetchK8sDeploymentList(cluster.value, params)
          : await fetchK8sStatefulSetList(cluster.value, params)
      targetNames.value = items
        .map((i) => i.metadata?.name ?? '')
        .filter(Boolean)
        .sort()
    } catch {
      targetNames.value = []
    } finally {
      targetLoading.value = false
    }
  }

  function kvToObj(list: Array<{ key: string; value: string }>): Record<string, string> {
    return list.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = key.trim()
      if (k) acc[k] = value.trim()
      return acc
    }, {})
  }

  // 编辑态回填时保留的原 HPA 指标（表单仅覆盖 CPU/内存使用率两类）
  let originalMetrics: unknown[] = []

  function buildManifest(initialReplicas?: number) {
    const f = form.value
    const labels = kvToObj(f.labels)
    const metrics: Record<string, unknown>[] = []
    if (f.cpuEnabled) {
      metrics.push({
        type: 'Resource',
        resource: {
          name: 'cpu',
          target: { type: 'Utilization', averageUtilization: f.cpuUtilization }
        }
      })
    }
    if (f.memoryEnabled) {
      metrics.push({
        type: 'Resource',
        resource: {
          name: 'memory',
          target: { type: 'Utilization', averageUtilization: f.memoryUtilization }
        }
      })
    }
    return {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: f.name.trim(),
        namespace: f.namespace,
        ...(Object.keys(labels).length ? { labels } : {}),
        // 创建时记录初始副本数，供执行历史推算最早一条伸缩事件的变更前副本数
        ...(initialReplicas != null
          ? { annotations: { [HPA_INITIAL_REPLICAS_ANNOTATION]: String(initialReplicas) } }
          : {})
      },
      spec: {
        scaleTargetRef: { apiVersion: 'apps/v1', kind: f.targetKind, name: f.targetName },
        minReplicas: f.minReplicas,
        maxReplicas: f.maxReplicas,
        // 编辑态未启用表单指标时保留原 HPA 的指标配置，避免误删
        metrics: metrics.length ? metrics : originalMetrics
      }
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
    if (!form.value.cpuEnabled && !form.value.memoryEnabled) {
      ElMessage.warning('请至少启用一个扩缩容指标（CPU 或内存）')
      return
    }
    submitting.value = true
    try {
      if (isEdit.value) {
        const manifest = buildManifest()
        // 更新需携带 resourceVersion；保留 annotations（含暂停锁定标记）与 status
        const current = await fetchK8sHpa(cluster.value, form.value.namespace, editHpaName.value)
        await updateK8sHpa(cluster.value, form.value.namespace, editHpaName.value, {
          ...current,
          ...manifest,
          metadata: { ...current.metadata, ...manifest.metadata },
          spec: { ...current.spec, ...manifest.spec }
        })
        ElMessage.success(`HPA（${form.value.name}）保存成功`)
      } else {
        const manifest = buildManifest(await fetchTargetCurrentReplicas())
        await createK8sHpa(cluster.value, form.value.namespace, manifest)
        ElMessage.success(`HPA（${form.value.name}）创建成功`)
      }
      goBack()
    } catch (e: unknown) {
      notifyError(e, isEdit.value ? '保存失败' : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  /** 创建时取目标工作负载当前副本数（best-effort），用于记录初始副本数 annotation */
  async function fetchTargetCurrentReplicas(): Promise<number | undefined> {
    try {
      const f = form.value
      const detail =
        f.targetKind === 'Deployment'
          ? await fetchK8sDeployment(cluster.value, f.namespace, f.targetName)
          : await fetchK8sStatefulSet(cluster.value, f.namespace, f.targetName)
      return detail.spec?.replicas
    } catch {
      return undefined
    }
  }

  function goBack() {
    router.push({ path: '/container/autoscaling', query: buildClusterRouteQuery(route) })
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

  /** 编辑模式：加载 HPA 详情回填表单 */
  async function loadDetail() {
    detailLoading.value = true
    try {
      const detail = await fetchK8sHpa(cluster.value, defaultNamespace.value, editHpaName.value)
      form.value.name = detail.metadata?.name ?? editHpaName.value
      form.value.namespace = detail.metadata?.namespace ?? defaultNamespace.value
      form.value.labels = Object.entries(detail.metadata?.labels ?? {}).map(([key, value]) => ({
        key,
        value
      }))
      const ref = detail.spec?.scaleTargetRef
      if (ref?.kind === 'Deployment' || ref?.kind === 'StatefulSet') {
        form.value.targetKind = ref.kind
      }
      form.value.targetName = ref?.name ?? ''
      form.value.minReplicas = detail.spec?.minReplicas ?? 1
      form.value.maxReplicas = detail.spec?.maxReplicas ?? form.value.minReplicas
      // 表单仅支持 CPU/内存使用率两类指标；其余指标原样保留（见 buildManifest）
      originalMetrics = []
      for (const m of detail.spec?.metrics ?? []) {
        const name = m.resource?.name
        const util = m.resource?.target?.averageUtilization
        if (m.type === 'Resource' && name === 'cpu' && util != null) {
          form.value.cpuEnabled = true
          form.value.cpuUtilization = util
        } else if (m.type === 'Resource' && name === 'memory' && util != null) {
          form.value.memoryEnabled = true
          form.value.memoryUtilization = util
        } else {
          originalMetrics.push(m)
        }
      }
      await loadTargetNames()
      form.value.targetName = ref?.name ?? ''
    } catch (e: unknown) {
      notifyError(e, '加载 HPA 详情失败')
    } finally {
      detailLoading.value = false
    }
  }

  onMounted(() => {
    void loadNamespaces()
    if (isEdit.value) {
      // 编辑态：标签页标题随状态切换
      document.title = document.title.replace('创建 HPA', '编辑 HPA')
      void loadDetail()
    }
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
  .svc-form :deep(.el-checkbox__label) {
    font-size: 12px;
  }

  .svc-section-divider-top {
    margin-top: 5px;
  }

  /* 分区标题与左对齐标签共用同一条左竖线 */
  .svc-form :deep(.el-divider__text.is-left) {
    left: 0;
    padding: 0 12px 0 0;
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

  /* ── KV list ── */
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

  /* ── 指标启用行 ── */
  .metric-enable-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* ── Footer ── */
  .svc-create-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }
</style>
