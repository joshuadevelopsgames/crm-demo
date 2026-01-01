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
    rollupOptions: {
      output: {
        // Prevent circular dependency issues by preserving module boundaries
        manualChunks: undefined,
      },
    },
    minify: 'esbuild',
    commonjsOptions: {
      // Ensure proper handling of circular dependencies
      circularRequireWarningThreshold: 1000,
    },
  },
});





