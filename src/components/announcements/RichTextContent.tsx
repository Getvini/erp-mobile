import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseRichTextBlocks, RichTextBlock } from '@/utils/htmlText';

export interface RichTextContentProps {
  /** RICH TEXT HTML do Web soạn. */
  html?: string;
  /** Hiển thị khi nội dung rỗng. */
  emptyText?: string;
  style?: any;
}

const HEADING_SIZES: Record<number, number> = {
  1: 20,
  2: 18,
  3: 17,
  4: 16,
  5: 15,
  6: 15,
};

/**
 * Render rich text HTML bằng thuần React Native `<Text>` (KHÔNG dùng WebView).
 * Parser regex ở `@/utils/htmlText` tách `<p>`, `<h1..h6>`, `<li>`, `<blockquote>`.
 */
export const RichTextContent: React.FC<RichTextContentProps> = ({
  html,
  emptyText = 'Không có nội dung.',
  style,
}) => {
  const blocks = useMemo(() => parseRichTextBlocks(html), [html]);

  if (blocks.length === 0) {
    return (
      <Text style={[styles.empty, style]} testID="rich-text-empty">
        {emptyText}
      </Text>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {blocks.map((block: RichTextBlock, index) => {
        const key = `${block.type}-${block.level ?? 0}-${index}`;

        if (block.type === 'heading') {
          const level = block.level ?? 3;
          return (
            <Text
              key={key}
              style={[styles.heading, { fontSize: HEADING_SIZES[level] ?? 16 }]}
            >
              {block.text}
            </Text>
          );
        }

        if (block.type === 'listItem') {
          return (
            <View key={key} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.paragraph, styles.listText]}>{block.text}</Text>
            </View>
          );
        }

        if (block.type === 'quote') {
          return (
            <View key={key} style={styles.quoteBox}>
              <Text style={styles.quoteText}>{block.text}</Text>
            </View>
          );
        }

        return (
          <Text
            key={key}
            style={[styles.paragraph, block.bold ? styles.paragraphBold : null]}
          >
            {block.text}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  empty: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1E293B',
  },
  paragraphBold: {
    fontWeight: '700',
  },
  heading: {
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 26,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 2,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    color: '#F38820',
    fontWeight: '900',
  },
  listText: {
    flex: 1,
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  quoteText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: '#475569',
    fontStyle: 'italic',
  },
});

export default RichTextContent;
