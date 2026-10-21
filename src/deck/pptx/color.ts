import { attr, children, numAttr } from './xml';

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ColorContext {
  /** Theme color scheme: `dk1`, `lt1`, `accent1`… → hex without `#`. */
  scheme: Record<string, string>;
  /** Master color map: `bg1` → `lt1`, `tx1` → `dk1`… */
  map: Record<string, string>;
}

const PRESET_COLORS: Record<string, string> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  gray: '808080',
  grey: '808080',
  darkGray: 'A9A9A9',
  lightGray: 'D3D3D3',
  orange: 'FFA500',
  purple: '800080',
  navy: '000080',
  teal: '008080',
  silver: 'C0C0C0',
  maroon: '800000',
  cyan: '00FFFF',
  magenta: 'FF00FF',
};

const COLOR_ELEMENTS = new Set(['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr']);

export function hexToRgba(hex: string): Rgba {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
    a: 1,
  };
}

export function rgbaToCss({ r, g, b, a }: Rgba): string {
  const R = Math.round(clamp(r, 0, 255));
  const G = Math.round(clamp(g, 0, 255));
  const B = Math.round(clamp(b, 0, 255));
  if (a >= 1) return `rgb(${R} ${G} ${B})`;
  return `rgb(${R} ${G} ${B} / ${Math.round(clamp(a, 0, 1) * 1000) / 1000})`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function rgbToHsl({ r, g, b }: Rgba): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number, a = 1): Rgba {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255, a };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: channel(hue + 1 / 3) * 255, g: channel(hue) * 255, b: channel(hue - 1 / 3) * 255, a };
}

function baseColor(el: Element, ctx: ColorContext, placeholder?: Rgba): Rgba | null {
  switch (el.localName) {
    case 'srgbClr':
      return hexToRgba(attr(el, 'val') ?? '000000');
    case 'sysClr':
      return hexToRgba(attr(el, 'lastClr') ?? (attr(el, 'val') === 'window' ? 'FFFFFF' : '000000'));
    case 'prstClr':
      return hexToRgba(PRESET_COLORS[attr(el, 'val') ?? ''] ?? '000000');
    case 'scrgbClr': {
      const toByte = (v: number | undefined) => Math.pow((v ?? 0) / 100000, 1 / 2.2) * 255;
      return { r: toByte(numAttr(el, 'r')), g: toByte(numAttr(el, 'g')), b: toByte(numAttr(el, 'b')), a: 1 };
    }
    case 'hslClr':
      return hslToRgb(
        (numAttr(el, 'hue') ?? 0) / 60000,
        (numAttr(el, 'sat') ?? 0) / 100000,
        (numAttr(el, 'lum') ?? 0) / 100000,
      );
    case 'schemeClr': {
      const val = attr(el, 'val') ?? '';
      if (val === 'phClr') return placeholder ? { ...placeholder } : null;
      const key = ctx.map[val] ?? val;
      const hex = ctx.scheme[key];
      return hex ? hexToRgba(hex) : null;
    }
    default:
      return null;
  }
}

const toLinear = (channel: number) => {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

const toSrgb = (x: number) => {
  const v = clamp(x, 0, 1);
  return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;
};

function mapLinear(c: Rgba, fn: (x: number) => number): Rgba {
  return { r: toSrgb(fn(toLinear(c.r))), g: toSrgb(fn(toLinear(c.g))), b: toSrgb(fn(toLinear(c.b))), a: c.a };
}

/** Applies OOXML color transforms (lumMod, tint, alpha…) in document order. */
function applyModifiers(color: Rgba, el: Element): Rgba {
  let c = { ...color };
  for (const mod of children(el)) {
    const v = (numAttr(mod, 'val') ?? 0) / 100000;
    switch (mod.localName) {
      case 'alpha':
        c.a = v;
        break;
      case 'alphaMod':
        c.a *= v;
        break;
      case 'alphaOff':
        c.a += v;
        break;
      // PowerPoint tints and shades in linear light, not in sRGB.
      case 'tint':
        c = mapLinear(c, (x) => x * v + (1 - v));
        break;
      case 'shade':
        c = mapLinear(c, (x) => x * v);
        break;
      case 'lumMod':
      case 'lumOff':
      case 'satMod':
      case 'satOff':
      case 'hueMod':
      case 'hueOff': {
        let [h, s, l] = rgbToHsl(c);
        if (mod.localName === 'lumMod') l *= v;
        if (mod.localName === 'lumOff') l += v;
        if (mod.localName === 'satMod') s *= v;
        if (mod.localName === 'satOff') s += v;
        if (mod.localName === 'hueMod') h *= v;
        if (mod.localName === 'hueOff') h += ((numAttr(mod, 'val') ?? 0) / 60000);
        c = hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1), c.a);
        break;
      }
      case 'gray': {
        const y = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        c = { r: y, g: y, b: y, a: c.a };
        break;
      }
      case 'inv':
        c = { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b, a: c.a };
        break;
    }
  }
  return c;
}

/** Reads a bare color element (`a:srgbClr`, `a:schemeClr`…). */
export function readColorElement(el: Element, ctx: ColorContext, placeholder?: Rgba): Rgba | null {
  const base = baseColor(el, ctx, placeholder);
  return base ? applyModifiers(base, el) : null;
}

/** Reads the color held by a container such as `a:solidFill` or `a:buClr`. */
export function readColor(container: Element | null | undefined, ctx: ColorContext, placeholder?: Rgba): Rgba | null {
  if (!container) return null;
  if (COLOR_ELEMENTS.has(container.localName)) return readColorElement(container, ctx, placeholder);
  for (const el of children(container)) {
    if (COLOR_ELEMENTS.has(el.localName)) return readColorElement(el, ctx, placeholder);
  }
  return null;
}
