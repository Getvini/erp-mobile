/**
 * Đối soát NGÂN SÁCH DỰ ÁN: ngân sách dự toán vs chi phí thực tế phát sinh.
 * Chi phí thực tế lấy từ các đề xuất thanh toán đã chi của dự án/hợp đồng.
 */

export interface BudgetVarianceResult {
  /** Ngân sách dự toán (giá vốn dự kiến của hợp đồng). */
  planned: number;
  /** Tổng chi phí thực tế đã phát sinh. */
  actual: number;
  /** actual - planned (dương = vượt ngân sách). */
  variance: number;
  /** % chênh lệch so với ngân sách; 0 khi ngân sách = 0. */
  variancePercent: number;
  isOverBudget: boolean;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Tính chênh lệch ngân sách.
 * KHÔNG làm tròn giá trị tiền; chỉ làm tròn `variancePercent` 2 chữ số thập phân để hiển thị.
 */
export const computeBudgetVariance = (
  plannedBudget: number | string | null | undefined,
  actualCosts: (number | string | { amount?: number | string; totalAmount?: number | string })[],
): BudgetVarianceResult => {
  const planned = toNumber(plannedBudget);
  const actual = (actualCosts || []).reduce<number>((total, entry) => {
    if (entry === null || entry === undefined) return total;
    if (typeof entry === 'object') {
      const value = entry.amount ?? entry.totalAmount ?? 0;
      return total + toNumber(value);
    }
    return total + toNumber(entry);
  }, 0);

  const variance = actual - planned;
  const variancePercent = planned === 0 ? 0 : Math.round((variance / planned) * 10000) / 100;

  return {
    planned,
    actual,
    variance,
    variancePercent,
    isOverBudget: variance > 0,
  };
};

/** Số tiền còn lại có thể chi trước khi vượt ngân sách (không âm). */
export const getRemainingBudget = (
  plannedBudget: number | string | null | undefined,
  actualCosts: (number | string | { amount?: number | string; totalAmount?: number | string })[],
): number => {
  const { planned, actual } = computeBudgetVariance(plannedBudget, actualCosts);
  return Math.max(0, planned - actual);
};
