import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }

            if (id.includes('@supabase') || id.includes('@supabase/ssr')) {
              return 'supabase-vendor';
            }

            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }

            if (id.includes('react')) {
              return 'react-vendor';
            }
          }

          if (id.includes('/src/components/')) {
            return 'app-components';
          }

          if (id.includes('/src/pages/')) {
            return 'app-pages';
          }

          return undefined;
        }
      }
    }
  }
});
