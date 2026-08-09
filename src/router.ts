import { createRouter, createWebHashHistory } from "vue-router";
import ModelsView from "./views/ModelsView.vue";
import SessionsView from "./views/SessionsView.vue";
import SettingsView from "./views/SettingsView.vue";
import SkillsView from "./views/SkillsView.vue";
import UsageView from "./views/UsageView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/usage" },
    { path: "/usage", component: UsageView },
    { path: "/models", component: ModelsView },
    { path: "/sessions", component: SessionsView },
    { path: "/skills", component: SkillsView },
    { path: "/settings", component: SettingsView },
  ],
});
