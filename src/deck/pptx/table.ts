import { builtinTableStyles } from './builtin-table-styles';
import { readColor, rgbaToCss, type Rgba } from './color';
import type { Part } from './package';
import { fillElement, resolveFill, resolveStroke, styleRef, type RenderContext } from './style';
import { renderText } from './text';
import { attr, boolAttr, child, children, descendant, emuToPx, numAttr } from './xml';

interface CellLook {
  fill?: string;
  bold?: boolean;
  color?: Rgba;
  borders: Partial<Record<'top' | 'right' | 'bottom' | 'left', string>>;
}

const NO_BORDER = 'none';

function borderCss(ln: Element | null, ctx: RenderContext): string | undefined {
  if (!ln) return undefined;
  if (child(ln, 'noFill')) return NO_BORDER;
  const stroke = resolveStroke(ln, { el: null, color: null }, ctx);
  return stroke ? `${stroke.width}px solid ${stroke.color}` : undefined;
}

/** Borders defined inside a table style part (`a:tcBdr/a:left/a:ln`). */
function styleBorder(part: Element | null, side: string, ctx: RenderContext): string | undefined {
  const holder = child(child(child(part, 'tcStyle'), 'tcBdr'), side);
  if (!holder) return undefined;
  const ln = child(holder, 'ln');
  if (ln) return borderCss(ln, ctx);
  const ref = child(holder, 'lnRef');
  if (ref) {
    const resolved = resolveStroke(null, styleRef(ref, ctx.theme.lineStyles, ctx), ctx);
    return resolved ? `${resolved.width}px solid ${resolved.color}` : undefined;
  }
  return undefined;
}

async function applyStylePart(
  look: CellLook,
  part: Element | null,
  ctx: RenderContext,
  owner: Part,
  edges: { top: boolean; bottom: boolean; left: boolean; right: boolean },
  region: 'whole' | 'row' | 'col',
): Promise<void> {
  if (!part) return;
  const tcStyle = child(part, 'tcStyle');
  const fillHolder = child(tcStyle, 'fill');
  const fill = await resolveFill(fillElement(fillHolder), ctx, owner);
  if (fill) look.fill = fill.kind === 'none' ? 'transparent' : fill.css;
  const fillRef = child(tcStyle, 'fillRef');
  if (fillRef && !fill) {
    const ref = styleRef(fillRef, ctx.theme.fillStyles, ctx);
    const resolved = await resolveFill(fillElement(ref.el) ?? ref.el, ctx, owner, ref.color ?? undefined);
    if (resolved) look.fill = resolved.kind === 'none' ? 'transparent' : resolved.css;
    else if (ref.color) look.fill = rgbaToCss(ref.color);
  }

  const tx = child(part, 'tcTxStyle');
  if (tx) {
    const b = attr(tx, 'b');
    if (b) look.bold = b === 'on';
    const color = readColor(tx, ctx.colors) ?? readColor(child(tx, 'fontRef'), ctx.colors);
    if (color) look.color = color;
  }

  const pick = (outer: string, inner: string, isEdge: boolean, rowOrColSide: boolean) =>
    region !== 'whole' && rowOrColSide ? styleBorder(part, outer, ctx) : styleBorder(part, isEdge ? outer : inner, ctx);
  const top = pick('top', 'insideH', edges.top, region === 'row');
  const bottom = pick('bottom', 'insideH', edges.bottom, region === 'row');
  const left = pick('left', 'insideV', edges.left, region === 'col');
  const right = pick('right', 'insideV', edges.right, region === 'col');
  if (top) look.borders.top = top;
  if (bottom) look.borders.bottom = bottom;
  if (left) look.borders.left = left;
  if (right) look.borders.right = right;
}

export async function renderTable(
  graphicData: Element,
  frame: { x: number; y: number; w: number; h: number },
  ctx: RenderContext,
  owner: Part,
  tableStyles: Document | null,
): Promise<HTMLElement | null> {
  const tbl = descendant(graphicData, 'tbl');
  if (!tbl) return null;
  const tblPr = child(tbl, 'tblPr');
  const flags = {
    firstRow: boolAttr(tblPr, 'firstRow') ?? false,
    lastRow: boolAttr(tblPr, 'lastRow') ?? false,
    firstCol: boolAttr(tblPr, 'firstCol') ?? false,
    lastCol: boolAttr(tblPr, 'lastCol') ?? false,
    bandRow: boolAttr(tblPr, 'bandRow') ?? false,
    bandCol: boolAttr(tblPr, 'bandCol') ?? false,
  };
  const styleId = child(tblPr, 'tableStyleId')?.textContent?.trim();
  const findStyle = (doc: Document | null) =>
    children(doc?.documentElement, 'tblStyle').find((s) => attr(s, 'styleId') === styleId) ?? null;
  const style = styleId ? findStyle(tableStyles) ?? findStyle(builtinTableStyles()) : null;

  const cols = children(child(tbl, 'tblGrid'), 'gridCol').map((c) => emuToPx(numAttr(c, 'w') ?? 0));
  const rows = children(tbl, 'tr');

  const table = document.createElement('table');
  table.className = 'pptx-table';
  Object.assign(table.style, { left: `${frame.x}px`, top: `${frame.y}px`, width: `${cols.reduce((a, b) => a + b, 0)}px` });
  const tableFill = await resolveFill(fillElement(tblPr), ctx, owner);
  if (tableFill?.kind === 'paint') table.style.background = tableFill.css;

  const colgroup = document.createElement('colgroup');
  for (const w of cols) {
    const col = document.createElement('col');
    col.style.width = `${w}px`;
    colgroup.append(col);
  }
  table.append(colgroup);

  const otherStyle = child(child(ctx.master?.doc.documentElement, 'txStyles'), 'otherStyle');
  const styleChain = [otherStyle, ctx.defaultTextStyle].filter((e): e is Element => e !== null);

  for (const [r, tr] of rows.entries()) {
    const row = document.createElement('tr');
    row.style.height = `${emuToPx(numAttr(tr, 'h') ?? 0)}px`;
    const cells = children(tr, 'tc');
    for (const [c, tc] of cells.entries()) {
      if (boolAttr(tc, 'hMerge') || boolAttr(tc, 'vMerge')) continue;
      const colSpan = numAttr(tc, 'gridSpan') ?? 1;
      const rowSpan = numAttr(tc, 'rowSpan') ?? 1;
      const lastCol = c + colSpan - 1 === cols.length - 1;
      const lastRow = r + rowSpan - 1 === rows.length - 1;
      const edges = { top: r === 0, bottom: lastRow, left: c === 0, right: lastCol };

      const look: CellLook = { borders: {} };
      if (style) {
        await applyStylePart(look, child(style, 'wholeTbl'), ctx, owner, edges, 'whole');
        const dataRow = r - (flags.firstRow ? 1 : 0);
        if (flags.bandRow && !(flags.firstRow && r === 0) && !(flags.lastRow && lastRow)) {
          await applyStylePart(look, child(style, dataRow % 2 === 0 ? 'band1H' : 'band2H'), ctx, owner, edges, 'row');
        }
        const dataCol = c - (flags.firstCol ? 1 : 0);
        if (flags.bandCol && !(flags.firstCol && c === 0) && !(flags.lastCol && lastCol)) {
          await applyStylePart(look, child(style, dataCol % 2 === 0 ? 'band1V' : 'band2V'), ctx, owner, edges, 'col');
        }
        if (flags.lastCol && lastCol) await applyStylePart(look, child(style, 'lastCol'), ctx, owner, edges, 'col');
        if (flags.firstCol && c === 0) await applyStylePart(look, child(style, 'firstCol'), ctx, owner, edges, 'col');
        if (flags.lastRow && lastRow) await applyStylePart(look, child(style, 'lastRow'), ctx, owner, edges, 'row');
        if (flags.firstRow && r === 0) await applyStylePart(look, child(style, 'firstRow'), ctx, owner, edges, 'row');
      }

      const tcPr = child(tc, 'tcPr');
      const ownFill = await resolveFill(fillElement(tcPr), ctx, owner);
      if (ownFill) look.fill = ownFill.kind === 'none' ? 'transparent' : ownFill.css;
      const sides = { left: 'lnL', right: 'lnR', top: 'lnT', bottom: 'lnB' } as const;
      for (const [side, tag] of Object.entries(sides) as [keyof typeof sides, string][]) {
        const css = borderCss(child(tcPr, tag), ctx);
        if (css) look.borders[side] = css;
      }

      const td = document.createElement('td');
      if (colSpan > 1) td.colSpan = colSpan;
      if (rowSpan > 1) td.rowSpan = rowSpan;
      if (look.fill) td.style.background = look.fill;
      for (const [side, css] of Object.entries(look.borders)) {
        td.style.setProperty(`border-${side}`, css);
      }
      const insets: [number, number, number, number] = [
        emuToPx(numAttr(tcPr, 'marT') ?? 45720),
        emuToPx(numAttr(tcPr, 'marR') ?? 91440),
        emuToPx(numAttr(tcPr, 'marB') ?? 45720),
        emuToPx(numAttr(tcPr, 'marL') ?? 91440),
      ];
      td.style.padding = insets.map((n) => `${n}px`).join(' ');
      const anchor = attr(tcPr, 'anchor');
      td.style.verticalAlign = anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top';

      const txBody = child(tc, 'txBody');
      if (txBody) {
        const text = renderText({
          txBody,
          bodyPrChain: [child(txBody, 'bodyPr')].filter((e): e is Element => e !== null),
          styleChain: [child(txBody, 'lstStyle'), ...styleChain].filter((e): e is Element => e !== null),
          baseRun: { bold: look.bold, color: look.color },
          insets: [0, 0, 0, 0],
          ctx,
        });
        if (text) {
          text.classList.add('is-cell');
          td.append(text);
        }
      }
      row.append(td);
    }
    table.append(row);
  }
  return table;
}
