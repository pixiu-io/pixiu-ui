<template>
  <div class="deploy-create-page">
    <div class="deploy-create-header">
      <ElButton text class="deploy-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="deploy-create-header-divider" />
      <ClusterResourceBreadcrumb
        parent-path="/container/workloads"
        parent-label="工作负载"
        :parent-query="{ tab: 'cj' }"
        current-label="创建 CronJob"
      />
    </div>

    <ElCard class="deploy-create-card">
      <div class="deploy-create-main">
        <ElForm
          ref="basicFormRef"
          :model="form"
          :rules="basicRules"
          label-width="140px"
          class="dc-form"
        >
          <ElDivider content-position="left" class="dc-section-divider-top">基础配置</ElDivider>
          <ElFormItem label="名称" prop="name">
            <div class="dc-field-col">
              <ElInput v-model="form.name" placeholder="请输入 CronJob 名称" style="width: 200px" />
              <div class="dc-field-tip"
                >最长 63
                个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾</div
              >
            </div>
          </ElFormItem>
          <ElFormItem label="命名空间" prop="namespace">
            <ElSelect
              v-model="form.namespace"
              filterable
              placeholder="请选择命名空间"
              style="width: 200px"
            >
              <ElOption v-for="ns in namespaces" :key="ns" :label="ns" :value="ns" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="Labels">
            <div class="dc-field-col">
              <div class="kv-list">
                <div v-for="(item, idx) in form.labels" :key="`label-${idx}`" class="kv-row">
                  <ElInput v-model="item.key" />
                  <ElInput v-model="item.value" />
                  <ElButton link class="kv-del-btn" @click="removeLabel(idx)"
                    ><ElIcon><Delete /></ElIcon
                  ></ElButton>
                </div>
                <ElButton link type="primary" class="kv-add-btn" @click="addLabel">新增</ElButton>
              </div>
              <div class="dc-field-tip"
                >键名不超过 63 个字符，只能包含字母、数字及分隔符（- _
                .），且必须以字母或数字开头和结尾</div
              >
            </div>
          </ElFormItem>
          <ElFormItem label="Annotations">
            <div class="dc-field-col">
              <div class="kv-list">
                <div
                  v-for="(item, idx) in form.annotations"
                  :key="`annotation-${idx}`"
                  class="kv-row"
                >
                  <ElInput v-model="item.key" />
                  <ElInput v-model="item.value" />
                  <ElButton link class="kv-del-btn" @click="removeAnnotation(idx)"
                    ><ElIcon><Delete /></ElIcon
                  ></ElButton>
                </div>
                <ElButton link type="primary" class="kv-add-btn" @click="addAnnotation"
                  >新增</ElButton
                >
              </div>
              <div class="dc-field-tip"
                >值为字符串类型无长度限制，建议保持简短并避免换行、空格等特殊字符</div
              >
            </div>
          </ElFormItem>

          <!-- 定时规则 -->
          <ElDivider content-position="left" class="dc-section-divider-top">Cronjob设置</ElDivider>
          <ElFormItem label="定时规则" prop="schedule">
            <div class="dc-field-col">
              <ElRadioGroup v-model="scheduleMode">
                <ElRadio value="daily">按天</ElRadio>
                <ElRadio value="weekly">按星期</ElRadio>
                <ElRadio value="monthly">按月</ElRadio>
                <ElRadio value="cron">Cron表达式</ElRadio>
              </ElRadioGroup>
              <div v-if="scheduleMode === 'daily'" class="schedule-daily-panel">
                <div class="schedule-builder schedule-builder--in-panel">
                  <span class="schedule-text">每</span>
                  <ElSelect
                    v-model="scheduleParams.interval"
                    placeholder="间隔"
                    style="width: 110px"
                  >
                    <ElOption
                      v-for="n in dailyIntervalOptions"
                      :key="n"
                      :label="String(n)"
                      :value="n"
                    />
                  </ElSelect>
                  <ElSelect v-model="scheduleParams.unit" placeholder="单位" style="width: 110px">
                    <ElOption label="小时" value="hour" />
                    <ElOption label="分钟" value="minute" />
                  </ElSelect>
                  <span class="schedule-text">执行一次</span>
                </div>
              </div>
              <div v-else-if="scheduleMode === 'weekly'" class="schedule-weekly-panel">
                <div class="schedule-builder schedule-builder--in-panel">
                  <span class="schedule-text">每</span>
                  <ElSelect
                    v-model="scheduleParams.weekday"
                    placeholder="星期"
                    style="width: 104px"
                  >
                    <ElOption
                      v-for="opt in WEEKDAY_SELECT_OPTIONS"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </ElSelect>
                  <ElSelect v-model="scheduleParams.hour" placeholder="时" style="width: 88px">
                    <ElOption
                      v-for="h in CRON_HOUR_OPTIONS"
                      :key="h"
                      :label="String(h)"
                      :value="h"
                    />
                  </ElSelect>
                  <span class="schedule-text">时</span>
                  <ElSelect v-model="scheduleParams.minute" placeholder="分" style="width: 88px">
                    <ElOption
                      v-for="m in CRON_MINUTE_OPTIONS"
                      :key="m"
                      :label="String(m)"
                      :value="m"
                    />
                  </ElSelect>
                  <span class="schedule-text">分</span>
                  <span class="schedule-text">执行一次</span>
                </div>
              </div>
              <div v-else-if="scheduleMode === 'monthly'" class="schedule-monthly-panel">
                <div class="schedule-builder schedule-builder--in-panel">
                  <span class="schedule-text">每</span>
                  <ElSelect
                    v-model="scheduleParams.monthInterval"
                    placeholder="月"
                    style="width: 88px"
                  >
                    <ElOption
                      v-for="n in MONTH_INTERVAL_OPTIONS"
                      :key="n"
                      :label="String(n)"
                      :value="n"
                    />
                  </ElSelect>
                  <span class="schedule-text">个月</span>
                  <ElSelect v-model="scheduleParams.monthDay" placeholder="日" style="width: 88px">
                    <ElOption
                      v-for="d in MONTH_DAY_OPTIONS"
                      :key="d"
                      :label="String(d)"
                      :value="d"
                    />
                  </ElSelect>
                  <span class="schedule-text">日</span>
                  <ElSelect v-model="scheduleParams.hour" placeholder="时" style="width: 88px">
                    <ElOption
                      v-for="h in CRON_HOUR_OPTIONS"
                      :key="h"
                      :label="String(h)"
                      :value="h"
                    />
                  </ElSelect>
                  <span class="schedule-text">时</span>
                  <ElSelect v-model="scheduleParams.minute" placeholder="分" style="width: 88px">
                    <ElOption
                      v-for="m in CRON_MINUTE_OPTIONS"
                      :key="m"
                      :label="String(m)"
                      :value="m"
                    />
                  </ElSelect>
                  <span class="schedule-text">分</span>
                  <span class="schedule-text">执行一次</span>
                </div>
              </div>
              <div v-else class="schedule-cron-panel">
                <ElInput v-model="form.schedule" class="schedule-cron-expr-input" clearable />
                <div class="dc-field-tip schedule-cron-format-hint">
                  格式：分 时 日 月 周（如
                  <span class="schedule-cron-example">0 0 * * *</span>
                  表示每天 00:00 执行一次）
                </div>
              </div>
            </div>
          </ElFormItem>

          <!-- 保留策略 -->
          <ElFormItem label="保留成功Job数">
            <div class="dc-field-col">
              <ElInputNumber
                v-model="form.successfulJobsHistoryLimit"
                :min="0"
                :precision="0"
                style="width: 160px"
              />
              <div class="dc-field-tip"
                >对应 spec.successfulJobsHistoryLimit，保留已完成 Job 的历史记录条数</div
              >
            </div>
          </ElFormItem>
          <ElFormItem label="保留失败Job数">
            <div class="dc-field-col">
              <ElInputNumber
                v-model="form.failedJobsHistoryLimit"
                :min="0"
                :precision="0"
                style="width: 160px"
              />
              <div class="dc-field-tip"
                >对应 spec.failedJobsHistoryLimit，保留失败 Job 的历史记录条数</div
              >
            </div>
          </ElFormItem>

          <!-- Job 设置 -->
          <ElFormItem label="Job设置" class="dc-job-settings-form-item">
            <div class="dc-job-settings">
              <div class="dc-job-settings-row">
                <span class="dc-job-settings-label">
                  重复次数
                  <ElTooltip content="Pod 成功运行的次数，默认为 1" placement="top">
                    <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                  </ElTooltip>
                </span>
                <ElInputNumber v-model="form.completions" :min="1" :precision="0" style="width: 160px" />
                <span class="dc-job-settings-tip">默认为 1</span>
              </div>
              <div class="dc-job-settings-row">
                <span class="dc-job-settings-label">
                  并行度
                  <ElTooltip content="同时运行的 Pod 数量，默认为 1" placement="top">
                    <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                  </ElTooltip>
                </span>
                <ElInputNumber v-model="form.parallelism" :min="1" :precision="0" style="width: 160px" />
                <span class="dc-job-settings-tip">默认为 1</span>
              </div>
              <div class="dc-job-settings-row">
                <span class="dc-job-settings-label">
                  失败重启策略
                  <ElTooltip content="容器失败时的重启策略" placement="top">
                    <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                  </ElTooltip>
                </span>
                <ElSelect
                  v-model="form.restartPolicy"
                  style="width: 160px"
                  class="restart-policy-select"
                  popper-class="restart-policy-popper"
                >
                  <ElOption label="OnFailure" value="OnFailure" />
                  <ElOption label="Never" value="Never" />
                </ElSelect>
                <span class="dc-job-settings-tip">容器失败时的重启策略</span>
              </div>
            </div>
          </ElFormItem>

          <!-- 可抢占 -->
          <ElFormItem label="可抢占">
            <div class="advanced-field-wrap">
              <ElSwitch v-model="form.preemptible" />
              <div class="dc-field-tip"
                >开启后，Pod 使用 preemptible 优先级，可被更高优先级任务抢占调度资源</div
              >
            </div>
          </ElFormItem>

          <ElFormItem label="数据卷（选填）">
            <div class="dc-field-col">
              <div class="kv-list">
                <div
                  v-for="(vol, idx) in form.volumes"
                  :key="`vol-basic-${idx}`"
                  class="vol-display-row"
                >
                  <span>数据卷名称：{{ vol.name }}</span>
                  <span>数据卷类型：{{ volTypeLabel(vol.type) }}</span>
                  <span v-if="vol.type === 'configMap'"
                    >{{ vol.configMapName || '-' }} {{ vol.configMapKey || '全部Key' }}</span
                  >
                  <div class="vol-display-actions">
                    <ElButton link class="kv-del-btn" @click="openEditVolume(idx)"
                      ><ElIcon><EditPen /></ElIcon
                    ></ElButton>
                    <ElButton link class="kv-del-btn" @click="removeVolume(idx)"
                      ><ElIcon><Close /></ElIcon
                    ></ElButton>
                  </div>
                </div>
                <ElButton link type="primary" class="kv-add-btn" @click="openAddVolume"
                  >添加数据卷</ElButton
                >
              </div>
              <div class="dc-field-tip"
                >为容器提供存储，目前支持临时路径（emptyDir）和配置文件（ConfigMap），还需在容器配置中挂载到指定路径</div
              >
            </div>
          </ElFormItem>
          <ElFormItem label="实例内容器" class="container-form-item">
            <div class="container-pane">
              <div class="container-tabs-bar">
                <div
                  v-for="(c, idx) in form.containers"
                  :key="idx"
                  class="container-tab-item"
                  :class="{
                    'is-active': idx === activeContainerIdx,
                    'is-invalid': isContainerInvalid(c)
                  }"
                  @click="activeContainerIdx = idx"
                >
                  <span class="container-tab-name">{{ c.name || `container-${idx + 1}` }}</span>
                  <ElIcon
                    v-if="form.containers.length > 1"
                    class="container-tab-close"
                    @click.stop="removeContainer(idx)"
                    ><Close
                  /></ElIcon>
                </div>
                <ElButton link type="primary" class="add-container-btn" @click="addContainer">
                  <ElIcon><Plus /></ElIcon>添加容器
                </ElButton>
              </div>

              <div class="container-form-wrap">
                <ElForm
                  ref="containerFormRef"
                  :model="form.containers[activeContainerIdx]"
                  :rules="containerRules"
                  label-width="110px"
                  class="dc-form container-dc-form"
                >
                  <ElDivider
                    content-position="left"
                    class="dc-section-divider-top"
                    style="visibility: hidden; margin: 0"
                  />
                  <ElFormItem label="容器名称" prop="name" class="container-name-form-item">
                    <div class="container-name-field-col">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].name"
                        placeholder="请输入容器名称"
                        style="width: 300px"
                      />
                      <div class="dc-field-tip container-name-tip">
                        最长 63
                        个字符，只能包含小写字母、数字及分隔符（-），且不能以分隔符开头或结尾。
                      </div>
                    </div>
                  </ElFormItem>
                  <ElFormItem label="镜像" prop="image">
                    <ElInput
                      v-model="form.containers[activeContainerIdx].image"
                      placeholder="请输入完整的镜像地址"
                      style="width: 460px"
                    />
                  </ElFormItem>
                  <ElFormItem label="镜像版本">
                    <ElInput
                      v-model="form.containers[activeContainerIdx].imageTag"
                      placeholder="不填默认为 latest"
                      style="width: 460px"
                    />
                  </ElFormItem>

                  <ElFormItem label="拉取策略">
                    <div class="advanced-field-wrap">
                      <ElRadioGroup
                        v-model="form.containers[activeContainerIdx].imagePullPolicy"
                        class="pull-policy-group"
                      >
                        <ElRadioButton label="Always" value="Always" />
                        <ElRadioButton label="IfNotPresent" value="IfNotPresent" />
                        <ElRadioButton label="Never" value="Never" />
                      </ElRadioGroup>
                      <div class="dc-field-tip">
                        <template
                          v-if="form.containers[activeContainerIdx].imagePullPolicy === 'Always'"
                          >总是从远程拉取该镜像</template
                        >
                        <template
                          v-else-if="
                            form.containers[activeContainerIdx].imagePullPolicy === 'IfNotPresent'
                          "
                          >默认使用本地镜像，若本地无该镜像则远程拉取该镜像</template
                        >
                        <template v-else>只使用本地镜像，若本地没有该镜像将报异常</template>
                      </div>
                    </div>
                  </ElFormItem>
                  <ElFormItem label="环境变量">
                    <div class="kv-list">
                      <div
                        v-for="(item, idx) in form.containers[activeContainerIdx].envs"
                        :key="`env-${idx}`"
                        class="env-row"
                      >
                        <ElSelect v-model="item.mode" style="width: 140px">
                          <ElOption label="自定义" value="value" />
                        </ElSelect>
                        <ElInput v-model="item.name" placeholder="变量名称" style="width: 200px" />
                        <ElInput
                          v-if="item.mode === 'value'"
                          v-model="item.value"
                          placeholder="变量值"
                          style="width: 200px"
                        />
                        <template v-else>
                          <ElInput v-model="item.sourceName" placeholder="来源名称" />
                          <ElInput v-model="item.sourceKey" placeholder="键名 key" />
                        </template>
                        <ElButton
                          link
                          type="danger"
                          class="kv-del-btn env-del-btn"
                          title="删除"
                          @click="removeEnv(idx)"
                          ><ElIcon><Close /></ElIcon
                        ></ElButton>
                      </div>
                      <ElButton link type="primary" class="kv-add-btn" @click="addEnv"
                        >新增变量</ElButton
                      >
                    </div>
                  </ElFormItem>
                  <ElFormItem
                    label="CPU/内存限制"
                    label-width="110px"
                    class="cpu-mem-limit-form-item"
                  >
                    <div class="cpu-mem-limit-wrap">
                      <div class="cpu-mem-limit-block">
                        <div class="cpu-mem-limit-block-title">CPU限制</div>
                        <div class="cpu-mem-limit-inputs">
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">request</span>
                            <ElInput
                              v-model="form.containers[activeContainerIdx].cpuRequest"
                              placeholder="不限制"
                              class="resource-affix-input"
                            />
                          </div>
                          <span class="resource-affix-sep">-</span>
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">limit</span>
                            <ElInput
                              v-model="form.containers[activeContainerIdx].cpuLimit"
                              placeholder="不限制"
                              class="resource-affix-input"
                            />
                          </div>
                          <span class="resource-unit-suffix">核</span>
                        </div>
                      </div>
                      <div class="cpu-mem-limit-block">
                        <div class="cpu-mem-limit-block-title">内存限制</div>
                        <div class="cpu-mem-limit-inputs">
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">request</span>
                            <ElInput
                              v-model="form.containers[activeContainerIdx].memoryRequest"
                              placeholder="不限制"
                              class="resource-affix-input"
                            />
                          </div>
                          <span class="resource-affix-sep">-</span>
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">limit</span>
                            <ElInput
                              v-model="form.containers[activeContainerIdx].memoryLimit"
                              placeholder="不限制"
                              class="resource-affix-input"
                            />
                          </div>
                          <span class="resource-unit-suffix">MiB</span>
                        </div>
                      </div>
                    </div>
                    <div class="cpu-mem-limit-tips">
                      <div class="dc-field-tip cpu-mem-tip-line">
                        Request 用于预分配资源，当集群中的节点没有 request
                        所要求的资源数量时，容器会创建失败。
                      </div>
                      <div class="dc-field-tip cpu-mem-tip-line">
                        Limit 用于设置容器使用资源的最大上限，避免异常情况下节点资源消耗过多。
                      </div>
                    </div>
                  </ElFormItem>
                  <ElFormItem label="容器端口">
                    <div class="port-table">
                      <div
                        v-if="form.containers[activeContainerIdx].ports.length"
                        class="port-table-box"
                      >
                        <div class="port-table-header">
                          <span class="port-col-name">端口名称</span>
                          <span class="port-col-protocol">协议</span>
                          <span class="port-col-port">端口</span>
                        </div>
                        <div
                          v-for="(item, idx) in form.containers[activeContainerIdx].ports"
                          :key="`port-${idx}`"
                          class="port-table-row"
                        >
                          <ElInput v-model="item.name" class="port-col-name" placeholder="" />
                          <ElSelect v-model="item.protocol" class="port-col-protocol">
                            <ElOption label="TCP" value="TCP" />
                            <ElOption label="UDP" value="UDP" />
                            <ElOption label="SCTP" value="SCTP" />
                          </ElSelect>
                          <ElInput
                            :model-value="item.containerPort ? String(item.containerPort) : ''"
                            class="port-col-port"
                            placeholder="端口"
                            @input="
                              (v: string) => {
                                const n = parseInt(v.replace(/\D/g, ''))
                                item.containerPort =
                                  n > 0 && n <= 65535 ? n : item.containerPort || 80
                              }
                            "
                          />
                          <ElButton link class="kv-del-btn port-del-btn" @click="removePort(idx)"
                            ><ElIcon><Close /></ElIcon
                          ></ElButton>
                        </div>
                      </div>
                      <ElButton link type="primary" class="kv-add-btn" @click="addPort"
                        >添加容器端口</ElButton
                      >
                    </div>
                  </ElFormItem>
                  <div class="container-advanced-config-toggle">
                    <ElButton
                      link
                      type="primary"
                      class="kv-add-btn"
                      @click="showContainerAdvancedConfig = !showContainerAdvancedConfig"
                    >
                      {{ showContainerAdvancedConfig ? '隐藏高级配置' : '显示高级配置' }}
                    </ElButton>
                  </div>
                  <template v-if="showContainerAdvancedConfig">
                    <ElFormItem label="初始化容器">
                      <div class="advanced-field-wrap">
                        <ElSwitch v-model="form.containers[activeContainerIdx].initContainer" />
                        <div class="dc-field-tip">容器标识为init container</div>
                      </div>
                    </ElFormItem>
                    <ElFormItem label="特权级容器">
                      <div class="advanced-field-wrap">
                        <ElSwitch v-model="form.containers[activeContainerIdx].privileged" />
                        <div class="dc-field-tip">容器开启特权级，将拥有宿主机的root权限</div>
                      </div>
                    </ElFormItem>
                    <ElFormItem label="运行命令">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].commandText"
                        type="textarea"
                        :rows="3"
                        style="width: 350px"
                        placeholder="每行一个 command 参数，如 /bin/sh"
                      />
                    </ElFormItem>
                    <ElFormItem label="运行参数">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].argsText"
                        type="textarea"
                        :rows="3"
                        style="width: 350px"
                        placeholder="每行一个 args 参数，如 -c"
                      />
                    </ElFormItem>
                    <ElFormItem label="生命周期">
                      <div class="lifecycle-wrap">
                        <div class="lifecycle-section">
                          <div class="lifecycle-section-label">
                            <span>启动后执行</span>
                            <ElTooltip
                              content="容器启动后执行的命令（postStart hook）"
                              placement="top"
                            >
                              <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                            </ElTooltip>
                            <ElButton
                              link
                              type="primary"
                              class="kv-add-btn lifecycle-add-btn"
                              @click="addPostStart"
                              >新增</ElButton
                            >
                          </div>
                          <div class="lifecycle-inputs">
                            <div
                              v-for="(cmd, ci) in form.containers[activeContainerIdx]
                                .postStartCommands"
                              :key="`post-${ci}`"
                              class="lifecycle-input-row"
                            >
                              <ElInput
                                v-model="form.containers[activeContainerIdx].postStartCommands[ci]"
                                type="textarea"
                                :rows="3"
                                placeholder="为避免解析错误，注意每条命令需单独在一个输入框输入"
                                class="lifecycle-textarea"
                              />
                              <ElButton
                                link
                                class="kv-del-btn lifecycle-del-btn"
                                @click="removePostStart(ci)"
                              >
                                <ElIcon><Close /></ElIcon>
                              </ElButton>
                            </div>
                          </div>
                        </div>
                        <div class="lifecycle-section">
                          <div class="lifecycle-section-label">
                            <span>结束前执行</span>
                            <ElTooltip
                              content="容器终止前执行的命令（preStop hook）"
                              placement="top"
                            >
                              <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                            </ElTooltip>
                            <ElButton
                              link
                              type="primary"
                              class="kv-add-btn lifecycle-add-btn"
                              @click="addPreStop"
                              >新增</ElButton
                            >
                          </div>
                          <div class="lifecycle-inputs">
                            <div
                              v-for="(cmd, ci) in form.containers[activeContainerIdx]
                                .preStopCommands"
                              :key="`pre-${ci}`"
                              class="lifecycle-input-row"
                            >
                              <ElInput
                                v-model="form.containers[activeContainerIdx].preStopCommands[ci]"
                                type="textarea"
                                :rows="3"
                                placeholder="为避免解析错误，注意每条命令需单独在一个输入框输入"
                                class="lifecycle-textarea"
                              />
                              <ElButton
                                link
                                class="kv-del-btn lifecycle-del-btn"
                                @click="removePreStop(ci)"
                              >
                                <ElIcon><Close /></ElIcon>
                              </ElButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ElFormItem>
                    <ElFormItem class="health-check-form-item">
                      <template #label>
                        <span>容器健康检查</span>
                        <ElTooltip content="配置容器存活检查与就绪检查" placement="top">
                          <ElIcon class="lifecycle-info-icon" style="margin-left: 4px"
                            ><InfoFilled
                          /></ElIcon>
                        </ElTooltip>
                      </template>
                      <div class="health-check-wrap">
                        <!-- 存活检查 -->
                        <div class="health-check-row">
                          <ElCheckbox
                            v-model="form.containers[activeContainerIdx].liveness.enabled"
                          />
                          <span class="health-check-title">存活检查</span>
                          <span class="health-check-desc">检查容器是否正常，不正常则重启实例</span>
                        </div>
                        <div
                          v-if="form.containers[activeContainerIdx].liveness.enabled"
                          class="health-check-panel"
                        >
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查方法</span>
                            <ElSelect
                              v-model="form.containers[activeContainerIdx].liveness.method"
                              style="width: 200px"
                            >
                              <ElOption label="TCP端口检查" value="tcp" />
                              <ElOption label="HTTP请求检查" value="http" />
                              <ElOption label="执行命令检查" value="exec" />
                            </ElSelect>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              host
                              <ElTooltip
                                content="大多数情况下不需要填 host 字段，请谨慎填写防止探测失败"
                                placement="top"
                              >
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <ElInput
                                v-model="form.containers[activeContainerIdx].liveness.host"
                                placeholder="默认为 Pod IP，一般不需要修改"
                                style="width: 200px"
                              />
                              <div class="dc-field-tip"
                                >大多数情况下不需要填 host 字段，请谨慎填写防止探测失败</div
                              >
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查端口</span>
                            <div class="probe-field-col">
                              <ElInput
                                v-model="form.containers[activeContainerIdx].liveness.port"
                                placeholder="请输入检查端口"
                                style="width: 200px"
                              />
                              <div class="dc-field-tip">端口范围：1~65535，支持使用端口名</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              启动延时
                              <ElTooltip content="容器启动后等待多少秒才开始探测" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <div class="probe-input-unit">
                                <ElInput
                                  v-model.number="
                                    form.containers[activeContainerIdx].liveness.initialDelaySeconds
                                  "
                                  placeholder="请输入启动延时"
                                  style="width: 220px"
                                />
                                <span class="probe-unit">秒</span>
                              </div>
                              <div class="dc-field-tip">启动延时最小值为0秒，默认为不设置</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              响应超时
                              <ElTooltip content="探测超时时间，超过则判定失败" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <div class="probe-input-unit">
                                <ElInput
                                  v-model.number="
                                    form.containers[activeContainerIdx].liveness.timeoutSeconds
                                  "
                                  placeholder="请输入响应超时"
                                  style="width: 220px"
                                />
                                <span class="probe-unit">秒</span>
                              </div>
                              <div class="dc-field-tip">响应超时最小值为1秒，默认为1秒</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              间隔时间
                              <ElTooltip content="两次探测之间的时间间隔" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <div class="probe-input-unit">
                                <ElInput
                                  v-model.number="
                                    form.containers[activeContainerIdx].liveness.periodSeconds
                                  "
                                  placeholder="请输入间隔时间"
                                  style="width: 220px"
                                />
                                <span class="probe-unit">秒</span>
                              </div>
                              <div class="dc-field-tip">间隔时间最小值为1秒，默认为10秒</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              健康阈值
                              <ElTooltip content="连续成功多少次才认为健康" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-input-unit">
                              <ElInput
                                v-model.number="
                                  form.containers[activeContainerIdx].liveness.successThreshold
                                "
                                style="width: 220px"
                              />
                              <span class="probe-unit">次</span>
                            </div>
                          </div>
                        </div>
                        <!-- 就绪检查 -->
                        <div class="health-check-row" style="margin-top: 8px">
                          <ElCheckbox
                            v-model="form.containers[activeContainerIdx].readiness.enabled"
                          />
                          <span class="health-check-title">就绪检查</span>
                          <span class="health-check-desc"
                            >检查容器是否就绪，未就绪则不接收流量</span
                          >
                        </div>
                        <div
                          v-if="form.containers[activeContainerIdx].readiness.enabled"
                          class="health-check-panel"
                        >
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查方法</span>
                            <ElSelect
                              v-model="form.containers[activeContainerIdx].readiness.method"
                              style="width: 200px"
                            >
                              <ElOption label="TCP端口检查" value="tcp" />
                              <ElOption label="HTTP请求检查" value="http" />
                              <ElOption label="执行命令检查" value="exec" />
                            </ElSelect>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              host
                              <ElTooltip
                                content="大多数情况下不需要填 host 字段，请谨慎填写防止探测失败"
                                placement="top"
                              >
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <ElInput
                                v-model="form.containers[activeContainerIdx].readiness.host"
                                placeholder="默认为 Pod IP，一般不需要修改"
                                style="width: 200px"
                              />
                              <div class="dc-field-tip"
                                >大多数情况下不需要填 host 字段，请谨慎填写防止探测失败</div
                              >
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查端口</span>
                            <div class="probe-field-col">
                              <ElInput
                                v-model="form.containers[activeContainerIdx].readiness.port"
                                placeholder="请输入检查端口"
                                style="width: 200px"
                              />
                              <div class="dc-field-tip">端口范围：1~65535，支持使用端口名</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              启动延时
                              <ElTooltip content="容器启动后等待多少秒才开始探测" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <div class="probe-input-unit">
                                <ElInput
                                  v-model.number="
                                    form.containers[activeContainerIdx].readiness
                                      .initialDelaySeconds
                                  "
                                  placeholder="请输入启动延时"
                                  style="width: 220px"
                                />
                                <span class="probe-unit">秒</span>
                              </div>
                              <div class="dc-field-tip">启动延时最小值为0秒，默认为不设置</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              响应超时
                              <ElTooltip content="探测超时时间，超过则判定失败" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <div class="probe-input-unit">
                                <ElInput
                                  v-model.number="
                                    form.containers[activeContainerIdx].readiness.timeoutSeconds
                                  "
                                  placeholder="请输入响应超时"
                                  style="width: 220px"
                                />
                                <span class="probe-unit">秒</span>
                              </div>
                              <div class="dc-field-tip">响应超时最小值为1秒，默认为1秒</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              间隔时间
                              <ElTooltip content="两次探测之间的时间间隔" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <div class="probe-input-unit">
                                <ElInput
                                  v-model.number="
                                    form.containers[activeContainerIdx].readiness.periodSeconds
                                  "
                                  placeholder="请输入间隔时间"
                                  style="width: 220px"
                                />
                                <span class="probe-unit">秒</span>
                              </div>
                              <div class="dc-field-tip">间隔时间最小值为1秒，默认为10秒</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              健康阈值
                              <ElTooltip content="连续成功多少次才认为就绪" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-input-unit">
                              <ElInput
                                v-model.number="
                                  form.containers[activeContainerIdx].readiness.successThreshold
                                "
                                style="width: 220px"
                              />
                              <span class="probe-unit">次</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ElFormItem>
                  </template>
                  <ElFormItem :label-width="0" class="volume-mounts-form-item">
                    <div class="kv-list">
                      <div
                        v-for="(item, idx) in form.containers[activeContainerIdx].volumeMounts"
                        :key="`vm-${idx}`"
                        class="vm-row"
                      >
                        <ElInput v-model="item.name" placeholder="卷名(name)" />
                        <ElInput v-model="item.mountPath" placeholder="挂载路径(mountPath)" />
                        <ElSwitch
                          v-model="item.readOnly"
                          inline-prompt
                          active-text="只读"
                          inactive-text="读写"
                        />
                        <ElButton link type="primary" @click="removeVolumeMount(idx)"
                          >删除</ElButton
                        >
                      </div>
                    </div>
                  </ElFormItem>
                </ElForm>
              </div>
            </div>
          </ElFormItem>
          <ElFormItem label="镜像访问凭证">
            <div class="pull-secret-wrap">
              <div v-if="showPullSecretSelect" class="pull-secret-row">
                <ElSelect
                  v-model="form.imagePullSecret"
                  placeholder="不指定访问凭证"
                  style="width: 200px"
                  filterable
                >
                  <ElOption v-for="s in pullSecrets" :key="s" :label="s" :value="s" />
                </ElSelect>
                <ElButton link class="pull-secret-icon-btn" @click="loadPullSecrets">
                  <ElIcon><Refresh /></ElIcon>
                </ElButton>
                <ElButton link class="pull-secret-icon-btn" @click="clearPullSecret">
                  <ElIcon><Close /></ElIcon>
                </ElButton>
              </div>
              <ElButton link type="primary" class="kv-add-btn" @click="onAddPullSecret"
                >添加镜像访问凭证</ElButton
              >
              <div
                class="dc-field-tip"
                style="
                  margin-top: -10px;
                  display: flex;
                  align-items: center;
                  gap: 2px;
                  white-space: nowrap;
                "
              >
                请指定镜像访问凭证以拉取私有镜像 实现免密拉取；如无合适的访问凭证，请
                <ElButton
                  link
                  type="primary"
                  class="kv-add-btn"
                  style="padding: 0; flex-shrink: 0"
                  @click="newSecretDialogVisible = true"
                  >新建访问凭证</ElButton
                >
              </div>
            </div>
          </ElFormItem>
          <ElFormItem label="节点调度策略">
            <div class="scheduling-policy-wrap">
              <ElRadioGroup v-model="form.schedulingPolicy">
                <ElRadio value="default">使用默认调度规则</ElRadio>
                <ElRadio value="custom" disabled>自定义调度规则</ElRadio>
              </ElRadioGroup>
              <div class="dc-field-tip">
                默认调度规则由 Kubernetes 调度器自动分配节点，无需手动干预
              </div>
            </div>
          </ElFormItem>
        </ElForm>
      </div>

      <div class="deploy-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建 CronJob</ElButton>
      </div>
    </ElCard>

    <ElDialog
      v-model="volumeDialogVisible"
      :title="volumeDialogIsEdit ? '编辑数据卷' : '添加数据卷'"
      width="520px"
      class="vol-dialog"
    >
      <ElForm :model="volumeDialogForm" label-width="100px" style="padding-right: 45px">
        <ElFormItem label="数据卷类型">
          <ElSelect v-model="volumeDialogForm.type" style="width: 100%">
            <ElOption label="使用临时目录" value="emptyDir" />
            <ElOption label="使用ConfigMap" value="configMap" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="数据卷名称">
          <ElInput
            v-model="volumeDialogForm.name"
            placeholder="如 config-vol"
            style="width: 100%"
          />
        </ElFormItem>
        <template v-if="volumeDialogForm.type === 'configMap'">
          <ElFormItem label="ConfigMap">
            <ElInput
              v-model="volumeDialogForm.configMapName"
              placeholder="ConfigMap 名称"
              style="width: 100%"
            />
          </ElFormItem>
          <ElFormItem label="Key">
            <ElInput
              v-model="volumeDialogForm.configMapKey"
              placeholder="留空表示全部 Key"
              style="width: 100%"
            />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <ElButton @click="volumeDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveVolume">确定</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="newSecretDialogVisible" title="新建访问凭证" width="480px">
      <ElForm :model="newSecretForm" label-width="100px" style="padding-right: 24px">
        <ElFormItem label="名称">
          <ElInput v-model="newSecretForm.name" placeholder="请输入名称" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="镜像仓库域名">
          <ElInput
            v-model="newSecretForm.server"
            placeholder="请输入仓库域名或者IP"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="用户名">
          <ElInput
            v-model="newSecretForm.username"
            placeholder="请输入等了镜像仓库的用户名"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="密码">
          <ElInput
            v-model="newSecretForm.password"
            type="password"
            placeholder="请输入等了镜像仓库的密码"
            show-password
            style="width: 100%"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="newSecretDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="newSecretSubmitting" @click="submitNewSecret"
          >确定</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import {
    ArrowLeft,
    Delete,
    EditPen,
    Close,
    Refresh,
    Plus,
    InfoFilled
  } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { createK8sCronJob } from '@/api/kubernetes/cronjob'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { fetchK8sSecretList } from '@/api/kubernetes/secret'
  import ClusterResourceBreadcrumb from '../components/cluster-resource-breadcrumb.vue'

  defineOptions({ name: 'CronJobCreatePage' })

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))

  // 定时规则
  /** 按星期：Cron 星期字段 0=周日 … 6=周六 */
  const WEEKDAY_SELECT_OPTIONS = [
    { label: '周日', value: 0 },
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 }
  ]
  const CRON_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)
  const CRON_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i)
  const MONTH_INTERVAL_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)
  const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)
  // 按天：每 N 小时 → 0 */N * * *；每 N 分钟 → */N * * * *
  const DAILY_HOUR_INTERVALS = Array.from({ length: 23 }, (_, i) => i + 1)
  const DAILY_MINUTE_INTERVALS = Array.from({ length: 59 }, (_, i) => i + 1)
  const scheduleMode = ref<'daily' | 'weekly' | 'monthly' | 'cron'>('daily')
  const scheduleParams = reactive({
    interval: 12,
    unit: 'hour' as 'hour' | 'minute',
    weekday: 1,
    monthInterval: 1,
    monthDay: 1,
    hour: 0,
    minute: 0
  })

  const namespaces = ref<string[]>([])
  const submitting = ref(false)

  type ContainerConfig = {
    name: string
    image: string
    imageTag: string
    imagePullPolicy: 'IfNotPresent' | 'Always' | 'Never'
    ports: Array<{ containerPort: number; name: string; protocol: 'TCP' | 'UDP' | 'SCTP' }>
    envs: Array<{
      name: string
      mode: 'value' | 'configMap' | 'secret'
      value: string
      sourceName: string
      sourceKey: string
    }>
    commandText: string
    argsText: string
    cpuRequest: string
    cpuLimit: string
    memoryRequest: string
    memoryLimit: string
    liveness: {
      enabled: boolean
      method: 'tcp' | 'http' | 'exec'
      host: string
      port: string
      path: string
      initialDelaySeconds: number
      timeoutSeconds: number
      periodSeconds: number
      successThreshold: number
      failureThreshold: number
    }
    readiness: {
      enabled: boolean
      method: 'tcp' | 'http' | 'exec'
      host: string
      port: string
      path: string
      initialDelaySeconds: number
      timeoutSeconds: number
      periodSeconds: number
      successThreshold: number
      failureThreshold: number
    }
    volumeMounts: Array<{ name: string; mountPath: string; readOnly: boolean }>
    initContainer: boolean
    privileged: boolean
    postStartCommands: string[]
    preStopCommands: string[]
  }

  function newContainer(_idx: number): ContainerConfig {
    return {
      name: '',
      image: '',
      imageTag: '',
      imagePullPolicy: 'IfNotPresent',
      ports: [],
      envs: [],
      commandText: '',
      argsText: '',
      cpuRequest: '',
      cpuLimit: '',
      memoryRequest: '',
      memoryLimit: '',
      liveness: {
        enabled: false,
        method: 'tcp' as const,
        host: '',
        port: '',
        path: '',
        initialDelaySeconds: 0,
        timeoutSeconds: 1,
        periodSeconds: 10,
        successThreshold: 1,
        failureThreshold: 3
      },
      readiness: {
        enabled: false,
        method: 'tcp' as const,
        host: '',
        port: '',
        path: '',
        initialDelaySeconds: 0,
        timeoutSeconds: 1,
        periodSeconds: 10,
        successThreshold: 1,
        failureThreshold: 3
      },
      volumeMounts: [],
      initContainer: false,
      privileged: false,
      postStartCommands: [],
      preStopCommands: []
    }
  }

  const activeContainerIdx = ref(0)

  const form = ref({
    name: '',
    namespace: '',
    labels: [] as Array<{ key: string; value: string }>,
    annotations: [] as Array<{ key: string; value: string }>,
    volumes: [] as Array<{
      name: string
      type: 'emptyDir' | 'configMap'
      configMapName: string
      configMapKey: string
    }>,
    containers: [newContainer(0)] as ContainerConfig[],
    schedule: '0 */12 * * *',
    successfulJobsHistoryLimit: 3,
    failedJobsHistoryLimit: 1,
    completions: 1,
    parallelism: 1,
    restartPolicy: 'OnFailure' as 'OnFailure' | 'Never',
    imagePullSecret: '',
    schedulingPolicy: 'default' as 'default' | 'custom',
    preemptible: false
  })

  const basicFormRef = ref<FormInstance>()
  const containerFormRef = ref<FormInstance>()

  const dailyIntervalOptions = computed(() =>
    scheduleParams.unit === 'hour' ? DAILY_HOUR_INTERVALS : DAILY_MINUTE_INTERVALS
  )

  watch(
    () => scheduleParams.unit,
    () => {
      const max = scheduleParams.unit === 'hour' ? 23 : 59
      if (scheduleParams.interval > max) scheduleParams.interval = max
      if (scheduleParams.interval < 1) scheduleParams.interval = 1
    }
  )

  // 根据选择模式自动计算 cron 表达式
  function computeSchedule(): string {
    if (scheduleMode.value === 'daily') {
      if (scheduleParams.unit === 'hour') {
        const h =
          scheduleParams.interval >= 1 && scheduleParams.interval <= 23
            ? scheduleParams.interval
            : 12
        return `0 */${h} * * *`
      }
      const m =
        scheduleParams.interval >= 1 && scheduleParams.interval <= 59 ? scheduleParams.interval : 1
      return `*/${m} * * * *`
    } else if (scheduleMode.value === 'weekly') {
      const dow =
        scheduleParams.weekday >= 0 && scheduleParams.weekday <= 6 ? scheduleParams.weekday : 1
      const h = scheduleParams.hour >= 0 && scheduleParams.hour <= 23 ? scheduleParams.hour : 0
      const min =
        scheduleParams.minute >= 0 && scheduleParams.minute <= 59 ? scheduleParams.minute : 0
      return `${min} ${h} * * ${dow}`
    } else if (scheduleMode.value === 'monthly') {
      const mi =
        scheduleParams.monthInterval >= 1 && scheduleParams.monthInterval <= 12
          ? scheduleParams.monthInterval
          : 1
      const dom =
        scheduleParams.monthDay >= 1 && scheduleParams.monthDay <= 31 ? scheduleParams.monthDay : 1
      const h = scheduleParams.hour >= 0 && scheduleParams.hour <= 23 ? scheduleParams.hour : 0
      const min =
        scheduleParams.minute >= 0 && scheduleParams.minute <= 59 ? scheduleParams.minute : 0
      const monthField = mi === 1 ? '*' : `*/${mi}`
      return `${min} ${h} ${dom} ${monthField} *`
    }
    return form.value.schedule
  }

  watch(
    [scheduleMode, scheduleParams],
    () => {
      if (scheduleMode.value !== 'cron') {
        form.value.schedule = computeSchedule()
      }
    },
    { deep: true, immediate: true }
  )

  const basicRules: FormRules = {
    name: [
      { required: true, message: '请输入名称', trigger: 'blur' },
      { min: 2, max: 63, message: '长度 2-63', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '名称需符合 Kubernetes 命名规范（小写字母/数字/中划线）',
        trigger: 'blur'
      }
    ],
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }],
    schedule: [{ required: true, message: '请输入定时规则', trigger: 'blur' }]
  }
  const containerRules: FormRules = {
    name: [
      { required: true, message: '请输入容器名称', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        message: '容器名称需符合 Kubernetes 命名规范',
        trigger: 'blur'
      }
    ],
    image: [{ required: true, message: '请输入镜像', trigger: 'blur' }]
  }

  function kvPairsToObject(list: Array<{ key: string; value: string }>): Record<string, string> {
    return list.reduce<Record<string, string>>((acc, item) => {
      const key = item.key.trim()
      if (!key) return acc
      acc[key] = item.value.trim()
      return acc
    }, {})
  }

  function addLabel() {
    form.value.labels.push({ key: '', value: '' })
  }
  function removeLabel(index: number) {
    form.value.labels.splice(index, 1)
  }
  function addAnnotation() {
    form.value.annotations.push({ key: '', value: '' })
  }
  function removeAnnotation(index: number) {
    form.value.annotations.splice(index, 1)
  }
  function removeVolumeMount(index: number) {
    form.value.containers[activeContainerIdx.value].volumeMounts.splice(index, 1)
  }
  function removeVolume(index: number) {
    form.value.volumes.splice(index, 1)
  }

  function isContainerInvalid(c: ContainerConfig): boolean {
    return !c.name.trim() || !c.image.trim()
  }

  function addContainer() {
    const current = form.value.containers[activeContainerIdx.value]
    if (isContainerInvalid(current)) {
      ElMessage.warning('请先填写当前容器的名称和镜像')
      return
    }
    form.value.containers.push(newContainer(form.value.containers.length))
    activeContainerIdx.value = form.value.containers.length - 1
  }
  function removeContainer(idx: number) {
    form.value.containers.splice(idx, 1)
    if (activeContainerIdx.value >= form.value.containers.length) {
      activeContainerIdx.value = form.value.containers.length - 1
    }
  }

  // --- 数据卷 dialog ---
  const volumeDialogVisible = ref(false)
  const volumeDialogIsEdit = ref(false)
  const volumeDialogEditIdx = ref(-1)
  const volumeDialogForm = ref({
    name: '',
    type: 'emptyDir' as 'emptyDir' | 'configMap',
    configMapName: '',
    configMapKey: ''
  })

  function volTypeLabel(type: string): string {
    return type === 'configMap' ? '使用 ConfigMap' : '临时路径（emptyDir）'
  }

  function openAddVolume() {
    volumeDialogForm.value = { name: '', type: 'emptyDir', configMapName: '', configMapKey: '' }
    volumeDialogIsEdit.value = false
    volumeDialogEditIdx.value = -1
    volumeDialogVisible.value = true
  }

  function openEditVolume(idx: number) {
    const vol = form.value.volumes[idx]
    volumeDialogForm.value = {
      name: vol.name,
      type: vol.type,
      configMapName: vol.configMapName,
      configMapKey: vol.configMapKey
    }
    volumeDialogIsEdit.value = true
    volumeDialogEditIdx.value = idx
    volumeDialogVisible.value = true
  }

  function saveVolume() {
    const f = volumeDialogForm.value
    if (!f.name.trim()) {
      ElMessage.warning('请输入数据卷名称')
      return
    }
    if (f.type === 'configMap' && !f.configMapName.trim()) {
      ElMessage.warning('请输入 ConfigMap 名称')
      return
    }
    const vol = {
      name: f.name.trim(),
      type: f.type,
      configMapName: f.configMapName.trim(),
      configMapKey: f.configMapKey.trim()
    }
    if (volumeDialogIsEdit.value) {
      form.value.volumes[volumeDialogEditIdx.value] = vol
    } else {
      form.value.volumes.push(vol)
    }
    volumeDialogVisible.value = false
  }

  function addPort() {
    form.value.containers[activeContainerIdx.value].ports.push({
      containerPort: 80,
      name: '',
      protocol: 'TCP'
    })
  }
  function removePort(index: number) {
    form.value.containers[activeContainerIdx.value].ports.splice(index, 1)
  }

  function addEnv() {
    form.value.containers[activeContainerIdx.value].envs.push({
      name: '',
      mode: 'value',
      value: '',
      sourceName: '',
      sourceKey: ''
    })
  }
  function removeEnv(index: number) {
    form.value.containers[activeContainerIdx.value].envs.splice(index, 1)
  }

  function addPostStart() {
    form.value.containers[activeContainerIdx.value].postStartCommands.push('')
  }
  function removePostStart(index: number) {
    form.value.containers[activeContainerIdx.value].postStartCommands.splice(index, 1)
  }
  function addPreStop() {
    form.value.containers[activeContainerIdx.value].preStopCommands.push('')
  }
  function removePreStop(index: number) {
    form.value.containers[activeContainerIdx.value].preStopCommands.splice(index, 1)
  }

  function buildEnv(c: ContainerConfig) {
    return c.envs
      .map((item) => {
        const name = item.name.trim()
        if (!name) return null
        if (item.mode === 'value') {
          return { name, value: item.value }
        }
        const sourceName = item.sourceName.trim()
        const sourceKey = item.sourceKey.trim()
        if (!sourceName || !sourceKey) return null
        if (item.mode === 'configMap') {
          return {
            name,
            valueFrom: {
              configMapKeyRef: { name: sourceName, key: sourceKey }
            }
          }
        }
        return {
          name,
          valueFrom: {
            secretKeyRef: { name: sourceName, key: sourceKey }
          }
        }
      })
        // @ts-ignore
      .filter(
        (
          item
        // @ts-ignore
        ): item is {
          name: string
          value?: string
          valueFrom?: Record<string, { name: string; key: string }>
        } => item !== null
      )
  }

  function parseCommandLines(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  function validateResourceFormats(): boolean {
    const cpuPattern = /^(\d+m|\d+(\.\d+)?)$/
    const memPattern = /^\d+(\.\d+)?(Ki|Mi|Gi|Ti|K|M|G|T|Ei|Pi)?$/
    for (const c of form.value.containers) {
      const checks: Array<[string, string, RegExp]> = [
        [`[${c.name}] CPU Request`, c.cpuRequest.trim(), cpuPattern],
        [`[${c.name}] CPU Limit`, c.cpuLimit.trim(), cpuPattern],
        [`[${c.name}] 内存 Request`, c.memoryRequest.trim(), memPattern],
        [`[${c.name}] 内存 Limit`, c.memoryLimit.trim(), memPattern]
      ]
      for (const [label, value, pattern] of checks) {
        if (!value) continue
        if (!pattern.test(value)) {
          ElMessage.warning(`${label} 格式不正确`)
          return false
        }
      }
    }
    return true
  }

  function validateUniqueKeys(
    list: Array<{ key: string; value?: string }>,
    label: string
  ): boolean {
    const seen = new Set<string>()
    for (const item of list) {
      const key = item.key.trim()
      if (!key) continue
      if (seen.has(key)) {
        ElMessage.warning(`${label} 存在重复 key: ${key}`)
        return false
      }
      seen.add(key)
    }
    return true
  }

  function validateLabelKeys(list: Array<{ key: string }>): boolean {
    const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-_.]{0,61}[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/
    for (const item of list) {
      const key = item.key.trim()
      if (!key) continue
      if (key.length > 63) {
        ElMessage.warning(`标签键名 "${key}" 超过 63 个字符`)
        return false
      }
      if (!pattern.test(key)) {
        ElMessage.warning(
          `标签键名 "${key}" 格式不正确，只能包含字母、数字及 - _ .，且必须以字母或数字开头和结尾`
        )
        return false
      }
    }
    return true
  }

  function validateAnnotationValues(list: Array<{ key: string; value: string }>): boolean {
    const badChars = /[\n\r\t]/
    for (const item of list) {
      const key = item.key.trim()
      if (!key) continue
      if (badChars.test(item.value)) {
        ElMessage.warning(`注释 "${key}" 的值包含换行或制表符等特殊字符，建议移除`)
        return false
      }
    }
    return true
  }

  function validateContainerSemantics(): boolean {
    for (const c of form.value.containers) {
        // @ts-ignore
      const validPorts = c.ports.filter(
        (p) => Number.isFinite(Number(p.containerPort)) && Number(p.containerPort) > 0
      )
      const portSeen = new Set<string>()
      for (const p of validPorts) {
        const signature = `${Number(p.containerPort)}-${p.protocol}`
        if (portSeen.has(signature)) {
          ElMessage.warning(`[${c.name}] 存在重复端口协议组合: ${signature}`)
          return false
        }
        portSeen.add(signature)
      }

      const envSeen = new Set<string>()
      for (const e of c.envs) {
        const name = e.name.trim()
        if (!name) continue
        if (envSeen.has(name)) {
          ElMessage.warning(`[${c.name}] 环境变量名重复: ${name}`)
          return false
        }
        envSeen.add(name)
        if (e.mode !== 'value' && (!e.sourceName.trim() || !e.sourceKey.trim())) {
          ElMessage.warning(`[${c.name}] 环境变量 ${name} 的来源名称与 key 不能为空`)
          return false
        }
      }
    }

    const volumeNameSet = new Set<string>()
    for (const v of form.value.volumes) {
      const name = v.name.trim()
      if (!name) continue
      if (volumeNameSet.has(name)) {
        ElMessage.warning(`卷名称重复: ${name}`)
        return false
      }
      volumeNameSet.add(name)
      if (v.type === 'configMap' && !v.configMapName.trim()) {
        ElMessage.warning(`卷 ${name} 缺少 ConfigMap 名称`)
        return false
      }
    }

    for (const c of form.value.containers) {
      for (const m of c.volumeMounts) {
        const mountName = m.name.trim()
        const mountPath = m.mountPath.trim()
        if (!mountName && !mountPath) continue
        if (!mountName || !mountPath) {
          ElMessage.warning(`[${c.name}] VolumeMount 需要同时填写卷名和挂载路径`)
          return false
        }
        if (!volumeNameSet.has(mountName)) {
          ElMessage.warning(`[${c.name}] VolumeMount 引用了不存在的卷: ${mountName}`)
          return false
        }
      }
    }

    if (!validateUniqueKeys(form.value.labels, '标签')) return false
    if (!validateLabelKeys(form.value.labels)) return false
    if (!validateUniqueKeys(form.value.annotations, '注释')) return false
    if (!validateAnnotationValues(form.value.annotations)) return false

    return true
  }

  function buildResources(c: ContainerConfig) {
    const requests: Record<string, string> = {}
    const limits: Record<string, string> = {}
    if (c.cpuRequest.trim()) requests.cpu = c.cpuRequest.trim()
    if (c.memoryRequest.trim()) requests.memory = c.memoryRequest.trim()
    if (c.cpuLimit.trim()) limits.cpu = c.cpuLimit.trim()
    if (c.memoryLimit.trim()) limits.memory = c.memoryLimit.trim()
    if (!Object.keys(requests).length && !Object.keys(limits).length) return undefined
    return {
      ...(Object.keys(requests).length ? { requests } : {}),
      ...(Object.keys(limits).length ? { limits } : {})
    }
  }

  function buildCronJobManifest() {
    const labels = kvPairsToObject(form.value.labels)
    const annotations = kvPairsToObject(form.value.annotations)
    const appLabel = labels.app || form.value.name
    const finalLabels = { app: appLabel, ...labels }

    const buildProbe = (probe: ContainerConfig['liveness']) => {
      if (!probe.enabled) return undefined
      const base = {
        initialDelaySeconds: probe.initialDelaySeconds,
        periodSeconds: probe.periodSeconds,
        timeoutSeconds: probe.timeoutSeconds,
        successThreshold: probe.successThreshold,
        failureThreshold: probe.failureThreshold
      }
      const port = probe.port.trim() || 80
      const host = probe.host.trim()
      if (probe.method === 'tcp') {
        return { ...base, tcpSocket: { port, ...(host ? { host } : {}) } }
      } else if (probe.method === 'http') {
        return {
          ...base,
          httpGet: { path: probe.path.trim() || '/', port, ...(host ? { host } : {}) }
        }
      }
      return undefined
    }

    const volumes = form.value.volumes
      .map((v) => {
        const name = v.name.trim()
        if (!name) return null
        if (v.type === 'configMap') {
          const cm = v.configMapName.trim()
          if (!cm) return null
          return { name, configMap: { name: cm } }
        }
        return { name, emptyDir: {} }
      })
        // @ts-ignore
      .filter(
        (
          v
        ): v is any =>
          v !== null
      )

    const containers = form.value.containers.map((c) => {
      const env = buildEnv(c)
      const resources = buildResources(c)
      const ports = c.ports
        .map((p) => ({
          containerPort: Number(p.containerPort),
          ...(p.name.trim() ? { name: p.name.trim() } : {}),
          ...(p.protocol ? { protocol: p.protocol } : {})
        }))
        .filter((p) => Number.isFinite(p.containerPort) && p.containerPort > 0)
      const command = parseCommandLines(c.commandText)
      const args = parseCommandLines(c.argsText)
      const volumeMounts = c.volumeMounts
        .map((m) => ({ name: m.name.trim(), mountPath: m.mountPath.trim(), readOnly: m.readOnly }))
        .filter((m) => m.name && m.mountPath)
      const livenessProbe = buildProbe(c.liveness)
      const readinessProbe = buildProbe(c.readiness)
      return {
        name: c.name.trim(),
        image: c.imageTag.trim() ? `${c.image.trim()}:${c.imageTag.trim()}` : c.image.trim(),
        imagePullPolicy: c.imagePullPolicy,
        ...(ports.length ? { ports } : {}),
        ...(env.length ? { env } : {}),
        ...(resources ? { resources } : {}),
        ...(livenessProbe ? { livenessProbe } : {}),
        ...(readinessProbe ? { readinessProbe } : {}),
        ...(command.length ? { command } : {}),
        ...(args.length ? { args } : {}),
        ...(volumeMounts.length ? { volumeMounts } : {})
      }
    })

    return {
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: {
        name: form.value.name.trim(),
        namespace: form.value.namespace,
        labels: finalLabels,
        annotations
      },
      spec: {
        schedule: form.value.schedule,
        successfulJobsHistoryLimit: form.value.successfulJobsHistoryLimit,
        failedJobsHistoryLimit: form.value.failedJobsHistoryLimit,
        jobTemplate: {
          spec: {
            completions: form.value.completions,
            parallelism: form.value.parallelism,
            template: {
              metadata: { labels: { app: appLabel, ...finalLabels as any } },
              spec: {
                restartPolicy: form.value.restartPolicy,
                containers,
                ...(volumes.length ? { volumes } : {}),
                ...(form.value.preemptible ? { priorityClassName: 'preemptible' } : {})
              }
            }
          }
        }
      }
    }
  }

  function goBack() {
    router.push({ path: '/container/workloads', query: { cluster: cluster.value, tab: 'cj' } })
  }

  async function submit() {
    const basicOk = await basicFormRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!basicOk) {
      return
    }
    const containerOk = await containerFormRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!containerOk) {
      return
    }
    if (!cluster.value) {
      ElMessage.warning('缺少集群参数')
      return
    }
    if (!validateResourceFormats()) return
    if (!validateContainerSemantics()) return
    submitting.value = true
    try {
      const manifest = buildCronJobManifest()
      await createK8sCronJob(cluster.value, form.value.namespace, manifest)
      ElMessage.success(`CronJob(${form.value.name}) 创建成功`)
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
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

  const pullSecrets = ref<string[]>([])

  async function loadPullSecrets() {
    if (!cluster.value || !form.value.namespace) return
    try {
      const { items } = await fetchK8sSecretList(cluster.value, {
        page: 1,
        limit: 500,
        namespace: form.value.namespace
      })
      pullSecrets.value = items
        // @ts-ignore
        .filter(
          (s) => s.type === 'kubernetes.io/dockerconfigjson' || s.type === 'kubernetes.io/dockercfg'
        )
        .map((s) => s.metadata?.name ?? '')
        .filter(Boolean)
    } catch {
      pullSecrets.value = []
    }
  }

  const showPullSecretSelect = ref(false)
  const showContainerAdvancedConfig = ref(false)

  function onAddPullSecret() {
    showPullSecretSelect.value = true
    void loadPullSecrets()
  }

  function clearPullSecret() {
    showPullSecretSelect.value = false
    form.value.imagePullSecret = ''
  }

  const newSecretDialogVisible = ref(false)
  const newSecretSubmitting = ref(false)
  const newSecretForm = ref({ name: '', server: '', username: '', password: '' })

  async function submitNewSecret() {
    const f = newSecretForm.value
    if (!f.name.trim()) {
      ElMessage.warning('请输入凭证名称')
      return
    }
    if (!f.server.trim()) {
      ElMessage.warning('请输入镜像仓库地址')
      return
    }
    if (!f.username.trim()) {
      ElMessage.warning('请输入用户名')
      return
    }
    if (!f.password) {
      ElMessage.warning('请输入密码')
      return
    }
    if (!form.value.namespace) {
      ElMessage.warning('请先选择命名空间')
      return
    }
    newSecretSubmitting.value = true
    try {
      const auth = btoa(`${f.username}:${f.password}`)
      const dockerConfig = JSON.stringify({
        auths: { [f.server.trim()]: { username: f.username.trim(), password: f.password, auth } }
      })
      const { createK8sSecret } = await import('@/api/kubernetes/secret')
      await createK8sSecret(cluster.value, form.value.namespace, {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: f.name.trim(), namespace: form.value.namespace },
        type: 'kubernetes.io/dockerconfigjson',
        data: { '.dockerconfigjson': btoa(dockerConfig) }
      })
      ElMessage.success('访问凭证创建成功')
      newSecretDialogVisible.value = false
      newSecretForm.value = { name: '', server: '', username: '', password: '' }
      await loadPullSecrets()
      form.value.imagePullSecret = f.name.trim()
      showPullSecretSelect.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      newSecretSubmitting.value = false
    }
  }

  onMounted(() => {
    void loadNamespaces()
  })

  watch(
    () => form.value.namespace,
    (ns) => {
      if (ns) void loadPullSecrets()
    }
  )

  watch(
    () => form.value.name,
    (name, oldName) => {
      const n = name.trim()
      const o = (oldName ?? '').trim()
      const appLabel = form.value.labels.find((item) => item.key.trim() === 'app')
      if (appLabel && (!appLabel.value.trim() || appLabel.value.trim() === o)) {
        appLabel.value = n
      }
    }
  )
</script>

<style scoped>
  .deploy-create-page {
    padding: 0 clamp(16px, 4vw, 48px) 0;
  }

  .deploy-create-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
    margin-left: calc(-1 * clamp(16px, 4vw, 48px));
  }

  .deploy-create-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px 0 2px;
  }

  .deploy-create-header-divider {
    margin: 0 12px;
    height: 16px;
  }

  .deploy-create-card :deep(.el-card__body) {
    padding: 16px 20px;
  }

  @media (max-width: 1200px) {
    .deploy-create-page {
      padding-left: 20px;
      padding-right: 20px;
    }
    .deploy-create-header {
      margin-left: -20px;
    }
  }

  @media (max-width: 768px) {
    .deploy-create-page {
      padding-left: 12px;
      padding-right: 12px;
    }
    .deploy-create-header {
      margin-left: -12px;
    }
  }

  .deploy-create-main {
    display: flex;
    gap: 0;
  }

  .dc-form {
    max-width: none;
    width: 100%;
  }

  .dc-form :deep(.el-form-item__label) {
    font-size: 12px;
    padding-right: 16px;
  }

  .dc-form :deep(.el-input__placeholder),
  .dc-form :deep(.el-textarea__placeholder) {
    font-size: 12px;
  }

  .dc-form :deep(.el-checkbox__label) {
    font-size: 12px;
  }

  .dc-section-divider-top {
    margin-top: 16px;
  }
  .dc-section-divider-top :deep(.el-divider__text) {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .container-form-item :deep(.el-form-item__content) {
    width: 100%;
    max-width: none;
    flex: 1;
  }

  .container-form-item :deep(.el-form-item__label) {
    font-size: 12px;
  }

  .deploy-create-footer {
    margin-top: 10px;
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .kv-list {
    width: 100%;
  }

  .kv-row,
  .vm-row,
  .vol-row {
    display: grid;
    gap: 8px;
    margin-bottom: 8px;
  }

  .kv-list > .kv-row:last-of-type {
    margin-bottom: 0px;
  }

  .kv-row {
    grid-template-columns: 1fr 1fr auto;
  }

  .vm-row {
    grid-template-columns: 1fr 1fr 120px auto;
  }

  .vol-row {
    grid-template-columns: 1fr 140px 1fr auto;
  }

  .port-table {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    width: 100%;
  }

  .port-table-box {
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 560px;
    box-sizing: border-box;
  }

  .port-table-header,
  .port-table-row {
    display: grid;
    grid-template-columns: 120px 120px 120px 1fr;
    gap: 0;
    align-items: center;
  }

  .port-table-header {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    padding-bottom: 2px;
  }

  .port-col-protocol {
    margin-left: 30px;
  }

  .port-col-port {
    margin-left: 60px;
  }

  .port-table-row .port-del-btn {
    justify-self: end;
  }

  .port-col-name,
  .port-col-protocol,
  .port-col-port {
    width: 100% !important;
  }

  .port-del-btn {
    justify-content: center;
  }

  .port-row {
    display: grid;
    grid-template-columns: 170px 1fr 120px auto;
    gap: 8px;
    margin-bottom: 8px;
  }

  .env-row {
    display: grid;
    grid-template-columns: 140px 1fr 1fr 1fr auto;
    gap: 8px;
    margin-bottom: 8px;
  }

  .env-row .env-del-btn {
    justify-self: end;
    align-self: center;
  }

  .container-pane {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .container-tabs-bar {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 0 8px;
    flex-wrap: wrap;
  }

  .container-tab-item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 6px 10px;
    height: 35px;
    width: 110px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    background: transparent;
    color: var(--el-text-color-regular);
    border: 1px solid var(--el-border-color);
    transition: border-color 0.15s;
    user-select: none;
    box-sizing: border-box;
  }

  .container-tab-item:hover {
    border-color: var(--el-color-primary);
  }

  .container-tab-item.is-invalid {
    border-color: var(--el-color-danger);
    color: var(--el-color-danger);
  }

  .container-tab-item.is-active {
    background: var(--el-bg-color-overlay);
    color: var(--el-color-primary);
    font-weight: 500;
    border-color: var(--el-color-primary);
  }

  .container-tab-close {
    position: absolute;
    top: -7px;
    right: -7px;
    width: 14px;
    height: 14px;
    font-size: 10px;
    color: #fff;
    background: var(--el-text-color-placeholder);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .container-tab-close:hover {
    background: var(--el-color-danger);
    color: #fff;
  }

  .add-container-btn {
    font-size: 12px;
    padding: 4px 8px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .add-container-btn :deep(.el-icon) {
    font-size: 12px;
  }

  .container-form-wrap {
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 6px;
    padding: 16px 12px 8px;
    width: 920px;
    max-width: 100%;
    box-sizing: border-box;
  }

  .pull-policy-group {
    --el-radio-button-checked-border-color: var(--el-color-primary);
    --el-radio-button-checked-bg-color: var(--el-bg-color-overlay);
    --el-radio-button-checked-text-color: var(--el-color-primary);
    display: flex;
    width: 320px;
    min-width: 320px;
    max-width: 320px;
    overflow: hidden;
    box-sizing: border-box;
  }

  .pull-policy-group :deep(.el-radio-button) {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
  }

  .pull-policy-group :deep(.el-radio-button__inner) {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    font-size: 12px;
    padding: 6px 10px;
    line-height: 1.25;
    min-height: 28px;
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

  .container-form-wrap .dc-form {
    max-width: 920px;
  }

  .container-dc-form :deep(.el-form-item__label) {
    font-size: 12px;
    white-space: nowrap;
  }

  .container-dc-form :deep(.el-input__inner),
  .container-dc-form :deep(.el-textarea__inner),
  .container-dc-form :deep(.el-select__wrapper) {
    font-size: 13px;
  }

  .container-name-field-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    min-width: 0;
  }

  .container-dc-form .container-name-tip {
    width: max-content;
    max-width: none;
    margin-top: 6px;
    white-space: nowrap;
  }

  .cpu-mem-limit-form-item.el-form-item {
    align-items: flex-start;
  }

  .cpu-mem-limit-form-item :deep(.el-form-item__label) {
    line-height: 20px;
    padding-top: 0;
  }

  .cpu-mem-limit-form-item :deep(.el-form-item__content) {
    flex: 1;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    padding-top: 0;
  }

  .cpu-mem-limit-wrap {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 40px;
    row-gap: 0;
    width: 100%;
    min-width: 0;
    align-items: start;
  }

  .cpu-mem-limit-block {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    min-width: 0;
  }

  .cpu-mem-limit-block-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    line-height: 1.2;
    margin: 0;
  }

  .cpu-mem-limit-inputs {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
  }

  .resource-affix-group {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    min-width: 0;
    border: 1px solid var(--el-border-color);
    border-radius: 0;
    overflow: hidden;
    background: var(--el-fill-color-blank);
    box-sizing: border-box;
  }

  .resource-affix-group--grow {
    flex: 1 1 0;
    min-width: 0;
  }

  .resource-affix-sep {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    user-select: none;
    line-height: 1;
  }

  .resource-affix-group:focus-within {
    border-color: var(--el-color-primary);
  }

  .resource-affix-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    flex-shrink: 0;
    padding: 0 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-right: 1px solid var(--el-border-color);
    box-sizing: border-box;
  }

  .resource-affix-input {
    flex: 1;
    min-width: 0;
  }

  .resource-affix-input :deep(.el-input) {
    width: 100%;
    min-width: 0;
  }

  .resource-affix-input :deep(.el-input__wrapper) {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    background-color: transparent;
    padding-top: 0;
    padding-bottom: 0;
    height: 28px;
    align-items: center;
  }

  .resource-affix-input :deep(.el-input__inner) {
    text-align: left;
  }

  .resource-unit-suffix {
    flex-shrink: 0;
    align-self: center;
    font-size: 13px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .cpu-mem-limit-tips {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    max-width: none;
  }

  .cpu-mem-tip-line {
    white-space: normal;
    line-height: 1.5;
  }

  .health-check-form-item :deep(.el-form-item__label) {
    display: flex;
    align-items: center;
  }

  .health-check-wrap {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .health-check-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .health-check-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .health-check-desc {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .health-check-panel {
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    padding: 16px 20px;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-self: flex-start;
    width: 500px;
  }

  .probe-field-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .probe-field-label {
    display: flex;
    align-items: center;
    gap: 3px;
    width: 72px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-regular);
    padding-top: 5px;
  }

  .probe-field-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .probe-input-unit {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .probe-unit {
    font-size: 12px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }
  .health-check-panel .probe-input-unit :deep(.el-input) { width: 70px !important; }
  .health-check-panel .probe-input-unit :deep(.el-input__inner) { font-size: 11px !important; }

  .health-check-panel :deep(.el-input__inner),
  .health-check-panel :deep(.el-textarea__inner),
  .health-check-panel :deep(.el-select__wrapper) {
    font-size: 12px;
  }

  .health-check-panel :deep(.el-input__wrapper) { height: 28px; }
  .health-check-panel :deep(.el-select__wrapper) { height: 28px !important; min-height: 28px !important; }

  .health-check-panel .dc-field-tip {
    font-size: 12px;
    margin-top: 2px;
  }

  .dc-form :deep(.el-input__inner),
  .dc-form :deep(.el-textarea__inner),
  .dc-form :deep(.el-select__wrapper) {
    font-size: 13px;
  }

  .dc-field-tip {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    line-height: 1.5;
    margin-top: 4px;
    white-space: nowrap;
  }

  .dc-form :deep(.el-form-item__content) {
    flex-wrap: wrap;
    align-items: flex-start;
    row-gap: 0;
  }

  .dc-field-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .dc-field-col > .dc-field-tip {
    margin-top: 0;
    white-space: nowrap;
  }

  .container-dc-form :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .kv-add-btn {
    font-size: 12px;
  }

  .lifecycle-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .lifecycle-section {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .lifecycle-section-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    margin-bottom: 4px;
  }

  .lifecycle-info-icon {
    font-size: 14px;
    color: var(--el-text-color-placeholder);
    cursor: default;
  }

  .lifecycle-inputs {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .lifecycle-input-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .lifecycle-textarea {
    flex: 1;
  }

  .lifecycle-del-btn {
    margin-top: 6px;
    flex-shrink: 0;
  }

  .lifecycle-add-btn {
    margin-left: 8px;
  }

  .pull-secret-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .pull-secret-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pull-secret-icon-btn {
    padding: 4px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }

  .pull-secret-icon-btn:hover {
    color: var(--el-color-primary);
  }

  .kv-del-btn {
    color: var(--el-text-color-primary);
  }

  .scheduling-policy-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .scheduling-policy-wrap :deep(.el-radio__label) {
    font-size: 12px;
  }

  .container-advanced-config-toggle {
    padding-left: 20px;
    margin-top: 4px;
    margin-bottom: 2px;
  }

  .volume-mounts-form-item :deep(.el-form-item__label) {
    display: none;
    width: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .volume-mounts-form-item :deep(.el-form-item__content) {
    margin-left: 0 !important;
    justify-content: flex-start;
  }

  .container-advanced-config-toggle .kv-add-btn {
    font-size: 12px;
  }

  .advanced-field-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .advanced-field-wrap .dc-field-tip {
    margin-top: 0;
  }

  .advanced-field-wrap :deep(.el-radio__label) {
    font-size: 12px;
  }

  .vol-display-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    margin-bottom: 4px;
  }

  .kv-list > .vol-display-row:last-of-type {
    margin-bottom: 0px;
  }

  .vol-display-actions {
    margin-left: auto;
    display: flex;
    gap: 0;
  }

  .dc-field-col :deep(.el-radio__label),
  .dc-field-col :deep(.el-checkbox__label),
  .dc-field-col :deep(.el-input__inner),
  .dc-field-col :deep(.el-input__placeholder),
  .dc-field-col :deep(.el-select__placeholder),
  .dc-field-col :deep(.el-select__selected-item) {
    font-size: 12px;
  }

  /* 定时规则 */
  .schedule-builder {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  /* 按天 / 按星期 / 按月 / Cron 表达式：灰底配置区（宽度随内容，不超过表单列） */
  .schedule-daily-panel,
  .schedule-weekly-panel,
  .schedule-monthly-panel,
  .schedule-cron-panel {
    margin-top: 4px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 6px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: fit-content;
    max-width: 100%;
    box-sizing: border-box;
  }

  .schedule-daily-panel .dc-field-tip,
  .schedule-weekly-panel .dc-field-tip,
  .schedule-monthly-panel .dc-field-tip,
  .schedule-cron-panel .dc-field-tip {
    margin-top: 0;
    max-width: 100%;
    white-space: normal;
    word-break: break-word;
  }

  .schedule-cron-expr-input {
    width: 100%;
    min-width: min(100%, 420px);
    max-width: 100%;
  }

  .schedule-cron-format-hint {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.55;
  }

  .schedule-cron-example {
    margin: 0 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .schedule-tz-hint {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.5;
  }

  .schedule-builder--in-panel {
    margin-top: 0;
  }

  .schedule-text {
    font-size: 13px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  /* Job 设置灰底区域 */
  .dc-job-settings-form-item :deep(.el-form-item__content) {
    flex: 1;
  }

  .dc-job-settings {
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 6px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 920px;
    max-width: 100%;
    box-sizing: border-box;
  }

  .dc-job-settings-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .dc-job-settings-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: 96px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .dc-job-settings-tip {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .restart-policy-select :deep(.el-select__wrapper) {
    min-height: 28px !important;
    height: 28px !important;
    border-radius: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    font-size: 12px !important;
  }
</style>
