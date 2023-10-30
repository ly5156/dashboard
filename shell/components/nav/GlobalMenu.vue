<template>
  <div class="global-menu">
    <v-popover
      ref="globalMenu"
      placement="bottom-end"
      offset="0"
      trigger="click"
      :delay="{show: 0, hide: 0}"
      :popper-options="{modifiers: { flip: { enabled: false } } }"
      :container="false"
    >
      <div class="global-menu__action">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        ><rect
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          y="6"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          y="12"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="6"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="6"
          y="6"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="6"
          y="12"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="12"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="12"
          y="6"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="12"
          y="12"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /></svg>
        <span>全局服务</span>
      </div>
      <template slot="popover">
        <div class="global-menu__content">
          <div class="global-menu__section">
            <nuxt-link
              :to="{ name: 'home' }"
              class="global-menu__item"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24"
                viewBox="0 0 24 24"
                width="24"
              ><path
                d="M0 0h24v24H0z"
                fill="none"
              /><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
              <div>
                {{ t('nav.home') }}
              </div>
            </nuxt-link>
          </div>
          <div>
            <template v-if="multiClusterApps.length">
              <div class="category">
                {{ t('nav.categories.multiCluster') }}
              </div>
              <div class="global-menu__section">
                <div
                  v-for="a in multiClusterApps"
                  :key="a.label"
                  @click="hide()"
                >
                  <nuxt-link
                    class="global-menu__item"
                    :to="a.to"
                  >
                    <IconOrSvg
                      :icon="a.icon"
                      :src="a.svg"
                    />
                    <div>{{ a.label }}</div>
                  </nuxt-link>
                </div>
              </div>
            </template>
          </div>
          <div>
            <template v-if="configurationApps.length">
              <div class="category">
                {{ t('nav.categories.configuration') }}
              </div>
              <div class="global-menu__section">
                <div
                  v-for="a in configurationApps"
                  :key="a.label"
                  @click="hide()"
                >
                  <nuxt-link
                    class="global-menu__item"
                    :to="a.to"
                  >
                    <IconOrSvg
                      :icon="a.icon"
                      :src="a.svg"
                    />
                    <div>{{ a.label }}</div>
                  </nuxt-link>
                </div>
              </div>
            </template>
          </div>
          <div>
            <template v-if="clusters && !!clusters.length">
              <div class="category">
                {{ t('nav.categories.explore') }}
              </div>

              <!-- <div
              v-if="showClusterSearch"
              class="search"
            >
              <input
                ref="clusterFilter"
                v-model="clusterFilter"
                :placeholder="t('nav.search.placeholder')"
              >
              <i
                v-if="clusterFilter"
                class="icon icon-close"
                @click="clusterFilter=''"
              />
            </div> -->
              <div
                class="global-menu__section"
              >
                <div
                  v-for="c in clustersFiltered"
                  :key="c.id"
                  @click="hide()"
                >
                  <nuxt-link
                    v-if="c.ready"
                    class="global-menu__item"
                    :to="{ name: 'c-cluster-explorer', params: { cluster: c.id } }"
                  >
                    <ClusterProviderIcon
                      :small="true"
                      :cluster="c"
                      class="rancher-provider-icon mr-10"
                    />
                    <div class="cluster-name">
                      {{ c.label }}
                    </div>
                  </nuxt-link>
                  <span
                    v-else
                    class="option-disabled cluster selector disabled"
                  >
                    <ClusterProviderIcon
                      :small="true"
                      :cluster="c"
                      class="rancher-provider-icon mr-10"
                    />
                    <div class="cluster-name">{{ c.label }}</div>
                  </span>
                </div>
                <div
                  v-if="clustersFiltered.length === 0"
                  class="none-matching"
                >
                  {{ t('nav.search.noResults') }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </v-popover>
  </div>
</template>
<script>
import ClusterProviderIcon from '@shell/components/ClusterProviderIcon';
import IconOrSvg from '../IconOrSvg';
import { mapGetters } from 'vuex';
import { CAPI, MANAGEMENT } from '@shell/config/types';
import { mapPref, MENU_MAX_CLUSTERS } from '@shell/store/prefs';
import { sortBy } from '@shell/utils/sort';
import { ucFirst } from '@shell/utils/string';
import { getVersionInfo } from '@shell/utils/version';
import { LEGACY } from '@shell/store/features';
import { SETTING } from '@shell/config/settings';
import { filterOnlyKubernetesClusters, filterHiddenLocalCluster } from '@shell/utils/cluster';
import { isRancherPrime } from '@shell/config/version';

export default {

  components: {
    ClusterProviderIcon,
    IconOrSvg
  },

  data() {
    const { displayVersion, fullVersion } = getVersionInfo(this.$store);
    const hasProvCluster = this.$store.getters[`management/schemaFor`](CAPI.RANCHER_CLUSTER);

    return {
      shown:         false,
      displayVersion,
      fullVersion,
      clusterFilter: '',
      hasProvCluster,
    };
  },

  fetch() {
    if (this.hasProvCluster) {
      this.$store.dispatch('management/findAll', { type: CAPI.RANCHER_CLUSTER });
    }
  },

  computed: {
    ...mapGetters(['clusterId']),
    ...mapGetters(['clusterReady', 'isRancher', 'currentCluster', 'currentProduct', 'isRancherInHarvester']),
    ...mapGetters('type-map', ['activeProducts']),
    ...mapGetters({ features: 'features/get' }),

    value: {
      get() {
        return this.$store.getters['productId'];
      },
    },

    legacyEnabled() {
      return this.features(LEGACY);
    },

    showClusterSearch() {
      return this.clusters.length > this.maxClustersToShow;
    },

    clusters() {
      const all = this.$store.getters['management/all'](MANAGEMENT.CLUSTER);
      let kubeClusters = filterHiddenLocalCluster(filterOnlyKubernetesClusters(all, this.$store), this.$store);
      let pClusters = null;

      if (this.hasProvCluster) {
        pClusters = this.$store.getters['management/all'](CAPI.RANCHER_CLUSTER);
        const available = pClusters.reduce((p, c) => {
          p[c.mgmt] = true;

          return p;
        }, {});

        // Filter to only show mgmt clusters that exist for the available provisionning clusters
        // Addresses issue where a mgmt cluster can take some time to get cleaned up after the corresponding
        // provisionning cluster has been deleted
        kubeClusters = kubeClusters.filter(c => !!available[c]);
      }

      return kubeClusters.map((x) => {
        const pCluster = pClusters?.find(c => c.mgmt.id === x.id);

        return {
          id:              x.id,
          label:           x.nameDisplay,
          ready:           x.isReady && !pCluster?.hasError,
          osLogo:          x.providerOsLogo,
          providerNavLogo: x.providerMenuLogo,
          badge:           x.badge,
          isLocal:         x.isLocal,
          isHarvester:     x.isHarvester
        };
      });
    },

    clustersFiltered() {
      const search = (this.clusterFilter || '').toLowerCase();

      const out = search ? this.clusters.filter(item => item.label.toLowerCase().includes(search)) : this.clusters;

      const sorted = sortBy(out, ['name:desc', 'label']);

      return sorted;
    },

    maxClustersToShow: mapPref(MENU_MAX_CLUSTERS),

    multiClusterApps() {
      const options = this.options;

      return options.filter((opt) => {
        const filterApps = (opt.inStore === 'management' || opt.isMultiClusterApp) && opt.category !== 'configuration' && opt.category !== 'legacy' && opt.category !== 'hci';

        if (this.isRancherInHarvester) {
          return filterApps && opt.category !== 'hci';
        } else {
          // We expect the location of Virtualization Management to remain the same when rancher-manage-support is not enabled
          return filterApps;
        }
      });
    },

    legacyApps() {
      const options = this.options;

      return options.filter(opt => opt.inStore === 'management' && opt.category === 'legacy');
    },

    configurationApps() {
      const options = this.options;

      return options.filter(opt => opt.category === 'configuration' && opt.value !== 'uiplugins');
    },

    hciApps() {
      const options = this.options;

      return options.filter(opt => this.isRancherInHarvester && opt.category === 'hci');
    },

    options() {
      const cluster = this.clusterId || this.$store.getters['defaultClusterId'];

      // TODO plugin routes
      const entries = this.activeProducts.map((p) => {
        // Try product-specific index first
        const to = p.to || {
          name:   `c-cluster-${ p.name }`,
          params: { cluster }
        };

        if ( !this.$router.getMatchedComponents(to).length ) {
          to.name = 'c-cluster-product';
          to.params.product = p.name;
        }

        return {
          label:             this.$store.getters['i18n/withFallback'](`product."${ p.name }"`, null, ucFirst(p.name)),
          icon:              `icon-${ p.icon || 'copy' }`,
          svg:               p.svg,
          value:             p.name,
          removable:         p.removable !== false,
          inStore:           p.inStore || 'cluster',
          weight:            p.weight || 1,
          category:          p.category || 'none',
          to,
          isMultiClusterApp: p.isMultiClusterApp,
        };
      });

      return sortBy(entries, ['weight']);
    },

    canEditSettings() {
      return (this.$store.getters['management/schemaFor'](MANAGEMENT.SETTING)?.resourceMethods || []).includes('PUT');
    },

    hasSupport() {
      return isRancherPrime() || this.$store.getters['management/byId'](MANAGEMENT.SETTING, SETTING.SUPPORTED )?.value === 'true';
    }
  },

  watch: {
    $route() {
      this.shown = false;
    }
  },

  mounted() {
    document.addEventListener('keyup', this.handler);
  },

  beforeDestroy() {
    document.removeEventListener('keyup', this.handler);
  },

  methods: {
    hide() {
      this.$refs.globalMenu?.hide();
    },

    toggle() {
      this.shown = !this.shown;
      this.$nextTick(() => {
        this.setClusterListHeight(this.maxClustersToShow);
      });
    },

    async goToHarvesterCluster() {
      const localCluster = this.$store.getters['management/all'](CAPI.RANCHER_CLUSTER).find(C => C.id === 'fleet-local/local');

      try {
        await localCluster.goToHarvesterCluster();
      } catch {
      }
    }
  }
};
</script>
<style scoped lang="scss">

.global-menu {
  height: 100%;
  display: flex;
  align-items: center;
}
.global-menu__action {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 20px;
  cursor: pointer;
  color: var(--primary);
}
.global-menu__content {
  min-width: 500px;
  color: var(--primary);
  display: grid;
  gap: 10px;
}
.global-menu__section {
  display: flex;
  gap: 20px;
  color: var(--primary);
}
.category {
  margin: 10px 0;
  opacity: 0.8;
}
.popover .popover-inner {
  & a.global-menu__item {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  color: var(--primary);
  padding: 4px 10px;
  & svg {
    fill:  var(--primary);
  }
  &:hover{
    background: var(--primary-hover-bg);
    color: var(--primary-hover-text);
    border-radius: 5px;
    text-decoration: none;
  }
  &:hover svg, &:hover :deep(.rancher-icon-fill) {
    fill: var(--primary-hover-text);
  }
  & i {
    font-size: 24px;
  }
}
}
</style>
