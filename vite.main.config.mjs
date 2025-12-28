import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  return {
    // Bundle tmi.js (and ws). Provide JS shims for ws optional native deps so Vite doesn't
    // inject runtime "Could not resolve" throws when those packages aren't installed.
    resolve: {
      alias: {
        bufferutil: path.resolve('src/main/shims/bufferutil.js'),
        'utf-8-validate': path.resolve('src/main/shims/utf-8-validate.js'),
      },
    },
    build: {
      rollupOptions: {
        external: (id) => {
          if (id === 'electron' || id.startsWith('node:')) return true;
          return false;
        },
      },
    },
  };
});
