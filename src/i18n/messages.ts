/**
 * Every user-facing string, per locale. Strings rendered into the page may
 * hold inline markup; the build-time template decides where it's escaped.
 */
export interface Messages {
  meta: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    ogImageAlt: string;
    twitterDescription: string;
    appDescription: string;
    priceCurrency: string;
  };
  nav: { home: string; sections: string; language: string };
  hero: { eyebrow: string; title: string; lede: string };
  drop: {
    titlePointer: string;
    titleTouch: string;
    or: string;
    choose: string;
    busy: string;
    over: string;
    foot: string;
  };
  how: { id: string; title: string; steps: { title: string; body: string }[] };
  keys: {
    id: string;
    title: string;
    next: string;
    prev: string;
    firstLast: string;
    fullscreen: string;
    grid: string;
    blackout: string;
    exit: string;
    space: string;
  };
  faq: { id: string; title: string; items: { question: string; answer: string }[] };
  footer: { tagline: string; source: string };
  errors: Record<UnsupportedReason | 'unreadable', string>;
  viewer: {
    back: string;
    close: string;
    gridHint: string;
    showAll: string;
    presentHint: string;
    present: string;
    prev: string;
    next: string;
    thumbnails: string;
    exitFullscreen: string;
    allSlides: string;
    closeGrid: string;
    /** HTML: the slide total, emphasised, and its noun. */
    slideCount: (total: number) => string;
    goTo: (n: number) => string;
    broken: string;
  };
}

/** Why a file was rejected; the UI turns it into a localized message. */
export type UnsupportedReason = 'unsupportedFormat' | 'notPdfOrPptx' | 'invalidPptx' | 'noSlides';
