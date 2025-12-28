import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  // Critical for Electron production (file://): make asset URLs relative
  base: './',
});
