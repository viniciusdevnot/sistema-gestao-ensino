import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // es2022: o leitor de PDF (pdf.js) usa recursos modernos de JavaScript
  build: { outDir: 'dist', chunkSizeWarningLimit: 2500, target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } }
});
