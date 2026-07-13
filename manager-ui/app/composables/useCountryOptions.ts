// All countries as { value, label, sortKey }, localized name + flag emoji, sorted
// by name. value = the canonical English name so what is stored stays stable
// across UI locales and geocodes reliably (see GeocodingService). The app's
// locale codes use an underscore (`fr_FR`); Intl needs a BCP 47 tag (`fr-FR`), so
// convert -- an underscore tag makes the Intl.DisplayNames constructor throw and
// would blank the whole form. Wrapped defensively so an unknown tag can never
// break render. Shared by the profile page and the admin account edit page.
export function useCountryOptions() {
  const { locale } = useI18n();
  return computed(() => {
    const uiLocale = locale.value.replace(/_/g, "-");
    let enNames: Intl.DisplayNames | null = null;
    let localNames: Intl.DisplayNames | null = null;
    try {
      enNames = new Intl.DisplayNames(["en"], { type: "region" });
      localNames = new Intl.DisplayNames([uiLocale], { type: "region" });
    } catch {
      enNames = null;
      localNames = null;
    }
    return COUNTRY_CODES.map((code) => {
      const name = localNames?.of(code) ?? code;
      return { value: enNames?.of(code) ?? code, label: `${countryFlagEmoji(code)} ${name}`, sortKey: name };
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey, uiLocale));
  });
}
