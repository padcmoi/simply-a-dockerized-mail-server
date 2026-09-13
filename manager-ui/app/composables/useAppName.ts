export function useAppName() {
  return clampAppName(useRuntimeConfig().public.appName);
}
