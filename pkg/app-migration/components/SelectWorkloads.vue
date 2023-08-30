<template>
  <div>
    <div class="select-workload">
      <div class="select-workload__options mt-20">
        <LabeledSelect
          v-model="workloadProject"
          label-key="appMigration.createAppMigrationTaskPage.form.workloadConfig.project"
          :options="projectOptions"
          :required="true"
        />

        <LabeledSelect
          v-model="workloadNamespace"
          label-key="appMigration.createAppMigrationTaskPage.form.workloadConfig.namespace"
          :options="namespaceOptions"
          :required="true"
        />
      </div>
      <div class="mt-20">
        <h3>{{ t('appMigration.createAppMigrationTaskPage.form.workloadConfig.workload') }}</h3>
        <SortableTable
          ref="workloadsTableRef"
          :rows="workloads"
          :headers="headers"
          :row-actions="false"
          key-field="id"
          :schema="schema"
          :show-groups="false"
          :search="false"
          :loading="workloadLoading"
        />
      </div>
    </div>
  </div>
</template>
<script>
import { SCHEMA, WORKLOAD_TYPES, MANAGEMENT } from '@shell/config/types';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import SortableTable from '@shell/components/SortableTable';

import { COLUMN_BREAKPOINTS } from '@shell/components/SortableTable/index.vue';
import { shortenedImage } from '@shell/utils/string';
import { get } from '@shell/utils/object';
import Schema from 'async-validator';
import { mapGetters } from 'vuex';

const schema = {
  id:         'workload',
  type:       SCHEMA,
  attributes: {
    kind:       'Workload',
    namespaced: true
  },
  metadata: { name: 'workload' },
};

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
    name:     'type',
    labelKey: 'tableHeaders.type',
    value:    'kind',
    sort:     ['kind'],
    width:    100,
  },
  {
    name:       'pod_images',
    labelKey:   'tableHeaders.podImages',
    breakpoint: COLUMN_BREAKPOINTS.LAPTOP,
    value:      'imageNames',
    formatter:  'PodImages'
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
  },
];
const rawObjKey = Symbol('rawObj');
const keyToMethodMap = {
  imageNames(d) {
    let containers;
    const images = [];

    if (d.type === WORKLOAD_TYPES.CRON_JOB) {
      containers = get(d, 'spec.jobTemplate.spec.template.spec.containers');
    } else {
      containers = get(d, 'spec.template.spec.containers');
    }
    if (containers) {
      containers.forEach((container) => {
        if (!images.includes(container.image)) {
          images.push(container.image);
        }
      });
    }

    return images.map(shortenedImage);
  },
  stateDisplay(d) {
    return d.metadata.state.name;
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

      return Reflect.get(target, propKey, receiver);
    }
  });

  return p;
};

export default {
  name:       'SelectWorkloads',
  components: {
    LabeledInput,
    LabeledSelect,
    SortableTable,
  },
  props: {
    initValue: {
      type: Array,
      default() {
        return [];
      }
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
    sourceCluster: {
      type:     String,
      required: true
    },
    sourceNamespace: {
      type:    String,
      default: ''
    },
    sourceProject: {
      type:    String,
      default: ''
    },
  },
  async fetch() {
    await this.loadData(this.sourceCluster);
  },
  data() {
    const descriptor = {
      namespace: {
        type:     'string',
        required: true,
        message:  this.t('appMigration.createAppMigrationTaskPage.form.errors.required', { name: this.t('appMigration.createAppMigrationTaskPage.form.workloadConfig.namespace') })
      },
      workloads:
        [{
          type:     'array',
          required: true,
          range:    { min: 1 },
          message:  this.t('appMigration.createAppMigrationTaskPage.form.errors.required', { name: this.t('appMigration.createAppMigrationTaskPage.form.workloadConfig.workload') })
        },
        {
          validator(rule, value, callback, source, options) {
            const errors = [];

            value.forEach((w) => {
              const containerNames = w.spec.template.spec.containers.map(c => c.name);

              if ((new Set(containerNames)).length !== containerNames.length) {
                const duplicate = [...containerNames].sort().reduce((t, c, index, arr) => {
                  if (c === arr[index + 1]) {
                    t.push(c);
                  }

                  return t;
                }, []);

                const names = new Set(duplicate);

                names.forEach((n) => {
                  errors.push('appMigration.createAppMigrationTaskPage.form.errors.duplicateContainerName', { name: n, workload: w.metadata.name });
                });
              }
            });

            return errors;
          }
        }]
    };

    return {
      descriptor,
      workloads:         [],
      namespaces:        [],
      projects:          [],
      workloadNamespace: '',
      workloadProject:   '',
      schema,
      headers,
      workloadLoading:   false,
      dataLoading:       false,
      errors:            []
    };
  },
  computed: {
    ...mapGetters(['currentCluster']),
    projectOptions() {
      const projects = this.projects;

      return [
        {
          label: 'None',
          value: ''
        },
        ...projects.map(p => ({
          label: p.spec.displayName, value: p.id, raw: p
        }))];
    },
    namespaceOptions() {
      const p = this.workloadProject;

      if (p) {
        const pId = p.replace('/', ':');

        return this.namespaces.filter(n => n.metadata.annotations?.['field.cattle.io/projectId'] && n.metadata.annotations?.['field.cattle.io/projectId'] === pId)
          .map(n => ({
            label: n.metadata.name, value: n.id, raw: n
          }));
      }

      return this.namespaces.filter(n => !n.metadata.annotations?.['field.cattle.io/projectId']).map(n => ({
        label: n.metadata.name, value: n.id, raw: n
      }));
    },
  },
  watch: {
    workloadNamespace(namespace) {
      if (!namespace) {
        this.workloads = [];

        return;
      }
      this.loadWorkloads(this.sourceCluster, namespace);
    },
    sourceProject: {
      handler(p) {
        this.workloadProject = p;
      },
      immediate: true
    },
    sourceNamespace: {
      handler(n) {
        this.workloadNamespace = n;
      },
      immediate: true
    },
    workloadLoading(l) {
      if (!l) {
        const ids = this.initValue.map(w => w.id);
        const w = this.workloads.filter(w => ids.includes(w.id));

        this.$refs.workloadsTableRef.update(w, []);
      }
    },
    workloadProject() {
      this.workloadNamespace = '';
    }
  },
  methods: {
    async loadWorkloads(clusterId, namespace) {
      this.workloadLoading = true;
      try {
        const p = [
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/apps.deployments/${ namespace }` }),
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/apps.daemonsets/${ namespace }` }),
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/apps.statefulsets/${ namespace }` }),
        ];
        const [deployments, daemonsets, statefulsets] = await Promise.all(p);

        this.workloads = [...deployments.data, ...daemonsets.data, ...statefulsets.data].map(d => objProxy(d));
      } catch (err) {
        this.errors = [err];
      }
      this.workloadLoading = false;
    },
    async loadData(clusterId) {
      this.dataLoading = true;
      try {
        const p = [
          this.$store.dispatch('management/findAll', { type: MANAGEMENT.PROJECT, opt: { force: true, url: `/v1/management.cattle.io.projects/${ clusterId }` } }),
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/namespaces` })
        ];
        const [projects, namespaces] = await Promise.all(p);

        this.namespaces = namespaces.data;
        this.projects = projects;
      } catch (err) {
        this.errors = [err];
      }
      this.dataLoading = false;
    },
    getForm() {
      const workloads = this.$refs.workloadsTableRef.selectedRows.map(w => ({ ...w[rawObjKey] }));
      const namespace = this.workloadNamespace;
      const project = this.workloadProject;

      return {
        workloads, namespace, project
      };
    },
    async validate() {
      const validator = new Schema(this.descriptor);

      const result = await validator.validate(this.getForm(), { firstFields: true });

      return result;
    }
  }
};
</script>
<style scoped>

.select-workload__options {
  display: flex;
  gap: 1.75%;
}

</style>
