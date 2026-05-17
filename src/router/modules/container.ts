import { AppRouteRecord } from '@/types/router'

/** 集群详情各子页（与 dashboard 一致：/container/<页面>?cluster=<name>） */
const CLUSTER_DETAIL_LAYOUT = '/container/cluster-detail/layout'

const clusterDetailChildren: AppRouteRecord[] = [
  { path: 'overview', name: 'ClusterDetailOverview', component: '/container/cluster-detail/overview' },
  { path: 'nodes', name: 'ClusterDetailNodes', component: '/container/cluster-detail/nodes' },
  { path: 'namespaces', name: 'ClusterDetailNamespaces', component: '/container/cluster-detail/namespaces' },
  { path: 'workloads', name: 'ClusterDetailWorkloads', component: '/container/cluster-detail/workloads' },
  { path: 'pods', name: 'ClusterDetailPods', component: '/container/cluster-detail/pods' },
  { path: 'services', name: 'ClusterDetailServices', component: '/container/cluster-detail/services' },
  { path: 'config', name: 'ClusterDetailConfig', component: '/container/cluster-detail/config' },
  { path: 'storage', name: 'ClusterDetailStorage', component: '/container/cluster-detail/storage' },
  { path: 'autoscaling', name: 'ClusterDetailAutoscaling', component: '/container/cluster-detail/autoscaling' },
  { path: 'auth', name: 'ClusterDetailAuth', component: '/container/cluster-detail/auth' },
  {
    path: 'addon-components',
    name: 'ClusterDetailAddonComponents',
    component: '/container/cluster-detail/addon-components'
  },
  { path: 'crds', name: 'ClusterDetailCrds', component: '/container/cluster-detail/crds' },
  { path: 'apiservices', name: 'ClusterDetailApiservices', component: '/container/cluster-detail/apiservices' },
  { path: 'alert', name: 'ClusterDetailAlert', component: '/container/cluster-detail/alert' },
  { path: 'logs', name: 'ClusterDetailLogs', component: '/container/cluster-detail/logs' },
  { path: 'events', name: 'ClusterDetailEvents', component: '/container/cluster-detail/events' },
  { path: 'prometheus', name: 'ClusterDetailPrometheus', component: '/container/cluster-detail/prometheus' }
].map((c) => ({
  path: c.path,
  component: CLUSTER_DETAIL_LAYOUT,
  meta: {
    title: 'menus.container.clusterDetail',
    isHide: true,
    keepAlive: false,
    tabGroup: 'clusterDetail'
  },
  children: [
    {
      path: '',
      name: c.name,
      component: c.component,
      meta: { title: 'menus.container.clusterDetail', tabGroup: 'clusterDetail' }
    }
  ]
}))

export const containerRoutes: AppRouteRecord = {
  path: '/container',
  name: 'Container',
  component: '/index/index',
  meta: {
    title: 'menus.container.title',
    icon: 'ri:cloud-line'
  },
  children: [
    {
      path: 'cluster',
      name: 'Cluster',
      component: '/container/cluster',
      meta: {
        title: 'menus.container.cluster',
        icon: 'ri:cloudy-2-line',
        keepAlive: true
      }
    },
    {
      path: 'plan',
      name: 'Plan',
      component: '/container/plan/index',
      meta: {
        title: 'menus.container.plan',
        icon: 'ri:rocket-line',
        keepAlive: true
      }
    },
    {
      path: 'deployment-detail',
      name: 'DeploymentDetail',
      component: '/container/cluster-detail/deployment-detail/index',
      meta: {
        title: '工作负载详情',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'secret-create',
      name: 'SecretCreate',
      component: '/container/cluster-detail/secret-create/index',
      meta: {
        title: '创建 Secret',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'configmap-create',
      name: 'ConfigMapCreate',
      component: '/container/cluster-detail/configmap-create/index',
      meta: {
        title: '创建 ConfigMap',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'service-create',
      name: 'ServiceCreate',
      component: '/container/cluster-detail/service-create/index',
      meta: {
        title: '创建 Service',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'ingress-create',
      name: 'IngressCreate',
      component: '/container/cluster-detail/ingress-create/index',
      meta: {
        title: '创建 Ingress',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'storageclass-create',
      name: 'StorageClassCreate',
      component: '/container/cluster-detail/storageclass-create/index',
      meta: {
        title: '创建 StorageClass',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'pv-create',
      name: 'PVCreate',
      component: '/container/cluster-detail/pv-create/index',
      meta: {
        title: '创建 PersistentVolume',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'pvc-create',
      name: 'PVCCreate',
      component: '/container/cluster-detail/pvc-create/index',
      meta: {
        title: '创建 PersistentVolumeClaim',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'workload-update',
      name: 'WorkloadUpdate',
      component: '/container/cluster-detail/workload-update/index',
      meta: {
        title: '更新Pod设置',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'job-create',
      name: 'JobCreate',
      component: '/container/cluster-detail/job-create/index',
      meta: {
        title: '创建 Job',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'cronjob-create',
      name: 'CronJobCreate',
      component: '/container/cluster-detail/cronjob-create/index',
      meta: {
        title: '创建 CronJob',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'statefulset-create',
      name: 'StatefulSetCreate',
      component: '/container/cluster-detail/statefulset-create/index',
      meta: {
        title: '创建 StatefulSet',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'daemonset-create',
      name: 'DaemonSetCreate',
      component: '/container/cluster-detail/daemonset-create/index',
      meta: {
        title: '创建 DaemonSet',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'deployment-create',
      name: 'DeploymentCreate',
      component: '/container/cluster-detail/deployment-create/index',
      meta: {
        title: '创建 Deployment',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'node-detail',
      name: 'NodeDetail',
      component: '/container/cluster-detail/node-detail/index',
      meta: {
        title: '节点详情',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'pod-detail',
      name: 'PodDetail',
      component: '/container/cluster-detail/pod-detail/index',
      meta: {
        title: 'Pod 详情',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'statefulset-detail',
      name: 'StatefulSetDetail',
      component: '/container/cluster-detail/deployment-detail/index',
      meta: {
        title: '工作负载详情',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'daemonset-detail',
      name: 'DaemonSetDetail',
      component: '/container/cluster-detail/deployment-detail/index',
      meta: {
        title: '工作负载详情',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'job-detail',
      name: 'JobDetail',
      component: '/container/cluster-detail/deployment-detail/index',
      meta: {
        title: '工作负载详情',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'cronjob-detail',
      name: 'CronJobDetail',
      component: '/container/cluster-detail/deployment-detail/index',
      meta: {
        title: '工作负载详情',
        isHide: true,
        keepAlive: false
      }
    },
    {
      path: 'cluster/deploy',
      name: 'ClusterDeploy',
      component: '/container/cluster/deploy/index',
      meta: {
        title: '新建部署集群',
        isHide: true,
        keepAlive: false
      }
    },
    ...clusterDetailChildren
  ]
}
