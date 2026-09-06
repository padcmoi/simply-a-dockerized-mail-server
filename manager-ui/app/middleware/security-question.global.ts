import { useAuthStore } from "~/stores/auth";

// An account with no security question can go nowhere but the page that sets
// one: the API refuses almost everything until it has one, so without this the
// interface would draw a dashboard of failed requests. The API's own guard is
// what enforces it; this only makes the refusal legible.
//
// `securityQuestionSet` rides on the session, filled by GET /auth/jwt/me. A
// session persisted before this existed carries `undefined`, which is not
// false: nothing is asked of it until the profile is read again.
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) return;
  if (auth.session?.securityQuestionSet !== false) return;
  if (to.path === "/profile/security-question") return;
  return navigateTo("/profile/security-question");
});
