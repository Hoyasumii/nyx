import { defineConfig, loadEnv } from 'vite';
import { i18nPages } from './scripts/vite-i18n';

// Served from https://nyx.hoyasumii.dev/ (GitHub Pages custom domain).
// Portuguese lives at the root and English under /en/, both built from index.html.
export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [i18nPages(loadEnv(mode, process.cwd()).VITE_SITE_URL ?? '')],
  build: {
    target: 'es2022',
  },
}));
