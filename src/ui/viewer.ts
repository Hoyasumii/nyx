import type { Deck, Slide } from '../deck/types';
import { t } from '../i18n';
import { icons } from './icons';
import type { Spotlight } from './spotlight';

const HUD_IDLE_MS = 2200;
const STAGE_PADDING = 40;
const THUMB_WIDTH = 168;
const GRID_THUMB_WIDTH = 280;

const pad = (n: number, size: number) => String(n).padStart(Math.max(2, size), '0');
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) el.setAttribute(key, value);
  }
  if (html) el.innerHTML = html;
  return el;
}

/** Renders slides lazily into thumbnail buttons as they scroll into view. */
function lazyThumbs(
  root: HTMLElement,
  deck: Deck,
  width: number,
  className: string,
  onPick: (index: number) => void,
): HTMLButtonElement[] {
  const buttons = deck.slides.map((slide, i) => {
    const button = h('button', {
      type: 'button',
      class: className,
      'aria-label': t.viewer.goTo(i + 1),
      'data-index': String(i),
    });
    const frame = h('span', { class: 'thumb-frame' });
    frame.style.aspectRatio = `${slide.width} / ${slide.height}`;
    const label = h('span', { class: 'thumb-n' });
    label.textContent = String(i + 1);
    button.append(frame, label);
    button.addEventListener('click', () => onPick(i));
    return button;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const index = Number((entry.target as HTMLElement).dataset.index);
        const frame = entry.target.querySelector('.thumb-frame')!;
        deck.slides[index]
          .render(width)
          .then((el) => frame.append(el))
          .catch(() => frame.classList.add('is-broken'));
      }
    },
    { root, rootMargin: '400px' },
  );
  buttons.forEach((b) => observer.observe(b));
  return buttons;
}

export class Viewer {
  readonly root: HTMLElement;
  private index = 0;
  private renderToken = 0;
  private cache = new Map<number, { width: number; el: Promise<HTMLElement> }>();
  private hudTimer = 0;
  private resizeTimer = 0;
  private touchStart: { x: number; y: number } | null = null;
  private readonly cleanups: (() => void)[] = [];

  private readonly stage: HTMLElement;
  private readonly slot: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly hudCounter: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly stripThumbs: HTMLButtonElement[];
  private gridThumbs: HTMLButtonElement[] | null = null;

  constructor(
    private readonly deck: Deck,
    host: HTMLElement,
    private readonly spotlight: Spotlight,
    private readonly onClose: () => void,
  ) {
    this.root = host;
    const total = deck.slides.length;
    const digits = String(total).length;

    host.innerHTML = '';
    host.className = 'viewer';

    const bar = h('header', { class: 'v-bar', 'data-cursor': '' });
    const back = h('button', { type: 'button', class: 'icon-btn', 'data-action': 'close', title: t.viewer.back, 'aria-label': t.viewer.close }, icons.back);
    const title = h('div', { class: 'v-title' });
    const kind = h('span', { class: 'v-kind' });
    kind.textContent = deck.kind.toUpperCase();
    const name = h('span', { class: 'v-name' });
    name.textContent = deck.title;
    title.append(kind, name);
    this.counter = h('div', { class: 'v-count', 'aria-live': 'polite' });
    const actions = h('div', { class: 'v-actions' });
    actions.append(
      h('button', { type: 'button', class: 'icon-btn', 'data-action': 'grid', title: t.viewer.gridHint, 'aria-label': t.viewer.showAll }, icons.grid),
      h('button', { type: 'button', class: 'button button-light', 'data-action': 'present', title: t.viewer.presentHint }, `${icons.play}<span>${t.viewer.present}</span>`),
    );
    bar.append(back, title, this.counter, actions);

    this.stage = h('div', { class: 'v-stage' });
    this.slot = h('div', { class: 'v-slot' });
    this.stage.append(
      h('button', { type: 'button', class: 'v-nav is-prev', 'data-cursor': '', 'data-action': 'prev', 'aria-label': t.viewer.prev }, icons.prev),
      this.slot,
      h('button', { type: 'button', class: 'v-nav is-next', 'data-cursor': '', 'data-action': 'next', 'aria-label': t.viewer.next }, icons.next),
      h('div', { class: 'v-blackout', 'aria-hidden': 'true' }),
    );

    this.strip = h('nav', { class: 'v-strip', 'data-cursor': '', 'aria-label': t.viewer.thumbnails });
    this.stripThumbs = lazyThumbs(this.strip, deck, THUMB_WIDTH, 'thumb', (i) => this.go(i));
    this.strip.append(...this.stripThumbs);

    const hud = h('div', { class: 'v-hud', 'data-cursor': '' });
    this.hudCounter = h('span', { class: 'v-hud-count' });
    hud.append(
      h('button', { type: 'button', class: 'icon-btn', 'data-action': 'prev', 'aria-label': t.viewer.prev }, icons.prev),
      this.hudCounter,
      h('button', { type: 'button', class: 'icon-btn', 'data-action': 'next', 'aria-label': t.viewer.next }, icons.next),
      h('span', { class: 'v-hud-sep', 'aria-hidden': 'true' }),
      h('button', { type: 'button', class: 'icon-btn', 'data-action': 'grid', 'aria-label': t.viewer.showAll }, icons.grid),
      h('button', { type: 'button', class: 'icon-btn', 'data-action': 'present', 'aria-label': t.viewer.exitFullscreen }, icons.shrink),
    );

    this.progress = h('div', { class: 'v-progress', 'aria-hidden': 'true' }, '<span></span>');

    this.grid = h('div', { class: 'v-grid', 'data-cursor': '', role: 'dialog', 'aria-label': t.viewer.allSlides });
    this.grid.hidden = true;
    const gridHead = h('div', { class: 'v-grid-head' });
    const gridTitle = h('p', { class: 'v-grid-title' });
    gridTitle.innerHTML = t.viewer.slideCount(total);
    gridHead.append(gridTitle, h('button', { type: 'button', class: 'icon-btn', 'data-action': 'grid', 'aria-label': t.viewer.closeGrid }, icons.close));
    this.grid.append(gridHead, h('div', { class: 'v-grid-body' }));

    host.append(bar, this.stage, this.strip, hud, this.progress, this.grid);
    host.style.setProperty('--digits', String(digits));
    host.hidden = false;

    this.bind();
    this.spotlight.attach(this.root);
    this.go(0, 0);
  }

  // --- Navigation ---------------------------------------------------------

  go(index: number, direction?: number): void {
    const total = this.deck.slides.length;
    const next = Math.min(Math.max(index, 0), total - 1);
    if (next === this.index && this.slot.childElementCount && direction === undefined) return;
    const dir = direction ?? Math.sign(next - this.index);
    this.index = next;
    this.setBlackout(false);

    const digits = String(total).length;
    this.counter.innerHTML = `<span class="is-current">${pad(next + 1, digits)}</span><span class="v-count-sep">/</span><span>${pad(total, digits)}</span>`;
    this.hudCounter.textContent = `${next + 1} / ${total}`;
    (this.progress.firstElementChild as HTMLElement).style.transform = `scaleX(${(next + 1) / total})`;
    this.root.classList.toggle('is-first', next === 0);
    this.root.classList.toggle('is-last', next === total - 1);

    this.stripThumbs.forEach((b, i) => b.toggleAttribute('aria-current', i === next));
    this.stripThumbs[next]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    this.gridThumbs?.forEach((b, i) => b.toggleAttribute('aria-current', i === next));

    void this.paint(dir);
  }

  next = () => this.go(this.index + 1);
  prev = () => this.go(this.index - 1);

  private fitWidth(slide: Slide): number {
    const rect = this.stage.getBoundingClientRect();
    const padding = this.isPresenting() ? 0 : rect.width < 600 ? 12 : STAGE_PADDING;
    const availW = Math.max(rect.width - padding * 2, 50);
    const availH = Math.max(rect.height - padding * 2, 50);
    return Math.floor(Math.min(availW, (availH * slide.width) / slide.height));
  }

  private renderAt(index: number): Promise<HTMLElement> {
    const slide = this.deck.slides[index];
    const width = this.fitWidth(slide);
    const cached = this.cache.get(index);
    if (cached && cached.width === width) return cached.el;
    const el = slide.render(width);
    this.cache.set(index, { width, el });
    return el;
  }

  private async paint(direction: number): Promise<void> {
    const token = ++this.renderToken;
    this.root.classList.add('is-loading');
    let el: HTMLElement;
    try {
      el = await this.renderAt(this.index);
    } catch (error) {
      console.error(error);
      if (token !== this.renderToken) return;
      const broken = h('div', { class: 'v-broken' });
      broken.textContent = t.viewer.broken;
      el = broken;
    }
    if (token !== this.renderToken) return;
    this.root.classList.remove('is-loading');

    const wrapper = h('div', { class: 'v-sheet' });
    wrapper.append(el);
    this.slot.replaceChildren(wrapper);
    if (direction && !prefersReducedMotion()) {
      wrapper.animate(
        [
          { opacity: 0, transform: `translateX(${direction * 14}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
    }

    // Warm up neighbours so arrow keys feel instant.
    for (const n of [this.index + 1, this.index - 1]) {
      if (n >= 0 && n < this.deck.slides.length) void this.renderAt(n).catch(() => undefined);
    }
  }

  // --- Modes --------------------------------------------------------------

  private isPresenting(): boolean {
    return this.root.classList.contains('is-presenting');
  }

  async togglePresent(): Promise<void> {
    if (this.isPresenting()) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      this.setPresenting(false);
      return;
    }
    this.setPresenting(true);
    if (this.root.requestFullscreen && !document.fullscreenElement) {
      await this.root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    }
  }

  private setPresenting(on: boolean): void {
    this.root.classList.toggle('is-presenting', on);
    this.setGrid(false);
    this.pokeHud();
    this.cache.clear();
    void this.paint(0);
  }

  private isGridOpen(): boolean {
    return !this.grid.hidden;
  }

  private setGrid(open: boolean): void {
    if (open === this.isGridOpen()) return;
    this.grid.hidden = !open;
    this.root.classList.toggle('is-grid', open);
    if (open) {
      if (!this.gridThumbs) {
        const body = this.grid.querySelector<HTMLElement>('.v-grid-body')!;
        this.gridThumbs = lazyThumbs(this.grid, this.deck, GRID_THUMB_WIDTH, 'thumb thumb-lg', (i) => {
          this.setGrid(false);
          this.go(i);
        });
        body.append(...this.gridThumbs);
      }
      this.gridThumbs.forEach((b, i) => b.toggleAttribute('aria-current', i === this.index));
      this.gridThumbs[this.index]?.scrollIntoView({ block: 'center' });
      this.gridThumbs[this.index]?.focus({ preventScroll: true });
    }
  }

  private setBlackout(on?: boolean): void {
    this.root.classList.toggle('is-blackout', on);
  }

  private pokeHud(): void {
    this.root.classList.add('is-active');
    window.clearTimeout(this.hudTimer);
    this.hudTimer = window.setTimeout(() => this.root.classList.remove('is-active'), HUD_IDLE_MS);
  }

  // --- Events -------------------------------------------------------------

  private listen<E extends Event>(target: EventTarget, type: string, fn: (event: E) => void): void {
    const listener = fn as EventListener;
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }

  private bind(): void {
    this.listen<MouseEvent>(this.root, 'click', (event) => {
      const action = (event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
      switch (action) {
        case 'close':
          return this.onClose();
        case 'prev':
          return this.prev();
        case 'next':
          return this.next();
        case 'grid':
          return this.setGrid(!this.isGridOpen());
        case 'present':
          return void this.togglePresent();
      }
      // Clicking the slide itself advances while presenting, like a clicker.
      if (this.isPresenting() && this.stage.contains(event.target as Node)) this.next();
    });

    this.listen<KeyboardEvent>(window, 'keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      const handled = (() => {
        switch (key) {
          case 'ArrowRight':
          case 'ArrowDown':
          case 'PageDown':
          case ' ':
          case 'Enter':
          case 'n':
            if (this.isGridOpen() && (key === 'Enter' || key === ' ')) return false;
            this.next();
            return true;
          case 'ArrowLeft':
          case 'ArrowUp':
          case 'PageUp':
          case 'Backspace':
          case 'p':
            this.prev();
            return true;
          case 'Home':
            this.go(0);
            return true;
          case 'End':
            this.go(this.deck.slides.length - 1);
            return true;
          case 'f':
          case 'F':
            void this.togglePresent();
            return true;
          case 'g':
          case 'G':
            this.setGrid(!this.isGridOpen());
            return true;
          case 'b':
          case 'B':
          case '.':
            this.setBlackout();
            return true;
          case 'Escape':
            if (this.isGridOpen()) this.setGrid(false);
            else if (this.root.classList.contains('is-blackout')) this.setBlackout(false);
            else if (this.isPresenting()) void this.togglePresent();
            else this.onClose();
            return true;
        }
        return false;
      })();
      if (handled) event.preventDefault();
    });

    this.listen(document, 'fullscreenchange', () => {
      if (!document.fullscreenElement && this.isPresenting()) this.setPresenting(false);
    });

    this.listen(this.root, 'pointermove', () => {
      if (this.isPresenting()) this.pokeHud();
    });

    this.listen<PointerEvent>(this.stage, 'pointerdown', (e) => {
      if (e.pointerType !== 'mouse') this.touchStart = { x: e.clientX, y: e.clientY };
    });
    this.listen<PointerEvent>(this.stage, 'pointerup', (e) => {
      if (!this.touchStart) return;
      const dx = e.clientX - this.touchStart.x;
      const dy = e.clientY - this.touchStart.y;
      this.touchStart = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) this.next();
        else this.prev();
      }
    });

    const resize = new ResizeObserver(() => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.cache.clear();
        void this.paint(0);
      }, 120);
    });
    resize.observe(this.stage);
    this.cleanups.push(() => resize.disconnect());
  }

  destroy(): void {
    this.renderToken++;
    window.clearTimeout(this.hudTimer);
    window.clearTimeout(this.resizeTimer);
    this.cleanups.forEach((fn) => fn());
    this.spotlight.detach();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    this.root.hidden = true;
    this.root.className = 'viewer';
    this.root.innerHTML = '';
    this.cache.clear();
    this.deck.dispose();
  }
}
