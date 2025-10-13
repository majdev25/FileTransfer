<template>
  <div
    class="d-flex flex-1 align-items-center justify-content-center w-100 flex-column gap-2"
  >
    <div v-if="status == 1" class="d-flex gap-2 flex-column align-items-center">
      <loader></loader>
      <div>Connecting to a friend...</div>
    </div>
    <div v-if="status == 2" class="d-flex gap-2 flex-column align-items-center">
      <loader></loader>
      <div>Creating secure connection...</div>
    </div>
    <div v-if="status == 0" class="d-flex flex-column gap-2">
      <div>
        <div style="margin-bottom: 10px" class="text-muted">
          Enter friends public key
        </div>
        <input v-model="friendKey" />
      </div>
      <button @click="searchFriend()">Find friend</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import loader from "../../components/loader.vue";

const friendKey = ref("");
const status = ref(0);

async function searchFriend() {
  try {
    status.value = 1;
    const result = await window.api.invoke("friends-search", {
      message: friendKey.value,
    });
    console.log(result);
  } catch (err) {
    console.error("UDP error:", err);
  }
}

onMounted(() => {
  window.api.on("friends-friend-found-and-accepted", (data) => {
    status.value = 2;
  });
  window.api.on("friends-friend-KEK-created", (data) => {
    friendKey.value = "";
    status.value = 0;
  });
  window.api.on("friends-friend-KEK-failed", (data) => {
    friendKey.value = "";
    status.value = 0;
  });
});
</script>

<style scoped>
input {
  height: 40px;
  width: 400px;
  font-size: 30px;
  border-radius: 5px;
  padding: 5px 10px;
  border: 2px solid #eaeaea;
}

button {
  height: 50px;
  width: 400px;
  font-size: 20px;
}
</style>
