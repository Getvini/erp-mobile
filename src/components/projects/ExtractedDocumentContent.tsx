import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import RichTextContent from '@/components/announcements/RichTextContent';
import { ExtractedBlock, InlineRun, parseExtractedBlocks } from '@/utils/extractedLayout';

interface ExtractedDocumentContentProps {
  html?: string | null;
}

const Runs = ({ runs }: { runs: InlineRun[] }) => (
  <>
    {runs.map((run, index) => (
      <Text
        key={index}
        style={[
          run.bold ? styles.bold : null,
          run.italic ? styles.italic : null,
          run.underline ? styles.underline : null,
        ]}
      >
        {run.text}
      </Text>
    ))}
  </>
);

const Table = ({ rows }: { rows: string[][] }) => {
  const columns = Math.max(...rows.map((row) => row.length));
  const header = rows.length > 1;
  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View style={styles.table}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tableRow}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <View
                key={colIndex}
                style={[styles.tableCell, header && rowIndex === 0 ? styles.tableHeadCell : null]}
              >
                <Text style={[styles.cellText, header && rowIndex === 0 ? styles.bold : null]}>
                  {row[colIndex] ?? ''}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const Block = ({ block }: { block: ExtractedBlock }) => {
  switch (block.type) {
    case 'heading':
      return (
        <View style={styles.heading}>
          <Text style={[styles.text, styles.bold]}>
            <Runs runs={block.runs} />
          </Text>
        </View>
      );
    case 'kv':
      return (
        <View style={styles.kv}>
          <Text style={styles.kvLabel}>{block.label}:</Text>
          {block.items.length > 1 ? (
            <View style={styles.items}>
              {block.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemBullet}>•</Text>
                  <Text style={[styles.text, styles.flex]}>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>{block.items[0] ?? ''}</Text>
          )}
        </View>
      );
    case 'table':
      return <Table rows={block.rows} />;
    case 'listItem':
      return (
        <View style={[styles.itemRow, { paddingLeft: 4 + block.depth * 14 }]}>
          <Text style={[styles.itemBullet, styles.marker]}>{block.marker}</Text>
          <Text style={[styles.text, styles.flex]}>
            <Runs runs={block.runs} />
          </Text>
        </View>
      );
    case 'quote':
      return (
        <View style={styles.quote}>
          <Text style={styles.quoteText}>
            <Runs runs={block.runs} />
          </Text>
        </View>
      );
    default:
      return (
        <Text style={styles.text}>
          <Runs runs={block.runs} />
        </Text>
      );
  }
};

export function ExtractedDocumentContent({ html }: ExtractedDocumentContentProps) {
  const blocks = useMemo(() => {
    try {
      return parseExtractedBlocks(html);
    } catch {
      return null;
    }
  }, [html]);

  if (!blocks || blocks.length === 0) return <RichTextContent html={html || ''} />;

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => (
        <Block key={`${block.type}-${index}`} block={block} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  flex: { flex: 1 },
  text: { fontSize: 14, lineHeight: 23, color: '#1F2937' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  heading: {
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
    paddingLeft: 8,
    marginTop: 6,
  },
  kv: { gap: 2 },
  kvLabel: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: '#475569' },
  items: { gap: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  itemBullet: { fontSize: 14, lineHeight: 23, color: '#94A3B8' },
  marker: { minWidth: 14 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  quoteText: { fontSize: 13.5, lineHeight: 21, color: '#475569', fontStyle: 'italic' },
  tableScroll: { marginVertical: 2 },
  table: { borderWidth: 1, borderColor: '#CBD5E1' },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    width: 130,
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeadCell: { backgroundColor: '#F1F5F9' },
  cellText: { fontSize: 13, lineHeight: 19, color: '#1F2937' },
});

export default ExtractedDocumentContent;
