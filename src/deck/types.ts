import type { UnsupportedReason } from '../i18n/messages';

/**
 * A deck is a format-agnostic list of slides. Each loader (PDF, PPTX)
 * produces one, and the viewer only ever talks to this interface.
 */
export interface Deck {
  readonly title: string;
  readonly kind: 'pdf' | 'pptx';
  readonly slides: readonly Slide[];
  dispose(): void;
}

export interface Slide {
  /** Native width in CSS pixels. */
  readonly width: number;
  /** Native height in CSS pixels. */
  readonly height: number;
  /**
   * Renders the slide into a new element sized to `displayWidth` CSS pixels
   * (height follows the aspect ratio).
   */
  render(displayWidth: number): Promise<HTMLElement>;
}

/** A file the loaders can't present; `reason` picks the message shown to the user. */
export class UnsupportedFileError extends Error {
  constructor(readonly reason: UnsupportedReason) {
    super(reason);
  }
}
