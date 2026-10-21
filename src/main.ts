import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource/geist-mono/400.css';
import './styles/base.css';
import './styles/landing.css';
import './styles/viewer.css';
import './styles/pptx.css';

import { loadDeck } from './deck/load';
import { UnsupportedFileError } from './deck/types';
import { t } from './i18n';
import { bindLanguageSwitch } from './ui/lang-switch';
import { mountSponsor } from './ui/sponsor';
import { Spotlight } from './ui/spotlight';
import type { Viewer } from './ui/viewer';

const site = document.getElementById('site')!;
const drop = document.getElementById('drop')!;
const input = document.getElementById('file-input') as HTMLInputElement;
const dropFile = document.getElementById('drop-file')!;
const dropError = document.getElementById('drop-error')!;
const viewerHost = document.getElementById('viewer')!;
const spotlight = new Spotlight(document.getElementById('spotlight')!);

const DEFAULT_TITLE = document.title;

let viewer: Viewer | null = null;
let busy = false;

function setState(state: 'idle' | 'busy' | 'over'): void {
  drop.dataset.state = state;
}

function showError(message: string | null): void {
  dropError.hidden = !message;
  dropError.textContent = message ?? '';
}

function closeViewer(): void {
  if (!viewer) return;
  viewer.destroy();
  viewer = null;
  site.hidden = false;
  document.documentElement.classList.remove('is-viewing');
  document.title = DEFAULT_TITLE;
}

async function open(file: File): Promise<void> {
  if (busy) return;
  busy = true;
  showError(null);
  setState('busy');
  dropFile.textContent = file.name;

  try {
    const deck = await loadDeck(file);
    const { Viewer } = await import('./ui/viewer');
    closeViewer();
    site.hidden = true;
    document.documentElement.classList.add('is-viewing');
    document.title = `${deck.title} · Nyx`;
    viewer = new Viewer(deck, viewerHost, spotlight, () => history.back());
    if (history.state?.nyx !== 'viewer') history.pushState({ nyx: 'viewer' }, '');
  } catch (error) {
    console.error(error);
    showError(
      error instanceof UnsupportedFileError ? t.errors[error.reason] : t.errors.unreadable,
    );
  } finally {
    busy = false;
    setState('idle');
    input.value = '';
  }
}

window.addEventListener('popstate', () => {
  if (viewer && history.state?.nyx !== 'viewer') closeViewer();
});

input.addEventListener('change', () => {
  const file = input.files?.[0];
  if (file) void open(file);
});

// The light pool on the drop zone follows the pointer.
drop.addEventListener('pointermove', (event) => {
  const rect = drop.getBoundingClientRect();
  drop.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  drop.style.setProperty('--my', `${event.clientY - rect.top}px`);
});

// Files can be dropped anywhere on the page, including over an open deck.
let dragDepth = 0;
const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

window.addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth++;
  document.documentElement.classList.add('is-dragging');
  if (!busy) setState('over');
});
window.addEventListener('dragover', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    document.documentElement.classList.remove('is-dragging');
    if (!busy) setState('idle');
  }
});
window.addEventListener('drop', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  document.documentElement.classList.remove('is-dragging');
  const file = event.dataTransfer?.files[0];
  if (file) {
    if (viewer) history.replaceState({ nyx: 'viewer' }, '');
    void open(file);
  } else {
    setState('idle');
  }
});

setState('idle');
bindLanguageSwitch(document.getElementById('lang-switch')!);
mountSponsor(document.getElementById('sponsor')!);
