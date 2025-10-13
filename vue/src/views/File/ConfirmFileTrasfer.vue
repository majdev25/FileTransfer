<template>
  <div
    class="d-flex flex-1 align-items-center justify-content-center w-100 flex-column gap-2"
  >
    <div class="text-muted">
      Incoming file from <b>{{ data.friendName }}</b>
    </div>
    <div class="bg-grey">
      <b>{{ data.fileName }}</b> ({{ formatSize(data.size) }})
    </div>
    <div class="d-flex gap-2">
      <button @click="AcceptFriend">Accept</button>
      <button @click="RejectFriend">Cancel</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();
const data = route.query.data ? JSON.parse(route.query.data) : null;
onMounted(() => {});

async function AcceptFriend() {
  router.push("/");
  await window.api.invoke("file-accept-fileTransfer", {
    data,
  });
}

async function RejectFriend() {
  router.push("/");
  await window.api.invoke("file-reject-fileTransfer", {
    data,
  });
}

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1000; // decimal units
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${Math.floor(size * 10) / 10} ${sizes[i]}`;
}
</script>
