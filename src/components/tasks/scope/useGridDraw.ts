import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import { cellInBounds } from '@/utils/sheetScope';
import type { PreviewWindow, SheetBounds } from '@/utils/sheetScope';
import { CELL_H, CELL_W, HEAD_H, ROW_HEAD_W, clamp } from './gridMetrics';
import type { CellPoint, DragState, ScenarioArea } from './gridMetrics';
import type { DrawMeta, ScopeTool } from './scopeTypes';

interface UseGridDrawOptions {
  tool: ScopeTool;
  sheet: string | null;
  data: PreviewWindow | null;
  scenarioAreas: ScenarioArea[];
  resetKey: string;
  onPickRegion?: (row: number, col: number) => boolean;
  onDrawRegion?: (bounds: SheetBounds, meta: DrawMeta) => void;
}

export function useGridDraw({ tool, sheet, data, scenarioAreas, resetKey, onPickRegion, onDrawRegion }: UseGridDrawOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [anchor, setAnchor] = useState<CellPoint | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const anchorRef = useRef<CellPoint | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const live = useRef({ tool, sheet, data, scenarioAreas, onPickRegion, onDrawRegion });
  live.current = { tool, sheet, data, scenarioAreas, onPickRegion, onDrawRegion };

  const clearAnchor = () => {
    anchorRef.current = null;
    setAnchor(null);
  };

  useEffect(() => {
    clearAnchor();
  }, [resetKey, tool]);

  const cellAt = (x: number, y: number, clampToWindow: boolean): CellPoint | null => {
    const d = live.current.data;
    if (!d) return null;
    const rowsN = d.rows.length;
    const colsN = d.rows[0]?.length || 0;
    if (rowsN === 0 || colsN === 0) return null;
    let ri = Math.floor((y - HEAD_H) / CELL_H);
    let ci = Math.floor((x - ROW_HEAD_W) / CELL_W);
    if (clampToWindow) {
      ri = clamp(ri, 0, rowsN - 1);
      ci = clamp(ci, 0, colsN - 1);
    } else if (ri < 0 || ci < 0 || ri >= rowsN || ci >= colsN) {
      return null;
    }
    return { row: d.rowStart + ri, col: d.colStart + ci };
  };

  const emitDraw = (a: CellPoint, b: CellPoint) => {
    const p = live.current;
    if (!p.sheet) return;
    p.onDrawRegion?.(
      {
        sheet: p.sheet,
        startRow: Math.min(a.row, b.row),
        endRow: Math.max(a.row, b.row),
        startCol: Math.min(a.col, b.col),
        endCol: Math.max(a.col, b.col),
      },
      { startRow: a.row, startCol: a.col }
    );
  };

  const handleTap = (row: number, col: number) => {
    if (live.current.onPickRegion?.(row, col)) {
      clearAnchor();
      return;
    }
    const a = anchorRef.current;
    if (!a) {
      anchorRef.current = { row, col };
      setAnchor({ row, col });
      return;
    }
    clearAnchor();
    emitDraw(a, { row, col });
  };

  const finishDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (d.startRow === d.endRow && d.startCol === d.endCol) {
      handleTap(d.startRow, d.startCol);
      return;
    }
    clearAnchor();
    emitDraw({ row: d.startRow, col: d.startCol }, { row: d.endRow, col: d.endCol });
  };

  const finishRef = useRef(finishDrag);
  finishRef.current = finishDrag;
  const cellAtRef = useRef(cellAt);
  cellAtRef.current = cellAt;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => live.current.tool === 'region',
        onMoveShouldSetPanResponder: () => live.current.tool === 'region',
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          touchStart.current = { x: locationX, y: locationY };
          const cell = cellAtRef.current(locationX, locationY, false);
          if (!cell) {
            dragRef.current = null;
            return;
          }
          dragRef.current = { startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col };
          setDrag(dragRef.current);
        },
        onPanResponderMove: (_evt, g) => {
          const current = dragRef.current;
          if (!current) return;
          const cell = cellAtRef.current(touchStart.current.x + g.dx, touchStart.current.y + g.dy, true);
          if (!cell || (cell.row === current.endRow && cell.col === current.endCol)) return;
          dragRef.current = { ...current, endRow: cell.row, endCol: cell.col };
          setDrag(dragRef.current);
        },
        onPanResponderRelease: () => finishRef.current(),
        onPanResponderTerminate: () => {
          dragRef.current = null;
          setDrag(null);
        },
      }),
    []
  );

  const scenarioAtPoint = (x: number, y: number) => {
    const cell = cellAt(x, y, false);
    if (!cell) return null;
    return live.current.scenarioAreas.find((s) => cellInBounds(s.bounds, cell.row, cell.col)) || null;
  };

  return { drag, anchor, panHandlers: responder.panHandlers, scenarioAtPoint };
}
