<template>
  <div class="d-flex flex-1 w-100 flex-column">
    <div>Download file path:</div>
    <div class="d-flex gap-2">
      <input v-model="settings.downloadPath" readonly class="flex-1" />
      <button @click="choosePath">Browse</button>
    </div>
    <div>Name:</div>
    <div class="d-flex gap-2">
      <input v-model="settings.name" class="flex-1" />
    </div>
    <hr />
    <button @click="saveSettings">Save</button>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { LockIcon } from "@/components/icons";
import loader from "@/components/loader.vue";

import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

const settings = ref({ downloadPath: "", name: "" });

const choosePath = async () => {
  settings.value.downloadPath = await window.api.invoke("app-select-path");
};

const saveSettings = async () => {
  const plainSettings = { ...settings.value };
  settings.value.downloadPath = await window.api.invoke("app-save-settings", {
    newSettings: plainSettings,
  });
  settings.value = await window.api.invoke("app-get-settings", {});
};

onMounted(async () => {
  settings.value = await window.api.invoke("app-get-settings", {});
});
</script>
