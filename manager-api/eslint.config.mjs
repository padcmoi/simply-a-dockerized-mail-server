// Flat ESLint config - typescript-eslint v8 + Prettier compat
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // No 'any', enforced lint
      '@typescript-eslint/no-explicit-any': 'error',

      // No explicit function return types - rely on inference
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Common Nest patterns
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Forbid express import (NestJS guards/decorators must derive types from signature)
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'express', message: 'Use NestJS abstractions, not direct express types.' }] },
      ],
    },
  },
);
