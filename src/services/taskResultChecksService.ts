import { apiService } from './api';
import type { PreviewRequest, PreviewWindow, ScanRegion } from '@/utils/sheetScope';

export type ResultCheckKind = 'SPELL' | 'QC';
export type RerunKind = 'SPELL' | 'QC' | 'BOTH';
export type CheckRunStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
export type QcBatchStatus = 'pending' | 'running' | 'done' | 'error';

export interface SpellCheckResultItem {
  id: string;
  token: string;
  location: string;
  sheetName?: string | null;
  scenarioLabel?: string | null;
  scenarioId?: string | null;
  confirmed: boolean;
}

export interface QcMismatchResultItem {
  id: string;
  sheet_name?: string;
  product_ref?: string;
  attribute: string;
  claimed_value?: string;
  expected_value?: string | null;
  reasoning?: string;
  scenario?: string;
  blockId?: string;
  status?: string;
  row_range?: number | number[];
  confirmed: boolean;
}

export interface QcBatchScenario {
  id: string;
  label: string;
  rowRange: number[];
}

export interface QcBatchInfo {
  key: string;
  sheet: string;
  index: number;
  status: QcBatchStatus;
  blockIds: string[];
  scenarios: QcBatchScenario[];
  mismatches: QcMismatchResultItem[];
  unverified: number;
  cached: boolean;
  error: string | null;
  durationMs: number | null;
}

export interface ScannedScenario {
  id: string;
  sheet: string;
  scenarioLabel: string;
  startRow: number | null;
  endRow: number | null;
  colStart?: number | null;
  colWidth?: number | null;
}

export interface TaskResultCheckRecord {
  id?: string;
  status: CheckRunStatus;
  spellStatus?: CheckRunStatus;
  qcStatus?: CheckRunStatus;
  errorMessage?: string | null;
  spellErrorMessage?: string | null;
  qcErrorMessage?: string | null;
  qcSkippedReason?: string | null;
  qcModels?: { verify: string } | null;
  canReview?: boolean;
  finalizedAt?: string | null;
  reviewerWhitelist?: string[] | null;
  sheetNames?: string[] | null;
  scenarioIds?: string[] | null;
  scanRegions?: ScanRegion[] | null;
  scannedScenarios?: ScannedScenario[] | null;
  qcBatches?: QcBatchInfo[] | null;
  reviewedSpellErrors?: SpellCheckResultItem[];
  reviewedQcMismatches?: QcMismatchResultItem[];
}

export interface RerunScope {
  scenarioIds: string[];
  regions: ScanRegion[];
}

class TaskResultChecksService {
  async getByTask(taskId: string): Promise<{ data?: TaskResultCheckRecord | null; error?: string }> {
    const res = await apiService.get<TaskResultCheckRecord>(`/task-result-checks/task/${taskId}`);
    return { data: res.data ?? null, error: res.error };
  }

  async toggleItem(
    taskId: string,
    kind: ResultCheckKind,
    itemId: string,
    confirmed: boolean
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/task-result-checks/task/${taskId}/toggle`, {
      kind,
      itemId,
      confirmed,
    });
    return { data: res.data, error: res.error };
  }

  async toggleItems(
    taskId: string,
    kind: ResultCheckKind,
    itemIds: string[],
    confirmed: boolean
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/task-result-checks/task/${taskId}/toggle-bulk`, {
      kind,
      itemIds,
      confirmed,
    });
    return { data: res.data, error: res.error };
  }

  async finalize(taskId: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/task-result-checks/task/${taskId}/finalize`, {});
    return { data: res.data, error: res.error };
  }

  async rerun(
    taskId: string,
    kind: RerunKind,
    whitelist: string[],
    scope?: RerunScope
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/task-result-checks/task/${taskId}/rerun`, {
      kind,
      whitelist,
      scope,
    });
    return { data: res.data, error: res.error };
  }

  async getPreview(
    taskId: string,
    request: PreviewRequest
  ): Promise<{ data?: PreviewWindow; error?: string }> {
    const res = await apiService.get<PreviewWindow>(`/task-result-checks/task/${taskId}/preview`, {
      sheet: request.sheet,
      rowStart: request.rowStart,
      rowCount: request.rowCount,
      colStart: request.colStart,
      colCount: request.colCount,
    });
    return { data: res.data, error: res.error };
  }
}

export const taskResultChecksService = new TaskResultChecksService();
