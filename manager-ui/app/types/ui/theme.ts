// The interface's colours, in two layers and two modes.
//
// The server-wide theme (`app`) is what everyone sees, read by this app's own
// server before the first page is rendered, so the personalisation is already
// there at first paint rather than snapping in after it. An account's own theme
// (`account`) is read at login and laid over it. Both are stored per mode, light
// and dark being two themes rather than two shades of one.
//
// Nothing is seeded anywhere: a token nobody chose is absent, and absence means
// the colour the interface ships with. That is what makes a reset a deletion.
export type ThemeScope = "app" | "account";

export interface StoredTheme extends ThemeView {
  tokens?: { aliases: string[]; surfaces: string[] };
}
