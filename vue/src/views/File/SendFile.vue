<template>
  <div
    class="d-flex flex-1 align-items-center justify-content-center w-100 flex-column gap-2"
  >
    <div>{{ data.friendId }}</div>
    <div v-if="status == -2" class="d-flex flex-column gap-2">
      Friend unreachable.
      <button @click="testCon">Retry</button>
    </div>
    <div v-if="status == -1" class="d-flex flex-column gap-2">
      <loader /> Testing connection
    </div>
    <button class="main-button" @click="sendFile" v-if="status == 0">
      Select file to send
    </button>

    <!-- Progress bar -->
    <div v-if="status == 1" class="progress-container">
      <div class="progress-bar" :style="{ width: percent + '%' }"></div>
      <div class="progress-text">{{ Math.floor(percent) }}%</div>
    </div>
    <div v-if="status == 2" class="d-flex flex-column align-items-center gap-2">
      {{ msg }}
      <div>
        <button @click="sendFile">Transfer another file</button>
      </div>
    </div>
    <div
      v-if="status == 10"
      class="d-flex flex-column align-items-center gap-2"
    >
      {{ msg }}
      <div>
        <button @click="sendFile">Try again</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Buffer } from "buffer";
import loader from "../../components/loader.vue";

const router = useRouter();
const route = useRoute();
const data = route.query.data ? JSON.parse(route.query.data) : null;

const percent = ref(0);
const progressVisible = ref(false);
const status = ref(-1);
const msg = ref("");

function selectFile() {
  const fileInput = document.querySelector('input[type="file"]');
  fileInput.click();
}

async function sendFile(event) {
  const filePath = await window.api.invoke("app-select-file");
  if (!filePath) return; // user canceled

  await window.api.invoke("files-send-file", {
    filePath,
    friendId: data.friendId,
  });

  status.value = 1;

  event.target.value = "";
}

async function testCon() {
  const maxRetries = 4;
  const delay = 10000;
  status.value = -1; // testing

  for (let i = 0; i < maxRetries; i++) {
    if (status.value === 0) break; // stop if already OK

    console.log(`Testing connection attempt ${i + 1}...`);
    await window.api.invoke("friends-test-connection", {
      friendId: data.friendId,
    });

    // wait 5 seconds before next attempt, unless status becomes 0
    if (i < maxRetries - 1 && status.value !== 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (status.value !== 0) {
    status.value = -2;
  }
}

onMounted(() => {
  window.api.on("files-test-connection-OK", (data) => {
    console.log("Connection OK");
    if (status.value < 0) {
      status.value = 0;
    }
  });

  window.api.on("files-trans-percent", (data) => {
    percent.value = data.percent;
  });

  window.api.on("file-transfer-ack", (data) => {
    status.value = data.status;
    msg.value = data.msg || "";
  });

  testCon();
});
</script>

<style scoped>
.main-button {
  height: 50px;
  width: 400px;
  font-size: 20px;
}

.progress-container {
  position: relative;
  width: 400px;
  height: 25px;
  background-color: #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  margin-top: 10px;
}

.progress-bar {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.1s linear;
}

.progress-text {
  position: absolute;
  width: 100%;
  text-align: center;
  line-height: 25px;
  font-weight: bold;
  color: #fff;
}
</style>
