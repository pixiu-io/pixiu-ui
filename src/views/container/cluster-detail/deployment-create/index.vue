<template>
  <div class="deploy-create-page">
    <div class="deploy-create-header">
      <ElButton text class="deploy-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="deploy-create-header-divider" />
      <ElBreadcrumb separator="/">
        <ElBreadcrumbItem :to="{ path: '/container/workloads', query: { cluster } }"
          >工作负载</ElBreadcrumbItem
        >
        <ElBreadcrumbItem>创建 Deployment</ElBreadcrumbItem>
      </ElBreadcrumb>
    </div>

    <ElCard class="deploy-create-card">
      <div class="deploy-create-main">
        <ElTabs v-model="activeStep" tab-position="left" class="deploy-create-tabs">
          <ElTabPane label="基础信息" name="basic">
            <ElForm
              ref="basicFormRef"
              :model="form"
              :rules="basicRules"
              label-width="120px"
              class="dc-form"
            >
              <ElDivider content-position="left" class="dc-section-divider-top">基础配置</ElDivider>
              <ElFormItem label="名称" prop="name">
                <ElInput
                  v-model="form.name"
                  placeholder="请输入 Deployment 名称"
                  style="width: 280px"
                />
                <div class="dc-field-tip"
                  >最长 63
                  个字符，只能包含小写字母、数字及分隔符（-），且必须以小写字母开头，以数字或小写字母结尾</div
                >
              </ElFormItem>
              <ElFormItem label="命名空间" prop="namespace">
                <ElSelect
                  v-model="form.namespace"
                  filterable
                  placeholder="请选择命名空间"
                  style="width: 280px"
                >
                  <ElOption v-for="ns in namespaces" :key="ns" :label="ns" :value="ns" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="Labels">
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
              </ElFormItem>
              <ElFormItem label="Annotations">
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
              </ElFormItem>
              <ElFormItem label="数据卷（选填）">
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
              </ElFormItem>
              <ElFormItem label="实例数量" prop="replicas">
                <ElInputNumber v-model="form.replicas" :min="0" :precision="0" />
              </ElFormItem>
              <ElFormItem label="镜像访问凭证">
                <div class="pull-secret-wrap">
                  <div v-if="showPullSecretSelect" class="pull-secret-row">
                    <ElSelect
                      v-model="form.imagePullSecret"
                      placeholder="不指定访问凭证"
                      style="width: 280px"
                      filterable
                    >
                      <ElOption v-for="s in pullSecrets" :key="s" :label="s" :value="s" />
                    </ElSelect>
                    <ElButton link class="pull-secret-icon-btn" @click="loadPullSecrets"
                      ><ElIcon><Refresh /></ElIcon
                    ></ElButton>
                    <ElButton link class="pull-secret-icon-btn" @click="clearPullSecret"
                      ><ElIcon><Close /></ElIcon
                    ></ElButton>
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
              <div class="advanced-toggle-row">
                <ElButton
                  link
                  type="primary"
                  class="kv-add-btn"
                  @click="showAdvancedOptions = !showAdvancedOptions"
                >
                  {{ showAdvancedOptions ? '隐藏高级选项' : '显示高级选项' }}
                </ElButton>
              </div>
              <template v-if="showAdvancedOptions">
                <ElFormItem label="更新方式">
                  <div class="advanced-field-wrap">
                    <ElSelect v-model="form.strategyType" style="width: 220px">
                      <ElOption label="滚动更新（推荐）" value="RollingUpdate" />
                      <ElOption label="快速更新" value="Recreate" />
                    </ElSelect>
                    <div v-if="form.strategyType === 'RollingUpdate'" class="dc-field-tip"
                      >对实例进行逐个更新，这种方式可以让您不中断业务实现对服务的更新</div
                    >
                    <div v-else class="dc-field-tip">直接关闭所有实例，启动相同数量的新实例</div>
                  </div>
                </ElFormItem>
                <template v-if="form.strategyType === 'RollingUpdate'">
                  <ElFormItem label="更新间隔">
                    <div style="display: flex; align-items: center; gap: 8px">
                      <ElInputNumber
                        v-model="form.minReadySeconds"
                        :min="0"
                        :precision="0"
                        style="width: 160px"
                      />
                      <span style="font-size: 13px; color: var(--el-text-color-regular)">秒</span>
                    </div>
                  </ElFormItem>
                  <ElFormItem label="更新策略">
                    <div class="advanced-field-wrap">
                      <ElRadioGroup v-model="form.updatePolicy">
                        <ElRadio value="start-first">启动新的Pod，停止旧的Pod</ElRadio>
                        <ElRadio value="stop-first">停止旧的Pod，启动新的Pod</ElRadio>
                        <ElRadio value="custom">自定义</ElRadio>
                      </ElRadioGroup>
                      <div v-if="form.updatePolicy === 'start-first'" class="dc-field-tip"
                        >请确认集群有足够的CPU和内存用于启动新的Pod，否则可能导致集群崩溃</div
                      >
                    </div>
                  </ElFormItem>
                  <ElFormItem label="策略配置">
                    <div class="strategy-config-block">
                      <template v-if="form.updatePolicy !== 'custom'">
                        <div class="strategy-config-row">
                          <span class="strategy-config-label" style="min-width: 40px">Pods</span>
                          <ElInputNumber
                            v-model="form.updateBatchSize"
                            :min="1"
                            :precision="0"
                            style="width: 240px"
                          />
                        </div>
                        <div class="dc-field-tip" style="margin-left: 56px"
                          >Pod将批量启动或停止</div
                        >
                      </template>
                      <template v-else>
                        <div class="strategy-config-row">
                          <span class="strategy-config-label">MaxSurge</span>
                          <ElInput v-model="form.maxSurge" style="width: 240px" />
                        </div>
                        <div class="dc-field-tip" style="margin-left: 124px"
                          >允许超出所需规模的最大Pod数量</div
                        >
                        <div class="strategy-config-row" style="margin-top: 10px">
                          <span class="strategy-config-label">MaxUnavailable</span>
                          <ElInput v-model="form.maxUnavailable" style="width: 240px" />
                        </div>
                        <div class="dc-field-tip" style="margin-left: 124px"
                          >允许最大不可用的Pod数量</div
                        >
                      </template>
                    </div>
                  </ElFormItem>
                </template>
              </template>
            </ElForm>
          </ElTabPane>

          <ElTabPane label="容器配置" name="container">
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
                  label-width="80px"
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
                        最长 63 个字符，只能包含小写字母、数字及分隔符（-），且不能以分隔符开头或结尾。
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
                    label-width="112px"
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
                              placeholder="如 0.25"
                              class="resource-affix-input"
                            />
                          </div>
                          <span class="resource-affix-sep">-</span>
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">limit</span>
                            <ElInput
                              v-model="form.containers[activeContainerIdx].cpuLimit"
                              placeholder="如 0.5"
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
                              placeholder="如 256Mi"
                              class="resource-affix-input"
                            />
                          </div>
                          <span class="resource-affix-sep">-</span>
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">limit</span>
                            <ElInput
                              v-model="form.containers[activeContainerIdx].memoryLimit"
                              placeholder="如 1024Mi"
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
                    <ElFormItem label="启动命令">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].commandText"
                        type="textarea"
                        :rows="3"
                        placeholder="每行一个 command 参数，如 /bin/sh"
                      />
                    </ElFormItem>
                    <ElFormItem label="启动参数">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].argsText"
                        type="textarea"
                        :rows="3"
                        placeholder="每行一个 args 参数，如 -c"
                      />
                    </ElFormItem>
                    <ElDivider content-position="left">健康检查</ElDivider>
                    <ElFormItem label="存活探针路径">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].livenessPath"
                        placeholder="如 /healthz"
                        style="width: 240px"
                      />
                    </ElFormItem>
                    <ElFormItem label="存活探针端口">
                      <ElInputNumber
                        v-model="form.containers[activeContainerIdx].livenessPort"
                        :min="1"
                        :max="65535"
                        :precision="0"
                      />
                    </ElFormItem>
                    <ElFormItem label="存活探针参数">
                      <div class="probe-grid">
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].livenessInitialDelaySeconds"
                          :min="0"
                          :precision="0"
                          placeholder="initialDelaySeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].livenessPeriodSeconds"
                          :min="1"
                          :precision="0"
                          placeholder="periodSeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].livenessTimeoutSeconds"
                          :min="1"
                          :precision="0"
                          placeholder="timeoutSeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].livenessSuccessThreshold"
                          :min="1"
                          :precision="0"
                          placeholder="successThreshold"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].livenessFailureThreshold"
                          :min="1"
                          :precision="0"
                          placeholder="failureThreshold"
                        />
                      </div>
                    </ElFormItem>
                    <ElFormItem label="就绪探针路径">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].readinessPath"
                        placeholder="如 /ready"
                        style="width: 240px"
                      />
                    </ElFormItem>
                    <ElFormItem label="就绪探针端口">
                      <ElInputNumber
                        v-model="form.containers[activeContainerIdx].readinessPort"
                        :min="1"
                        :max="65535"
                        :precision="0"
                      />
                    </ElFormItem>
                    <ElFormItem label="就绪探针参数">
                      <div class="probe-grid">
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].readinessInitialDelaySeconds"
                          :min="0"
                          :precision="0"
                          placeholder="initialDelaySeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].readinessPeriodSeconds"
                          :min="1"
                          :precision="0"
                          placeholder="periodSeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].readinessTimeoutSeconds"
                          :min="1"
                          :precision="0"
                          placeholder="timeoutSeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].readinessSuccessThreshold"
                          :min="1"
                          :precision="0"
                          placeholder="successThreshold"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].readinessFailureThreshold"
                          :min="1"
                          :precision="0"
                          placeholder="failureThreshold"
                        />
                      </div>
                    </ElFormItem>
                    <ElFormItem label="启动探针路径">
                      <ElInput
                        v-model="form.containers[activeContainerIdx].startupPath"
                        placeholder="如 /startup"
                        style="width: 240px"
                      />
                    </ElFormItem>
                    <ElFormItem label="启动探针端口">
                      <ElInputNumber
                        v-model="form.containers[activeContainerIdx].startupPort"
                        :min="1"
                        :max="65535"
                        :precision="0"
                      />
                    </ElFormItem>
                    <ElFormItem label="启动探针参数">
                      <div class="probe-grid">
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].startupInitialDelaySeconds"
                          :min="0"
                          :precision="0"
                          placeholder="initialDelaySeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].startupPeriodSeconds"
                          :min="1"
                          :precision="0"
                          placeholder="periodSeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].startupTimeoutSeconds"
                          :min="1"
                          :precision="0"
                          placeholder="timeoutSeconds"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].startupSuccessThreshold"
                          :min="1"
                          :precision="0"
                          placeholder="successThreshold"
                        />
                        <ElInputNumber
                          v-model="form.containers[activeContainerIdx].startupFailureThreshold"
                          :min="1"
                          :precision="0"
                          placeholder="failureThreshold"
                        />
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
                        <ElButton link type="danger" @click="removeVolumeMount(idx)">删除</ElButton>
                      </div>
                    </div>
                  </ElFormItem>
                </ElForm>
              </div>
            </div>
          </ElTabPane>

          <ElTabPane label="高级选项" name="advanced">
            <ElForm label-width="120px" class="dc-form">
              <ElDivider content-position="left" class="dc-section-divider-top">升级策略</ElDivider>
              <ElFormItem label="升级策略">
                <ElSelect v-model="form.strategyType" style="width: 200px">
                  <ElOption label="RollingUpdate" value="RollingUpdate" />
                  <ElOption label="Recreate" value="Recreate" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem v-if="form.strategyType === 'RollingUpdate'" label="maxUnavailable">
                <ElInput v-model="form.maxUnavailable" placeholder="25%" style="width: 200px" />
              </ElFormItem>
              <ElFormItem v-if="form.strategyType === 'RollingUpdate'" label="maxSurge">
                <ElInput v-model="form.maxSurge" placeholder="25%" style="width: 200px" />
              </ElFormItem>
            </ElForm>
          </ElTabPane>
        </ElTabs>
      </div>

      <div class="deploy-create-footer">
        <ElButton v-if="activeStep !== 'basic'" @click="prevStep">上一步</ElButton>
        <ElButton v-if="activeStep !== 'advanced'" type="primary" @click="nextStep"
          >下一步</ElButton
        >
        <ElButton @click="goBack">取消</ElButton>
        <ElButton
          v-if="activeStep === 'advanced'"
          type="primary"
          :loading="submitting"
          @click="submit"
        >
          确定
        </ElButton>
      </div>
    </ElCard>

    <ElDialog v-model="yamlVisible" title="预览 YAML" width="760px">
      <ElInput v-model="yamlText" type="textarea" :rows="22" readonly />
      <template #footer>
        <ElButton type="primary" @click="yamlVisible = false">关闭</ElButton>
      </template>
    </ElDialog>

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
  import { ArrowLeft, Delete, EditPen, Close, Refresh, Plus } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import yaml from 'js-yaml'
  import { createK8sDeployment } from '@/api/kubernetes/deployment'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { fetchK8sSecretList } from '@/api/kubernetes/secret'

  defineOptions({ name: 'DeploymentCreatePage' })

  type StepKey = 'basic' | 'container' | 'advanced'

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const defaultNamespace = computed(() => String(route.query.namespace ?? ''))

  const namespaces = ref<string[]>([])
  const activeStep = ref<StepKey>('basic')
  const yamlVisible = ref(false)
  const yamlText = ref('')
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
    livenessPath: string
    livenessPort: number
    livenessInitialDelaySeconds: number
    livenessPeriodSeconds: number
    livenessTimeoutSeconds: number
    livenessSuccessThreshold: number
    livenessFailureThreshold: number
    readinessPath: string
    readinessPort: number
    readinessInitialDelaySeconds: number
    readinessPeriodSeconds: number
    readinessTimeoutSeconds: number
    readinessSuccessThreshold: number
    readinessFailureThreshold: number
    startupPath: string
    startupPort: number
    startupInitialDelaySeconds: number
    startupPeriodSeconds: number
    startupTimeoutSeconds: number
    startupSuccessThreshold: number
    startupFailureThreshold: number
    volumeMounts: Array<{ name: string; mountPath: string; readOnly: boolean }>
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
      livenessPath: '',
      livenessPort: 80,
      livenessInitialDelaySeconds: 0,
      livenessPeriodSeconds: 10,
      livenessTimeoutSeconds: 1,
      livenessSuccessThreshold: 1,
      livenessFailureThreshold: 3,
      readinessPath: '',
      readinessPort: 80,
      readinessInitialDelaySeconds: 0,
      readinessPeriodSeconds: 10,
      readinessTimeoutSeconds: 1,
      readinessSuccessThreshold: 1,
      readinessFailureThreshold: 3,
      startupPath: '',
      startupPort: 80,
      startupInitialDelaySeconds: 0,
      startupPeriodSeconds: 10,
      startupTimeoutSeconds: 1,
      startupSuccessThreshold: 1,
      startupFailureThreshold: 30,
      volumeMounts: []
    }
  }

  const activeContainerIdx = ref(0)

  const form = ref({
    name: '',
    namespace: '',
    replicas: 1,
    labels: [] as Array<{ key: string; value: string }>,
    annotations: [] as Array<{ key: string; value: string }>,
    volumes: [] as Array<{
      name: string
      type: 'emptyDir' | 'configMap'
      configMapName: string
      configMapKey: string
    }>,
    containers: [newContainer(0)] as ContainerConfig[],
    strategyType: 'RollingUpdate',
    maxUnavailable: '25%',
    maxSurge: '25%',
    minReadySeconds: 0,
    updatePolicy: 'start-first' as 'start-first' | 'stop-first' | 'custom',
    updateBatchSize: 1,
    imagePullSecret: '',
    schedulingPolicy: 'default' as 'default' | 'custom'
  })

  const basicFormRef = ref<FormInstance>()
  const containerFormRef = ref<FormInstance>()

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
    namespace: [{ required: true, message: '请选择命名空间', trigger: 'change' }]
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
  function addVolume() {
    form.value.volumes.push({ name: '', type: 'emptyDir', configMapName: '', configMapKey: '' })
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
      .filter(
        (
          item
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

  function buildDeploymentManifest() {
    const labels = kvPairsToObject(form.value.labels)
    const annotations = kvPairsToObject(form.value.annotations)
    const appLabel = labels.app || form.value.name
    const finalLabels = { app: appLabel, ...labels }

    const buildProbe = (
      path: string,
      port: number,
      initialDelaySeconds: number,
      periodSeconds: number,
      timeoutSeconds: number,
      successThreshold: number,
      failureThreshold: number
    ) => {
      if (!path.trim()) return undefined
      return {
        httpGet: { path: path.trim(), port },
        initialDelaySeconds,
        periodSeconds,
        timeoutSeconds,
        successThreshold,
        failureThreshold
      }
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
      .filter(
        (
          v
        ): v is { name: string; emptyDir?: Record<string, never>; configMap?: { name: string } } =>
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
      const livenessProbe = buildProbe(
        c.livenessPath,
        c.livenessPort,
        c.livenessInitialDelaySeconds,
        c.livenessPeriodSeconds,
        c.livenessTimeoutSeconds,
        c.livenessSuccessThreshold,
        c.livenessFailureThreshold
      )
      const readinessProbe = buildProbe(
        c.readinessPath,
        c.readinessPort,
        c.readinessInitialDelaySeconds,
        c.readinessPeriodSeconds,
        c.readinessTimeoutSeconds,
        c.readinessSuccessThreshold,
        c.readinessFailureThreshold
      )
      const startupProbe = buildProbe(
        c.startupPath,
        c.startupPort,
        c.startupInitialDelaySeconds,
        c.startupPeriodSeconds,
        c.startupTimeoutSeconds,
        c.startupSuccessThreshold,
        c.startupFailureThreshold
      )
      return {
        name: c.name.trim(),
        image: c.imageTag.trim() ? `${c.image.trim()}:${c.imageTag.trim()}` : c.image.trim(),
        imagePullPolicy: c.imagePullPolicy,
        ...(ports.length ? { ports } : {}),
        ...(env.length ? { env } : {}),
        ...(resources ? { resources } : {}),
        ...(livenessProbe ? { livenessProbe } : {}),
        ...(readinessProbe ? { readinessProbe } : {}),
        ...(startupProbe ? { startupProbe } : {}),
        ...(command.length ? { command } : {}),
        ...(args.length ? { args } : {}),
        ...(volumeMounts.length ? { volumeMounts } : {})
      }
    })

    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: form.value.name.trim(),
        namespace: form.value.namespace,
        labels: finalLabels,
        annotations
      },
      spec: {
        replicas: form.value.replicas,
        selector: { matchLabels: { app: appLabel } },
        strategy:
          form.value.strategyType === 'RollingUpdate'
            ? {
                type: 'RollingUpdate',
                rollingUpdate: {
                  maxUnavailable: form.value.maxUnavailable || '25%',
                  maxSurge: form.value.maxSurge || '25%'
                }
              }
            : { type: 'Recreate' },
        template: {
          metadata: { labels: { app: appLabel, ...finalLabels } },
          spec: {
            containers,
            ...(volumes.length ? { volumes } : {})
          }
        }
      }
    }
  }

  async function nextStep() {
    if (activeStep.value === 'basic') {
      const ok = await basicFormRef.value
        ?.validate()
        .then(() => true)
        .catch(() => false)
      if (!ok) return
      activeStep.value = 'container'
      return
    }
    if (activeStep.value === 'container') {
      const ok = await containerFormRef.value
        ?.validate()
        .then(() => true)
        .catch(() => false)
      if (!ok) return
      if (!validateContainerSemantics()) return
      activeStep.value = 'advanced'
    }
  }

  function prevStep() {
    if (activeStep.value === 'advanced') activeStep.value = 'container'
    else if (activeStep.value === 'container') activeStep.value = 'basic'
  }

  function goBack() {
    router.push({ path: '/container/workloads', query: { cluster: cluster.value } })
  }

  function previewYaml() {
    if (!validateResourceFormats()) return
    if (!validateContainerSemantics()) return
    yamlText.value = yaml.dump(buildDeploymentManifest(), { quotingType: '"' })
    yamlVisible.value = true
  }

  async function submit() {
    const basicOk = await basicFormRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!basicOk) {
      activeStep.value = 'basic'
      return
    }
    const containerOk = await containerFormRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!containerOk) {
      activeStep.value = 'container'
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
      const manifest = buildDeploymentManifest()
      await createK8sDeployment(cluster.value, form.value.namespace, manifest)
      ElMessage.success(`Deployment(${form.value.name}) 创建成功`)
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
  const showAdvancedOptions = ref(false)
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
      const c0 = form.value.containers[0]
      if (c0 && (!c0.name.trim() || c0.name.trim() === o)) {
        c0.name = n
      }
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
    gap: 0;
    margin-bottom: 12px;
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
  }

  @media (max-width: 768px) {
    .deploy-create-page {
      padding-left: 12px;
      padding-right: 12px;
    }
  }

  .deploy-create-main {
    display: flex;
    gap: 14px;
  }

  .deploy-create-tabs {
    flex: 1;
    min-width: 0;
  }

  .deploy-create-tabs :deep(.el-tabs__content) {
    min-height: 420px;
    padding-top: 12px;
  }

  .deploy-create-tabs :deep(.el-tab-pane > .el-form > .el-form-item:first-child) {
    margin-top: 6px;
  }

  /* Section divider: reduce top margin for first divider in a tab */
  .dc-section-divider-top {
    margin-top: 16px;
  }
  .dc-section-divider-top :deep(.el-divider__text) {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
  .deploy-create-tabs :deep(.el-divider__text) {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .deploy-create-aside {
    width: 120px;
    display: flex;
    justify-content: flex-end;
    padding-top: 6px;
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
    background: #fff;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
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
    background: var(--el-color-white, #fff);
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
    font-size: 13px;
    padding: 4px 8px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .container-form-wrap {
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 6px;
    padding: 16px 12px 8px;
  }

  .pull-policy-group {
    --el-radio-button-checked-border-color: var(--el-color-primary);
    --el-radio-button-checked-bg-color: var(--el-color-white, #fff);
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
    font-size: 13px;
    padding: 6px 10px;
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
    background-color: var(--el-color-white, #fff) !important;
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
    padding-top: 14px;
    line-height: 20px;
  }

  .cpu-mem-limit-form-item :deep(.el-form-item__content) {
    flex: 1;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    padding-top: 14px;
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
    border-radius: var(--el-border-radius-base);
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

  .probe-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(5, minmax(120px, 1fr));
    gap: 8px;
  }

  .dc-form {
    max-width: 680px;
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

  .kv-add-btn {
    font-size: 12px;
  }

  .pull-secret-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .pull-secret-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pull-secret-icon-btn {
    color: var(--el-text-color-secondary);
    font-size: 14px;
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

  .advanced-toggle-row {
    padding-left: 25px;
    margin-bottom: 12px;
  }

  .advanced-toggle-row .kv-add-btn {
    font-size: 12px;
  }

  .container-advanced-config-toggle {
    padding-left: 0px;
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

  .advanced-field-wrap :deep(.el-radio__label) {
    font-size: 12px;
  }

  .strategy-config-block {
    background: var(--el-fill-color-light);
    border-radius: 6px;
    padding: 12px 16px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .strategy-config-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .strategy-config-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    min-width: 108px;
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
</style>
