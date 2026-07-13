# manager-ui test suite

`pnpm test` (vitest). Pure logic only: composables, stores, utils. **No component
rendering, no Playwright** — with Nuxt UI the rendered-DOM mocks are unreliable,
so we test the logic, not the markup.

## Harness

`test/setup.ts` exposes Vue's reactivity (`ref`, `computed`, `watch`, ...) and a
default set of Nuxt/VueUse auto-imports (`useI18n`, `navigateTo`, `useState`,
`useLocalStorage`, `useRoute`, `useAsyncData`, ...) as globals, so a composable
that relies on auto-imports runs unchanged. A test needing specific behaviour
overrides one with `vi.stubGlobal("useI18n", () => ({...}))` at its top.

`vitest.config.ts` aliases `~` and `@` to `app/`. Import as `~/composables/...`,
`~/stores/...`, `~/utils/...`, and `vue` directly.

See `test/example.spec.ts` for the shape (utils, a pure helper, and a composable
that returns a render function — read the returned vnode's `.props`, do not try to
invoke the passed component).

## What to test

- `app/utils/**` — pure, test directly.
- Composables that transform inputs (chart data, occupancy, permission labels,
  api-error mapping, date formatting, sortable headers, last-route, ...). Drive
  their inputs, assert their `computed`/returned values.
- Pinia stores (`app/stores/*`): `setActivePinia(createPinia())` in `beforeEach`,
  then exercise actions/getters. Stub `$fetch`/`useApi` as needed.

Composables that are thin wrappers over `useAsyncData`/Nuxt runtime (list
fetchers, dashboards) are low value to unit test — cover their pure branches if
any, otherwise skip. No strict coverage bar.

## Rules

- Only add files under `test/`. Never edit `vitest.config.ts` or `test/setup.ts`
  (extend behaviour per-test with `vi.stubGlobal`).
- Every spec imports `{ describe, it, expect, vi }` (and hooks) from `vitest`.
- No em dashes. Match the code style.
- Run your files with `npx vitest run <path>` until green.
