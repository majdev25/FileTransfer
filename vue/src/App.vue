<template>
  <MainView v-if="status == 1"></MainView>
  <setPassword v-else></setPassword>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from "vue";
import MainView from "./views/MainView.vue";
import setPassword from "./views/setPassword.vue";

const status = ref(0);

onMounted(() => {
  window.api.on("app-enter-app", () => {
    status.value = 1;
  });
});
</script>

<style scoped></style>
