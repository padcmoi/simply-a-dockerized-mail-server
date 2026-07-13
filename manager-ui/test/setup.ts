import * as vue from "vue";
import { vi } from "vitest";

// Nuxt auto-imports Vue's reactivity APIs; expose the REAL ones as globals so
// composables that call ref/computed/watch/etc. work unchanged under vitest.
const VUE_GLOBALS = [
  "ref",
  "computed",
  "reactive",
  "readonly",
  "watch",
  "watchEffect",
  "toRef",
  "toRefs",
  "toValue",
  "unref",
  "isRef",
  "shallowRef",
  "shallowReactive",
  "nextTick",
  "onMounted",
  "onBeforeMount",
  "onUnmounted",
  "onBeforeUnmount",
  "onScopeDispose",
  "provide",
  "inject",
  "h",
  "resolveComponent",
  "defineComponent",
  "markRaw",
  "effectScope",
] as const;
for (const k of VUE_GLOBALS) vi.stubGlobal(k, (vue as unknown as Record<string, unknown>)[k]);

// Default Nuxt/VueUse auto-import stubs. A test that needs specific behaviour
// overrides the relevant one with vi.stubGlobal at its top.
vi.stubGlobal("useI18n", () => ({
  t: (k: string, params?: Record<string, unknown>) => (params ? `${k}:${JSON.stringify(params)}` : k),
  te: () => true,
  locale: vue.ref("en_EN"),
  locales: vue.ref([]),
}));
vi.stubGlobal("navigateTo", vi.fn());
vi.stubGlobal("useRoute", () => ({ path: "/", params: {}, query: {}, fullPath: "/" }));
vi.stubGlobal("useRouter", () => ({ push: vi.fn(), replace: vi.fn(), currentRoute: vue.ref({ fullPath: "/" }) }));
vi.stubGlobal("useRuntimeConfig", () => ({ public: {} }));
vi.stubGlobal("useState", (_k: string, init?: () => unknown) => vue.ref(init ? init() : undefined));
vi.stubGlobal("useCookie", () => vue.ref(null));
vi.stubGlobal("useLocalStorage", (_k: string, init: unknown) => vue.ref(init));
vi.stubGlobal("useToast", () => ({ add: vi.fn() }));
vi.stubGlobal("useNuxtApp", () => ({ $fetch: vi.fn() }));
vi.stubGlobal("useRequestHeaders", () => ({}));
vi.stubGlobal("useHead", vi.fn());
vi.stubGlobal("definePageMeta", vi.fn());
vi.stubGlobal("defineNuxtRouteMiddleware", (fn: unknown) => fn);
vi.stubGlobal("$fetch", vi.fn());
vi.stubGlobal("useDebounceFn", (fn: (...a: unknown[]) => unknown) => fn);
vi.stubGlobal("useThrottleFn", (fn: (...a: unknown[]) => unknown) => fn);
vi.stubGlobal("useMediaQuery", () => vue.ref(false));
vi.stubGlobal("useEventListener", vi.fn());
vi.stubGlobal("useColorMode", () => vue.reactive({ value: "dark", preference: "dark" }));
vi.stubGlobal("useAsyncData", (_k: string, handler?: () => unknown) => ({
  data: vue.ref(null),
  status: vue.ref("idle"),
  pending: vue.ref(false),
  error: vue.ref(null),
  refresh: vi.fn(async () => handler?.()),
  execute: vi.fn(),
}));
