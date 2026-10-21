import { parseXml } from './xml';

/**
 * PowerPoint ships its table styles with the application, so files often
 * reference a style id without embedding its definition. "Medium Style 2" is
 * the default for new tables; its variants differ only by theme color.
 */
const MEDIUM_STYLE_2: Record<string, string> = {
  '{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}': 'dk1',
  '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': 'accent1',
  '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}': 'accent2',
  '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}': 'accent3',
  '{00A15C55-8517-42AA-B614-E9B94910E393}': 'accent4',
  '{7DF18680-E054-41AD-8BC1-D1AEF772440D}': 'accent5',
  '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}': 'accent6',
};

const solid = (color: string, mod = '') => `<a:solidFill><a:schemeClr val="${color}">${mod}</a:schemeClr></a:solidFill>`;
const line = (w: number) => `<a:ln w="${w}" cmpd="sng">${solid('lt1')}</a:ln>`;
const strongText = '<a:tcTxStyle b="on"><a:schemeClr val="lt1"/></a:tcTxStyle>';

function mediumStyle2(id: string, color: string): string {
  const sides = ['left', 'right', 'top', 'bottom', 'insideH', 'insideV'].map((s) => `<a:${s}>${line(12700)}</a:${s}>`).join('');
  const band = `<a:tcStyle><a:tcBdr/><a:fill>${solid(color, '<a:tint val="40000"/>')}</a:fill></a:tcStyle>`;
  const strong = (border = '') => `${strongText}<a:tcStyle><a:tcBdr>${border}</a:tcBdr><a:fill>${solid(color)}</a:fill></a:tcStyle>`;
  return `<a:tblStyle styleId="${id}">
    <a:wholeTbl>
      <a:tcTxStyle><a:schemeClr val="dk1"/></a:tcTxStyle>
      <a:tcStyle><a:tcBdr>${sides}</a:tcBdr><a:fill>${solid(color, '<a:tint val="20000"/>')}</a:fill></a:tcStyle>
    </a:wholeTbl>
    <a:band1H>${band}</a:band1H>
    <a:band1V>${band}</a:band1V>
    <a:lastCol>${strong()}</a:lastCol>
    <a:firstCol>${strong()}</a:firstCol>
    <a:lastRow>${strong(`<a:top>${line(38100)}</a:top>`)}</a:lastRow>
    <a:firstRow>${strong(`<a:bottom>${line(38100)}</a:bottom>`)}</a:firstRow>
  </a:tblStyle>`;
}

let cached: Document | null = null;

export function builtinTableStyles(): Document {
  cached ??= parseXml(
    `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${Object.entries(MEDIUM_STYLE_2)
      .map(([id, color]) => mediumStyle2(id, color))
      .join('')}</a:tblStyleLst>`,
  );
  return cached;
}
