import JSZip from 'jszip';
import { attr, children, parseXml } from './xml';

export interface Relationship {
  id: string;
  type: string;
  /** Absolute path inside the zip, or the raw URL for external targets. */
  target: string;
  external: boolean;
}

export interface Part {
  path: string;
  doc: Document;
  rels: Map<string, Relationship>;
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

/** Formats a browser can draw in an <img>. EMF/WMF previews are skipped. */
export const isRenderableImage = (path: string): boolean => {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ext in MIME_BY_EXT && ext !== 'tif' && ext !== 'tiff';
};

export function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/');
  parts.pop();
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.' && segment !== '') parts.push(segment);
  }
  return parts.join('/');
}

export function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  return `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`;
}

export class PptxPackage {
  private readonly parts = new Map<string, Promise<Part | null>>();
  private readonly media = new Map<string, Promise<string | null>>();
  private readonly urls: string[] = [];

  private constructor(private readonly zip: JSZip) {}

  static async open(data: ArrayBuffer): Promise<PptxPackage> {
    return new PptxPackage(await JSZip.loadAsync(data));
  }

  has(path: string): boolean {
    return this.zip.file(path) !== null;
  }

  part(path: string): Promise<Part | null> {
    let cached = this.parts.get(path);
    if (!cached) {
      cached = this.loadPart(path);
      this.parts.set(path, cached);
    }
    return cached;
  }

  private async loadPart(path: string): Promise<Part | null> {
    const file = this.zip.file(path);
    if (!file) return null;
    const doc = parseXml(await file.async('string'));
    const rels = new Map<string, Relationship>();
    const relsFile = this.zip.file(relsPathFor(path));
    if (relsFile) {
      const relsDoc = parseXml(await relsFile.async('string'));
      for (const rel of children(relsDoc.documentElement, 'Relationship')) {
        const id = attr(rel, 'Id');
        const target = attr(rel, 'Target');
        if (!id || !target) continue;
        const external = attr(rel, 'TargetMode') === 'External';
        rels.set(id, {
          id,
          type: attr(rel, 'Type') ?? '',
          target: external ? target : resolvePath(path, target),
          external,
        });
      }
    }
    return { path, doc, rels };
  }

  /** Object URL for a media file, or null if it can't be shown in a browser. */
  mediaUrl(path: string): Promise<string | null> {
    let cached = this.media.get(path);
    if (!cached) {
      cached = this.loadMedia(path);
      this.media.set(path, cached);
    }
    return cached;
  }

  private async loadMedia(path: string): Promise<string | null> {
    const file = this.zip.file(path);
    if (!file || !isRenderableImage(path)) return null;
    const ext = path.split('.').pop()!.toLowerCase();
    const blob = new Blob([await file.async('arraybuffer')], { type: MIME_BY_EXT[ext] });
    const url = URL.createObjectURL(blob);
    this.urls.push(url);
    return url;
  }

  dispose(): void {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.length = 0;
  }
}

export function relOfType(part: Part, suffix: string): Relationship | undefined {
  for (const rel of part.rels.values()) {
    if (rel.type.endsWith(suffix)) return rel;
  }
  return undefined;
}
