import {
  buildAllToken,
  buildTaskToken,
  buildUserToken,
  parseChatTokens,
} from '@/utils/chatTokenHelper';

export type ComposerTokenType = 'user' | 'task' | 'all';

export interface ComposerTokenRange {
  type: ComposerTokenType;
  id: string;
  display: string;
  start: number;
  end: number;
}

export interface ComposerDraft {
  text: string;
  ranges: ComposerTokenRange[];
}

export interface ComposerTokenInput {
  type: ComposerTokenType;
  id: string;
  display: string;
}

const getVisibleToken = (token: ComposerTokenInput): string =>
  `${token.type === 'task' ? '#' : '@'}${token.display}`;

export const deserializeComposerContent = (content?: string | null): ComposerDraft => {
  const segments = parseChatTokens(content);
  const ranges: ComposerTokenRange[] = [];
  let text = '';

  segments.forEach((segment) => {
    if (segment.type === 'text') {
      text += segment.content || '';
      return;
    }

    if (segment.type === 'legacy-task') {
      text += `#${segment.code || ''}`;
      return;
    }

    const display = segment.display || '';
    const visible = `${segment.type === 'task' ? '#' : '@'}${display}`;
    const start = text.length;
    text += visible;
    ranges.push({
      type: segment.type,
      id: segment.id || (segment.type === 'all' ? 'all' : ''),
      display,
      start,
      end: text.length,
    });
  });

  return { text, ranges };
};

export const serializeComposerContent = (
  text: string,
  ranges: ComposerTokenRange[]
): string => {
  let result = text;
  const validRanges = ranges
    .filter((range) => {
      if (range.start < 0 || range.end > text.length || range.start >= range.end) return false;
      return text.slice(range.start, range.end) === getVisibleToken(range);
    })
    .sort((a, b) => b.start - a.start);

  validRanges.forEach((range) => {
    const wireToken =
      range.type === 'task'
        ? buildTaskToken(range.id, range.display)
        : range.type === 'all'
          ? buildAllToken(range.display)
          : buildUserToken(range.id, range.display);
    result = `${result.slice(0, range.start)}${wireToken}${result.slice(range.end)}`;
  });

  return result;
};

export const insertComposerToken = (
  text: string,
  ranges: ComposerTokenRange[],
  replaceStart: number,
  replaceEnd: number,
  token: ComposerTokenInput
): ComposerDraft => {
  const visible = getVisibleToken(token);
  const actualStart =
    replaceStart > 0 && text[replaceStart - 1] === visible[0]
      ? replaceStart - 1
      : replaceStart;
  const inserted = `${visible} `;
  const nextText = `${text.slice(0, actualStart)}${inserted}${text.slice(replaceEnd)}`;
  const delta = inserted.length - (replaceEnd - actualStart);
  const nextRanges = ranges
    .filter((range) => range.end <= actualStart || range.start >= replaceEnd)
    .map((range) =>
      range.start >= replaceEnd
        ? { ...range, start: range.start + delta, end: range.end + delta }
        : range
    );

  nextRanges.push({
    ...token,
    start: actualStart,
    end: actualStart + visible.length,
  });

  return { text: nextText, ranges: nextRanges.sort((a, b) => a.start - b.start) };
};

export const reconcileComposerRanges = (
  previousText: string,
  nextText: string,
  ranges: ComposerTokenRange[]
): ComposerTokenRange[] => {
  if (previousText === nextText) return ranges;

  let prefixLength = 0;
  while (
    prefixLength < previousText.length &&
    prefixLength < nextText.length &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previousText.length - prefixLength &&
    suffixLength < nextText.length - prefixLength &&
    previousText[previousText.length - 1 - suffixLength] ===
      nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const previousEditEnd = previousText.length - suffixLength;
  const delta = nextText.length - previousText.length;

  return ranges
    .filter((range) => range.end <= prefixLength || range.start >= previousEditEnd)
    .map((range) =>
      range.start >= previousEditEnd
        ? { ...range, start: range.start + delta, end: range.end + delta }
        : range
    )
    .filter(
      (range) =>
        range.start >= 0 &&
        range.end <= nextText.length &&
        nextText.slice(range.start, range.end) === getVisibleToken(range)
    );
};

