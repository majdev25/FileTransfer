<template>
  <div class="d-flex flex-1 w-100 flex-column">
    <div
      v-for="friend in AcceptedFriends"
      :key="friend.friendId"
      style="border-bottom: 1px solid #f5f5f5"
      class="p-10 py-15 clickable bg-hover"
      @click="
        router.push({
          path: '/send-file',
          query: { data: JSON.stringify({ friendId: friend.friendId }) },
        })
      "
    >
      <div class="d-flex gap-2 justify-content-between align-items-center">
        <div class="d-flex gap-2 align-items-center">
          <FriendLogo :name="friend.name" :size="40" />
          <div class="d-flex flex-column">
            <span class="name">{{ friend.name }}</span>
            <span class="key">{{ publicKeyDisplay(friend.publicKey) }}</span>
          </div>
        </div>
        <div class="d-flex align-items-center">
          <LockIcon
            v-if="friend.AES.active"
            size="20"
            class="bg-gradient-orange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { LockIcon } from "@/components/icons";
import FriendLogo from "../../components/FriendLogo.vue";

import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

const friends = ref([]);

const AcceptedFriends = computed(() => {
  return friends.value.filter((x) => x.friendAccepted) || [];
});

onMounted(() => {
  getFriends();
});

function publicKeyDisplay(key) {
  if (!key) return "";
  const lines = key.trim().split("\n");
  const middleLines = lines.slice(1, -1).join("");
  return middleLines.slice(0, 10) + "...." + middleLines.slice(-10);
}

async function getFriends() {
  try {
    const result = await window.api.invoke("friends-get-all-friends", {});
    friends.value = JSON.parse(result);
  } catch (e) {
    console.error("Failed to load friends:", e);
  }
}
</script>
<style scoped>
.key {
  font-size: 12px;
  color: #9a9a9a;
}
.name {
  font-weight: bold;
}
</style>
