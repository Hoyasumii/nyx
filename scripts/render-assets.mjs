// Renders the Open Graph card and PNG icons from the SVG sources in /public.
// Usage: npm run assets   (set CHROMIUM_PATH if Playwright's browser isn't installed)
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });

// Open Graph / Twitter card.
await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(pathToFileURL(path.join(root, 'scripts/og/og.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(publicDir, 'og.png') });

// Square icons: the favicon mark on a full-bleed background, with breathing
// room so platforms that mask icons into circles don't clip the crescent.
const mark = await readFile(path.join(publicDir, 'logo.svg'), 'utf8');
const icons = [
  { file: 'favicon-32.png', size: 32, rounded: true },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
  { file: 'icon-192.png', size: 192, rounded: false },
  { file: 'icon-512.png', size: 512, rounded: false },
];
for (const { file, size, rounded } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const inset = rounded ? 0 : Math.round(size * 0.14);
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;background:#0d0c0b;border-radius:${rounded ? size * 0.23 : 0}px;display:grid;place-items:center">
      <div style="width:${size - inset * 2}px;height:${size - inset * 2}px">${mark.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body>`);
  await page.screenshot({ path: path.join(publicDir, file), omitBackground: true });
}

await browser.close();
console.log('Rendered og.png and icons into public/.');
