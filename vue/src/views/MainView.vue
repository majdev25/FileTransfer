<template>
  <div class="h-screen d-flex flex-column gap-2">
    <div class="notifications-wrapper d-flex flex-column gap-2">
      <div
        v-for="(n, index) in notifications"
        :key="index"
        class="d-flex gap-1"
        @click="handleNotificationClick(n.filePath, index)"
      >
        <div
          v-if="n.status === 'ERROR'"
          class="item d-flex gap-1 align-items-center"
        >
          <FileIcon size="22" class="bg-gradient-orange" />
          <div class="text-muted">
            File transfer failed <b>{{ n.fileName }}</b> from
            <b>{{ n.friendName }}</b
            >.
          </div>
        </div>

        <div
          v-else-if="n.status === 'OK'"
          class="item d-flex gap-1 align-items-center"
        >
          <FileIcon size="22" class="bg-gradient-orange" />
          <div class="text-muted">
            Successfully received file <b>{{ n.fileName }}</b> from
            <b>{{ n.friendName }}</b
            >.
          </div>
        </div>
      </div>
    </div>
    <div>
      <div class="d-flex align-items-center justify-content-between p-10">
        <div class="d-flex gap-2 align-items-center">
          <FriendLogo :name="settings.name" />
          <div class="key clickable" @click="copyMyPublicKey">
            {{ publicKeyDisplay }} (Click to copy)
          </div>
        </div>
        <div class="text-muted" style="font-size: 13px">v{{ version }}</div>
      </div>
      <div class="main-menu">
        <router-link to="/friends" class="item" active-class="active">
          Friends
        </router-link>
        <router-link to="/" class="item" active-class="active">
          Add friend
        </router-link>
        <router-link to="/settings" class="item" active-class="active">
          Settings
        </router-link>
        <div class="item-last"></div>
      </div>
    </div>
    <main class="flex-1 overflow-auto d-flex flex-column px-10">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import FriendLogo from "../components/FriendLogo.vue";
import { FileIcon, FailIcon } from "@/components/icons";

const router = useRouter();

const fullPublicKey = ref("");
const settings = ref({ downloadPath: "", name: "" });
const notifications = ref([]);
const version = ref("");

const publicKeyDisplay = computed(() => {
  if (!fullPublicKey.value) return "";
  return (
    fullPublicKey.value.slice(6, 16) + "...." + fullPublicKey.value.slice(-10)
  );
});

async function showPublicKey() {
  try {
    fullPublicKey.value = await window.api.invoke("keys-get-public-key");
    console.log(fullPublicKey.value);
  } catch (err) {
    console.error(err);
  }
}

async function copyMyPublicKey() {
  await window.api.invoke("app-copy-to-clipboard", {
    value: fullPublicKey.value,
  });
}

async function handleNotificationClick(filePath, index) {
  this.notifications.splice(index, 1);
  await window.api.invoke("app-show-file", {
    filePath: filePath,
  });
}

async function updateSetting() {
  settings.value = await window.api.invoke("app-get-settings", {});
}

onMounted(async () => {
  version.value = await window.api.invoke("app-get-version", {});

  window.api.on("confirm-incoming-friend", (data) => {
    router.push({
      path: "/confirm-incoming-friend",
      query: { data: JSON.stringify(data) },
    });
  });

  window.api.on("confirm-incoming-fileTransfer", (data) => {
    console.log(data);
    router.push({
      path: "/confirm-incoming-fileTransfer",
      query: { data: JSON.stringify(data) },
    });
  });

  window.api.on("file-transfer-status", (data) => {
    console.log(data);
    notifications.value.push(data);
  });

  window.api.on("app-settings-updated", (data) => {
    updateSetting();
  });

  showPublicKey();
  updateSetting();
});
</script>

<style scoped>
.logo {
  font-size: 25px;
  font-weight: bold;
}
.key {
  color: #c4c4c4;
  font-size: 14px;
  word-wrap: break-word;
}
button {
  margin-top: 10px;
  padding: 8px 12px;
  cursor: pointer;
}

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

.text-center {
  text-align: center;
}

.main-menu {
  display: flex;
  width: 100%;
}

.main-menu > .item {
  padding: 5px 20px;
  color: #c4c4c4 !important;
  transition: all 0.4s;
  border-bottom: 1px solid #eaeaea;

  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  border-top: 1px solid transparent;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}

.main-menu > .item-last {
  flex: 1;
  padding: 5px 20px;
  color: #c4c4c4 !important;
  border-bottom: 1px solid #eaeaea;
}

.main-menu > .item:hover {
  background-color: #f7f7f7;
}

.main-menu > .item.active {
  border-bottom: 1px solid transparent;
  border-left: 1px solid #eaeaea;
  border-right: 1px solid #eaeaea;
  border-top: 1px solid #eaeaea;
  color: #919191 !important;
}

.notifications-wrapper {
  position: fixed;
  right: 10px;
  bottom: 10px;
}

.notifications-wrapper .item {
  width: fit-content;
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 10px;
  cursor: pointer;
  background-color: white;
  transition: all 0.3s;
}

.notifications-wrapper .item:hover {
  background-color: #f7f7f7;
}
</style>
