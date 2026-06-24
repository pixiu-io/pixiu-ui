<template>
  <div class="datasource-page">
    <section class="datasource-header">
      <div class="datasource-header__main">
        <h2 class="datasource-header__title">数据源</h2>
        <p class="datasource-header__desc">查看和管理当前集群已连接的数据源</p>
      </div>

      <ElButton type="primary" class="datasource-header__create" @click="openCreateDialog">
        <ElIcon><Plus /></ElIcon>
        添加数据源
      </ElButton>
    </section>

    <section class="datasource-toolbar">
      <ElInput
        v-model="keyword"
        clearable
        class="datasource-toolbar__search"
        placeholder="按名称或类型搜索"
      >
        <template #prefix>
          <ElIcon><Search /></ElIcon>
        </template>
      </ElInput>

      <ElSelect v-model="sortBy" class="datasource-toolbar__sort">
        <ElOption label="按名称 A-Z" value="name-asc" />
        <ElOption label="按名称 Z-A" value="name-desc" />
        <ElOption label="默认源优先" value="default-first" />
        <ElOption label="最近更新" value="updated-desc" />
      </ElSelect>

      <ElSelect v-model="typeFilter" class="datasource-toolbar__type">
        <ElOption label="全部类型" value="all" />
        <ElOption label="日志" value="log" />
        <ElOption label="告警" value="alert" />
      </ElSelect>

      <ElButton class="datasource-toolbar__refresh" @click="loadDatasources">
        <ElIcon><Refresh /></ElIcon>
      </ElButton>
    </section>

    <section class="datasource-list">
      <ElSkeleton :loading="loading" animated :rows="5">
        <template #template>
          <div v-for="i in 4" :key="i" class="datasource-row datasource-row--skeleton">
            <ElSkeletonItem variant="circle" style="width: 36px; height: 36px" />
            <div class="datasource-row__skeleton-body">
              <ElSkeletonItem variant="text" style="width: 180px" />
              <ElSkeletonItem variant="text" style="width: 320px; margin-top: 10px" />
            </div>
          </div>
        </template>

        <template #default>
          <ElEmpty
            v-if="!pagedItems.length"
            description="当前集群下暂无符合条件的数据源"
            class="datasource-empty"
          />

          <article v-for="item in pagedItems" :key="item.id" class="datasource-row">
            <div class="datasource-row__left">
              <div class="datasource-row__logo" :class="`is-${item.subType}`">
                <ArtSvgIcon
                  :icon="subTypeMeta[item.subType].icon"
                  class="datasource-row__logo-icon"
                />
              </div>

              <div class="datasource-row__content">
                <div class="datasource-row__topline">
                  <span class="datasource-row__name">{{ item.name }}</span>
                </div>

                <div class="datasource-row__meta">
                  <span>{{ subTypeMeta[item.subType].label }}</span>
                  <span class="datasource-row__divider">|</span>
                  <span class="datasource-row__url">{{ resolveDatasourceUrl(item) }}</span>
                  <ElTag v-if="item.isDefault" size="small" type="primary" effect="dark">
                    default
                  </ElTag>
                </div>
              </div>
            </div>

            <div class="datasource-row__right">
              <ElButton plain @click="void openDetail(item.id)">查看</ElButton>
              <ElPopconfirm
                title="确认删除这个数据源吗？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="void removeDatasource(item)"
              >
                <template #reference>
                  <ElButton plain type="danger">删除</ElButton>
                </template>
              </ElPopconfirm>
            </div>
          </article>
        </template>
      </ElSkeleton>
    </section>

    <div v-if="filteredItems.length > pageSize" class="datasource-pagination">
      <ElPagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        layout="total, prev, pager, next"
        :page-sizes="[10, 20, 30]"
        :total="filteredItems.length"
        background
      />
    </div>

    <ElDialog
      v-model="createDialogVisible"
      title="添加数据源"
      width="760px"
      destroy-on-close
      class="datasource-dialog"
      @closed="resetCreateForm"
    >
      <ElForm
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="88px"
        class="datasource-create-form"
      >
        <section class="datasource-form-section">
          <div class="datasource-form-section__title">基础信息</div>

          <ElRow :gutter="16">
            <ElCol :span="12">
              <ElFormItem label="名称" prop="name">
                <ElInput v-model="createForm.name" maxlength="64" show-word-limit />
              </ElFormItem>
            </ElCol>

            <ElCol :span="12">
              <ElFormItem label="类型" prop="type">
                <ElSelect v-model="createForm.type" class="w-full" @change="handleTypeChange">
                  <ElOption label="日志" :value="0" />
                  <ElOption label="告警" :value="1" />
                </ElSelect>
              </ElFormItem>
            </ElCol>

            <ElCol :span="12">
              <ElFormItem label="子类型" prop="subType">
                <ElSelect v-model="createForm.subType" class="w-full">
                  <ElOption
                    v-for="option in currentSubTypeOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </ElSelect>
              </ElFormItem>
            </ElCol>

            <ElCol :span="12">
              <ElFormItem label="默认源">
                <ElSwitch v-model="createForm.isDefault" />
              </ElFormItem>
            </ElCol>
          </ElRow>

          <ElFormItem label="接入地址" prop="url">
            <ElInput
              v-model="createForm.url"
              placeholder="https://loki.example.com 或 http://prometheus.monitoring.svc:9090"
            />
          </ElFormItem>

          <ElFormItem label="描述">
            <ElInput
              v-model="createForm.description"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
            />
          </ElFormItem>
        </section>

        <section class="datasource-form-section datasource-form-section--advanced">
          <div class="datasource-form-section__title">高级配置</div>

          <ElCollapse v-model="advancedPanels" class="datasource-advanced-collapse">
            <ElCollapseItem
              v-if="createForm.type === 0"
              name="auth"
              class="datasource-advanced-collapse__item"
            >
              <template #title>
                <div class="datasource-advanced-collapse__title">
                  <span>鉴权</span>
                  <span class="datasource-advanced-collapse__hint"> 需要时再填写用户名和密码 </span>
                </div>
              </template>

              <ElRow :gutter="16">
                <ElCol :span="12">
                  <ElFormItem label="用户名">
                    <ElInput v-model="createForm.log.userName" placeholder="可选，用于基础认证" />
                  </ElFormItem>
                </ElCol>

                <ElCol :span="12">
                  <ElFormItem label="密码">
                    <ElInput
                      v-model="createForm.log.password"
                      type="password"
                      show-password
                      placeholder="可选，用于基础认证"
                    />
                  </ElFormItem>
                </ElCol>
              </ElRow>
            </ElCollapseItem>

            <ElCollapseItem name="headers" class="datasource-advanced-collapse__item">
              <template #title>
                <div class="datasource-advanced-collapse__title">
                  <span>自定义请求头</span>
                  <span class="datasource-advanced-collapse__hint"> 需要时再补充额外 Header </span>
                </div>
              </template>

              <div class="datasource-form-section__head datasource-form-section__head--inner">
                <div class="datasource-form-section__summary">
                  已填写 {{ filledHeaderCount }} 个请求头
                </div>
                <ElButton text type="primary" @click="addHeader">
                  <ElIcon><Plus /></ElIcon>
                  新增请求头
                </ElButton>
              </div>

              <div class="datasource-headers-panel">
                <div
                  v-for="(header, index) in createForm.headers"
                  :key="`header-${index}`"
                  class="datasource-headers__row"
                >
                  <ElInput v-model="header.key" placeholder="Header Key" />
                  <ElInput v-model="header.value" placeholder="Header Value" />
                  <ElButton text type="danger" @click="removeHeader(index)">移除</ElButton>
                </div>
              </div>
            </ElCollapseItem>
          </ElCollapse>
        </section>
      </ElForm>

      <template #footer>
        <div class="datasource-dialog__footer">
          <ElButton @click="createDialogVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="submitting" @click="submitCreate">创建</ElButton>
        </div>
      </template>
    </ElDialog>

    <ElDrawer v-model="detailVisible" title="数据源详情" size="540px" destroy-on-close>
      <div v-if="detailLoading" class="datasource-detail__loading">
        <ElSkeleton animated :rows="8" />
      </div>

      <template v-else-if="detailItem">
        <div class="datasource-detail__header">
          <div>
            <div class="datasource-detail__name">{{ detailItem.name }}</div>
            <div class="datasource-detail__sub">
              {{ typeLabel(detailItem.type) }} / {{ subTypeMeta[detailItem.subType].label }}
            </div>
          </div>
          <ElTag v-if="detailItem.isDefault" type="primary" effect="dark">default</ElTag>
        </div>

        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="接入地址">{{
            resolveDatasourceUrl(detailItem)
          }}</ElDescriptionsItem>
          <ElDescriptionsItem label="描述">{{ detailItem.description || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="创建时间">
            {{ formatDateTime(detailItem.gmtCreate) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="更新时间">
            {{ formatDateTime(detailItem.gmtModified) }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <div v-if="detailItem.type === 0" class="datasource-detail__section">
          <div class="datasource-detail__section-title">认证信息</div>
          <ElDescriptions :column="1" border>
            <ElDescriptionsItem label="用户名">
              {{ detailItem.config.log?.userName || '-' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="密码">
              {{ detailItem.config.log?.password ? '已配置' : '未配置' }}
            </ElDescriptionsItem>
          </ElDescriptions>
        </div>

        <div class="datasource-detail__section">
          <div class="datasource-detail__section-title">请求头</div>
          <ElTable :data="detailItem.config.headers" border empty-text="未配置请求头">
            <ElTableColumn prop="key" label="Key" min-width="160" />
            <ElTableColumn prop="value" label="Value" min-width="220" show-overflow-tooltip />
          </ElTable>
        </div>
      </template>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchCreateDatasource,
    fetchDatasourceDetail,
    fetchDatasourceList,
    fetchDeleteDatasource,
    resolveDatasourceUrl,
    type CreateDatasourcePayload,
    type DatasourceItem,
    type DatasourceSubType,
    type DatasourceType
  } from '@/api/datasource'
  import { clusterDetailContextKey } from './context'
  import { Plus, Refresh, Search } from '@element-plus/icons-vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { computed, inject, onMounted, ref, watch } from 'vue'

  defineOptions({ name: 'ClusterDetailDatasources' })

  const ctxRef = inject(clusterDetailContextKey)!

  const loading = ref(false)
  const submitting = ref(false)
  const detailLoading = ref(false)
  const items = ref<DatasourceItem[]>([])
  const keyword = ref('')
  const typeFilter = ref<'all' | 'log' | 'alert'>('all')
  const sortBy = ref<'name-asc' | 'name-desc' | 'default-first' | 'updated-desc'>('name-asc')
  const currentPage = ref(1)
  const pageSize = ref(10)

  const createDialogVisible = ref(false)
  const detailVisible = ref(false)
  const detailItem = ref<DatasourceItem | null>(null)
  const createFormRef = ref<FormInstance>()
  const advancedPanels = ref<string[]>([])

  const subTypeOptions: Record<DatasourceType, { label: string; value: DatasourceSubType }[]> = {
    0: [
      { label: 'Loki', value: 'loki' },
      { label: 'Elasticsearch', value: 'es' }
    ],
    1: [{ label: 'Prometheus', value: 'prometheus' }]
  }

  const subTypeMeta: Record<DatasourceSubType, { label: string; icon: string }> = {
    loki: { label: 'Loki', icon: 'simple-icons:grafana' },
    es: { label: 'Elasticsearch', icon: 'simple-icons:elasticsearch' },
    prometheus: { label: 'Prometheus', icon: 'simple-icons:prometheus' }
  }

  const createForm = ref({
    name: '',
    type: 0 as DatasourceType,
    subType: 'loki' as DatasourceSubType,
    url: '',
    description: '',
    isDefault: false,
    log: {
      userName: '',
      password: ''
    },
    headers: [{ key: '', value: '' }]
  })

  const createRules: FormRules = {
    name: [{ required: true, message: '请输入数据源名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择类型', trigger: 'change' }],
    subType: [{ required: true, message: '请选择子类型', trigger: 'change' }],
    url: [{ required: true, message: '请输入接入地址', trigger: 'blur' }]
  }

  const currentSubTypeOptions = computed(() => subTypeOptions[createForm.value.type])
  const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())
  const filledHeaderCount = computed(
    () => createForm.value.headers.filter((item) => item.key.trim() || item.value.trim()).length
  )

  const filteredItems = computed(() => {
    const scoped = items.value.filter((item) => item.clusterName === ctxRef.value.name)

    const matched = scoped.filter((item) => {
      if (typeFilter.value === 'log' && item.type !== 0) return false
      if (typeFilter.value === 'alert' && item.type !== 1) return false
      if (!normalizedKeyword.value) return true

      const haystack =
        `${item.name} ${resolveDatasourceUrl(item)} ${item.description} ${item.subType}`.toLowerCase()
      return haystack.includes(normalizedKeyword.value)
    })

    return [...matched].sort((a, b) => {
      if (sortBy.value === 'name-desc') return b.name.localeCompare(a.name)
      if (sortBy.value === 'default-first') {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
        return a.name.localeCompare(b.name)
      }
      if (sortBy.value === 'updated-desc') {
        return (
          new Date(b.gmtModified || b.gmtCreate).getTime() -
          new Date(a.gmtModified || a.gmtCreate).getTime()
        )
      }
      return a.name.localeCompare(b.name)
    })
  })

  const pagedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return filteredItems.value.slice(start, start + pageSize.value)
  })

  function typeLabel(type: DatasourceType): string {
    return type === 0 ? '日志' : '告警'
  }

  function formatDateTime(value: string): string {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function buildCreatePayload(): CreateDatasourcePayload {
    const headers = createForm.value.headers
      .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
      .filter((item) => item.key || item.value)

    return {
      clusterName: ctxRef.value.name,
      name: createForm.value.name.trim(),
      type: createForm.value.type,
      subType: createForm.value.subType,
      url: createForm.value.url.trim(),
      isDefault: createForm.value.isDefault,
      description: createForm.value.description.trim(),
      config: {
        headers,
        log:
          createForm.value.type === 0
            ? {
                url: createForm.value.url.trim(),
                userName: createForm.value.log.userName.trim(),
                password: createForm.value.log.password.trim()
              }
            : undefined
      }
    }
  }

  async function loadDatasources(): Promise<void> {
    loading.value = true
    try {
      const { items: nextItems } = await fetchDatasourceList({ page: 1, limit: 200 })
      items.value = nextItems
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载数据源失败')
    } finally {
      loading.value = false
    }
  }

  function resetCreateForm(): void {
    createFormRef.value?.resetFields()
    advancedPanels.value = []
    createForm.value = {
      name: '',
      type: 0,
      subType: 'loki',
      url: '',
      description: '',
      isDefault: false,
      log: {
        userName: '',
        password: ''
      },
      headers: [{ key: '', value: '' }]
    }
  }

  function openCreateDialog(): void {
    advancedPanels.value = []
    createDialogVisible.value = true
  }

  function handleTypeChange(nextType: DatasourceType): void {
    createForm.value.subType = subTypeOptions[nextType][0]?.value ?? 'loki'
  }

  function addHeader(): void {
    if (!advancedPanels.value.includes('headers')) {
      advancedPanels.value = [...advancedPanels.value, 'headers']
    }
    createForm.value.headers.push({ key: '', value: '' })
  }

  function removeHeader(index: number): void {
    if (createForm.value.headers.length === 1) {
      createForm.value.headers[0] = { key: '', value: '' }
      return
    }
    createForm.value.headers.splice(index, 1)
  }

  async function submitCreate(): Promise<void> {
    const form = createFormRef.value
    if (!form) return
    const valid = await form.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      await fetchCreateDatasource(buildCreatePayload())
      ElMessage.success('数据源创建成功')
      createDialogVisible.value = false
      await loadDatasources()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '创建数据源失败')
    } finally {
      submitting.value = false
    }
  }

  async function openDetail(id: number): Promise<void> {
    detailVisible.value = true
    detailLoading.value = true
    detailItem.value = null

    try {
      detailItem.value = await fetchDatasourceDetail(id)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '获取详情失败')
      detailVisible.value = false
    } finally {
      detailLoading.value = false
    }
  }

  async function removeDatasource(item: DatasourceItem): Promise<void> {
    try {
      await fetchDeleteDatasource(item.id)
      ElMessage.success(`已删除数据源「${item.name}」`)
      await loadDatasources()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '删除数据源失败')
    }
  }

  watch([filteredItems, pageSize], () => {
    const maxPage = Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  })

  watch([keyword, typeFilter, sortBy], () => {
    currentPage.value = 1
  })

  watch(
    () => createForm.value.type,
    (nextType) => {
      if (nextType !== 0) {
        advancedPanels.value = advancedPanels.value.filter((panel) => panel !== 'auth')
      }
    }
  )

  onMounted(() => {
    void loadDatasources()
  })
</script>

<style scoped>
  .datasource-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .datasource-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .datasource-header__title {
    margin: 0;
    color: #1f2937;
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
  }

  .datasource-header__desc {
    margin: 8px 0 0;
    color: #6b7280;
    font-size: 14px;
  }

  .datasource-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 180px 140px 44px;
    gap: 12px;
    align-items: center;
  }

  .datasource-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .datasource-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 18px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #fff;
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .datasource-row:hover {
    border-color: #cbd5e1;
    box-shadow: 0 8px 24px rgb(15 23 42 / 6%);
  }

  .datasource-row--skeleton {
    justify-content: flex-start;
  }

  .datasource-row__skeleton-body {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .datasource-row__left {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
    flex: 1;
  }

  .datasource-row__logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .datasource-row__logo.is-loki {
    color: #f59e0b;
    background: #fff7ed;
  }

  .datasource-row__logo.is-prometheus {
    color: #f97316;
    background: #fff7ed;
  }

  .datasource-row__logo.is-es {
    color: #2563eb;
    background: #eff6ff;
  }

  .datasource-row__logo-icon {
    font-size: 22px;
  }

  .datasource-row__content {
    min-width: 0;
    flex: 1;
  }

  .datasource-row__topline {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .datasource-row__name {
    color: #1f2937;
    font-size: 18px;
    font-weight: 700;
  }

  .datasource-row__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin-top: 6px;
    color: #6b7280;
    font-size: 14px;
    flex-wrap: wrap;
  }

  .datasource-row__divider {
    color: #cbd5e1;
  }

  .datasource-row__url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .datasource-row__right {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .datasource-pagination {
    display: flex;
    justify-content: flex-end;
  }

  .datasource-create-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 12px;
    padding-top: 0;

    :deep(.el-form-item__label) {
      font-size: 12px;
    }

    :deep(.el-input__inner),
    :deep(.el-textarea__inner),
    :deep(.el-select__wrapper),
    :deep(.el-select__selected-item),
    :deep(.el-select__placeholder),
    :deep(.el-input__wrapper) {
      font-size: 12px;
    }

    :deep(.el-input__inner::placeholder),
    :deep(.el-textarea__inner::placeholder),
    :deep(.el-input__wrapper::placeholder),
    :deep(.el-textarea__wrapper::placeholder),
    :deep(.el-input__wrapper input::placeholder),
    :deep(.el-textarea__wrapper textarea::placeholder) {
      font-size: 12px !important;
      opacity: 1;
    }

    :deep(.el-select-dropdown__item) {
      font-size: 12px;
    }

    :deep(.el-button) {
      font-size: 12px;
    }

    :deep(.el-input__placeholder),
    :deep(.el-textarea__placeholder) {
      font-size: 12px;
    }
  }

  .datasource-form-section {
    padding: 12px 18px 8px;
    border: 1px solid #e6edf5;
    border-radius: 16px;
    background: linear-gradient(180deg, rgb(255 255 255 / 100%) 0%, rgb(248 251 255 / 100%) 100%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 90%);
  }

  .datasource-form-section--advanced {
    padding-bottom: 4px;
  }

  .datasource-form-section__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .datasource-form-section__head--inner {
    margin-bottom: 10px;
  }

  .datasource-form-section__title {
    margin-bottom: 8px;
    color: #0f172a;
    font-size: 14px;
    font-weight: 700;
  }

  .datasource-form-section__summary {
    color: #64748b;
    font-size: 12px;
  }

  .datasource-advanced-collapse {
    border-top: 0;
    border-bottom: 0;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item__header) {
    height: auto;
    min-height: 52px;
    padding: 0 2px;
    border-bottom-color: #edf2f7;
    background: transparent;
    line-height: 1.4;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item__wrap) {
    border-bottom: 0;
    background: transparent;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item:last-child .el-collapse-item__header) {
    border-bottom: 0;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item__content) {
    padding: 12px 2px 8px;
  }

  .datasource-advanced-collapse__title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 0;
  }

  .datasource-advanced-collapse__hint {
    color: #64748b;
    font-size: 12px;
    font-weight: 400;
  }

  .datasource-headers-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .datasource-headers__row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 12px;
    align-items: center;
  }

  .datasource-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .datasource-detail__loading {
    padding: 8px 2px;
  }

  .datasource-detail__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .datasource-detail__name {
    color: #0f172a;
    font-size: 20px;
    font-weight: 700;
  }

  .datasource-detail__sub {
    margin-top: 6px;
    color: #64748b;
  }

  .datasource-detail__section {
    margin-top: 18px;
  }

  .datasource-detail__section-title {
    margin-bottom: 10px;
    color: #0f172a;
    font-weight: 600;
  }

  @media (width <= 960px) {
    .datasource-toolbar {
      grid-template-columns: 1fr 1fr;
    }

    .datasource-header {
      flex-direction: column;
      align-items: stretch;
    }

    .datasource-row {
      flex-direction: column;
      align-items: stretch;
    }

    .datasource-row__right {
      justify-content: flex-end;
    }
  }

  @media (width <= 640px) {
    .datasource-toolbar {
      grid-template-columns: 1fr;
    }

    .datasource-headers__row {
      grid-template-columns: 1fr;
    }

    .datasource-form-section__head {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  .datasource-dialog {
    :deep(.el-dialog__header) {
      padding-top: 16px;
      padding-bottom: 8px;
      margin-bottom: 0;
    }

    :deep(.el-dialog__title) {
      font-size: 16px;
    }

    :deep(.el-dialog__body) {
      padding-top: 0;
      padding-bottom: 16px;
    }
  }
</style>
