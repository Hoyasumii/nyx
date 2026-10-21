import { readColor, rgbaToCss, type ColorContext, type Rgba } from './color';
import type { Part, PptxPackage } from './package';
import { attr, child, children, emuToPx, numAttr, path } from './xml';

export interface Theme {
  colors: Record<string, string>;
  majorFont: string;
  minorFont: string;
  fillStyles: Element[];
  lineStyles: Element[];
  bgFillStyles: Element[];
}

export interface RenderContext {
  pkg: PptxPackage;
  theme: Theme;
  colors: ColorContext;
  master: Part | null;
  layout: Part | null;
  /** Presentation-wide `p:defaultTextStyle`. */
  defaultTextStyle: Element | null;
  slideNumber: number;
}

export type Fill = { kind: 'none' } | { kind: 'paint'; css: string };

export interface Stroke {
  color: string;
  width: number;
  dash?: string;
  head?: string;
  tail?: string;
}

export function readTheme(doc: Document | undefined): Theme {
  const root = doc?.documentElement;
  const elements = path(root, 'themeElements');
  const colors: Record<string, string> = {};
  for (const c of children(path(elements, 'clrScheme'))) {
    const value = child(c, 'srgbClr') ?? child(c, 'sysClr');
    const hex = attr(value, 'val') ?? '';
    colors[c.localName] = value?.localName === 'sysClr' ? attr(value, 'lastClr') ?? hex : hex;
  }
  const fonts = path(elements, 'fontScheme');
  const fmt = path(elements, 'fmtScheme');
  return {
    colors,
    majorFont: attr(path(fonts, 'majorFont', 'latin'), 'typeface') ?? 'Calibri Light',
    minorFont: attr(path(fonts, 'minorFont', 'latin'), 'typeface') ?? 'Calibri',
    fillStyles: children(child(fmt, 'fillStyleLst')),
    lineStyles: children(child(fmt, 'lnStyleLst')),
    bgFillStyles: children(child(fmt, 'bgFillStyleLst')),
  };
}

const FILL_TAGS = new Set(['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill']);

/** Finds the fill element directly under a properties element such as `p:spPr`. */
export function fillElement(props: Element | null | undefined): Element | null {
  for (const el of children(props)) if (FILL_TAGS.has(el.localName)) return el;
  return null;
}

function gradientCss(grad: Element, ctx: RenderContext, placeholder?: Rgba): string | null {
  const stops = children(child(grad, 'gsLst'), 'gs')
    .map((gs) => ({ pos: (numAttr(gs, 'pos') ?? 0) / 1000, color: readColor(gs, ctx.colors, placeholder) }))
    .filter((s): s is { pos: number; color: Rgba } => s.color !== null)
    .sort((x, y) => x.pos - y.pos);
  if (!stops.length) return null;
  const list = stops.map((s) => `${rgbaToCss(s.color)} ${s.pos}%`).join(', ');

  const lin = child(grad, 'lin');
  const pathEl = child(grad, 'path');
  if (pathEl && !lin) {
    const rect = child(pathEl, 'fillToRect');
    const l = (numAttr(rect, 'l') ?? 50000) / 1000;
    const t = (numAttr(rect, 't') ?? 50000) / 1000;
    const r = (numAttr(rect, 'r') ?? 50000) / 1000;
    const b = (numAttr(rect, 'b') ?? 50000) / 1000;
    const cx = (l + (100 - r)) / 2;
    const cy = (t + (100 - b)) / 2;
    const shape = attr(pathEl, 'path') === 'circle' ? 'circle farthest-corner' : 'ellipse farthest-corner';
    return `radial-gradient(${shape} at ${cx}% ${cy}%, ${list})`;
  }
  const angle = (numAttr(lin, 'ang') ?? 0) / 60000;
  return `linear-gradient(${angle + 90}deg, ${list})`;
}

/**
 * Resolves a fill element into a CSS `background` value. Image fills need the
 * part that owns the relationship so `r:embed` can be resolved.
 */
export async function resolveFill(
  fill: Element | null,
  ctx: RenderContext,
  part: Part,
  placeholder?: Rgba,
): Promise<Fill | undefined> {
  if (!fill) return undefined;
  switch (fill.localName) {
    case 'noFill':
      return { kind: 'none' };
    case 'solidFill': {
      const color = readColor(fill, ctx.colors, placeholder);
      return color ? { kind: 'paint', css: rgbaToCss(color) } : undefined;
    }
    case 'gradFill': {
      const css = gradientCss(fill, ctx, placeholder);
      return css ? { kind: 'paint', css } : undefined;
    }
    case 'pattFill': {
      const color = readColor(child(fill, 'fgClr'), ctx.colors, placeholder);
      return color ? { kind: 'paint', css: rgbaToCss(color) } : undefined;
    }
    case 'blipFill': {
      const url = await blipUrl(fill, ctx, part);
      if (!url) return undefined;
      const tiled = child(fill, 'tile') !== null;
      return {
        kind: 'paint',
        css: tiled ? `url("${url}") repeat` : `url("${url}") center / 100% 100% no-repeat`,
      };
    }
    default:
      return undefined;
  }
}

export async function blipUrl(blipFill: Element, ctx: RenderContext, part: Part): Promise<string | null> {
  const blip = child(blipFill, 'blip');
  const id = attr(blip, 'embed');
  const rel = id ? part.rels.get(id) : undefined;
  if (!rel || rel.external) return null;
  return ctx.pkg.mediaUrl(rel.target);
}

/** Resolves `a:fillRef`/`a:lnRef` style references against the theme. */
export function styleRef(
  ref: Element | null,
  list: Element[],
  ctx: RenderContext,
): { el: Element | null; color: Rgba | null } {
  if (!ref) return { el: null, color: null };
  const idx = numAttr(ref, 'idx') ?? 0;
  const color = readColor(ref, ctx.colors);
  if (idx === 0) return { el: null, color };
  const index = idx >= 1000 ? idx - 1001 : idx - 1;
  return { el: list[index] ?? null, color };
}

const DASHES: Record<string, number[]> = {
  dash: [4, 3],
  sysDash: [3, 1],
  dot: [1, 1],
  sysDot: [1, 1],
  lgDash: [8, 3],
  dashDot: [4, 3, 1, 3],
  sysDashDot: [3, 1, 1, 1],
  lgDashDot: [8, 3, 1, 3],
  lgDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDashDotDot: [3, 1, 1, 1, 1, 1],
};

/**
 * Resolves the outline of a shape. `ln` is the explicit `a:ln`, `fallback`
 * the theme line style picked by `a:lnRef` (with its placeholder color).
 */
export function resolveStroke(
  ln: Element | null,
  fallback: { el: Element | null; color: Rgba | null },
  ctx: RenderContext,
): Stroke | null {
  const base = fallback.el;
  if (!ln && !base) return null;
  const fill = fillElement(ln) ?? fillElement(base);
  if (!fill || fill.localName === 'noFill') return null;

  const color = readColor(fill, ctx.colors, fallback.color ?? undefined);
  if (!color) return null;
  const width = Math.max(emuToPx(numAttr(ln, 'w') ?? numAttr(base, 'w') ?? 12700), 0.5);
  const dashName = attr(child(ln, 'prstDash') ?? child(base, 'prstDash'), 'val') ?? 'solid';
  const pattern = DASHES[dashName];
  const endType = (el: Element | null) => {
    const type = attr(el, 'type');
    return type && type !== 'none' ? type : undefined;
  };

  return {
    color: rgbaToCss(color),
    width,
    dash: pattern?.map((n) => n * width).join(' '),
    head: endType(child(ln, 'headEnd')),
    tail: endType(child(ln, 'tailEnd')),
  };
}
