import { createRouter, createWebHashHistory } from "vue-router";
import ModelsView from "./views/ModelsView.vue";
import SessionsView from "./views/SessionsView.vue";
import SettingsView from "./views/SettingsView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/models" },
    { path: "/models", component: ModelsView },
    { path: "/sessions", component: SessionsView },
    { path: "/settings", component: SettingsView },
  ],
});
