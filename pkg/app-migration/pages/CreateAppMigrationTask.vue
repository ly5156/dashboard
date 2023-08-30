<template>
  <div class="create-app-migration-task">
    <Wizard
      :steps="steps"
      :edit-first-step="true"
      :initial-title="false"
      :errors="errors"
    >
      <template #target>
        <SelectTarget
          ref="targetConfigRef"
          :init-value="targetForm"
          :source-cluster="currentCluster"
        />
      </template>
      <template #workload>
        <SelectWorkloads
          ref="workloadConfigRef"
          :target-cluster="target.cluster"
          :target-project="target.project"
          :target-namespace="target.namespace"
          :source-cluster="source.cluster"
          :source-namespace="source.namespace"
          :source-project="source.project"
          :init-value="workloads"
        />
      </template>
      <template #resources>
        <SelectRelatedResources
          ref="resourcesConfigRef"
          :init-secrets="secrets"
          :init-config-maps="configMaps"
          :target-cluster="target.cluster"
          :target-project="target.project"
          :target-namespace="target.namespace"
          :source-cluster="source.cluster"
          :source-namespace="source.namespace"
          :source-project="source.project"
          :workloads="workloads"
        />
      </template>
      <template #service>
        <SelectServices
          ref="serviceConfigRef"
          :init-value="services"
          :target-cluster="target.cluster"
          :target-project="target.project"
          :target-namespace="target.namespace"
          :source-cluster="source.cluster"
          :source-namespace="source.namespace"
          :source-project="source.project"
          :workloads="workloads"
        />
      </template>
      <template #storage>
        <SelectStorages
          ref="storageConfigRef"
          :init-value="pvcs"
          :target-cluster="cluster"
          :target-project="project"
          :target-namespace="namespace"
          :source-cluster="source.cluster"
          :source-namespace="source.namespace"
          :source-project="source.project"
          :workloads="workloads"
        />
      </template>
      <template #task>
        <TaskConfig
          ref="taskConfigRef"
          :cluster="cluster"
          :project="project"
          :namespace="namespace"
        />
      </template>
      <template #controlsContainer="{showPrevious, cancel, finish, next, back, activeStep, activeStepIndex, visibleSteps, errorStrings}">
        <div style="margin-bottom: 50px;">
          <Banner
            v-for="(err,idx) in errorStrings"
            :key="err"
            color="error"
            :label="err"
            :closable="true"
            @close="errors.splice(idx, 1)"
          />
        </div>
        <div
          id="wizard-footer-controls"
          class="controls-row pt-20"
        >
          <button
            type="button"
            class="btn role-secondary"
            @click="cancel"
          >
            <t k="generic.cancel" />
          </button>

          <div class="controls-steps">
            <template
              v-if="showPrevious"
            >
              <button
                type="button"
                class="btn role-secondary"
                @click="back()"
              >
                <t k="wizard.previous" />
              </button>
            </template>
            <template
              v-if="activeStepIndex === visibleSteps.length-1"
            >
              <AsyncButton
                :disabled="!activeStep.ready"
                mode="finish"
                @click="finish"
              />
            </template>
            <template
              v-else
              name="next"
              :next="next"
            >
              <button
                type="button"
                class="btn role-primary"
                @click="nextStep(next, activeStep, activeStepIndex)"
              >
                <t k="wizard.next" />
              </button>
            </template>
          </div>
        </div>
      </template>
    </Wizard>
  </div>
</template>
<script>
import { mapGetters } from 'vuex';
import Wizard from '@/shell/components/Wizard';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton.vue';
import SelectTarget from '../components/SelectTarget.vue';
import SelectWorkloads from '../components/SelectWorkloads.vue';
import SelectRelatedResources from '../components/SelectRelatedResources.vue';
import SelectServices from '../components/SelectServices.vue';
import SelectStorages from '../components/SelectStorages.vue';
import TaskConfig from '../components/TaskConfig.vue';

export default {
  name:       'CreateAppMigrationTask',
  components: {
    Wizard,
    SelectTarget,
    SelectWorkloads,
    SelectRelatedResources,
    SelectServices,
    SelectStorages,
    TaskConfig,
    Banner,
    AsyncButton
  },
  data() {
    const steps = [{
      name:  'target',
      label: this.t('appMigration.createAppMigrationTaskPage.target'),
      ready: false
    },
    {
      name:  'workload',
      label: this.t('appMigration.createAppMigrationTaskPage.workload'),
      ready: false
    },
    {
      name:  'resources',
      label: this.t('appMigration.createAppMigrationTaskPage.resources'),
      ready: false
    },
    {
      name:  'service',
      label: this.t('appMigration.createAppMigrationTaskPage.service'),
      ready: false
    },
    {
      name:  'storage',
      label: this.t('appMigration.createAppMigrationTaskPage.storage'),
      ready: false
    },
    {
      name:  'task',
      label: this.t('appMigration.createAppMigrationTaskPage.task'),
      ready: false
    }];

    return {
      errors:             [],
      steps,
      targetConfigRef:    null,
      workloadConfigRef:  null,
      resourcesConfigRef: null,
      serviceConfigRef:   null,
      storageConfigRef:   null,
      taskConfigRef:      null,
      target:             {
        cluster:   '',
        project:   '',
        namespace: '',
      },
      source: {
        cluster:   '',
        project:   '',
        namespace: '',
      },
      cluster:    null,
      project:    null,
      namespace:  null,
      name:       null,
      workloads:  [],
      secrets:    [],
      configMaps: [],
      services:   [],
      pvcs:       [],
    };
  },
  computed: {
    ...mapGetters(['currentCluster']),
    targetForm() {
      const cluster = this.cluster;
      const project = this.project;
      const namespace = this.namespace;
      const name = this.name;

      return {
        name,
        cluster,
        project,
        namespace
      };
    }
  },
  watch: {
    currentCluster: {
      handler(c) {
        this.source.cluster = c.id;
      },
      immediate: true
    },
  },
  methods: {
    async nextStep(next, activeStep, activeStepIndex) {
      this.errors = [];
      const step = activeStep.name;
      const m = `${ step }ConfigRef`;
      const c = this.$refs[m];

      try {
        await c.validate();
      } catch (err) {
        this.errors = err.errors.map(e => e.message);
      }
      if (this.errors.length === 0) {
        const form = c.getForm();

        switch (step) {
        case 'target':
          this.target.cluster = form.cluster;
          this.target.project = form.project;
          this.target.namespace = form.namespace;
          this.name = form.name;
          break;
        case 'workload':
          this.workloads = form.workloads;
          this.source.project = form.project;
          this.source.namespace = form.namespace;
          break;
        case 'resources':
          this.secrets = form.secrets;
          this.configMpas = form.configMpas;
          break;
        case 'service':
          this.services = form.services;
          break;
        case 'storage':
          this.pvcs = form.pvcs;
          break;
        default:
          break;
        }

        this.steps[activeStepIndex].ready = true;
        this.$nextTick(() => {
          next();
        });
      }
    },
  }
};

</script>

<style scope>
.create-app-migration-task {
  position: relative;
}
</style>
