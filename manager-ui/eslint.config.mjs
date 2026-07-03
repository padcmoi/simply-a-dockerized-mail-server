// @ts-nocheck
import withNuxt from "./.nuxt/eslint.config.mjs";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import defineMacrosOrderFixed from "./eslint/rules/defineMacrosOrderFixed.mjs";
import noDefinePageMetaOutsidePages from "./eslint/rules/noDefinePageMetaOutsidePages.mjs";
import requireDefinePageMetaInPages from "./eslint/rules/requireDefinePageMetaInPages.mjs";

const scriptSetupOrder = [
  "definePageMeta",
  "defineEmits",
  "defineOptions",
  "defineModel",
  "defineSlots",
  "defineProps",

  "ref",
  "shallowRef",
  "readonly",
  "shallowReadonly",
  "reactive",
  "shallowReactive",

  "computed",

  "provide",
  "inject",

  // "use*" disabled: not practical here, some composables need to be called at different points rather than strictly at setup top-level.

  "watch",
  "watchEffect",
  "watchPostEffect",
  "watchSyncEffect",

  "onBeforeMount",
  "onMounted",
  "onBeforeUpdate",
  "onUpdated",
  "onBeforeUnmount",
  "onUnmounted",
  "onActivated",
  "onDeactivated",
  "onErrorCaptured",
  "onServerPrefetch",
];

const noRestrictedSyntax = [
  {
    selector: ":matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)[returnType]",
    message: "Explicit return type annotations are forbidden. Rely on inference.",
  },
  {
    selector: "MethodDefinition[value.returnType]",
    message: "Explicit return type annotations on methods are forbidden. Rely on inference.",
  },
  {
    selector: "Property[value.type=/Function/][value.returnType]",
    message: "Explicit return type annotations on object methods are forbidden. Rely on inference.",
  },
  {
    selector:
      "ImportDeclaration[importKind!='type'] > ImportSpecifier[importKind!='type'] + ImportSpecifier[importKind!='type'] + ImportSpecifier[importKind!='type']",
    message: "Named imports are limited to 2 per import declaration. Split imports or use default/namespace import.",
  },
  {
    selector:
      "Program > :matches(FunctionDeclaration, VariableDeclaration:has(VariableDeclarator[init.type='ArrowFunctionExpression']), VariableDeclaration:has(VariableDeclarator[init.type='FunctionExpression'])) ~ ExpressionStatement:has(CallExpression[callee.name=/^watch(?:Effect|PostEffect|SyncEffect)?$/])",
    message: "watch/watchEffect/watchPostEffect/watchSyncEffect must be above top-level functions.",
  },
  {
    selector:
      "Program > ExpressionStatement:has(CallExpression[callee.name=/^on(?:BeforeMount|Mounted|BeforeUpdate|Updated|BeforeUnmount|Unmounted|Activated|Deactivated|ErrorCaptured|ServerPrefetch)$/]) ~ :matches(FunctionDeclaration, VariableDeclaration:has(VariableDeclarator[init.type='ArrowFunctionExpression']), VariableDeclaration:has(VariableDeclarator[init.type='FunctionExpression']))",
    message: "Top-level functions must be above lifecycle hooks.",
  },
];

const noUnusedVarsConfig = [
  "warn",
  {
    args: "all",
    argsIgnorePattern: "^_",
    caughtErrors: "all",
    caughtErrorsIgnorePattern: "^_",
    destructuredArrayIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    ignoreRestSiblings: true,
  },
];

export default withNuxt(
  {
    name: "gestlok/ignores",
    ignores: [".nuxt/**", ".output/**", "node_modules/**", "dist/**", ".trash/**", "api/**"],
  },
  {
    name: "gestlok/rules-ts",
    files: ["app/**/*.{ts,tsx}", "server/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": noUnusedVarsConfig,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
      "no-restricted-syntax": ["error", ...noRestrictedSyntax],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "warn",
      "no-unreachable": "error",
      "no-empty-pattern": "warn",
      "no-constant-condition": "warn",
    },
  },
  {
    name: "gestlok/rules-vue-manager-html-self-closing-off",
    files: ["manager/app/**/*.vue"],
    rules: {
      "vue/html-self-closing": "off",
    },
  },
  {
    name: "gestlok/rules-vue",
    files: ["app/**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      gestlok: {
        rules: {
          "define-macros-order": defineMacrosOrderFixed,
          "no-define-page-meta-outside-pages": noDefinePageMetaOutsidePages,
          "require-define-page-meta-in-pages": requireDefinePageMetaInPages,
        },
      },
    },
    rules: {
      "no-unused-vars": noUnusedVarsConfig,
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "vue/define-macros-order": "off",
      "gestlok/define-macros-order": ["error", { order: scriptSetupOrder, defineExposeLast: true }],
      "gestlok/no-define-page-meta-outside-pages": "error",
      "gestlok/require-define-page-meta-in-pages": "error",
      "vue/block-order": ["error", { order: ["script", "template", "style"] }],
      "vue/no-mutating-props": "error",
      "vue/require-default-prop": "error",
      "no-restricted-syntax": ["error", ...noRestrictedSyntax],
      "vue/html-self-closing": [
        "warn",
        {
          html: { void: "always", normal: "always", component: "always" },
          svg: "always",
          math: "always",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "warn",
      "no-unreachable": "error",
      "no-empty-pattern": "warn",
      "no-constant-condition": "warn",
    },
  }
);
