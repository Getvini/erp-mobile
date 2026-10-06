import { decodeHtmlEntities } from '@/utils/htmlText';

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type ExtractedBlock =
  | { type: 'heading'; runs: InlineRun[] }
  | { type: 'text'; runs: InlineRun[] }
  | { type: 'kv'; label: string; items: string[]; wide: boolean }
  | { type: 'table'; rows: string[][] }
  | { type: 'listItem'; runs: InlineRun[]; marker: string; depth: number }
  | { type: 'quote'; runs: InlineRun[] };

interface RawLine {
  runs: InlineRun[];
  kind: 'normal' | 'heading' | 'listItem' | 'quote';
  marker: string;
  depth: number;
  block: number;
}

const HEADING_MAX_CHARS = 90;
const KV_LABEL_MAX_WORDS = 7;
const KV_STACKED_LABEL_CHARS = 28;
const UPPER_RATIO = 0.8;
const KV_RE = /^(.{1,60}?):\s+(.+)$/;
const SENTENCE_END_RE = /[.!?;…:。]$/;
const TOKEN_RE = /<!--[\s\S]*?-->|<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>|[^<]+|</g;
const BREAK_TAGS = new Set(['tr', 'td', 'th', 'table', 'section', 'article', 'header', 'footer', 'figure', 'figcaption', 'hr', 'br']);
const BLOCK_TAGS = new Set(['p', 'div']);
const HEADING_TAG_RE = /^h[1-6]$/;

const collapse = (value: string): string => value.replace(/[\s\u00a0]+/g, ' ');

const plainText = (runs: InlineRun[]): string => collapse(runs.map((run) => run.text).join('')).trim();

const hasMarkup = (runs: InlineRun[]): boolean => runs.some((run) => run.bold || run.italic || run.underline);

const isUpperHeavy = (text: string): boolean => {
  const cased = [...text].filter((ch) => ch.toLowerCase() !== ch.toUpperCase());
  if (cased.length < 3) return false;
  const upper = cased.filter((ch) => ch === ch.toUpperCase()).length;
  return upper / cased.length >= UPPER_RATIO;
};

const startsLowercase = (text: string): boolean => {
  const ch = text.charAt(0);
  return ch !== '' && ch === ch.toLowerCase() && ch !== ch.toUpperCase();
};

const tokenizeLines = (html: string): RawLine[] => {
  const lines: RawLine[] = [];
  const lists: { ordered: boolean; count: number }[] = [];
  let runs: InlineRun[] = [];
  let bold = 0;
  let italic = 0;
  let underline = 0;
  let heading = 0;
  let quote = 0;
  let inLi = 0;
  let pendingMarker = '';
  let block = 0;

  const flush = () => {
    const current = runs;
    runs = [];
    if (current.length === 0) return;
    current[0] = { ...current[0], text: current[0].text.replace(/^\s+/, '') };
    const last = current.length - 1;
    current[last] = { ...current[last], text: current[last].text.replace(/\s+$/, '') };
    const cleaned = current.filter((run) => run.text !== '');
    if (cleaned.length === 0) return;

    let kind: RawLine['kind'] = 'normal';
    let marker = '';
    if (heading > 0) {
      kind = 'heading';
    } else if (inLi > 0) {
      kind = 'listItem';
      marker = pendingMarker;
      pendingMarker = '';
    } else if (quote > 0) {
      kind = 'quote';
    }
    lines.push({ runs: cleaned, kind, marker, depth: Math.max(lists.length - 1, 0), block });
  };

  const pushText = (raw: string) => {
    const text = collapse(decodeHtmlEntities(raw));
    if (!text) return;
    const style = { bold: bold > 0 || undefined, italic: italic > 0 || undefined, underline: underline > 0 || undefined };
    const prev = runs[runs.length - 1];
    if (prev && prev.bold === style.bold && prev.italic === style.italic && prev.underline === style.underline) {
      prev.text += text;
    } else {
      runs.push({ text, ...style });
    }
  };

  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(html)) !== null) {
    const token = match[0];
    if (token.startsWith('<!--')) continue;
    const tag = match[2] ? match[2].toLowerCase() : '';
    if (!tag) {
      if (token !== '<') pushText(token);
      continue;
    }
    const closing = match[1] === '/';

    if (tag === 'b' || tag === 'strong') bold = Math.max(0, bold + (closing ? -1 : 1));
    else if (tag === 'i' || tag === 'em') italic = Math.max(0, italic + (closing ? -1 : 1));
    else if (tag === 'u') underline = Math.max(0, underline + (closing ? -1 : 1));
    else if (tag === 'ul' || tag === 'ol') {
      flush();
      if (closing) lists.pop();
      else lists.push({ ordered: tag === 'ol', count: 0 });
    } else if (tag === 'li') {
      flush();
      if (closing) {
        inLi = Math.max(0, inLi - 1);
        pendingMarker = '';
      } else {
        const list = lists[lists.length - 1];
        if (list) list.count += 1;
        pendingMarker = list && list.ordered ? `${list.count}.` : '•';
        inLi += 1;
      }
    } else if (tag === 'blockquote') {
      flush();
      quote = Math.max(0, quote + (closing ? -1 : 1));
    } else if (HEADING_TAG_RE.test(tag)) {
      flush();
      heading = Math.max(0, heading + (closing ? -1 : 1));
      block += 1;
    } else if (BLOCK_TAGS.has(tag)) {
      flush();
      block += 1;
    } else if (BREAK_TAGS.has(tag)) {
      flush();
    }
  }
  flush();
  return lines;
};

const toBlocks = (lines: RawLine[]): ExtractedBlock[] => {
  const blocks: ExtractedBlock[] = [];
  let lastTextBlock = -1;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.kind === 'heading') {
      blocks.push({ type: 'heading', runs: line.runs });
      i += 1;
      continue;
    }
    if (line.kind === 'listItem') {
      blocks.push({ type: 'listItem', runs: line.runs, marker: line.marker, depth: line.depth });
      i += 1;
      continue;
    }
    if (line.kind === 'quote') {
      blocks.push({ type: 'quote', runs: line.runs });
      i += 1;
      continue;
    }

    const text = plainText(line.runs);

    if (text.includes(' | ')) {
      const cells = text.split(/\s+\|\s+/).map((cell) => cell.trim()).filter(Boolean);
      if (cells.length >= 2) {
        const rows: string[][] = [cells];
        i += 1;
        while (i < lines.length && lines[i].kind === 'normal') {
          const nextText = plainText(lines[i].runs);
          if (!nextText.includes(' | ')) break;
          const nextCells = nextText.split(/\s+\|\s+/).map((cell) => cell.trim()).filter(Boolean);
          if (nextCells.length < 2) break;
          rows.push(nextCells);
          i += 1;
        }
        blocks.push({ type: 'table', rows });
        lastTextBlock = -1;
        continue;
      }
    }

    if (!hasMarkup(line.runs)) {
      const kv = text.match(KV_RE);
      if (kv && !kv[1].includes(';') && kv[1].trim().split(' ').length <= KV_LABEL_MAX_WORDS) {
        const label = kv[1].trim();
        const items = kv[2].split(/\s*;\s*/).map((part) => part.trim()).filter(Boolean);
        blocks.push({ type: 'kv', label, items, wide: label.length > KV_STACKED_LABEL_CHARS });
        lastTextBlock = -1;
        i += 1;
        continue;
      }
    }

    if (text.length <= HEADING_MAX_CHARS && !text.includes(';') && isUpperHeavy(text)) {
      blocks.push({ type: 'heading', runs: line.runs });
      lastTextBlock = -1;
      i += 1;
      continue;
    }

    const prevBlock = lastTextBlock >= 0 ? blocks[lastTextBlock] : null;
    if (
      prevBlock &&
      prevBlock.type === 'text' &&
      lastTextBlock === blocks.length - 1 &&
      lines[i - 1] &&
      lines[i - 1].block === line.block &&
      !SENTENCE_END_RE.test(plainText(prevBlock.runs)) &&
      startsLowercase(text)
    ) {
      prevBlock.runs = [...prevBlock.runs, { text: ' ' }, ...line.runs];
    } else {
      blocks.push({ type: 'text', runs: line.runs });
      lastTextBlock = blocks.length - 1;
    }
    i += 1;
  }

  return blocks;
};

export const parseExtractedBlocks = (html?: string | null): ExtractedBlock[] => {
  if (!html) return [];
  return toBlocks(tokenizeLines(String(html).replace(/\r\n?/g, '\n')));
};
