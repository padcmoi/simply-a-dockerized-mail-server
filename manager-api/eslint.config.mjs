import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// Bans the type-defeating assertions that used to silence the specs. `as never`
// has no legitimate use here; `as unknown` is the inner half of an `as unknown as X`
// double assertion. Both are how a wrong mock shape or DTO slipped past the type
// checker. The typed helpers in test/helpers/ replace them (and are the one place
// allowed to contain a bridging cast, so that folder is exempt below).
const NO_TYPE_LAUNDERING = [
  {
    selector: "TSAsExpression > TSNeverKeyword",
    message: "Do not use `as never` in a spec. Use the typed mock helpers in test/helpers/mocks.ts.",
  },
  {
    selector: "TSAsExpression > TSUnknownKeyword",
    message: "Do not launder types through `as unknown as ...` in a spec. Use the typed mock helpers in test/helpers/mocks.ts.",
  },
];

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // tsconfig.eslint.json extends tsconfig.json but also includes test/,
        // so typed linting covers the vitest specs (the build tsconfig stays
        // src-only; tsconfig.spec.json is what `npm run typecheck` uses for tests).
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module",
      },
      globals: { node: true, vitest: true, vi: true, describe: true, it: true, expect: true, beforeAll: true, afterAll: true, beforeEach: true, afterEach: true },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Specs are held to the same bar as src: no `any`, and no assertion that
    // launders a type past the checker. The typed doubles in test/helpers/ make
    // both unnecessary.
    files: ["test/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...NO_TYPE_LAUNDERING],
    },
  },
  {
    // The shared test helpers are the single place allowed to bridge a mock to
    // the real dependency type, so the cast ban does not apply to them.
    files: ["test/helpers/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
