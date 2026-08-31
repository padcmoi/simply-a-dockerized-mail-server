// A locale as the switcher offers it.

export interface LocaleOption {
  value: string;
  // Flag emoji. For "system" it is the flag of the browser-detected locale, so
  // the option shows what it currently resolves to (like the trigger button).
  flag: string;
  // Display name for a concrete locale; null for "system" (caller localizes it).
  name: string | null;
}
