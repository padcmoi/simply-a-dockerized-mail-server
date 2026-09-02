// A locale as the switcher offers it.

export interface LocaleOption {
  value: string;
  // ISO 3166-1 alpha-2 region code whose flag represents the locale, drawn by
  // <CountryFlag> / countryFlagIcon(). For "system" it is the region of the
  // browser-detected locale, so the option shows what it currently resolves to
  // (like the trigger button).
  flag: string;
  // Display name for a concrete locale; null for "system" (caller localizes it).
  name: string | null;
}
