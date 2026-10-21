import { t } from '../i18n';

/**
 * A small, non-blocking sponsor card under the drop zone. It never appears in
 * the viewer and never sees the opened file: the ad network only loads its own
 * script on the landing page.
 *
 * Configured at build time (see README): an ad from EthicalAds or Carbon, and
 * a donation link shown instead when no ad is configured, the network has no
 * ad to serve, or a blocker stops it.
 */

const env = import.meta.env;

// How long the network gets to fill the slot before we fall back.
const FILL_TIMEOUT = 6000;

declare global {
  interface Window {
    ethicalads?: { load: () => void; wait: Promise<unknown[]> };
  }
}

export function mountSponsor(host: HTMLElement): void {
  const label = host.querySelector<HTMLElement>('.sponsor-label')!;
  const slot = host.querySelector<HTMLElement>('.sponsor-slot')!;

  const show = (text: string) => {
    label.textContent = text;
    host.hidden = false;
  };

  const fallback = () => {
    slot.replaceChildren();
    const link = supportLink();
    if (!link) return;
    slot.append(link);
    show(t.sponsor.supportLabel);
  };

  const fill = adLoader(slot);
  if (!fill) return fallback();

  // Ads wait until the page is idle so they never slow down opening a file.
  whenIdle(async () => {
    try {
      if (await withTimeout(fill(), FILL_TIMEOUT)) show(t.sponsor.adLabel);
      else fallback();
    } catch {
      fallback();
    }
  });
}

/** Returns a function that renders an ad into `slot` and resolves to whether one was served. */
function adLoader(slot: HTMLElement): (() => Promise<boolean>) | null {
  switch (env.VITE_ADS_PROVIDER?.trim().toLowerCase()) {
    case 'ethicalads': {
      const publisher = env.VITE_ETHICALADS_PUBLISHER?.trim();
      return publisher ? () => ethicalAds(slot, publisher) : null;
    }
    case 'carbon': {
      const serve = env.VITE_CARBON_SERVE?.trim();
      const placement = env.VITE_CARBON_PLACEMENT?.trim();
      return serve && placement ? () => carbon(slot, serve, placement) : null;
    }
    default:
      return null;
  }
}

async function ethicalAds(slot: HTMLElement, publisher: string): Promise<boolean> {
  const ad = document.createElement('div');
  ad.className = 'horizontal dark';
  ad.dataset.eaPublisher = publisher;
  ad.dataset.eaType = 'image';
  ad.dataset.eaManual = 'true';
  slot.append(ad);

  await loadScript('https://media.ethicalads.io/media/client/ethicalads.min.js', document.head);
  const client = window.ethicalads;
  if (!client) return false;
  client.load();
  const placements = await client.wait;
  return placements.length > 0;
}

function carbon(slot: HTMLElement, serve: string, placement: string): Promise<boolean> {
  const params = new URLSearchParams({ serve, placement });
  const filled = new Promise<boolean>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!slot.querySelector('#carbonads')) return;
      observer.disconnect();
      resolve(true);
    });
    observer.observe(slot, { childList: true, subtree: true });
  });
  // Carbon renders its ad right before its own script tag, so the script goes in the slot.
  const script = loadScript(`https://cdn.carbonads.com/carbon.js?${params}`, slot, '_carbonads_js');
  return Promise.race([filled, script.then(() => filled)]);
}

function supportLink(): HTMLAnchorElement | null {
  const url = env.VITE_SUPPORT_URL?.trim();
  if (!url || !/^https:\/\//i.test(url)) return null;

  const link = document.createElement('a');
  link.className = 'sponsor-support';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';

  const text = document.createElement('span');
  text.textContent = t.sponsor.supportText;
  const cta = document.createElement('span');
  cta.className = 'sponsor-cta';
  cta.textContent = t.sponsor.supportCta;

  link.append(text, cta);
  return link;
}

function loadScript(src: string, parent: HTMLElement, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    if (id) script.id = id;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    parent.append(script);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | false> {
  return Promise.race([promise, new Promise<false>((resolve) => setTimeout(() => resolve(false), ms))]);
}

function whenIdle(callback: () => void): void {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(callback, { timeout: 3000 }) : setTimeout(callback, 1));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}
