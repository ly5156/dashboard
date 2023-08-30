<template>
  <div>
    <div class="select-pvcs mt-20">
      <SortableTable
        ref="pvcTableRef"
        :rows="matchingPvcs"
        :headers="pvcHeaders"
        key-field="id"
        :schema="pvcSchema"
        :show-groups="false"
        :search="false"
        :row-actions="false"
        :loading="loading"
      />
    </div>
  </div>
</template>
<script>
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { PVC } from '@shell/config/types';
import SortableTable from '@shell/components/SortableTable';
import { insertAt, removeObject } from '@shell/utils/array';

const FIELD_REGEX = /^\$\.metadata\.fields\[([0-9]*)\]/;
const STATE = {
  name:          'state',
  labelKey:      'tableHeaders.state',
  sort:          ['stateSort', 'nameSort'],
  value:         'stateDisplay',
  width:         100,
  default:       'unknown',
  formatter:     'BadgeStateFormatter',
  formatterOpts: { arbitrary: true },
};
const NAME = {
  name:          'name',
  labelKey:      'tableHeaders.name',
  value:         'metadata.name',
  sort:          ['nameSort'],
  canBeVariable: true,
};
const NAMESPACE = {
  name:        'namespace',
  labelKey:    'tableHeaders.namespace',
  value:       'metadata.namespace',
  sort:        'namespace',
  dashIfEmpty: true,
};
const AGE = {
  name:      'age',
  labelKey:  'tableHeaders.age',
  value:     'metadata.creationTimestamp',
  sort:      'creationTimestamp:desc',
  search:    false,
  formatter: 'LiveDate',
  width:     100,
  align:     'left'
};
const rowValueGetter = (col) => {
  // 'field' comes from the schema - typically it is of the form $.metadata.field[N]
  // We will use JsonPath to look up this value, which is costly - so if we can detect this format
  // Use a more efficient function to get the value
  const value = col.field.startsWith('.') ? `$${ col.field }` : col.field;

  if (process.client) {
    const found = value.match(FIELD_REGEX);

    if (found && found.length === 2) {
      const fieldIndex = parseInt(found[1], 10);

      return row => row.metadata?.fields?.[fieldIndex];
    }
  }

  return value;
};

const fromSchema = (col, rootGetters) => {
  let formatter, width, formatterOpts;

  if ( (col.format === '' || col.format === 'date') && col.name === 'Age' ) {
    return AGE;
  }

  if ( col.format === 'date' || col.type === 'date' ) {
    formatter = 'Date';
    width = 120;
    formatterOpts = { multiline: true };
  }

  if ( col.type === 'number' || col.type === 'int' ) {
    formatter = 'Number';
  }

  const colName = col.name.includes(' ') ? col.name.split(' ').map(word => word.charAt(0).toUpperCase() + word.substring(1) ).join('') : col.name;

  const exists = rootGetters['i18n/exists'];
  const t = rootGetters['i18n/t'];
  const labelKey = `tableHeaders.${ colName.charAt(0).toLowerCase() + colName.slice(1) }`;
  const description = col.description || '';
  const tooltip = description && description[description.length - 1] === '.' ? description.slice(0, -1) : description;

  return {
    name:  col.name.toLowerCase(),
    label: exists(labelKey) ? t(labelKey) : col.name,
    value: rowValueGetter(col),
    sort:  [col.field],
    formatter,
    formatterOpts,
    width,
    tooltip
  };
};
const rawObjKey = Symbol('rawObj');
const keyToMethodMap = {
  stateDisplay(d) {
    return d.metadata.state.name;
  },
};

const methodsKeys = Object.keys(keyToMethodMap);
const objProxy = (obj, that) => {
  const p = new Proxy(obj, {
    get(target, propKey, receiver) {
      if (propKey === rawObjKey) {
        return target;
      }

      if (methodsKeys.includes(propKey)) {
        return keyToMethodMap[propKey](target, that);
      }

      return Reflect.get(target, propKey, receiver);
    }
  });

  return p;
};

export default {
  name:       'SelectStorages',
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
      pvcs: [], errors: [], schema: null, loading: true
    };
  },
  computed: {
    depProps() {
      const workloadIds = this.workloads.map(w => w.id);

      return `${ this.sourceCluster }-${ this.sourceProject }-${ this.sourceNamespace }-${ workloadIds.join('-') }`;
    },
    pvcSchema() {
      return this.$store.getters['cluster/schemaFor'](PVC);
    },
    pvcHeaders() {
      return this.headerForSchema(this.schema);
    },
    matchingPvcs() {
      const pvcs = this.pvcs;
      const pvcNames = [...new Set(this.workloads.reduce((t, c) => {
        const pvcNames = c.spec.template.spec.volumes?.filter(v => v.persistentVolumeClaim)?.map(v => v.persistentVolumeClaim.claimName) ?? [];

        t.push(...pvcNames);

        return t;
      }, []))];

      return pvcs.filter(pvc => pvcNames.includes(pvc.metadata.name));
    }
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
        const ids = this.initValue.map(pvc => pvc.id);
        const pvcs = this.matchingPvcs.filter(pvc => ids.includes(pvc.id));

        this.$refs.pvcTableRef.update(pvcs, []);
      }
    }
  },
  methods: {
    headerForSchema(schema) {
      if (!schema) {
        return [];
      }
      const attributes = schema.attributes || {};
      const columns = attributes.columns || [];

      const out = [STATE];
      const namespaced = attributes.namespaced || false;
      let hasName = false;

      for ( const col of columns ) {
        if ( col.format === 'name' ) {
          hasName = true;
          out.push(NAME);
          if ( namespaced ) {
            out.push(NAMESPACE);
          }
        } else {
          out.push(fromSchema(col, this.$store.getters));
        }
      }
      if ( !hasName ) {
        insertAt(out, 1, NAME);
        if ( namespaced ) {
          insertAt(out, 2, NAMESPACE);
        }
      }
      // Age always goes last
      if ( out.includes(AGE) ) {
        removeObject(out, AGE);
        out.push(AGE);
      }

      return out;
    },
    async loadData(clusterId, namespace) {
      this.loading = true;
      try {
        const p = [
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/persistentvolumeclaims/${ namespace }` }),
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/schemas/persistentvolumeclaim` })
        ];
        const [pvcs, schema] = await Promise.all(p);

        this.pvcs = pvcs.data.map(pvc => objProxy(pvc));
        this.schema = schema;
      } catch (err) {
        this.errors = [err];
      }
      this.loading = false;
    },

    async storageClassesExist(clusterId, storageClassNames) {
      const results = await Promise.allSettled(storageClassNames.map(scName => this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/storage.k8s.io.storageclasses/${ scName }` })));

      return results.map((r, index) => ({
        name: storageClassNames[index], exist: r.status === 'fulfilled', value: r.value, reason: r.reason, status: r.status
      }));
    },
    async PVsExist(clusterId, pvNames) {
      const results = await Promise.allSettled(pvNames.map(pvName => this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/persistentvolumes/${ pvName }` })));

      return results.map((r, index) => ({
        name: pvNames[index], exist: r.status === 'fulfilled', value: r.value, reason: r.reason, status: r.status
      }));
    },

    getForm() {
      const pvcs = this.$refs.pvcTableRef.selectedRows.map(pvc => ({ ...pvc[rawObjKey] }));

      return { pvcs };
    },
    async validate() {
      const errors = [];
      const { pvcs } = this.getForm();

      const scNames = pvcs.filter(pvc => pvc.spec.storageClassName).reduce((t, c) => {
        t.add(c.spec.storageClassName);

        return t;
      }, new Set());

      const pvNames = pvcs.filter(pvc => pvc.spec.volumeName).reduce((t, c) => {
        t.add(c.spec.volumeName);

        return t;
      }, new Set());

      const targetCluster = this.targetCluster;

      const [sc, pv] = await Promise.all([this.storageClassesExist(targetCluster, [...scNames]), this.PVsExist(targetCluster, [...pvNames])]);

      errors.push(...sc.filter(item => !item.exist).map(() => this.t('appMigration.createAppMigrationTaskPage.form.errors.storageClassNotExist', { pvcName: pvcs.filter(pvc => pvc.spec.storageClassName === item.name).join(', ') })));
      errors.push(...pv.filter(item => !item.exist).map(() => this.t('appMigration.createAppMigrationTaskPage.form.errors.pvNotExist', { pvcName: pvcs.filter(pvc => pvc.spec.volumeName === item.name).join(', ') })));

      if (errors.length > 0) {
        throw { errors };
      }

      return errors;
    }
  }
};
</script>
  <style scoped>

  </style>
