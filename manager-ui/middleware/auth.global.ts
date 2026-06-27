import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const isAuthRoute = to.path === "/login";
  if (!auth.isAuthenticated && !isAuthRoute) return navigateTo("/login");
  if (auth.isAuthenticated && isAuthRoute) return navigateTo("/domains");
});
