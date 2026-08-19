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
        :current-label="isEdit ? '编辑定时HPA' : '创建定时HPA'"
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
              placeholder="请输入定时 HPA 名称"
              style="width: 300px"
            />
            <div class="svc-field-tip"
              >最长 63
              个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾；同一命名空间内名称唯一</div
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

        <ElFormItem label="描述">
          <ElInput
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="256"
            show-word-limit
            placeholder="可选，描述该定时扩缩容规则的用途"
            style="width: 480px"
          />
        </ElFormItem>

        <!-- ── 目标工作负载 ── -->
        <ElDivider content-position="left">目标工作负载</ElDivider>

        <ElFormItem label="工作负载类型" prop="targetKind">
          <ElSelect v-model="form.targetKind" style="width: 300px">
            <ElOption label="Deployment" value="Deployment" />
            <ElOption label="StatefulSet" value="StatefulSet" />
            <ElOption label="HPA（兼容模式，定时调整 min/max）" value="HorizontalPodAutoscaler" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="工作负载名称" prop="targetName">
          <div class="svc-field-col">
            <ElSelect
              v-model="form.targetName"
              filterable
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

        <!-- ── 定时策略 ── -->
        <ElDivider content-position="left">定时策略</ElDivider>

        <ElFormItem label="定时任务">
          <div class="svc-field-col">
            <div class="job-list">
              <div v-for="(job, idx) in form.jobs" :key="`job-${idx}`" class="job-row">
                <ElInput v-model="job.name" class="job-name" placeholder="任务名称" />
                <ElInput v-model="job.schedule" class="job-schedule" placeholder="cron 表达式" />
                <ElInputNumber v-model="job.targetSize" :min="0" :max="1000" style="width: 140px" />
                <ElCheckbox v-model="job.runOnce">仅一次</ElCheckbox>
                <ElButton
                  link
                  class="kv-del-btn"
                  :disabled="form.jobs.length <= 1"
                  @click="form.jobs.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
              <ElButton
                link
                type="primary"
                class="kv-add-btn"
                :disabled="form.jobs.length >= 20"
                @click="addJob"
                >新增任务</ElButton
              >
            </div>
            <div class="svc-field-tip"
              >cron 为标准 5 段表达式（分 时 日 月 周），如「0 9 * * *」表示每天
              09:00；副本数为目标副本数；「仅一次」表示触发一次后不再重复；最多 20
              个任务，任务名称不能重复</div
            >
          </div>
        </ElFormItem>

        <ElFormItem label="排除日期">
          <div class="svc-field-col">
            <div class="kv-list">
              <div v-for="(item, idx) in form.excludeDates" :key="`ex-${idx}`" class="kv-row">
                <ElInput
                  v-model="form.excludeDates[idx]"
                  placeholder="cron 表达式，如 0 0 1 1 *（每年 1 月 1 日）"
                  style="width: 320px"
                />
                <ElButton link class="kv-del-btn" @click="form.excludeDates.splice(idx, 1)"
                  ><ElIcon><Close /></ElIcon
                ></ElButton>
              </div>
              <ElButton link type="primary" class="kv-add-btn" @click="form.excludeDates.push('')"
                >新增排除日期</ElButton
              >
            </div>
            <div class="svc-field-tip"
              >命中排除日期的时间点将跳过执行（同样为 5 段 cron 表达式）</div
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
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { fetchK8sDeploymentList } from '@/api/kubernetes/deployment'
  import { fetchK8sStatefulSetList } from '@/api/kubernetes/statefulset'
  import { fetchK8sHpaList } from '@/api/kubernetes/hpa'
  import {
    createCronHpa,
    updateCronHpa,
    fetchCronHpa,
    type CronHpaRequest
  } from '@/api/kubernetes/cronHpa'
  import ClusterResourceBreadcrumb from '../components/cluster-resource-breadcrumb.vue'
  import { notifyError } from '@/utils/sys/notify'

  defineOptions({ name: 'CronHpaCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const editId = computed(() => Number(route.query.id ?? 0) || 0)
  const isEdit = computed(() => editId.value > 0)

  const namespaces = ref<string[]>([])
  const targetNames = ref<string[]>([])
  const targetLoading = ref(false)
  const submitting = ref(false)
  const detailLoading = ref(false)
  const formRef = ref<FormInstance>()

  interface JobFormItem {
    name: string
    schedule: string
    targetSize: number
    runOnce: boolean
  }

  function defaultJobs(): JobFormItem[] {
    return [
      { name: 'scale-up', schedule: '0 9 * * *', targetSize: 5, runOnce: false },
      { name: 'scale-down', schedule: '0 21 * * *', targetSize: 1, runOnce: false }
    ]
  }

  const form = ref({
    name: '',
    namespace: '',
    description: '',
    targetKind: 'Deployment' as 'Deployment' | 'StatefulSet' | 'HorizontalPodAutoscaler',
    targetName: '',
    jobs: defaultJobs(),
    excludeDates: [] as string[]
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入定时 HPA 名称', trigger: 'blur' },
      { min: 1, max: 63, message: '长度 1-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }],
    targetName: [{ required: true, message: '请选择工作负载', trigger: 'change' }]
  }

  watch([() => form.value.namespace, () => form.value.targetKind], () => {
    form.value.targetName = ''
    void loadTargetNames()
  })

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
          : form.value.targetKind === 'StatefulSet'
            ? await fetchK8sStatefulSetList(cluster.value, params)
            : await fetchK8sHpaList(cluster.value, params)
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

  function addJob() {
    if (form.value.jobs.length >= 20) {
      ElMessage.warning('最多支持 20 个定时任务')
      return
    }
    form.value.jobs.push({ name: '', schedule: '0 0 * * *', targetSize: 1, runOnce: false })
  }

  /** 定时任务校验：与后端 validateCronHpaRequest 规则保持一致 */
  function validateJobs(): string | null {
    const jobs = form.value.jobs
    if (!jobs.length) return '至少需要配置一个定时任务'
    if (jobs.length > 20) return '定时任务数量不能超过 20 个'
    const seen = new Set<string>()
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      const no = i + 1
      if (!job.name.trim()) return `第 ${no} 个任务缺少名称`
      if (seen.has(job.name.trim())) return `任务名称「${job.name.trim()}」重复`
      seen.add(job.name.trim())
      const schedule = job.schedule.trim()
      if (!schedule) return `第 ${no} 个任务缺少 cron 表达式`
      if (schedule.split(/\s+/).length !== 5)
        return `第 ${no} 个任务的 cron 表达式需为 5 段（分 时 日 月 周）`
      if (job.targetSize == null || job.targetSize < 0 || job.targetSize > 1000)
        return `第 ${no} 个任务的目标副本数需在 0-1000 之间`
    }
    for (let i = 0; i < form.value.excludeDates.length; i++) {
      const ex = form.value.excludeDates[i].trim()
      if (!ex) return `第 ${i + 1} 个排除日期为空，请删除或填写`
      if (ex.split(/\s+/).length !== 5) return `第 ${i + 1} 个排除日期需为 5 段 cron 表达式`
    }
    return null
  }

  function buildRequest(): CronHpaRequest {
    const f = form.value
    return {
      name: f.name.trim(),
      cluster_name: cluster.value,
      namespace: f.namespace,
      target_kind: f.targetKind,
      target_name: f.targetName,
      jobs: f.jobs.map((j) => ({
        name: j.name.trim(),
        schedule: j.schedule.trim(),
        target_size: j.targetSize,
        run_once: j.runOnce
      })),
      exclude_dates: f.excludeDates.map((s) => s.trim()).filter(Boolean),
      description: f.description.trim()
    }
  }

  async function submit() {
    if (!formRef.value) return
    await formRef.value.validate().catch(() => {
      throw new Error('form-invalid')
    })
    const jobErr = validateJobs()
    if (jobErr) {
      ElMessage.error(jobErr)
      return
    }
    submitting.value = true
    try {
      const req = buildRequest()
      if (isEdit.value) {
        await updateCronHpa(editId.value, req)
        ElMessage.success('保存成功')
      } else {
        await createCronHpa(req)
        ElMessage.success(`定时HPA（${form.value.name}）创建成功`)
      }
      goBack()
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'form-invalid') return
      notifyError(e, isEdit.value ? '保存失败' : '创建失败')
    } finally {
      submitting.value = false
    }
  }

  /** 编辑模式：加载规则详情回填表单 */
  async function loadDetail() {
    detailLoading.value = true
    try {
      const detail = await fetchCronHpa(editId.value)
      form.value.name = detail.name
      form.value.namespace = detail.namespace
      form.value.description = detail.description ?? ''
      form.value.targetKind = detail.target_kind as typeof form.value.targetKind
      form.value.jobs = (detail.jobs ?? []).map((j) => ({
        name: j.name,
        schedule: j.schedule,
        targetSize: j.target_size,
        runOnce: !!j.run_once
      }))
      form.value.excludeDates = [...(detail.exclude_dates ?? [])]
      await loadTargetNames()
      form.value.targetName = detail.target_name
    } catch (e: unknown) {
      notifyError(e, '加载规则详情失败')
    } finally {
      detailLoading.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/autoscaling', query: route.query })
  }

  onMounted(async () => {
    if (cluster.value) {
      try {
        const { items } = await fetchK8sNamespaceList(cluster.value, { page: 1, limit: 500 })
        namespaces.value = items.map((n) => n.metadata?.name ?? '')
      } catch {
        namespaces.value = []
      }
    }
    if (isEdit.value) {
      // 编辑态：标签页标题随状态切换，且清空模板默认任务避免回填前闪现
      document.title = document.title.replace('创建定时HPA', '编辑定时HPA')
      form.value.jobs = []
      await loadDetail()
    }
  })
</script>

<style scoped>
  .svc-create-page {
    /* 自然文档流：整页滚动，底部按钮紧跟表单内容（与创建HPA 页一致） */
  }

  .svc-create-header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 8px 0;
    gap: 4px;
  }

  .svc-create-back-btn {
    padding: 4px 8px;
    color: var(--el-text-color-regular);
  }

  .svc-create-back-btn:hover {
    color: var(--el-color-primary);
  }

  .svc-create-header-divider {
    height: 16px;
    margin: 0 8px;
  }

  .svc-create-card :deep(.el-card__body) {
    padding: 16px 20px;
  }

  .svc-form {
    padding-right: 4px;
  }

  .svc-section-divider-top {
    margin-top: 0;
  }

  .svc-field-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .svc-field-tip {
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .kv-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .kv-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kv-del-btn {
    flex-shrink: 0;
    padding: 0 4px;
    color: var(--el-text-color-secondary);
  }

  .kv-del-btn:hover {
    color: var(--el-color-danger);
  }

  .kv-add-btn {
    align-self: flex-start;
    padding: 0;
  }

  .job-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .job-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .job-name {
    width: 160px;
  }

  .job-schedule {
    width: 200px;
  }

  .svc-create-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }
</style>
