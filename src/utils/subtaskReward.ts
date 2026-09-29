/**
 * Tính % thưởng cho công việc con (subtask) theo quỹ thưởng của task cha.
 * Mirror CHÍNH XÁC Web: ERP/src/modules/acceptance/helpers/TaskReward.helper.ts
 * (milli-Vinicoin + phân bổ sàn dư theo largest remainder) để mobile & web ra cùng số.
 */

/** Một dòng phân bổ % cho subtask */
export interface SubtaskAllocation {
  id: string;
  allocationPercent: number;
}

/** Kết quả chia thưởng của 1 subtask (reward tính bằng Vinicoin, 3 chữ số thập phân) */
export interface SubtaskReward {
  id: string;
  basisPoints: number;
  reward: number;
}

/** Kết quả kiểm tra tổng tỷ lệ phân bổ */
export interface AllocationTotalValidation {
  totalBasisPoints: number;
  valid: boolean;
  message?: string;
}

/** Regex tỷ lệ % (0-100, tối đa 2 chữ số thập phân) — trùng validators.PERCENT_REGEX */
export const ALLOCATION_PERCENT_REGEX = /^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/;

/** Chuẩn hoá input cho phép dấu phẩy thập phân kiểu Việt Nam ("12,5" → 12.5) */
const parsePercentInput = (value: number | string | undefined | null): number => {
  if (typeof value === 'string') {
    return Number(value.trim().replace(',', '.'));
  }
  return Number(value ?? 0);
};

/** % → basis points (1% = 100 bp), kẹp trong [0, 10000] */
const toBasisPoints = (percent: number | string | undefined | null): number =>
  Math.max(0, Math.min(10_000, Math.round(parsePercentInput(percent) * 100)));

/** Quỹ thưởng (Vinicoin) → milli-Vinicoin, không âm */
const toBudgetUnits = (budgetValue: number | string | undefined | null): number =>
  Math.max(0, Math.round(Number(budgetValue || 0) * 1_000));

/**
 * Chia quỹ thưởng của task cha cho các subtask theo tỷ lệ %.
 * - Sắp xếp theo `id` tăng dần (localeCompare) để kết quả tất định.
 * - Ném RangeError khi tổng tỷ lệ > 100%.
 * - Sàn dư phân bổ theo largest remainder, tie-break theo `id` tăng dần.
 */
export const computeSubtaskRewards = (
  budgetValue: number,
  allocations: SubtaskAllocation[]
): SubtaskReward[] => {
  const budgetUnits = toBudgetUnits(budgetValue);
  const normalized = (allocations || [])
    .map((item) => ({
      id: item.id,
      basisPoints: toBasisPoints(item.allocationPercent),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const totalBasisPoints = normalized.reduce((total, item) => total + item.basisPoints, 0);
  if (totalBasisPoints > 10_000) {
    throw new RangeError('Tổng tỷ lệ công việc con không được vượt quá 100%');
  }

  const targetUnits = Math.round((budgetUnits * totalBasisPoints) / 10_000);
  const rewards = normalized.map((item) => {
    const exactUnits = (budgetUnits * item.basisPoints) / 10_000;
    const units = Math.floor(exactUnits);
    return { ...item, units, remainder: exactUnits - units };
  });

  let remainingUnits = targetUnits - rewards.reduce((total, item) => total + item.units, 0);

  [...rewards]
    .sort((left, right) => right.remainder - left.remainder || left.id.localeCompare(right.id))
    .forEach((item) => {
      if (remainingUnits <= 0) return;
      const target = rewards.find((reward) => reward.id === item.id);
      if (target) target.units += 1;
      remainingUnits -= 1;
    });

  return rewards.map((item) => ({
    id: item.id,
    basisPoints: item.basisPoints,
    reward: item.units / 1_000,
  }));
};

/**
 * Thưởng còn lại của task cha = quỹ - tổng đã chia cho subtask (không âm).
 */
export const computeParentRemainingReward = (
  budgetValue: number,
  allocations: SubtaskAllocation[]
): number => {
  const budgetUnits = toBudgetUnits(budgetValue);
  const allocatedUnits = computeSubtaskRewards(budgetValue, allocations).reduce(
    (total, item) => total + Math.round(item.reward * 1_000),
    0
  );
  return Math.max(0, budgetUnits - allocatedUnits) / 1_000;
};

/**
 * Kiểm tra tổng tỷ lệ phân bổ: hợp lệ khi tổng ≤ 100%.
 */
export const validateSubtaskAllocationTotal = (
  allocations: SubtaskAllocation[]
): AllocationTotalValidation => {
  const totalBasisPoints = (allocations || []).reduce(
    (total, item) => total + toBasisPoints(item.allocationPercent),
    0
  );

  if (totalBasisPoints > 10_000) {
    return {
      totalBasisPoints,
      valid: false,
      message: 'Tổng tỷ lệ công việc con không được vượt quá 100%',
    };
  }
  return { totalBasisPoints, valid: true };
};

/**
 * Backend bắt buộc tổng tỷ lệ = ĐÚNG 100% trước khi gửi duyệt phương án phân bổ.
 */
export const isTotalAllocationComplete = (allocations: SubtaskAllocation[]): boolean =>
  (allocations || []).reduce((total, item) => total + toBasisPoints(item.allocationPercent), 0) ===
  10_000;

/**
 * Validate 1 ô nhập tỷ lệ % của subtask.
 * Chấp nhận dấu phẩy thập phân ("12,5").
 * @returns thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ.
 */
export const validateAllocationPercent = (
  percent: number | string | undefined | null,
  editablePercent: number
): string | null => {
  const value = parsePercentInput(percent);
  const maxEditable = Number(editablePercent || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return 'Tỷ lệ phân bổ phải lớn hơn 0';
  }
  if (value > 100) {
    return 'Tỷ lệ phân bổ không được vượt quá 100%';
  }
  if (value > maxEditable) {
    return `Tỷ lệ phân bổ không được vượt quá ${maxEditable}%`;
  }
  return null;
};
