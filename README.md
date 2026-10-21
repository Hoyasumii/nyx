# Nyx

**Your slides, on stage.** Drop a PDF or PPTX and present it fullscreen right in the browser.
No account, no upload: the file is read locally and never leaves your computer.

🌙 https://nyx.hoyasumii.dev/en/ · in Portuguese: https://nyx.hoyasumii.dev/

![Nyx](public/og-en.png)

## Tech stack

[![Tech stack](https://skill-icons.alanreisanjo.workers.dev/icons?i=ts,html,css,vite,vitest,playwright,nodejs,ghactions&tint=ffd58a&bg=dark)](https://skill-icons.alanreisanjo.workers.dev)

Also uses [pdf.js](https://mozilla.github.io/pdf.js/) for PDF rendering and [JSZip](https://stuk.github.io/jszip/) to read PPTX files.

## Features

- **PDF** rendered with [pdf.js](https://mozilla.github.io/pdf.js/), sharp at any resolution.
- **PPTX** parsed by a custom renderer (`src/deck/pptx`): themes, layouts and masters,
  text with style inheritance, bullets, preset and freeform shapes, cropped images,
  groups, tables (including PowerPoint's built-in table styles), solid, gradient and image backgrounds,
  and SmartArt diagrams.
- **Fullscreen presentation mode**: the cursor becomes a small spotlight that lights up the slide
  behind it without hiding the content.
- Thumbnails, slide grid, touch gestures and keyboard shortcuts
  (`→` `Space` `←` `Home` `End` `F` `G` `B` `Esc`).

PowerPoint animations, videos and native charts are not played back; for full fidelity, export to PDF.

## Development

```bash
npm install
npm run dev        # local server at http://localhost:5173/
npm test           # unit tests (vitest)
npm run build      # typecheck + production build into dist/
```

### Languages

The site is available in Portuguese (`/`) and English (`/en/`). Strings live in `src/i18n/pt.ts` and `src/i18n/en.ts`
(typed by `src/i18n/messages.ts`), and each locale is configured in `src/i18n/locales.ts`.
`index.html` is a single template: at build time (and during `npm run dev`), the `scripts/vite-i18n.ts` plugin generates
one static page per locale, each with its own `lang`, metadata, OpenGraph, `hreflang` and JSON-LD.
Use `{{ key.path }}` for escaped text and `{{{ key.path }}}` for HTML. In the browser,
`src/i18n/index.ts` reads the page's `lang` and exposes the viewer and error messages.

To add a language: create the dictionary, register it in `locales.ts`, add its card to
`scripts/render-assets.mjs` and its URL to `public/sitemap.xml`.

### OpenGraph image and icons

`public/og.png` (Portuguese), `public/og-en.png` (English) and the PNG icons are generated from
`scripts/og/og.html` and `public/logo.svg`:

```bash
npx playwright install chromium   # once
npm run assets                    # or CHROMIUM_PATH=/path/to/chrome npm run assets
```

## Deployment

The `.github/workflows/deploy.yml` workflow publishes to GitHub Pages on every push to `main`.
Under **Settings → Pages**, select **Source: GitHub Actions**.

The site is served at the root of the `nyx.hoyasumii.dev` domain (`base` in `vite.config.ts`, domain in `public/CNAME`). Absolute SEO URLs come from
`VITE_SITE_URL` in `.env`; if the domain changes, also update `public/CNAME`, `public/robots.txt` and `public/sitemap.xml`.
