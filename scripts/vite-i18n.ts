import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { DEFAULT_LOCALE, locales, type Locale, type LocaleInfo } from '../src/i18n/locales';

/**
 * Builds one static page per locale from the single `index.html` template, so
 * crawlers and link previews get each language's own text, Open Graph card and
 * hreflang links without running JavaScript.
 *
 * In the template, `{{ key.path }}` inserts an escaped message and
 * `{{{ key.path }}}` inserts it as HTML. `page.*` holds per-locale values
 * computed here (URLs, alternate links, JSON-LD).
 */
export function i18nPages(siteUrl: string): Plugin {
  let root = process.cwd();
  const others = (Object.keys(locales) as Locale[]).filter((key) => key !== DEFAULT_LOCALE);
  // Entry file of each non-default locale, e.g. `en/index.html`. These don't
  // exist on disk: they are served from the template.
  const entryOf = (key: Locale) => path.join(root, locales[key].path, 'index.html');
  const localeOfPath = (urlPath: string): Locale =>
    others.find((key) => urlPath.startsWith(locales[key].path)) ?? DEFAULT_LOCALE;
  const template = () => readFile(path.join(root, 'index.html'), 'utf8');

  return {
    name: 'nyx:i18n-pages',
    enforce: 'pre',

    config(config) {
      root = path.resolve(config.root ?? process.cwd());
      const input: Record<string, string> = { main: path.join(root, 'index.html') };
      for (const key of others) input[key] = entryOf(key);
      return { build: { rollupOptions: { input } } };
    },

    resolveId(id) {
      return others.some((key) => entryOf(key) === id) ? id : null;
    },

    load(id) {
      return others.some((key) => entryOf(key) === id) ? template() : null;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const key = others.find((k) => {
          const base = locales[k].path;
          return url === base || url === base.slice(0, -1) || url === `${base}index.html`;
        });
        if (!key) return next();
        if (!url.endsWith('/') && !url.endsWith('.html')) {
          res.writeHead(301, { Location: locales[key].path }).end();
          return;
        }
        try {
          const html = await server.transformIndexHtml(`${locales[key].path}index.html`, await template(), req.originalUrl);
          res.setHeader('Content-Type', 'text/html; charset=utf-8').end(html);
        } catch (error) {
          next(error);
        }
      });
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return render(html, localeOfPath(ctx.path), siteUrl);
      },
    },
  };
}

function render(html: string, key: Locale, siteUrl: string): string {
  const info = locales[key];
  const scope = { ...info.messages, page: pageValues(key, siteUrl) };
  return html.replace(/\{\{(\{)?\s*([\w.]+)\s*\}?\}\}/g, (_, raw: string | undefined, name: string) => {
    const value = name.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], scope);
    if (typeof value !== 'string') throw new Error(`[i18n] "${name}" is not a string in locale "${key}".`);
    return raw ? value : escapeHtml(value);
  });
}

function pageValues(key: Locale, siteUrl: string) {
  const info = locales[key];
  const all = Object.entries(locales) as [Locale, LocaleInfo][];
  const url = siteUrl + info.path;
  const m = info.messages;

  const alternates = [
    ...all.map(([, l]) => `<link rel="alternate" hreflang="${l.lang}" href="${siteUrl}${l.path}" />`),
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}${locales[DEFAULT_LOCALE].path}" />`,
  ].join('\n    ');

  const ogLocaleAlternates = all
    .filter(([k]) => k !== key)
    .map(([, l]) => `<meta property="og:locale:alternate" content="${l.ogLocale}" />`)
    .join('\n    ');

  const languages = all
    .map(([k, l]) =>
      k === key
        ? `<span aria-current="true">${k.toUpperCase()}</span>`
        : `<a href="${l.path}" hreflang="${l.lang}" lang="${l.lang}" title="${l.name}">${k.toUpperCase()}</a>`,
    )
    .join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Nyx',
        url,
        image: siteUrl + '/' + info.ogImage,
        description: m.meta.appDescription,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        inLanguage: info.lang,
        browserRequirements: 'Requires JavaScript',
        offers: { '@type': 'Offer', price: '0', priceCurrency: m.meta.priceCurrency },
      },
      {
        '@type': 'FAQPage',
        inLanguage: info.lang,
        mainEntity: m.faq.items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer.replace(/<[^>]+>/g, '') },
        })),
      },
    ],
  };

  return {
    lang: info.lang,
    ogLocale: info.ogLocale,
    url,
    home: info.path,
    ogImage: siteUrl + '/' + info.ogImage,
    alternates,
    ogLocaleAlternates,
    languages,
    // `<` is escaped so no message can close the script element.
    jsonLd: JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c').replace(/\n/g, '\n    '),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
