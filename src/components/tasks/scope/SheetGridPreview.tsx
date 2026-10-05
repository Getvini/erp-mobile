import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { PreviewSource } from '@/utils/sheetPreviewSource';
import { boundsOfScenario, colLetters, parseCellRef, scenarioCode } from '@/utils/sheetScope';
import type {
  Bounds,
  PreviewWindow,
  ScanRegion,
  ScenarioBounds,
  ScenarioInfo,
  SheetBounds,
  SpellCellState,
} from '@/utils/sheetScope';
import GridNavButton from './GridNavButton';
import { GridCells } from './SheetGridCells';
import { useGridDraw } from './useGridDraw';
import {
  CELL_H,
  CELL_W,
  COL_COUNT,
  COL_STEP,
  EMPTY_REGIONS,
  EMPTY_SCENARIOS,
  FLASH_MS,
  HEAD_H,
  ROW_COUNT,
  ROW_HEAD_W,
  ROW_STEP,
  TONE,
  clamp,
} from './gridMetrics';
import type { CellPoint, CellTag, ScenarioArea } from './gridMetrics';
import type { DrawMeta, DrawMode, ScopeFocus, ScopeTool } from './scopeTypes';

const LINE = { borderWidth: 0.5, borderColor: '#e2e8f0' } as const;

interface SheetGridPreviewProps {
  source: PreviewSource | null;
  sheet: string | null;
  scenarios?: ScenarioInfo[];
  selectedScenarioIds?: string[] | null;
  fixedRegions?: ScanRegion[];
  draftRegions?: ScanRegion[];
  spellCells?: Map<string, SpellCellState>;
  qcRows?: Set<number>;
  areas?: ScenarioBounds[] | null;
  showScanState?: boolean;
  tool?: ScopeTool;
  focus?: ScopeFocus | null;
  activeRegionId?: string | null;
  drawMode?: DrawMode;
  onScenarioTap?: (id: string) => void;
  onScenarioHold?: (id: string) => void;
  onPickRegion?: (row: number, col: number) => boolean;
  onDrawRegion?: (bounds: SheetBounds, meta: DrawMeta) => void;
}

export default function SheetGridPreview({
  source,
  sheet,
  scenarios = EMPTY_SCENARIOS,
  selectedScenarioIds = null,
  fixedRegions = EMPTY_REGIONS,
  draftRegions = EMPTY_REGIONS,
  spellCells,
  qcRows,
  areas = null,
  showScanState = false,
  tool = 'view',
  focus = null,
  activeRegionId = null,
  drawMode = 'new',
  onScenarioTap,
  onScenarioHold,
  onPickRegion,
  onDrawRegion,
}: SheetGridPreviewProps) {
  const [origin, setOrigin] = useState({ row: 1, col: 1 });
  const [data, setData] = useState<PreviewWindow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [gotoText, setGotoText] = useState('');
  const [flash, setFlash] = useState<CellPoint | null>(null);
  const requestId = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verticalRef = useRef<ScrollView>(null);
  const horizontalRef = useRef<ScrollView>(null);

  const scenarioAreas = useMemo<ScenarioArea[]>(() => {
    const selected = selectedScenarioIds ? new Set(selectedScenarioIds) : null;
    return scenarios.map((scenario) => ({
      scenario,
      bounds: boundsOfScenario(scenario),
      selected: selected ? selected.has(scenario.id) : true,
    }));
  }, [scenarios, selectedScenarioIds]);

  const { drag, anchor, panHandlers, scenarioAtPoint } = useGridDraw({
    tool,
    sheet,
    data,
    scenarioAreas,
    resetKey: `${sheet || ''}|${source?.key || ''}`,
    onPickRegion,
    onDrawRegion,
  });

  const showFlash = useCallback((cell: CellPoint) => {
    setFlash(cell);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  useEffect(() => {
    setOrigin({ row: 1, col: 1 });
    setData(null);
    setError('');
  }, [sheet, source?.key]);

  useEffect(() => {
    if (!focus || focus.sheet !== sheet) return;
    setOrigin({ row: Math.max(1, focus.row - 4), col: Math.max(1, focus.col - 2) });
    showFlash({ row: focus.row, col: focus.col });
  }, [focus?.nonce, focus?.sheet, focus?.row, focus?.col, sheet, showFlash]);

  useEffect(() => {
    if (!source || !sheet) return undefined;
    requestId.current += 1;
    const id = requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await source.load({
          sheet,
          rowStart: origin.row,
          rowCount: ROW_COUNT,
          colStart: origin.col,
          colCount: COL_COUNT,
        });
        if (id !== requestId.current) return;
        setData(result);
        setError('');
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error && err.message ? err.message : 'Không thể tải dữ liệu bảng');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [source, sheet, origin.row, origin.col, reloadKey]);

  useEffect(() => {
    verticalRef.current?.scrollTo({ y: 0, animated: false });
    horizontalRef.current?.scrollTo({ x: 0, animated: false });
  }, [data]);

  const tagMap = useMemo(() => {
    const map = new Map<string, CellTag[]>();
    const push = (row: number, col: number, tag: CellTag) => {
      const key = `${row}:${col}`;
      const list = map.get(key);
      if (list) list.push(tag);
      else map.set(key, [tag]);
    };
    scenarioAreas.forEach(({ scenario, bounds, selected }) => {
      push(bounds.startRow, bounds.startCol, { text: scenarioCode(scenario), kind: selected ? 'scenario' : 'scenario-off' });
    });
    fixedRegions.forEach((region) => push(region.startRow, region.startCol, { text: region.id, kind: 'fixed' }));
    draftRegions.forEach((region) => push(region.startRow, region.startCol, { text: region.id, kind: 'draft' }));
    return map;
  }, [scenarioAreas, fixedRegions, draftRegions]);

  const activeBounds = useMemo(() => {
    if (!activeRegionId) return null;
    return [...draftRegions, ...fixedRegions].find((region) => region.id === activeRegionId) || null;
  }, [activeRegionId, draftRegions, fixedRegions]);

  const move = (dRow: number, dCol: number) => {
    setOrigin((prev) => ({
      row: clamp(prev.row + dRow, 1, Math.max(1, (data?.maxRow || 1) - 1)),
      col: clamp(prev.col + dCol, 1, Math.max(1, (data?.maxCol || 1) - 1)),
    }));
  };

  const handleGoto = () => {
    const parsed = parseCellRef(gotoText);
    if (!parsed) return;
    setOrigin({ row: Math.max(1, parsed.row - 2), col: Math.max(1, parsed.col - 1) });
    showFlash({ row: parsed.row, col: parsed.col });
  };

  const rectOf = (bounds: Bounds) => {
    if (!data || data.rows.length === 0) return null;
    const rowEnd = data.rowStart + data.rows.length - 1;
    const colEnd = data.colStart + (data.rows[0]?.length || 0) - 1;
    const r0 = Math.max(bounds.startRow, data.rowStart);
    const r1 = Math.min(bounds.endRow, rowEnd);
    const c0 = Math.max(bounds.startCol, data.colStart);
    const c1 = Math.min(bounds.endCol, colEnd);
    if (r1 < r0 || c1 < c0) return null;
    return {
      position: 'absolute' as const,
      left: ROW_HEAD_W + (c0 - data.colStart) * CELL_W,
      top: HEAD_H + (r0 - data.rowStart) * CELL_H,
      width: (c1 - c0 + 1) * CELL_W,
      height: (r1 - r0 + 1) * CELL_H,
    };
  };

  const cellBounds = (cell: CellPoint | null): Bounds | null =>
    cell ? { startRow: cell.row, endRow: cell.row, startCol: cell.col, endCol: cell.col } : null;

  const rows = data?.rows || [];
  const colCount = rows[0]?.length || COL_COUNT;
  const firstRow = data?.rowStart || origin.row;
  const firstCol = data?.colStart || origin.col;
  const totalW = ROW_HEAD_W + colCount * CELL_W;
  const totalH = Math.max(HEAD_H + rows.length * CELL_H, HEAD_H + 1);
  const dragBounds: Bounds | null = drag
    ? {
        startRow: Math.min(drag.startRow, drag.endRow),
        endRow: Math.max(drag.startRow, drag.endRow),
        startCol: Math.min(drag.startCol, drag.endCol),
        endCol: Math.max(drag.startCol, drag.endCol),
      }
    : null;
  const dragRect = dragBounds ? rectOf(dragBounds) : null;
  const anchorBounds = cellBounds(anchor);
  const anchorRect = anchorBounds ? rectOf(anchorBounds) : null;
  const activeRect = activeBounds ? rectOf(activeBounds) : null;
  const flashBounds = cellBounds(flash);
  const flashRect = flashBounds ? rectOf(flashBounds) : null;
  const drawTint = drawMode === 'expand' ? 'rgba(125,211,252,0.55)' : 'rgba(253,186,116,0.55)';

  return (
    <View className="flex-1 min-h-0 gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <GridNavButton icon="chevron-up" label="Lên" onPress={() => move(-ROW_STEP, 0)} disabled={origin.row <= 1} />
        <GridNavButton
          icon="chevron-down"
          label="Xuống"
          onPress={() => move(ROW_STEP, 0)}
          disabled={Boolean(data && origin.row + ROW_COUNT > data.maxRow)}
        />
        <GridNavButton icon="chevron-left" label="Sang trái" onPress={() => move(0, -COL_STEP)} disabled={origin.col <= 1} />
        <GridNavButton
          icon="chevron-right"
          label="Sang phải"
          onPress={() => move(0, COL_STEP)}
          disabled={Boolean(data && origin.col + COL_COUNT > data.maxCol)}
        />
        <TextInput
          value={gotoText}
          onChangeText={setGotoText}
          onSubmitEditing={handleGoto}
          placeholder="Đi tới ô, ví dụ B120"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          accessibilityLabel="Đi tới ô"
          className="flex-1 min-w-[120px] h-10 px-3 text-xs text-text-primary border border-border rounded-lg bg-surface"
        />
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-[11px] text-text-secondary">
          Dòng {firstRow}–{firstRow + ROW_COUNT - 1}
          {data ? ` / ${data.maxRow}` : ''}, cột {colLetters(firstCol)}–{colLetters(firstCol + colCount - 1)}
          {data ? ` / ${colLetters(Math.max(1, data.maxCol))}` : ''}
        </Text>
        {loading ? <ActivityIndicator size="small" color="#F38820" /> : null}
      </View>
      {error ? (
        <View className="flex-row items-center gap-2 px-3 py-2 bg-danger-light border border-danger/30 rounded-lg">
          <Text className="flex-1 text-xs text-danger">{error}</Text>
          <TouchableOpacity
            onPress={() => setReloadKey((k) => k + 1)}
            accessibilityLabel="Thử lại"
            className="px-3 h-10 items-center justify-center rounded-lg border border-danger/40 bg-surface"
          >
            <Text className="text-xs font-semibold text-danger">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View className="flex-1 min-h-0 border border-border rounded-xl bg-white overflow-hidden">
        <ScrollView ref={verticalRef} nestedScrollEnabled scrollEnabled={tool !== 'region'}>
          <ScrollView ref={horizontalRef} horizontal nestedScrollEnabled scrollEnabled={tool !== 'region'}>
            <View style={{ width: totalW, height: totalH }} {...panHandlers}>
              <Pressable
                disabled={tool !== 'scenario'}
                style={{ width: totalW, height: totalH }}
                onPress={(e) => {
                  const hit = scenarioAtPoint(e.nativeEvent.locationX, e.nativeEvent.locationY);
                  if (hit) onScenarioTap?.(hit.scenario.id);
                }}
                onLongPress={(e) => {
                  const hit = scenarioAtPoint(e.nativeEvent.locationX, e.nativeEvent.locationY);
                  if (hit) onScenarioHold?.(hit.scenario.id);
                }}
              >
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', left: 0, top: 0, width: ROW_HEAD_W, height: HEAD_H, backgroundColor: TONE.head, ...LINE }}
                />
                {Array.from({ length: rows.length ? colCount : 0 }, (_, i) => (
                  <View
                    key={`h${i}`}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: ROW_HEAD_W + i * CELL_W,
                      top: 0,
                      width: CELL_W,
                      height: HEAD_H,
                      backgroundColor: TONE.head,
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...LINE,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b' }}>{colLetters(firstCol + i)}</Text>
                  </View>
                ))}
                {rows.map((_line, rIdx) => {
                  const row = firstRow + rIdx;
                  const hasQc = qcRows?.has(row);
                  return (
                    <View
                      key={`r${row}`}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: HEAD_H + rIdx * CELL_H,
                        width: ROW_HEAD_W,
                        height: CELL_H,
                        backgroundColor: hasQc ? TONE.headQc : TONE.head,
                        alignItems: 'flex-end',
                        paddingTop: 4,
                        paddingRight: 4,
                        ...LINE,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: hasQc ? '700' : '500', color: hasQc ? '#b91c1c' : '#64748b' }}>{row}</Text>
                    </View>
                  );
                })}
                {data ? (
                  <GridCells
                    data={data}
                    scenarioAreas={scenarioAreas}
                    fixedRegions={fixedRegions}
                    draftRegions={draftRegions}
                    spellCells={spellCells}
                    areas={areas}
                    showScanState={showScanState}
                    tagMap={tagMap}
                  />
                ) : null}
                {activeRect ? <View pointerEvents="none" style={[activeRect, { borderWidth: 2, borderColor: '#f59e0b' }]} /> : null}
                {dragRect ? (
                  <View pointerEvents="none" style={[dragRect, { backgroundColor: drawTint, borderWidth: 1, borderColor: '#ea580c' }]} />
                ) : null}
                {anchorRect ? (
                  <View pointerEvents="none" style={[anchorRect, { backgroundColor: drawTint, borderWidth: 2, borderColor: '#ea580c' }]} />
                ) : null}
                {flashRect ? <View pointerEvents="none" style={[flashRect, { borderWidth: 3, borderColor: '#ef4444' }]} /> : null}
              </Pressable>
            </View>
          </ScrollView>
        </ScrollView>
      </View>
      {tool === 'region' ? (
        <Text className="text-[11px] text-text-secondary">
          {anchor
            ? 'Chạm ô cuối để hoàn tất vùng, hoặc chạm lại ô đầu để tạo vùng 1 ô.'
            : 'Kéo một ngón để vẽ vùng, hoặc chạm ô đầu rồi chạm ô cuối. Dùng nút mũi tên để đổi cửa sổ bảng.'}
        </Text>
      ) : null}
    </View>
  );
}
