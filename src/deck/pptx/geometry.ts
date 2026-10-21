import { attr, child, children, EMU_PER_PX, numAttr, path } from './xml';

export interface Outline {
  /** SVG path data in shape-local CSS pixels. */
  d: string;
  /** Whether the outline encloses an area (false for lines and connectors). */
  filled: boolean;
}

type Point = [number, number];

const f = (n: number) => Math.round(n * 100) / 100;

const polygon = (points: Point[]): string =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ') + ' Z';

const rect = (w: number, h: number) => polygon([[0, 0], [w, 0], [w, h], [0, h]]);

function roundedRect(w: number, h: number, radii: [number, number, number, number]): string {
  const [tl, tr, br, bl] = radii.map((r) => Math.min(r, w / 2, h / 2));
  return [
    `M${f(tl)} 0`,
    `H${f(w - tr)}`,
    tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(w)} ${f(tr)}` : '',
    `V${f(h - br)}`,
    br ? `A${f(br)} ${f(br)} 0 0 1 ${f(w - br)} ${f(h)}` : '',
    `H${f(bl)}`,
    bl ? `A${f(bl)} ${f(bl)} 0 0 1 0 ${f(h - bl)}` : '',
    `V${f(tl)}`,
    tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(tl)} 0` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

const ellipse = (w: number, h: number) =>
  `M0 ${f(h / 2)} A${f(w / 2)} ${f(h / 2)} 0 1 1 ${f(w)} ${f(h / 2)} A${f(w / 2)} ${f(h / 2)} 0 1 1 0 ${f(h / 2)} Z`;

function star(w: number, h: number, points: number, inner: number): string {
  const pts: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1 : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push([w / 2 + (Math.cos(angle) * r * w) / 2, h / 2 + (Math.sin(angle) * r * h) / 2]);
  }
  return polygon(pts);
}

/** Reads `<a:gd name="adj" fmla="val 25000"/>` overrides. */
export function readAdjustments(prstGeom: Element | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const gd of children(child(prstGeom, 'avLst'), 'gd')) {
    const match = /^val\s+(-?\d+)/.exec(attr(gd, 'fmla') ?? '');
    const name = attr(gd, 'name');
    if (match && name) out[name] = Number(match[1]);
  }
  return out;
}

export function presetOutline(prst: string, w: number, h: number, adj: Record<string, number> = {}): Outline {
  const ss = Math.min(w, h);
  const a = (name: string, fallback: number) => (adj[name] ?? fallback) / 100000;

  switch (prst) {
    case 'line':
    case 'straightConnector1':
      return { d: `M0 0 L${f(w)} ${f(h)}`, filled: false };
    case 'bentConnector2':
      return { d: `M0 0 H${f(w)} V${f(h)}`, filled: false };
    case 'bentConnector3': {
      const x = w * a('adj1', 50000);
      return { d: `M0 0 H${f(x)} V${f(h)} H${f(w)}`, filled: false };
    }
    case 'curvedConnector3': {
      const x = w * a('adj1', 50000);
      return { d: `M0 0 C${f(x)} 0 ${f(x)} ${f(h)} ${f(w)} ${f(h)}`, filled: false };
    }
    case 'roundRect':
    case 'flowChartAlternateProcess': {
      const r = ss * a('adj', 16667);
      return { d: roundedRect(w, h, [r, r, r, r]), filled: true };
    }
    case 'round1Rect': {
      const r = ss * a('adj', 16667);
      return { d: roundedRect(w, h, [0, r, 0, 0]), filled: true };
    }
    case 'round2SameRect': {
      const r1 = ss * a('adj1', 16667);
      const r2 = ss * a('adj2', 0);
      return { d: roundedRect(w, h, [r1, r1, r2, r2]), filled: true };
    }
    case 'round2DiagRect': {
      const r1 = ss * a('adj1', 16667);
      const r2 = ss * a('adj2', 0);
      return { d: roundedRect(w, h, [r1, r2, r1, r2]), filled: true };
    }
    case 'flowChartTerminator':
      return { d: roundedRect(w, h, [ss / 2, ss / 2, ss / 2, ss / 2]), filled: true };
    case 'ellipse':
    case 'flowChartConnector':
      return { d: ellipse(w, h), filled: true };
    case 'triangle': {
      const x = w * a('adj', 50000);
      return { d: polygon([[x, 0], [w, h], [0, h]]), filled: true };
    }
    case 'rtTriangle':
      return { d: polygon([[0, 0], [w, h], [0, h]]), filled: true };
    case 'diamond':
    case 'flowChartDecision':
      return { d: polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]), filled: true };
    case 'parallelogram':
    case 'flowChartInputOutput': {
      const o = Math.min(ss * a('adj', 25000), w);
      return { d: polygon([[o, 0], [w, 0], [w - o, h], [0, h]]), filled: true };
    }
    case 'trapezoid': {
      const o = Math.min(ss * a('adj', 25000), w / 2);
      return { d: polygon([[o, 0], [w - o, 0], [w, h], [0, h]]), filled: true };
    }
    case 'hexagon': {
      const o = Math.min(ss * a('adj', 25000), w / 2);
      return { d: polygon([[o, 0], [w - o, 0], [w, h / 2], [w - o, h], [o, h], [0, h / 2]]), filled: true };
    }
    case 'octagon': {
      const o = Math.min(ss * a('adj', 29289), w / 2, h / 2);
      return {
        d: polygon([[o, 0], [w - o, 0], [w, o], [w, h - o], [w - o, h], [o, h], [0, h - o], [0, o]]),
        filled: true,
      };
    }
    case 'pentagon':
      return {
        d: polygon([[w / 2, 0], [w, h * 0.382], [w * 0.809, h], [w * 0.191, h], [0, h * 0.382]]),
        filled: true,
      };
    case 'homePlate': {
      const o = Math.min(ss * a('adj', 50000), w);
      return { d: polygon([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h]]), filled: true };
    }
    case 'chevron': {
      const o = Math.min(ss * a('adj', 50000), w);
      return { d: polygon([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h], [o, h / 2]]), filled: true };
    }
    case 'snip1Rect': {
      const o = ss * a('adj', 16667);
      return { d: polygon([[0, 0], [w - o, 0], [w, o], [w, h], [0, h]]), filled: true };
    }
    case 'snip2SameRect': {
      const o = ss * a('adj1', 16667);
      return { d: polygon([[o, 0], [w - o, 0], [w, o], [w, h], [0, h], [0, o]]), filled: true };
    }
    case 'plus':
    case 'mathPlus': {
      const o = ss * a('adj', 25000);
      return {
        d: polygon([
          [o, 0], [w - o, 0], [w - o, o], [w, o], [w, h - o], [w - o, h - o],
          [w - o, h], [o, h], [o, h - o], [0, h - o], [0, o], [o, o],
        ]),
        filled: true,
      };
    }
    case 'rightArrow':
    case 'leftArrow': {
      const t = h * a('adj1', 50000);
      const head = Math.min(ss * a('adj2', 50000), w);
      const y1 = (h - t) / 2;
      const y2 = y1 + t;
      const pts: Point[] = [[0, y1], [w - head, y1], [w - head, 0], [w, h / 2], [w - head, h], [w - head, y2], [0, y2]];
      return { d: polygon(prst === 'leftArrow' ? pts.map(([x, y]) => [w - x, y]) : pts), filled: true };
    }
    case 'downArrow':
    case 'upArrow': {
      const t = w * a('adj1', 50000);
      const head = Math.min(ss * a('adj2', 50000), h);
      const x1 = (w - t) / 2;
      const x2 = x1 + t;
      const pts: Point[] = [[x1, 0], [x2, 0], [x2, h - head], [w, h - head], [w / 2, h], [0, h - head], [x1, h - head]];
      return { d: polygon(prst === 'upArrow' ? pts.map(([x, y]) => [x, h - y]) : pts), filled: true };
    }
    case 'star4':
      return { d: star(w, h, 4, 0.25), filled: true };
    case 'star5':
      return { d: star(w, h, 5, 0.382), filled: true };
    case 'star6':
      return { d: star(w, h, 6, 0.5), filled: true };
    default:
      return { d: rect(w, h), filled: true };
  }
}

/** Converts `a:custGeom` path lists into SVG path data. */
export function customOutline(custGeom: Element, w: number, h: number): Outline | null {
  const paths = children(path(custGeom, 'pathLst'), 'path');
  if (!paths.length) return null;

  const guides: Record<string, number> = { w, h };
  for (const gd of children(child(custGeom, 'gdLst'), 'gd')) {
    const match = /^val\s+(-?\d+)/.exec(attr(gd, 'fmla') ?? '');
    const name = attr(gd, 'name');
    if (match && name) guides[name] = Number(match[1]);
  }
  const value = (raw: string | null) => {
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : guides[raw] ?? 0;
  };

  let d = '';
  let filled = false;
  for (const p of paths) {
    // A path without its own coordinate space uses the shape's EMU size,
    // and a zero-sized one (flat lines) must not divide by zero.
    const pw = numAttr(p, 'w');
    const ph = numAttr(p, 'h');
    const sx = pw ? w / pw : 1 / EMU_PER_PX;
    const sy = ph ? h / ph : 1 / EMU_PER_PX;
    if (attr(p, 'fill') !== 'none') filled = true;

    let cx = 0;
    let cy = 0;
    const pt = (el: Element | null): Point => [value(attr(el, 'x')), value(attr(el, 'y'))];

    for (const cmd of children(p)) {
      const pts = children(cmd, 'pt').map(pt);
      switch (cmd.localName) {
        case 'moveTo':
          [cx, cy] = pts[0];
          d += `M${f(cx * sx)} ${f(cy * sy)} `;
          break;
        case 'lnTo':
          [cx, cy] = pts[0];
          d += `L${f(cx * sx)} ${f(cy * sy)} `;
          break;
        case 'cubicBezTo':
          d += `C${pts.map(([x, y]) => `${f(x * sx)} ${f(y * sy)}`).join(' ')} `;
          [cx, cy] = pts[2];
          break;
        case 'quadBezTo':
          d += `Q${pts.map(([x, y]) => `${f(x * sx)} ${f(y * sy)}`).join(' ')} `;
          [cx, cy] = pts[1];
          break;
        case 'arcTo': {
          const wR = value(attr(cmd, 'wR'));
          const hR = value(attr(cmd, 'hR'));
          const st = (value(attr(cmd, 'stAng')) / 60000) * (Math.PI / 180);
          const sw = (value(attr(cmd, 'swAng')) / 60000) * (Math.PI / 180);
          const centerX = cx - wR * Math.cos(st);
          const centerY = cy - hR * Math.sin(st);
          cx = centerX + wR * Math.cos(st + sw);
          cy = centerY + hR * Math.sin(st + sw);
          const large = Math.abs(sw) > Math.PI ? 1 : 0;
          const sweep = sw > 0 ? 1 : 0;
          d += `A${f(wR * sx)} ${f(hR * sy)} 0 ${large} ${sweep} ${f(cx * sx)} ${f(cy * sy)} `;
          break;
        }
        case 'close':
          d += 'Z ';
          break;
      }
    }
  }
  return { d: d.trim(), filled };
}

/**
 * The text rectangle of a preset shape (`l, t, r, b` in px), following the
 * `rect` element of the preset definitions. Null means the full bounding box.
 */
export function presetTextRect(
  prst: string,
  w: number,
  h: number,
  adj: Record<string, number> = {},
): [number, number, number, number] | null {
  const ss = Math.min(w, h);
  const a = (name: string, fallback: number) => (adj[name] ?? fallback) / 100000;
  switch (prst) {
    case 'ellipse':
    case 'flowChartConnector': {
      const dx = w * 0.14645;
      const dy = h * 0.14645;
      return [dx, dy, w - dx, h - dy];
    }
    case 'roundRect': {
      const inset = ss * a('adj', 16667) * 0.29289;
      return [inset, inset, w - inset, h - inset];
    }
    case 'triangle': {
      const x = w * a('adj', 50000);
      return [x / 2, h / 2, (x + w) / 2, h];
    }
    case 'rtTriangle':
      return [w / 12, (h * 7) / 12, (w * 7) / 12, (h * 11) / 12];
    case 'diamond':
    case 'flowChartDecision':
      return [w / 4, h / 4, (w * 3) / 4, (h * 3) / 4];
    case 'rightArrow':
    case 'leftArrow': {
      const t = h * a('adj1', 50000);
      const head = Math.min(ss * a('adj2', 50000), w);
      const y1 = (h - t) / 2;
      return prst === 'rightArrow' ? [0, y1, w - head * 0.5, y1 + t] : [head * 0.5, y1, w, y1 + t];
    }
    case 'homePlate':
    case 'chevron': {
      const o = Math.min(ss * a('adj', 50000), w);
      return prst === 'chevron' ? [o, 0, w - o, h] : [0, 0, w - o / 2, h];
    }
    case 'hexagon': {
      const o = ss * a('adj', 25000);
      return [o / 2, h / 6, w - o / 2, (h * 5) / 6];
    }
    case 'parallelogram':
    case 'trapezoid': {
      const o = ss * a('adj', 25000);
      return [o / 2, 0, w - o / 2, h];
    }
    default:
      return null;
  }
}
