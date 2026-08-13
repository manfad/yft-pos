import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "floor", component: () => import("./views/FloorView.vue") },
    { path: "/dashboard", name: "dashboard", component: () => import("./views/DashboardView.vue") },
    { path: "/menu", name: "menu", component: () => import("./views/MenuSettingsView.vue") }
  ]
});
