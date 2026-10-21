import { DEFAULT_LOCALE, locales, type Locale } from './locales';

/** The page's locale, as stamped into `<html lang>` at build time. */
export const locale: Locale =
  (Object.keys(locales) as Locale[]).find((key) => locales[key].lang === document.documentElement.lang) ?? DEFAULT_LOCALE;

export const t = locales[locale].messages;
