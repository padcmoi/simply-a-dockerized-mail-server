export const APP_NAME_DEFAULT = "Simply Mail Server";
export const APP_NAME_MAX = 24;

export function appName(): string {
  const raw = (process.env.MANAGER_APP_NAME ?? "").trim();
  return (raw || APP_NAME_DEFAULT).slice(0, APP_NAME_MAX);
}
