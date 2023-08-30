<template>
  <div>
    <div class="select-service mt-20">
      <SortableTable
        ref="serviceTableRef"
        :rows="matchingServices"
        :headers="headers"
        key-field="id"
        :schema="serviceSchema"
        :show-groups="false"
        :search="false"
        :row-actions="false"
        :loading="loading"
      />
    </div>
  </div>
</template>
<script>
import { SERVICE, POD } from '@shell/config/types';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import SortableTable from '@shell/components/SortableTable';
import { matches } from '@shell/utils/selector';
import { proxyUrlFromBase } from '@shell/models/service.js';

const headers = [
  {
    name:          'state',
    labelKey:      'tableHeaders.state',
    sort:          ['stateSort', 'nameSort'],
    value:         'stateDisplay',
    width:         100,
    default:       'unknown',
    formatter:     'BadgeStateFormatter',
    formatterOpts: { arbitrary: true },
  },
  {
    name:          'name',
    labelKey:      'tableHeaders.name',
    value:         'metadata.name',
    sort:          ['nameSort'],
    canBeVariable: true,
  },
  {
    name:        'namespace',
    labelKey:    'tableHeaders.namespace',
    value:       'metadata.namespace',
    sort:        'namespace',
    dashIfEmpty: true,
  },
  {
    formatter: 'ServiceTargets',
    labelKey:  'tableHeaders.targetPort',
    name:      'targetPort',
    sort:      `$['spec']['targetPort']`,
    value:     `$['spec']['targetPort']`,
  },
  {
    formatter: 'KeyValue',
    name:      'selector',
    labelKey:  'tableHeaders.selector',
    value:     `$['spec']['selector']`,
    sort:      `$['spec']['selector']`,
  },
  {
    name:      'type',
    labelKey:  'tableHeaders.type',
    value:     `$['spec']['type']`,
    sort:      `$['spec']['type']`,
    formatter: 'ServiceType',
  },
  {
    name:     'clusterIPs',
    label:    'Cluster IP',
    value:    'spec.clusterIPs',
    getValue: (row) => {
      if (row.spec?.clusterIPs && row.spec?.clusterIPs?.length > 0) {
        return row.spec?.clusterIPs?.join(',');
      }

      return row.spec?.clusterIP ?? '-';
    }
  },
  {
    name:      'age',
    labelKey:  'tableHeaders.age',
    value:     'metadata.creationTimestamp',
    sort:      'creationTimestamp:desc',
    search:    false,
    formatter: 'LiveDate',
    width:     100,
    align:     'left'
  }
];
const rawObjKey = Symbol('rawObj');
const keyToMethodMap = {
  stateDisplay(d) {
    return d.metadata.state.name;
  },
  linkFor(d) {
    return function(linkName) {
      return (d.links || {})[linkName];
    };
  },
  proxyUrl(d) {
    return function(scheme, port) {
      const view = (d.links || {})['view'];
      const idx = view.lastIndexOf(`/`);

      return proxyUrlFromBase(view.slice(0, idx), scheme, d.metadata.name, port);
    };
  }
};
const methodsKeys = Object.keys(keyToMethodMap);
const objProxy = (obj) => {
  const p = new Proxy(obj, {
    get(target, propKey, receiver) {
      if (propKey === rawObjKey) {
        return target;
      }
      if (methodsKeys.includes(propKey)) {
        return keyToMethodMap[propKey](target);
      }
      if (typeof target[propKey] === 'function') {
        return target[propKey].bind(target);
      }

      return Reflect.get(target, propKey, receiver);
    }
  });

  return p;
};

export default {
  name:       'SelectServices',
  components: {
    LabeledInput,
    LabeledSelect,
    SortableTable
  },
  props: {
    initValue: {
      type: Array,
      default() {
        return [];
      }
    },
    sourceCluster: {
      type:     String,
      required: true
    },
    sourceProject: {
      type:    String,
      default: ''
    },
    sourceNamespace: {
      type:     String,
      required: true
    },
    targetCluster: {
      type:     String,
      required: true
    },
    targetProject: {
      type:    String,
      default: ''
    },
    targetNamespace: {
      type:     String,
      required: true
    },
    workloads: {
      type:     Array,
      required: true
    }
  },
  data() {
    return {
      services: [], pods: [], errors: [], headers, loading: true
    };
  },
  computed: {
    depProps() {
      const workloadIds = this.workloads.map(w => w.id);

      return `${ this.sourceCluster }-${ this.sourceProject }-${ this.sourceNamespace }-${ workloadIds.join('-') }`;
    },
    matchingPods() {
      const pods = this.pods;

      return this.workloads.reduce((t, w) => {
        const podRelationship = w.metadata?.relationships?.filter(relationship => relationship.toType === POD)?.[0];

        if (podRelationship) {
          const mPods = pods.filter(p => matches(p, podRelationship.selector));

          t.push(...mPods);
        }

        return t;
      }, []);
    },
    matchingServices() {
      const matchingPods = this.matchingPods;
      const namespace = this.sourceNamespace;

      // const workloadUids = this.workloads.map((w) => w.metadata.uid)
      return this.services.filter((service) => {
        // const ownerReferences = service.metadata.ownerReferences;
        // if (ownerReferences && service.metadata.ownerReferences.some((r) => workloadUids.includes(r.uid))) {
        //   return false;
        // }
        const selector = service.spec.selector;

        for (let i = 0; i < matchingPods.length; i++) {
          const pod = matchingPods[i];

          if (service.metadata?.namespace === namespace && matches(pod, selector)) {
            return true;
          }
        }

        return false;
      }).map(s => objProxy(s));
    },
    serviceSchema() {
      return this.$store.getters['cluster/schemaFor'](SERVICE);
    },
    // serviceHeaders() {
    //   return this.$store.getters['type-map/headersFor'](this.serviceSchema);
    // }

  },
  watch: {
    depProps: {
      handler() {
        this.loadData(this.sourceCluster, this.sourceNamespace);
      },
      immediate: true
    },
    loading(l) {
      if (!l) {
        const ids = this.initValue.map(s => s.id);
        const s = this.matchingServices.filter(s => ids.includes(s.id));

        this.$refs.serviceTableRef.update(s, []);
      }
    }
  },
  methods: {
    async loadData(clusterId, namespace) {
      this.loading = true;
      try {
        const p = [
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/pods/${ namespace }` }),
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/services/${ namespace }` })
        ];

        const [pods, services] = await Promise.all(p);

        this.pods = pods.data;
        this.services = services.data;
      } catch (err) {
        this.errors = [err];
      }
      this.loading = false;
    },
    getForm() {
      const services = this.$refs.serviceTableRef.selectedRows.map(s => ({ ...s[rawObjKey] }));

      return { services };
    },
    validate() {
      return Promise.resolve();
    }
  }
};
</script>
  <style scoped>

  </style>
