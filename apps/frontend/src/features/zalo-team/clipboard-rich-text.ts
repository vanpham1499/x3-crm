import { packStyles, type RichStyle } from './rich-text';

/** Read an inert clipboard fragment; never attach its HTML or load its assets. */
export function clipboardRichText(html: string): { text: string; styles: RichStyle[] } | null {
  if (!html || html.length > 100_000) return null;
  const template = document.createElement('template');
  template.innerHTML = html;
  let text = '',
    visited = 0;
  const matrix: string[][] = [];
  const append = (value: string, marks: string[]) => {
    text += value;
    for (let i = 0; i < value.length; i++) matrix.push(marks);
  };
  const newline = (marks: string[]) => {
    if (text && !text.endsWith('\n')) append('\n', marks);
  };
  const walk = (node: Node, inherited: string[] = [], list?: string) => {
    if (++visited > 10_000 || text.length > 2000) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const value = (node.textContent || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
      if (/^\s*\n\s*$/.test(value)) return;
      append(value, inherited);
      return;
    }
    if (!(node instanceof HTMLElement)) {
      node.childNodes.forEach((n) => walk(n, inherited, list));
      return;
    }
    const tag = node.tagName;
    if (
      [
        'SCRIPT',
        'STYLE',
        'NOSCRIPT',
        'IFRAME',
        'OBJECT',
        'EMBED',
        'SVG',
        'IMG',
        'VIDEO',
        'AUDIO',
        'TEMPLATE',
        'META',
        'LINK',
      ].includes(tag)
    )
      return;
    if (tag === 'BR') {
      append('\n', inherited);
      return;
    }
    const block = /^(P|DIV|LI|H[1-6]|BLOCKQUOTE|PRE)$/.test(tag);
    if (block) newline(inherited);
    const marks = [...inherited];
    const set = (code: string) => {
      const family = code.split('_')[0];
      for (let i = marks.length - 1; i >= 0; i--)
        if (marks[i].split('_')[0] === family) marks.splice(i, 1);
      marks.push(code);
    };
    const css = node.style;
    if (
      ['B', 'STRONG'].includes(tag) ||
      /^H[1-6]$/.test(tag) ||
      ['bold', 'bolder'].includes(css.fontWeight) ||
      Number(css.fontWeight) >= 500
    )
      set('b');
    if (['I', 'EM'].includes(tag) || css.fontStyle === 'italic') set('i');
    if (tag === 'U' || css.textDecoration.includes('underline')) set('u');
    if (['S', 'STRIKE', 'DEL'].includes(tag) || css.textDecoration.includes('line-through'))
      set('s');
    const color = css.color || (tag === 'FONT' ? node.getAttribute('color') || '' : '');
    const rgb = color.match(/^rgb\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)\s*\)$/);
    if (rgb && rgb.slice(1).every((n) => Number(n) <= 255))
      set(
        `c_${rgb
          .slice(1)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('')}`,
      );
    else if (/^#[\da-f]{6}$/i.test(color)) set(`c_${color.slice(1)}`);
    else if (/^#[\da-f]{3}$/i.test(color))
      set(
        `c_${color
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')}`,
      );
    const size = parseFloat(css.fontSize);
    if (size && /px$/.test(css.fontSize))
      set(
        `f_${[13, 15, 18, 20].reduce((a, b) => (Math.abs(size - b) < Math.abs(size - a) ? b : a))}`,
      );
    const nextList = tag === 'OL' ? 'lst_2' : tag === 'UL' ? 'lst_1' : list;
    if (tag === 'LI' && nextList) set(nextList);
    node.childNodes.forEach((n) => walk(n, marks, nextList));
    if (block) newline(marks);
  };
  walk(template.content);
  text = text.replace(/\n+$/, '');
  if (!text || text.length > 2000 || visited > 10_000) return null;
  const styles = packStyles(text, matrix);
  return styles.length <= 250 ? { text, styles } : null;
}
