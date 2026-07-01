import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const domain = useDomainStore();
  const isAuthRoute = to.path === "/login";
  const isPublicRoute = to.path.startsWith("/invite/");
  if (!auth.isAuthenticated && !isAuthRoute && !isPublicRoute) return navigateTo("/login");
  if (auth.isAuthenticated && isAuthRoute) return navigateTo("/dashboard");
  if (auth.isAuthenticated && to.path === "/accounts" && !auth.session?.isRoot) return navigateTo("/dashboard");
  const domainRequired = ["/recipients", "/aliases", "/quotas"];
  if (auth.isAuthenticated && domainRequired.includes(to.path) && !domain.selected) {
    return navigateTo("/domains");
  }
});
