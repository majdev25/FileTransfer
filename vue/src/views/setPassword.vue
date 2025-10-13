<template>
  <div
    class="d-flex flex-1 align-items-center justify-content-center w-100 flex-column gap-2 h-screen bg"
  >
    <div class="reset-div clickable" @click="resetApp()">Reset app</div>
    <div class="d-flex flex-column gap-2 align-items-center">
      <div>
        <div style="margin-bottom: 10px" class="text-muted">Enter password</div>
        <input v-model="password" type="password" />
        <div style="color: red">{{ msg }}</div>
      </div>
      <button @click="enterPassword()">Log in</button>
      <div class="text-muted">If entering first time choose new password.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { LockIcon } from "@/components/icons";

const password = ref("");
const status = ref(0);
const msg = ref("");

async function enterPassword() {
  try {
    status.value = 1;
    const result = await window.api.invoke("app-enter-password", {
      password: password.value,
    });
    if (result) {
      msg.value = "";
    } else {
      msg.value = "Incorrect password.";
    }
  } catch (err) {
    console.log(err);
  }
}

async function resetApp() {
  const result = await window.api.invoke("app-delete-user-data", {});
}

onMounted(() => {});
</script>

<style scoped>
.bg {
  background-color: rgb(239, 239, 239);
}
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

.reset-div {
  position: fixed;
  right: 10px;
  bottom: 10px;
  color: #a1a1a1;
}

.reset-div:hover {
  color: red;
}
</style>
