/**
 * Replaces the mouse cursor with a small lens that brightens whatever is
 * behind it. The lens follows the pointer inside `area`, and steps aside for
 * interactive controls marked with `[data-cursor]` so they keep a real cursor.
 */
export class Spotlight {
  private x = 0;
  private y = 0;
  private frame = 0;
  private area: HTMLElement | null = null;

  constructor(private readonly lens: HTMLElement) {}

  attach(area: HTMLElement): void {
    this.detach();
    this.area = area;
    // Fullscreen only paints the fullscreen element's subtree, so the lens has
    // to live inside the area it follows.
    area.append(this.lens);
    area.classList.add('has-spotlight');
    area.addEventListener('pointermove', this.onMove);
    area.addEventListener('pointerdown', this.onDown);
    area.addEventListener('pointerleave', this.hide);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('blur', this.hide);
  }

  detach(): void {
    const area = this.area;
    if (!area) return;
    area.classList.remove('has-spotlight');
    area.removeEventListener('pointermove', this.onMove);
    area.removeEventListener('pointerdown', this.onDown);
    area.removeEventListener('pointerleave', this.hide);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('blur', this.hide);
    this.area = null;
    document.body.append(this.lens);
    this.hide();
  }

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') {
      this.hide();
      return;
    }
    const overControl = (event.target as Element | null)?.closest('[data-cursor]');
    if (overControl) {
      this.hide();
      return;
    }
    this.x = event.clientX;
    this.y = event.clientY;
    this.lens.classList.add('is-visible');
    if (!this.frame) this.frame = requestAnimationFrame(this.paint);
  };

  private readonly paint = (): void => {
    this.frame = 0;
    this.lens.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
  };

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') this.lens.classList.add('is-pressed');
  };

  private readonly onUp = (): void => {
    this.lens.classList.remove('is-pressed');
  };

  private readonly hide = (): void => {
    this.lens.classList.remove('is-visible', 'is-pressed');
  };
}
