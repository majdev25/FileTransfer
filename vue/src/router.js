import { createMemoryHistory, createRouter } from "vue-router";

import AddFriend from "./views/friends/AddFriend.vue";

const routes = [
  { path: "/", component: AddFriend },
  {
    path: "/confirm-incoming-friend",
    component: () => import("./views/friends/ConfirimIncomingFriend.vue"),
  },
  {
    path: "/friends",
    component: () => import("./views/friends/Friends.vue"),
  },
  {
    path: "/send-file",
    component: () => import("./views/File/SendFile.vue"),
  },
  {
    path: "/confirm-incoming-fileTransfer",
    component: () => import("./views/File/ConfirmFileTrasfer.vue"),
  },
  {
    path: "/settings",
    component: () => import("./views/Settings.vue"),
  },
];

const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
