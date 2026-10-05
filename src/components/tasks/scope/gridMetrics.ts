import type { ScanRegion, ScenarioBounds, ScenarioInfo } from '@/utils/sheetScope';

export const ROW_COUNT = 40;
export const COL_COUNT = 14;
export const ROW_STEP = 20;
export const COL_STEP = 7;
export const CELL_W = 88;
export const CELL_H = 56;
export const HEAD_H = 26;
export const ROW_HEAD_W = 46;
export const LINE_H = 12;
export const MAX_LINES = 6;
export const FLASH_MS = 2500;

export const TONE = {
  base: '#ffffff',
  scenarioOn: '#eff6ff',
  scenarioOff: '#f1f5f9',
  fixed: '#ede9fe',
  draft: '#fef3c7',
  spell: '#fef08a',
  spellOff: '#fefce8',
  head: '#f1f5f9',
  headQc: '#fee2e2',
};

export const TAG_COLOR = {
  scenario: '#2563eb',
  'scenario-off': '#64748b',
  fixed: '#7c3aed',
  draft: '#d97706',
} as const;

export type TagKind = keyof typeof TAG_COLOR;

export interface CellTag {
  text: string;
  kind: TagKind;
}

export interface ScenarioArea {
  scenario: ScenarioInfo;
  bounds: ScenarioBounds;
  selected: boolean;
}

export interface DragState {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface CellPoint {
  row: number;
  col: number;
}

export const EMPTY_SCENARIOS: ScenarioInfo[] = [];
export const EMPTY_REGIONS: ScanRegion[] = [];

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
