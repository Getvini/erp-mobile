import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { cellInBounds, isCellScanned } from '@/utils/sheetScope';
import type { PreviewWindow, ScanRegion, ScenarioBounds, SpellCellState } from '@/utils/sheetScope';

import { CELL_H, CELL_W, HEAD_H, LINE_H, MAX_LINES, ROW_HEAD_W, TAG_COLOR, TONE, clamp } from './gridMetrics';
import type { CellTag, ScenarioArea } from './gridMetrics';

interface GridCellsProps {
  data: PreviewWindow;
  scenarioAreas: ScenarioArea[];
  fixedRegions: ScanRegion[];
  draftRegions: ScanRegion[];
  spellCells?: Map<string, SpellCellState>;
  areas: ScenarioBounds[] | null;
  showScanState: boolean;
  tagMap: Map<string, CellTag[]>;
}

export const GridCells = memo(function GridCells({
  data,
  scenarioAreas,
  fixedRegions,
  draftRegions,
  spellCells,
  areas,
  showScanState,
  tagMap,
}: GridCellsProps) {
  const layout = useMemo(() => {
    const spans = new Map<string, { rowSpan: number; colSpan: number }>();
    const covered = new Set<string>();
    const rowEnd = data.rowStart + data.rows.length - 1;
    const colEnd = data.colStart + (data.rows[0]?.length || 0) - 1;
    (data.merges || []).forEach((m) => {
      const r0 = Math.max(m.startRow, data.rowStart);
      const c0 = Math.max(m.startCol, data.colStart);
      const r1 = Math.min(m.endRow, rowEnd);
      const c1 = Math.min(m.endCol, colEnd);
      if (r1 < r0 || c1 < c0) return;
      spans.set(`${r0}:${c0}`, { rowSpan: r1 - r0 + 1, colSpan: c1 - c0 + 1 });
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          if (r !== r0 || c !== c0) covered.add(`${r}:${c}`);
        }
      }
    });
    return { spans, covered };
  }, [data]);

  const cells: React.ReactNode[] = [];
  data.rows.forEach((line, rIdx) => {
    const row = data.rowStart + rIdx;
    line.forEach((value, cIdx) => {
      const col = data.colStart + cIdx;
      const key = `${row}:${col}`;
      if (layout.covered.has(key)) return;
      const span = layout.spans.get(key);
      const width = (span?.colSpan || 1) * CELL_W;
      const height = (span?.rowSpan || 1) * CELL_H;
      const spell = spellCells?.get(key);
      const scenarioHit = scenarioAreas.find((s) => cellInBounds(s.bounds, row, col));
      const draftHit = draftRegions.find((r) => cellInBounds(r, row, col));
      const fixedHit = fixedRegions.find((r) => cellInBounds(r, row, col));
      let tone = TONE.base;
      if (spell === 'confirmed') tone = TONE.spell;
      else if (spell === 'dismissed') tone = TONE.spellOff;
      else if (draftHit) tone = TONE.draft;
      else if (fixedHit) tone = TONE.fixed;
      else if (scenarioHit) tone = scenarioHit.selected ? TONE.scenarioOn : TONE.scenarioOff;
      const scanned = !showScanState || isCellScanned(areas, row, col);
      const tags = tagMap.get(key);
      cells.push(
        <View
          key={key}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ROW_HEAD_W + cIdx * CELL_W,
            top: HEAD_H + rIdx * CELL_H,
            width,
            height,
            backgroundColor: tone,
            borderWidth: 0.5,
            borderColor: '#e2e8f0',
            padding: 3,
            overflow: 'hidden',
          }}
        >
          {value ? (
            <Text
              numberOfLines={clamp(Math.floor((height - 6) / LINE_H), 1, MAX_LINES)}
              style={{
                fontSize: 10,
                lineHeight: LINE_H,
                color: scanned ? '#1e293b' : '#cbd5e1',
                textDecorationLine: spell === 'dismissed' ? 'line-through' : 'none',
              }}
            >
              {value}
            </Text>
          ) : null}
          {tags ? (
            <View style={{ position: 'absolute', top: 0, right: 0, flexDirection: 'row' }}>
              {tags.map((tag, index) => (
                <View
                  key={`${tag.kind}-${tag.text}-${index}`}
                  style={{ backgroundColor: TAG_COLOR[tag.kind], paddingHorizontal: 3, borderBottomLeftRadius: 3 }}
                >
                  <Text style={{ fontSize: 9, lineHeight: 12, fontWeight: '700', color: '#ffffff' }}>{tag.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    });
  });
  return <>{cells}</>;
});
