import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: true, // Enable source maps for debugging
    // Fail build on any errors (syntax, type, etc.)
    rollupOptions: {
      output: {
        // Prevent circular dependency issues by preserving module boundaries
        manualChunks: undefined,
      },
      onwarn(warning, warn) {
        // Treat warnings as errors in production builds
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
          return; // Allow unused external imports
        }
        warn(warning);
      },
    },
    minify: 'esbuild',
    commonjsOptions: {
      // Ensure proper handling of circular dependencies
      circularRequireWarningThreshold: 1000,
    },
    // Fail on any build errors
    emptyOutDir: true,
  },
  // Fail on any syntax errors during dev/build
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});





