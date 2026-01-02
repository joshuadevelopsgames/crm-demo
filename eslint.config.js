import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  { 
    ignores: [
      'dist/**',
      'node_modules/**',
      'build/**',
      'android/**',
      'ios/**',
      '*.config.js',
      'scripts/**',
      '**/*.test.js',
      '**/*.spec.js',
      // Utility scripts that don't need strict linting
      'analyze-*.js',
      'compare-*.js',
      'test-*.js',
      'fix-*.js',
      'backfill-*.js',
      'check-*.js',
      'diagnose-*.js',
      'investigate-*.js',
      'verify-*.js',
      'EXAMPLE_*.jsx',
      'test_*.js',
    ] 
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: '18.2',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Syntax errors - these will fail the build
      'no-unreachable': 'error',
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        // Allow unused vars in catch blocks (common pattern)
        args: 'after-used',
      }],
      'no-undef': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'error',
      'no-extra-semi': 'error',
      'no-func-assign': 'error',
      'no-inner-declarations': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'error',
      'no-unexpected-multiline': 'error',
      'no-unreachable-loop': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      
      // React-specific syntax errors
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // Common mistakes that cause runtime errors
      'no-console': 'off', // Allow console for debugging
      'no-debugger': 'error',
      'no-constant-condition': 'off', // Allow if(false) for disabled code blocks
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-imports': 'error',
      'no-empty-character-class': 'error',
      'no-ex-assign': 'error',
      'no-extra-boolean-cast': 'error',
      'no-extra-parens': ['error', 'functions'],
      'no-fallthrough': 'error',
      'no-global-assign': 'error',
      'no-import-assign': 'error',
      'no-misleading-character-class': 'error',
      'no-prototype-builtins': 'error',
      'no-redeclare': 'error',
      'no-self-assign': 'error',
      'no-shadow-restricted-names': 'error',
      'no-this-before-super': 'error',
      'no-this-before-super': 'error',
      'no-useless-catch': 'error',
      'no-useless-escape': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'require-yield': 'error',
    },
  },
];

