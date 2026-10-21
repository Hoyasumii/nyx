import type { Deck, Slide } from '../types';
import { UnsupportedFileError } from '../types';
import type { ColorContext } from './color';
import { PptxPackage, relOfType, type Part } from './package';
import { renderSlide } from './slide';
import { readTheme, type RenderContext, type Theme } from './style';
import { attr, child, children, emuToPx, numAttr, path, relAttr } from './xml';

const DEFAULT_COLOR_MAP: Record<string, string> = {
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
};

function colorMapOf(el: Element | null): Record<string, string> | null {
  if (!el) return null;
  const map: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) map[a.localName] = a.value;
  return map;
}

export async function loadPptx(data: ArrayBuffer, title: string): Promise<Deck> {
  const pkg = await PptxPackage.open(data);
  const presentation = await pkg.part('ppt/presentation.xml');
  if (!presentation) throw new UnsupportedFileError('Este arquivo não parece ser uma apresentação PowerPoint válida.');

  const root = presentation.doc.documentElement;
  const sldSz = child(root, 'sldSz');
  const size = {
    width: emuToPx(numAttr(sldSz, 'cx') ?? 12192000),
    height: emuToPx(numAttr(sldSz, 'cy') ?? 6858000),
  };
  const defaultTextStyle = child(root, 'defaultTextStyle');
  const tableStylesRel = relOfType(presentation, '/tableStyles');
  const tableStyles = tableStylesRel ? (await pkg.part(tableStylesRel.target))?.doc ?? null : null;

  const themes = new Map<string, Theme>();
  const slides: Slide[] = [];
  let slideNumber = 0;

  for (const sldId of children(child(root, 'sldIdLst'), 'sldId')) {
    const rel = presentation.rels.get(relAttr(sldId) ?? '');
    const slide = rel ? await pkg.part(rel.target) : null;
    if (!slide) continue;
    slideNumber++;
    if (attr(slide.doc.documentElement, 'show') === '0') continue;

    const layoutRel = relOfType(slide, '/slideLayout');
    const layout = layoutRel ? await pkg.part(layoutRel.target) : null;
    const masterRel = layout ? relOfType(layout, '/slideMaster') : undefined;
    const master = masterRel ? await pkg.part(masterRel.target) : null;
    const themeRel = master ? relOfType(master, '/theme') : undefined;

    let theme = themeRel ? themes.get(themeRel.target) : undefined;
    if (!theme) {
      const themePart: Part | null = themeRel ? await pkg.part(themeRel.target) : null;
      theme = readTheme(themePart?.doc);
      if (themeRel) themes.set(themeRel.target, theme);
    }

    const override = (part: Part | null) => colorMapOf(path(part?.doc.documentElement, 'clrMapOvr', 'overrideClrMapping'));
    const colors: ColorContext = {
      scheme: theme.colors,
      map:
        override(slide) ??
        override(layout) ??
        colorMapOf(child(master?.doc.documentElement, 'clrMap')) ??
        DEFAULT_COLOR_MAP,
    };
    const ctx: RenderContext = { pkg, theme, colors, master, layout, defaultTextStyle, slideNumber };

    let rendered: Promise<HTMLElement> | null = null;
    slides.push({
      ...size,
      async render(displayWidth: number) {
        rendered ??= renderSlide(slide, ctx, size, tableStyles);
        const native = (await rendered).cloneNode(true) as HTMLElement;
        const scale = displayWidth / size.width;
        native.style.transform = `scale(${scale})`;
        const frame = document.createElement('div');
        frame.className = 'pptx-frame';
        frame.style.width = `${displayWidth}px`;
        frame.style.height = `${size.height * scale}px`;
        frame.append(native);
        return frame;
      },
    });
  }

  if (!slides.length) throw new UnsupportedFileError('Não encontramos nenhum slide visível neste arquivo.');

  return { title, kind: 'pptx', slides, dispose: () => pkg.dispose() };
}
