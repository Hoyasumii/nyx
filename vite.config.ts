import { defineConfig } from 'vite';

// Served from https://nyx.hoyasumii.dev/ (GitHub Pages custom domain).
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
  },
});
