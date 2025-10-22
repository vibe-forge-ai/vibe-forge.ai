import config from '@antfu/eslint-config'

export default config(
  {
    stylistic: false,
    typescript: {
      tsconfigPath: 'tsconfig.json',
      overrides: {
        'ts/no-namespace': 'off',
        'ts/no-empty-object-type': 'off',
        'ts/method-signature-style': 'off',
        'ts/no-use-before-define': 'off',
        'ts/ban-ts-comment': 'off',
        'ts/no-wrapper-object-types': 'off',
        'ts/no-unsafe-function-type': 'off',

        'import/no-mutable-exports': 'off',
        'perfectionist/sort-imports': 'off',
        'perfectionist/sort-named-imports': 'off'
      }
    },
    javascript: {
      overrides: {
        'unused-imports/no-unused-vars': 'off'
      }
    },
    vue: {
      overrides: {
        'vue/no-v-model-argument': 'off'
      }
    },
    test: {
      overrides: {
        'test/consistent-test-it': 'off'
      }
    }
  },
  // test, script and config files
  {
    files: [
      'packages/*/tests/**/*.{js,ts,tsx}',
      'vitest.config.ts',
      'eslint.config.mjs',
      'vitest.workspace.ts',
      'website/vite.config.ts',
      'scripts/**/*.{js,ts}'
    ],
    rules: {
      'no-console': 'off',
      'ts/strict-boolean-expressions': 'off'
    }
  }
)