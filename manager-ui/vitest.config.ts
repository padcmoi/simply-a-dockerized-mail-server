import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Deliberately NOT @nuxt/test-utils / component rendering: with a component
// library like Nuxt UI the rendered-DOM mocks are unreliable, so this suite
// covers pure logic only (composables, stores, utils). Nuxt's auto-imports are
// provided as globals in test/setup.ts instead of booting a Nuxt runtime.
export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["app/composables/**", "app/stores/**", "app/utils/**"],
      reporter: ["text-summary", "text"],
    },
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
      "@": fileURLToPath(new URL("./app", import.meta.url)),
      "~~": fileURLToPath(new URL(".", import.meta.url)),
      "@@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
