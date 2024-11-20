import { IPlugin } from '@shell/core/types';

export function init($plugin: IPlugin, store: any) {
  const PRODUCT_NAME = 'HAMi';

  const { product, virtualType, basicType } = $plugin.DSL(store, PRODUCT_NAME);

  product({
    icon:                'globe',
    inStore:             'cluster',
    inExplorer:          true,
    removeable:          false,
    showNamespaceFilter: true,
  });

  virtualType({
    labelKey:   'hami.label',
    namespaced: false,
    group:      'Root',
    name:       PRODUCT_NAME,
    route:      {
      name:   `c-cluster-${ PRODUCT_NAME }`,
      params: { product: PRODUCT_NAME },
      meta:   { product: PRODUCT_NAME }
    },
    exact:    true,
    overview: true,
  });

  basicType([PRODUCT_NAME]);
}
