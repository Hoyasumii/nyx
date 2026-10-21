import type { Deck } from './types';
import { UnsupportedFileError } from './types';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.pptx'];

function sniff(bytes: Uint8Array): 'pdf' | 'zip' | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  return null;
}

const stripExtension = (name: string) => name.replace(/\.[^.]+$/, '');

/** Detects the file type by its magic bytes and loads the matching parser lazily. */
export async function loadDeck(file: File): Promise<Deck> {
  const data = await file.arrayBuffer();
  const kind = sniff(new Uint8Array(data.slice(0, 4)));
  const title = stripExtension(file.name);

  if (kind === 'pdf') {
    const { loadPdf } = await import('./pdf');
    return loadPdf(data, title);
  }
  if (kind === 'zip') {
    if (/\.(ppt|key|odp)$/i.test(file.name)) {
      throw new UnsupportedFileError('unsupportedFormat');
    }
    const { loadPptx } = await import('./pptx');
    return loadPptx(data, title);
  }
  throw new UnsupportedFileError('notPdfOrPptx');
}
