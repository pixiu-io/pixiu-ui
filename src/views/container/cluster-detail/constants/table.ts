/** 集群内资源列表：空数据时仍展示分页 */
export const CLUSTER_TABLE_PAGINATION_OPTIONS = {
  align: 'right' as const,
  hideOnEmpty: false
}

/** 集群内资源列表：空数据提示文案（与自定义资源列表一致） */
export const CLUSTER_TABLE_EMPTY_MESSAGE =
  '选择的该命名空间的列表为空，可以切换到其他命名空间'
