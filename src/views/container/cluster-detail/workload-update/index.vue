<template>
  <div class="deploy-create-page">
    <div class="deploy-create-header">
      <ElButton text class="deploy-create-back-btn" @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        <span>返回</span>
      </ElButton>
      <ElDivider direction="vertical" class="deploy-create-header-divider" />
      <ElBreadcrumb separator="/">
        <ElBreadcrumbItem>工作负载</ElBreadcrumbItem>
        <ElBreadcrumbItem>更新Pod设置</ElBreadcrumbItem>
      </ElBreadcrumb>
    </div>

    <ElCard class="deploy-create-card" v-loading="loading">
      <div class="deploy-create-main">
        <ElForm label-width="140px" class="dc-form">
          <ElDivider content-position="left" class="dc-section-divider-top">基础配置</ElDivider>
          <ElFormItem label="命名空间">
            <span class="dc-readonly-value">{{ basicInfo.namespace }}</span>
          </ElFormItem>
          <ElFormItem label="资源名称">
            <span class="dc-readonly-value">{{ basicInfo.name }}（{{ kindLabel }}）</span>
          </ElFormItem>
          <ElDivider content-position="left" style="margin: 4px 0 12px">Pod设置</ElDivider>

          <ElFormItem label="实例内容器" class="container-form-item" style="margin-top: 20px">
            <div class="container-pane">
              <div class="container-tabs-bar">
                <div
                  v-for="(c, idx) in containers"
                  :key="idx"
                  class="container-tab-item"
                  :class="{ 'is-active': idx === activeContainerIdx }"
                  @click="activeContainerIdx = idx"
                >
                  <span class="container-tab-name">{{ c.name || `container-${idx + 1}` }}</span>
                </div>
              </div>

              <div class="container-form-wrap">
                <ElForm
                  v-if="containers.length"
                  label-width="110px"
                  class="dc-form container-dc-form"
                >
                  <ElDivider
                    content-position="left"
                    class="dc-section-divider-top"
                    style="visibility: hidden; margin: 0"
                  />
                  <ElFormItem label="容器名称">
                    <span class="dc-readonly-value">{{ containers[activeContainerIdx].name }}</span>
                  </ElFormItem>
                  <ElFormItem label="镜像">
                    <ElInput
                      v-model="containers[activeContainerIdx].image"
                      placeholder="请输入完整的镜像地址"
                      style="width: 460px"
                    />
                  </ElFormItem>
                  <ElFormItem label="镜像版本">
                    <ElInput
                      v-model="containers[activeContainerIdx].imageTag"
                      placeholder="不填默认为 latest"
                      style="width: 460px"
                    />
                  </ElFormItem>
                  <ElFormItem label="拉取策略">
                    <div class="advanced-field-wrap">
                      <ElRadioGroup
                        v-model="containers[activeContainerIdx].imagePullPolicy"
                        class="pull-policy-group"
                      >
                        <ElRadioButton label="Always" value="Always" />
                        <ElRadioButton label="IfNotPresent" value="IfNotPresent" />
                        <ElRadioButton label="Never" value="Never" />
                      </ElRadioGroup>
                      <div class="dc-field-tip">
                        <template v-if="containers[activeContainerIdx].imagePullPolicy === 'Always'">总是从远程拉取该镜像</template>
                        <template v-else-if="containers[activeContainerIdx].imagePullPolicy === 'IfNotPresent'">默认使用本地镜像，若本地无该镜像则远程拉取该镜像</template>
                        <template v-else>只使用本地镜像，若本地没有该镜像将报异常</template>
                      </div>
                    </div>
                  </ElFormItem>
                  <ElFormItem label="环境变量">
                    <div class="kv-list">
                      <div
                        v-for="(item, idx) in containers[activeContainerIdx].envs"
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
                          @click="removeEnv(activeContainerIdx, idx)"
                        ><ElIcon><Close /></ElIcon></ElButton>
                      </div>
                      <ElButton link type="primary" class="kv-add-btn" @click="addEnv(activeContainerIdx)">新增变量</ElButton>
                    </div>
                  </ElFormItem>
                  <ElFormItem label="CPU/内存限制" label-width="110px" class="cpu-mem-limit-form-item">
                    <div class="cpu-mem-limit-wrap">
                      <div class="cpu-mem-limit-block">
                        <div class="cpu-mem-limit-block-title">CPU限制</div>
                        <div class="cpu-mem-limit-inputs">
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">request</span>
                            <ElInput v-model="containers[activeContainerIdx].cpuRequest" placeholder="不限制" class="resource-affix-input" />
                          </div>
                          <span class="resource-affix-sep">-</span>
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">limit</span>
                            <ElInput v-model="containers[activeContainerIdx].cpuLimit" placeholder="不限制" class="resource-affix-input" />
                          </div>
                          <span class="resource-unit-suffix">核</span>
                        </div>
                      </div>
                      <div class="cpu-mem-limit-block">
                        <div class="cpu-mem-limit-block-title">内存限制</div>
                        <div class="cpu-mem-limit-inputs">
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">request</span>
                            <ElInput v-model="containers[activeContainerIdx].memoryRequest" placeholder="不限制" class="resource-affix-input" />
                          </div>
                          <span class="resource-affix-sep">-</span>
                          <div class="resource-affix-group resource-affix-group--grow">
                            <span class="resource-affix-label">limit</span>
                            <ElInput v-model="containers[activeContainerIdx].memoryLimit" placeholder="不限制" class="resource-affix-input" />
                          </div>
                          <span class="resource-unit-suffix">MiB</span>
                        </div>
                      </div>
                    </div>
                    <div class="cpu-mem-limit-tips">
                      <div class="dc-field-tip cpu-mem-tip-line">Request 用于预分配资源，当集群中的节点没有 request 所要求的资源数量时，容器会创建失败。</div>
                      <div class="dc-field-tip cpu-mem-tip-line">Limit 用于设置容器使用资源的最大上限，避免异常情况下节点资源消耗过多。</div>
                    </div>
                  </ElFormItem>
                  <ElFormItem label="容器端口">
                    <div class="port-table">
                      <div v-if="containers[activeContainerIdx].ports.length" class="port-table-box">
                        <div class="port-table-header">
                          <span class="port-col-name">端口名称</span>
                          <span class="port-col-protocol">协议</span>
                          <span class="port-col-port">端口</span>
                        </div>
                        <div
                          v-for="(item, idx) in containers[activeContainerIdx].ports"
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
                            @input="(v: string) => {
                              const n = parseInt(v.replace(/\D/g, ''))
                              item.containerPort = n > 0 && n <= 65535 ? n : item.containerPort || 80
                            }"
                          />
                          <ElButton link class="kv-del-btn port-del-btn" @click="removePort(activeContainerIdx, idx)">
                            <ElIcon><Close /></ElIcon>
                          </ElButton>
                        </div>
                      </div>
                      <ElButton link type="primary" class="kv-add-btn" @click="addPort(activeContainerIdx)">添加容器端口</ElButton>
                    </div>
                  </ElFormItem>

                  <!-- 高级配置 -->
                  <div class="container-advanced-config-toggle">
                    <ElButton link type="primary" class="kv-add-btn" @click="showContainerAdvancedConfig = !showContainerAdvancedConfig">
                      {{ showContainerAdvancedConfig ? '隐藏高级配置' : '显示高级配置' }}
                    </ElButton>
                  </div>
                  <template v-if="showContainerAdvancedConfig">
                    <ElFormItem label="初始化容器">
                      <div class="advanced-field-wrap">
                        <ElSwitch v-model="containers[activeContainerIdx].initContainer" />
                        <div class="dc-field-tip">容器标识为init container</div>
                      </div>
                    </ElFormItem>
                    <ElFormItem label="特权级容器">
                      <div class="advanced-field-wrap">
                        <ElSwitch v-model="containers[activeContainerIdx].privileged" />
                        <div class="dc-field-tip">容器开启特权级，将拥有宿主机的root权限</div>
                      </div>
                    </ElFormItem>
                    <ElFormItem label="运行命令">
                      <ElInput
                        v-model="containers[activeContainerIdx].commandText"
                        type="textarea"
                        :rows="3"
                        style="width: 350px"
                        placeholder="每行一个 command 参数，如 /bin/sh"
                      />
                    </ElFormItem>
                    <ElFormItem label="运行参数">
                      <ElInput
                        v-model="containers[activeContainerIdx].argsText"
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
                            <ElTooltip content="容器启动后执行的命令（postStart hook）" placement="top">
                              <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                            </ElTooltip>
                            <ElButton link type="primary" class="kv-add-btn lifecycle-add-btn" @click="addPostStart">新增</ElButton>
                          </div>
                          <div class="lifecycle-inputs">
                            <div
                              v-for="(cmd, ci) in containers[activeContainerIdx].postStartCommands"
                              :key="`post-${ci}`"
                              class="lifecycle-input-row"
                            >
                              <ElInput
                                v-model="containers[activeContainerIdx].postStartCommands[ci]"
                                type="textarea"
                                :rows="3"
                                placeholder="为避免解析错误，注意每条命令需单独在一个输入框输入"
                                class="lifecycle-textarea"
                              />
                              <ElButton link class="kv-del-btn lifecycle-del-btn" @click="removePostStart(ci)">
                                <ElIcon><Close /></ElIcon>
                              </ElButton>
                            </div>
                          </div>
                        </div>
                        <div class="lifecycle-section">
                          <div class="lifecycle-section-label">
                            <span>结束前执行</span>
                            <ElTooltip content="容器终止前执行的命令（preStop hook）" placement="top">
                              <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                            </ElTooltip>
                            <ElButton link type="primary" class="kv-add-btn lifecycle-add-btn" @click="addPreStop">新增</ElButton>
                          </div>
                          <div class="lifecycle-inputs">
                            <div
                              v-for="(cmd, ci) in containers[activeContainerIdx].preStopCommands"
                              :key="`pre-${ci}`"
                              class="lifecycle-input-row"
                            >
                              <ElInput
                                v-model="containers[activeContainerIdx].preStopCommands[ci]"
                                type="textarea"
                                :rows="3"
                                placeholder="为避免解析错误，注意每条命令需单独在一个输入框输入"
                                class="lifecycle-textarea"
                              />
                              <ElButton link class="kv-del-btn lifecycle-del-btn" @click="removePreStop(ci)">
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
                          <ElIcon class="lifecycle-info-icon" style="margin-left: 4px"><InfoFilled /></ElIcon>
                        </ElTooltip>
                      </template>
                      <div class="health-check-wrap">
                        <div class="health-check-row">
                          <ElCheckbox v-model="containers[activeContainerIdx].liveness.enabled" />
                          <span class="health-check-title">存活检查</span>
                          <span class="health-check-desc">检查容器是否正常，不正常则重启实例</span>
                        </div>
                        <div v-if="containers[activeContainerIdx].liveness.enabled" class="health-check-panel">
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查方法</span>
                            <ElSelect v-model="containers[activeContainerIdx].liveness.method" style="width: 200px">
                              <ElOption label="TCP端口检查" value="tcp" />
                              <ElOption label="HTTP请求检查" value="http" />
                              <ElOption label="执行命令检查" value="exec" />
                            </ElSelect>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              host
                              <ElTooltip content="大多数情况下不需要填 host 字段，请谨慎填写防止探测失败" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <ElInput v-model="containers[activeContainerIdx].liveness.host" placeholder="默认为 Pod IP，一般不需要修改" style="width: 200px" />
                              <div class="dc-field-tip">大多数情况下不需要填 host 字段，请谨慎填写防止探测失败</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查端口</span>
                            <div class="probe-field-col">
                              <ElInput v-model="containers[activeContainerIdx].liveness.port" placeholder="请输入检查端口" style="width: 200px" />
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
                                <ElInput v-model.number="containers[activeContainerIdx].liveness.initialDelaySeconds" style="width: 220px" />
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
                                <ElInput v-model.number="containers[activeContainerIdx].liveness.timeoutSeconds" style="width: 220px" />
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
                                <ElInput v-model.number="containers[activeContainerIdx].liveness.periodSeconds" style="width: 220px" />
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
                              <ElInput v-model.number="containers[activeContainerIdx].liveness.successThreshold" style="width: 220px" />
                              <span class="probe-unit">次</span>
                            </div>
                          </div>
                        </div>
                        <div class="health-check-row" style="margin-top: 8px">
                          <ElCheckbox v-model="containers[activeContainerIdx].readiness.enabled" />
                          <span class="health-check-title">就绪检查</span>
                          <span class="health-check-desc">检查容器是否就绪，未就绪则不接收流量</span>
                        </div>
                        <div v-if="containers[activeContainerIdx].readiness.enabled" class="health-check-panel">
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查方法</span>
                            <ElSelect v-model="containers[activeContainerIdx].readiness.method" style="width: 200px">
                              <ElOption label="TCP端口检查" value="tcp" />
                              <ElOption label="HTTP请求检查" value="http" />
                              <ElOption label="执行命令检查" value="exec" />
                            </ElSelect>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">
                              host
                              <ElTooltip content="大多数情况下不需要填 host 字段，请谨慎填写防止探测失败" placement="top">
                                <ElIcon class="lifecycle-info-icon"><InfoFilled /></ElIcon>
                              </ElTooltip>
                            </span>
                            <div class="probe-field-col">
                              <ElInput v-model="containers[activeContainerIdx].readiness.host" placeholder="默认为 Pod IP，一般不需要修改" style="width: 200px" />
                              <div class="dc-field-tip">大多数情况下不需要填 host 字段，请谨慎填写防止探测失败</div>
                            </div>
                          </div>
                          <div class="probe-field-row">
                            <span class="probe-field-label">检查端口</span>
                            <div class="probe-field-col">
                              <ElInput v-model="containers[activeContainerIdx].readiness.port" placeholder="请输入检查端口" style="width: 200px" />
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
                                <ElInput v-model.number="containers[activeContainerIdx].readiness.initialDelaySeconds" style="width: 220px" />
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
                                <ElInput v-model.number="containers[activeContainerIdx].readiness.timeoutSeconds" style="width: 220px" />
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
                                <ElInput v-model.number="containers[activeContainerIdx].readiness.periodSeconds" style="width: 220px" />
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
                              <ElInput v-model.number="containers[activeContainerIdx].readiness.successThreshold" style="width: 220px" />
                              <span class="probe-unit">次</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ElFormItem>
                  </template>
                </ElForm>
              </div>
            </div>
          </ElFormItem>

          <!-- 镜像访问凭证 -->
          <ElFormItem label="镜像访问凭证">
            <div class="pull-secret-wrap">
              <div v-if="showPullSecretSelect" class="pull-secret-row">
                <ElSelect v-model="imagePullSecret" placeholder="不指定访问凭证" style="width: 200px" filterable>
                  <ElOption v-for="s in pullSecrets" :key="s" :label="s" :value="s" />
                </ElSelect>
                <ElButton link class="pull-secret-icon-btn" @click="loadPullSecrets">
                  <ElIcon><Refresh /></ElIcon>
                </ElButton>
                <ElButton link class="pull-secret-icon-btn" @click="clearPullSecret">
                  <ElIcon><Close /></ElIcon>
                </ElButton>
              </div>
              <ElButton link type="primary" class="kv-add-btn" @click="onAddPullSecret">添加镜像访问凭证</ElButton>
              <div class="dc-field-tip">请指定镜像访问凭证以拉取私有镜像，实现免密拉取</div>
            </div>
          </ElFormItem>
        </ElForm>
      </div>

      <div class="deploy-create-footer">
        <ElButton @click="goBack">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">更新Pod设置</ElButton>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { ArrowLeft, Close, Refresh, InfoFilled } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchK8sDeployment, patchK8sDeployment } from '@/api/kubernetes/deployment'
  import { fetchK8sStatefulSet, patchK8sStatefulSet } from '@/api/kubernetes/statefulset'
  import { fetchK8sDaemonSet, patchK8sDaemonSet } from '@/api/kubernetes/daemonset'
  import { fetchK8sSecretList } from '@/api/kubernetes/secret'

  defineOptions({ name: 'WorkloadUpdatePage' })

  const route = useRoute()
  const router = useRouter()

  const cluster = computed(() => String(route.query.cluster ?? ''))
  const namespace = computed(() => String(route.query.namespace ?? ''))
  const name = computed(() => String(route.query.name ?? ''))
  const kind = computed(() => String(route.query.kind ?? 'deploy') as 'deploy' | 'sts' | 'ds')

  const kindLabel = computed(() => {
    if (kind.value === 'sts') return 'StatefulSet'
    if (kind.value === 'ds') return 'DaemonSet'
    return 'Deployment'
  })

  const loading = ref(false)
  const submitting = ref(false)
  const activeContainerIdx = ref(0)
  const showContainerAdvancedConfig = ref(false)
  const showPullSecretSelect = ref(false)
  const pullSecrets = ref<string[]>([])
  const imagePullSecret = ref('')

  const basicInfo = ref({ name: '', namespace: '' })

  type ProbeState = {
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

  function defaultProbe(): ProbeState {
    return { enabled: false, method: 'tcp', host: '', port: '', path: '', initialDelaySeconds: 0, timeoutSeconds: 1, periodSeconds: 10, successThreshold: 1, failureThreshold: 3 }
  }

  type ContainerState = {
    name: string
    image: string
    imageTag: string
    imagePullPolicy: 'IfNotPresent' | 'Always' | 'Never'
    envs: Array<{ name: string; mode: 'value'; value: string; sourceName: string; sourceKey: string }>
    cpuRequest: string
    cpuLimit: string
    memoryRequest: string
    memoryLimit: string
    ports: Array<{ containerPort: number; name: string; protocol: 'TCP' | 'UDP' | 'SCTP' }>
    initContainer: boolean
    privileged: boolean
    commandText: string
    argsText: string
    postStartCommands: string[]
    preStopCommands: string[]
    liveness: ProbeState
    readiness: ProbeState
  }

  const containers = ref<ContainerState[]>([])

  function splitImage(full: string): [string, string] {
    const lastColon = full.lastIndexOf(':')
    if (lastColon === -1) return [full, '']
    const tag = full.slice(lastColon + 1)
    if (tag.includes('/')) return [full, '']
    return [full.slice(0, lastColon), tag]
  }

  function buildImage(image: string, tag: string): string {
    const t = tag.trim()
    const i = image.trim()
    if (!t || t === 'latest') return i
    return `${i}:${t}`
  }

  type RawContainer = {
    name?: string
    image?: string
    imagePullPolicy?: string
    env?: Array<{ name?: string; value?: string }>
    resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } }
    ports?: Array<{ containerPort?: number; name?: string; protocol?: string }>
    command?: string[]
    args?: string[]
    securityContext?: { privileged?: boolean }
    lifecycle?: {
      postStart?: { exec?: { command?: string[] } }
      preStop?: { exec?: { command?: string[] } }
    }
    livenessProbe?: { tcpSocket?: { port?: string | number }; httpGet?: { port?: string | number }; initialDelaySeconds?: number; timeoutSeconds?: number; periodSeconds?: number; successThreshold?: number; failureThreshold?: number }
    readinessProbe?: { tcpSocket?: { port?: string | number }; httpGet?: { port?: string | number }; initialDelaySeconds?: number; timeoutSeconds?: number; periodSeconds?: number; successThreshold?: number; failureThreshold?: number }
  }

  function parseProbe(raw: RawContainer['livenessProbe'], enabled: boolean): ProbeState {
    if (!raw) return defaultProbe()
    const method: ProbeState['method'] = raw.tcpSocket ? 'tcp' : raw.httpGet ? 'http' : 'exec'
    const portVal = raw.tcpSocket?.port ?? raw.httpGet?.port ?? ''
    return {
      enabled,
      method,
      host: '',
      port: String(portVal),
      path: '',
      initialDelaySeconds: raw.initialDelaySeconds ?? 0,
      timeoutSeconds: raw.timeoutSeconds ?? 1,
      periodSeconds: raw.periodSeconds ?? 10,
      successThreshold: raw.successThreshold ?? 1,
      failureThreshold: raw.failureThreshold ?? 3
    }
  }

  function parseContainersFromSpec(raw: RawContainer[], isInit = false): ContainerState[] {
    return raw.map((c) => {
      const [image, imageTag] = splitImage(c.image ?? '')
      return {
        name: c.name ?? '',
        image,
        imageTag,
        imagePullPolicy: (c.imagePullPolicy ?? 'IfNotPresent') as ContainerState['imagePullPolicy'],
        envs: (c.env ?? []).map((e) => ({ name: e.name ?? '', mode: 'value' as const, value: e.value ?? '', sourceName: '', sourceKey: '' })),
        cpuRequest: c.resources?.requests?.cpu ?? '',
        cpuLimit: c.resources?.limits?.cpu ?? '',
        memoryRequest: c.resources?.requests?.memory ?? '',
        memoryLimit: c.resources?.limits?.memory ?? '',
        ports: (c.ports ?? []).map((p) => ({ containerPort: p.containerPort ?? 80, name: p.name ?? '', protocol: (p.protocol ?? 'TCP') as 'TCP' | 'UDP' | 'SCTP' })),
        initContainer: isInit,
        privileged: c.securityContext?.privileged ?? false,
        commandText: (c.command ?? []).join('\n'),
        argsText: (c.args ?? []).join('\n'),
        postStartCommands: c.lifecycle?.postStart?.exec?.command ?? [],
        preStopCommands: c.lifecycle?.preStop?.exec?.command ?? [],
        liveness: parseProbe(c.livenessProbe, !!c.livenessProbe),
        readiness: parseProbe(c.readinessProbe, !!c.readinessProbe)
      }
    })
  }

  async function loadWorkload() {
    if (!cluster.value || !namespace.value || !name.value) return
    loading.value = true
    try {
      let regularContainers: ContainerState[] = []
      let initContainers: ContainerState[] = []
      let pullSecretName = ''

      const extractSpec = (spec: { containers?: RawContainer[]; initContainers?: RawContainer[]; imagePullSecrets?: Array<{ name?: string }> } | undefined) => {
        regularContainers = parseContainersFromSpec(spec?.containers ?? [], false)
        initContainers = parseContainersFromSpec(spec?.initContainers ?? [], true)
        pullSecretName = spec?.imagePullSecrets?.[0]?.name ?? ''
      }

      if (kind.value === 'deploy') {
        const data = await fetchK8sDeployment(cluster.value, namespace.value, name.value)
        basicInfo.value = { name: name.value, namespace: namespace.value }
        extractSpec(data.spec?.template?.spec as Parameters<typeof extractSpec>[0])
      } else if (kind.value === 'sts') {
        const data = await fetchK8sStatefulSet(cluster.value, namespace.value, name.value)
        basicInfo.value = { name: name.value, namespace: namespace.value }
        extractSpec(data.spec?.template?.spec as Parameters<typeof extractSpec>[0])
      } else {
        const data = await fetchK8sDaemonSet(cluster.value, namespace.value, name.value)
        basicInfo.value = { name: name.value, namespace: namespace.value }
        extractSpec(data.spec?.template?.spec as Parameters<typeof extractSpec>[0])
      }

      containers.value = [...regularContainers, ...initContainers]
      activeContainerIdx.value = 0

      if (pullSecretName) {
        imagePullSecret.value = pullSecretName
        showPullSecretSelect.value = true
      }
    } catch (e: unknown) {
      ElMessage.error(`加载失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      loading.value = false
    }
  }

  async function loadPullSecrets() {
    if (!cluster.value || !namespace.value) return
    try {
      const { items } = await fetchK8sSecretList(cluster.value, { page: 1, limit: 500, namespace: namespace.value })
      pullSecrets.value = items
        .filter((s) => s.type === 'kubernetes.io/dockerconfigjson' || s.type === 'kubernetes.io/dockercfg')
        .map((s) => s.metadata?.name ?? '')
        .filter(Boolean)
    } catch {
      pullSecrets.value = []
    }
  }

  function onAddPullSecret() {
    showPullSecretSelect.value = true
    void loadPullSecrets()
  }

  function clearPullSecret() {
    showPullSecretSelect.value = false
    imagePullSecret.value = ''
  }

  function buildResources(c: ContainerState) {
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

  function parseCommandLines(text: string): string[] {
    return text.split('\n').map((l) => l.trim()).filter(Boolean)
  }

  function buildContainerPatch(c: ContainerState) {
    const image = buildImage(c.image, c.imageTag)
    const resources = buildResources(c)
    const env = c.envs.filter((e) => e.name.trim()).map((e) => ({ name: e.name.trim(), value: e.value }))
    const ports = c.ports.filter((p) => p.containerPort > 0 && p.containerPort <= 65535).map((p) => ({ containerPort: p.containerPort, ...(p.name.trim() ? { name: p.name.trim() } : {}), protocol: p.protocol }))
    const command = parseCommandLines(c.commandText)
    const args = parseCommandLines(c.argsText)
    const lifecycle: Record<string, unknown> = {}
    if (c.postStartCommands.length) lifecycle.postStart = { exec: { command: c.postStartCommands } }
    if (c.preStopCommands.length) lifecycle.preStop = { exec: { command: c.preStopCommands } }
    const buildProbe = (probe: ProbeState) => {
      if (!probe.enabled) return undefined
      const portRaw = probe.port.trim() || '80'
      const port: string | number = /^\d+$/.test(portRaw) ? parseInt(portRaw, 10) : portRaw
      const base = { initialDelaySeconds: probe.initialDelaySeconds, periodSeconds: probe.periodSeconds, timeoutSeconds: probe.timeoutSeconds, successThreshold: probe.successThreshold, failureThreshold: probe.failureThreshold }
      if (probe.method === 'tcp') return { ...base, tcpSocket: { port } }
      if (probe.method === 'http') return { ...base, httpGet: { path: probe.path || '/', port } }
      return undefined
    }
    const livenessProbe = buildProbe(c.liveness)
    const readinessProbe = buildProbe(c.readiness)
    return {
      name: c.name,
      image,
      imagePullPolicy: c.imagePullPolicy,
      ...(env.length ? { env } : { env: [] }),
      ...(resources ? { resources } : {}),
      ...(ports.length ? { ports } : {}),
      ...(command.length ? { command } : {}),
      ...(args.length ? { args } : {}),
      ...(Object.keys(lifecycle).length ? { lifecycle } : {}),
      ...(c.privileged ? { securityContext: { privileged: true } } : {}),
      ...(livenessProbe ? { livenessProbe } : {}),
      ...(readinessProbe ? { readinessProbe } : {})
    }
  }

  function buildPatch() {
    const regular = containers.value.filter((c) => !c.initContainer).map(buildContainerPatch)
    const init = containers.value.filter((c) => c.initContainer).map(buildContainerPatch)
    const pullSecretPatch = imagePullSecret.value
      ? [{ name: imagePullSecret.value }]
      : []
    return {
      spec: {
        template: {
          spec: {
            containers: regular,
            ...(init.length ? { initContainers: init } : {}),
            imagePullSecrets: pullSecretPatch
          }
        }
      }
    }
  }

  async function submit() {
    if (!cluster.value || !namespace.value || !name.value) {
      ElMessage.warning('缺少必要参数')
      return
    }
    submitting.value = true
    try {
      const patch = buildPatch()
      if (kind.value === 'deploy') {
        await patchK8sDeployment(cluster.value, namespace.value, name.value, patch)
      } else if (kind.value === 'sts') {
        await patchK8sStatefulSet(cluster.value, namespace.value, name.value, patch)
      } else {
        await patchK8sDaemonSet(cluster.value, namespace.value, name.value, patch)
      }
      ElMessage.success(`${kindLabel.value}(${name.value}) 更新成功`)
      goBack()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      submitting.value = false
    }
  }

  function goBack() {
    router.push({ path: '/container/workloads', query: { cluster: cluster.value, tab: kind.value } })
  }

  function addEnv(cidx: number) { containers.value[cidx].envs.push({ name: '', mode: 'value', value: '', sourceName: '', sourceKey: '' }) }
  function removeEnv(cidx: number, idx: number) { containers.value[cidx].envs.splice(idx, 1) }
  function addPort(cidx: number) { containers.value[cidx].ports.push({ containerPort: 80, name: '', protocol: 'TCP' }) }
  function removePort(cidx: number, idx: number) { containers.value[cidx].ports.splice(idx, 1) }
  function addPostStart() { containers.value[activeContainerIdx.value].postStartCommands.push('') }
  function removePostStart(idx: number) { containers.value[activeContainerIdx.value].postStartCommands.splice(idx, 1) }
  function addPreStop() { containers.value[activeContainerIdx.value].preStopCommands.push('') }
  function removePreStop(idx: number) { containers.value[activeContainerIdx.value].preStopCommands.splice(idx, 1) }

  onMounted(() => { void loadWorkload() })
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
    .deploy-create-page { padding-left: 20px; padding-right: 20px; }
    .deploy-create-header { margin-left: -20px; }
  }

  @media (max-width: 768px) {
    .deploy-create-page { padding-left: 12px; padding-right: 12px; }
    .deploy-create-header { margin-left: -12px; }
  }

  .deploy-create-main { display: flex; gap: 0; }

  .dc-form { max-width: none; width: 100%; }
  .dc-form :deep(.el-form-item__label) { font-size: 12px; padding-right: 16px; }
  .dc-form :deep(.el-input__placeholder), .dc-form :deep(.el-textarea__placeholder) { font-size: 12px; }
  .dc-form :deep(.el-checkbox__label) { font-size: 12px; }

  .dc-section-divider-top { margin-top: 16px; }
  .dc-section-divider-top :deep(.el-divider__text) { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); }

  .container-form-item :deep(.el-form-item__content) { width: 100%; max-width: none; flex: 1; }
  .container-form-item :deep(.el-form-item__label) { font-size: 12px; }

  .deploy-create-footer { margin-top: 10px; display: flex; justify-content: center; gap: 10px; }

  .dc-readonly-value { font-size: 13px; color: var(--el-text-color-primary); line-height: 32px; }

  .kv-list { width: 100%; }

  .env-row {
    display: grid;
    grid-template-columns: 140px 1fr 1fr 1fr auto;
    gap: 8px;
    margin-bottom: 8px;
  }
  .env-row .env-del-btn { justify-self: end; align-self: center; }

  .container-pane { display: flex; flex-direction: column; gap: 0; }

  .container-tabs-bar { display: flex; align-items: center; gap: 20px; padding: 0 0 8px; flex-wrap: wrap; }

  .container-tab-item {
    display: inline-flex; align-items: center; justify-content: center;
    position: relative; padding: 6px 10px; height: 35px; width: 110px;
    border-radius: 4px; font-size: 13px; cursor: pointer; background: transparent;
    color: var(--el-text-color-regular); border: 1px solid var(--el-border-color);
    transition: border-color 0.15s; user-select: none; box-sizing: border-box;
  }
  .container-tab-item:hover { border-color: var(--el-color-primary); }
  .container-tab-item.is-active { background: var(--el-bg-color-overlay); color: var(--el-color-primary); font-weight: 500; border-color: var(--el-color-primary); }
  .container-tab-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .container-form-wrap { background: var(--el-fill-color-light, #f5f7fa); border-radius: 6px; padding: 16px 12px 8px; }

  .pull-policy-group {
    --el-radio-button-checked-border-color: var(--el-color-primary);
    --el-radio-button-checked-bg-color: var(--el-bg-color-overlay);
    --el-radio-button-checked-text-color: var(--el-color-primary);
    display: inline-flex; flex-wrap: nowrap; width: fit-content; max-width: 100%; box-sizing: border-box; vertical-align: middle;
  }
  .pull-policy-group :deep(.el-radio-button) { flex: 0 0 auto; display: inline-flex; }
  .pull-policy-group :deep(.el-radio-button__inner) {
    display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
    text-align: center; font-size: 12px; line-height: 1.2; padding: 2px 10px; min-height: 22px;
    white-space: nowrap; font-weight: 400; color: var(--el-text-color-regular);
    background: transparent; border: 1px solid var(--el-border-color); border-radius: 0 !important;
    transition: border-color 0.15s, color 0.15s, background-color 0.15s;
  }
  .pull-policy-group :deep(.el-radio-button:first-child .el-radio-button__inner),
  .pull-policy-group :deep(.el-radio-button:last-child .el-radio-button__inner) { border-radius: 0 !important; }
  .pull-policy-group :deep(.el-radio-button__inner:hover) { border-color: var(--el-color-primary); color: var(--el-color-primary); }
  .pull-policy-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: var(--el-bg-color-overlay) !important; color: var(--el-color-primary) !important;
    font-weight: 500 !important; border-color: var(--el-color-primary) !important;
    box-shadow: none !important; position: relative; z-index: 1;
  }

  .container-form-wrap .dc-form { max-width: 920px; }
  .container-dc-form :deep(.el-form-item__label) { font-size: 12px; white-space: nowrap; }
  .container-dc-form :deep(.el-input__inner), .container-dc-form :deep(.el-textarea__inner), .container-dc-form :deep(.el-select__wrapper) { font-size: 13px; }
  .container-dc-form :deep(.el-form-item) { margin-bottom: 18px; }

  .cpu-mem-limit-form-item.el-form-item { align-items: flex-start; }
  .cpu-mem-limit-form-item :deep(.el-form-item__label) { line-height: 20px; padding-top: 0; }
  .cpu-mem-limit-form-item :deep(.el-form-item__content) { flex: 1; flex-direction: column; align-items: stretch; min-width: 0; padding-top: 0; }

  .cpu-mem-limit-wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 40px; row-gap: 0; width: 100%; min-width: 0; align-items: start; }
  .cpu-mem-limit-block { display: flex; flex-direction: column; align-items: stretch; gap: 8px; min-width: 0; }
  .cpu-mem-limit-block-title { font-size: 12px; font-weight: 500; color: var(--el-text-color-primary); line-height: 1.2; margin: 0; }
  .cpu-mem-limit-inputs { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 6px; width: 100%; min-width: 0; }

  .resource-affix-group { display: flex; flex-direction: row; align-items: stretch; min-width: 0; border: 1px solid var(--el-border-color); border-radius: 0; overflow: hidden; background: var(--el-fill-color-blank); box-sizing: border-box; }
  .resource-affix-group--grow { flex: 1 1 0; min-width: 0; }
  .resource-affix-sep { flex-shrink: 0; color: var(--el-text-color-secondary); font-size: 13px; user-select: none; line-height: 1; }
  .resource-affix-group:focus-within { border-color: var(--el-color-primary); }
  .resource-affix-label { display: inline-flex; align-items: center; justify-content: center; width: 64px; flex-shrink: 0; padding: 0 6px; font-size: 12px; color: var(--el-text-color-secondary); background: var(--el-fill-color-light); border-right: 1px solid var(--el-border-color); box-sizing: border-box; }
  .resource-affix-input { flex: 1; min-width: 0; }
  .resource-affix-input :deep(.el-input) { width: 100%; min-width: 0; }
  .resource-affix-input :deep(.el-input__wrapper) { box-shadow: none !important; border: none !important; border-radius: 0 !important; background-color: transparent; padding-top: 0; padding-bottom: 0; height: 28px; align-items: center; }
  .resource-affix-input :deep(.el-input__inner) { text-align: left; }
  .resource-unit-suffix { flex-shrink: 0; align-self: center; font-size: 13px; color: var(--el-text-color-regular); white-space: nowrap; }

  .cpu-mem-limit-tips { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; width: 100%; max-width: none; }
  .cpu-mem-tip-line { white-space: normal; line-height: 1.5; }

  .port-table { display: flex; flex-direction: column; align-items: flex-start; gap: 0; width: 100%; }
  .port-table-box { background: var(--el-bg-color-overlay); border: 1px solid var(--el-border-color-light); border-radius: 4px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; min-width: 560px; box-sizing: border-box; }
  .port-table-header, .port-table-row { display: grid; grid-template-columns: 120px 120px 120px 1fr; gap: 0; align-items: center; }
  .port-table-header { font-size: 12px; color: var(--el-text-color-secondary); padding-bottom: 2px; }
  .port-col-protocol { margin-left: 30px; }
  .port-col-port { margin-left: 60px; }
  .port-table-row .port-del-btn { justify-self: end; }
  .port-col-name, .port-col-protocol, .port-col-port { width: 100% !important; }
  .port-del-btn { justify-content: center; }

  .dc-field-tip { font-size: 12px; color: var(--el-text-color-placeholder); line-height: 1.5; margin-top: 4px; white-space: nowrap; }
  .dc-form :deep(.el-form-item__content) { flex-wrap: wrap; align-items: flex-start; row-gap: 0; }
  .dc-form :deep(.el-input__inner), .dc-form :deep(.el-textarea__inner), .dc-form :deep(.el-select__wrapper) { font-size: 13px; }

  .kv-add-btn { font-size: 12px; }
  .kv-del-btn { color: var(--el-text-color-primary); }

  .advanced-field-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .advanced-field-wrap .dc-field-tip { margin-top: 0; }

  .container-advanced-config-toggle { padding-left: 20px; margin-top: 4px; margin-bottom: 2px; }
  .container-advanced-config-toggle .kv-add-btn { font-size: 12px; }

  .lifecycle-wrap { display: flex; flex-direction: column; gap: 2px; width: 100%; }
  .lifecycle-section { display: flex; flex-direction: column; gap: 0; }
  .lifecycle-section-label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--el-text-color-regular); margin-bottom: 4px; }
  .lifecycle-info-icon { font-size: 14px; color: var(--el-text-color-placeholder); cursor: default; }
  .lifecycle-inputs { display: flex; flex-direction: column; gap: 4px; }
  .lifecycle-input-row { display: flex; align-items: flex-start; gap: 8px; }
  .lifecycle-textarea { flex: 1; }
  .lifecycle-del-btn { margin-top: 6px; flex-shrink: 0; }
  .lifecycle-add-btn { margin-left: 8px; }

  .health-check-form-item :deep(.el-form-item__label) { display: flex; align-items: center; }
  .health-check-wrap { display: flex; flex-direction: column; width: 100%; }
  .health-check-row { display: flex; align-items: center; gap: 8px; }
  .health-check-title { font-size: 12px; font-weight: 500; color: var(--el-text-color-primary); }
  .health-check-desc { font-size: 12px; color: var(--el-text-color-secondary); }
  .health-check-panel { background: var(--el-bg-color-overlay); border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 16px 20px; margin-top: 8px; display: flex; flex-direction: column; gap: 10px; align-self: flex-start; width: 500px; }
  .health-check-panel :deep(.el-input__wrapper) { height: 28px; }
  .health-check-panel :deep(.el-select__wrapper) { height: 28px !important; min-height: 28px !important; }
  .probe-field-row { display: flex; align-items: flex-start; gap: 12px; }
  .probe-field-label { display: flex; align-items: center; gap: 3px; width: 72px; flex-shrink: 0; font-size: 12px; color: var(--el-text-color-regular); padding-top: 5px; }
  .probe-field-col { display: flex; flex-direction: column; gap: 2px; }
  .probe-input-unit { display: flex; align-items: center; gap: 4px; }
  .probe-unit { font-size: 12px; color: var(--el-text-color-regular); white-space: nowrap; }
  .health-check-panel .probe-input-unit :deep(.el-input) { width: 70px !important; }
  .health-check-panel .probe-input-unit :deep(.el-input__inner) { font-size: 11px !important; }

  .pull-secret-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .pull-secret-row { display: flex; align-items: center; gap: 6px; }
  .pull-secret-icon-btn { padding: 4px; font-size: 14px; color: var(--el-text-color-secondary); }
  .pull-secret-icon-btn:hover { color: var(--el-color-primary); }
</style>
