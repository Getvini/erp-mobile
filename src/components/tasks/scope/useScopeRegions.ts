import { useCallback, useEffect, useRef, useState } from 'react';
import {
  boundsOfScenario,
  cellInBounds,
  createRegion,
  parseRangeInput,
  scenarioFiniteBounds,
  unionBounds,
} from '@/utils/sheetScope';
import type { ScanRegion, ScenarioInfo, SheetBounds } from '@/utils/sheetScope';
import type { DrawMeta, DrawMode, ScenarioChange, ScopeFocus } from './scopeTypes';

const MAX_REGIONS = 50;
const MAX_HISTORY = 50;

interface UseScopeRegionsOptions {
  isOpen: boolean;
  sheets: string[];
  activeSheet: string | null;
  setActiveSheet: (sheet: string) => void;
  sheetScenarios: ScenarioInfo[];
  fixedRegions: ScanRegion[];
  draftRegions: ScanRegion[];
  sheetFixed: ScanRegion[];
  sheetDraft: ScanRegion[];
  totalRegions: number;
  drawMode: DrawMode;
  canDraw: boolean;
  onDraftRegionsChange?: (regions: ScanRegion[]) => void;
  onChangeScenarios?: (change: ScenarioChange) => void;
  onEnsureSheet?: (sheet: string) => void;
}

export const makeFocus = (sheet: string, row: number, col: number): ScopeFocus => ({ sheet, row, col, nonce: Date.now() });

export function useScopeRegions({
  isOpen,
  sheets,
  activeSheet,
  setActiveSheet,
  sheetScenarios,
  fixedRegions,
  draftRegions,
  sheetFixed,
  sheetDraft,
  totalRegions,
  drawMode,
  canDraw,
  onDraftRegionsChange,
  onChangeScenarios,
  onEnsureSheet,
}: UseScopeRegionsOptions) {
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [rangeText, setRangeText] = useState('');
  const [notice, setNotice] = useState('');
  const [localFocus, setLocalFocus] = useState<ScopeFocus | null>(null);
  const undoStack = useRef<ScanRegion[][]>([]);
  const redoStack = useRef<ScanRegion[][]>([]);
  const everyRegion = [...fixedRegions, ...draftRegions];

  useEffect(() => {
    if (isOpen) return;
    undoStack.current = [];
    redoStack.current = [];
    setActiveRegionId(null);
    setNotice('');
  }, [isOpen]);

  const syncExtends = useCallback(
    (prev: ScanRegion[], next: ScanRegion[]) => {
      if (!onChangeScenarios) return;
      const before = new Set(prev.map((r) => r.extends).filter(Boolean) as string[]);
      const after = new Set(next.map((r) => r.extends).filter(Boolean) as string[]);
      const add = [...before].filter((id) => !after.has(id));
      const remove = [...after].filter((id) => !before.has(id));
      if (add.length || remove.length) onChangeScenarios({ add, remove });
    },
    [onChangeScenarios]
  );

  const commitRegions = useCallback(
    (next: ScanRegion[]) => {
      undoStack.current = [...undoStack.current.slice(-(MAX_HISTORY - 1)), draftRegions];
      redoStack.current = [];
      syncExtends(draftRegions, next);
      onDraftRegionsChange?.(next);
    },
    [draftRegions, onDraftRegionsChange, syncExtends]
  );

  const undo = () => {
    const previous = undoStack.current[undoStack.current.length - 1];
    if (!previous || !onDraftRegionsChange) return;
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, draftRegions];
    syncExtends(draftRegions, previous);
    onDraftRegionsChange(previous);
  };

  const redo = () => {
    const next = redoStack.current[redoStack.current.length - 1];
    if (!next || !onDraftRegionsChange) return;
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, draftRegions];
    syncExtends(draftRegions, next);
    onDraftRegionsChange(next);
  };

  const regionAt = (row: number, col: number) => {
    const candidates = [...sheetDraft, ...sheetFixed].filter((r) => cellInBounds(r, row, col));
    return candidates.find((r) => r.id === activeRegionId) || candidates[0] || null;
  };

  const scenarioAt = (row: number, col: number) =>
    sheetScenarios.find((s) => cellInBounds(boundsOfScenario(s), row, col)) || null;

  const addRegion = (bounds: SheetBounds, extra: Partial<ScanRegion> = {}) => {
    if (!canDraw) return null;
    if (totalRegions >= MAX_REGIONS) {
      setNotice(`Chỉ được chọn tối đa ${MAX_REGIONS} vùng`);
      return null;
    }
    setNotice('');
    onEnsureSheet?.(bounds.sheet);
    const region = createRegion(bounds, everyRegion, extra);
    commitRegions([...draftRegions, region]);
    setActiveRegionId(region.id);
    return region;
  };

  const expandRegion = (bounds: SheetBounds, meta: DrawMeta) => {
    const active = [...sheetDraft, ...sheetFixed].find((r) => r.id === activeRegionId);
    const hitRegion = active || regionAt(meta.startRow, meta.startCol);
    const hitScenario = hitRegion ? null : scenarioAt(meta.startRow, meta.startCol);
    if (!hitRegion && !hitScenario) {
      setNotice('Chưa có vùng để mở rộng. Hãy chọn một vùng, hoặc bắt đầu kéo từ bên trong vùng/kịch bản cần mở rộng.');
      return;
    }
    setNotice('');
    if (hitRegion) {
      const merged: ScanRegion = { ...hitRegion, ...unionBounds(hitRegion, bounds) };
      const isDraft = draftRegions.some((r) => r.sheet === merged.sheet && r.id === merged.id);
      commitRegions(
        isDraft
          ? draftRegions.map((r) => (r.sheet === merged.sheet && r.id === merged.id ? merged : r))
          : [...draftRegions, merged]
      );
      setActiveRegionId(merged.id);
      return;
    }
    if (!hitScenario) return;
    const base = scenarioFiniteBounds(hitScenario, bounds.endCol);
    const merged: SheetBounds = { sheet: bounds.sheet, ...unionBounds(base, bounds) };
    const created = addRegion(merged, { label: hitScenario.scenarioLabel, extends: hitScenario.id });
    if (created) setLocalFocus(makeFocus(merged.sheet, merged.startRow, merged.startCol));
  };

  const handleDraw = (bounds: SheetBounds, meta: DrawMeta) => {
    if (drawMode === 'expand') expandRegion(bounds, meta);
    else addRegion(bounds);
  };

  const handlePickRegion = (row: number, col: number) => {
    const hit = regionAt(row, col);
    if (!hit) return false;
    setActiveRegionId(hit.id);
    setNotice('');
    return true;
  };

  const handleAddRange = () => {
    const bounds = parseRangeInput(rangeText, activeSheet);
    if (!bounds || !sheets.includes(bounds.sheet)) {
      setNotice('Vùng không hợp lệ, hãy nhập dạng A1:D20 hoặc Sheet1!A1:D20');
      return;
    }
    if (addRegion(bounds)) {
      setRangeText('');
      setLocalFocus(makeFocus(bounds.sheet, bounds.startRow, bounds.startCol));
    }
  };

  const updateRegion = (id: string, patch: Partial<ScanRegion>) => {
    onDraftRegionsChange?.(draftRegions.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const commitRegionRange = (region: ScanRegion, text: string) => {
    const bounds = parseRangeInput(text, region.sheet);
    if (!bounds) {
      setNotice('Toạ độ không hợp lệ, hãy nhập dạng A1:D20');
      return false;
    }
    setNotice('');
    const { startRow, endRow, startCol, endCol } = bounds;
    commitRegions(
      draftRegions.map((r) => (r.sheet === region.sheet && r.id === region.id ? { ...r, startRow, endRow, startCol, endCol } : r))
    );
    return true;
  };

  const removeRegion = (region: ScanRegion) => {
    commitRegions(draftRegions.filter((r) => !(r.sheet === region.sheet && r.id === region.id)));
    if (activeRegionId === region.id) setActiveRegionId(null);
  };

  const focusRegion = (region: ScanRegion) => {
    setActiveSheet(region.sheet);
    setActiveRegionId(region.id);
    setLocalFocus(makeFocus(region.sheet, region.startRow, region.startCol));
  };

  return {
    activeRegionId,
    setActiveRegionId,
    rangeText,
    setRangeText,
    notice,
    localFocus,
    setLocalFocus,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    undo,
    redo,
    handleDraw,
    handlePickRegion,
    handleAddRange,
    updateRegion,
    commitRegionRange,
    removeRegion,
    focusRegion,
  };
}
