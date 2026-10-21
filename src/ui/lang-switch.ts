const SLIDE_MS = 320;

/**
 * Each language is its own page, so switching is a navigation. The thumb
 * slides to the picked language first and the page changes once it lands.
 */
export function bindLanguageSwitch(root: HTMLElement): void {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a'));
  const initial = root.style.getPropertyValue('--index');

  root.addEventListener('click', (event) => {
    const link = (event.target as Element).closest('a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (link.hasAttribute('aria-current') || root.classList.contains('is-switching')) return;

    root.classList.add('is-switching');
    root.style.setProperty('--index', String(links.indexOf(link)));
    link.classList.add('is-active');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => location.assign(link.href), reduced ? 0 : SLIDE_MS);
  });

  // Coming back through the history restores this page as it was left, mid-switch.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    root.classList.remove('is-switching');
    root.style.setProperty('--index', initial);
    links.forEach((link) => link.classList.remove('is-active'));
  });
}
