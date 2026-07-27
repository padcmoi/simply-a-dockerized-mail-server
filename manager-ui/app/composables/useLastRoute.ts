// Remembers the last PROTECTED route the user was on, in localStorage, so that a
// re-login -- whether after a dropped/expired session or a manual logout --
// returns them exactly where they were instead of the personal space.
//
// Only ever written for authenticated, non-login, non-public routes (see
// auth.global.ts), so the stored value is always a safe auth-gated target and
// can't send the user into a login loop. `resolve()` additionally refuses to
// return `/login` and falls back to the personal space, as a belt-and-suspenders
// guard against ever bouncing back to the login page.
const LAST_ROUTE_STORAGE_KEY = "manager-last-route";
const FALLBACK_ROUTE = "/my-space";

export function useLastRoute() {
  const lastRoute = useLocalStorage(LAST_ROUTE_STORAGE_KEY, FALLBACK_ROUTE);

  function remember(path: string) {
    if (!path || path === "/login" || path.startsWith("/login")) return;
    lastRoute.value = path;
  }

  function resolve() {
    const value = lastRoute.value;
    if (!value || value === "/login" || value.startsWith("/login")) return FALLBACK_ROUTE;
    return value;
  }

  return { lastRoute, remember, resolve };
}
