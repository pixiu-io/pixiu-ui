<!-- 告警静默：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="50%"
    destroy-on-close
    :show-close="false"
    class="alert-silence-drawer"
  >
    <template #header>
      <div class="alert-drawer-header">
        <span class="alert-drawer-title">{{ isEdit ? '编辑告警静默' : '添加告警静默' }}</span>
        <ElButton text circle class="alert-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading || rulesLoading" class="alert-drawer-body">
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px" class="alert-form">
        <ElFormItem label="名称" prop="name">
          <ElInput
            v-model="formData.name"
            placeholder="默认同关联告警名称"
            @input="nameTouched = true"
          />
        </ElFormItem>

        <ElFormItem label="关联告警" prop="ruleId">
          <ElSelect
            v-model="formData.ruleId"
            filterable
            clearable
            class="w-full"
            placeholder="请选择关联告警"
            @change="onRuleChange"
          >
            <ElOption
              v-for="item in ruleOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="静默规则配置" prop="durationKey" required class="silence-config-item">
          <div class="silence-config-panel">
            <div class="silence-config-body">
              <div class="silence-config-row">
                <span class="silence-config-row__label">静默时间</span>
                <div class="silence-duration">
                  <div class="silence-duration-line">
                    <div class="silence-duration-segment">
                      <button
                        v-for="item in durationPresets"
                        :key="item.key"
                        type="button"
                        class="silence-duration-segment__item"
                        :class="{ 'is-active': formData.durationKey === item.key }"
                        @click="selectDuration(item.key)"
                      >
                        {{ item.label }}
                      </button>
                    </div>
                    <div v-if="formData.durationKey === 'custom'" class="silence-duration__custom">
                      <ElFormItem prop="startsAt" label-width="0" class="silence-duration__picker">
                        <ElDatePicker
                          v-model="formData.startsAt"
                          type="datetime"
                          value-format="YYYY-MM-DDTHH:mm:ssZ"
                          class="w-full"
                          placeholder="开始时间"
                        />
                      </ElFormItem>
                      <ElFormItem prop="endsAt" label-width="0" class="silence-duration__picker">
                        <ElDatePicker
                          v-model="formData.endsAt"
                          type="datetime"
                          value-format="YYYY-MM-DDTHH:mm:ssZ"
                          class="w-full"
                          placeholder="结束时间"
                        />
                      </ElFormItem>
                    </div>
                  </div>
                </div>
              </div>

              <div class="silence-config-row silence-config-row--labels">
                <div class="silence-config-row__label silence-config-row__label--with-tip">
                  <span>静默标签集</span>
                  <ElTooltip
                    content="按标签精确匹配告警样本；与所选关联告警一并生效。留空表示仅按规则静默。"
                    placement="top"
                  >
                    <ElIcon class="silence-config-tip"><QuestionFilled /></ElIcon>
                  </ElTooltip>
                </div>
                <div class="silence-label-field">
                  <div class="kv-list">
                    <div
                      v-for="(item, index) in labelMatchers"
                      :key="item.keyId"
                      class="kv-row"
                    >
                      <ElInput v-model="item.labelKey" placeholder="键" />
                      <ElInput v-model="item.labelValue" placeholder="值" />
                      <ElButton link class="kv-del-btn" @click="removeLabelMatcher(index)">
                        <ElIcon><Delete /></ElIcon>
                      </ElButton>
                    </div>
                    <ElButton link type="primary" class="kv-add-btn" @click="addLabelMatcher">
                      新增
                    </ElButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ElFormItem>

        <ElFormItem label="屏蔽说明">
          <ElInput v-model="formData.comment" type="textarea" :rows="4" placeholder="可选" />
        </ElFormItem>

        <ElFormItem label="启用">
          <ElSwitch v-model="formData.enabled" />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="alert-drawer-footer">
        <ElButton @click="closeDrawer">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close, Delete, QuestionFilled } from '@element-plus/icons-vue'
  import { computed, ref, watch } from 'vue'
  import { ElIcon, ElMessage, ElTooltip, type FormInstance, type FormRules } from 'element-plus'
  import {
    fetchCreateAlertSilence,
    fetchGetAlertRuleList,
    fetchGetAlertSilence,
    fetchUpdateAlertSilence,
    type AlertRuleItem
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'

  defineOptions({ name: 'AlertSilenceDrawer' })

  const props = defineProps<{ editId?: number; presetRuleId?: number }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ success: [] }>()

  type DurationKey = '1h' | '3h' | '6h' | '12h' | '1d' | '2d' | '3d' | '1w' | 'forever' | 'custom'

  interface LabelMatcher {
    keyId: number
    labelKey: string
    labelValue: string
  }

  const durationPresets: Array<{ key: DurationKey; label: string; ms?: number }> = [
    { key: '1h', label: '1小时', ms: 1 * 60 * 60 * 1000 },
    { key: '3h', label: '3小时', ms: 3 * 60 * 60 * 1000 },
    { key: '6h', label: '6小时', ms: 6 * 60 * 60 * 1000 },
    { key: '12h', label: '12小时', ms: 12 * 60 * 60 * 1000 },
    { key: '1d', label: '1天', ms: 24 * 60 * 60 * 1000 },
    { key: '3d', label: '3天', ms: 3 * 24 * 60 * 60 * 1000 },
    { key: '1w', label: '1周', ms: 7 * 24 * 60 * 60 * 1000 },
    { key: 'forever', label: '永久' },
    { key: 'custom', label: '自定义' }
  ]

  let labelMatcherSeq = 0

  function createLabelMatcher(partial?: Partial<LabelMatcher>): LabelMatcher {
    return {
      keyId: ++labelMatcherSeq,
      labelKey: partial?.labelKey ?? '',
      labelValue: partial?.labelValue ?? ''
    }
  }

  const labelMatchers = ref<LabelMatcher[]>([])

  function addLabelMatcher() {
    labelMatchers.value.push(createLabelMatcher())
  }

  function removeLabelMatcher(index: number) {
    labelMatchers.value.splice(index, 1)
  }

  const FOREVER_END = new Date('2099-12-31T23:59:59')

  const isEdit = computed(() => props.editId != null && props.editId > 0)
  const editLoading = ref(false)
  const rulesLoading = ref(false)
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const resourceVersion = ref(0)
  const ruleOptions = ref<AlertRuleItem[]>([])
  const nameTouched = ref(false)

  const formData = ref({
    ruleId: undefined as number | undefined,
    name: '',
    durationKey: '1h' as DurationKey,
    startsAt: '',
    endsAt: '',
    comment: '',
    enabled: true
  })

  const rules: FormRules = {
    ruleId: [{ required: true, message: '请选择关联告警', trigger: 'change' }],
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    durationKey: [{ required: true, message: '请选择静默时间', trigger: 'change' }],
    startsAt: [
      {
        validator: (_rule, value, callback) => {
          if (formData.value.durationKey === 'custom' && !value) {
            callback(new Error('请选择开始时间'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ],
    endsAt: [
      {
        validator: (_rule, value, callback) => {
          if (formData.value.durationKey === 'custom' && !value) {
            callback(new Error('请选择结束时间'))
            return
          }
          if (
            formData.value.durationKey === 'custom' &&
            formData.value.startsAt &&
            value &&
            new Date(value).getTime() <= new Date(formData.value.startsAt).getTime()
          ) {
            callback(new Error('结束时间须晚于开始时间'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ]
  }

  function closeDrawer() {
    visible.value = false
  }

  function pad(n: number) {
    return String(n).padStart(2, '0')
  }

  function formatDateTime(date: Date): string {
    const offset = -date.getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const abs = Math.abs(offset)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  }

  function buildMatchLabels(ruleId: number): string {
    const labels: Record<string, string> = { rule_id: String(ruleId) }
    for (const item of labelMatchers.value) {
      const key = item.labelKey.trim()
      const value = item.labelValue.trim()
      if (!key || !value || key === 'rule_id') continue
      labels[key] = value
    }
    return JSON.stringify(labels)
  }

  function parseRuleIdFromMatchLabels(raw: string): number | undefined {
    if (!raw?.trim()) return undefined
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const ruleId = Number(parsed.rule_id)
      return Number.isFinite(ruleId) && ruleId > 0 ? ruleId : undefined
    } catch {
      return undefined
    }
  }

  function parseLabelMatchersFromMatchLabels(raw: string): LabelMatcher[] {
    if (!raw?.trim()) return []
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return Object.entries(parsed)
        .filter(([key]) => key !== 'rule_id')
        .map(([labelKey, labelValue]) =>
          createLabelMatcher({
            labelKey,
            labelValue: labelValue == null ? '' : String(labelValue)
          })
        )
    } catch {
      return []
    }
  }

  function resolveDurationRange(key: DurationKey, startsAt?: string, endsAt?: string) {
    if (key === 'custom') {
      return { startsAt: startsAt || '', endsAt: endsAt || '' }
    }
    const now = new Date()
    if (key === 'forever') {
      return { startsAt: formatDateTime(now), endsAt: formatDateTime(FOREVER_END) }
    }
    const preset = durationPresets.find((item) => item.key === key)
    const end = new Date(now.getTime() + (preset?.ms ?? 0))
    return { startsAt: formatDateTime(now), endsAt: formatDateTime(end) }
  }

  function detectDurationKey(startsAt: string, endsAt: string): DurationKey {
    const startMs = new Date(startsAt).getTime()
    const endMs = new Date(endsAt).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 'custom'
    if (endMs >= FOREVER_END.getTime() - 24 * 60 * 60 * 1000) return 'forever'

    const diff = endMs - startMs
    const matched = durationPresets.find(
      (item) => item.ms != null && Math.abs(item.ms - diff) <= 60 * 1000
    )
    return matched?.key ?? 'custom'
  }

  function selectDuration(key: DurationKey) {
    formData.value.durationKey = key
    if (key === 'custom') {
      if (!formData.value.startsAt || !formData.value.endsAt) {
        const range = resolveDurationRange('1h')
        formData.value.startsAt = range.startsAt
        formData.value.endsAt = range.endsAt
      }
      return
    }
    const range = resolveDurationRange(key)
    formData.value.startsAt = range.startsAt
    formData.value.endsAt = range.endsAt
  }

  function onRuleChange(ruleId?: number) {
    const rule = ruleOptions.value.find((item) => item.id === ruleId)
    if (!nameTouched.value || !formData.value.name) {
      formData.value.name = rule?.name || ''
    }
  }

  async function loadRules() {
    rulesLoading.value = true
    try {
      const { records } = await fetchGetAlertRuleList({ page: 1, limit: 200 })
      ruleOptions.value = records
    } catch (error) {
      ruleOptions.value = []
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '加载关联告警失败')
      }
    } finally {
      rulesLoading.value = false
    }
  }

  function resetCreateForm() {
    resourceVersion.value = 0
    nameTouched.value = false
    labelMatchers.value = []
    const range = resolveDurationRange('1h')
    const presetRuleId =
      props.presetRuleId != null && props.presetRuleId > 0 ? props.presetRuleId : undefined
    const presetRule = presetRuleId
      ? ruleOptions.value.find((item) => item.id === presetRuleId)
      : undefined
    formData.value = {
      ruleId: presetRuleId,
      name: presetRule?.name || '',
      durationKey: '1h',
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      comment: '',
      enabled: true
    }
  }

  async function loadDetail() {
    if (!isEdit.value || !props.editId) return
    editLoading.value = true
    try {
      const detail = await fetchGetAlertSilence(props.editId)
      resourceVersion.value = detail.resourceVersion
      nameTouched.value = true
      const durationKey = detectDurationKey(detail.startsAt, detail.endsAt)
      labelMatchers.value = parseLabelMatchersFromMatchLabels(detail.matchLabels)
      formData.value = {
        ruleId: parseRuleIdFromMatchLabels(detail.matchLabels),
        name: detail.name,
        durationKey,
        startsAt: detail.startsAt,
        endsAt: detail.endsAt,
        comment: detail.comment,
        enabled: detail.enabled
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载告警静默失败')
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  watch(
    () => visible.value,
    async (open) => {
      if (!open) return
      await loadRules()
      if (isEdit.value) {
        await loadDetail()
      } else {
        resetCreateForm()
      }
      formRef.value?.clearValidate()
    }
  )

  async function handleSubmit() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    const ruleId = formData.value.ruleId
    if (!ruleId) {
      ElMessage.warning('请选择关联告警')
      return
    }

    const range =
      formData.value.durationKey === 'custom'
        ? { startsAt: formData.value.startsAt, endsAt: formData.value.endsAt }
        : resolveDurationRange(formData.value.durationKey)

    if (!range.startsAt || !range.endsAt) {
      ElMessage.warning('请配置静默时间')
      return
    }
    if (new Date(range.endsAt).getTime() <= new Date(range.startsAt).getTime()) {
      ElMessage.warning('结束时间须晚于开始时间')
      return
    }

    const matchLabels = buildMatchLabels(ruleId)
    const name =
      formData.value.name.trim() || ruleOptions.value.find((item) => item.id === ruleId)?.name || ''

    submitting.value = true
    try {
      if (isEdit.value && props.editId) {
        await fetchUpdateAlertSilence(props.editId, {
          resource_version: resourceVersion.value,
          name,
          match_labels: matchLabels,
          match_expressions: '',
          starts_at: range.startsAt,
          ends_at: range.endsAt,
          comment: formData.value.comment,
          enabled: formData.value.enabled
        })
        ElMessage.success('更新成功')
      } else {
        await fetchCreateAlertSilence({
          name,
          match_labels: matchLabels,
          match_expressions: '',
          starts_at: range.startsAt,
          ends_at: range.endsAt,
          comment: formData.value.comment,
          enabled: formData.value.enabled
        })
        ElMessage.success('创建成功')
      }
      emit('success')
      closeDrawer()
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '提交失败')
      }
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped lang="scss">
  .alert-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .alert-drawer-title {
    font-size: 15px;
    font-weight: 600;
  }

  .alert-drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .silence-config-item {
    align-items: flex-start;

    :deep(> .el-form-item__content) {
      display: block;
      line-height: normal;
    }
  }

  .silence-config-panel {
    width: 100%;
    padding: 12px 12px 2px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-light);
    box-sizing: border-box;
  }

  :global(html:not(.dark)) .silence-config-panel {
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
    border-color: #e8eef6;
  }

  :global(html.dark) .silence-config-panel {
    background: var(--art-gray-200, var(--el-fill-color-light));
  }

  .silence-config-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .silence-config-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
  }

  .silence-config-row--labels {
    gap: 5px;
  }

  .silence-config-row__label {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }

  .silence-config-row__label--with-tip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .silence-config-tip {
    color: var(--el-text-color-secondary);
    font-size: 14px;
    cursor: help;
  }

  .silence-label-field {
    width: 100%;
  }

  .kv-list {
    width: 100%;
  }

  .kv-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    margin-bottom: 8px;
  }

  .kv-list > .kv-row:last-of-type {
    margin-bottom: 5px;
  }

  .kv-add-btn {
    font-size: 11px;
  }

  .kv-del-btn {
    color: var(--el-text-color-primary);
  }

  .silence-label-field :deep(.el-input__inner),
  .silence-label-field :deep(.el-input__wrapper) {
    font-size: 11px;
  }

  .silence-duration {
    width: 100%;
  }

  .silence-duration-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .silence-duration-segment {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: stretch;
  }

  .silence-duration-segment__item {
    position: relative;
    min-width: 52px;
    height: 30px;
    padding: 0 14px;
    border: 1px solid var(--el-border-color);
    margin-left: -1px;
    background: var(--el-bg-color);
    color: var(--el-text-color-regular);
    font-size: 12px;
    line-height: 28px;
    cursor: pointer;
  }

  .silence-duration-segment__item:first-child {
    margin-left: 0;
    border-radius: 2px 0 0 2px;
  }

  .silence-duration-segment__item:last-child {
    border-radius: 0 2px 2px 0;
  }

  .silence-duration-segment__item.is-active {
    z-index: 1;
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
    background: var(--el-bg-color);
  }

  .silence-duration__custom {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .silence-duration__picker {
    flex: 0 0 200px;
    width: 200px;
    margin-bottom: 0;
  }

  .silence-duration__picker :deep(.el-form-item__content) {
    width: 100%;
    margin-left: 0 !important;
  }

  .silence-duration__picker :deep(.el-date-editor) {
    width: 100%;
  }

  :deep(.el-form-item__label),
  :deep(.el-input__inner),
  :deep(.el-textarea__inner),
  :deep(.el-select__selected-item) {
    font-size: 12px;
  }
</style>
