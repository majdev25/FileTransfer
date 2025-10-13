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
      class="st0"
      d="M12,21.2c-5.1,0-9.2-4.1-9.2-9.2S6.9,2.8,12,2.8s9.2,4.1,9.2,9.2S17.1,21.2,12,21.2z M12,14.3
	c-0.6,0-1.1,0.5-1.1,1.1c0,0.6,0.5,1.1,1.1,1.1s1.1-0.5,1.1-1.1C13.1,14.8,12.6,14.3,12,14.3z M12,7.4c-0.7,0-1.2,0.6-1.1,1.2
	l0.3,3.7c0,0.5,0.4,0.8,0.9,0.8c0.5,0,0.8-0.3,0.9-0.8l0.3-3.7C13.2,8,12.7,7.4,12,7.4L12,7.4z"
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
