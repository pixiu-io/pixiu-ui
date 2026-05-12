<template>
  <div class="workloads-page">
    <ElCard class="art-table-card">
      <ElTabs v-model="kind" class="workloads-tabs">
        <!-- ── Deployment Tab ── -->
        <ElTabPane :label="deployTabLabel" name="deploy">
          <ArtTableHeader
            v-model:columns="deplColumnChecks"
            :loading="deplLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onDeplRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton
                  v-if="isDeployPodMode"
                  v-ripple
                  :disabled="deplSelectedRows.length === 0"
                  :loading="deplBatchDeleting"
                  @click="batchDeletePods"
                >
                  销毁重建
                </ElButton>
                <ElButton v-if="props.showDeployCreate" v-ripple @click="openCreateDialog">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <span
                    v-if="isDeployPodMode && !props.deployNamespace"
                    class="workloads-toolbar__ns-label"
                  >
                    命名空间:
                  </span>
                  <ElSelect
                    v-if="isDeployPodMode && !props.deployNamespace"
                    v-model="deplNamespace"
                    placeholder="所有命名空间"
                    class="workloads-toolbar__namespace"
                    :fit-input-width="true"
                    popper-class="workloads-toolbar__namespace-popper"
                    @change="onDeplNamespaceChange"
                  >
                    <template #label="{ label, value }">
                      <span style="display:inline-flex;align-items:center;gap:4px">
                        <span style="font-size:13px;color:#C7C7D1">{{ label }}</span>
                        <span v-if="isSystemNamespace(String(value || ''))" class="workloads-ns-system-tag"
                          >系统</span
                        >
                      </span>
                    </template>
                    <ElOption label="所有命名空间" value="" />
                    <ElOption v-for="ns in nsOptions" :key="ns" :label="ns" :value="ns">
                      <span style="display:inline-flex;align-items:center;gap:0">
                        <span class="workloads-ns-option-name">{{ ns }}</span>
                        <span v-if="isSystemNamespace(ns)" class="workloads-ns-system-tag">系统</span>
                      </span>
                    </ElOption>
                  </ElSelect>
                  <ElInput
                    v-model="deplSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runDeplSearch"
                    @clear="runDeplSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forceDeplSearch"
                    @keyup.enter="forceDeplSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="deplLoading"
            :data="deplData"
            :columns="deplVisibleColumns"
            :pagination="deplPagination"
            :pagination-options="{ align: 'right' }"
            @selection-change="onDeplSelectionChange"
            @pagination:size-change="deplHandleSizeChange"
            @pagination:current-change="deplHandleCurrentChange"
            @sort-change="onDeplSortChange"
          />
        </ElTabPane>

        <!-- ── StatefulSet Tab ── -->
        <ElTabPane v-if="props.showStsTab" :label="stsTabLabel" name="sts">
          <ArtTableHeader
            v-model:columns="stsColumnChecks"
            :loading="stsLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onStsRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="goCreateSts">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="stsSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runStsSearch"
                    @clear="runStsSearch"
                  />
                  <div class="workloads-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceStsSearch" @keyup.enter="forceStsSearch">
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>
          <ArtTable
            row-key="rowKey"
            :loading="stsLoading"
            :data="stsData"
            :columns="stsVisibleColumns"
            :pagination="stsPagination"
            :pagination-options="{ align: 'right' }"
            @pagination:size-change="stsHandleSizeChange"
            @pagination:current-change="stsHandleCurrentChange"
            @sort-change="onStsSortChange"
          />
        </ElTabPane>

        <!-- ── DaemonSet Tab ── -->
        <ElTabPane v-if="props.showDsTab && props.dsDataMode !== 'logs'" :label="dsTabLabel" name="ds">
          <ArtTableHeader
            v-model:columns="dsColumnChecks"
            :loading="dsLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onDsRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="goCreateDs">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="dsSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runDsSearch"
                    @clear="runDsSearch"
                  />
                  <div class="workloads-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceDsSearch" @keyup.enter="forceDsSearch">
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>
          <ArtTable
            row-key="rowKey"
            :loading="dsLoading"
            :data="dsData"
            :columns="dsVisibleColumns"
            :pagination="dsPagination"
            :pagination-options="{ align: 'right' }"
            @pagination:size-change="dsHandleSizeChange"
            @pagination:current-change="dsHandleCurrentChange"
            @sort-change="onDsSortChange"
          />
        </ElTabPane>

        <!-- ── Job Tab ── -->
        <ElTabPane v-if="props.showJobTab" :label="jobTabLabel" name="job">
          <ArtTableHeader
            v-model:columns="jobColumnChecks"
            :loading="jobLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onJobRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton
                  v-if="props.jobDataMode === 'events'"
                  type="danger"
                  plain
                  :disabled="jobSelectedRows.length === 0"
                  @click="batchDeleteMirrorEvents"
                >
                  批量删除
                </ElButton>
                <ElButton v-else v-ripple @click="goCreateJob">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElSelect
                    v-if="props.jobDataMode === 'events'"
                    v-model="jobSearchForm.type"
                    clearable
                    placeholder="全部类型"
                    class="workloads-toolbar__type"
                    @change="runJobSearch"
                    @clear="runJobSearch"
                  >
                    <ElOption label="Normal" value="Normal" />
                    <ElOption label="Warning" value="Warning" />
                    <ElOption label="Unknown" value="Unknown" />
                  </ElSelect>
                  <ElInput
                    v-else
                    v-model="jobSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runJobSearch"
                    @clear="runJobSearch"
                  />
                  <div class="workloads-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceJobSearch" @keyup.enter="forceJobSearch">
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>
          <ArtTable
            row-key="rowKey"
            :loading="jobLoading"
            :data="jobData"
            :columns="jobVisibleColumns"
            :pagination="jobPagination"
            :pagination-options="{ align: 'right' }"
            @selection-change="onJobSelectionChange"
            @pagination:size-change="jobHandleSizeChange"
            @pagination:current-change="jobHandleCurrentChange"
            @sort-change="onJobSortChange"
          />
        </ElTabPane>

        <!-- ── CronJob Tab ── -->
        <ElTabPane v-if="props.showCjTab" :label="cjTabLabel" name="cj">
          <ArtTableHeader
            v-model:columns="cjColumnChecks"
            :loading="cjLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onCjRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-if="props.cjDataMode !== 'history'" v-ripple @click="goCreateCronJob">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="cjSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runCjSearch"
                    @clear="runCjSearch"
                  />
                  <div class="workloads-toolbar-search-btn" role="button" tabindex="0" title="搜索" @click="forceCjSearch" @keyup.enter="forceCjSearch">
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>
          <ArtTable
            row-key="rowKey"
            :loading="cjLoading"
            :data="cjData"
            :columns="cjVisibleColumns"
            :pagination="cjPagination"
            :pagination-options="{ align: 'right' }"
            @pagination:size-change="cjHandleSizeChange"
            @pagination:current-change="cjHandleCurrentChange"
            @sort-change="onCjSortChange"
          />
        </ElTabPane>

        <ElTabPane v-if="props.showNodeStatusTab" label="状态" name="nodeStatus">
          <ElTable
            :data="props.nodeStatusRows"
            size="small"
            stripe
            class="workloads-extra-table"
          >
            <ElTableColumn prop="type" label="类型" min-width="170" />
            <ElTableColumn prop="status" label="状态" width="90" />
            <ElTableColumn prop="lastHeartbeatTime" label="最近心跳" width="170" />
            <ElTableColumn prop="lastTransitionTime" label="最近更改" width="170" />
            <ElTableColumn prop="reason" label="内容" min-width="180" show-overflow-tooltip />
            <ElTableColumn prop="message" label="信息" min-width="260" show-overflow-tooltip />
          </ElTable>
        </ElTabPane>

        <ElTabPane v-if="props.showNodeResourceTab" label="资源分配" name="nodeResource">
          <div class="workloads-node-resource">
            <div class="workloads-node-resource__list">
              <div class="workloads-node-resource__head">
                <span>Resource</span>
                <span>Requests</span>
                <span>Limits</span>
              </div>
              <div
                v-for="row in props.nodeResourceRows"
                :key="row.resource"
                class="workloads-node-resource__line"
              >
                <div class="workloads-node-resource__name">{{ row.resource }}</div>
                <div class="workloads-node-resource__metric">
                  <ElProgress
                    :percentage="Math.min(100, row.requestPercent)"
                    :show-text="false"
                    :stroke-width="8"
                    color="#22c55e"
                  />
                  <span>{{ row.requestText }}</span>
                </div>
                <div class="workloads-node-resource__metric">
                  <ElProgress
                    :percentage="Math.min(100, row.limitPercent)"
                    :show-text="false"
                    :stroke-width="8"
                    color="#60a5fa"
                  />
                  <span>{{ row.limitText }}</span>
                </div>
              </div>
            </div>
          </div>
        </ElTabPane>

        <ElTabPane v-if="props.showNodeMetricsTab" label="监控指标" name="nodeMetrics">
          <div class="workloads-node-metrics">
            <div class="workloads-node-metrics__grid">
              <div class="workloads-node-metrics__item">
                <div class="workloads-node-metrics__title">CPU 使用量</div>
                <div class="workloads-node-metrics__value">{{ props.nodeMetrics.cpuUsageText }}</div>
              </div>
              <div class="workloads-node-metrics__item">
                <div class="workloads-node-metrics__title">内存使用量</div>
                <div class="workloads-node-metrics__value">{{ props.nodeMetrics.memoryUsageText }}</div>
              </div>
              <div class="workloads-node-metrics__item">
                <div class="workloads-node-metrics__title">分配情况</div>
                <div class="workloads-node-metrics__alloc">
                  <div class="workloads-node-metrics__row">
                    <span>CPU</span>
                    <span>{{ props.nodeMetrics.cpuUsageAllocText }}</span>
                  </div>
                  <ElProgress :percentage="props.nodeMetrics.cpuUsagePercent" :stroke-width="8" />
                  <div class="workloads-node-metrics__row">
                    <span>内存</span>
                    <span>{{ props.nodeMetrics.memoryUsageAllocText }}</span>
                  </div>
                  <ElProgress :percentage="props.nodeMetrics.memoryUsagePercent" :stroke-width="8" />
                </div>
              </div>
            </div>
          </div>
        </ElTabPane>

        <ElTabPane v-if="props.showDsTab && props.dsDataMode === 'logs'" :label="dsTabLabel" name="ds">
          <div class="workloads-log-toolbar">
            <div class="workloads-log-row">
              <span class="workloads-log-label">Pod选项</span>
              <ElSelect v-model="dsLogPod" class="workloads-log-select" @change="onDsLogPodChange">
                <ElOption v-for="p in dsLogPods" :key="p.metadata?.name" :label="p.metadata?.name" :value="p.metadata?.name" />
              </ElSelect>
              <ElSelect v-model="dsLogContainer" class="workloads-log-select">
                <ElOption v-for="c in dsLogContainerOptions" :key="c" :label="c" :value="c" />
              </ElSelect>
              <div
                :class="['workloads-log-refresh-icon', { 'is-spinning': dsLogRefreshing }]"
                role="button"
                tabindex="0"
                title="刷新"
                @click="loadDsLogPods"
                @keyup.enter="loadDsLogPods"
              >
                <ArtSvgIcon icon="ri:refresh-line" class="text-g-700" />
              </div>
            </div>
            <div class="workloads-log-row">
              <span class="workloads-log-label">选择行数</span>
              <ElSelect v-model="dsLogTailLines" class="workloads-log-lines">
                <ElOption :value="10" label="10" />
                <ElOption :value="25" label="25" />
                <ElOption :value="50" label="50" />
                <ElOption :value="100" label="100" />
              </ElSelect>
              <span class="workloads-log-suffix">行</span>
            </div>
            <div class="workloads-log-actions">
              <ElButton :type="dsLogMode === 'history' ? 'primary' : 'default'" plain @click="dsLogMode = 'history'">历史日志</ElButton>
              <ElButton :type="dsLogMode === 'realtime' ? 'primary' : 'default'" plain @click="dsLogMode = 'realtime'">实时日志</ElButton>
              <div class="workloads-log-search">
                <ElInput v-model="dsLogKeyword" placeholder="名称搜索关键字" clearable />
                <ElButton type="primary" :loading="dsLogLoading" @click="fetchDsLogs">查询</ElButton>
              </div>
            </div>
          </div>

          <ElTable :data="dsLogRows" v-loading="dsLogLoading" class="workloads-log-table">
            <ElTableColumn prop="lineContent" label="日志内容" />
            <template #empty>
              <div class="workloads-log-empty">暂无日志</div>
            </template>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <!-- Create Dialog -->
    <ElDialog v-model="createVisible" title="新建 Deployment" width="480px" destroy-on-close>
      <ElForm :model="createForm" label-width="80px" style="padding: 0 8px">
        <ElFormItem label="命名空间">
          <ElSelect
            v-model="createForm.namespace"
            placeholder="选择命名空间"
            style="width: 100%"
            filterable
          >
            <ElOption v-for="ns in nsOptions" :key="ns" :value="ns" :label="ns" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="名称">
          <ElInput v-model="createForm.name" placeholder="请输入 Deployment 名称" clearable />
        </ElFormItem>
        <ElFormItem label="镜像">
          <ElInput v-model="createForm.image" placeholder="例如 nginx:latest" clearable />
        </ElFormItem>
        <ElFormItem label="副本数">
          <ElInputNumber
            v-model="createForm.replicas"
            :min="0"
            :precision="0"
            controls-position="right"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="createVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="createSubmitting" @click="submitCreate">确定</ElButton>
      </template>
    </ElDialog>

    <!-- Scale Dialog -->
    <ElDialog v-model="scaleVisible" title="更新Pod数量" width="400px" destroy-on-close>
      <div class="scale-dialog-body">
        <div class="scale-info-row">
          <span class="scale-info-label">Deployment</span>
          <span class="scale-info-value">{{ scaleRow?.metadata?.name }}</span>
        </div>
        <div class="scale-info-row">
          <span class="scale-info-label">当前副本数</span>
          <span class="scale-info-value scale-info-current">{{
            scaleRow?.spec?.replicas ?? 0
          }}</span>
        </div>
        <div class="scale-info-row scale-input-row">
          <span class="scale-info-label">新副本数</span>
          <ElInputNumber
            v-model="scaleValue"
            :min="0"
            :precision="0"
            controls-position="right"
            class="scale-input"
          />
        </div>
      </div>
      <template #footer>
        <ElButton @click="scaleVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="scaleSubmitting" @click="submitScale">确定</ElButton>
      </template>
    </ElDialog>

    <K8sYamlDialog
      v-model="yamlVisible"
      :title="yamlReadonly ? '查看 YAML' : '编辑 YAML'"
      :yaml="yamlText"
      :read-only="yamlReadonly"
      :footer-mode="yamlReadonly ? 'dashboard' : 'edit'"
      confirm-text="确定"
      width="900px"
      :editor-height="520"
      :submit-loading="yamlSubmitting"
      @save="onWorkloadYamlSave"
    />

    <ElDialog
      v-model="podLoginVisible"
      title="选择容器"
      width="520px"
      destroy-on-close
      @close="resetPodLogin"
    >
      <ElAlert
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
        description="基于 WebShell 提供登录容器的功能。"
      />
      <ElForm label-width="90px">
        <ElFormItem label="容器名称">
          <ElSelect v-model="podLogin.container" class="remote-login-select">
            <ElOption
              v-for="name in podLogin.containers"
              :key="name"
              :value="name"
              :label="name"
            />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="podLoginVisible = false">取消</ElButton>
        <ElButton type="primary" @click="confirmPodRemoteLogin">确认</ElButton>
      </template>
    </ElDialog>

    <PodRemoteWebshell ref="podRemoteWebshellRef" />
  </div>
</template>

<script setup lang="ts">
  import {
    ElAlert,
    ElButton,
    ElCard,
    ElDialog,
    ElForm,
    ElFormItem,
    ElInput,
    ElInputNumber,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElOption,
    ElPopover,
    ElSelect,
    ElTag,
    ElTooltip,
    ElTabs,
    ElTabPane
  } from 'element-plus'
  import { CopyDocument, Loading } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import { computed, h, ref, watch, inject } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchK8sDeploymentList,
    fetchK8sDeployment,
    createK8sDeployment,
    deleteK8sDeployment,
    patchK8sDeployment,
    type K8sDeployment
  } from '@/api/kubernetes/deployment'
  import { deleteK8sPod, fetchK8sPod, type K8sPod } from '@/api/kubernetes/pod'
  import PodRemoteWebshell from './components/pod-remote-webshell.vue'
  import { kubeProxyAxios } from '@/api/kubeProxy'
  import {
    fetchK8sStatefulSetList,
    fetchK8sStatefulSet,
    deleteK8sStatefulSet,
    patchK8sStatefulSet,
    type K8sStatefulSet
  } from '@/api/kubernetes/statefulset'
  import {
    fetchK8sDaemonSetList,
    fetchK8sDaemonSet,
    deleteK8sDaemonSet,
    type K8sDaemonSet
  } from '@/api/kubernetes/daemonset'
  import {
    fetchK8sJobList,
    fetchK8sJob,
    deleteK8sJob,
    type K8sJob
  } from '@/api/kubernetes/job'
  import {
    fetchK8sCronJobList,
    fetchK8sCronJob,
    deleteK8sCronJob,
    patchK8sCronJob,
    type K8sCronJob
  } from '@/api/kubernetes/cronjob'
  import { fetchK8sReplicaSetList, type K8sReplicaSet } from '@/api/kubernetes/replicaset'
  import { fetchK8sServiceList, type K8sService } from '@/api/kubernetes/service'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { deleteK8sEvent, fetchKubeRawEventList } from '@/api/kubernetes/events'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { clusterDetailNamespaceKey } from './context'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'

  defineOptions({ name: 'ClusterDetailWorkloads' })
  const props = withDefaults(
    defineProps<{
      deployTabLabel?: string
      deployDataMode?: 'deployment' | 'pod'
      deployNamespace?: string
      deployLabelSelector?: string
      deployNodeName?: string
      showDeployCreate?: boolean
      stsTabLabel?: string
      dsTabLabel?: string
      jobTabLabel?: string
      cjTabLabel?: string
      showStsTab?: boolean
      showDsTab?: boolean
      showJobTab?: boolean
      showCjTab?: boolean
      showNodeStatusTab?: boolean
      showNodeResourceTab?: boolean
      showNodeMetricsTab?: boolean
      nodeStatusRows?: Array<{
        type?: string
        status?: string
        lastHeartbeatTime?: string
        lastTransitionTime?: string
        reason?: string
        message?: string
      }>
      nodeMetrics?: {
        cpuUsageText?: string
        memoryUsageText?: string
        cpuUsageAllocText?: string
        memoryUsageAllocText?: string
        cpuUsagePercent?: number
        memoryUsagePercent?: number
      }
      nodeResource?: {
        cpuPercent?: number
        memoryPercent?: number
        cpuRequested?: string
        cpuTotal?: string
        memoryRequested?: string
        memoryTotal?: string
      }
      nodeResourceRows?: Array<{
        resource: string
        requestText: string
        limitText: string
        requestPercent: number
        limitPercent: number
      }>
      stsDataMode?: 'statefulset' | 'services'
      dsDataMode?: 'daemonset' | 'containers' | 'logs'
      jobDataMode?: 'job' | 'events'
      cjDataMode?: 'cronjob' | 'history'
      mirrorNamespace?: string
      mirrorSelector?: string
      mirrorResourceName?: string
      mirrorEventKind?: string
      mirrorEventNamespaced?: boolean
      mirrorContainers?: Array<{
        name?: string
        image?: string
        resources?: {
          requests?: { cpu?: string; memory?: string }
          limits?: { cpu?: string; memory?: string }
        }
      }>
      initialTab?: string
    }>(),
    {
      deployTabLabel: 'Deployment',
      deployDataMode: 'deployment',
      deployNamespace: '',
      deployLabelSelector: '',
      deployNodeName: '',
      showDeployCreate: true,
      stsTabLabel: 'StatefulSet',
      dsTabLabel: 'DaemonSet',
      jobTabLabel: 'Job',
      cjTabLabel: 'CronJob',
      showStsTab: true,
      showDsTab: true,
      showJobTab: true,
      showCjTab: true,
      showNodeStatusTab: false,
      showNodeResourceTab: false,
      showNodeMetricsTab: false,
      nodeStatusRows: () => [],
      nodeMetrics: () => ({
        cpuUsageText: '0m',
        memoryUsageText: '0 B',
        cpuUsageAllocText: '0m / 0m (0%)',
        memoryUsageAllocText: '0 B / 0 B (0%)',
        cpuUsagePercent: 0,
        memoryUsagePercent: 0
      }),
      nodeResource: () => ({
        cpuPercent: 0,
        memoryPercent: 0,
        cpuRequested: '0',
        cpuTotal: '0',
        memoryRequested: '0',
        memoryTotal: '0'
      }),
      nodeResourceRows: () => [],
      stsDataMode: 'statefulset',
      dsDataMode: 'daemonset',
      jobDataMode: 'job',
      cjDataMode: 'cronjob',
      mirrorNamespace: '',
      mirrorSelector: '',
      mirrorResourceName: '',
      mirrorEventKind: 'Deployment',
      mirrorEventNamespaced: true,
      mirrorContainers: () => [],
      initialTab: ''
    }
  )
  const deployTabLabel = computed(() => props.deployTabLabel)
  const stsTabLabel = computed(() => props.stsTabLabel)
  const dsTabLabel = computed(() => props.dsTabLabel)
  const jobTabLabel = computed(() => props.jobTabLabel)
  const cjTabLabel = computed(() => props.cjTabLabel)

  const route = useRoute()
  const router = useRouter()
  const allowedTabs = new Set(['deploy', 'sts', 'ds', 'job', 'cj'])
  const queryTab = String(route.query.tab ?? '')
  const kind = ref(
    (allowedTabs.has(queryTab) ? queryTab : (props.initialTab || 'deploy')) as
      | 'deploy'
      | 'sts'
      | 'ds'
      | 'job'
      | 'cj'
  )
  const deplNamespace = ref('')
  function parseSelectorMap(selector: string): Record<string, string> {
    const out: Record<string, string> = {}
    selector
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [k, ...rest] = pair.split('=')
        if (!k) return
        out[k.trim()] = rest.join('=').trim()
      })
    return out
  }
  function matchSelector(selector: Record<string, string>, labels?: Record<string, string>): boolean {
    const entries = Object.entries(selector)
    if (!entries.length) return false
    const all = labels ?? {}
    return entries.every(([k, v]) => all[k] === v)
  }

  const globalNs = inject(clusterDetailNamespaceKey, undefined)
  const globalNamespace = computed(() => globalNs?.namespace.value ?? '')
  const ctxNsOptions = computed(() => globalNs?.namespaceOptions.value ?? [])
  const localNsOptions = ref<string[]>([])
  const nsOptions = computed(() =>
    ctxNsOptions.value.length ? ctxNsOptions.value : localNsOptions.value
  )

  async function loadLocalNamespaceOptions(cluster: string) {
    if (!cluster) {
      localNsOptions.value = []
      return
    }
    try {
      const { items } = await fetchK8sNamespaceList(cluster, { page: 1, limit: 500 })
      localNsOptions.value = items.map((n) => n.metadata.name).sort()
    } catch {
      localNsOptions.value = []
    }
  }

  // ── Deployment tab state ──
  const deplSearchForm = ref<{ name?: string }>({})
  const deplSelectedRows = ref<Array<(K8sDeployment | K8sPod) & { rowKey: string }>>([])
  const deplSortOrder = ref<'ascending' | 'descending' | null>(null)
  const deplBatchDeleting = ref(false)
  const isDeployPodMode = computed(() => props.deployDataMode === 'pod')

  // ── StatefulSet tab state ──
  const stsSearchForm = ref<{ name?: string }>({})
  const stsSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── DaemonSet tab state ──
  const dsSearchForm = ref<{ name?: string }>({})
  const dsSortOrder = ref<'ascending' | 'descending' | null>(null)
  const dsLogPods = ref<K8sPod[]>([])
  const dsLogPod = ref('')
  const dsLogContainer = ref('')
  const dsLogTailLines = ref(10)
  const dsLogKeyword = ref('')
  const dsLogMode = ref<'history' | 'realtime'>('history')
  const dsLogLoading = ref(false)
  const dsLogRefreshing = ref(false)
  const dsLogRows = ref<Array<{ lineContent: string }>>([])
  const dsLogContainerOptions = computed(() => {
    const pod = dsLogPods.value.find((p) => p.metadata?.name === dsLogPod.value)
    return (pod?.spec?.containers ?? []).map((c) => c.name ?? '').filter(Boolean)
  })

  // ── Job tab state ──
  const jobSearchForm = ref<{ name?: string; type?: string }>({})
  const jobSelectedRows = ref<any[]>([])
  const jobSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── CronJob tab state ──
  const cjSearchForm = ref<{ name?: string }>({})
  const cjSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── Resource / display helpers ──
  function parseCpuMilli(val: string): number {
    if (val.endsWith('m')) return parseFloat(val)
    return parseFloat(val) * 1000
  }
  function formatCpuMilli(m: number): string {
    return m >= 1000 ? `${+(m / 1000).toFixed(2)}` : `${m}m`
  }
  function parseMemBytes(val: string): number {
    if (val.endsWith('Ki')) return parseFloat(val) * 1024
    if (val.endsWith('Mi')) return parseFloat(val) * 1024 ** 2
    if (val.endsWith('Gi')) return parseFloat(val) * 1024 ** 3
    if (val.endsWith('Ti')) return parseFloat(val) * 1024 ** 4
    return parseFloat(val)
  }
  function formatMemBytes(b: number): string {
    if (b >= 1024 ** 3) return `${+(b / 1024 ** 3).toFixed(1)}Gi`
    if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)}Mi`
    if (b >= 1024) return `${Math.round(b / 1024)}Ki`
    return `${b}B`
  }

  function renderKvCell(lines: string[]) {
    const lineStyle =
      'font-size:12px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
    const moreStyle = 'font-size:12px;line-height:1.5;color:var(--el-text-color-placeholder)'
    if (!lines.length) return h('span', { style: lineStyle }, '—')
    const preview = lines.slice(0, 2)
    const hasMore = lines.length > 2
    const trigger = h('div', [
      ...preview.map((t, i) => h('div', { key: `p${i}`, style: lineStyle }, t)),
      ...(hasMore ? [h('div', { style: moreStyle }, '...')] : [])
    ])
    const body = h(
      'div',
      { style: 'max-height:300px;overflow-y:auto;padding:4px 0' },
      lines.map((t, i) =>
        h('div', { key: `f${i}`, style: 'font-size:12px;line-height:1.8;white-space:nowrap' }, t)
      )
    )
    return h(
      ElPopover,
      { placement: 'top-start', width: 360, trigger: 'hover', showAfter: 200, teleported: true },
      { reference: () => trigger, default: () => body }
    )
  }

  // 通用 namespace 系统 tag 渲染（命名空间列）
  function isSystemNamespace(ns: string): boolean {
    return ns === 'default' || ns.startsWith('kube-')
  }

  function renderNsCell(ns: string) {
    const isSystem = isSystemNamespace(ns)
    return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', { style: 'font-size:12px' }, ns),
      isSystem
        ? h('span', {
            style:
              'font-size:11px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-7);flex-shrink:0'
          }, '系统')
        : null
    ])
  }

  // 通用名称列（name + copy icon）
  function renderNameCell(name: string) {
    return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      h('span', { style: 'font-size:14px;color:var(--el-text-color-primary)' }, name),
      h('span', {
        class: 'icon-action',
        style: 'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
        title: '复制',
        onClick: (e: MouseEvent) => {
          e.stopPropagation()
          navigator.clipboard.writeText(name)
          ElMessage.success('已复制')
        }
      }, [h(CopyDocument, { style: 'width:12px;height:12px' })])
    ])
  }

  function openWorkloadDetail(path: string, namespace: string, name: string) {
    router.push({
      path,
      query: { cluster: String(route.query.cluster ?? ''), namespace, name }
    })
  }

  function renderPodNameCell(name: string) {
    return h(
      ElTooltip,
      { content: name, placement: 'top', showAfter: 300 },
      {
        default: () =>
          h(
            ElLink,
            {
              type: 'primary',
              underline: 'never',
              style:
                'font-size:12px;font-family:JetBrains Mono,Consolas,monospace;display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
            },
            () => name
          )
      }
    )
  }

  // 实例个数列（ready/desired）
  function renderReplicaCell(ready: number, desired: number) {
    const ok = ready === desired && desired > 0
    const color = ok ? 'var(--el-color-success)' : 'var(--el-color-warning)'
    return h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
      h('span', { style: `font-size:12px;color:${color}` }, `${ready} / ${desired}`),
      !ok ? h('span', { class: 'deploy-spin', style: 'display:inline-flex;align-items:center;color:var(--el-color-primary)' },
        [h(Loading, { style: 'width:13px;height:13px' })]) : null
    ])
  }

  function renderImageCell(lines: string[]) {
    const tagStyle =
      'display:inline-flex;align-items:center;gap:6px;background:var(--el-fill-color);border-radius:4px;padding:2px 8px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%'
    const moreStyle = 'font-size:12px;line-height:1.5;color:var(--el-text-color-placeholder)'
    if (!lines.length) return h('span', { style: 'font-size:12px' }, '—')
    const preview = lines.slice(0, 2)
    const hasMore = lines.length > 2
    const makeTag = (t: string, key: string, fullWidth = false) =>
      h('div', { key, style: 'display:flex;align-items:center;margin-bottom:2px' }, [
        h('span', { style: fullWidth ? tagStyle.replace('max-width:100%', 'max-width:none;flex-shrink:0') : tagStyle }, [
          h('span', { style: 'overflow:hidden;text-overflow:ellipsis' }, t)
        ])
      ])
    const trigger = h('div', [
      ...preview.map((t, i) => makeTag(t, `p${i}`)),
      ...(hasMore ? [h('div', { style: moreStyle }, '...')] : [])
    ])
    const body = h(
      'div',
      { style: 'max-height:300px;overflow-y:auto;padding:4px 0' },
      lines.map((t, i) => makeTag(t, `f${i}`, true))
    )
    return h(
      ElPopover,
      { placement: 'top-start', width: 'auto', minWidth: 480, trigger: 'hover', showAfter: 200, teleported: true },
      { reference: () => trigger, default: () => body }
    )
  }

  // ── StatefulSet useTable ──

  type StsParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: stsColumns,
    columnChecks: stsColumnChecks,
    data: stsData,
    loading: stsLoading,
    pagination: stsPagination,
    getData: getStsData,
    replaceSearchParams: replaceStsSearchParams,
    handleSizeChange: stsHandleSizeChange,
    handleCurrentChange: stsHandleCurrentChange,
    refreshData: refreshStsData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: StsParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sStatefulSet & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        if (props.stsDataMode === 'services') {
          const ns = props.mirrorNamespace || params.namespace || undefined
          const { items } = await fetchK8sServiceList(cluster, { page: 1, limit: 500, namespace: ns })
          const selector = parseSelectorMap(props.mirrorSelector || '')
          const nameFilter = (params.name ?? '').trim().toLowerCase()
          const filtered = items
            .filter((svc) => matchSelector(selector, svc.spec?.selector as Record<string, string> | undefined))
            .filter((svc) => !nameFilter || String(svc.metadata?.name ?? '').toLowerCase().includes(nameFilter))
          const total = filtered.length
          const start = (params.current - 1) * params.size
          const list = filtered.slice(start, start + params.size).map((s, i) => ({
            ...s,
            rowKey: s.metadata?.uid ?? s.metadata?.name ?? `svc-${start + i}`
          }))
          return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
        }
        const { items, total } = await fetchK8sStatefulSetList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: params.namespace || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `sts-${i}` }))
        if (stsSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? ''
            const tb = b.metadata?.creationTimestamp ?? ''
            return stsSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () =>
        props.stsDataMode === 'services'
          ? [
              { type: 'selection' },
              {
                prop: 'metadata.name', label: '名称', minWidth: 140,
                formatter: (row: K8sService) =>
                  h(
                    ElTooltip,
                    { content: row.metadata?.name ?? '', placement: 'top', showAfter: 300 },
                    {
                      default: () =>
                        h(
                          'span',
                          {
                            style:
                              'display:block;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
                          },
                          row.metadata?.name ?? '—'
                        )
                    }
                  )
              },
              {
                prop: 'spec.type', label: '类型', width: 120,
                formatter: (row: K8sService) => h(ElTag, { size: 'small', effect: 'plain' }, () => row.spec?.type ?? '—')
              },
              {
                prop: 'spec.clusterIP', label: 'Cluster IP', width: 150,
                formatter: (row: K8sService) => h('span', { style: 'font-size:12px' }, row.spec?.clusterIP ?? '—')
              },
              {
                prop: 'ports', label: '端口', minWidth: 220,
                formatter: (row: K8sService) =>
                  h(
                    'span',
                    { style: 'font-size:12px' },
                    (row.spec?.ports ?? []).map((p) => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ') || '—'
                  )
              },
              {
                prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
                formatter: (row: K8sService) =>
                  h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
              }
            ]
          : [
              { type: 'selection' },
        {
          prop: 'metadata.name', label: '名称', minWidth: 200,
          formatter: (row: K8sStatefulSet) =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () =>
                  openWorkloadDetail(
                    '/container/statefulset-detail',
                    row.metadata?.namespace ?? '',
                    row.metadata?.name ?? ''
                  )
              },
              () => row.metadata?.name ?? '—'
            )
        },
        {
          prop: 'metadata.namespace', label: '命名空间', width: 160,
          formatter: (row: K8sStatefulSet) => renderNsCell(row.metadata?.namespace ?? '—')
        },
        {
          prop: 'resources', label: 'Request/Limits', minWidth: 170,
          formatter: (row: K8sStatefulSet) => {
            const containers = row.spec?.template?.spec?.containers ?? []
            let cpuReqM = 0, cpuLimM = 0, memReqB = 0, memLimB = 0
            let hasCpuReq = false, hasCpuLim = false, hasMemReq = false, hasMemLim = false
            for (const c of containers) {
              if (c.resources?.requests?.cpu) { cpuReqM += parseCpuMilli(c.resources.requests.cpu); hasCpuReq = true }
              if (c.resources?.limits?.cpu) { cpuLimM += parseCpuMilli(c.resources.limits.cpu); hasCpuLim = true }
              if (c.resources?.requests?.memory) { memReqB += parseMemBytes(c.resources.requests.memory); hasMemReq = true }
              if (c.resources?.limits?.memory) { memLimB += parseMemBytes(c.resources.limits.memory); hasMemLim = true }
            }
            const s = 'font-size:11px;color:var(--el-text-color-regular);white-space:nowrap'
            return h('div', { style: 'line-height:1.8' }, [
              h('div', { style: s }, `CPU: ${hasCpuReq ? formatCpuMilli(cpuReqM) : '无限制'} / ${hasCpuLim ? formatCpuMilli(cpuLimM) : '无限制'}`),
              h('div', { style: s }, `内存: ${hasMemReq ? formatMemBytes(memReqB) : '无限制'} / ${hasMemLim ? formatMemBytes(memLimB) : '无限制'}`)
            ])
          }
        },
        {
          prop: 'status.readyReplicas', label: '实例个数', minWidth: 120,
          formatter: (row: K8sStatefulSet) => renderReplicaCell(row.status?.readyReplicas ?? 0, row.spec?.replicas ?? 0)
        },
        {
          prop: 'image', label: '镜像', minWidth: 160,
          formatter: (row: K8sStatefulSet) => {
            const lines = (row.spec?.template?.spec?.containers ?? []).map((c) => c.image ?? '').filter(Boolean)
            return renderImageCell(lines)
          }
        },
        {
          prop: 'metadata.labels', label: 'Labels', minWidth: 200,
          formatter: (row: K8sStatefulSet) => {
            const lines = Object.entries(row.metadata?.labels ?? {}).map(([k, v]) => `${k}: ${v}`)
            return renderKvCell(lines)
          }
        },
        {
          prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
          formatter: (row: K8sStatefulSet) => h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation', label: '操作', width: 160, fixed: 'right',
          formatter: (row: K8sStatefulSet) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openSharedYamlDialog('sts', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '查看YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteWorkload('sts', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onStsRefresh) }, () => '删除')
            ])
        }
            ]
    }
  })

  const stsVisibleColumns = computed(() =>
    stsColumns.value.filter((c) => !(globalNamespace.value && c.prop === 'metadata.namespace'))
  )

  function onStsNsChange() {
    const ns = globalNamespace.value || undefined
    replaceStsSearchParams({ namespace: ns })
    getStsData()
  }
  function runStsSearch() {
    const name = (stsSearchForm.value.name ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceStsSearchParams({ name, namespace: ns })
    getStsData()
  }
  function forceStsSearch() {
    const name = (stsSearchForm.value.name ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceStsSearchParams({ name, namespace: ns })
    getStsData()
  }
  function onStsRefresh() { refreshStsData() }
  function onStsSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { stsSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getStsData() }
  }

  // ── DaemonSet useTable ──

  type DsParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: dsColumns,
    columnChecks: dsColumnChecks,
    data: dsData,
    loading: dsLoading,
    pagination: dsPagination,
    getData: getDsData,
    replaceSearchParams: replaceDsSearchParams,
    handleSizeChange: dsHandleSizeChange,
    handleCurrentChange: dsHandleCurrentChange,
    refreshData: refreshDsData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: DsParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sDaemonSet & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        if (props.dsDataMode === 'logs') {
          return { code: 200, data: { records: [] as any[], total: 0, current: params.current, size: params.size } }
        }
        if (props.dsDataMode === 'containers') {
          const nameFilter = (params.name ?? '').trim().toLowerCase()
          const raw = (props.mirrorContainers ?? []).filter((c) =>
            !nameFilter || String(c.name ?? '').toLowerCase().includes(nameFilter)
          )
          const total = raw.length
          const start = (params.current - 1) * params.size
          const list = raw.slice(start, start + params.size).map((c, i) => ({
            ...c,
            rowKey: c.name ?? `container-${start + i}`
          }))
          return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
        }
        const { items, total } = await fetchK8sDaemonSetList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: params.namespace || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `ds-${i}` }))
        if (dsSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? ''
            const tb = b.metadata?.creationTimestamp ?? ''
            return dsSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () =>
        props.dsDataMode === 'logs'
          ? []
          : props.dsDataMode === 'containers'
          ? [
              { type: 'selection' },
              {
                prop: 'name', label: '容器名', minWidth: 160,
                formatter: (row: { name?: string }) => h('span', { style: 'font-size:12px' }, row.name ?? '—')
              },
              {
                prop: 'image', label: '镜像', minWidth: 240,
                formatter: (row: { image?: string }) => h('span', { style: 'font-size:12px' }, row.image ?? '—')
              },
              {
                prop: 'resources', label: 'Request/Limits', minWidth: 220,
                formatter: (row: {
                  resources?: {
                    requests?: { cpu?: string; memory?: string }
                    limits?: { cpu?: string; memory?: string }
                  }
                }) =>
                  h('div', { style: 'line-height:1.8' }, [
                    h(
                      'div',
                      { style: 'font-size:11px;color:var(--el-text-color-regular)' },
                      `CPU: ${row.resources?.requests?.cpu ?? '无限制'} / ${row.resources?.limits?.cpu ?? '无限制'}`
                    ),
                    h(
                      'div',
                      { style: 'font-size:11px;color:var(--el-text-color-regular)' },
                      `内存: ${row.resources?.requests?.memory ?? '无限制'} / ${row.resources?.limits?.memory ?? '无限制'}`
                    )
                  ])
              }
            ]
          : [
              { type: 'selection' },
        {
          prop: 'metadata.name', label: '名称', minWidth: 200,
          formatter: (row: K8sDaemonSet) =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () =>
                  openWorkloadDetail(
                    '/container/daemonset-detail',
                    row.metadata?.namespace ?? '',
                    row.metadata?.name ?? ''
                  )
              },
              () => row.metadata?.name ?? '—'
            )
        },
        {
          prop: 'metadata.namespace', label: '命名空间', width: 160,
          formatter: (row: K8sDaemonSet) => renderNsCell(row.metadata?.namespace ?? '—')
        },
        {
          prop: 'resources', label: 'Request/Limits', minWidth: 170,
          formatter: (row: K8sDaemonSet) => {
            const containers = row.spec?.template?.spec?.containers ?? []
            let cpuReqM = 0, cpuLimM = 0, memReqB = 0, memLimB = 0
            let hasCpuReq = false, hasCpuLim = false, hasMemReq = false, hasMemLim = false
            for (const c of containers) {
              if (c.resources?.requests?.cpu) { cpuReqM += parseCpuMilli(c.resources.requests.cpu); hasCpuReq = true }
              if (c.resources?.limits?.cpu) { cpuLimM += parseCpuMilli(c.resources.limits.cpu); hasCpuLim = true }
              if (c.resources?.requests?.memory) { memReqB += parseMemBytes(c.resources.requests.memory); hasMemReq = true }
              if (c.resources?.limits?.memory) { memLimB += parseMemBytes(c.resources.limits.memory); hasMemLim = true }
            }
            const s = 'font-size:11px;color:var(--el-text-color-regular);white-space:nowrap'
            return h('div', { style: 'line-height:1.8' }, [
              h('div', { style: s }, `CPU: ${hasCpuReq ? formatCpuMilli(cpuReqM) : '无限制'} / ${hasCpuLim ? formatCpuMilli(cpuLimM) : '无限制'}`),
              h('div', { style: s }, `内存: ${hasMemReq ? formatMemBytes(memReqB) : '无限制'} / ${hasMemLim ? formatMemBytes(memLimB) : '无限制'}`)
            ])
          }
        },
        {
          prop: 'status', label: '调度状态', minWidth: 120,
          formatter: (row: K8sDaemonSet) => {
            const ready = row.status?.numberReady ?? 0
            const desired = row.status?.desiredNumberScheduled ?? 0
            return renderReplicaCell(ready, desired)
          }
        },
        {
          prop: 'image', label: '镜像', minWidth: 160,
          formatter: (row: K8sDaemonSet) => {
            const lines = (row.spec?.template?.spec?.containers ?? []).map((c) => c.image ?? '').filter(Boolean)
            return renderImageCell(lines)
          }
        },
        {
          prop: 'metadata.labels', label: 'Labels', minWidth: 200,
          formatter: (row: K8sDaemonSet) => {
            const lines = Object.entries(row.metadata?.labels ?? {}).map(([k, v]) => `${k}: ${v}`)
            return renderKvCell(lines)
          }
        },
        {
          prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
          formatter: (row: K8sDaemonSet) => h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation', label: '操作', width: 160, fixed: 'right',
          formatter: (row: K8sDaemonSet) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openSharedYamlDialog('ds', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '查看YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteWorkload('ds', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onDsRefresh) }, () => '删除')
            ])
        }
            ]
    }
  })

  const dsVisibleColumns = computed(() =>
    dsColumns.value.filter((c) => !(globalNamespace.value && c.prop === 'metadata.namespace'))
  )

  function onDsNsChange() {
    const ns = globalNamespace.value || undefined
    replaceDsSearchParams({ namespace: ns })
    getDsData()
  }
  function runDsSearch() {
    const name = (dsSearchForm.value.name ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceDsSearchParams({ name, namespace: ns })
    getDsData()
  }
  function forceDsSearch() {
    const name = (dsSearchForm.value.name ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceDsSearchParams({ name, namespace: ns })
    getDsData()
  }
  function onDsRefresh() { refreshDsData() }
  function onDsSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { dsSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getDsData() }
  }

  async function loadDsLogPods() {
    dsLogRefreshing.value = true
    const cluster = String(route.query.cluster ?? '')
    const namespace = props.mirrorNamespace || globalNamespace.value
    const selector = props.mirrorSelector || ''
    if (!cluster || !namespace || !selector) {
      dsLogPods.value = []
      dsLogPod.value = ''
      dsLogContainer.value = ''
      return
    }
    try {
      const base = `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`
      const { data } = await kubeProxyAxios.get<{ items?: K8sPod[] }>(base, {
        params: { labelSelector: selector, limit: 200 }
      })
      dsLogPods.value = data.items ?? []
      if (!dsLogPods.value.length) {
        dsLogPod.value = ''
        dsLogContainer.value = ''
        return
      }
      if (!dsLogPod.value || !dsLogPods.value.some((p) => p.metadata?.name === dsLogPod.value)) {
        dsLogPod.value = dsLogPods.value[0].metadata?.name ?? ''
      }
      dsLogContainer.value = dsLogContainerOptions.value[0] ?? ''
    } catch {
      dsLogPods.value = []
      dsLogPod.value = ''
      dsLogContainer.value = ''
    } finally {
      dsLogRefreshing.value = false
    }
  }

  function onDsLogPodChange() {
    dsLogContainer.value = dsLogContainerOptions.value[0] ?? ''
  }

  async function fetchDsLogs() {
    const cluster = String(route.query.cluster ?? '')
    const namespace = props.mirrorNamespace || globalNamespace.value
    if (!cluster || !namespace || !dsLogPod.value || !dsLogContainer.value) {
      ElMessage.warning('请先选择 Pod 和容器')
      return
    }
    dsLogLoading.value = true
    try {
      const url = `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(dsLogPod.value)}/log`
      const { data } = await kubeProxyAxios.get<string>(url, {
        params: {
          container: dsLogContainer.value,
          tailLines: dsLogTailLines.value,
          follow: dsLogMode.value === 'realtime'
        },
        responseType: 'text'
      })
      const lines = String(data || '')
        .split('\n')
        .filter((line) => line.length > 0)
        .filter((line) => !dsLogKeyword.value.trim() || line.includes(dsLogKeyword.value.trim()))
      dsLogRows.value = lines.map((line) => ({ lineContent: line }))
    } catch (e: unknown) {
      dsLogRows.value = []
      let errorMessage = '获取日志失败'
      if (typeof e === 'object' && e !== null) {
        const maybeAxios = e as {
          message?: string
          response?: { data?: unknown }
        }
        const responseData = maybeAxios.response?.data
        if (typeof responseData === 'string') {
          try {
            const parsed = JSON.parse(responseData) as { message?: string }
            errorMessage = parsed.message || responseData || maybeAxios.message || errorMessage
          } catch {
            errorMessage = responseData || maybeAxios.message || errorMessage
          }
        } else if (typeof responseData === 'object' && responseData !== null) {
          const payload = responseData as { message?: string }
          errorMessage = payload.message || maybeAxios.message || errorMessage
        } else if (maybeAxios.message) {
          errorMessage = maybeAxios.message
        }
      } else if (typeof e === 'string') {
        errorMessage = e
      }
      ElMessage.error(errorMessage)
    } finally {
      dsLogLoading.value = false
    }
  }

  // ── Job useTable ──

  function getJobStatus(job: K8sJob): { text: string; type: 'success' | 'primary' | 'danger' | 'warning' | 'info' } {
    const conds = job.status?.conditions ?? []
    if (conds.some((c) => c.type === 'Complete' && c.status === 'True')) return { text: '已完成', type: 'success' }
    if (conds.some((c) => c.type === 'Failed' && c.status === 'True')) return { text: '失败', type: 'danger' }
    if (job.spec?.suspend) return { text: '已暂停', type: 'warning' }
    if ((job.status?.active ?? 0) > 0) return { text: '运行中', type: 'primary' }
    return { text: '未知', type: 'info' }
  }

  type JobParams = { current: number; size: number; name?: string; type?: string; namespace?: string }
  const {
    columns: jobColumns,
    columnChecks: jobColumnChecks,
    data: jobData,
    loading: jobLoading,
    pagination: jobPagination,
    getData: getJobData,
    replaceSearchParams: replaceJobSearchParams,
    handleSizeChange: jobHandleSizeChange,
    handleCurrentChange: jobHandleCurrentChange,
    refreshData: refreshJobData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: JobParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sJob & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        if (props.jobDataMode === 'events') {
          const ns = props.mirrorNamespace || params.namespace || undefined
          const eventKind = props.mirrorEventKind || 'Deployment'
          const namespaced = props.mirrorEventNamespaced !== false
          if (!props.mirrorResourceName || (namespaced && !ns)) {
            return { code: 200, data: { records: [] as any[], total: 0, current: params.current, size: params.size } }
          }
          const query: {
            namespace?: string
            name: string
            kind: string
            namespaced: boolean
            page: number
            limit: number
          } = {
            name: props.mirrorResourceName,
            kind: eventKind,
            namespaced,
            page: 1,
            limit: 200
          }
          if (namespaced) query.namespace = ns
          const { items } = await fetchKubeRawEventList(cluster, query)
          const typeFilter = (params.type ?? '').trim()
          let filtered = (items as any[]).filter(
            (e) => !typeFilter || String(e.type ?? 'Unknown') === typeFilter
          )
          if (eventKind === 'Node' && props.mirrorResourceName) {
            filtered = filtered.filter(
              (e) =>
                String(e.involvedObject?.kind ?? '') === 'Node' &&
                String(e.involvedObject?.name ?? '') === props.mirrorResourceName
            )
          }
          if (jobSortOrder.value) {
            filtered = [...filtered].sort((a, b) => {
              const ta = a.lastTimestamp ?? ''
              const tb = b.lastTimestamp ?? ''
              return jobSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
            })
          }
          const total = filtered.length
          const start = (params.current - 1) * params.size
          const list = filtered.slice(start, start + params.size).map((e, i) => ({
            ...e,
            rowKey: e.metadata?.uid ?? `${e.reason ?? 'event'}-${start + i}`
          }))
          return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
        }
        const { items, total } = await fetchK8sJobList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: params.namespace || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `job-${i}` }))
        if (jobSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? ''
            const tb = b.metadata?.creationTimestamp ?? ''
            return jobSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, type: undefined, namespace: undefined },
      columnsFactory: () =>
        props.jobDataMode === 'events'
          ? [
              { type: 'selection' },
              {
                prop: 'lastTimestamp', label: '最后出现时间', width: 170, sortable: 'custom',
                formatter: (row: any) =>
                  h(
                    'span',
                    { style: 'font-size:12px;color:var(--el-text-color-secondary)' },
                    formatNodeCreationTime(row.lastTimestamp)
                  )
              },
              {
                prop: 'type', label: '类型', width: 100,
                formatter: (row: any) =>
                  h(
                    ElTag,
                    {
                      class:
                        row.type === 'Warning'
                          ? 'event-type-tag event-type-tag--warning'
                          : row.type === 'Normal'
                            ? 'event-type-tag event-type-tag--normal'
                            : 'event-type-tag',
                      effect: 'dark',
                      size: 'small'
                    },
                    () => row.type ?? 'Unknown'
                  )
              },
              {
                prop: 'resource', label: '资源', minWidth: 200, showOverflowTooltip: true,
                formatter: (row: any) =>
                  h(
                    'span',
                    { style: 'font-size:12px' },
                    `${row.involvedObject?.kind ?? ''}/${row.involvedObject?.name ?? ''}` || '—'
                  )
              },
              { prop: 'count', label: '出现次数', width: 100 },
              { prop: 'message', label: '内容', minWidth: 280, showOverflowTooltip: true },
              {
                prop: 'operation', label: '操作', width: 80, fixed: 'right',
                formatter: (row: any) =>
                  h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
                    h(
                      ElLink,
                      {
                        type: 'primary',
                        underline: 'never',
                        style: 'font-size:12px',
                        onClick: () => void deleteMirrorEvent(row)
                      },
                      () => '删除'
                    )
                  ])
              }
            ]
          : [
              { type: 'selection' },
        {
          prop: 'metadata.name', label: '名称', minWidth: 200,
          formatter: (row: K8sJob) =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () =>
                  openWorkloadDetail('/container/job-detail', row.metadata?.namespace ?? '', row.metadata?.name ?? '')
              },
              () => row.metadata?.name ?? '—'
            )
        },
        {
          prop: 'status', label: '状态', width: 100,
          formatter: (row: K8sJob) => {
            const { text, type } = getJobStatus(row)
            return h(ElTag, { type, size: 'small' }, () => text)
          }
        },
        {
          prop: 'metadata.namespace', label: '命名空间', width: 160,
          formatter: (row: K8sJob) => renderNsCell(row.metadata?.namespace ?? '—')
        },
        {
          prop: 'metadata.labels', label: 'Labels', minWidth: 200,
          formatter: (row: K8sJob) => {
            const lines = Object.entries(row.metadata?.labels ?? {}).map(([k, v]) => `${k}: ${v}`)
            return renderKvCell(lines)
          }
        },
        {
          prop: 'resources', label: 'Request/Limits', minWidth: 170,
          formatter: (row: K8sJob) => {
            const containers = row.spec?.template?.spec?.containers ?? []
            let cpuReqM = 0, cpuLimM = 0, memReqB = 0, memLimB = 0
            let hasCpuReq = false, hasCpuLim = false, hasMemReq = false, hasMemLim = false
            for (const c of containers) {
              if (c.resources?.requests?.cpu) { cpuReqM += parseCpuMilli(c.resources.requests.cpu); hasCpuReq = true }
              if (c.resources?.limits?.cpu) { cpuLimM += parseCpuMilli(c.resources.limits.cpu); hasCpuLim = true }
              if (c.resources?.requests?.memory) { memReqB += parseMemBytes(c.resources.requests.memory); hasMemReq = true }
              if (c.resources?.limits?.memory) { memLimB += parseMemBytes(c.resources.limits.memory); hasMemLim = true }
            }
            const s = 'font-size:11px;color:var(--el-text-color-regular);white-space:nowrap'
            return h('div', { style: 'line-height:1.8' }, [
              h('div', { style: s }, `CPU: ${hasCpuReq ? formatCpuMilli(cpuReqM) : '无限制'} / ${hasCpuLim ? formatCpuMilli(cpuLimM) : '无限制'}`),
              h('div', { style: s }, `内存: ${hasMemReq ? formatMemBytes(memReqB) : '无限制'} / ${hasMemLim ? formatMemBytes(memLimB) : '无限制'}`)
            ])
          }
        },
        {
          prop: 'parallelism', label: '并行度', width: 90,
          formatter: (row: K8sJob) => h('span', { style: 'font-size:12px' }, String(row.spec?.parallelism ?? 1))
        },
        {
          prop: 'retryCount', label: '重复次数', width: 90,
          formatter: (row: K8sJob) => h('span', { style: 'font-size:12px' }, String(row.spec?.backoffLimit ?? 0))
        },
        {
          prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
          formatter: (row: K8sJob) => h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation', label: '操作', width: 160, fixed: 'right',
          formatter: (row: K8sJob) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openSharedYamlDialog('job', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '查看YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteWorkload('job', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onJobRefresh) }, () => '删除')
            ])
        }
            ]
    }
  })

  const jobVisibleColumns = computed(() =>
    jobColumns.value.filter((c) => !(globalNamespace.value && c.prop === 'metadata.namespace'))
  )

  function onJobNsChange() {
    const ns = globalNamespace.value || undefined
    replaceJobSearchParams({ namespace: ns })
    getJobData()
  }
  function runJobSearch() {
    const name = (jobSearchForm.value.name ?? '').trim() || undefined
    const type = (jobSearchForm.value.type ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceJobSearchParams({ name, type, namespace: ns })
    getJobData()
  }
  function forceJobSearch() {
    const name = (jobSearchForm.value.name ?? '').trim() || undefined
    const type = (jobSearchForm.value.type ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceJobSearchParams({ name, type, namespace: ns })
    getJobData()
  }
  function onJobRefresh() {
    jobSelectedRows.value = []
    refreshJobData()
  }
  function onJobSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { jobSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getJobData() }
    if (prop === 'lastTimestamp') { jobSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getJobData() }
  }
  function onJobSelectionChange(rows: any[]) {
    jobSelectedRows.value = rows
  }

  async function deleteMirrorEvent(row: any) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace ?? 'default'
    const name = row.metadata?.name
    if (!cluster || !name) return
    try {
      await ElMessageBox.confirm('确定删除该事件吗？', '删除事件', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sEvent(cluster, ns, name)
      ElMessage.success('删除成功')
      onJobRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function batchDeleteMirrorEvents() {
    if (!jobSelectedRows.value.length) {
      ElMessage.warning('未选择待删除事件')
      return
    }
    try {
      await ElMessageBox.confirm(`确定批量删除 ${jobSelectedRows.value.length} 条事件吗？`, '批量删除事件', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      const cluster = String(route.query.cluster ?? '')
      for (const ev of jobSelectedRows.value) {
        const ns = ev.metadata?.namespace ?? 'default'
        const name = ev.metadata?.name
        if (!name) continue
        await deleteK8sEvent(cluster, ns, name)
      }
      ElMessage.success('批量删除事件成功')
      jobSelectedRows.value = []
      onJobRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  // ── CronJob useTable ──

  type CjParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: cjColumns,
    columnChecks: cjColumnChecks,
    data: cjData,
    loading: cjLoading,
    pagination: cjPagination,
    getData: getCjData,
    replaceSearchParams: replaceCjSearchParams,
    handleSizeChange: cjHandleSizeChange,
    handleCurrentChange: cjHandleCurrentChange,
    refreshData: refreshCjData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: CjParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sCronJob & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        if (props.cjDataMode === 'history') {
          const ns = props.mirrorNamespace || params.namespace || undefined
          if (!ns || !props.mirrorResourceName) {
            return { code: 200, data: { records: [] as (K8sReplicaSet & { rowKey: string })[], total: 0, current: params.current, size: params.size } }
          }
          const { items } = await fetchK8sReplicaSetList(cluster, { namespace: ns, labelSelector: props.mirrorSelector || undefined })
          const nameFilter = (params.name ?? '').trim().toLowerCase()
          let filtered = items
            .filter((rs) => (rs.metadata?.ownerReferences ?? []).some((o) => o.kind === 'Deployment' && o.name === props.mirrorResourceName))
            .filter((rs) => !nameFilter || String(rs.metadata?.name ?? '').toLowerCase().includes(nameFilter))
            .map((rs, i) => ({ ...rs, rowKey: rs.metadata?.uid ?? rs.metadata?.name ?? `rs-${i}` }))
          filtered = filtered.sort((a, b) => {
            const ra = parseInt(a.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? '0')
            const rb = parseInt(b.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? '0')
            return rb - ra
          })
          if (cjSortOrder.value) {
            filtered = [...filtered].sort((a, b) => {
              const ta = a.metadata?.creationTimestamp ?? ''
              const tb = b.metadata?.creationTimestamp ?? ''
              return cjSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
            })
          }
          const total = filtered.length
          const start = (params.current - 1) * params.size
          const list = filtered.slice(start, start + params.size)
          return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
        }
        const { items, total } = await fetchK8sCronJobList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: params.namespace || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `cj-${i}` }))
        if (cjSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? ''
            const tb = b.metadata?.creationTimestamp ?? ''
            return cjSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () =>
        props.cjDataMode === 'history'
          ? [
              { type: 'selection' },
              {
                prop: 'revision',
                label: '版本号',
                minWidth: 130,
                formatter: (row: K8sReplicaSet) =>
                  h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
                    h(ElTag, { size: 'small', effect: 'plain' }, () => `# ${row.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '—'}`),
                    isCurrentHistoryVersion(row)
                      ? h(ElTag, { size: 'small', type: 'success', effect: 'light' }, () => '当前版本')
                      : null
                  ])
              },
              {
                prop: 'image',
                label: '镜像',
                minWidth: 240,
                formatter: (row: K8sReplicaSet) => renderImageCell((row.spec?.template?.spec?.containers ?? []).map((c) => c.image ?? '').filter(Boolean))
              },
              {
                prop: 'metadata.creationTimestamp',
                label: '创建时间',
                width: 168,
                sortable: 'custom',
                formatter: (row: K8sReplicaSet) => h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
              },
              {
                prop: 'operation',
                label: '操作',
                width: 90,
                fixed: 'right',
                formatter: (row: K8sReplicaSet) =>
                  h(
                    ElLink,
                    {
                      type: 'primary',
                      underline: 'never',
                      style: 'font-size:12px',
                      disabled: isCurrentHistoryVersion(row),
                      onClick: () => void rollbackDeploymentToRevision(row)
                    },
                    () => '回滚'
                  )
              }
            ]
          : [
              { type: 'selection' },
              {
                prop: 'metadata.name', label: '名称', minWidth: 200,
                formatter: (row: K8sCronJob) =>
                  h(
                    ElLink,
                    {
                      type: 'primary',
                      underline: 'never',
                      style: 'font-size:12px',
                      onClick: () =>
                        openWorkloadDetail(
                          '/container/cronjob-detail',
                          row.metadata?.namespace ?? '',
                          row.metadata?.name ?? ''
                        )
                    },
                    () => row.metadata?.name ?? '—'
                  )
              },
              {
                prop: 'metadata.namespace', label: '命名空间', width: 160,
                formatter: (row: K8sCronJob) => renderNsCell(row.metadata?.namespace ?? '—')
              },
              {
                prop: 'resources', label: 'Request/Limits', minWidth: 170,
                formatter: (row: K8sCronJob) => {
                  const containers = row.spec?.jobTemplate?.spec?.template?.spec?.containers ?? []
                  let cpuReqM = 0, cpuLimM = 0, memReqB = 0, memLimB = 0
                  let hasCpuReq = false, hasCpuLim = false, hasMemReq = false, hasMemLim = false
                  for (const c of containers) {
                    if (c.resources?.requests?.cpu) { cpuReqM += parseCpuMilli(c.resources.requests.cpu); hasCpuReq = true }
                    if (c.resources?.limits?.cpu) { cpuLimM += parseCpuMilli(c.resources.limits.cpu); hasCpuLim = true }
                    if (c.resources?.requests?.memory) { memReqB += parseMemBytes(c.resources.requests.memory); hasMemReq = true }
                    if (c.resources?.limits?.memory) { memLimB += parseMemBytes(c.resources.limits.memory); hasMemLim = true }
                  }
                  const s = 'font-size:11px;color:var(--el-text-color-regular);white-space:nowrap'
                  return h('div', { style: 'line-height:1.8' }, [
                    h('div', { style: s }, `CPU: ${hasCpuReq ? formatCpuMilli(cpuReqM) : '无限制'} / ${hasCpuLim ? formatCpuMilli(cpuLimM) : '无限制'}`),
                    h('div', { style: s }, `内存: ${hasMemReq ? formatMemBytes(memReqB) : '无限制'} / ${hasMemLim ? formatMemBytes(memLimB) : '无限制'}`)
                  ])
                }
              },
              {
                prop: 'spec.schedule', label: '调度规则', minWidth: 140,
                formatter: (row: K8sCronJob) =>
                  h('span', { style: 'font-size:12px;font-family:monospace' }, row.spec?.schedule ?? '—')
              },
              {
                prop: 'spec.suspend', label: '状态', width: 90,
                formatter: (row: K8sCronJob) => {
                  const suspended = row.spec?.suspend
                  return h(ElTag, { type: suspended ? 'warning' : 'success', size: 'small' }, () => suspended ? '已暂停' : '运行中')
                }
              },
              {
                prop: 'status.lastScheduleTime', label: '上次调度', width: 168,
                formatter: (row: K8sCronJob) =>
                  h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.status?.lastScheduleTime))
              },
              {
                prop: 'metadata.labels', label: 'Labels', minWidth: 200,
                formatter: (row: K8sCronJob) => {
                  const lines = Object.entries(row.metadata?.labels ?? {}).map(([k, v]) => `${k}: ${v}`)
                  return renderKvCell(lines)
                }
              },
              {
                prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
                formatter: (row: K8sCronJob) => h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
              },
              {
                prop: 'operation', label: '操作', width: 200, fixed: 'right',
                formatter: (row: K8sCronJob) => {
                  const suspended = row.spec?.suspend
                  return h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
                    h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px',
                      onClick: () => void toggleCjSuspend(row)
                    }, () => suspended ? '恢复' : '暂停'),
                    h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px',
                      onClick: () => void openSharedYamlDialog('cj', row.metadata?.namespace ?? '', row.metadata?.name ?? '')
                    }, () => '查看YAML'),
                    h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px',
                      onClick: () => void deleteWorkload('cj', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onCjRefresh)
                    }, () => '删除')
                  ])
                }
              }
            ]
    }
  })

  const cjVisibleColumns = computed(() =>
    cjColumns.value.filter((c) => !(globalNamespace.value && c.prop === 'metadata.namespace'))
  )

  function onCjNsChange() {
    const ns = globalNamespace.value || undefined
    replaceCjSearchParams({ namespace: ns })
    getCjData()
  }
  function runCjSearch() {
    const name = (cjSearchForm.value.name ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceCjSearchParams({ name, namespace: ns })
    getCjData()
  }
  function forceCjSearch() {
    const name = (cjSearchForm.value.name ?? '').trim() || undefined
    const ns = globalNamespace.value || undefined
    replaceCjSearchParams({ name, namespace: ns })
    getCjData()
  }
  function onCjRefresh() { refreshCjData() }
  function onCjSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { cjSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getCjData() }
  }

  function isCurrentHistoryVersion(row: K8sReplicaSet): boolean {
    return (row.status?.replicas ?? 0) > 0
  }

  async function rollbackDeploymentToRevision(row: K8sReplicaSet) {
    if (isCurrentHistoryVersion(row)) return
    const cluster = String(route.query.cluster ?? '')
    const namespace = row.metadata?.namespace ?? props.mirrorNamespace
    const deploymentName = props.mirrorResourceName
    const template = row.spec?.template
    if (!cluster || !namespace || !deploymentName || !template) return
    try {
      await ElMessageBox.confirm('确认回滚到该历史版本吗？', '回滚确认', {
        type: 'warning',
        confirmButtonText: '回滚',
        cancelButtonText: '取消'
      })
      const current = await fetchK8sDeployment(cluster, namespace, deploymentName)
      await patchK8sDeployment(cluster, namespace, deploymentName, {
        spec: { template: JSON.parse(JSON.stringify(template)) },
        metadata: { annotations: JSON.parse(JSON.stringify(current.metadata?.annotations ?? {})) }
      })
      ElMessage.success(`Deployment(${deploymentName}) 回滚成功`)
      onCjRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '回滚失败')
    }
  }

  async function toggleCjSuspend(row: K8sCronJob) {
    if (props.cjDataMode === 'history') return
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    try {
      await patchK8sCronJob(cluster, ns, name, { spec: { suspend: !row.spec?.suspend } })
      ElMessage.success(row.spec?.suspend ? '已恢复' : '已暂停')
      onCjRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  type DeplParams = { current: number; size: number; name?: string; namespace?: string }

  const {
    columns: deplColumns,
    columnChecks: deplColumnChecks,
    data: deplData,
    loading: deplLoading,
    pagination: deplPagination,
    getData: getDeplData,
    replaceSearchParams: replaceDeplSearchParams,
    handleSizeChange: deplHandleSizeChange,
    handleCurrentChange: deplHandleCurrentChange,
    refreshData: refreshDeplData
  } = useTable({
    core: {
      immediate: true,
      apiFn: async (params: DeplParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) {
          return {
            code: 200,
            data: {
              records: [] as (K8sDeployment & { rowKey: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        }
        if (isDeployPodMode.value) {
          const labelSelector = props.deployLabelSelector.trim()
          const nodeName = props.deployNodeName.trim()
          if (!labelSelector && !nodeName) {
            return {
              code: 200,
              data: {
                records: [] as (K8sPod & { rowKey: string })[],
                total: 0,
                current: params.current,
                size: params.size
              }
            }
          }
          const selectedNs = deplNamespace.value.trim()
          const ns = props.deployNamespace || selectedNs || params.namespace || undefined
          const base = ns
            ? `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(ns)}/pods`
            : `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/pods`
          const { data } = await kubeProxyAxios.get<{ items?: K8sPod[] }>(base, {
            params: {
              ...(labelSelector ? { labelSelector } : {}),
              ...(nodeName ? { fieldSelector: `spec.nodeName=${nodeName}` } : {}),
              limit: 500
            }
          })
          const raw = data.items ?? []
          const byName = (params.name ?? '').trim().toLowerCase()
          let filtered = byName
            ? raw.filter((p) => String(p.metadata?.name ?? '').toLowerCase().includes(byName))
            : raw
          if (nodeName) {
            filtered = filtered.filter((p) => String(p.spec?.nodeName ?? '') === nodeName)
          }
          const sorted = deplSortOrder.value
            ? [...filtered].sort((a, b) => {
                const ta = a.metadata?.creationTimestamp ?? ''
                const tb = b.metadata?.creationTimestamp ?? ''
                return deplSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
              })
            : filtered
          const total = sorted.length
          const start = (params.current - 1) * params.size
          const list = sorted.slice(start, start + params.size).map((p, i) => ({
            ...p,
            rowKey: p.metadata?.uid ?? p.metadata?.name ?? `pod-${start + i}`
          }))
          return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
        }
        const { items, total } = await fetchK8sDeploymentList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: params.namespace || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({
          ...d,
          rowKey: d.metadata?.uid ?? d.metadata?.name ?? `deploy-${i}`
        }))
        if (deplSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? ''
            const tb = b.metadata?.creationTimestamp ?? ''
            return deplSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () =>
        isDeployPodMode.value
          ? [
              { type: 'selection' },
              {
                prop: 'metadata.name',
                label: '名称',
                minWidth: 170,
                formatter: (row: K8sPod) => renderPodNameCell(row.metadata?.name ?? '—')
              },
              {
                prop: 'status.phase',
                label: '状态',
                width: 110,
                formatter: (row: K8sPod) => {
                  const phase = row.status?.phase ?? 'Unknown'
                  const type =
                    phase === 'Running'
                      ? 'success'
                      : phase === 'Pending'
                        ? 'warning'
                        : phase === 'Failed'
                          ? 'danger'
                          : 'info'
                  return h(ElTag, { type, size: 'small' }, () => phase)
                }
              },
              {
                prop: 'ready',
                label: 'Ready',
                width: 90,
                formatter: (row: K8sPod) => {
                  const statuses = row.status?.containerStatuses ?? []
                  const ready = statuses.filter((s) => s.ready).length
                  const total = row.spec?.containers?.length ?? 0
                  return h('span', { style: 'font-size:12px' }, `${ready} / ${total}`)
                }
              },
              {
                prop: props.deployNodeName ? 'metadata.namespace' : 'spec.nodeName',
                label: props.deployNodeName ? '命名空间' : '所在节点',
                minWidth: 140,
                formatter: (row: K8sPod) =>
                  props.deployNodeName
                    ? renderNsCell(row.metadata?.namespace ?? '—')
                    : h('span', { style: 'font-size:12px' }, row.spec?.nodeName ?? '—')
              },
              {
                prop: 'status.podIP',
                label: 'Pod IP',
                width: 140,
                formatter: (row: K8sPod) => h('span', { style: 'font-size:12px' }, row.status?.podIP ?? '—')
              },
              {
                prop: 'restart',
                label: '重启次数',
                width: 90,
                formatter: (row: K8sPod) => {
                  const count = (row.status?.containerStatuses ?? []).reduce(
                    (sum, s) => sum + (s.restartCount ?? 0),
                    0
                  )
                  return h('span', { style: 'font-size:12px' }, String(count))
                }
              },
              {
                prop: 'metadata.creationTimestamp',
                label: '创建时间',
                width: 168,
                sortable: 'custom',
                formatter: (row: K8sPod) =>
                  h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
              },
              {
                prop: 'operation',
                label: '操作',
                width: 150,
                fixed: 'right',
                formatter: (row: K8sPod) =>
                  h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap' }, [
                    h(
                      ElLink,
                      {
                        type: 'primary',
                        underline: 'never',
                        style: 'font-size:12px;line-height:1',
                        onClick: () => openPodRemoteLogin(row)
                      },
                      () => '登录'
                    ),
                    h(
                      ElLink,
                      {
                        type: 'primary',
                        underline: 'never',
                        style: 'font-size:12px;line-height:1',
                        onClick: () => void viewPodYaml(row)
                      },
                      () => '查看'
                    ),
                    h(ArtButtonMore, {
                      list: [{ key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }],
                      onClick: (item: ButtonMoreItem) => podRowMoreClick(item, row)
                    })
                  ])
              }
            ]
          : [
              { type: 'selection' },
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 200,
          formatter: (row: K8sDeployment) => {
            const name = row.metadata?.name ?? '—'
            return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
              h(
                'span',
                {
                  style: 'font-size:13px;color:var(--el-color-primary);cursor:pointer;text-decoration:none;transition:opacity .15s',
                  onMouseenter: (e: MouseEvent) => { (e.target as HTMLElement).style.opacity = '0.75' },
                  onMouseleave: (e: MouseEvent) => { (e.target as HTMLElement).style.opacity = '1' },
                  onClick: () => {
                    const ns = row.metadata?.namespace ?? ''
                    router.push({
                      path: '/container/deployment-detail',
                      query: { cluster: String(route.query.cluster ?? ''), namespace: ns, name }
                    })
                  }
                },
                name
              ),
              h(
                'span',
                {
                  class: 'icon-action',
                  style:
                    'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                  title: '复制',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(name)
                    ElMessage.success('已复制')
                  }
                },
                [h(CopyDocument, { style: 'width:12px;height:12px' })]
              )
            ])
          }
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sDeployment) => {
            const ns = row.metadata?.namespace ?? '—'
            const isSystem = ns === 'default' || ns.startsWith('kube-')
            return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
              h('span', { style: 'font-size:12px' }, ns),
              isSystem
                ? h(
                    'span',
                    {
                      style:
                        'font-size:11px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-7);flex-shrink:0'
                    },
                    '系统'
                  )
                : null
            ])
          }
        },
        {
          prop: 'resources',
          label: 'Request/Limits',
          minWidth: 170,
          formatter: (row: K8sDeployment) => {
            const containers = row.spec?.template?.spec?.containers ?? []
            let cpuReqM = 0,
              cpuLimM = 0,
              memReqB = 0,
              memLimB = 0
            let hasCpuReq = false,
              hasCpuLim = false,
              hasMemReq = false,
              hasMemLim = false
            for (const c of containers) {
              const cr = c.resources?.requests?.cpu
              const cl = c.resources?.limits?.cpu
              const mr = c.resources?.requests?.memory
              const ml = c.resources?.limits?.memory
              if (cr) {
                cpuReqM += parseCpuMilli(cr)
                hasCpuReq = true
              }
              if (cl) {
                cpuLimM += parseCpuMilli(cl)
                hasCpuLim = true
              }
              if (mr) {
                memReqB += parseMemBytes(mr)
                hasMemReq = true
              }
              if (ml) {
                memLimB += parseMemBytes(ml)
                hasMemLim = true
              }
            }
            const cpuReq = hasCpuReq ? formatCpuMilli(cpuReqM) : '无限制'
            const cpuLim = hasCpuLim ? formatCpuMilli(cpuLimM) : '无限制'
            const memReq = hasMemReq ? formatMemBytes(memReqB) : '无限制'
            const memLim = hasMemLim ? formatMemBytes(memLimB) : '无限制'
            const s = 'font-size:11px;color:var(--el-text-color-regular);white-space:nowrap'
            return h('div', { style: 'line-height:1.8' }, [
              h('div', { style: s }, `CPU: ${cpuReq} / ${cpuLim}`),
              h('div', { style: s }, `内存: ${memReq} / ${memLim}`)
            ])
          }
        },
        {
          prop: 'status.readyReplicas',
          label: '实例个数',
          minWidth: 120,
          formatter: (row: K8sDeployment) => {
            const ready = row.status?.readyReplicas ?? 0
            const desired = row.spec?.replicas ?? 0
            const ok = ready === desired && desired > 0
            const color = ok ? 'var(--el-color-success)' : 'var(--el-color-warning)'
            const valueLine = h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
              h('span', { style: `font-size:12px;color:${color}` }, `${ready} / ${desired}`),
              !ok
                ? h(
                    'span',
                    {
                      class: 'deploy-spin',
                      style: 'display:inline-flex;align-items:center;color:var(--el-color-primary)'
                    },
                    [h(Loading, { style: 'width:13px;height:13px' })]
                  )
                : null
            ])
            if (ok) return valueLine
            return h('div', { style: 'line-height:1.4;margin-top:2px' }, [
              valueLine,
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:11px',
                  onClick: () =>
                    router.push({
                      path: '/container/deployment-detail',
                      query: {
                        cluster: String(route.query.cluster ?? ''),
                        namespace: row.metadata?.namespace ?? '',
                        name: row.metadata?.name ?? '',
                        tab: 'job'
                      }
                    })
                },
                () => '查看事件列表'
              )
            ])
          }
        },
        {
          prop: 'image',
          label: '镜像',
          minWidth: 180,
          formatter: (row: K8sDeployment) => {
            const lines = (row.spec?.template?.spec?.containers ?? [])
              .map((c) => c.image ?? '')
              .filter(Boolean)
            return renderImageCell(lines)
          }
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: 200,
          formatter: (row: K8sDeployment) => {
            const labels = row.metadata?.labels ?? {}
            const lines = Object.entries(labels).map(([k, v]) => `${k}: ${v}`)
            return renderKvCell(lines)
          }
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sDeployment) =>
            h(
              'span',
              { style: 'font-size:12px' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 180,
          fixed: 'right',
          formatter: (row: K8sDeployment) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => openScaleDialog(row)
                },
                () => '更新Pod数量'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => void deleteDeployment(row)
                },
                () => '删除'
              ),
              h(ArtButtonMore, {
                list: [
                  { key: 'redeploy', label: '重新部署', icon: 'ri:refresh-line' },
                  { key: 'yaml', label: '编辑YAML', icon: 'ri:file-code-line' }
                ],
                onClick: (item: ButtonMoreItem) => deplMoreClick(item, row)
              })
            ])
        }
            ]
    }
  })

  const deplVisibleColumns = computed(() =>
    deplColumns.value.filter((c) => !(globalNamespace.value && c.prop === 'metadata.namespace'))
  )

  function onDeplSelectionChange(rows: Array<(K8sDeployment | K8sPod) & { rowKey: string }>) {
    deplSelectedRows.value = rows
  }

  async function batchDeletePods() {
    if (!isDeployPodMode.value || deplSelectedRows.value.length === 0) return
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    const rows = deplSelectedRows.value as Array<K8sPod & { rowKey: string }>
    const names = rows.map((row) => row.metadata?.name).filter(Boolean) as string[]
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${names.length} 个容器组吗？`, '批量删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    deplBatchDeleting.value = true
    try {
      await Promise.all(
        rows.map(async (row) => {
          const podName = row.metadata?.name
          const podNamespace =
            row.metadata?.namespace || props.deployNamespace || globalNamespace.value
          if (!podName || !podNamespace) return
          await deleteK8sPod(cluster, podNamespace, podName)
        })
      )
      ElMessage.success('批量删除成功')
      deplSelectedRows.value = []
      await getDeplData()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '批量删除失败')
    } finally {
      deplBatchDeleting.value = false
    }
  }

  function openPodRemoteLogin(row: K8sPod) {
    if (row.status?.phase !== 'Running') {
      ElMessage.warning('Pod 未处于 Running 状态，无法远程登录')
      return
    }
    const pod = row.metadata?.name ?? ''
    const namespace = (row.metadata?.namespace ?? props.deployNamespace) || globalNamespace.value
    const containers = (row.spec?.containers ?? []).map((c) => c.name ?? '').filter(Boolean)
    if (!pod || !namespace || !containers.length) {
      ElMessage.warning('容器信息不完整，无法登录')
      return
    }
    if (containers.length === 1) {
      loginPodWithAutoShell({ pod, namespace, container: containers[0] })
      return
    }
    podLogin.value = {
      pod,
      namespace,
      containers,
      container: containers[0] ?? ''
    }
    podLoginVisible.value = true
  }

  const podLoginVisible = ref(false)
  const podRemoteWebshellRef = ref<InstanceType<typeof PodRemoteWebshell> | null>(null)
  const podLogin = ref<{
    pod: string
    namespace: string
    container: string
    containers: string[]
  }>({
    pod: '',
    namespace: '',
    container: '',
    containers: []
  })

  function resetPodLogin() {
    podLogin.value = {
      pod: '',
      namespace: '',
      container: '',
      containers: []
    }
  }

  function confirmPodRemoteLogin() {
    const cluster = String(route.query.cluster ?? '')
    const { pod, namespace, container } = podLogin.value
    if (!cluster || !pod || !namespace || !container) {
      ElMessage.warning('请先选择容器')
      return
    }
    loginPodWithAutoShell({ pod, namespace, container })
  }

  function loginPodWithAutoShell(opts: { pod: string; namespace: string; container: string }) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    void podRemoteWebshellRef.value?.open({
      cluster,
      namespace: opts.namespace,
      pod: opts.pod,
      container: opts.container
    })
    podLoginVisible.value = false
    resetPodLogin()
  }

  async function viewPodYaml(row: K8sPod) {
    const cluster = String(route.query.cluster ?? '')
    const namespace = (row.metadata?.namespace ?? props.deployNamespace) || globalNamespace.value
    const podName = row.metadata?.name ?? ''
    if (!cluster || !namespace || !podName) return
    try {
      const pod = await fetchK8sPod(cluster, namespace, podName)
      yamlText.value = yaml.dump(pod, { quotingType: '"' })
      yamlReadonly.value = true
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  function podRowMoreClick(item: ButtonMoreItem, row: K8sPod) {
    if (item.key !== 'delete') return
    const namespace = (row.metadata?.namespace ?? props.deployNamespace) || globalNamespace.value
    const podName = row.metadata?.name ?? ''
    if (!namespace || !podName) return
    void deleteWorkload('pod', namespace, podName, onDeplRefresh)
  }

  function getDeplNamespaceParam() {
    if (!isDeployPodMode.value) return globalNamespace.value || undefined
    if (props.deployNamespace) return props.deployNamespace.trim() || undefined
    return deplNamespace.value.trim() || undefined
  }

  function onDeplNamespaceChange() {
    replaceDeplSearchParams({ namespace: getDeplNamespaceParam() })
    getDeplData()
  }

  function runDeplSearch() {
    const name = (deplSearchForm.value.name ?? '').trim() || undefined
    const ns = getDeplNamespaceParam()
    replaceDeplSearchParams({ name, namespace: ns })
    getDeplData()
  }

  function forceDeplSearch() {
    const name = (deplSearchForm.value.name ?? '').trim() || undefined
    const ns = getDeplNamespaceParam()
    replaceDeplSearchParams({ name, namespace: ns })
    getDeplData()
  }

  function onDeplRefresh() {
    refreshDeplData()
  }

  function onDeplSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') {
      deplSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null
      getDeplData()
    }
  }

  // ── Create ──
  const createVisible = ref(false)
  const createSubmitting = ref(false)
  const createForm = ref({ namespace: '', name: '', image: '', replicas: 1 })

  function openCreateDialog() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.warning('缺少集群参数')
      return
    }
    const namespace = globalNamespace.value || nsOptions.value[0] || ''
    router.push({
      path: '/container/deployment-create',
      query: {
        cluster,
        ...(namespace ? { namespace } : {}),
        tab: 'deploy'
      }
    })
  }

  function goCreateSts() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.warning('缺少集群参数')
      return
    }
    const namespace = globalNamespace.value || nsOptions.value[0] || ''
    router.push({
      path: '/container/statefulset-create',
      query: {
        cluster,
        ...(namespace ? { namespace } : {}),
        tab: 'sts'
      }
    })
  }

  function goCreateDs() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.warning('缺少集群参数')
      return
    }
    const namespace = globalNamespace.value || nsOptions.value[0] || ''
    router.push({
      path: '/container/daemonset-create',
      query: {
        cluster,
        ...(namespace ? { namespace } : {}),
        tab: 'ds'
      }
    })
  }

  function goCreateJob() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.warning('缺少集群参数')
      return
    }
    const namespace = globalNamespace.value || nsOptions.value[0] || ''
    router.push({
      path: '/container/job-create',
      query: {
        cluster,
        ...(namespace ? { namespace } : {}),
        tab: 'job'
      }
    })
  }

  function goCreateCronJob() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.warning('缺少集群参数')
      return
    }
    const namespace = globalNamespace.value || nsOptions.value[0] || ''
    router.push({
      path: '/container/cronjob-create',
      query: {
        cluster,
        ...(namespace ? { namespace } : {}),
        tab: 'cj'
      }
    })
  }

  async function submitCreate() {
    const cluster = String(route.query.cluster ?? '')
    const { namespace, name, image, replicas } = createForm.value
    if (!namespace) {
      ElMessage.warning('请选择命名空间')
      return
    }
    if (!name.trim()) {
      ElMessage.warning('请输入名称')
      return
    }
    if (!image.trim()) {
      ElMessage.warning('请输入镜像')
      return
    }
    createSubmitting.value = true
    try {
      await createK8sDeployment(cluster, namespace, {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: name.trim(), namespace },
        spec: {
          replicas,
          selector: { matchLabels: { app: name.trim() } },
          template: {
            metadata: { labels: { app: name.trim() } },
            spec: { containers: [{ name: name.trim(), image: image.trim() }] }
          }
        }
      })
      ElMessage.success(`Deployment(${name.trim()}) 创建成功`)
      createVisible.value = false
      onDeplRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      createSubmitting.value = false
    }
  }

  // ── Scale ──
  const scaleVisible = ref(false)
  const scaleSubmitting = ref(false)
  const scaleRow = ref<K8sDeployment | null>(null)
  const scaleValue = ref(1)

  function openScaleDialog(row: K8sDeployment) {
    scaleRow.value = row
    scaleValue.value = row.spec?.replicas ?? 1
    scaleVisible.value = true
  }

  async function submitScale() {
    const cluster = String(route.query.cluster ?? '')
    const row = scaleRow.value
    if (!row?.metadata?.namespace || !row?.metadata?.name) return
    scaleSubmitting.value = true
    try {
      await patchK8sDeployment(cluster, row.metadata.namespace, row.metadata.name, {
        spec: { replicas: scaleValue.value }
      })
      ElMessage.success('Pod数量更新成功')
      scaleVisible.value = false
      onDeplRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      scaleSubmitting.value = false
    }
  }

  // ── YAML ──
  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSubmitting = ref(false)
  const yamlReadonly = ref(false)

  async function openYamlDialog(row: K8sDeployment) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    try {
      const deploy = await fetchK8sDeployment(cluster, ns, name)
      yamlText.value = yaml.dump(deploy, { quotingType: '"' })
      yamlReadonly.value = false
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  async function submitYamlEdit() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    yamlSubmitting.value = true
    try {
      await updateK8sResourceFromYaml(cluster, yamlText.value)
      ElMessage.success('YAML 更新成功')
      yamlVisible.value = false
      onDeplRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      yamlSubmitting.value = false
    }
  }

  function onWorkloadYamlSave(text: string) {
    yamlText.value = text
    void submitYamlEdit()
  }

  // ── Delete / Redeploy ──
  // 通用删除（供 sts/ds/job/cj 复用）
  async function deleteWorkload(
    kind: 'sts' | 'ds' | 'job' | 'cj' | 'pod',
    namespace: string,
    name: string,
    refresh: () => void
  ) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !namespace || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 "${name}" 吗？`, '删除确认', {
        type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
      })
      if (kind === 'sts') await deleteK8sStatefulSet(cluster, namespace, name)
      else if (kind === 'ds') await deleteK8sDaemonSet(cluster, namespace, name)
      else if (kind === 'job') await deleteK8sJob(cluster, namespace, name)
      else if (kind === 'cj') await deleteK8sCronJob(cluster, namespace, name)
      else if (kind === 'pod') await deleteK8sPod(cluster, namespace, name)
      ElMessage.success('删除成功')
      refresh()
    } catch {
      // user cancel
    }
  }

  // 通用只读 YAML 查看（供 sts/ds/job/cj 使用）
  async function openSharedYamlDialog(
    kind: 'sts' | 'ds' | 'job' | 'cj',
    namespace: string,
    name: string
  ) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !namespace || !name) return
    try {
      let resource: unknown
      if (kind === 'sts') resource = await fetchK8sStatefulSet(cluster, namespace, name)
      else if (kind === 'ds') resource = await fetchK8sDaemonSet(cluster, namespace, name)
      else if (kind === 'job') resource = await fetchK8sJob(cluster, namespace, name)
      else resource = await fetchK8sCronJob(cluster, namespace, name)
      yamlText.value = yaml.dump(resource, { quotingType: '"' })
      yamlReadonly.value = true
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  async function deleteDeployment(row: K8sDeployment) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 Deployment "${name}" 吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sDeployment(cluster, ns, name)
      ElMessage.success(`Deployment(${name}) 删除成功`)
      onDeplRefresh()
    } catch {
      // user cancel
    }
  }

  async function redeployDeployment(row: K8sDeployment) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    try {
      await patchK8sDeployment(cluster, ns, name, {
        spec: {
          template: {
            metadata: {
              annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() }
            }
          }
        }
      })
      ElMessage.success('重新部署已触发')
      onDeplRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  function deplMoreClick(item: ButtonMoreItem, row: K8sDeployment) {
    switch (item.key) {
      case 'redeploy':
        void redeployDeployment(row)
        break
      case 'yaml':
        void openYamlDialog(row)
        break
    }
  }

  // ── Global namespace watch ──
  watch(globalNamespace, (ns) => {
    const nsVal = ns || undefined
    if (!props.deployNamespace) {
      deplNamespace.value = ns ?? ''
    }
    replaceDeplSearchParams({ namespace: getDeplNamespaceParam() || nsVal })
    replaceStsSearchParams({ namespace: nsVal })
    replaceDsSearchParams({ namespace: nsVal })
    replaceJobSearchParams({ namespace: nsVal })
    replaceCjSearchParams({ namespace: nsVal })
    if (kind.value === 'deploy') getDeplData()
    else if (kind.value === 'sts') getStsData()
    else if (kind.value === 'ds') getDsData()
    else if (kind.value === 'job') getJobData()
    else if (kind.value === 'cj') getCjData()
  })

  watch(
    () => String(route.query.cluster ?? ''),
    (cluster) => {
      if (ctxNsOptions.value.length) return
      void loadLocalNamespaceOptions(cluster)
    },
    { immediate: true }
  )

  watch(
    () => [props.deployDataMode, props.deployNamespace, props.deployLabelSelector] as const,
    () => {
      if (!isDeployPodMode.value) return
      if (props.deployNamespace) deplNamespace.value = props.deployNamespace
      else deplNamespace.value = globalNamespace.value || ''
      const ns = getDeplNamespaceParam()
      replaceDeplSearchParams({ namespace: ns })
      getDeplData()
    },
    { immediate: true }
  )

  // ── Tab lazy loading（含 immediate：从创建页带 ?tab= 返回时 kind 已正确，须挂载即拉取） ──
  watch(
    kind,
    (val) => {
      if (String(route.query.tab ?? '') !== val) {
        router.replace({
          query: {
            ...route.query,
            tab: val
          }
        })
      }
      const cluster = String(route.query.cluster ?? '')
      if (!cluster) return
      if (val === 'sts') getStsData()
      else if (val === 'ds') {
        if (props.dsDataMode === 'logs') {
          void loadDsLogPods()
        } else {
          getDsData()
        }
      } else if (val === 'job') getJobData()
      else if (val === 'cj') getCjData()
    },
    { immediate: true }
  )
</script>

<style>
  .workloads-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .workloads-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .workloads-page .art-table .el-table {
    font-size: 13px;
  }
  .workloads-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
  .deploy-spin {
    animation: deploy-spin-rotate 1s linear infinite;
  }
  @keyframes deploy-spin-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .workloads-toolbar__namespace-popper .el-select-dropdown__list {
    max-height: 280px;
    overflow-x: auto;
    overflow-y: auto;
  }

  .workloads-toolbar__namespace-popper .el-select-dropdown__item {
    overflow: visible;
    text-overflow: clip;
    white-space: nowrap;
  }

  .workloads-toolbar__namespace-popper .workloads-ns-option-name {
    display: inline-block;
    min-width: max-content;
  }
</style>

<style scoped>
  .workloads-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .workloads-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .workloads-toolbar__ns-select {
    width: 160px;
  }

  .workloads-toolbar__ns-select :deep(.el-select__placeholder) {
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .workloads-toolbar__search {
    width: 350px;
    max-width: 100%;
  }

  .workloads-toolbar__type {
    width: 220px;
    max-width: 100%;
  }

  .workloads-toolbar__ns-label {
    font-size: var(--el-menu-item-font-size, 14px);
    font-weight: var(--el-menu-item-font-weight, 400);
    color: #C7C7D1;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .workloads-toolbar__namespace {
    width: max-content;
    min-width: 210px;
    max-width: min(38vw, 440px);
  }

  .workloads-toolbar__namespace :deep(.el-select__wrapper) {
    font-size: 13px;
    min-height: 32px;
    max-width: 100%;
    box-shadow: 0 0 0 1px var(--el-border-color) inset !important;
    background-color: var(--el-bg-color);
    border-radius: 8px;
  }

  .workloads-toolbar__namespace :deep(.el-select__selection) {
    min-width: 0;
  }

  .workloads-toolbar__namespace :deep(.el-select__placeholder) {
    color: #C7C7D1;
  }

  .workloads-toolbar__namespace :deep(.el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--el-border-color-dark) inset !important;
  }

  .workloads-toolbar__namespace :deep(.el-select__wrapper.is-focused) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
  }

  .workloads-ns-option-name {
    font-size: 13px;
  }

  .workloads-ns-system-tag {
    margin-left: 6px;
    font-size: 11px;
    padding: 0 4px;
    line-height: 16px;
    border-radius: 3px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    border: 1px solid var(--el-color-primary-light-7);
    flex-shrink: 0;
  }

  .workloads-toolbar__namespace :deep(.el-select__selected-item),
  .workloads-toolbar__namespace :deep(.el-select__placeholder),
  .workloads-toolbar__type :deep(.el-select__selected-item),
  .workloads-toolbar__type :deep(.el-select__placeholder) {
    font-size: 13px;
    font-weight: var(--el-menu-item-font-weight, 400);
    color: #C7C7D1;
  }

  .workloads-toolbar-search-btn {
    flex-shrink: 0;
    display: flex;
    width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 6px;
    background: color-mix(in srgb, var(--art-gray-300) 55%, transparent);
    color: var(--el-text-color-secondary);
    transition: background-color 0.15s ease;
  }

  .workloads-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .workloads-toolbar-search-btn:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }

  .scale-dialog-body {
    padding: 4px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .scale-info-row {
    display: flex;
    align-items: center;
  }

  .scale-info-label {
    width: 80px;
    flex-shrink: 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .scale-info-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  .scale-info-current {
    font-weight: 600;
    color: var(--el-color-primary);
  }

  .scale-input {
    width: 160px;
  }

  .workloads-tabs :deep(.el-tabs__header) {
    margin-top: -6px;
  }

  .workloads-extra-table {
    margin-top: 12px;
  }

  .workloads-node-resource {
    padding: 14px 4px 10px;
  }

  .workloads-node-resource__tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 10px;
  }

  .workloads-node-resource__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .workloads-node-resource__head {
    display: grid;
    grid-template-columns: 180px 1fr 1fr;
    gap: 16px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 600;
  }

  .workloads-node-resource__line {
    display: grid;
    grid-template-columns: 180px 1fr 1fr;
    gap: 16px;
    align-items: center;
  }

  .workloads-node-resource__name {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  .workloads-node-resource__metric {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .workloads-node-resource__metric :deep(.el-progress) {
    flex: 1;
  }

  .workloads-node-metrics {
    padding: 12px 4px 6px;
  }

  .workloads-node-metrics__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .workloads-node-metrics__item {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 12px;
    background: var(--el-fill-color-blank);
    min-height: 106px;
  }

  .workloads-node-metrics__title {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-bottom: 8px;
  }

  .workloads-node-metrics__value {
    color: var(--el-text-color-primary);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
  }

  .workloads-node-metrics__alloc {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .workloads-node-metrics__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  :deep(.event-type-tag.el-tag) {
    border: none;
    color: #fff;
  }

  :deep(.event-type-tag--normal.el-tag) {
    background-color: rgba(13, 185, 138, 0.14);
    color: #00c997;
  }

  :deep(.event-type-tag--warning.el-tag) {
    background-color: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
  }

  .workloads-log-toolbar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
  }

  .workloads-log-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .workloads-log-label {
    width: 68px;
    font-size: 13px;
    color: var(--el-text-color-primary);
    flex-shrink: 0;
  }

  .workloads-log-select {
    width: 210px;
  }

  .workloads-log-lines {
    width: 90px;
  }

  .workloads-log-suffix {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .workloads-log-refresh-icon {
    display: flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }

  .workloads-log-refresh-icon:hover {
    background: color-mix(in srgb, var(--art-gray-300) 45%, transparent);
  }

  .workloads-log-refresh-icon.is-spinning :deep(svg),
  .workloads-log-refresh-icon.is-spinning :deep(.i-svg) {
    animation: workloads-refresh-spin 0.9s linear infinite;
    transform-origin: center;
  }

  @keyframes workloads-refresh-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .workloads-log-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .workloads-log-search {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 320px;
  }

  .workloads-log-search :deep(.el-input) {
    flex: 1;
  }

  .workloads-log-table {
    margin-top: 12px;
  }

  .workloads-log-empty {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    padding: 16px 0;
  }

  .remote-login-select {
    width: 100%;
  }

  .mb-3 {
    margin-bottom: 12px;
  }
</style>
