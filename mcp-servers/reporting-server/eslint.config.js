const skyfire = require('@skyfire-xyz/eslint-config-node')

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  ...skyfire,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
      }
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          // This project compiles as CJS, so resolve package exports the way tsc
          // does (require/node). The default condition list tries `types` first,
          // which the MCP SDK maps to `dist/esm/*.d.ts` -- a path that does not
          // exist for its `.js`-suffixed deep imports.
          conditionNames: ['require', 'node', 'default']
        }
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/__fixtures__/*.ts',
            '**/__tests__/**/*.ts',
            '**/*.test.ts'
          ]
        }
      ],
      'import/order': 'warn',
      // Express middleware and pino serializers set properties on req and res
      // by design; still disallow reassigning the parameters themselves.
      'no-param-reassign': ['error', { props: false }]
    }
  },
  {
    // convict takes constructors such as `String` as `format` validators.
    files: ['src/config.ts'],
    rules: { '@typescript-eslint/strict-void-return': 'off' }
  }
]
