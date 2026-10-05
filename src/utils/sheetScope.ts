const CELL_REF_PATTERN = /^(?:(.+)!)?([A-Za-z]{1,3})(\d{1,7})$/;
const REGION_CODE_PATTERN = /^K(\d+)$/;
const MAX_ROW = 1048576;
const MAX_COL = 16384;

export interface Bounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface SheetBounds extends Bounds {
  sheet: string;
}

export interface ScanRegion extends SheetBounds {
  id: string;
  label?: string;
  qc?: boolean;
  extends?: string;
}

export interface ScenarioInfo {
  id: string;
  scenarioLabel: string;
  startRow: number;
  endRow: number;
  colStart?: number | null;
  colWidth?: number | null;
}

export interface PreviewMerge {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface PreviewRequest {
  sheet?: string;
  rowStart: number;
  rowCount: number;
  colStart: number;
  colCount: number;
}

export interface PreviewWindow {
  sheets: string[];
  sheet: string;
  maxRow: number;
  maxCol: number;
  rowStart: number;
  colStart: number;
  rows: (string | null)[][];
  merges: PreviewMerge[];
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface ParsedCellRef extends CellPosition {
  sheet: string | null;
}

export interface LocatedCell extends CellPosition {
  sheet: string;
}

export interface SpellLocatable {
  location?: string | null;
  sheetName?: string | null;
  confirmed?: boolean;
}

export interface QcLocatable {
  status?: string | null;
  confirmed?: boolean;
  sheet_name?: string | null;
  row_range?: number | number[] | null;
}

export type SpellCellState = 'confirmed' | 'dismissed';

export interface ScenarioBounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export const colLetters = (col: number): string => {
  let n = col;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

export const lettersToCol = (letters: string): number => {
  const upper = letters.toUpperCase();
  let n = 0;
  for (let i = 0; i < upper.length; i += 1) {
    n = n * 26 + (upper.charCodeAt(i) - 64);
  }
  return n;
};

export const cellRef = (row: number, col: number): string => `${colLetters(col)}${row}`;

export const parseCellRef = (text: unknown): ParsedCellRef | null => {
  const match = CELL_REF_PATTERN.exec(String(text || '').trim());
  if (!match) return null;
  const col = lettersToCol(match[2]);
  const row = Number(match[3]);
  if (row < 1 || row > MAX_ROW || col < 1 || col > MAX_COL) return null;
  return { sheet: match[1] || null, row, col };
};

export const regionRange = (region: Bounds): string => {
  const start = cellRef(region.startRow, region.startCol);
  const end = cellRef(region.endRow, region.endCol);
  return start === end ? start : `${start}:${end}`;
};

export const regionRef = (region: SheetBounds): string => `${region.sheet}!${regionRange(region)}`;

export const regionCellCount = (region: Bounds): number =>
  (region.endRow - region.startRow + 1) * (region.endCol - region.startCol + 1);

export const newRegionId = (): string =>
  `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const parseRangeInput = (text: unknown, defaultSheet?: string | null): SheetBounds | null => {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const bang = raw.lastIndexOf('!');
  const sheet = bang >= 0 ? raw.slice(0, bang) : defaultSheet;
  const body = bang >= 0 ? raw.slice(bang + 1) : raw;
  const [from, to = from] = body.split(':');
  const a = parseCellRef(from);
  const b = parseCellRef(to);
  if (!a || !b || !sheet) return null;
  return {
    sheet,
    startRow: Math.min(a.row, b.row),
    endRow: Math.max(a.row, b.row),
    startCol: Math.min(a.col, b.col),
    endCol: Math.max(a.col, b.col),
  };
};

export const nextRegionNumber = (sheet: string, existing: ScanRegion[] = []): number => {
  let max = 0;
  existing.forEach((region) => {
    if (region.sheet !== sheet) return;
    const match = REGION_CODE_PATTERN.exec(String(region.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  });
  return max + 1;
};

export const createRegion = (
  bounds: SheetBounds,
  existing: ScanRegion[] = [],
  extra: Partial<ScanRegion> = {}
): ScanRegion => {
  const number = nextRegionNumber(bounds.sheet, existing);
  return {
    id: `K${number}`,
    label: `Vùng ${number}`,
    qc: true,
    ...bounds,
    ...extra,
  };
};

export const unionBounds = (a: Bounds, b: Bounds): Bounds => ({
  startRow: Math.min(a.startRow, b.startRow),
  endRow: Math.max(a.endRow, b.endRow),
  startCol: Math.min(a.startCol, b.startCol),
  endCol: Math.max(a.endCol, b.endCol),
});

export const scenarioCode = (scenario?: { id?: string } | null): string => {
  const id = String(scenario?.id || '');
  const index = id.lastIndexOf('::');
  return index >= 0 ? id.slice(index + 2) : id;
};

export const boundsOfScenario = (scenario: ScenarioInfo): ScenarioBounds => {
  const colStart = scenario.colStart ?? 0;
  return {
    startRow: scenario.startRow,
    endRow: scenario.endRow,
    startCol: colStart + 1,
    endCol: scenario.colWidth ? colStart + scenario.colWidth : Number.POSITIVE_INFINITY,
  };
};

export const scenarioFiniteBounds = (scenario: ScenarioInfo, fallbackEndCol: number): Bounds => {
  const bounds = boundsOfScenario(scenario);
  return {
    startRow: bounds.startRow,
    endRow: bounds.endRow,
    startCol: bounds.startCol,
    endCol: Number.isFinite(bounds.endCol) ? bounds.endCol : Math.max(bounds.startCol, fallbackEndCol),
  };
};

export const cellInBounds = (bounds: ScenarioBounds, row: number, col: number): boolean =>
  bounds.startRow != null &&
  row >= bounds.startRow &&
  row <= bounds.endRow &&
  col >= bounds.startCol &&
  col <= bounds.endCol;

export const computeActiveAreas = ({
  scenarios,
  selectedScenarioIds,
  regions,
}: {
  scenarios: ScenarioInfo[];
  selectedScenarioIds?: string[] | null;
  regions: Bounds[];
}): ScenarioBounds[] | null => {
  const regionAreas: ScenarioBounds[] = regions.map((r) => ({
    startRow: r.startRow,
    endRow: r.endRow,
    startCol: r.startCol,
    endCol: r.endCol,
  }));
  if (selectedScenarioIds == null && regionAreas.length === 0) return null;
  if (selectedScenarioIds == null) return regionAreas;
  if (scenarios.length === 0 && regionAreas.length === 0) return null;
  const selected = new Set(selectedScenarioIds);
  return [...scenarios.filter((s) => selected.has(s.id)).map(boundsOfScenario), ...regionAreas];
};

export const isCellScanned = (areas: ScenarioBounds[] | null, row: number, col: number): boolean =>
  areas === null || areas.some((a) => cellInBounds(a, row, col));

export const buildSpellCellMap = (
  items: SpellLocatable[] | null | undefined,
  sheet: string,
  fallbackSheet?: string | null
): Map<string, SpellCellState> => {
  const map = new Map<string, SpellCellState>();
  (items || []).forEach((item) => {
    const parsed = parseCellRef(item.location);
    if (!parsed) return;
    const itemSheet = item.sheetName || parsed.sheet || fallbackSheet;
    if (itemSheet !== sheet) return;
    const key = `${parsed.row}:${parsed.col}`;
    const state: SpellCellState = item.confirmed === false ? 'dismissed' : 'confirmed';
    if (map.get(key) !== 'confirmed') map.set(key, state);
  });
  return map;
};

const qcRowRange = (item: QcLocatable): [number, number] => {
  const range = Array.isArray(item.row_range) ? item.row_range : [item.row_range, item.row_range];
  const start = Number(range[0]);
  const end = Number(range[1] ?? range[0]);
  return [start, end];
};

export const buildQcRowSet = (items: QcLocatable[] | null | undefined, sheet: string): Set<number> => {
  const rows = new Set<number>();
  (items || []).forEach((item) => {
    if (item.status === 'unresolved' || item.confirmed === false || item.sheet_name !== sheet) return;
    const [start, end] = qcRowRange(item);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    for (let r = start; r <= end && r - start < 5000; r += 1) rows.add(r);
  });
  return rows;
};

export const locateSpellItem = (item: SpellLocatable, fallbackSheet?: string | null): LocatedCell | null => {
  const parsed = parseCellRef(item.location);
  if (!parsed) return null;
  const sheet = item.sheetName || parsed.sheet || fallbackSheet;
  if (!sheet) return null;
  return { sheet, row: parsed.row, col: parsed.col };
};

export const locateQcItem = (item: QcLocatable): LocatedCell | null => {
  const [row] = qcRowRange(item);
  if (!item.sheet_name || !Number.isFinite(row)) return null;
  return { sheet: item.sheet_name, row, col: 1 };
};
