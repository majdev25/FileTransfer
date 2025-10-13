<template>
  <div v-if="visible" class="modal-bg">
    <div class="modal-content d-flex flex-column gap-2">
      <div v-html="modalData.body"></div>
      <div class="modal-actions">
        <button
          v-for="action in modalData.actions"
          :key="action.label"
          @click="handleAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const visible = ref(false);
const modalData = ref({ body: "", actions: [] });

window.api.on("open-modal", (data) => {
  modalData.value = data;
  visible.value = true;
});

function handleAction(action) {
  if (action.invokeChannel) {
    const safeParams = JSON.parse(JSON.stringify(action.params || {}));
    window.api.invoke(action.invokeChannel, safeParams);
  }
  if (action.local) action.local();
  visible.value = false;
}
</script>
<style scoped>
.modal-bg {
  background-color: rgba(0, 0, 0, 0.7);
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 400px;
  padding: 20px;
  background-color: white;
  border-radius: 10px;
  color: black;
}
</style>
