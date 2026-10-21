/**
 * Namespace-agnostic helpers for walking OOXML. PresentationML files almost
 * always use the `p:`, `a:` and `r:` prefixes, but nothing guarantees it, so
 * elements are matched by local name instead of qualified name.
 */

export const EMU_PER_PX = 9525;

export const emuToPx = (emu: number): number => emu / EMU_PER_PX;

/** Hundredths of a point (font sizes) to CSS pixels. */
export const centiPtToPx = (value: number): number => (value / 100) * (4 / 3);

export function children(el: Element | null | undefined, name?: string): Element[] {
  if (!el) return [];
  const out: Element[] = [];
  for (let node = el.firstElementChild; node; node = node.nextElementSibling) {
    if (!name || node.localName === name) out.push(node);
  }
  return out;
}

export function child(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  for (let node = el.firstElementChild; node; node = node.nextElementSibling) {
    if (node.localName === name) return node;
  }
  return null;
}

/** Follows a chain of child names, e.g. `path(sp, 'spPr', 'xfrm', 'off')`. */
export function path(el: Element | null | undefined, ...names: string[]): Element | null {
  let current: Element | null | undefined = el;
  for (const name of names) {
    current = child(current, name);
    if (!current) return null;
  }
  return current ?? null;
}

/** First descendant with the given local name (depth-first). */
export function descendant(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  const all = el.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === name) return all[i];
  }
  return null;
}

/** Reads an attribute by local name, ignoring its prefix (`r:embed` → `embed`). */
export function attr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  const direct = el.getAttribute(name);
  if (direct !== null) return direct;
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name) return a.value;
  }
  return null;
}

/** Reads a relationship reference (`r:id`), which can collide with a plain `id`. */
export function relAttr(el: Element | null | undefined, name = 'id'): string | null {
  if (!el) return null;
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name && a.namespaceURI?.endsWith('/relationships')) return a.value;
  }
  return null;
}

export function numAttr(el: Element | null | undefined, name: string): number | undefined {
  const value = attr(el, name);
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** OOXML booleans are "1"/"0"/"true"/"false". */
export function boolAttr(el: Element | null | undefined, name: string): boolean | undefined {
  const value = attr(el, name);
  if (value === null) return undefined;
  return value === '1' || value === 'true' || value === 'on';
}

export function parseXml(source: string): Document {
  return new DOMParser().parseFromString(source, 'application/xml');
}
