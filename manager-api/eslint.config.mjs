import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

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
        // src-only).
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
    // Test files mock complex generic library/repository shapes where `any` is
    // the pragmatic, standard choice; source under src/ stays strict.
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
