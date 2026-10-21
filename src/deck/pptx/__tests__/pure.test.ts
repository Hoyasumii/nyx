import { describe, expect, it } from 'vitest';
import { hexToRgba, hslToRgb, rgbToHsl } from '../color';
import { presetOutline, presetTextRect } from '../geometry';
import { relsPathFor, resolvePath } from '../package';
import { autoNumber, fontStack } from '../text';

describe('package paths', () => {
  it('resolves relationship targets relative to the part', () => {
    expect(resolvePath('ppt/slides/slide1.xml', '../media/image1.png')).toBe('ppt/media/image1.png');
    expect(resolvePath('ppt/presentation.xml', 'slides/slide2.xml')).toBe('ppt/slides/slide2.xml');
    expect(resolvePath('ppt/slides/slide1.xml', '/ppt/media/a.png')).toBe('ppt/media/a.png');
  });

  it('locates the rels file of a part', () => {
    expect(relsPathFor('ppt/slides/slide3.xml')).toBe('ppt/slides/_rels/slide3.xml.rels');
  });
});

describe('colors', () => {
  it('round-trips through HSL', () => {
    const color = hexToRgba('4472C4');
    const [h, s, l] = rgbToHsl(color);
    const back = hslToRgb(h, s, l);
    expect(Math.round(back.r)).toBe(color.r);
    expect(Math.round(back.g)).toBe(color.g);
    expect(Math.round(back.b)).toBe(color.b);
  });
});

describe('geometry', () => {
  it('draws closed rectangles by default', () => {
    const outline = presetOutline('somethingUnknown', 100, 50);
    expect(outline.filled).toBe(true);
    expect(outline.d).toBe('M0 0 L100 0 L100 50 L0 50 Z');
  });

  it('treats connectors as open lines', () => {
    expect(presetOutline('straightConnector1', 10, 20)).toEqual({ d: 'M0 0 L10 20', filled: false });
  });

  it('places triangle text in the lower half', () => {
    expect(presetTextRect('triangle', 200, 100)).toEqual([50, 50, 150, 100]);
    expect(presetTextRect('rect', 200, 100)).toBeNull();
  });
});

describe('text', () => {
  it('formats auto-numbered bullets', () => {
    expect(autoNumber('arabicPeriod', 3)).toBe('3.');
    expect(autoNumber('alphaLcParenR', 2)).toBe('b)');
    expect(autoNumber('romanUcPeriod', 4)).toBe('IV.');
    expect(autoNumber('arabicParenBoth', 12)).toBe('(12)');
  });

  it('adds metric-compatible fallbacks for Office fonts', () => {
    expect(fontStack('Calibri')).toContain('"Carlito"');
    expect(fontStack('Georgia')).toContain('serif');
  });
});
