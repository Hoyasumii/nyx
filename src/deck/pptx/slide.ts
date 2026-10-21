import { readColor, rgbaToCss } from './color';
import { customOutline, presetOutline, presetTextRect, readAdjustments, type Outline } from './geometry';
import type { Part } from './package';
import {
  blipUrl,
  fillElement,
  resolveFill,
  resolveStroke,
  styleRef,
  type Fill,
  type RenderContext,
  type Stroke,
} from './style';
import { renderTable } from './table';
import { renderText } from './text';
import { attr, boolAttr, child, children, descendant, emuToPx, numAttr, path } from './xml';

/** Maps child-space EMU coordinates to slide-space EMU: p' = o + s·p. */
interface Transform {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
}

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

type Level = 'slide' | 'layout' | 'master' | 'drawing';

interface Scope {
  ctx: RenderContext;
  part: Part;
  level: Level;
  transform: Transform;
  groupFill: Element | null;
  tableStyles: Document | null;
}

const IDENTITY: Transform = { ox: 0, oy: 0, sx: 1, sy: 1 };

function toFrame(xfrm: Element | null, t: Transform): Frame | null {
  const off = child(xfrm, 'off');
  const ext = child(xfrm, 'ext');
  if (!off || !ext) return null;
  return {
    x: emuToPx(t.ox + t.sx * (numAttr(off, 'x') ?? 0)),
    y: emuToPx(t.oy + t.sy * (numAttr(off, 'y') ?? 0)),
    w: emuToPx(t.sx * (numAttr(ext, 'cx') ?? 0)),
    h: emuToPx(t.sy * (numAttr(ext, 'cy') ?? 0)),
    rot: (numAttr(xfrm, 'rot') ?? 0) / 60000,
    flipH: boolAttr(xfrm, 'flipH') ?? false,
    flipV: boolAttr(xfrm, 'flipV') ?? false,
  };
}

// --- Placeholders -----------------------------------------------------------

interface Placeholder {
  type: string;
  idx: string | null;
}

function placeholderOf(shape: Element): Placeholder | null {
  const nv = children(shape).find((c) => c.localName.startsWith('nv'));
  const ph = path(nv, 'nvPr', 'ph');
  if (!ph) return null;
  return { type: attr(ph, 'type') ?? 'obj', idx: attr(ph, 'idx') };
}

const normalizeType = (type: string) =>
  type === 'ctrTitle' ? 'title' : type === 'subTitle' || type === 'obj' ? 'body' : type;

function findPlaceholder(part: Part | null, wanted: Placeholder): Element | null {
  if (!part) return null;
  const tree = path(part.doc.documentElement, 'cSld', 'spTree');
  const candidates: [Element, Placeholder][] = [];
  const all = tree?.getElementsByTagName('*') ?? [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName !== 'sp' && el.localName !== 'pic') continue;
    const ph = placeholderOf(el);
    if (ph) candidates.push([el, ph]);
  }
  if (wanted.idx !== null) {
    const byIdx = candidates.find(([, ph]) => ph.idx === wanted.idx);
    if (byIdx) return byIdx[0];
  }
  const byType = candidates.find(([, ph]) => ph.type === wanted.type);
  if (byType) return byType[0];
  const normalized = normalizeType(wanted.type);
  return candidates.find(([, ph]) => normalizeType(ph.type) === normalized)?.[0] ?? null;
}

/** The shape itself plus the layout and master placeholders it inherits from. */
function inheritanceChain(shape: Element, scope: Scope): Element[] {
  if (scope.level !== 'slide') return [shape];
  const ph = placeholderOf(shape);
  if (!ph) return [shape];
  const layoutPh = findPlaceholder(scope.ctx.layout, ph);
  const masterPh = findPlaceholder(scope.ctx.master, layoutPh ? placeholderOf(layoutPh) ?? ph : ph);
  return [shape, layoutPh, masterPh].filter((e): e is Element => e !== null);
}

function masterTextStyle(ctx: RenderContext, ph: Placeholder | null): Element | null {
  const txStyles = child(ctx.master?.doc.documentElement, 'txStyles');
  if (!ph) return null;
  const type = normalizeType(ph.type);
  if (type === 'title') return child(txStyles, 'titleStyle');
  if (type === 'body') return child(txStyles, 'bodyStyle');
  return child(txStyles, 'otherStyle');
}

// --- Drawing primitives -----------------------------------------------------

function positioned(frame: Frame, className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  Object.assign(el.style, {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.w}px`,
    height: `${frame.h}px`,
  });
  if (frame.rot) el.style.transform = `rotate(${frame.rot}deg)`;
  return el;
}

const flipTransform = (frame: Frame) =>
  frame.flipH || frame.flipV ? `scale(${frame.flipH ? -1 : 1}, ${frame.flipV ? -1 : 1})` : '';

function outlineFor(spPrChain: Element[], frame: Frame): Outline {
  for (const spPr of spPrChain) {
    const custom = child(spPr, 'custGeom');
    if (custom) {
      const outline = customOutline(custom, frame.w, frame.h);
      if (outline) return outline;
    }
    const preset = child(spPr, 'prstGeom');
    if (preset) return presetOutline(attr(preset, 'prst') ?? 'rect', frame.w, frame.h, readAdjustments(preset));
  }
  return presetOutline('rect', frame.w, frame.h);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
let markerSeq = 0;

function strokeSvg(outline: Outline, stroke: Stroke, frame: Frame): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'pptx-stroke');
  svg.setAttribute('width', String(Math.max(frame.w, 1)));
  svg.setAttribute('height', String(Math.max(frame.h, 1)));
  const flip = flipTransform(frame);
  if (flip) svg.style.transform = flip;

  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', outline.d);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', stroke.color);
  p.setAttribute('stroke-width', String(stroke.width));
  p.setAttribute('stroke-linejoin', 'round');
  if (stroke.dash) p.setAttribute('stroke-dasharray', stroke.dash);

  const marker = (kind: string, atStart: boolean) => {
    const id = `nyx-marker-${++markerSeq}`;
    const m = document.createElementNS(SVG_NS, 'marker');
    m.setAttribute('id', id);
    m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', kind === 'oval' || kind === 'diamond' ? '5' : '9');
    m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '4');
    m.setAttribute('markerHeight', '4');
    m.setAttribute('orient', atStart ? 'auto-start-reverse' : 'auto');
    const shape = document.createElementNS(SVG_NS, kind === 'oval' ? 'circle' : 'path');
    if (kind === 'oval') {
      shape.setAttribute('cx', '5');
      shape.setAttribute('cy', '5');
      shape.setAttribute('r', '4');
    } else if (kind === 'diamond') {
      shape.setAttribute('d', 'M5 0 L10 5 L5 10 L0 5 Z');
    } else if (kind === 'arrow') {
      shape.setAttribute('d', 'M0 0 L10 5 L0 10');
      shape.setAttribute('fill', 'none');
      shape.setAttribute('stroke', stroke.color);
      shape.setAttribute('stroke-width', '1.5');
    } else {
      shape.setAttribute('d', 'M0 0 L10 5 L0 10 Z');
    }
    if (kind !== 'arrow') shape.setAttribute('fill', stroke.color);
    m.append(shape);
    return { id, m };
  };
  const defs = document.createElementNS(SVG_NS, 'defs');
  if (stroke.head) {
    const { id, m } = marker(stroke.head, true);
    defs.append(m);
    p.setAttribute('marker-start', `url(#${id})`);
  }
  if (stroke.tail) {
    const { id, m } = marker(stroke.tail, false);
    defs.append(m);
    p.setAttribute('marker-end', `url(#${id})`);
  }
  if (defs.childNodes.length) svg.append(defs);
  svg.append(p);
  return svg;
}

function paintLayer(fill: Fill, outline: Outline, frame: Frame, isRect: boolean): HTMLElement | null {
  if (fill.kind === 'none' || !outline.filled) return null;
  const layer = document.createElement('div');
  layer.className = 'pptx-paint';
  layer.style.background = fill.css;
  if (!isRect) layer.style.clipPath = `path('${outline.d}')`;
  const flip = flipTransform(frame);
  if (flip) layer.style.transform = flip;
  return layer;
}

function textRect(spPrChain: Element[], frame: Frame): [number, number, number, number] | null {
  for (const spPr of spPrChain) {
    if (child(spPr, 'custGeom')) return null;
    const preset = child(spPr, 'prstGeom');
    if (preset) return presetTextRect(attr(preset, 'prst') ?? 'rect', frame.w, frame.h, readAdjustments(preset));
  }
  return null;
}

function isPlainRect(spPrChain: Element[]): boolean {
  for (const spPr of spPrChain) {
    if (child(spPr, 'custGeom')) return false;
    const preset = child(spPr, 'prstGeom');
    if (preset) return attr(preset, 'prst') === 'rect';
  }
  return true;
}

async function shapeFill(spPrChain: Element[], style: Element | null, scope: Scope): Promise<Fill> {
  const { ctx, part } = scope;
  for (const spPr of spPrChain) {
    const el = fillElement(spPr);
    if (!el) continue;
    if (el.localName === 'grpFill') {
      return (await resolveFill(fillElement(scope.groupFill) ?? null, ctx, part)) ?? { kind: 'none' };
    }
    const fill = await resolveFill(el, ctx, part);
    if (fill) return fill;
  }
  const ref = styleRef(child(style, 'fillRef'), ctx.theme.fillStyles, ctx);
  if (ref.el) {
    const fill = await resolveFill(ref.el, ctx, part, ref.color ?? undefined);
    if (fill) return fill;
  }
  return { kind: 'none' };
}

function shapeStroke(spPrChain: Element[], style: Element | null, ctx: RenderContext): Stroke | null {
  const ln = spPrChain.map((s) => child(s, 'ln')).find(Boolean) ?? null;
  return resolveStroke(ln, styleRef(child(style, 'lnRef'), ctx.theme.lineStyles, ctx), ctx);
}

// --- Elements ---------------------------------------------------------------

async function renderShape(sp: Element, scope: Scope, out: HTMLElement): Promise<void> {
  const ph = placeholderOf(sp);
  // Placeholders on layouts and masters are editing prompts, not content.
  if (ph && (scope.level === 'layout' || scope.level === 'master')) return;

  const { ctx } = scope;
  const chain = inheritanceChain(sp, scope);
  const spPrChain = chain.map((el) => child(el, 'spPr')).filter((e): e is Element => e !== null);
  const xfrm = spPrChain.map((s) => child(s, 'xfrm')).find(Boolean) ?? null;
  const frame = toFrame(xfrm, scope.transform);
  if (!frame) return;

  const style = child(sp, 'style');
  const node = positioned(frame, 'pptx-shape');
  const outline = outlineFor(spPrChain, frame);
  const fill = await shapeFill(spPrChain, style, scope);
  const paint = paintLayer(fill, outline, frame, isPlainRect(spPrChain));
  if (paint) node.append(paint);
  const stroke = shapeStroke(spPrChain, style, ctx);
  if (stroke) node.append(strokeSvg(outline, stroke, frame));

  const txBody = child(sp, 'txBody');
  if (txBody) {
    const inherited = chain.map((el) => child(el, 'txBody'));
    const fontRef = child(style, 'fontRef');
    const text = renderText({
      txBody,
      bodyPrChain: inherited.map((t) => child(t, 'bodyPr')).filter((e): e is Element => e !== null),
      styleChain: [
        ...inherited.map((t) => child(t, 'lstStyle')),
        ph ? masterTextStyle(ctx, ph) : null,
        ctx.defaultTextStyle,
      ].filter((e): e is Element => e !== null),
      fontRefColor: fontRef ? readColor(fontRef, ctx.colors) : null,
      ctx,
    });
    if (text) {
      const textFrame = toFrame(child(sp, 'txXfrm'), scope.transform);
      const inner: [number, number, number, number] | null = textFrame
        ? [textFrame.x - frame.x, textFrame.y - frame.y, textFrame.x - frame.x + textFrame.w, textFrame.y - frame.y + textFrame.h]
        : textRect(spPrChain, frame);
      if (inner) {
        const [l, t, r, b] = inner;
        Object.assign(text.style, {
          inset: 'auto',
          left: `${l}px`,
          top: `${t}px`,
          width: `${r - l}px`,
          height: `${b - t}px`,
        });
      }
      node.append(text);
    }
  }

  if (node.childNodes.length) out.append(node);
}

async function renderPicture(pic: Element, scope: Scope, out: HTMLElement): Promise<void> {
  const { ctx, part } = scope;
  const chain = inheritanceChain(pic, scope);
  const spPrChain = chain.map((el) => child(el, 'spPr')).filter((e): e is Element => e !== null);
  const xfrm = spPrChain.map((s) => child(s, 'xfrm')).find(Boolean) ?? null;
  const frame = toFrame(xfrm, scope.transform);
  const blipFill = child(pic, 'blipFill');
  if (!frame || !blipFill) return;
  const url = await blipUrl(blipFill, ctx, part);
  if (!url) return;

  const node = positioned(frame, 'pptx-shape pptx-picture');
  const clip = document.createElement('div');
  clip.className = 'pptx-paint';
  const outline = outlineFor(spPrChain, frame);
  if (!isPlainRect(spPrChain)) clip.style.clipPath = `path('${outline.d}')`;
  const flip = flipTransform(frame);
  if (flip) clip.style.transform = flip;

  const src = child(blipFill, 'srcRect');
  const crop = (side: string) => (numAttr(src, side) ?? 0) / 100000;
  const [l, t, r, b] = [crop('l'), crop('t'), crop('r'), crop('b')];
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  const width = frame.w / Math.max(1 - l - r, 0.01);
  const height = frame.h / Math.max(1 - t - b, 0.01);
  Object.assign(img.style, {
    width: `${width}px`,
    height: `${height}px`,
    left: `${-l * width}px`,
    top: `${-t * height}px`,
  });
  const alpha = child(child(blipFill, 'blip'), 'alphaModFix');
  if (alpha) img.style.opacity = String((numAttr(alpha, 'amt') ?? 100000) / 100000);
  clip.append(img);
  node.append(clip);

  const stroke = shapeStroke(spPrChain, child(pic, 'style'), ctx);
  if (stroke) node.append(strokeSvg(outline, stroke, frame));
  out.append(node);
}

async function renderGroup(grp: Element, scope: Scope, out: HTMLElement): Promise<void> {
  const grpSpPr = child(grp, 'grpSpPr');
  const xfrm = child(grpSpPr, 'xfrm');
  const off = child(xfrm, 'off');
  const ext = child(xfrm, 'ext');
  const chOff = child(xfrm, 'chOff');
  const chExt = child(xfrm, 'chExt');
  let transform = scope.transform;
  if (off && ext && chOff && chExt) {
    const kx = (numAttr(ext, 'cx') ?? 0) / (numAttr(chExt, 'cx') || 1);
    const ky = (numAttr(ext, 'cy') ?? 0) / (numAttr(chExt, 'cy') || 1);
    const t = scope.transform;
    transform = {
      sx: t.sx * kx,
      sy: t.sy * ky,
      ox: t.ox + t.sx * ((numAttr(off, 'x') ?? 0) - (numAttr(chOff, 'x') ?? 0) * kx),
      oy: t.oy + t.sy * ((numAttr(off, 'y') ?? 0) - (numAttr(chOff, 'y') ?? 0) * ky),
    };
  }
  const groupFill = fillElement(grpSpPr) ?? scope.groupFill;
  await renderTree(grp, { ...scope, transform, groupFill }, out);
}

async function renderDiagram(graphicData: Element, frameXfrm: Element | null, scope: Scope, out: HTMLElement) {
  const { ctx, part } = scope;
  const dataId = attr(descendant(graphicData, 'relIds'), 'dm');
  const dataRel = dataId ? part.rels.get(dataId) : undefined;
  const dataPart = dataRel ? await ctx.pkg.part(dataRel.target) : null;
  const drawingId = attr(descendant(dataPart?.doc.documentElement, 'dataModelExt'), 'relId');
  const drawingRel = drawingId ? part.rels.get(drawingId) : undefined;
  const drawing = drawingRel ? await ctx.pkg.part(drawingRel.target) : null;
  const tree = descendant(drawing?.doc.documentElement, 'spTree');
  const off = child(frameXfrm, 'off');
  if (!drawing || !tree || !off) return;
  const t = scope.transform;
  await renderTree(
    tree,
    {
      ...scope,
      part: drawing,
      level: 'drawing',
      transform: { ...t, ox: t.ox + t.sx * (numAttr(off, 'x') ?? 0), oy: t.oy + t.sy * (numAttr(off, 'y') ?? 0) },
    },
    out,
  );
}

async function renderGraphicFrame(frameEl: Element, scope: Scope, out: HTMLElement): Promise<void> {
  const xfrm = child(frameEl, 'xfrm');
  const graphicData = path(frameEl, 'graphic', 'graphicData');
  const uri = attr(graphicData, 'uri') ?? '';
  if (!graphicData) return;

  if (uri.endsWith('/table')) {
    const frame = toFrame(xfrm, scope.transform);
    if (!frame) return;
    const table = await renderTable(graphicData, frame, scope.ctx, scope.part, scope.tableStyles);
    if (table) out.append(table);
    return;
  }
  if (uri.endsWith('/diagram')) {
    await renderDiagram(graphicData, xfrm, scope, out);
    return;
  }
  // OLE objects and similar carry a preview picture.
  const pic = descendant(graphicData, 'pic');
  if (pic) await renderPicture(pic, scope, out);
}

async function renderElement(el: Element, scope: Scope, out: HTMLElement): Promise<void> {
  switch (el.localName) {
    case 'sp':
    case 'cxnSp':
      return renderShape(el, scope, out);
    case 'pic':
      return renderPicture(el, scope, out);
    case 'grpSp':
      return renderGroup(el, scope, out);
    case 'graphicFrame':
      return renderGraphicFrame(el, scope, out);
    case 'AlternateContent': {
      // Fallback content is plain DrawingML that this renderer understands.
      const branch = child(el, 'Fallback') ?? child(el, 'Choice');
      for (const inner of children(branch)) await renderElement(inner, scope, out);
      return;
    }
  }
}

async function renderTree(tree: Element, scope: Scope, out: HTMLElement): Promise<void> {
  for (const el of children(tree)) {
    try {
      await renderElement(el, scope, out);
    } catch (error) {
      // One malformed shape shouldn't take the whole slide down.
      console.warn('[nyx] skipped shape', error);
    }
  }
}

async function background(parts: (Part | null)[], ctx: RenderContext): Promise<string> {
  for (const part of parts) {
    const bg = path(part?.doc.documentElement, 'cSld', 'bg');
    if (!part || !bg) continue;
    const bgPr = child(bg, 'bgPr');
    if (bgPr) {
      const fill = await resolveFill(fillElement(bgPr), ctx, part);
      if (fill) return fill.kind === 'none' ? '#fff' : fill.css;
    }
    const bgRef = child(bg, 'bgRef');
    if (bgRef) {
      const ref = styleRef(bgRef, ctx.theme.bgFillStyles, ctx);
      const fill = ref.el ? await resolveFill(ref.el, ctx, part, ref.color ?? undefined) : undefined;
      if (fill?.kind === 'paint') return fill.css;
      if (ref.color) return rgbaToCss(ref.color);
    }
  }
  return '#fff';
}

export async function renderSlide(
  slide: Part,
  ctx: RenderContext,
  size: { width: number; height: number },
  tableStyles: Document | null,
): Promise<HTMLElement> {
  const root = document.createElement('div');
  root.className = 'pptx-slide';
  root.style.width = `${size.width}px`;
  root.style.height = `${size.height}px`;
  root.style.background = await background([slide, ctx.layout, ctx.master], ctx);

  const base = { ctx, transform: IDENTITY, groupFill: null, tableStyles };
  const slideShowsMaster = boolAttr(slide.doc.documentElement, 'showMasterSp') ?? true;
  const layoutShowsMaster = boolAttr(ctx.layout?.doc.documentElement, 'showMasterSp') ?? true;

  if (slideShowsMaster && layoutShowsMaster && ctx.master) {
    const tree = path(ctx.master.doc.documentElement, 'cSld', 'spTree');
    if (tree) await renderTree(tree, { ...base, part: ctx.master, level: 'master' }, root);
  }
  if (slideShowsMaster && ctx.layout) {
    const tree = path(ctx.layout.doc.documentElement, 'cSld', 'spTree');
    if (tree) await renderTree(tree, { ...base, part: ctx.layout, level: 'layout' }, root);
  }
  const tree = path(slide.doc.documentElement, 'cSld', 'spTree');
  if (tree) await renderTree(tree, { ...base, part: slide, level: 'slide' }, root);
  return root;
}
