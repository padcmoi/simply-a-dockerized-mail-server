import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// NestJS DI relies on emitDecoratorMetadata, which esbuild (vitest's default
// transform) does not emit. unplugin-swc compiles the tests with swc's legacy
// decorators + decoratorMetadata instead, so Test.createTestingModule resolves
// providers exactly as at runtime. No database, no containers, no network.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: "es2022",
        keepClassNames: true,
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.spec.ts", "test/**/*.e2e-spec.ts", "src/**/*.spec.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/main.ts",
        "src/**/*.module.ts",
        "src/**/*.openapi.ts",
        "src/**/*.entity.ts",
        // Type-only modules: no runtime, so they can only ever report 0%.
        "src/**/*.types.ts",
        "src/core/database/**",
        "src/**/*.d.ts",
      ],
      // The API is the security surface; CI fails if coverage regresses below
      // the required 95% (branches a touch lower, they are always harder).
      thresholds: { statements: 95, lines: 95, functions: 95, branches: 90 },
    },
  },
});
