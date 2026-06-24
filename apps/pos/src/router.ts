import { createRouter, createWebHashHistory } from "vue-router";
import { salesUnlocked } from "./auth";

// Hash history so the SPA works from file:// once wrapped (Tauri/Electron).
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "till", component: () => import("./views/TillView.vue") },
    {
      path: "/dashboard",
      name: "sales",
      component: () => import("./views/SalesView.vue"),
      // Manager-only: blocked unless unlocked via the passcode on the Menu.
      beforeEnter: () => (salesUnlocked.value ? true : { path: "/" }),
    },
    { path: "/item", name: "admin", component: () => import("./views/AdminView.vue") },
    { path: "/report", name: "report", component: () => import("./views/ReportView.vue") },
  ],
});
