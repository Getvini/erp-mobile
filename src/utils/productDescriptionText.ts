import { decodeHtmlEntities } from '@/utils/htmlText';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const plainTextToHtml = (text?: string | null): string =>
  String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('');

export const htmlToEditableText = (html?: string | null): string => {
  if (!html) return '';
  const withBreaks = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li\b[^<>]*>/gi, '• ')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<\/\s*(?:p|div|h[1-6]|blockquote|ul|ol|table|tr)\s*>/gi, '\n\n')
    .replace(/<[^<>]+>/g, '');

  return decodeHtmlEntities(withBreaks)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const resolveHtml = (original?: string | null, edited?: string): string =>
  edited === undefined ? original || '' : plainTextToHtml(edited);
