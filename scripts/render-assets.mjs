// Renders the Open Graph card and PNG icons from the SVG sources in /public.
// Usage: npm run assets   (set CHROMIUM_PATH if Playwright's browser isn't installed)
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
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
const favicon = await readFile(path.join(publicDir, 'favicon.svg'), 'utf8');
const icons = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];
for (const { file, size } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const inset = Math.round(size * 0.14);
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;background:#0d0c0b;display:grid;place-items:center">
      <div style="width:${size - inset * 2}px;height:${size - inset * 2}px">${mark.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body>`);
  await page.screenshot({ path: path.join(publicDir, file), omitBackground: true });
}

// Tab icons: the bare crescent on a transparent background. Safari outlines
// dark square favicons, so the tab icons skip the tile the app icons use.
// favicon.ico is for browsers that skip the SVG icon: an ICO container holding
// PNG frames, which every current browser reads.
const frames = [];
for (const size of [16, 32, 48]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px">${favicon.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  const png = await page.screenshot({ omitBackground: true });
  if (size === 32) await writeFile(path.join(publicDir, 'favicon-32.png'), png);
  frames.push({ size, png });
}
await writeFile(path.join(publicDir, 'favicon.ico'), toIco(frames));

await browser.close();
console.log('Rendered og.png and icons into public/.');

function toIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);
  let offset = 6 + frames.length * 16;
  const entries = frames.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0);
    entry.writeUInt8(size % 256, 1);
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...frames.map((frame) => frame.png)]);
}
