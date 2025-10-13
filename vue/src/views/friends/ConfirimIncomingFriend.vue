<template>
  <div
    class="d-flex flex-1 align-items-center justify-content-center w-100 flex-column gap-2"
  >
    <div v-if="data.oldFriend">
      Friend changed his name from <b>{{ data.oldFriend }}</b> to
      <b>{{ data.name }}</b
      >. Do you trust him?
    </div>
    <div v-if="!data.oldFriend">Accept a friend?</div>
    <div>{{ data.name }}</div>
    <div class="key-display" style="width: 400px">
      {{ data.senderKey }}
    </div>
    <div class="text-muted">{{ data.address }}:{{ data.port }}</div>
    <div class="d-flex gap-2">
      <button @click="AcceptFriend">Accept</button>
      <button @click="router.push('/')">Cancel</button>
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
  await window.api.invoke("friends-accept-incoming-public-key", {
    publicKey: data.senderKey,
    port: data.port,
    address: data.address,
    friendId: data.friendId,
  });
}
</script>
