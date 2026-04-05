import config from '@antfu/eslint-config'
import maxLinesBaseline from './eslint.max-lines-baseline.mjs'

const maxLinesRule = [
  'error',
  {
    max: 200,
    skipBlankLines: false,
    skipComments: false
  }
]

const maxLinesTestRule = [
  'error',
  {
    max: 500,
    skipBlankLines: false,
    skipComments: false
  }
]

export default config(
  {
    ignores: [
      '**/*.d.ts',
      'apps/cli/src/**/*.js',
      'apps/cli/__tests__/**/*.js',
      'apps/server/src/**/*.js',
      'apps/server/__tests__/**/*.js',
      'packages/core/src/**/*.js',
      'packages/core/__tests__/**/*.js',
      'packages/channels/lark/src/**/*.js',
      'packages/adapters/codex/src/**/*.js',
      'packages/adapters/codex/__tests__/**/*.js',
      'packages/adapters/opencode/src/**/*.js',
      'packages/adapters/opencode/__tests__/**/*.js'
    ],
    stylistic: false,
    rules: {
      'max-lines': maxLinesRule,
      'perfectionist/sort-named-exports': 'off',
      'perfectionist/sort-named-imports': 'off'
    },
    typescript: {
      overrides: {
        'ts/no-namespace': 'off',
        'ts/no-empty-object-type': 'off',
        'ts/method-signature-style': 'off',
        'ts/no-use-before-define': 'off',
        'ts/ban-ts-comment': 'off',
        'ts/no-wrapper-object-types': 'off',
        'ts/no-unsafe-function-type': 'off',
        'ts/no-redeclare': 'off',

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
  {
    files: [
      '**/__tests__/**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}',
      '**/*.{spec,test}.{cjs,cts,js,jsx,mjs,mts,ts,tsx}',
      'packages/*/tests/**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'
    ],
    rules: {
      'max-lines': maxLinesTestRule
    }
  },
  {
    files: maxLinesBaseline,
    rules: {
      'max-lines': 'off'
    }
  },
  // test, script and config files
  {
    files: [
      'packages/*/tests/**/*.{js,ts,tsx}',
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
