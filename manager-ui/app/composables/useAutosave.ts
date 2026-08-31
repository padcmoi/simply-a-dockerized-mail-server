import { useDebounceFn } from "@vueuse/core";

export function useAutosave(fn: () => void | Promise<void>, delay = 1000) {
  return useDebounceFn(fn, delay);
}
