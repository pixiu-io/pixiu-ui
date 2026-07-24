<!-- 告警配置 -->
<template>
  <div class="alert-config-page art-full-height">
    <ElAlert
      v-if="descriptionAlertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      :description="tabDescription"
      @close="descriptionAlertVisible = false"
    />

    <div
      class="alert-toolbar-outer"
      :class="{ 'alert-toolbar-outer--no-alert': !descriptionAlertVisible }"
    >
      <div
        v-if="activeTabHasCreate || activeTab === 'notifications' || activeTab === 'events'"
        style="display: flex; align-items: center; gap: 8px"
      >
        <ElButton v-if="activeTabHasCreate" v-ripple @click="handleCreate">{{
          createButtonText
        }}</ElButton>
        <template v-if="activeTab === 'events'">
          <ElButton v-ripple :disabled="!selectedEvents.length" @click="handleBatchProcessEvents">
            处理事件
          </ElButton>
        </template>
        <template v-if="activeTab === 'notifications'">
          <ElButton
            v-ripple
            :disabled="!selectedNotifications.length"
            @click="handleSilenceNotification"
          >
            静默告警
          </ElButton>
          <ElButton
            v-ripple
            :disabled="!selectedNotifications.length"
            @click="handleDeleteNotifications"
          >
            批量删除
          </ElButton>
        </template>
      </div>
      <div v-else />

      <div class="alert-toolbar__right">
        <template v-if="activeTab === 'rules'">
          <ElInput
            v-model="ruleSearch.nameSelector"
            clearable
            placeholder="规则名称"
            class="alert-toolbar__search"
            @keyup.enter="handleRuleSearch"
            @clear="resetRuleSearch"
          />
          <ElSelect
            v-model="ruleSearch.severity"
            clearable
            placeholder="告警级别"
            class="alert-toolbar__filter"
            @change="handleRuleSearch"
          >
            <ElOption
              v-for="(meta, value) in AlertSeverityMap"
              :key="value"
              :label="meta.label"
              :value="Number(value)"
            />
          </ElSelect>
          <ElLink
            type="primary"
            :underline="false"
            style="font-size: 12px; cursor: pointer"
            @click="triggerImportRules"
            >导入</ElLink
          >
          <ElLink
            type="primary"
            :underline="false"
            :disabled="!selectedRules.length"
            style="font-size: 12px; cursor: pointer"
            @click="handleExportRules"
            >导出</ElLink
          >
          <input
            ref="ruleImportInputRef"
            type="file"
            accept=".json,application/json"
            style="display: none"
            @change="handleImportRulesChange"
          />
        </template>

        <template v-else-if="activeTab === 'channels'">
          <ElInput
            v-model="channelSearch.nameSelector"
            clearable
            placeholder="渠道名称"
            class="alert-toolbar__search"
            @keyup.enter="handleChannelSearch"
            @clear="resetChannelSearch"
          />
          <ElSelect
            v-model="channelSearch.channelType"
            clearable
            placeholder="渠道类型"
            class="alert-toolbar__filter"
            @change="handleChannelSearch"
          >
            <ElOption
              v-for="(label, value) in AlertChannelTypeMap"
              :key="value"
              :label="label"
              :value="Number(value)"
            />
          </ElSelect>
        </template>

        <template v-else-if="activeTab === 'silences'">
          <ElInput
            v-model="silenceSearch.nameSelector"
            clearable
            placeholder="告警静默名称"
            class="alert-toolbar__search"
            @keyup.enter="handleSilenceSearch"
            @clear="resetSilenceSearch"
          />
        </template>

        <template v-else-if="activeTab === 'events'">
          <ElInput
            v-model="eventSearch.ruleId"
            clearable
            placeholder="规则 ID"
            class="alert-toolbar__search--short"
            @keyup.enter="handleEventSearch"
            @clear="resetEventSearch"
          />
          <ElSelect
            v-model="eventSearch.status"
            clearable
            placeholder="事件状态"
            class="alert-toolbar__filter"
            @change="handleEventSearch"
          >
            <ElOption
              v-for="(meta, value) in AlertEventStatusMap"
              :key="value"
              :label="meta.label"
              :value="Number(value)"
            />
          </ElSelect>
        </template>
        <template v-else-if="activeTab === 'notifications'">
          <ElInput
            v-model="notificationSearch.nameSelector"
            clearable
            placeholder="规则名称"
            class="alert-toolbar__search"
            @keyup.enter="handleNotificationSearch"
            @clear="resetNotificationSearch"
          />
        </template>

        <ArtTableHeader
          v-if="activeTab === 'rules'"
          v-model:columns="ruleColumnChecks"
          :loading="ruleLoading"
          @refresh="refreshRuleData"
        />
        <ArtTableHeader
          v-else-if="activeTab === 'channels'"
          v-model:columns="channelColumnChecks"
          :loading="channelLoading"
          @refresh="refreshChannelData"
        />
        <ArtTableHeader
          v-else-if="activeTab === 'silences'"
          v-model:columns="silenceColumnChecks"
          :loading="silenceLoading"
          @refresh="refreshSilenceData"
        />
        <ArtTableHeader
          v-else-if="activeTab === 'events'"
          v-model:columns="eventColumnChecks"
          :loading="eventLoading"
          @refresh="refreshEventData"
        />
        <ArtTableHeader
          v-else
          v-model:columns="notificationColumnChecks"
          :loading="notificationLoading"
          @refresh="refreshNotificationData"
        />
      </div>
    </div>

    <ElCard class="art-table-card">
      <ElTabs v-model="activeTab" class="alert-tabs" @tab-change="handleTabChange">
        <ElTabPane label="告警规则" name="rules">
          <ArtTable
            row-key="id"
            :show-table-header="false"
            :loading="ruleLoading"
            :data="ruleData"
            :columns="ruleColumns"
            :pagination="rulePagination"
            :pagination-options="tablePaginationOptions"
            @pagination:size-change="handleRuleSizeChange"
            @pagination:current-change="handleRuleCurrentChange"
            @selection-change="handleRuleSelectionChange"
          />
        </ElTabPane>

        <ElTabPane label="告警静默" name="silences">
          <ArtTable
            row-key="id"
            :show-table-header="false"
            :loading="silenceLoading"
            :data="silenceData"
            :columns="silenceColumns"
            :pagination="silencePagination"
            :pagination-options="tablePaginationOptions"
            @pagination:size-change="handleSilenceSizeChange"
            @pagination:current-change="handleSilenceCurrentChange"
            @selection-change="handleSilenceSelectionChange"
          />
        </ElTabPane>

        <ElTabPane label="告警事件" name="events">
          <ArtTable
            row-key="id"
            :show-table-header="false"
            :loading="eventLoading"
            :data="eventData"
            :columns="eventColumns"
            :pagination="eventPagination"
            :pagination-options="tablePaginationOptions"
            @pagination:size-change="handleEventSizeChange"
            @pagination:current-change="handleEventCurrentChange"
            @selection-change="handleEventSelectionChange"
          />
        </ElTabPane>

        <ElTabPane label="告警历史" name="notifications">
          <ArtTable
            row-key="id"
            :show-table-header="false"
            :loading="notificationLoading"
            :data="notificationData"
            :columns="notificationColumns"
            :pagination="notificationPagination"
            :pagination-options="tablePaginationOptions"
            @pagination:size-change="handleNotificationSizeChange"
            @pagination:current-change="handleNotificationCurrentChange"
            @selection-change="handleNotificationSelectionChange"
          />
        </ElTabPane>

        <ElTabPane label="通知渠道" name="channels">
          <ArtTable
            row-key="id"
            :show-table-header="false"
            :loading="channelLoading"
            :data="channelData"
            :columns="channelColumns"
            :pagination="channelPagination"
            :pagination-options="tablePaginationOptions"
            @pagination:size-change="handleChannelSizeChange"
            @pagination:current-change="handleChannelCurrentChange"
          />
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <AlertRuleDrawer
      v-model="ruleDrawerVisible"
      :edit-id="ruleEditId"
      :clone-id="ruleCloneId"
      @success="refreshRuleData"
    />
    <AlertChannelDrawer
      v-model="channelDrawerVisible"
      :edit-id="channelEditId"
      @success="refreshChannelData"
    />
    <AlertSilenceDrawer
      v-model="silenceDrawerVisible"
      :edit-id="silenceEditId"
      :preset-rule-id="silencePresetRuleId"
      @success="refreshSilenceData"
    />
    <AlertEventStatusDialog
      v-model="eventStatusVisible"
      :events="currentEvents"
      @success="refreshEventData"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, h, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import {
    ElAlert,
    ElButton,
    ElCard,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElOption,
    ElSelect,
    ElSwitch,
    ElTabPane,
    ElTabs,
    ElTag
  } from 'element-plus'
  import {
    AlertChannelTypeMap,
    AlertEventStatusMap,
    AlertNotificationStatusMap,
    AlertRuleTypeMap,
    AlertScopeTypeMap,
    AlertSeverityMap,
    formatAlertDateTime,
    fetchDeleteAlertChannel,
    fetchDeleteAlertNotification,
    fetchDeleteAlertRule,
    fetchDeleteAlertSilence,
    fetchExportAlertRules,
    fetchGetAlertChannelList,
    fetchGetAlertEventList,
    fetchGetAlertNotificationList,
    fetchGetAlertRuleList,
    fetchGetAlertSilenceList,
    fetchImportAlertRules,
    fetchUpdateAlertRule,
    fetchUpdateAlertSilence,
    type AlertChannelItem,
    type AlertEventItem,
    type AlertNotificationItem,
    type AlertRuleItem,
    type AlertSilenceItem
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'
  import AlertRuleDrawer from './alert-config/modules/alert-rule-drawer.vue'
  import AlertChannelDrawer from './alert-config/modules/alert-channel-drawer.vue'
  import AlertChannelTypeIcon from './alert-config/modules/alert-channel-type-icon.vue'
  import AlertSilenceDrawer from './alert-config/modules/alert-silence-drawer.vue'
  import AlertEventStatusDialog from './alert-config/modules/alert-event-status-dialog.vue'

  defineOptions({ name: 'AlertConfig' })

  type AlertTab = 'rules' | 'channels' | 'silences' | 'events' | 'notifications'

  const route = useRoute()
  const router = useRouter()

  const validTabs: AlertTab[] = ['rules', 'silences', 'events', 'notifications', 'channels']
  const tabFromQuery = route.query.tab as string | undefined
  const initialTab: AlertTab = validTabs.includes(tabFromQuery as AlertTab)
    ? (tabFromQuery as AlertTab)
    : 'rules'

  const activeTab = ref<AlertTab>(initialTab)
  const descriptionAlertVisible = ref(true)
  const tablePaginationOptions = { align: 'right' as const, hideOnEmpty: false }

  function renderDateTime(value?: string) {
    const text = formatAlertDateTime(value) || value || '-'
    return h('span', { style: { fontSize: '12px' } }, text)
  }

  const tabDescriptions: Record<AlertTab, string> = {
    rules: '管理告警规则，配置触发条件、评估间隔和通知渠道。',
    channels: '管理通知渠道配置，支持邮件、钉钉、企业微信和 Webhook。',
    silences: '配置告警静默，在指定时间段内抑制匹配的告警通知。',
    events: '查看引擎产生的告警事件，可手动更新事件状态（确认/解决等）。',
    notifications: '查看告警历史通知记录，包含发送状态与失败原因。'
  }

  const tabDescription = computed(() => tabDescriptions[activeTab.value])

  const activeTabHasCreate = computed(() =>
    ['rules', 'channels', 'silences'].includes(activeTab.value)
  )

  const channelIdToNameMap = ref<Record<number, string>>({})

  async function loadChannelNameMap() {
    const { records } = await fetchGetAlertChannelList({ page: 1, limit: 500 })
    const map: Record<number, string> = {}
    for (const ch of records) {
      map[ch.id] = ch.name
    }
    channelIdToNameMap.value = map
  }

  function formatNotifyChannels(notifyChannels?: string) {
    if (!notifyChannels) return '-'
    const ids = notifyChannels.split(',').map(Number).filter(Boolean)
    if (ids.length === 0) return '-'
    const names = ids.map((id) => channelIdToNameMap.value[id] || String(id))
    return names.join('，')
  }

  function renderNotifyChannelTags(notifyChannels?: string) {
    if (!notifyChannels) return h('span', { style: { fontSize: '12px' } }, '-')
    const ids = notifyChannels.split(',').map(Number).filter(Boolean)
    if (ids.length === 0) return h('span', { style: { fontSize: '12px' } }, '-')
    const tags = ids.map((id) => {
      const name = channelIdToNameMap.value[id] || String(id)
      return h(ElTag, { size: 'small', style: { margin: '1px 2px', fontSize: '11px' } }, () => name)
    })
    return h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:2px' }, tags)
  }

  loadChannelNameMap()

  const createButtonText = computed(() => {
    if (activeTab.value === 'rules') return '新增告警规则'
    if (activeTab.value === 'channels') return '添加渠道'
    if (activeTab.value === 'silences') return '添加静默'
    return '添加'
  })

  // ---------- Rules ----------
  const ruleSearch = ref({
    nameSelector: undefined as string | undefined,
    severity: undefined as number | undefined
  })
  const ruleDrawerVisible = ref(false)
  const ruleEditId = ref<number | undefined>()
  const ruleCloneId = ref<number | undefined>()

  const selectedRules = ref<AlertRuleItem[]>([])
  const ruleExporting = ref(false)
  const ruleImporting = ref(false)
  const ruleImportInputRef = ref<HTMLInputElement | null>(null)

  const {
    columns: ruleColumns,
    columnChecks: ruleColumnChecks,
    data: ruleData,
    loading: ruleLoading,
    pagination: rulePagination,
    getData: getRuleData,
    replaceSearchParams: replaceRuleSearchParams,
    resetSearchParams: resetRuleSearchParams,
    handleSizeChange: handleRuleSizeChange,
    handleCurrentChange: handleRuleCurrentChange,
    refreshData: refreshRuleData
  } = useTable({
    core: {
      immediate: initialTab === 'rules',
      apiFn: fetchGetAlertRuleList,
      apiParams: { current: 1, size: 10, ...ruleSearch.value },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'name',
          label: '规则名称',
          minWidth: 180,
          formatter: (row: AlertRuleItem) => h('span', { style: { fontSize: '12px' } }, row.name)
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 100,
          formatter: (row: AlertRuleItem) =>
            h(ElTag, { size: 'small', type: row.enabled ? 'success' : 'info' }, () =>
              row.enabled ? '正常' : '关闭'
            )
        },
        {
          prop: 'ruleType',
          label: '类型',
          width: 80,
          formatter: (row: AlertRuleItem) =>
            h('span', { style: { fontSize: '12px' } }, AlertRuleTypeMap[row.ruleType] || '-')
        },
        {
          prop: 'evalInterval',
          label: '评估间隔',
          width: 96,
          formatter: (row: AlertRuleItem) =>
            h('span', { style: { fontSize: '12px' } }, `${row.evalInterval}s`)
        },
        {
          prop: 'gmtCreate',
          label: '创建时间',
          minWidth: 180,
          formatter: (row: AlertRuleItem) => renderDateTime(row.gmtCreate)
        },
        {
          prop: 'notifyChannels',
          label: '通知渠道',
          minWidth: 140,
          visible: false,
          formatter: (row: AlertRuleItem) => renderNotifyChannelTags(row.notifyChannels)
        },
        {
          prop: 'enabledSwitch',
          label: '启用',
          width: 120,
          align: 'center',
          formatter: (row: AlertRuleItem) =>
            h(ElSwitch, {
              modelValue: row.enabled,
              size: 'small',
              onChange: (value) => toggleRuleEnabled(row, Boolean(value))
            })
        },
        {
          prop: 'createdBy',
          label: '最后更新人',
          minWidth: 120,
          formatter: (row: AlertRuleItem) =>
            h('span', { style: { fontSize: '12px' } }, row.createdBy || '-')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: AlertRuleItem) => renderRuleOperationLinks(row)
        }
      ]
    }
  })

  function handleRuleSearch() {
    replaceRuleSearchParams({ ...ruleSearch.value })
    getRuleData()
  }

  function handleRuleSelectionChange(rows: AlertRuleItem[]) {
    selectedRules.value = rows
  }

  async function handleExportRules() {
    if (!selectedRules.value.length) {
      ElMessage.warning('请先选择要导出的告警规则')
      return
    }
    ruleExporting.value = true
    try {
      const blob = await fetchExportAlertRules(selectedRules.value.map((item) => item.id))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `alert-rules-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      ElMessage.success(`已导出 ${selectedRules.value.length} 条告警规则`)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      ruleExporting.value = false
    }
  }

  function triggerImportRules() {
    ruleImportInputRef.value?.click()
  }

  async function handleImportRulesChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    ruleImporting.value = true
    try {
      const result = await fetchImportAlertRules(file)
      if (result.failed > 0) {
        ElMessage.warning(`导入完成：成功 ${result.created} 条，失败 ${result.failed} 条`)
      } else {
        ElMessage.success(`成功导入 ${result.created} 条告警规则`)
      }
      refreshRuleData()
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '导入失败')
      }
    } finally {
      ruleImporting.value = false
    }
  }

  function resetRuleSearch() {
    ruleSearch.value.nameSelector = undefined
    ruleSearch.value.severity = undefined
    resetRuleSearchParams()
    handleRuleSearch()
  }

  async function toggleRuleEnabled(row: AlertRuleItem, enabled: boolean) {
    try {
      await fetchUpdateAlertRule(row.id, { resource_version: row.resourceVersion, enabled })
      ElMessage.success(enabled ? '已启用' : '已停用')
      refreshRuleData()
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '更新失败')
      }
      refreshRuleData()
    }
  }

  function editRule(row: AlertRuleItem) {
    ruleCloneId.value = undefined
    ruleEditId.value = row.id
    ruleDrawerVisible.value = true
  }

  function cloneRule(row: AlertRuleItem) {
    ruleEditId.value = undefined
    ruleCloneId.value = row.id
    ruleDrawerVisible.value = true
  }

  function silenceFromRule(row: AlertRuleItem) {
    silenceEditId.value = undefined
    silencePresetRuleId.value = row.id
    silenceDrawerVisible.value = true
  }

  function silenceFromNotification(row: AlertNotificationItem) {
    silenceEditId.value = undefined
    silencePresetRuleId.value = row.ruleId
    silenceDrawerVisible.value = true
  }

  async function deleteNotification(row: AlertNotificationItem) {
    await confirmDelete(
      `确定删除告警历史「${row.title || `通知 #${row.id}`}」吗？`,
      () => fetchDeleteAlertNotification(row.id),
      refreshNotificationData
    )
  }

  async function deleteRule(row: AlertRuleItem) {
    await confirmDelete(
      `确定删除告警规则「${row.name}」吗？`,
      () => fetchDeleteAlertRule(row.id),
      refreshRuleData
    )
  }

  // ---------- Channels ----------
  const channelSearch = ref({
    nameSelector: undefined as string | undefined,
    channelType: undefined as number | undefined
  })
  const channelDrawerVisible = ref(false)
  const channelEditId = ref<number | undefined>()

  const {
    columns: channelColumns,
    columnChecks: channelColumnChecks,
    data: channelData,
    loading: channelLoading,
    pagination: channelPagination,
    getData: getChannelData,
    replaceSearchParams: replaceChannelSearchParams,
    resetSearchParams: resetChannelSearchParams,
    handleSizeChange: handleChannelSizeChange,
    handleCurrentChange: handleChannelCurrentChange,
    refreshData: refreshChannelData
  } = useTable({
    core: {
      immediate: initialTab === 'channels',
      apiFn: fetchGetAlertChannelList,
      apiParams: { current: 1, size: 10, ...channelSearch.value },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 180,
          formatter: (row: AlertChannelItem) =>
            h('div', { class: 'alert-channel-name-cell' }, [
              h(AlertChannelTypeIcon, { channelType: row.channelType, size: 20 }),
              h('span', { class: 'alert-channel-name-cell__text' }, row.name)
            ])
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 100,
          formatter: (row: AlertChannelItem) =>
            h(ElTag, { size: 'small', type: row.enabled ? 'success' : 'info' }, () =>
              row.enabled ? '启用' : '停用'
            )
        },
        {
          prop: 'channelType',
          label: '类型',
          width: 110,
          formatter: (row: AlertChannelItem) =>
            h('span', { style: { fontSize: '12px' } }, AlertChannelTypeMap[row.channelType] || '-')
        },
        {
          prop: 'gmtCreate',
          label: '创建时间',
          minWidth: 180,
          formatter: (row: AlertChannelItem) => renderDateTime(row.gmtCreate)
        },
        {
          prop: 'gmtModified',
          label: '更新时间',
          minWidth: 180,
          formatter: (row: AlertChannelItem) => renderDateTime(row.gmtModified)
        },
        {
          prop: 'description',
          label: '描述',
          minWidth: 180,
          showOverflowTooltip: true,
          formatter: (row: AlertChannelItem) =>
            h('span', { style: { fontSize: '12px' } }, row.description || '-')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: AlertChannelItem) => renderCrudLinks(row, editChannel, deleteChannel)
        }
      ]
    }
  })

  function handleChannelSearch() {
    replaceChannelSearchParams({ ...channelSearch.value })
    getChannelData()
  }

  function resetChannelSearch() {
    channelSearch.value = { nameSelector: undefined, channelType: undefined }
    resetChannelSearchParams()
    handleChannelSearch()
  }

  function editChannel(row: AlertChannelItem) {
    channelEditId.value = row.id
    channelDrawerVisible.value = true
  }

  async function deleteChannel(row: AlertChannelItem) {
    await confirmDelete(
      `确定删除通知渠道「${row.name}」吗？`,
      () => fetchDeleteAlertChannel(row.id),
      refreshChannelData
    )
  }

  // ---------- Silences ----------
  const silenceSearch = ref({ nameSelector: undefined as string | undefined })
  const silenceDrawerVisible = ref(false)
  const silenceEditId = ref<number | undefined>()
  const silencePresetRuleId = ref<number | undefined>()
  const selectedSilences = ref<AlertSilenceItem[]>([])

  const {
    columns: silenceColumns,
    columnChecks: silenceColumnChecks,
    data: silenceData,
    loading: silenceLoading,
    pagination: silencePagination,
    getData: getSilenceData,
    replaceSearchParams: replaceSilenceSearchParams,
    resetSearchParams: resetSilenceSearchParams,
    handleSizeChange: handleSilenceSizeChange,
    handleCurrentChange: handleSilenceCurrentChange,
    refreshData: refreshSilenceData
  } = useTable({
    core: {
      immediate: initialTab === 'silences',
      apiFn: fetchGetAlertSilenceList,
      apiParams: { current: 1, size: 10, ...silenceSearch.value },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'name',
          label: '名称',
          minWidth: 180,
          formatter: (row: AlertSilenceItem) => h('span', { style: { fontSize: '12px' } }, row.name)
        },
        {
          prop: 'silenceStatus',
          label: '状态',
          width: 96,
          formatter: (row: AlertSilenceItem) => {
            const meta = resolveSilenceStatus(row)
            return h(ElTag, { size: 'small', type: meta.type }, () => meta.label)
          }
        },
        {
          prop: 'matchLabels',
          label: '静默规则',
          minWidth: 220,
          formatter: (row: AlertSilenceItem) => renderSilenceMatchLabels(row.matchLabels)
        },
        {
          prop: 'startsAt',
          label: '开始时间',
          minWidth: 180,
          formatter: (row: AlertSilenceItem) => renderDateTime(row.startsAt)
        },
        {
          prop: 'endsAt',
          label: '结束时间',
          minWidth: 180,
          formatter: (row: AlertSilenceItem) => renderDateTime(row.endsAt)
        },
        {
          prop: 'enabledSwitch',
          label: '启用',
          width: 120,
          align: 'center',
          formatter: (row: AlertSilenceItem) =>
            h(ElSwitch, {
              modelValue: row.enabled,
              size: 'small',
              onChange: (value) => toggleSilenceEnabled(row, Boolean(value))
            })
        },
        {
          prop: 'createdBy',
          label: '最后更新人',
          minWidth: 120,
          formatter: (row: AlertSilenceItem) =>
            h('span', { style: { fontSize: '12px' } }, row.createdBy || '-')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: AlertSilenceItem) => renderCrudLinks(row, editSilence, deleteSilence)
        }
      ]
    }
  })

  function handleSilenceSearch() {
    replaceSilenceSearchParams({ ...silenceSearch.value })
    getSilenceData()
  }

  function resolveSilenceStatus(row: AlertSilenceItem): {
    label: string
    type: 'success' | 'warning' | 'info' | 'danger'
  } {
    if (!row.enabled) {
      return { label: '已关闭', type: 'info' }
    }
    const now = Date.now()
    const startsAt = new Date(row.startsAt).getTime()
    const endsAt = new Date(row.endsAt).getTime()
    if (Number.isFinite(startsAt) && now < startsAt) {
      return { label: '未开始', type: 'warning' }
    }
    if (Number.isFinite(endsAt) && now > endsAt) {
      return { label: '已失效', type: 'info' }
    }
    return { label: '生效中', type: 'success' }
  }

  function renderSilenceMatchLabels(raw?: string) {
    if (!raw?.trim()) {
      return h('span', { style: { fontSize: '11px' } }, '-')
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const entries = Object.entries(parsed).filter(([key]) => key.trim())
      if (!entries.length) {
        return h('span', { style: { fontSize: '11px' } }, '-')
      }
      return h(
        'div',
        {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2px',
            alignItems: 'center'
          }
        },
        entries.map(([key, value]) =>
          h(
            ElTag,
            { size: 'small', style: { margin: '1px 2px', fontSize: '11px' } },
            () => `${key}=${value == null ? '' : String(value)}`
          )
        )
      )
    } catch {
      return h('span', { style: { fontSize: '11px' } }, raw)
    }
  }

  function handleSilenceSelectionChange(rows: AlertSilenceItem[]) {
    selectedSilences.value = rows
  }

  function resetSilenceSearch() {
    silenceSearch.value.nameSelector = undefined
    resetSilenceSearchParams()
    handleSilenceSearch()
  }

  function editSilence(row: AlertSilenceItem) {
    silencePresetRuleId.value = undefined
    silenceEditId.value = row.id
    silenceDrawerVisible.value = true
  }

  async function toggleSilenceEnabled(row: AlertSilenceItem, enabled: boolean) {
    try {
      await fetchUpdateAlertSilence(row.id, { resource_version: row.resourceVersion, enabled })
      ElMessage.success(enabled ? '已启用' : '已停用')
      refreshSilenceData()
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '更新失败')
      }
      refreshSilenceData()
    }
  }

  async function deleteSilence(row: AlertSilenceItem) {
    await confirmDelete(
      `确定删除告警静默「${row.name}」吗？`,
      () => fetchDeleteAlertSilence(row.id),
      refreshSilenceData
    )
  }

  // ---------- Events ----------
  const eventSearch = ref({
    ruleId: undefined as string | undefined,
    status: undefined as number | undefined
  })
  const eventStatusVisible = ref(false)
  const currentEvents = ref<AlertEventItem[]>([])
  const selectedEvents = ref<AlertEventItem[]>([])

  const {
    columns: eventColumns,
    columnChecks: eventColumnChecks,
    data: eventData,
    loading: eventLoading,
    pagination: eventPagination,
    getData: getEventData,
    replaceSearchParams: replaceEventSearchParams,
    resetSearchParams: resetEventSearchParams,
    handleSizeChange: handleEventSizeChange,
    handleCurrentChange: handleEventCurrentChange,
    refreshData: refreshEventData
  } = useTable({
    core: {
      immediate: initialTab === 'events',
      apiFn: (params) =>
        fetchGetAlertEventList({
          current: params.current,
          size: params.size,
          ruleId: params.ruleId ? Number(params.ruleId) : undefined,
          status: params.status
        }),
      apiParams: { current: 1, size: 10, ...eventSearch.value },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'ruleName',
          label: '规则',
          minWidth: 120,
          formatter: (row: AlertEventItem) =>
            h('span', { style: { fontSize: '12px' } }, row.ruleName || '-')
        },
        {
          prop: 'status',
          label: '状态',
          width: 96,
          formatter: (row: AlertEventItem) => {
            const meta = AlertEventStatusMap[row.status]
            return h(ElTag, { size: 'small', type: meta?.type || 'info' }, () => meta?.label || '-')
          }
        },
        {
          prop: 'severity',
          label: '级别',
          width: 88,
          formatter: (row: AlertEventItem) => {
            const meta = AlertSeverityMap[row.severity]
            return h(ElTag, { size: 'small', type: meta?.type || 'info' }, () => meta?.label || '-')
          }
        },
        {
          prop: 'notifyCurNumber',
          label: '触发次数',
          width: 88,
          formatter: (row: AlertEventItem) =>
            h('span', { style: { fontSize: '12px' } }, String(row.notifyCurNumber ?? 0))
        },
        {
          prop: 'gmtCreate',
          label: '触发时间',
          minWidth: 180,
          formatter: (row: AlertEventItem) => renderDateTime(row.gmtCreate)
        },
        {
          prop: 'lastSentAt',
          label: '最后发送',
          minWidth: 120,
          formatter: (row: AlertEventItem) => renderDateTime(row.lastSentAt)
        },
        {
          prop: 'operation',
          label: '操作',
          width: 88,
          fixed: 'right',
          formatter: (row: AlertEventItem) =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () => openEventStatusDialog(row)
              },
              () => '更新状态'
            )
        }
      ]
    }
  })

  function handleEventSearch() {
    replaceEventSearchParams({ ...eventSearch.value })
    getEventData()
  }

  function resetEventSearch() {
    eventSearch.value = { ruleId: undefined, status: undefined }
    resetEventSearchParams()
    handleEventSearch()
  }

  function handleEventSelectionChange(rows: AlertEventItem[]) {
    selectedEvents.value = rows
  }

  function openEventStatusDialog(row: AlertEventItem) {
    currentEvents.value = [row]
    eventStatusVisible.value = true
  }

  function handleBatchProcessEvents() {
    if (!selectedEvents.value.length) {
      ElMessage.warning('请先勾选要处理的告警事件')
      return
    }
    currentEvents.value = [...selectedEvents.value]
    eventStatusVisible.value = true
  }

  // ---------- Notifications ----------
  const notificationSearch = ref({ nameSelector: undefined as string | undefined })

  const selectedNotifications = ref<AlertNotificationItem[]>([])

  const {
    columns: notificationColumns,
    columnChecks: notificationColumnChecks,
    data: notificationData,
    loading: notificationLoading,
    pagination: notificationPagination,
    getData: getNotificationData,
    replaceSearchParams: replaceNotificationSearchParams,
    resetSearchParams: resetNotificationSearchParams,
    handleSizeChange: handleNotificationSizeChange,
    handleCurrentChange: handleNotificationCurrentChange,
    refreshData: refreshNotificationData
  } = useTable({
    core: {
      immediate: initialTab === 'notifications',
      apiFn: (params) =>
        fetchGetAlertNotificationList({
          current: params.current,
          size: params.size,
          nameSelector: params.nameSelector
        }),
      apiParams: { current: 1, size: 10, ...notificationSearch.value },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'title',
          label: '标题',
          minWidth: 120,
          showOverflowTooltip: true,
          formatter: (row: AlertNotificationItem) =>
            h('span', { style: { fontSize: '12px' } }, row.title || '-')
        },
        {
          prop: 'severity',
          label: '级别',
          width: 88,
          formatter: (row: AlertNotificationItem) => {
            const meta = AlertSeverityMap[row.severity]
            return h(ElTag, { size: 'small', type: meta?.type || 'info' }, () => meta?.label || '-')
          }
        },
        {
          prop: 'labels',
          label: '标签',
          minWidth: 220,
          formatter: (row: AlertNotificationItem) => renderNotificationLabels(row.labels)
        },
        {
          prop: 'channelName',
          label: '通知渠道',
          width: 120,
          formatter: (row: AlertNotificationItem) =>
            row.channelName
              ? h(ElTag, { size: 'small', style: { fontSize: '11px' } }, () => row.channelName)
              : h('span', { style: { fontSize: '11px' } }, '-')
        },
        {
          prop: 'gmtCreate',
          label: '告警时间',
          minWidth: 100,
          formatter: (row: AlertNotificationItem) => renderDateTime(row.gmtCreate)
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: AlertNotificationItem) => renderNotificationOperationLinks(row)
        }
      ]
    }
  })

  function handleNotificationSearch() {
    replaceNotificationSearchParams({ ...notificationSearch.value })
    getNotificationData()
  }

  function handleNotificationSelectionChange(rows: AlertNotificationItem[]) {
    selectedNotifications.value = rows
  }

  function handleSilenceNotification() {
    const ruleId = selectedNotifications.value[0]?.ruleId
    if (!ruleId) return
    silencePresetRuleId.value = ruleId
    silenceEditId.value = undefined
    silenceDrawerVisible.value = true
  }

  async function handleDeleteNotifications() {
    const ids = selectedNotifications.value.map((n) => n.id)
    if (!ids.length) return
    ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条告警历史记录吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      beforeClose: async (action, instance, done) => {
        if (action !== 'confirm') {
          done()
          return
        }
        instance.confirmButtonLoading = true
        let failed = 0
        for (const id of ids) {
          try {
            await fetchDeleteAlertNotification(id)
          } catch {
            failed++
          }
        }
        instance.confirmButtonLoading = false
        if (failed > 0) {
          ElMessage.warning(`删除完成，${failed} 条失败`)
        } else {
          ElMessage.success('删除成功')
        }
        refreshNotificationData()
        done()
      }
    })
  }

  function renderNotificationLabels(raw?: string) {
    if (!raw?.trim()) {
      return h('span', { style: { fontSize: '11px' } }, '-')
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const entries = Object.entries(parsed).filter(([key]) => key.trim())
      if (!entries.length) {
        return h('span', { style: { fontSize: '11px' } }, '-')
      }
      return h(
        'div',
        {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2px',
            alignItems: 'center'
          }
        },
        entries.map(([key, value]) =>
          h(
            ElTag,
            {
              size: 'small',
              type: 'info',
              style: { margin: '1px 2px', fontSize: '11px', color: '#606266' }
            },
            () => `${key}=${value == null ? '' : String(value)}`
          )
        )
      )
    } catch {
      return h('span', { style: { fontSize: '11px' } }, raw)
    }
  }

  function resetNotificationSearch() {
    notificationSearch.value.nameSelector = undefined
    resetNotificationSearchParams()
    handleNotificationSearch()
  }

  // ---------- Shared ----------

  function loadTabData(tab: AlertTab) {
    if (tab === 'rules') {
      getRuleData()
      return
    }
    if (tab === 'channels') {
      getChannelData()
      return
    }
    if (tab === 'silences') {
      getSilenceData()
      return
    }
    if (tab === 'events') {
      getEventData()
      return
    }
    getNotificationData()
  }

  function handleTabChange(name: string | number) {
    const tab = name as AlertTab
    activeTab.value = tab
    router.replace({ query: { ...route.query, tab } })
    loadTabData(tab)
  }

  function handleCreate() {
    if (activeTab.value === 'rules') {
      ruleEditId.value = undefined
      ruleCloneId.value = undefined
      ruleDrawerVisible.value = true
    } else if (activeTab.value === 'channels') {
      channelEditId.value = undefined
      channelDrawerVisible.value = true
    } else if (activeTab.value === 'silences') {
      silenceEditId.value = undefined
      silencePresetRuleId.value = undefined
      silenceDrawerVisible.value = true
    }
  }

  function renderRuleOperationLinks(row: AlertRuleItem) {
    return h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap' }, [
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => editRule(row)
        },
        () => '编辑'
      ),
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => cloneRule(row)
        },
        () => '克隆'
      ),
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => silenceFromRule(row)
        },
        () => '静默'
      ),
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => deleteRule(row)
        },
        () => '删除'
      )
    ])
  }

  function renderNotificationOperationLinks(row: AlertNotificationItem) {
    return h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap' }, [
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => silenceFromNotification(row)
        },
        () => '静默'
      ),
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => deleteNotification(row)
        },
        () => '删除'
      )
    ])
  }

  function renderCrudLinks<T extends { name: string }>(
    row: T,
    onEdit: (row: T) => void,
    onDelete: (row: T) => void
  ) {
    return h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap' }, [
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => onEdit(row)
        },
        () => '编辑'
      ),
      h(
        ElLink,
        {
          type: 'primary',
          underline: 'never',
          style: 'font-size:12px',
          onClick: () => onDelete(row)
        },
        () => '删除'
      )
    ])
  }

  async function confirmDelete(message: string, action: () => Promise<void>, refresh: () => void) {
    try {
      await ElMessageBox.confirm(message, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await action()
      ElMessage.success('删除成功')
      refresh()
    } catch (error) {
      if (error !== 'cancel' && (!(error instanceof PixiuApiError) || !error.notified)) {
        ElMessage.error(error instanceof Error ? error.message : '删除失败')
      }
    }
  }
</script>

<style lang="scss" scoped>
  .alert-config-page :deep(.art-table-card) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .alert-config-page :deep(.art-table-card > .el-card__body) {
    padding-top: 8px;
    padding-bottom: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .alert-config-page :deep(.alert-tabs) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .alert-config-page :deep(.alert-tabs .el-tabs__header) {
    margin: 0 0 4px;
    flex-shrink: 0;
  }

  .alert-config-page :deep(.alert-tabs .el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }

  .alert-config-page :deep(.alert-tabs .el-tabs__item) {
    height: 40px;
    line-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .alert-config-page :deep(.alert-tabs .el-tabs__item.is-active) {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .alert-config-page :deep(.alert-tabs .el-tabs__active-bar) {
    height: 2px;
    border-radius: 2px 2px 0 0;
  }

  .alert-config-page :deep(.alert-tabs .el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .alert-config-page :deep(.alert-tabs .el-tab-pane) {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    box-sizing: border-box;
  }

  .alert-config-page :deep(.alert-tabs .art-table) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto !important;
    overflow: visible;
  }

  .alert-config-page :deep(.alert-tabs .art-table .el-table) {
    flex: 1 1 0;
    min-height: 0;
    height: 100% !important;
  }

  .alert-config-page :deep(.custom-pagination) {
    flex: 0 0 auto;
    margin-top: 10px;
    margin-bottom: 0;
    padding-bottom: 4px;
    box-sizing: border-box;
  }

  .alert-config-page :deep(.el-pagination) {
    padding: 0;
  }

  .alert-config-page :deep(.el-table th),
  .alert-config-page :deep(.el-table td) {
    font-size: 12px;
  }

  .alert-toolbar-outer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-shrink: 0;
  }

  .alert-toolbar-outer--no-alert {
    margin-top: 10px;
  }

  .alert-toolbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .alert-toolbar__search {
    width: 280px;
  }

  .alert-toolbar__search--short {
    width: 160px;
  }

  .alert-toolbar__filter {
    width: 130px;
  }

  .quota-alert {
    flex-shrink: 0;
  }

  .alert-config-page :deep(.alert-channel-name-cell) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    max-width: 100%;
  }

  .alert-config-page :deep(.alert-channel-name-cell__text) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
