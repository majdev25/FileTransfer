<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" :stop-color="gradientStart" />
        <stop offset="100%" :stop-color="gradientEnd" />
      </linearGradient>
    </defs>
    <path
      d="M7.4,2.3C6.1,2.3,5,3.4,5,4.8v14.7c0,1.3,1.1,2.4,2.4,2.4h9.8c1.3,0,2.4-1.1,2.4-2.4V8.8c0-0.6-0.3-1.3-0.7-1.7
	L14.8,3c-0.5-0.5-1.1-0.7-1.7-0.7H7.4z M17.4,9.1h-3.6c-0.5,0-0.9-0.4-0.9-0.9V4.6L17.4,9.1z"
      :fill="'url(#' + gradientId + ')'"
    />
  </svg>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  size: { type: [Number, String], default: 100 },
  gradientStart: { type: String, default: "#ff7e5f" },
  gradientEnd: { type: String, default: "#feb47b" },
});

const gradientId = "grad-" + Math.random().toString(36).slice(2, 11);
</script>

<style scoped>
.icon-wrapper {
  overflow: hidden;
}
</style>
