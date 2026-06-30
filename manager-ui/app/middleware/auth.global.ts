import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const isAuthRoute = to.path === "/login";
  const isPublicRoute = to.path.startsWith("/invite/");
  if (!auth.isAuthenticated && !isAuthRoute && !isPublicRoute) return navigateTo("/login");
  if (auth.isAuthenticated && isAuthRoute) return navigateTo("/domains");
  if (auth.isAuthenticated && to.path === "/accounts" && !auth.session?.isRoot) return navigateTo("/dashboard");
});
