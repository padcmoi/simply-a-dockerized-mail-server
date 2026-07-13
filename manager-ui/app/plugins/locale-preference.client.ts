// Apply the saved language preference (see useLocalePreference) once the app is
// mounted. Client-only + `app:mounted` so switching the locale is a plain
// reactive update after hydration rather than a divergence mid-hydration --
// same reasoning as the color-mode preference. The store is localStorage, which
// does not exist on the server anyway.
export default defineNuxtPlugin((nuxtApp) => {
  const { apply } = useLocalePreference();
  nuxtApp.hook("app:mounted", () => {
    void apply();
  });
});
