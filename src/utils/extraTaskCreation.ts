import type { CreateTaskPayload } from '@/services/taskService';

export interface ExtraTaskRow { jobId: string; name: string; quantity: number }

export function validateExtraTaskRows(rows: ExtraTaskRow[]): string | null {
  if (!rows.length || rows.some((row) => !row.jobId || !row.name)) return 'Vui lòng chọn đầy đủ hạng mục.';
  if (rows.some((row) => !Number.isSafeInteger(row.quantity) || row.quantity <= 0)) return 'Số lượng phải là số nguyên dương.';
  if (new Set(rows.map((row) => row.jobId)).size !== rows.length) return 'Không chọn trùng hạng mục.';
  return null;
}

/** Each acknowledged unit is removed before the next request; failed units stay for reconciliation. */
export async function createExtraTaskBatch(
  rows: ExtraTaskRow[],
  context: Pick<CreateTaskPayload, 'projectId' | 'description' | 'plannedEndDate'>,
  create: (payload: CreateTaskPayload) => Promise<unknown>,
  onProgress: (remaining: ExtraTaskRow[], created: number) => void,
) {
  const error = validateExtraTaskRows(rows);
  if (error) throw new Error(error);
  let remaining = rows.map((row) => ({ ...row }));
  let created = 0;
  while (remaining.length) {
    const row = remaining[0];
    await create({ ...context, jobId: row.jobId, name: row.name, isExtra: true });
    created += 1;
    remaining = row.quantity === 1 ? remaining.slice(1) : [{ ...row, quantity: row.quantity - 1 }, ...remaining.slice(1)];
    onProgress(remaining, created);
  }
  return created;
}
