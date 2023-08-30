import { IPlugin } from '@shell/core/types';
import { STATE } from '@shell/config/table-headers';

export function init($plugin: IPlugin, store: any) {
  const EXPLORER_RESOURCE_NAME = 'cluster-app-migration-extension';
  const { virtualType, basicType, headers } = $plugin.DSL(store, 'explorer');

  virtualType({
    // showMenuFun(state, getters, rootState, rootGetters) {
    //   return rootGetters['features/get'](AUDIT_LOG_UI_EXTENSION);
    // },
    labelKey:         'appMigration.title',
    icon:             'globe',
    namespaced:       false,
    ifRancherCluster: true,
    name:             EXPLORER_RESOURCE_NAME,
    weight:           98,
    route:            { name: 'c-cluster-createAppMigrationTask', params: { product: 'explorer' } },
    exact:            true,
  });

  basicType([EXPLORER_RESOURCE_NAME]);

  headers('mgt.pandaria.io.migration', [
    STATE,
    {
      name:     'name',
      labelKey: 'tableHeaders.name',
      sort:     ['name'],
      value:    'metadata.name'
    },
    {
      name:     'targetCluster',
      labelKey: 'appMigration.tasks.tableHeaders.targetCluster',
      sort:     ['targetCluster'],
      value:    'spec.target.cluster'
    },
    {
      name:     'targetProject',
      labelKey: 'appMigration.tasks.tableHeaders.targetProject',
      sort:     ['targetProject'],
      value:    'spec.target.project'
    },
    {
      name:     'namespace',
      labelKey: 'appMigration.tasks.tableHeaders.namespace',
      sort:     ['namespace'],
      value:    'spec.target.namespace'
    },
    {
      name:     'resources',
      labelKey: 'appMigration.tasks.tableHeaders.resources',
      sort:     ['resources'],
      getValue(row) {
        return Object.values(row.spec.resources).reduce((t, c) => {
          t = t + c.length;

          return t;
        }, 0);
      },
    }
  ]);
}
