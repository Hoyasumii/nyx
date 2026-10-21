// The legacy build bundles polyfills for features (e.g. Map.getOrInsertComputed)
// that current Safari and Chrome releases don't ship yet.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { Deck, Slide } from './types';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Upper bound for the backing store so huge displays don't exhaust memory. */
const MAX_CANVAS_PIXELS = 4096 * 4096;

export async function loadPdf(data: ArrayBuffer, title: string): Promise<Deck> {
  const task = getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const slides: Slide[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // PDF units are points; 1pt = 4/3 CSS px.
    const width = (base.width * 4) / 3;
    const height = (base.height * 4) / 3;

    slides.push({
      width,
      height,
      async render(displayWidth: number) {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        let scale = (displayWidth / base.width) * dpr;
        const pixels = base.width * base.height * scale * scale;
        if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = 'slide-canvas';
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${(displayWidth * height) / width}px`;

        await page.render({ canvas, viewport }).promise;
        return canvas;
      },
    });
  }

  return {
    title,
    kind: 'pdf',
    slides,
    dispose: () => void task.destroy(),
  };
}
