export type ScopeTool = 'scenario' | 'region' | 'view';

export type DrawMode = 'new' | 'expand';

export interface ScopeFocus {
  sheet: string;
  row: number;
  col: number;
  nonce: number;
}

export interface ScenarioChange {
  add?: string[];
  remove?: string[];
}

export interface DrawMeta {
  startRow: number;
  startCol: number;
}
