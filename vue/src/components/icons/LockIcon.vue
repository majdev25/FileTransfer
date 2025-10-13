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
      d="M19.42,3.83,12.24,2h0A.67.67,0,0,0,12,2a.67.67,0,0,0-.2,0h0L4.58,3.83A2,2,0,0,0,3.07,5.92l.42,5.51a12,12,0,0,0,7.24,10.11l.88.38h0a.91.91,0,0,0,.7,0h0l.88-.38a12,12,0,0,0,7.24-10.11l.42-5.51A2,2,0,0,0,19.42,3.83ZM15.71,9.71l-4,4a1,1,0,0,1-1.42,0l-2-2a1,1,0,0,1,1.42-1.42L11,11.59l3.29-3.3a1,1,0,0,1,1.42,1.42Z"
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
