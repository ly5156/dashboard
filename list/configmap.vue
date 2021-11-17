<template>
  <Loading v-if="$fetchState.pending || loading" />
  <div v-else class="configmap-table">
    <ResourceTable
      :schema="configmapSchema"
      :rows="filteredRows"
      :headers="headers"
      :group-by="groupBy"
      :search-option="enableLoadResourceByNamespace === 'true'"
    >
      <template #header-search-option>
        <NamespaceSelect
          v-model="namespace"
          :projects="projects"
          :namespaces="namespaces"
        ></NamespaceSelect>
      </template>
    </ResourceTable>
  </div>
</template>
<script>
import ResourceTable from '@/components/ResourceTable';
import NamespaceSelect from '@/components/form/NamespaceSelect';
import Loading from '@/components/Loading';
import { MANAGEMENT, NAMESPACE, CONFIG_MAP } from '@/config/types';
import { SETTING } from '@/config/settings';

export default {
  async fetch() {
    const inStore = this.$store.getters['currentStore'](NAMESPACE);
    const enableLoadResourceByNamespace = await this.$store.dispatch('management/find', { type: MANAGEMENT.SETTING, id: SETTING.ENABLE_LOAD_RESOURCE_BY_NAMESPACE });

    this.enableLoadResourceByNamespace = enableLoadResourceByNamespace?.value;
    if (this.enableLoadResourceByNamespace === 'true') {
      this.namespaces = await this.$store.dispatch(`${ inStore }/findAll`, { type: NAMESPACE });
      this.namespace = this.namespaces[0]?.id ?? 'default';
      await this.loadConfigmaps();
    } else {
      await this.loadAllConfigmaps();
    }
    this.projects = await this.$store.dispatch('management/findAll', { type: MANAGEMENT.PROJECT, opt: { force: true } });
  },

  data() {
    const inStore = this.$store.getters['currentStore'](NAMESPACE);
    const namespaceSchema = this.$store.getters[`${ inStore }/schemaFor`](NAMESPACE);
    const configmapSchema = this.$store.getters[`${ inStore }/schemaFor`](CONFIG_MAP);

    return {
      namespaceSchema,
      configmapSchema,
      namespaces:      [],
      configmaps:      [],
      projects:        [],
      namespace:       'defalult',
      loading:          false,

      enableLoadResourceByNamespace: null,
    };
  },
  computed: {
    headers() {
      return this.$store.getters['type-map/headersFor'](this.configmapSchema);
    },
    groupBy() {
      return this.$store.getters['type-map/groupByFor'](this.configmapSchema);
    },
    filteredRows() {
      if (this.enableLoadResourceByNamespace === 'true') {
        return this.configmaps.filter(m => m.metadata.namespace === this.namespace);
      }

      return this.configmaps;
    }
  },
  methods: {
    async loadConfigmaps() {
      const inStore = this.$store.getters['currentStore'](NAMESPACE);

      this.loading = true;
      try {
        this.configmaps = await this.$store.dispatch(`${ inStore }/findAll`, { type: CONFIG_MAP, opt: { url: `/v1/configmaps/${ this.namespace }`, force: true } });
      } catch (e) {
      }
      this.loading = false;
    },
    async loadAllConfigmaps() {
      const inStore = this.$store.getters['currentStore'](NAMESPACE);

      this.configmaps = await this.$store.dispatch(`${ inStore }/findAll`, { type: CONFIG_MAP });
    }
  },
  watch: {
    namespace() {
      this.loadConfigmaps();
    }
  },
  components: {
    Loading,
    ResourceTable,
    NamespaceSelect,
  },
};

</script>
<style scope>

</style>
