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
      <ElButton v-if="activeTabHasCreate" v-ripple @click="handleCreate">{{ createButtonText }}</ElButton>
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
            placeholder="严重级别"
            class="alert-toolbar__filter"
            @change="handleRuleSearch"
          >
            <ElOption v-for="(meta, value) in AlertSeverityMap" :key="value" :label="meta.label" :value="Number(value)" />
          </ElSelect>
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
            <ElOption v-for="(label, value) in AlertChannelTypeMap" :key="value" :label="label" :value="Number(value)" />
          </ElSelect>
        </template>

        <template v-else-if="activeTab === 'silences'">
          <ElInput
            v-model="silenceSearch.nameSelector"
            clearable
            placeholder="静默规则名称"
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
            <ElOption v-for="(meta, value) in AlertEventStatusMap" :key="value" :label="meta.label" :value="Number(value)" />
          </ElSelect>
        </template>

        <template v-else-if="activeTab === 'notifications'">
          <ElInput
            v-model="notificationSearch.ruleId"
            clearable
            placeholder="规则 ID"
            class="alert-toolbar__search--short"
            @keyup.enter="handleNotificationSearch"
            @clear="resetNotificationSearch"
          />
          <ElInput
            v-model="notificationSearch.eventId"
            clearable
            placeholder="事件 ID"
            class="alert-toolbar__search--short"
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

        <ElTabPane label="静默规则" name="silences">
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
          />
        </ElTabPane>

        <ElTabPane label="通知记录" name="notifications">
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
          />
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <AlertRuleDrawer v-model="ruleDrawerVisible" :edit-id="ruleEditId" @success="refreshRuleData" />
    <AlertChannelDrawer v-model="channelDrawerVisible" :edit-id="channelEditId" @success="refreshChannelData" />
    <AlertSilenceDrawer v-model="silenceDrawerVisible" :edit-id="silenceEditId" @success="refreshSilenceData" />
    <AlertEventStatusDialog v-model="eventStatusVisible" :event-data="currentEvent" @success="refreshEventData" />
  </div>
</template>

<script setup lang="ts">
  import { computed, h, ref } from 'vue'
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
    fetchDeleteAlertRule,
    fetchDeleteAlertSilence,
    fetchGetAlertChannelList,
    fetchGetAlertEventList,
    fetchGetAlertNotificationList,
    fetchGetAlertRuleList,
    fetchGetAlertSilenceList,
    fetchUpdateAlertRule,
    type AlertChannelItem,
    type AlertEventItem,
    type AlertNotificationItem,
    type AlertRuleItem,
    type AlertSilenceItem
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'
  import AlertRuleDrawer from './alert-config/modules/alert-rule-drawer.vue'
  import AlertChannelDrawer from './alert-config/modules/alert-channel-drawer.vue'
  import AlertSilenceDrawer from './alert-config/modules/alert-silence-drawer.vue'
  import AlertEventStatusDialog from './alert-config/modules/alert-event-status-dialog.vue'

  defineOptions({ name: 'AlertConfig' })

  type AlertTab = 'rules' | 'channels' | 'silences' | 'events' | 'notifications'

  const activeTab = ref<AlertTab>('rules')
  const descriptionAlertVisible = ref(true)
  const tablePaginationOptions = { align: 'right' as const, hideOnEmpty: false }

  function renderDateTime(value?: string) {
    const text = formatAlertDateTime(value) || value || '-'
    return h('span', { style: { fontSize: '12px' } }, text)
  }

  const tabDescriptions: Record<AlertTab, string> = {
    rules: '管理告警规则，配置触发条件、评估间隔和通知渠道。规则更新后约 9 秒内自动生效。',
    channels: '管理通知渠道配置，支持邮件、钉钉、企业微信和 Webhook。',
    silences: '配置静默规则，在指定时间段内抑制匹配的告警通知。',
    events: '查看引擎产生的告警事件，可手动更新事件状态（确认/解决等）。',
    notifications: '查看告警通知发送记录，包含发送状态与失败原因。'
  }

  const tabDescription = computed(() => tabDescriptions[activeTab.value])

  const activeTabHasCreate = computed(() => ['rules', 'channels', 'silences'].includes(activeTab.value))

  const createButtonText = computed(() => {
    if (activeTab.value === 'rules') return '添加规则'
    if (activeTab.value === 'channels') return '添加渠道'
    if (activeTab.value === 'silences') return '添加静默'
    return '添加'
  })

  // ---------- Rules ----------
  const ruleSearch = ref({ nameSelector: undefined as string | undefined, severity: undefined as number | undefined })
  const ruleDrawerVisible = ref(false)
  const ruleEditId = ref<number | undefined>()

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
      apiFn: fetchGetAlertRuleList,
      apiParams: { current: 1, size: 10, ...ruleSearch.value },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 180,
          formatter: (row: AlertRuleItem) => h('span', { style: { fontSize: '12px' } }, row.name)
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 72,
          align: 'center',
          formatter: (row: AlertRuleItem) =>
            h(ElSwitch, {
              modelValue: row.enabled,
              size: 'small',
              onChange: (value) => toggleRuleEnabled(row, Boolean(value))
            })
        },
        {
          prop: 'ruleType',
          label: '类型',
          width: 80,
          formatter: (row: AlertRuleItem) =>
            h('span', { style: { fontSize: '12px' } }, AlertRuleTypeMap[row.ruleType] || '-')
        },
        {
          prop: 'severity',
          label: '级别',
          width: 88,
          formatter: (row: AlertRuleItem) => {
            const meta = AlertSeverityMap[row.severity]
            return h(ElTag, { size: 'small', type: meta?.type || 'info' }, () => meta?.label || '-')
          }
        },
        {
          prop: 'scopeType',
          label: '范围',
          width: 88,
          formatter: (row: AlertRuleItem) =>
            h('span', { style: { fontSize: '12px' } }, AlertScopeTypeMap[row.scopeType] || '-')
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
          prop: 'gmtModified',
          label: '更新时间',
          minWidth: 180,
          formatter: (row: AlertRuleItem) => renderDateTime(row.gmtModified)
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: AlertRuleItem) => renderCrudLinks(row, editRule, deleteRule)
        }
      ]
    }
  })

  function handleRuleSearch() {
    replaceRuleSearchParams({ ...ruleSearch.value })
    getRuleData()
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
    ruleEditId.value = row.id
    ruleDrawerVisible.value = true
  }

  async function deleteRule(row: AlertRuleItem) {
    await confirmDelete(`确定删除告警规则「${row.name}」吗？`, () => fetchDeleteAlertRule(row.id), refreshRuleData)
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
      apiFn: fetchGetAlertChannelList,
      apiParams: { current: 1, size: 10, ...channelSearch.value },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 160,
          formatter: (row: AlertChannelItem) => h('span', { style: { fontSize: '12px' } }, row.name)
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
          formatter: (row: AlertChannelItem) => h('span', { style: { fontSize: '12px' } }, row.description || '-')
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
    await confirmDelete(`确定删除通知渠道「${row.name}」吗？`, () => fetchDeleteAlertChannel(row.id), refreshChannelData)
  }

  // ---------- Silences ----------
  const silenceSearch = ref({ nameSelector: undefined as string | undefined })
  const silenceDrawerVisible = ref(false)
  const silenceEditId = ref<number | undefined>()

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
      apiFn: fetchGetAlertSilenceList,
      apiParams: { current: 1, size: 10, ...silenceSearch.value },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 160,
          formatter: (row: AlertSilenceItem) => h('span', { style: { fontSize: '12px' } }, row.name)
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 88,
          formatter: (row: AlertSilenceItem) =>
            h(ElTag, { size: 'small', type: row.enabled ? 'success' : 'info' }, () =>
              row.enabled ? '启用' : '停用'
            )
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
          prop: 'gmtCreate',
          label: '创建时间',
          minWidth: 180,
          formatter: (row: AlertSilenceItem) => renderDateTime(row.gmtCreate)
        },
        {
          prop: 'gmtModified',
          label: '更新时间',
          minWidth: 180,
          formatter: (row: AlertSilenceItem) => renderDateTime(row.gmtModified)
        },
        {
          prop: 'comment',
          label: '备注',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row: AlertSilenceItem) => h('span', { style: { fontSize: '12px' } }, row.comment || '-')
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

  function resetSilenceSearch() {
    silenceSearch.value.nameSelector = undefined
    resetSilenceSearchParams()
    handleSilenceSearch()
  }

  function editSilence(row: AlertSilenceItem) {
    silenceEditId.value = row.id
    silenceDrawerVisible.value = true
  }

  async function deleteSilence(row: AlertSilenceItem) {
    await confirmDelete(`确定删除静默规则「${row.name}」吗？`, () => fetchDeleteAlertSilence(row.id), refreshSilenceData)
  }

  // ---------- Events ----------
  const eventSearch = ref({ ruleId: undefined as string | undefined, status: undefined as number | undefined })
  const eventStatusVisible = ref(false)
  const currentEvent = ref<AlertEventItem | null>(null)

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
      apiFn: (params) =>
        fetchGetAlertEventList({
          current: params.current,
          size: params.size,
          ruleId: params.ruleId ? Number(params.ruleId) : undefined,
          status: params.status
        }),
      apiParams: { current: 1, size: 10, ...eventSearch.value },
      columnsFactory: () => [
        {
          prop: 'ruleName',
          label: '规则',
          minWidth: 140,
          formatter: (row: AlertEventItem) => h('span', { style: { fontSize: '12px' } }, row.ruleName || '-')
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
          prop: 'triggerValue',
          label: '触发值',
          minWidth: 120,
          formatter: (row: AlertEventItem) => h('span', { style: { fontSize: '12px' } }, row.triggerValue || '-')
        },
        {
          prop: 'resourceName',
          label: '资源',
          minWidth: 160,
          formatter: (row: AlertEventItem) =>
            h('span', { style: { fontSize: '12px' } }, row.resourceName ? `${row.resourceNamespace}/${row.resourceName}` : '-')
        },
        {
          prop: 'gmtCreate',
          label: '触发时间',
          minWidth: 180,
          formatter: (row: AlertEventItem) => renderDateTime(row.gmtCreate)
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

  function openEventStatusDialog(row: AlertEventItem) {
    currentEvent.value = row
    eventStatusVisible.value = true
  }

  // ---------- Notifications ----------
  const notificationSearch = ref({
    ruleId: undefined as string | undefined,
    eventId: undefined as string | undefined
  })

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
      apiFn: (params) =>
        fetchGetAlertNotificationList({
          current: params.current,
          size: params.size,
          ruleId: params.ruleId ? Number(params.ruleId) : undefined,
          eventId: params.eventId ? Number(params.eventId) : undefined
        }),
      apiParams: { current: 1, size: 10, ...notificationSearch.value },
      columnsFactory: () => [
        {
          prop: 'ruleId',
          label: '规则 ID',
          width: 88,
          formatter: (row: AlertNotificationItem) => h('span', { style: { fontSize: '12px' } }, String(row.ruleId))
        },
        {
          prop: 'eventId',
          label: '事件 ID',
          width: 88,
          formatter: (row: AlertNotificationItem) => h('span', { style: { fontSize: '12px' } }, String(row.eventId))
        },
        {
          prop: 'channel',
          label: '渠道',
          width: 100,
          formatter: (row: AlertNotificationItem) =>
            h('span', { style: { fontSize: '12px' } }, AlertChannelTypeMap[row.channel] || '-')
        },
        {
          prop: 'title',
          label: '标题',
          minWidth: 180,
          showOverflowTooltip: true,
          formatter: (row: AlertNotificationItem) => h('span', { style: { fontSize: '12px' } }, row.title || '-')
        },
        {
          prop: 'status',
          label: '状态',
          width: 96,
          formatter: (row: AlertNotificationItem) => {
            const meta = AlertNotificationStatusMap[row.status]
            return h(ElTag, { size: 'small', type: meta?.type || 'info' }, () => meta?.label || '-')
          }
        },
        {
          prop: 'errorMsg',
          label: '错误信息',
          minWidth: 180,
          showOverflowTooltip: true,
          formatter: (row: AlertNotificationItem) => h('span', { style: { fontSize: '12px' } }, row.errorMsg || '-')
        },
        {
          prop: 'gmtCreate',
          label: '发送时间',
          minWidth: 180,
          formatter: (row: AlertNotificationItem) => renderDateTime(row.gmtCreate)
        }
      ]
    }
  })

  function handleNotificationSearch() {
    replaceNotificationSearchParams({ ...notificationSearch.value })
    getNotificationData()
  }

  function resetNotificationSearch() {
    notificationSearch.value = { ruleId: undefined, eventId: undefined }
    resetNotificationSearchParams()
    handleNotificationSearch()
  }

  // ---------- Shared ----------

  function handleTabChange(name: string | number) {
    activeTab.value = name as AlertTab
  }

  function handleCreate() {
    if (activeTab.value === 'rules') {
      ruleEditId.value = undefined
      ruleDrawerVisible.value = true
    } else if (activeTab.value === 'channels') {
      channelEditId.value = undefined
      channelDrawerVisible.value = true
    } else if (activeTab.value === 'silences') {
      silenceEditId.value = undefined
      silenceDrawerVisible.value = true
    }
  }

  function renderCrudLinks<T extends { name: string }>(
    row: T,
    onEdit: (row: T) => void,
    onDelete: (row: T) => void
  ) {
    return h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap' }, [
      h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => onEdit(row) }, () => '编辑'),
      h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => onDelete(row) }, () => '删除')
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
    width: 220px;
  }

  .alert-toolbar__search--short {
    width: 120px;
  }

  .alert-toolbar__filter {
    width: 130px;
  }

  .quota-alert {
    flex-shrink: 0;
  }
</style>
