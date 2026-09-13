export const APP_NAME_DEFAULT = "Simply Mail Server";
export const APP_NAME_MAX = 24;

export function clampAppName(raw: unknown) {
  const name = String(raw ?? "").trim();
  return (name || APP_NAME_DEFAULT).slice(0, APP_NAME_MAX);
}
