import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const isAuthRoute = to.path === "/login";
  const isPublicRoute = to.path.startsWith("/invite/");
  if (!auth.isAuthenticated && !isAuthRoute && !isPublicRoute) return navigateTo("/login");
  if (auth.isAuthenticated && isAuthRoute) return navigateTo("/dashboard");
  if (auth.isAuthenticated && to.path.startsWith("/accounts") && !auth.session?.isRoot) return navigateTo("/dashboard");
});
