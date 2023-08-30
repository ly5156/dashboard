<template>
  <div>
    <div class="select-related-resources mt-20">
      <div>
        <h3>{{ t('appMigration.createAppMigrationTaskPage.form.relatedResourcesConfig.secret') }}</h3>
        <SortableTable
          ref="secretTableRef"
          :rows="matchingSecrets"
          :headers="secretHeaders"
          key-field="id"
          :schema="secretSchema"
          :show-groups="false"
          :search="false"
          :row-actions="false"
          :loading="loading"
        />
      </div>
      <div class="spacer" />
      <div>
        <h3>{{ t('appMigration.createAppMigrationTaskPage.form.relatedResourcesConfig.configMap') }}</h3>
        <SortableTable
          ref="configMapTableRef"
          :rows="matchingConfigMaps"
          :headers="configMapHeaders"
          key-field="id"
          :schema="configMapSchema"
          :show-groups="false"
          :search="false"
          :row-actions="false"
          :loading="loading"
        />
      </div>
    </div>
  </div>
</template>
<script>
import r from 'jsrsasign';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import SortableTable from '@shell/components/SortableTable';
import {
  CONFIG_MAP,
  SECRET,
} from '@shell/config/types';
import { TYPES } from '@shell/models/secret.js';
import { base64Decode } from '@shell/utils/crypto';

const rawObjKey = Symbol('rawObj');

const configMapHeaders = [
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
    name:     'keys',
    labelKey: 'tableHeaders.keys',
    sort:     false,
    value:    'keysDisplay',
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

const secretHeaders = [
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
    name:     'subType',
    labelKey: 'tableHeaders.subType',
    value:    'subTypeDisplay',
    sort:     ['subTypeDisplay'],
    width:    120,
  },
  {
    name:      'data',
    labelKey:  'tableHeaders.data',
    value:     'dataPreview',
    formatter: 'SecretData'
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
const getCertInfo = (d) => {
  const pem = base64Decode(d.data['tls.crt']);
  let issuer, notAfter, cn, sans, x;
  const END_MARKER = '-----END CERTIFICATE-----';

  if (pem) {
    const certs = pem.split(END_MARKER);
    let first = pem;

    if (certs.length > 1) {
      first = `${ certs[0] }${ END_MARKER }`;
    }

    try {
      x = new r.X509();

      x.readCertPEM(first);
      const issuerString = x.getIssuerString();

      issuer = issuerString.slice(issuerString.indexOf('CN=') + 3);
      notAfter = r.zulutodate(x.getNotAfter());

      const cnString = x.getSubjectString();

      cn = cnString.slice(cnString.indexOf('CN=') + 3);
    } catch {
      return null;
    }

    try {
      sans = x.getExtSubjectAltName();
    } catch (e) {
      sans = [];
    }

    return {
      issuer, notAfter, cn, sans
    };
  }

  return null;
};
const getKeysDisplay = (d) => {
  const keys = [
    ...Object.keys(d.data || []),
    ...Object.keys(d.binaryData || [])
  ];

  if ( !keys.length ) {
    return '(none)';
  }

  // if ( keys.length >= 4 ) {
  //   return `${keys[0]}, ${keys[1]}, ${keys[2]} and ${keys.length - 3} more`;
  // }

  return keys.join(', ');
};
const keyToMethodMap = {
  stateDisplay(d) {
    return d.metadata.state.name;
  },
  keysDisplay(d) {
    return getKeysDisplay(d);
  },
  subTypeDisplay(d, that) {
    const type = d._type || '';
    const fallback = type.replace(/^kubernetes.io\//, '');

    return that.$store.getters['i18n/withFallback'](`secret.types."${ type }"`, null, fallback);
  },
  dataPreview(d) {
    if (d._type === TYPES.DOCKER_JSON) {
      const encodedJSON = d.data['.dockerconfigjson'];

      if (encodedJSON) {
        const decodedJSON = base64Decode(encodedJSON);

        try {
          const auths = JSON.parse(decodedJSON).auths;
          const out = [];

          for (const domain in auths) {
            out.push(domain);
          }

          return out.join(', ');
        } catch (e) {
          return decodedJSON;
        }
      }
    } else if (d._type === TYPES.TLS) {
      return getCertInfo(d) || getKeysDisplay(d);
    } else if ( d._type === TYPES.BASIC ) {
      return base64Decode(d.data.username);
    } else if ( d._type === TYPES.SSH ) {
      return d.sshUser;
    } else if ( d._type === TYPES.SERVICE_ACCT ) {
      return d.metadata?.annotations?.['kubernetes.io/service-account.name'];
    }

    return getKeysDisplay(d);
  }
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
  name:       'SelectResources',
  components: {
    LabeledInput,
    LabeledSelect,
    SortableTable
  },
  props: {
    initSecrets: {
      type: Array,
      default() {
        return [];
      }
    },
    initConfigMaps: {
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
      secretHeaders,
      configMapHeaders,
      secrets:    [],
      configMaps: [],
      loading:    true
    };
  },
  computed: {
    namespaceOptions() {
      return [];
    },
    secretSchema() {
      return this.$store.getters['cluster/schemaFor'](SECRET);
    },
    configMapSchema() {
      return this.$store.getters['cluster/schemaFor'](CONFIG_MAP);
    },
    // secretHeaders() {
    //   return this.$store.getters['type-map/headersFor'](this.secretSchema);
    // },
    // configMapHeaders() {
    //   return this.$store.getters['type-map/headersFor'](this.configMapSchema);
    // },
    depProps() {
      const workloadIds = this.workloads.map(w => w.id);

      return `${ this.sourceCluster }-${ this.sourceProject }-${ this.sourceNamespace }-${ workloadIds.join('-') }`;
    },
    matchingSecrets() {
      const secretNames = new Set();

      this.workloads.forEach((w) => {
        w.spec.template.spec.containers.forEach((c) => {
          c.envFrom?.filter(e => e.secretRef)?.forEach(s => secretNames.add(s.secretRef.name));
          c.env?.filter(e => e.valueFrom?.secretKeyRef).forEach(s => secretNames.add(s.valueFrom.secretKeyRef.name));
        });
        w.spec.template.spec.volumes?.filter(v => v.secret).forEach(s => secretNames.add(s.secret.secretName));
      });

      return this.secrets.filter(s => secretNames.has(s.metadata.name)).map(s => objProxy(s, this));
    },
    matchingConfigMaps() {
      const configMapNames = new Set();

      this.workloads.forEach((w) => {
        w.spec.template.spec.containers.forEach((c) => {
          c.envFrom?.filter(e => e.configMapRef)?.forEach(c => configMapNames.add(c.configMapRef.name));
          c.env?.filter(e => e.valueFrom?.configMapKeyRef).forEach(c => configMapNames.add(c.valueFrom.configMapKeyRef.name));
        });
        w.spec.template.spec.volumes?.filter(v => v.configMap).forEach(c => configMapNames.add(c.configMap.name));
      });

      return this.configMaps.filter(c => configMapNames.has(c.metadata.name)).map(c => objProxy(c, this));
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
        const secretIds = this.initSecrets.map(s => s.id);
        const configMapIds = this.initConfigMaps.map(c => c.id);
        const secrets = this.matchingSecrets.filter(s => secretIds.includes(s.id));
        const configMaps = this.matchingConfigMaps.filter(c => configMapIds.includes(c.id));

        this.$refs.secretTableRef.update(secrets, []);
        this.$refs.configMapTableRef.update(configMaps, []);
      }
    }
  },
  methods: {
    async loadData(clusterId, namespace) {
      this.loading = true;
      try {
        const p = [
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/secrets/${ namespace }` }),
          this.$store.dispatch('management/request', { url: `/k8s/clusters/${ clusterId }/v1/configmaps/${ namespace }` })
        ];
        const [secrets, configMaps] = await Promise.all(p);

        this.secrets = secrets.data;
        this.configMaps = configMaps.data;
      } catch (err) {
        this.errors = [err];
      }
      this.loading = false;
    },
    getForm() {
      const secrets = this.$refs.secretTableRef.selectedRows.map(s => ({ ...s[rawObjKey] }));
      const configMaps = this.$refs.configMapTableRef.selectedRows.map(c => ({ ...c[rawObjKey] }));

      return {
        secrets,
        configMaps
      };
    },
    validate() {
      return Promise.resolve();
    }
  }
};
</script>
  <style scoped>

  </style>
