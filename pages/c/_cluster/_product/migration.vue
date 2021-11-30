<template>
  <div>
    <component :is="dynamicComponent" :dep-component-map="depComponentMap"></component>
  </div>
</template>
<script>
// import Vue from 'vue';
import LabeledInput from '@/components/form/LabeledInput';
import ResourceTable from '@/components/ResourceTable';

async function loadScript(url, timeout = 30000) {
  if (document.querySelector(`head > script[src="${ url }"]`)) {
    return;
  }

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout loading ${ url }`));
    }, timeout);

    const script = document.createElement('script');

    script.onload = function(arg) {
      clearTimeout(timer);
      resolve(arg);
    };
    script.onerror = function(arg) {
      script.remove();
      clearTimeout(timer);
      reject(arg);
    };
    script.src = url;
    document.head.appendChild(script);
  });
}

async function loadStylesheet(url, timeout = 30000) {
  if (document.querySelector(`head > link[rel="stylesheet"][href="${ url }"]`)) {
    return;
  }

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout loading ${ url }`));
    }, timeout);

    const link = document.createElement('link');

    link.onload = function(arg) {
      clearTimeout(timer);
      resolve(arg);
    };
    link.onerror = function(arg) {
      link.remove();
      clearTimeout(timer);
      reject(arg);
    };
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  });
}

export default {
  async fetch() {
    if (window['clone-cross-cluster']) {
      this.dynamicComponent = window['clone-cross-cluster'];

      return;
    }
    await Promise.all([loadScript('https://lucky-star.xyz/components/clone-cross-cluster.umd.js'), loadStylesheet('https://lucky-star.xyz/components/clone-cross-cluster.css')]);
    this.dynamicComponent = window['clone-cross-cluster'];
  },
  data() {
    return {
      dynamicComponent: null,
      depComponentMap:  { LabeledInput, ResourceTable }
    };
  },
};
</script>
