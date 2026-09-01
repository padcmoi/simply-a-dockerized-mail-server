export interface PassportProviderOption {
  id: string;
  label: string;
}

/**
 * The external sign-in providers the login screen may offer, and where to send
 * the browser for each. Which providers exist, and whether any exist at all, is
 * the server's answer to give: this asks and draws, it decides nothing.
 *
 * The flow is a full navigation rather than a popup, because that is what
 * Passport's OAuth strategies do: the browser leaves for the provider and comes
 * back on the callback, which redirects to /login carrying a one-time code. The
 * login page is what picks that code up.
 */
export function usePassportProviders() {
  const { data, status } = useAsyncData(
    "passport-providers",
    () => $fetch<PassportProviderOption[]>("/api/v1/auth/passport/providers"),
    {
      server: false,
    }
  );

  const providers = computed(() => data.value ?? []);
  const pending = computed(() => status.value === "pending");

  // `redirect` is the page to come back to once the provider has answered. Left
  // out, the callback lands on /login; the invitation screen passes its own
  // address so the sign-in it started finishes there, on the invitation.
  function startUrl(id: string, redirect?: string) {
    const url = `/api/v1/auth/passport/${encodeURIComponent(id)}`;
    return redirect ? `${url}?redirect=${encodeURIComponent(redirect)}` : url;
  }

  return { providers, pending, startUrl };
}
