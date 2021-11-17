<template>
  <div>
    <Select
      ref="select"
      v-model="selected"
      :append-to-body="false"
      :selectable="(option) => !option.disabled && option.id"
      :options="filteredRows"
      option-key="id"
    >
      <template #option="opt">
        <template v-if="opt.disabled">
          <b v-html="opt.label"></b>
        </template>
        <template v-else>
          {{ opt.label }}
        </template>
      </template>
    </Select>
  </div>
</template>
<script>
import { NAME as HARVESTER } from '@/config/product/harvester';
import Select from '@/components/form/Select';
import { DEV } from '@/store/prefs';
import groupBy from 'lodash/groupBy';

export default {
  name:  'NamespaceSelect',
  props: {
    projects: {
      type: Array,
      default() {
        return [];
      }
    },
    namespaces: {
      type:     Array,
      required: true
    },
    value: {
      type:    String,
      default: 'default'
    }
  },

  computed: {
    selected: {
      get() {
        return this.filteredRows.filter(item => item.id === this.value);
      },
      set(v) {
        this.$emit('input', v.id);
      },
    },
    rows() {
      if (this.$store.getters['prefs/get'](DEV)) {
        return this.namespaces;
      }

      const isVirtualCluster = this.$store.getters['isVirtualCluster'];
      const isVirutalProduct = this.$store.getters['currentProduct'].name === HARVESTER;

      return this.namespaces.filter((namespace) => {
        return isVirtualCluster && isVirutalProduct ? (!namespace.isSystem && !namespace.isObscure) : !namespace.isObscure;
      });
    },
    filteredRows() {
      const namespacesWithoutProjects = this.rows.filter(n => !n.project);
      const namespacesWithProject = this.rows.filter(n => n.project);
      const data = groupBy(namespacesWithProject, n => n.project?.nameDisplay);
      const groupKeys = Object.keys(data);

      groupKeys.sort();

      const out = groupKeys.reduce((t, c) => {
        const g = {
          disabled: true,
          label:    data[c][0]?.groupByLabel,
          kind:     'group'
        };

        t.push(g);
        t.push(...data[c].map(n => ({
          id:    n.id,
          label: n.metadata.name,
          kind:  'namespace',
        })));

        return t;
      }, []);

      if (namespacesWithoutProjects.length > 0) {
        out.push(
          {
            disabled: true,
            label:    this.t('resourceTable.groupLabel.notInAProject'),
            kind:     'group',
          },
          ...namespacesWithoutProjects.map(n => ({
            id:    n.id,
            label: n.metadata.name,
            kind:  'namespace',
          }))
        );
      }

      return out;
    }
  },

  methods: {
    projectLabel(group) {
      const row = group.rows[0];

      if (row.isFake) {
        return this.t('resourceTable.groupLabel.project', { name: row.project?.nameDisplay }, true);
      }

      return row.groupByLabel;
    },
  },

  components: { Select }
};
</script>
<style scoped>
</style>
