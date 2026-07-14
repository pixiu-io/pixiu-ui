<!-- 告警规则：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="60%"
    destroy-on-close
    :show-close="false"
    class="alert-rule-drawer"
  >
    <template #header>
      <div class="alert-drawer-header">
        <span class="alert-drawer-title">{{ isEdit ? '编辑告警规则' : '添加告警规则' }}</span>
        <ElButton text circle class="alert-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="alert-drawer-body">
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="108px" class="alert-form">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入规则名称" />
        </ElFormItem>
        <ElFormItem label="数据源" prop="datasourceId">
          <ElSelect
            v-model="formData.datasourceId"
            filterable
            class="w-full datasource-select"
            popper-class="alert-rule-datasource-popper"
            placeholder="请选择告警数据源"
          >
            <template v-if="selectedDatasource" #prefix>
              <ArtSvgIcon
                :icon="getDatasourceIcon(selectedDatasource.subType).icon"
                class="datasource-option__logo datasource-option__logo--prefix"
                :style="{ color: getDatasourceIcon(selectedDatasource.subType).color }"
              />
            </template>
            <ElOption
              v-for="item in datasourceOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              <div class="datasource-option">
                <ArtSvgIcon
                  :icon="getDatasourceIcon(item.subType).icon"
                  class="datasource-option__logo"
                  :style="{ color: getDatasourceIcon(item.subType).color }"
                />
                <span class="datasource-option__name">{{ item.name }}</span>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="规则类型" prop="ruleType">
          <ElSelect v-model="formData.ruleType" class="w-full">
            <ElOption v-for="(label, value) in AlertRuleTypeMap" :key="value" :label="label" :value="Number(value)" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="PromQL" prop="promQl" required>
          <ElInput v-model="formData.promQl" placeholder="请输入 PromQL 查询表达式" />
        </ElFormItem>
        <ElFormItem label-width="0" class="alert-conditions-item" required>
          <div class="alert-conditions-panel">
            <div class="alert-conditions-panel__title">
              <span class="alert-conditions-panel__required">*</span>
              告警条件
            </div>
            <div class="alert-conditions">
              <div v-for="(item, index) in conditions" :key="item.key" class="alert-condition-block">
                <div class="alert-condition-row">
                  <ElSelect v-model="item.severity" class="alert-condition-row__severity">
                    <ElOption
                      v-for="(meta, value) in AlertSeverityMap"
                      :key="value"
                      :label="meta.label"
                      :value="Number(value)"
                      :disabled="isSeverityUsed(Number(value) as AlertSeverity, index)"
                    />
                  </ElSelect>
                  <ElInput
                    v-model="item.condition"
                    class="alert-condition-row__expr"
                    :class="{ 'is-error': conditionErrors[item.key] }"
                    placeholder="请输入有效的告警条件，例如: >80"
                    @blur="validateConditionAt(index)"
                    @input="clearConditionError(item.key)"
                  />
                  <ElButton
                    v-if="conditions.length > 1"
                    link
                    class="alert-condition-row__remove"
                    title="移除"
                    @click="removeCondition(index)"
                  >
                    <ElIcon><Delete /></ElIcon>
                  </ElButton>
                </div>
                <div v-if="conditionErrors[item.key]" class="alert-condition-error">
                  {{ conditionErrors[item.key] }}
                </div>
              </div>
              <ElButton
                v-if="canAddCondition"
                type="primary"
                link
                class="alert-conditions__add"
                @click="addCondition"
              >
                添加
              </ElButton>
            </div>
          </div>
        </ElFormItem>
        <ElFormItem label="评估间隔">
          <ElInputNumber v-model="formData.evalInterval" :min="15" :step="1" class="w-full" />
          <span class="alert-form-hint">秒，默认 15</span>
        </ElFormItem>
        <ElFormItem label="通知渠道">
          <ElSelect
            v-model="selectedChannelIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="5"
            class="w-full"
            placeholder="选择已配置的通知渠道"
          >
            <ElOption v-for="item in channelOptions" :key="item.id" :label="item.name" :value="item.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="通知模板">
          <ElInput v-model="formData.notifyTemplate" type="textarea" :rows="3" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="生效时间" class="alert-effective-time-item">
          <div class="alert-effective-time">
            <ElSelect
              v-model="enableDays"
              multiple
              filterable
              clearable
              class="alert-effective-time__days"
              placeholder="如果为空则表示全天候"
            >
              <ElOption
                v-for="item in weekDayOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
            <ElTimePicker
              v-model="formData.enableStime"
              format="HH:mm"
              value-format="HH:mm"
              popper-class="alert-effective-time-popper"
              class="alert-effective-time__clock"
              placeholder="开始"
            />
            <ElTimePicker
              v-model="formData.enableEtime"
              format="HH:mm"
              value-format="HH:mm"
              popper-class="alert-effective-time-popper"
              class="alert-effective-time__clock"
              placeholder="结束"
            />
          </div>
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput v-model="formData.description" type="textarea" :rows="4" placeholder="可选" />
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
  import { Close, Delete } from '@element-plus/icons-vue'
  import { computed, ref, watch } from 'vue'
  import {
    ElIcon, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    AlertRuleTypeMap,
    AlertSeverityMap,
    fetchCreateAlertRule,
    fetchGetAlertChannelList,
    fetchGetAlertRule,
    fetchUpdateAlertRule,
    type AlertChannelItem,
    type AlertRuleType,
    type AlertSeverity
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { fetchDatasourceList, type DatasourceItem } from '@/api/datasource'

  defineOptions({ name: 'AlertRuleDrawer' })

  const props = defineProps<{ editId?: number }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ success: [] }>()

  const isEdit = computed(() => props.editId != null && props.editId > 0)
  const editLoading = ref(false)
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const resourceVersion = ref(0)
  const channelOptions = ref<AlertChannelItem[]>([])
  const datasourceOptions = ref<DatasourceItem[]>([])
  const selectedChannelIds = ref<number[]>([])
  const enableDays = ref<string[]>([])
  let conditionKeySeed = 1

  interface AlertConditionItem {
    key: number
    severity: AlertSeverity
    condition: string
  }

  const severityOptions = [1, 2, 3] as const

  const conditions = ref<AlertConditionItem[]>([createCondition()])
  /** 运算符后紧跟数字，中间前后均不允许空格，例如: >80 / <=10 / !=0 */
  const CONDITION_EXPR_PATTERN = /^(>=|<=|!=|<>|==|>|<|=)-?\d+(\.\d+)?$/
  const CONDITION_EXPR_HINT = '告警条件格式错误，例如: >80（运算符与数字之间不能有空格）'
  const conditionErrors = ref<Record<number, string>>({})

  function createCondition(severity: AlertSeverity = 1, condition = ''): AlertConditionItem {
    return {
      key: conditionKeySeed++,
      severity,
      condition
    }
  }

  function getConditionError(condition: string): string {
    if (!condition) return '请输入告警条件'
    if (!CONDITION_EXPR_PATTERN.test(condition)) return CONDITION_EXPR_HINT
    return ''
  }

  function clearConditionError(key: number) {
    if (!conditionErrors.value[key]) return
    const next = { ...conditionErrors.value }
    delete next[key]
    conditionErrors.value = next
  }

  function validateConditionAt(index: number): boolean {
    const item = conditions.value[index]
    if (!item) return true
    const error = getConditionError(item.condition)
    if (error) {
      conditionErrors.value = { ...conditionErrors.value, [item.key]: error }
      return false
    }
    clearConditionError(item.key)
    return true
  }

  function validateAllConditions(): boolean {
    let valid = true
    const nextErrors: Record<number, string> = {}
    for (const item of conditions.value) {
      const error = getConditionError(item.condition)
      if (error) {
        nextErrors[item.key] = error
        valid = false
      }
    }
    conditionErrors.value = nextErrors
    return valid
  }

  function isSeverityUsed(severity: AlertSeverity, currentIndex: number) {
    return conditions.value.some((item, index) => index !== currentIndex && item.severity === severity)
  }

  function nextAvailableSeverity(): AlertSeverity | null {
    const used = new Set(conditions.value.map((item) => item.severity))
    for (const severity of severityOptions) {
      if (!used.has(severity)) return severity
    }
    return null
  }

  const canAddCondition = computed(() => nextAvailableSeverity() != null)

  function addCondition() {
    const severity = nextAvailableSeverity()
    if (severity == null) return
    conditions.value.push(createCondition(severity))
  }

  function removeCondition(index: number) {
    if (conditions.value.length <= 1) return
    const [removed] = conditions.value.splice(index, 1)
    if (removed) clearConditionError(removed.key)
  }

  function dedupeTriggersBySeverity(triggers: AlertConditionItem[]): AlertConditionItem[] {
    const seen = new Set<AlertSeverity>()
    const result: AlertConditionItem[] = []
    for (const item of triggers) {
      if (seen.has(item.severity)) continue
      seen.add(item.severity)
      result.push(item)
    }
    return result.length > 0 ? result : [createCondition()]
  }

  function parseRuleConfig(ruleConfig?: string): { promQl: string; triggers: AlertConditionItem[] } {
    if (ruleConfig) {
      try {
        const parsed = JSON.parse(ruleConfig) as {
          prom_ql?: string
          triggers?: Array<{ severity?: number; condition?: string }>
          queries?: Array<{ prom_ql?: string; severity?: number }>
        }

        const promQl = String(parsed.prom_ql || '').trim()
        const triggers = (parsed.triggers || [])
          .map((item) =>
            createCondition(
              ([1, 2, 3].includes(Number(item.severity)) ? Number(item.severity) : 1) as AlertSeverity,
              String(item.condition || '').trim()
            )
          )
          .filter((item) => item.condition)

        if (promQl || triggers.length > 0) {
          return {
            promQl,
            triggers: dedupeTriggersBySeverity(triggers.length > 0 ? triggers : [createCondition()])
          }
        }

        // legacy: queries[{prom_ql, severity}]
        const queries = parsed.queries || []
        if (queries.length > 0) {
          let migratedPromQl = ''
          const migratedTriggers: AlertConditionItem[] = []
          for (const item of queries) {
            const raw = String(item.prom_ql || '').trim()
            if (!raw) continue
            const severity = ([1, 2, 3].includes(Number(item.severity))
              ? Number(item.severity)
              : 1) as AlertSeverity
            if (/^(>=|<=|!=|<>|==|>|<|=)\s*/.test(raw)) {
              migratedTriggers.push(createCondition(severity, raw))
            } else {
              if (!migratedPromQl) migratedPromQl = raw
              migratedTriggers.push(createCondition(severity, '>0'))
            }
          }
          if (migratedPromQl || migratedTriggers.length > 0) {
            return {
              promQl: migratedPromQl,
              triggers: dedupeTriggersBySeverity(
                migratedTriggers.length > 0 ? migratedTriggers : [createCondition()]
              )
            }
          }
        }
      } catch {
        // invalid rule_config
      }
    }
    return { promQl: '', triggers: [createCondition()] }
  }

  function buildRuleConfigPayload(): {
    ruleConfig: string
    severity: AlertSeverity
  } {
    const promQl = formData.value.promQl.trim()
    if (!promQl) {
      throw new Error('请输入 PromQL')
    }
    if (!validateAllConditions()) {
      throw new Error(CONDITION_EXPR_HINT)
    }
    const triggers = conditions.value.map((item) => ({
      severity: item.severity,
      condition: item.condition
    }))
    const severitySet = new Set<AlertSeverity>()
    for (const item of triggers) {
      if (severitySet.has(item.severity)) {
        throw new Error('P0 / P1 / P2 不能重复选择')
      }
      severitySet.add(item.severity)
    }
    return {
      ruleConfig: JSON.stringify({
        prom_ql: promQl,
        triggers: triggers.map((item) => ({ ...item, duration: 0 }))
      }),
      severity: triggers[0]!.severity
    }
  }

  const weekDayOptions = [
    { value: '1', label: '周一' },
    { value: '2', label: '周二' },
    { value: '3', label: '周三' },
    { value: '4', label: '周四' },
    { value: '5', label: '周五' },
    { value: '6', label: '周六' },
    { value: '0', label: '周日' }
  ]

  const datasourceSubTypeIconMap: Record<string, { icon: string; color: string }> = {
    prometheus: { icon: 'simple-icons:prometheus', color: '#E6522C' },
    loki: { icon: 'simple-icons:grafana', color: '#F46800' },
    es: { icon: 'simple-icons:elasticsearch', color: '#005571' }
  }

  function getDatasourceIcon(subType: string) {
    return datasourceSubTypeIconMap[subType] ?? { icon: 'ri:database-2-line', color: '#606266' }
  }

  const selectedDatasource = computed(() =>
    datasourceOptions.value.find((item) => item.id === formData.value.datasourceId)
  )

  const formData = ref(createDefaultFormData())

  function createDefaultFormData() {
    return {
      name: '',
      description: '',
      ruleType: 1 as AlertRuleType,
      promQl: '',
      evalInterval: 15,
      notifyTemplate: '',
      enableStime: '00:00',
      enableEtime: '00:00',
      datasourceId: undefined as number | undefined,
      enabled: true
    }
  }

  function parseEnableDays(raw?: string): string[] {
    if (!raw) return []
    return raw
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter((item) => item !== '')
      .map((item) => (item === '7' ? '0' : item))
  }

  function serializeEnableDays(days: string[]): string {
    return days.join(' ')
  }

  const rules: FormRules = {
    name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
    ruleType: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
    datasourceId: [{ required: true, message: '请选择数据源', trigger: 'change' }],
    promQl: [{ required: true, message: '请输入 PromQL', trigger: 'blur' }]
  }

  async function loadChannelOptions() {
    const { records } = await fetchGetAlertChannelList({ page: 1, limit: 200, enabled: true })
    channelOptions.value = records
  }

  async function loadDatasourceOptions() {
    const { items } = await fetchDatasourceList({ page: 1, limit: 200, type: 1 })
    datasourceOptions.value = items ?? []
  }

  function parseChannelIds(raw: string): number[] {
    return raw
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((id) => id > 0)
  }

  function closeDrawer() {
    visible.value = false
  }

  async function loadDetail() {
    if (!isEdit.value || !props.editId) return
    editLoading.value = true
    try {
      const detail = await fetchGetAlertRule(props.editId)
      resourceVersion.value = detail.resourceVersion
      selectedChannelIds.value = parseChannelIds(detail.notifyChannels)
      enableDays.value = parseEnableDays(detail.enableDaysOfWeek)
      const parsed = parseRuleConfig(detail.ruleConfig)
      conditions.value = parsed.triggers
      conditionErrors.value = {}
      formData.value = {
        name: detail.name,
        description: detail.description,
        ruleType: detail.ruleType,
        promQl: parsed.promQl,
        evalInterval: detail.evalInterval,
        notifyTemplate: detail.notifyTemplate,
        enableStime: detail.enableStime || '00:00',
        enableEtime: detail.enableEtime || '00:00',
        datasourceId: detail.datasourceId || undefined,
        enabled: detail.enabled
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载规则详情失败')
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  watch(
    () => visible.value,
    async (open) => {
      if (!open) return
      await loadChannelOptions()
      await loadDatasourceOptions()
      if (isEdit.value) {
        await loadDetail()
      } else {
        resourceVersion.value = 0
        selectedChannelIds.value = []
        enableDays.value = []
        conditions.value = [createCondition()]
        conditionErrors.value = {}
        formData.value = createDefaultFormData()
      }
      formRef.value?.clearValidate()
    }
  )

  async function handleSubmit() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      const { ruleConfig, severity } = buildRuleConfigPayload()
      const notifyChannels = selectedChannelIds.value.join(',')
      const enableDaysOfWeek = serializeEnableDays(enableDays.value)
      const enableStime = formData.value.enableStime || '00:00'
      const enableEtime = formData.value.enableEtime || '00:00'
      if (isEdit.value && props.editId) {
        await fetchUpdateAlertRule(props.editId, {
          resource_version: resourceVersion.value,
          name: formData.value.name,
          description: formData.value.description,
          rule_type: formData.value.ruleType,
          duration: 0,
          eval_interval: formData.value.evalInterval,
          severity,
          scope_type: 1,
          notify_channels: notifyChannels,
          notify_template: formData.value.notifyTemplate,
          rule_config: ruleConfig,
          enable_days_of_week: enableDaysOfWeek,
          enable_stime: enableStime,
          enable_etime: enableEtime,
          datasource_id: formData.value.datasourceId || 0,
          enabled: formData.value.enabled
        })
        ElMessage.success('更新成功')
      } else {
        await fetchCreateAlertRule({
          name: formData.value.name,
          description: formData.value.description,
          rule_type: formData.value.ruleType,
          duration: 0,
          eval_interval: formData.value.evalInterval,
          severity,
          scope_type: 1,
          notify_channels: notifyChannels,
          notify_template: formData.value.notifyTemplate,
          rule_config: ruleConfig,
          enable_days_of_week: enableDaysOfWeek,
          enable_stime: enableStime,
          enable_etime: enableEtime,
          datasource_id: formData.value.datasourceId || 0,
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

  .alert-drawer-body {
    padding-right: 8px;
  }

  .alert-form-hint {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .alert-conditions-item {
    margin-left: 108px;
    margin-bottom: 12px;

    :deep(.el-form-item__content) {
      margin-left: 0 !important;
      line-height: normal;
    }
  }

  .alert-conditions-panel {
    width: 100%;
    padding: 12px 12px 2px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-light);
    box-sizing: border-box;
  }

  .alert-conditions-panel__title {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    line-height: 1;
  }

  .alert-conditions-panel__required {
    color: var(--el-color-danger);
  }

  .alert-conditions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .alert-condition-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .alert-condition-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .alert-condition-row__severity {
    width: 88px;
    flex-shrink: 0;
  }

  .alert-condition-row__expr {
    flex: 1;
    min-width: 0;
  }

  .alert-condition-row__expr.is-error :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset;
  }

  .alert-condition-error {
    margin-left: 96px;
    font-size: 12px;
    line-height: 1.2;
    color: var(--el-color-danger);
  }

  .alert-condition-row__remove {
    flex-shrink: 0;
    color: var(--el-text-color-primary);
  }

  .alert-conditions__add {
    align-self: flex-start;
    margin: 0;
    padding: 0;
    height: 20px;
    min-height: 20px;
    font-size: 12px;
    line-height: 20px;
  }

  :global(html:not(.dark)) .alert-conditions-panel {
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
    border-color: #e8eef6;
  }

  :global(html.dark) .alert-conditions-panel {
    background: var(--art-gray-200, var(--el-fill-color-light));
  }

  .alert-effective-time-item {
    :deep(.el-form-item__label) {
      padding-right: 16px;
    }
  }

  .alert-effective-time {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .alert-effective-time__days {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }

  .alert-effective-time__clock {
    --el-date-editor-width: 150px;
    width: var(--el-date-editor-width) !important;
    flex: 0 0 var(--el-date-editor-width);
    max-width: var(--el-date-editor-width);
  }

  .alert-effective-time__clock :deep(.el-input__wrapper) {
    width: 100%;
    padding-left: 4px;
    padding-right: 4px;
  }

  .alert-drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  :deep(.el-form-item__label),
  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 12px;
  }

  .datasource-select {
    :deep(.el-select__prefix) {
      display: inline-flex;
      align-items: center;
    }
  }

  .datasource-option__logo--prefix {
    margin-right: 0;
  }

  .datasource-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 22px;
    line-height: 22px;
    pointer-events: none;
  }

  .datasource-option__logo {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    font-size: 16px;
  }

  .datasource-option__logo :deep(svg) {
    color: inherit;
  }

  .datasource-option__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
</style>

<style lang="less">
  .alert-rule-datasource-popper.el-select__popper:not(.el-tree-select__popper) {
    .el-select-dropdown__list {
      padding: 5px !important;

      .el-select-dropdown__item {
        height: 34px !important;
        line-height: 1 !important;
        padding: 0 12px !important;
        display: flex !important;
        align-items: center !important;
        box-sizing: border-box;

        &.is-selected {
          margin-bottom: 0 !important;
        }
      }
    }
  }

  .alert-effective-time-popper {
    .el-time-panel {
      width: 140px;
      overflow: hidden;
    }

    .el-time-panel__content {
      overflow: hidden;
    }

    .el-time-spinner__wrapper {
      max-height: 192px;
    }

    /* 去掉滚动列表上下占位，避免下拉顶部大块空白 */
    .el-time-spinner__list::before,
    .el-time-spinner__list::after {
      height: 0 !important;
    }

    /* 去掉居中选中指示横线（占位取消后会错位溢出） */
    .el-time-panel__content::before,
    .el-time-panel__content::after {
      display: none !important;
    }
  }
</style>
