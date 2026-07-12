import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const { remember, resolve } = useLastRoute();
  const isAuthRoute = to.path === "/login";
  const isPublicRoute = to.path.startsWith("/invite/");
  if (!auth.isAuthenticated && !isAuthRoute && !isPublicRoute) return navigateTo("/login");
  // Reconnecting (or landing on /login while already authenticated): go back to
  // the last protected route instead of always the dashboard.
  if (auth.isAuthenticated && isAuthRoute) return navigateTo(resolve());
  if (auth.isAuthenticated && to.path.startsWith("/accounts") && !auth.session?.isRoot) return navigateTo("/dashboard");

  // Passed every guard: an authenticated user staying on a protected route.
  // Remember it (client only -- localStorage) so a later re-login returns here.
  if (import.meta.client && auth.isAuthenticated && !isAuthRoute && !isPublicRoute) {
    remember(to.fullPath);
  }
});
