import { defineConfig } from 'vite';

// Served from https://<user>.github.io/nyx/ on GitHub Pages.
export default defineConfig({
  base: '/nyx/',
  build: {
    target: 'es2022',
  },
});
