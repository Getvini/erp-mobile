/**
 * TIỆN ÍCH HTML THUẦN (không phụ thuộc DOM / thư viện ngoài)
 *
 * Dùng cho module Bảng tin công ty (Announcements) — nội dung là RICH TEXT HTML
 * do Web soạn qua editor. React Native không có `DOMParser`, nên toàn bộ việc
 * chuyển HTML → text/block được thực hiện bằng regex thuần (mirror tinh thần
 * `erp-UI/src/utils/html.js`).
 *
 * Hàm thuần 100% (không I/O, không state) ⇒ dễ unit test.
 */

export type RichTextBlockType = 'paragraph' | 'heading' | 'listItem' | 'quote';

export interface RichTextBlock {
  type: RichTextBlockType;
  text: string;
  /** Chỉ có với `heading`: cấp tiêu đề 1..6. */
  level?: number;
  /** `true` khi block có thẻ in đậm (`<strong>` / `<b>`). */
  bold?: boolean;
}

export interface HtmlMediaItem {
  url: string;
  type: 'image' | 'video';
}

/**
 * Thẻ block-level: ranh giới của chúng được chuyển thành xuống dòng để chữ
 * không bị dính liền nhau khi bóc thẻ.
 */
const BLOCK_BOUNDARY_TAGS =
  'p|div|br|li|ul|ol|blockquote|h[1-6]|tr|td|th|table|section|article|header|footer|figure|figcaption|hr';

/**
 * Nhóm thẻ có thể mở một "khối" nội dung riêng.
 * LƯU Ý: `ul`/`ol` CỐ Ý không nằm trong danh sách này để chúng "trong suốt" —
 * nhờ vậy các `<li>` bên trong vẫn được bắt thành block `listItem` thay vì bị
 * thẻ bao ngoài nuốt mất và render thành đoạn văn.
 */
const BLOCK_TAGS = 'p|div|h[1-6]|li|blockquote';

const BLOCK_CLOSE_RE = new RegExp(`<\\/\\s*(?:${BLOCK_BOUNDARY_TAGS})\\s*>`, 'gi');
const SELF_CLOSING_BREAK_RE = /<\s*br\s*\/?\s*>/gi;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
/** Bóc thẻ "well-formed": phần thuộc tính nằm trong cùng cặp `<...>`. */
const STRIP_TAG_RE = /<\/?[a-zA-Z][^<>]*>/g;
/** Bóc thẻ đóng còn sót sau khi đã xử lý ranh giới block. */
const STRIP_LEFTOVER_CLOSE_RE = /<\/\s*[a-zA-Z][^<>]*>?/g;

const BLOCK_OPEN_RE = new RegExp(`<\\s*(${BLOCK_TAGS})\\b[^<>]*>`, 'gi');
const IMG_TAG_RE = /<\s*img\b[^<>]*>/gi;
const VIDEO_TAG_RE = /<\s*video\b[^<>]*>/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const DATA_MEDIA_TYPE_RE = /\bdata-media-type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&laquo;': '«',
  '&raquo;': '»',
  '&middot;': '·',
  '&bull;': '•',
};

/** Giải mã các HTML entity phổ biến (dạng có tên, thập phân `&#233;`, hex `&#xE9;`). */
export const decodeHtmlEntities = (input?: string): string => {
  if (!input) return '';
  return String(input).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    const named = ENTITY_MAP[match.toLowerCase()];
    if (named !== undefined) return named;

    if (entity.charAt(0) === '#') {
      const isHex = entity.charAt(1) === 'x' || entity.charAt(1) === 'X';
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      if (!isNaN(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
    }

    return match;
  });
};

/**
 * Bóc toàn bộ thẻ HTML, giữ lại ranh giới khối dưới dạng `\n`.
 * `voidBlockTagsAsNewline`: `<br>` và các thẻ đóng block ⇒ `\n`;
 * mặc định `true` (dùng cho `htmlToPlainText`). Với `false`, `<br>` bị bỏ hẳn
 * (dùng khi bóc nội dung của MỘT block đơn lẻ để tránh sinh dòng rỗng thừa).
 */
const stripTagsKeepingBlocks = (html: string, voidBlockTagsAsNewline = true): string => {
  let out = String(html);
  out = out.replace(HTML_COMMENT_RE, ' ');
  out = out.replace(SELF_CLOSING_BREAK_RE, voidBlockTagsAsNewline ? '\n' : ' ');
  out = out.replace(BLOCK_CLOSE_RE, '\n');
  out = out.replace(STRIP_TAG_RE, '');
  out = out.replace(STRIP_LEFTOVER_CLOSE_RE, '');
  return out;
};

/** Bóc thẻ + giải mã entity + gộp khoảng trắng, KHÔNG giữ xuống dòng (dùng cho từng block). */
const toSingleLineText = (html: string): string =>
  decodeHtmlEntities(stripTagsKeepingBlocks(html, false))
    .replace(/[ \t\u00a0]+/g, ' ')
    .trim();

const hasBoldTag = (html: string): boolean => /<\s*(?:b|strong)\b[^<>]*>/i.test(html);

/**
 * Chuyển HTML rich text sang plain text.
 *
 * - Bỏ toàn bộ thẻ, giải mã entity phổ biến.
 * - Giữ xuống dòng cho `</p>`, `<br>`, `</li>` (và các thẻ block khác).
 * - Gộp khoảng trắng thừa, tối đa 1 dòng trống giữa 2 khối.
 */
export const htmlToPlainText = (html?: string): string => {
  if (!html) return '';

  const withNewlines = stripTagsKeepingBlocks(String(html), true);
  const decoded = decodeHtmlEntities(withNewlines);

  return decoded
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
};

/**
 * Trích `src` của mọi `<img>` / `<video>` trong HTML (mirror `extractMediaFromHtml`
 * của Web nhưng nới điều kiện: không bắt buộc class `editor-media`).
 *
 * Trả về mảng KHÔNG trùng URL; `<video>` hoặc thẻ có `data-media-type="video"`
 * được xếp vào `type: 'video'`, còn lại là `'image'`.
 */
export const extractMediaFromHtml = (html?: string): HtmlMediaItem[] => {
  if (!html) return [];

  const source = String(html);
  const results: HtmlMediaItem[] = [];
  const seen = new Set<string>();

  const collect = (tag: string, forcedType: HtmlMediaItem['type'] | null) => {
    const match = SRC_ATTR_RE.exec(tag);
    const url = match ? match[1] || match[2] || match[3] || '' : '';
    if (!url) return;

    const typeMatch = DATA_MEDIA_TYPE_RE.exec(tag);
    const dataMediaType = (typeMatch ? typeMatch[1] || typeMatch[2] || typeMatch[3] || '' : '').toLowerCase();
    const type: HtmlMediaItem['type'] =
      forcedType || (dataMediaType === 'video' ? 'video' : 'image');

    if (seen.has(url)) return;
    seen.add(url);
    results.push({ url, type });
  };

  for (const tag of source.match(IMG_TAG_RE) || []) {
    collect(tag, null);
  }
  for (const tag of source.match(VIDEO_TAG_RE) || []) {
    collect(tag, 'video');
  }

  return results;
};

/**
 * Parser regex ĐƠN GIẢN (không cần DOM) tách HTML thành các block để render
 * bằng React Native `<Text>`:
 * `<p>` → paragraph, `<h1..h6>` → heading (kèm `level`), `<li>` → listItem,
 * `<blockquote>` → quote, `<div>` → paragraph. `<ul>`/`<ol>` là thẻ trong suốt
 * nên mọi `<li>` bên trong đều trở thành block `listItem` riêng.
 *
 * - `text` của mỗi block đã đi qua `htmlToPlainText`.
 * - Block rỗng bị loại bỏ.
 * - Mỗi `<p>` là một block riêng; block `paragraph` có `bold: true` khi bên
 *   trong có `<strong>` / `<b>`.
 */
export const parseRichTextBlocks = (html?: string): RichTextBlock[] => {
  if (!html) return [];

  const source = String(html).replace(HTML_COMMENT_RE, ' ');
  const blocks: RichTextBlock[] = [];

  BLOCK_OPEN_RE.lastIndex = 0;
  let openMatch: RegExpExecArray | null;

  while ((openMatch = BLOCK_OPEN_RE.exec(source)) !== null) {
    const tag = (openMatch[1] || '').toLowerCase();
    const innerStart = openMatch.index + openMatch[0].length;
    const closeRe = new RegExp(`<\\/\\s*${tag}\\s*>`, 'i');
    const rest = source.slice(innerStart);
    const closeMatch = closeRe.exec(rest);
    const inner = closeMatch ? rest.slice(0, closeMatch.index) : rest;

    // Nhảy con trỏ qua toàn bộ block vừa lấy để không parse lồng nhau.
    BLOCK_OPEN_RE.lastIndex = closeMatch ? innerStart + closeMatch.index + closeMatch[0].length : source.length;

    const text = toSingleLineText(inner);
    if (!text) continue;

    if (tag === 'li') {
      blocks.push({ type: 'listItem', text });
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'quote', text });
    } else if (tag.charAt(0) === 'h' && tag.length === 2 && /[1-6]/.test(tag.charAt(1))) {
      blocks.push({ type: 'heading', text, level: Number(tag.charAt(1)) });
    } else if (tag === 'ul' || tag === 'ol') {
      // Danh sách không có `<li>` bên trong (hiếm) ⇒ giữ lại như đoạn văn.
      blocks.push({ type: 'paragraph', text });
    } else {
      blocks.push({ type: 'paragraph', text, bold: hasBoldTag(inner) || undefined });
    }
  }

  if (blocks.length > 0) return blocks;

  // Không có thẻ block nào (HTML chỉ có inline tag hoặc text trần).
  const fallback = htmlToPlainText(source);
  return fallback ? [{ type: 'paragraph', text: fallback }] : [];
};

/**
 * Cắt ngắn plain text an toàn cho preview.
 * Chuỗi đã ngắn hơn `max` được trả về nguyên vẹn (không thêm `…`).
 */
export const truncatePlainText = (text: string, max = 120): string => {
  if (!text) return '';
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (max <= 0) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}…`;
};
