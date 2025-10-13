<template>
  <div class="user-logo">
    {{ initials }}
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
});

const initials = computed(() => {
  if (!props.name) return "";

  const parts = props.name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
  } else {
    return parts[0].slice(0, 2).toUpperCase();
  }
});
</script>
<style scoped>
.user-logo {
  height: 30px;
  width: 30px;
  border-radius: 50%;
  background-color: #dbdbdb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
</style>
