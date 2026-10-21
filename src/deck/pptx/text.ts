import { hexToRgba, readColor, rgbaToCss, type Rgba } from './color';
import type { RenderContext } from './style';
import { attr, boolAttr, centiPtToPx, child, children, emuToPx, numAttr } from './xml';

interface RunProps {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: Rgba;
  font?: string;
  baseline?: number;
  caps?: 'all' | 'small';
  spacing?: number;
}

type Spacing = { pct: number } | { pts: number };

type Bullet = { type: 'none' } | { type: 'char'; char: string } | { type: 'auto'; scheme: string; startAt: number };

interface ParaProps {
  align?: string;
  marL?: number;
  indent?: number;
  lineSpacing?: Spacing;
  spaceBefore?: Spacing;
  spaceAfter?: Spacing;
  bullet?: Bullet;
  bulletFont?: string | null;
  bulletColor?: Rgba | null;
  bulletSize?: number | null;
  run: RunProps;
}

export interface TextOptions {
  txBody: Element;
  /** `a:bodyPr` elements, most specific first (slide, layout, master). */
  bodyPrChain: Element[];
  /** `a:lstStyle`-like elements, most specific first. */
  styleChain: Element[];
  /** Text color from the shape's `p:style/a:fontRef`. */
  fontRefColor?: Rgba | null;
  /** Overrides with higher priority than the style chain (table styles). */
  baseRun?: RunProps;
  /** Pre-resolved insets in px (tables use cell margins instead of bodyPr). */
  insets?: [number, number, number, number];
  ctx: RenderContext;
}

const assign = <T extends object>(target: T, source: Partial<T>): T => {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) (target as Record<string, unknown>)[key] = value;
  }
  return target;
};

function readSpacing(el: Element | null): Spacing | undefined {
  const pct = child(el, 'spcPct');
  if (pct) return { pct: (numAttr(pct, 'val') ?? 100000) / 100000 };
  const pts = child(el, 'spcPts');
  if (pts) return { pts: numAttr(pts, 'val') ?? 0 };
  return undefined;
}

function readRunProps(rPr: Element | null, ctx: RenderContext): RunProps {
  if (!rPr) return {};
  const u = attr(rPr, 'u');
  const strike = attr(rPr, 'strike');
  const cap = attr(rPr, 'cap');
  const fill = child(rPr, 'solidFill');
  const latin = attr(child(rPr, 'latin'), 'typeface') ?? attr(child(rPr, 'cs'), 'typeface') ?? undefined;
  return {
    size: numAttr(rPr, 'sz'),
    bold: boolAttr(rPr, 'b'),
    italic: boolAttr(rPr, 'i'),
    underline: u === null ? undefined : u !== 'none',
    strike: strike === null ? undefined : strike !== 'noStrike',
    color: fill ? readColor(fill, ctx.colors) ?? undefined : undefined,
    font: latin,
    baseline: numAttr(rPr, 'baseline'),
    caps: cap === 'all' || cap === 'small' ? cap : undefined,
    spacing: numAttr(rPr, 'spc'),
  };
}

function readParaProps(pPr: Element | null, ctx: RenderContext): Partial<ParaProps> {
  if (!pPr) return {};
  const props: Partial<ParaProps> = {
    align: attr(pPr, 'algn') ?? undefined,
    marL: numAttr(pPr, 'marL'),
    indent: numAttr(pPr, 'indent'),
    lineSpacing: readSpacing(child(pPr, 'lnSpc')),
    spaceBefore: readSpacing(child(pPr, 'spcBef')),
    spaceAfter: readSpacing(child(pPr, 'spcAft')),
  };
  if (child(pPr, 'buNone')) props.bullet = { type: 'none' };
  const buChar = child(pPr, 'buChar');
  if (buChar) props.bullet = { type: 'char', char: attr(buChar, 'char') ?? '•' };
  const buAuto = child(pPr, 'buAutoNum');
  if (buAuto) {
    props.bullet = {
      type: 'auto',
      scheme: attr(buAuto, 'type') ?? 'arabicPeriod',
      startAt: numAttr(buAuto, 'startAt') ?? 1,
    };
  }
  if (child(pPr, 'buClrTx')) props.bulletColor = null;
  const buClr = child(pPr, 'buClr');
  if (buClr) props.bulletColor = readColor(buClr, ctx.colors);
  if (child(pPr, 'buFontTx')) props.bulletFont = null;
  const buFont = child(pPr, 'buFont');
  if (buFont) props.bulletFont = attr(buFont, 'typeface');
  if (child(pPr, 'buSzTx')) props.bulletSize = null;
  const buSz = child(pPr, 'buSzPct');
  if (buSz) props.bulletSize = (numAttr(buSz, 'val') ?? 100000) / 100000;
  return props;
}

function resolveParagraph(
  styleChain: Element[],
  lvl: number,
  pPr: Element | null,
  ctx: RenderContext,
  fontRefColor: Rgba | null | undefined,
  baseRun: RunProps | undefined,
): ParaProps {
  const merged: ParaProps = { run: {} };
  const apply = (el: Element | null) => {
    if (!el) return;
    const { run: _ignored, ...para } = readParaProps(el, ctx);
    assign(merged, para);
    assign(merged.run, readRunProps(child(el, 'defRPr'), ctx));
  };

  // Lowest priority first: the chain is ordered most specific first.
  const sources = [...styleChain].reverse();
  for (const [i, source] of sources.entries()) {
    apply(child(source, 'defPPr'));
    apply(child(source, `lvl${lvl + 1}pPr`));
    // The shape's font reference sits just above master/presentation defaults.
    if (i === 0 && fontRefColor) merged.run.color = fontRefColor;
  }
  if (!sources.length && fontRefColor) merged.run.color = fontRefColor;
  if (baseRun) assign(merged.run, baseRun);
  apply(pPr);
  return merged;
}

const SERIF = /times|georgia|cambria|garamond|palatino|book antiqua|baskerville|serif|didot|bodoni|minion|caslon/i;
const MONO = /consolas|courier|mono|menlo|lucida console/i;
const METRIC_TWINS: Record<string, string> = {
  calibri: 'Carlito',
  cambria: 'Caladea',
  arial: 'Liberation Sans',
  'times new roman': 'Liberation Serif',
  'courier new': 'Liberation Mono',
};

export function fontStack(name: string): string {
  const twin = METRIC_TWINS[name.toLowerCase()];
  const generic = MONO.test(name) ? 'ui-monospace, monospace' : SERIF.test(name) ? 'Georgia, serif' : 'system-ui, "Segoe UI", Helvetica, Arial, sans-serif';
  return [`"${name}"`, twin ? `"${twin}"` : null, generic].filter(Boolean).join(', ');
}

function resolveFont(font: string | undefined, ctx: RenderContext): string {
  if (!font || font === '+mn-lt' || font === '+mn-ea' || font === '+mn-cs') return ctx.theme.minorFont;
  if (font === '+mj-lt' || font === '+mj-ea' || font === '+mj-cs') return ctx.theme.majorFont;
  return font;
}

function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let out = '';
  let rest = n;
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

function toAlpha(n: number): string {
  let out = '';
  let rest = n;
  while (rest > 0) {
    rest--;
    out = String.fromCharCode(97 + (rest % 26)) + out;
    rest = Math.floor(rest / 26);
  }
  return out;
}

export function autoNumber(scheme: string, n: number): string {
  let body: string;
  if (scheme.startsWith('alphaLc')) body = toAlpha(n);
  else if (scheme.startsWith('alphaUc')) body = toAlpha(n).toUpperCase();
  else if (scheme.startsWith('romanLc')) body = toRoman(n);
  else if (scheme.startsWith('romanUc')) body = toRoman(n).toUpperCase();
  else body = String(n);
  if (scheme.endsWith('ParenBoth')) return `(${body})`;
  if (scheme.endsWith('ParenR')) return `${body})`;
  if (scheme.endsWith('Plain')) return body;
  return `${body}.`;
}

/** Wingdings/Symbol bullets map to private-use glyphs; show a neutral dot instead. */
function bulletGlyph(char: string, font: string | null | undefined): string {
  if (font && /wingdings|symbol|webdings/i.test(font)) {
    if (char === 'Ø' || char === 'ü' || char === 'q' || char === 'v' || char === '§') return '▪';
    return '•';
  }
  return char;
}

const ALIGN: Record<string, string> = { l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify' };

function spacingPx(spacing: Spacing | undefined, fontPx: number): number {
  if (!spacing) return 0;
  return 'pct' in spacing ? spacing.pct * fontPx * 1.2 : centiPtToPx(spacing.pts);
}

function applyRunStyle(span: HTMLElement, run: RunProps, ctx: RenderContext, fontScale: number): void {
  const sizePx = centiPtToPx(run.size ?? 1800) * fontScale;
  const style = span.style;
  style.fontSize = `${sizePx}px`;
  style.fontFamily = fontStack(resolveFont(run.font, ctx));
  if (run.bold) style.fontWeight = '700';
  if (run.italic) style.fontStyle = 'italic';
  const decorations = [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean);
  if (decorations.length) style.textDecoration = decorations.join(' ');
  style.color = rgbaToCss(run.color ?? { r: 0, g: 0, b: 0, a: 1 });
  if (run.caps === 'all') style.textTransform = 'uppercase';
  if (run.caps === 'small') style.fontVariant = 'small-caps';
  if (run.spacing) style.letterSpacing = `${centiPtToPx(run.spacing) * fontScale}px`;
  if (run.baseline) {
    style.verticalAlign = run.baseline > 0 ? 'super' : 'sub';
    style.fontSize = `${sizePx * 0.66}px`;
  }
}

export function renderText(options: TextOptions): HTMLElement | null {
  const { txBody, ctx } = options;
  const paragraphs = children(txBody, 'p');
  const hasText = paragraphs.some((p) =>
    children(p).some((n) => (n.localName === 'r' || n.localName === 'fld') && (child(n, 't')?.textContent ?? '') !== ''),
  );
  if (!hasText) return null;

  const bodyPr = (name: string) => {
    for (const el of options.bodyPrChain) {
      const value = attr(el, name);
      if (value !== null) return value;
    }
    return null;
  };
  const bodyNum = (name: string, fallback: number) => {
    const value = bodyPr(name);
    return value === null ? fallback : Number(value);
  };
  const autofit = options.bodyPrChain.map((el) => child(el, 'normAutofit')).find(Boolean) ?? null;
  const fontScale = (numAttr(autofit, 'fontScale') ?? 100000) / 100000;
  const lineReduction = (numAttr(autofit, 'lnSpcReduction') ?? 0) / 100000;

  const box = document.createElement('div');
  box.className = 'pptx-text';
  const [top, right, bottom, left] = options.insets ?? [
    emuToPx(bodyNum('tIns', 45720)),
    emuToPx(bodyNum('rIns', 91440)),
    emuToPx(bodyNum('bIns', 45720)),
    emuToPx(bodyNum('lIns', 91440)),
  ];
  box.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  const anchor = bodyPr('anchor') ?? 't';
  box.style.justifyContent = anchor === 'ctr' ? 'center' : anchor === 'b' ? 'flex-end' : 'flex-start';
  if (bodyPr('wrap') === 'none') box.style.whiteSpace = 'pre';
  const vert = bodyPr('vert');
  if (vert === 'vert' || vert === 'eaVert' || vert === 'wordArtVertRtl') box.style.writingMode = 'vertical-rl';
  if (vert === 'vert270') {
    box.style.writingMode = 'vertical-rl';
    box.style.transform = 'rotate(180deg)';
  }

  const flow = document.createElement('div');
  flow.className = 'pptx-flow';
  const columns = bodyNum('numCol', 1);
  if (columns > 1) {
    flow.style.columnCount = String(columns);
    flow.style.columnGap = `${emuToPx(bodyNum('spcCol', 0))}px`;
  }
  box.append(flow);

  const counters: (number | undefined)[] = [];
  paragraphs.forEach((p, index) => {
    const pPr = child(p, 'pPr');
    const lvl = numAttr(pPr, 'lvl') ?? 0;
    const props = resolveParagraph(options.styleChain, lvl, pPr, ctx, options.fontRefColor, options.baseRun);
    const nodes = children(p).filter((n) => n.localName === 'r' || n.localName === 'br' || n.localName === 'fld');
    const firstRun = nodes.find((n) => n.localName !== 'br');
    const firstRunProps = assign({ ...props.run }, readRunProps(child(firstRun, 'rPr') ?? child(p, 'endParaRPr'), ctx));
    const fontPx = centiPtToPx(firstRunProps.size ?? 1800) * fontScale;

    const para = document.createElement('div');
    para.className = 'pptx-p';
    para.style.textAlign = ALIGN[props.align ?? 'l'] ?? 'left';
    const marL = emuToPx(props.marL ?? 0);
    const indent = emuToPx(props.indent ?? 0);
    para.style.paddingLeft = `${marL}px`;
    para.style.textIndent = `${indent}px`;

    const line = props.lineSpacing;
    if (line && 'pts' in line) para.style.lineHeight = `${centiPtToPx(line.pts)}px`;
    else para.style.lineHeight = String(Math.max(((line?.pct ?? 1) - lineReduction) * 1.2, 0.5));
    if (index > 0) para.style.marginTop = `${spacingPx(props.spaceBefore, fontPx)}px`;
    para.style.marginBottom = `${spacingPx(props.spaceAfter, fontPx)}px`;

    const isEmpty = !nodes.some((n) => n.localName !== 'br' && (child(n, 't')?.textContent ?? '') !== '');
    const bullet = props.bullet;
    if (bullet?.type === 'auto') {
      const previous = counters[lvl];
      counters[lvl] = previous === undefined ? bullet.startAt : previous + 1;
    } else if (!isEmpty) {
      counters[lvl] = undefined;
    }
    counters.length = lvl + 1;

    if (bullet && bullet.type !== 'none' && !isEmpty) {
      const mark = document.createElement('span');
      mark.className = 'pptx-bullet';
      applyRunStyle(mark, { ...firstRunProps, underline: false, strike: false, baseline: undefined }, ctx, fontScale);
      if (props.bulletColor) mark.style.color = rgbaToCss(props.bulletColor);
      if (props.bulletSize) mark.style.fontSize = `${fontPx * props.bulletSize}px`;
      if (bullet.type === 'char') {
        mark.textContent = bulletGlyph(bullet.char, props.bulletFont);
        if (props.bulletFont && !/wingdings|symbol|webdings/i.test(props.bulletFont)) {
          mark.style.fontFamily = fontStack(props.bulletFont);
        }
      } else {
        mark.textContent = autoNumber(bullet.scheme, counters[lvl] ?? bullet.startAt);
      }
      mark.style.minWidth = indent < 0 ? `${-indent}px` : '0';
      if (indent >= 0) mark.style.paddingRight = '0.4em';
      para.append(mark);
    }

    for (const node of nodes) {
      if (node.localName === 'br') {
        para.append(document.createElement('br'));
        continue;
      }
      const rPr = child(node, 'rPr');
      const run = assign({ ...props.run }, readRunProps(rPr, ctx));
      if (child(rPr, 'hlinkClick') && ctx.theme.colors.hlink) {
        run.color = run.color && child(rPr, 'solidFill') ? run.color : hexToRgba(ctx.theme.colors.hlink);
        run.underline = run.underline ?? true;
      }
      let text = child(node, 't')?.textContent ?? '';
      if (node.localName === 'fld' && attr(node, 'type') === 'slidenum') text = String(ctx.slideNumber);
      if (!text) continue;
      const span = document.createElement('span');
      span.textContent = text;
      applyRunStyle(span, run, ctx, fontScale);
      para.append(span);
    }

    if (isEmpty) {
      // Empty paragraphs still take up a line at their own font size.
      const filler = document.createElement('span');
      filler.textContent = '​';
      applyRunStyle(filler, firstRunProps, ctx, fontScale);
      para.append(filler);
    }
    flow.append(para);
  });

  return box;
}
