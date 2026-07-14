<!-- 通知渠道：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="50%"
    destroy-on-close
    :show-close="false"
    class="alert-channel-drawer"
  >
    <template #header>
      <div class="alert-drawer-header">
        <span class="alert-drawer-title">{{ isEdit ? '编辑通知渠道' : '添加通知渠道' }}</span>
        <ElButton text circle class="alert-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="alert-drawer-body">
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px" class="alert-form">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入渠道名称" />
        </ElFormItem>
        <ElFormItem label="渠道类型" prop="channelType">
          <ElSelect
            v-model="formData.channelType"
            class="w-full alert-channel-type-select"
            popper-class="alert-channel-type-popper"
            @change="onChannelTypeChange"
          >
            <template v-if="selectedChannelType" #prefix>
              <img
                v-if="selectedChannelType.image"
                :src="selectedChannelType.image"
                alt=""
                class="alert-channel-type-option__logo alert-channel-type-option__logo--prefix alert-channel-type-option__logo--image"
              />
              <ArtSvgIcon
                v-else
                :icon="selectedChannelType.icon"
                class="alert-channel-type-option__logo alert-channel-type-option__logo--prefix"
                :style="{ color: selectedChannelType.color }"
              />
            </template>
            <ElOption
              v-for="item in channelTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
              :disabled="item.disabled"
            >
              <div class="alert-channel-type-option">
                <img
                  v-if="item.image"
                  :src="item.image"
                  alt=""
                  class="alert-channel-type-option__logo alert-channel-type-option__logo--image"
                />
                <ArtSvgIcon
                  v-else
                  :icon="item.icon"
                  class="alert-channel-type-option__logo"
                  :style="{ color: item.color }"
                />
                <span class="alert-channel-type-option__name">{{ item.label }}</span>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>

        <template v-if="formData.channelType === 2">
          <ElFormItem label="Webhook" prop="dingTalkWebhook">
            <ElInput v-model="formData.dingTalkWebhook" placeholder="钉钉机器人 Webhook URL" />
          </ElFormItem>
          <ElFormItem label="加签密钥" prop="dingTalkSecret">
            <ElInput v-model="formData.dingTalkSecret" placeholder="请输入加签密钥" />
          </ElFormItem>
        </template>

        <template v-else-if="formData.channelType === 3">
          <ElFormItem label="Webhook" prop="weComWebhook">
            <ElInput v-model="formData.weComWebhook" placeholder="企业微信机器人 Webhook URL" />
          </ElFormItem>
        </template>

        <template v-else-if="formData.channelType === 5">
          <ElFormItem label="Webhook" prop="feishuWebhook">
            <ElInput v-model="formData.feishuWebhook" placeholder="飞书机器人 Webhook URL" />
          </ElFormItem>
          <ElFormItem label="加签密钥" prop="feishuSecret">
            <ElInput v-model="formData.feishuSecret" placeholder="请输入加签密钥" />
          </ElFormItem>
        </template>

        <template v-else-if="formData.channelType === 4">
          <ElFormItem label="回调地址" prop="webhookUrl">
            <ElInput v-model="formData.webhookUrl" placeholder="https://example.com/hook" />
          </ElFormItem>
          <ElFormItem label="请求头">
            <ElInput
              v-model="webhookHeadersText"
              type="textarea"
              :rows="4"
              placeholder='JSON 对象，如 {"Authorization":"Bearer xxx"}'
            />
          </ElFormItem>
        </template>

        <template v-else>
          <ElFormItem label="配置 JSON">
            <ElInput
              v-model="rawConfigText"
              type="textarea"
              :rows="6"
              placeholder="请输入渠道配置 JSON"
            />
          </ElFormItem>
        </template>

        <ElFormItem label="描述">
          <ElInput v-model="formData.description" type="textarea" :rows="3" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="启用">
          <ElSwitch v-model="formData.enabled" />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="alert-drawer-footer">
        <ElButton :loading="testing" @click="handleTest">测试</ElButton>
        <div class="alert-drawer-footer__right">
          <ElButton @click="closeDrawer">取消</ElButton>
          <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
        </div>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close } from '@element-plus/icons-vue'
  import { computed, ref, watch } from 'vue'
  import { ElIcon, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    fetchCreateAlertChannel,
    fetchGetAlertChannel,
    fetchUpdateAlertChannel,
    fetchPingAlertChannel,
    type AlertChannelType
  } from '@/api/alert'
  import { PixiuApiError } from '@/api/container'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { alertChannelTypeOptions } from './alert-channel-types'

  const channelTypeOptions = alertChannelTypeOptions

  defineOptions({ name: 'AlertChannelDrawer' })

  const props = defineProps<{ editId?: number }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ success: [] }>()

  const isEdit = computed(() => props.editId != null && props.editId > 0)
  const editLoading = ref(false)
  const submitting = ref(false)
  const testing = ref(false)
  const formRef = ref<FormInstance>()
  const resourceVersion = ref(0)

  function createDefaultFormData() {
    return {
      name: '',
      description: '',
      channelType: 2 as AlertChannelType,
      enabled: true,
      dingTalkWebhook: '',
      dingTalkSecret: '',
      weComWebhook: '',
      webhookUrl: '',
      feishuWebhook: '',
      feishuSecret: ''
    }
  }

  const formData = ref(createDefaultFormData())

  const webhookHeadersText = ref('{}')
  const rawConfigText = ref('{}')

  const selectedChannelType = computed(() =>
    channelTypeOptions.find((item) => item.value === formData.value.channelType)
  )

  const rules = computed<FormRules>(() => {
    const base: FormRules = {
      name: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
      channelType: [{ required: true, message: '请选择渠道类型', trigger: 'change' }]
    }
    if (formData.value.channelType === 2) {
      base.dingTalkWebhook = [{ required: true, message: '请输入 Webhook URL', trigger: 'blur' }]
      base.dingTalkSecret = [{ required: true, message: '请输入加签密钥', trigger: 'blur' }]
    } else if (formData.value.channelType === 3) {
      base.weComWebhook = [{ required: true, message: '请输入 Webhook URL', trigger: 'blur' }]
    } else if (formData.value.channelType === 4) {
      base.webhookUrl = [{ required: true, message: '请输入回调地址', trigger: 'blur' }]
    } else if (formData.value.channelType === 5) {
      base.feishuWebhook = [{ required: true, message: '请输入 Webhook URL', trigger: 'blur' }]
      base.feishuSecret = [{ required: true, message: '请输入加签密钥', trigger: 'blur' }]
    }
    return base
  })

  function closeDrawer() {
    visible.value = false
  }

  function onChannelTypeChange() {
    formData.value.dingTalkWebhook = ''
    formData.value.dingTalkSecret = ''
    formData.value.weComWebhook = ''
    formData.value.webhookUrl = ''
    formData.value.feishuWebhook = ''
    formData.value.feishuSecret = ''
    webhookHeadersText.value = '{}'
    rawConfigText.value = '{}'
    formRef.value?.clearValidate()
  }

  function parseConfig(channelType: AlertChannelType, config: string) {
    onChannelTypeChange()
    if (!config) return
    try {
      const parsed = JSON.parse(config)
      if (channelType === 2) {
        formData.value.dingTalkWebhook = parsed.webhook_url ?? ''
        formData.value.dingTalkSecret = parsed.secret ?? ''
      } else if (channelType === 3) {
        formData.value.weComWebhook = parsed.webhook_url ?? ''
      } else if (channelType === 4) {
        formData.value.webhookUrl = parsed.url ?? ''
        webhookHeadersText.value = JSON.stringify(parsed.headers ?? {}, null, 2)
      } else if (channelType === 5) {
        formData.value.feishuWebhook = parsed.webhook_url ?? ''
        formData.value.feishuSecret = parsed.secret ?? ''
      } else {
        rawConfigText.value = JSON.stringify(parsed, null, 2)
      }
    } catch {
      rawConfigText.value = config
    }
  }

  function buildConfigPayload(): string {
    if (formData.value.channelType === 2) {
      return JSON.stringify({
        webhook_url: formData.value.dingTalkWebhook,
        secret: formData.value.dingTalkSecret
      })
    }
    if (formData.value.channelType === 3) {
      return JSON.stringify({
        webhook_url: formData.value.weComWebhook
      })
    }
    if (formData.value.channelType === 5) {
      return JSON.stringify({
        webhook_url: formData.value.feishuWebhook,
        secret: formData.value.feishuSecret
      })
    }
    if (formData.value.channelType === 4) {
      let headers: Record<string, string> = {}
      try {
        headers = JSON.parse(webhookHeadersText.value || '{}')
      } catch {
        throw new Error('请求头必须是合法 JSON')
      }
      return JSON.stringify({
        url: formData.value.webhookUrl,
        headers
      })
    }
    try {
      return JSON.stringify(JSON.parse(rawConfigText.value || '{}'))
    } catch {
      throw new Error('配置必须是合法 JSON')
    }
  }

  async function loadDetail() {
    if (!isEdit.value || !props.editId) return
    editLoading.value = true
    try {
      const detail = await fetchGetAlertChannel(props.editId)
      resourceVersion.value = detail.resourceVersion
      formData.value = {
        name: detail.name,
        description: detail.description,
        channelType: detail.channelType,
        enabled: detail.enabled,
        dingTalkWebhook: '',
        dingTalkSecret: '',
        weComWebhook: '',
        webhookUrl: '',
        feishuWebhook: '',
        feishuSecret: ''
      }
      parseConfig(detail.channelType, detail.config)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载渠道详情失败')
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  watch(
    () => visible.value,
    async (open) => {
      if (!open) return
      if (isEdit.value) {
        await loadDetail()
      } else {
        resourceVersion.value = 0
        formData.value = createDefaultFormData()
        onChannelTypeChange()
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
      const config = buildConfigPayload()
      if (isEdit.value && props.editId) {
        await fetchUpdateAlertChannel(props.editId, {
          resource_version: resourceVersion.value,
          name: formData.value.name,
          description: formData.value.description,
          channel_type: formData.value.channelType,
          config,
          enabled: formData.value.enabled
        })
        ElMessage.success('更新成功')
      } else {
        await fetchCreateAlertChannel({
          name: formData.value.name,
          description: formData.value.description,
          channel_type: formData.value.channelType,
          config,
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

  async function handleTest() {
    testing.value = true
    try {
      const config = buildConfigPayload()
      await fetchPingAlertChannel({
        channel_type: formData.value.channelType,
        config
      })
      ElMessage.success('连通正常')
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '连通性测试失败')
      }
    } finally {
      testing.value = false
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
    justify-content: space-between;
    align-items: center;
  }

  .alert-drawer-footer__right {
    display: flex;
    gap: 8px;
  }

  :deep(.el-form-item__label),
  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 12px;
  }

  .alert-channel-type-select {
    :deep(.el-select__prefix) {
      display: inline-flex;
      align-items: center;
    }
  }

  .alert-channel-type-option__logo--prefix {
    margin-right: 0;
  }

  .alert-channel-type-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 22px;
    line-height: 22px;
    pointer-events: none;
  }

  .alert-channel-type-option__logo {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    font-size: 16px;
  }

  .alert-channel-type-option__logo--image {
    display: block;
    object-fit: contain;
  }

  .alert-channel-type-option__logo :deep(svg) {
    color: inherit;
  }

  .alert-channel-type-option__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
</style>

<style lang="less">
  .alert-channel-type-popper.el-select__popper:not(.el-tree-select__popper) {
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
</style>
