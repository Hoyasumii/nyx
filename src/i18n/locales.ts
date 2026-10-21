import { en } from './en';
import type { Messages } from './messages';
import { pt } from './pt';

export type Locale = 'pt' | 'en';

export interface LocaleInfo {
  /** BCP 47 tag for `<html lang>` and `hreflang`. */
  readonly lang: string;
  /** Open Graph locale (`og:locale`). */
  readonly ogLocale: string;
  /** Path the locale's page is served from, with a trailing slash. */
  readonly path: string;
  /** Open Graph card in /public. */
  readonly ogImage: string;
  /** Name of the language in itself, for the language switcher. */
  readonly name: string;
  readonly messages: Messages;
}

export const DEFAULT_LOCALE: Locale = 'pt';

export const locales: Record<Locale, LocaleInfo> = {
  pt: { lang: 'pt-BR', ogLocale: 'pt_BR', path: '/', ogImage: 'og.png', name: 'Português', messages: pt },
  en: { lang: 'en', ogLocale: 'en_US', path: '/en/', ogImage: 'og-en.png', name: 'English', messages: en },
};
