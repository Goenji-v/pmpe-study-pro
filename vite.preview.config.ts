import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// A static-only artifact: no account providers, API server, production assets
// or Supabase environment variables are imported by this entry point.
export default defineConfig({
  root: fileURLToPath(new URL('./preview', import.meta.url)),
  publicDir: false,
  plugins: [react()],
  build: { outDir: '../dist-preview', emptyOutDir: true },
});
