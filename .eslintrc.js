module.exports = {
  root: true,
  extends: 'standard',
  env: {
    node: true,
    es6: true
  },
  globals: {
    ContractError: 'readonly',
    ContractAssert: 'readonly',
    SmartWeave: 'readonly',
    BigNumber: 'readonly'
  },
  overrides: [{
    files: ['src/**/*.ts'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: './tsconfig.json'
    },
    extends: 'standard-with-typescript',
    rules: {
      '@typescript-eslint/promise-function-async': 0,
      '@typescript-eslint/restrict-template-expressions': 0,
      '@typescript-eslint/strict-boolean-expressions': 0,
      '@typescript-eslint/explicit-function-return-type': 0,
      '@typescript-eslint/prefer-optional-chain': 0,
      'no-prototype-builtins': 0,
      '@typescript-eslint/no-var-requires': 0,
      '@typescript-eslint/restrict-plus-operands': 0,
      '@typescript-eslint/prefer-nullish-coalescing': 0,
      '@typescript-eslint/no-non-null-assertion': 0
    }
  }]
}
