<template>
  <div>
    <div class="select-target mt-20">
      <LabeledInput
        v-model="form.name"
        label-key="appMigration.createAppMigrationTaskPage.form.task"
        :required="true"
      />

      <LabeledSelect
        v-model="form.cluster"
        label-key="appMigration.createAppMigrationTaskPage.form.targetConfig.cluster"
        :options="clusterOptions"
        :required="true"
      />

      <LabeledSelect
        v-model="form.project"
        label-key="appMigration.createAppMigrationTaskPage.form.targetConfig.project"
        :options="projectOptions"
      />
      <LabeledSelect
        v-model="form.namespace"
        label-key="appMigration.createAppMigrationTaskPage.form.targetConfig.namespace"
        :options="namespaceOptions"
        :required="true"
      />
    </div>
  </div>
</template>
<script>
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { MANAGEMENT } from '@shell/config/types';
import { mapGetters } from 'vuex';
import Schema from 'async-validator';

export default {
  name:       'SelectTarget',
  components: {
    LabeledInput,
    LabeledSelect
  },
  props: {
    initValue: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  async fetch() {
    await this.loadClusters();
  },
  data() {
    const descriptor = {
      name: {
        type:     'string',
        required: true,
        message:  () => this.t('appMigration.createAppMigrationTaskPage.form.errors.required', { name: this.t('generic.name') })
      },
      cluster: [{
        type:     'string',
        required: true,
        message:  () => this.t('appMigration.createAppMigrationTaskPage.form.errors.required', { name: this.t('appMigration.createAppMigrationTaskPage.form.targetConfig.cluster') })
      }, {
        validator: (rule, value, callback, source, options) => {
          const errors = [];
          const t = this.clusterOptions.find(c => c.value === value);

          if (!t) {
            errors.push(new Error(this.t('appMigration.createAppMigrationTaskPage.form.errors.nonExistent', { name: this.t('appMigration.createAppMigrationTaskPage.form.targetConfig.cluster') })));
          }

          return errors;
        }
      }],
      namespace: [{
        type:     'string',
        required: true,
        message:  () => this.t('appMigration.createAppMigrationTaskPage.form.errors.required', { name: this.t('appMigration.createAppMigrationTaskPage.form.targetConfig.namespace') })
      }, {
        validator: (rule, value, callback, source, options) => {
          const errors = [];
          const t = this.namespaceOptions.find(n => n.value === value);

          if (!t) {
            errors.push(new Error(this.t('appMigration.createAppMigrationTaskPage.form.errors.nonExistent', { name: this.t('appMigration.createAppMigrationTaskPage.form.targetConfig.namespace') })));
          }

          return errors;
        }
      }],
      project: {
        validator: (rule, value, callback, source, options) => {
          const errors = [];

          if (value) {
            const t = this.projectOptions.find(p => p.value === value);

            if (!t) {
              errors.push(new Error(this.t('appMigration.createAppMigrationTaskPage.form.errors.nonExistent', { name: this.t('appMigration.createAppMigrationTaskPage.form.targetConfig.cluster') })));
            }
          }

          return errors;
        }
      }
    };
    const {
      name = '', cluster = '', project = '', namespace = ''
    } = this.initValue;

    if (cluster) {
      this.loadProjects(cluster);
      this.loadNamespaces(cluster);
    }

    return {
      clusters:         [],
      projects:         [],
      namespaces:       [],
      projectLoading:   true,
      clusterLoading:   true,
      namespaceLoading: true,
      form:             {
        name,
        cluster,
        project,
        namespace,
      },
      descriptor
    };
  },
  computed: {
    ...mapGetters(['currentCluster']),
    clusterOptions() {
      return this.clusters.filter(c => c.id !== this.currentCluster?.id).map(c => ({
        label: c.spec.displayName, value: c.id, raw: c
      }));
    },
    projectOptions() {
      return [
        {
          label: 'None',
          value: ''
        },
        ...this.projects.map(p => ({
          label: p.spec.displayName, value: p.id, raw: p
        }))];
    },
    namespaceOptions() {
      const p = this.form.project;

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
    loading() {
      return this.clusterLoading || this.projectLoading || this.namespaceLoading;
    }
  },
  methods: {
    getForm() {
      return { ...this.form };
    },
    async loadProjects(clusterId) {
      this.projectLoading = true;
      try {
        const p = await this.$store.dispatch('management/findAll', { type: MANAGEMENT.PROJECT, opt: { force: true, url: `/v1/management.cattle.io.projects/${ clusterId }` } });

        this.projects = p;
      } catch (err) {

      }
      this.projectLoading = false;
    },
    async loadClusters() {
      this.clusterLoading = true;
      try {
        const c = await this.$store.dispatch('management/findAll', { type: MANAGEMENT.CLUSTER });

        this.clusters = c;
      } catch (err) {

      }
      this.clusterLoading = false;
    },
    async loadNamespaces(clusterId) {
      this.namespaceLoading = true;
      try {
        const n = await this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/namespaces` });

        this.namespaces = n.data;
      } catch (err) {

      }
      this.namespaceLoading = false;
    },
    async validate() {
      const validator = new Schema(this.descriptor);

      const result = await validator.validate(this.getForm(), { firstFields: true });

      return result;
    }
  },
  watch: {
    'form.cluster'(c) {
      this.form.project = '';
      this.form.namespace = '';
      if (c) {
        this.loadProjects(c);
        this.loadNamespaces(c);
      }
    },
    'form.project'() {
      this.form.namespace = '';
    },
    // initValue: {
    //   handler(v) {
    //     console.log(v)
    //     Object.entries(v).forEach(([k, v]) => {
    //       this.form[k] = v;
    //     });
    //   },
    //   immediate: true
    // }
  }
};
</script>
<style scoped>
.select-target {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 1.75%;
}
</style>
