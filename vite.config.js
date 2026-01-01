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
    rollupOptions: {
      output: {
        // Prevent circular dependency issues by preserving module boundaries
        manualChunks: undefined,
      },
      // Disable tree-shaking for base44Client to avoid static analysis issues
      treeshake: {
        moduleSideEffects: (id) => {
          if (id.includes('base44Client')) {
            return true; // Mark as having side effects to prevent tree-shaking
          }
          return false;
        },
      },
    },
    minify: 'esbuild',
    commonjsOptions: {
      // Ensure proper handling of circular dependencies
      circularRequireWarningThreshold: 1000,
    },
  },
});





