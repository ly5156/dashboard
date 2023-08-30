<template>
  <div>
    <div class="task-config mt-20">
      <RadioGroup
        v-model="encrypted"
        name="encrypted"
        :label="t('appMigration.createAppMigrationTaskPage.form.taskConfig.encryptedOption.title')"
        :options="encryptedOptions"
      />
      <RadioGroup
        v-model="storageLocation"
        name="storageLocation"
        :label="t('appMigration.createAppMigrationTaskPage.form.taskConfig.storageLocation.title')"
        :options="storageLocationOptions"
      />

      <RadioGroup
        v-model="replacePolicy"
        name="replacePolicy"
        :label="t('appMigration.createAppMigrationTaskPage.form.taskConfig.replacePolicy.title')"
        :options="replacePolicyOptions"
      />
    </div>
  </div>
</template>
<script>
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RadioGroup } from '@components/Form/Radio';

export default {
  name:       'TaskConfig',
  components: {
    LabeledInput,
    LabeledSelect,
    RadioGroup
  },
  data() {
    return {
      encrypted:        '',
      encryptedOptions: [
        {
          label: this.t('appMigration.createAppMigrationTaskPage.form.taskConfig.encryptedOption.unencrypted'),
          value: 'unencrypted'
        }, {
          label: this.t('appMigration.createAppMigrationTaskPage.form.taskConfig.encryptedOption.encrypted'),
          value: 'encrypted'
        }
      ],
      storageLocation:        '',
      storageLocationOptions: [
        {
          label: this.t('appMigration.createAppMigrationTaskPage.form.taskConfig.storageLocation.default'),
          value: 'default'
        },
        {
          label: this.t('appMigration.createAppMigrationTaskPage.form.taskConfig.storageLocation.s3'),
          value: 's3'
        }
      ],
      replacePolicy:        '',
      replacePolicyOptions: [
        {
          label: this.t('appMigration.createAppMigrationTaskPage.form.taskConfig.replacePolicy.validation'),
          value: 'validation'
        },
        {
          label: this.t('appMigration.createAppMigrationTaskPage.form.taskConfig.replacePolicy.replace'),
          value: 'replace'
        },
      ]
    };
  },
  methods: {
    validate() {

    }
  }
};
</script>
  <style scoped>

  </style>
