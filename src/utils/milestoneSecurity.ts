export interface MilestoneSecurityCheckParams {
  status?: string;
  debtStatus?: string;
}

/**
 * Kiểm tra xem một đợt thanh toán (Milestone) có được phép sửa/xóa không.
 * Điều kiện chặn sửa/xóa:
 * 1. Hợp đồng đã đóng (COMPLETED hoặc CANCELLED).
 * 2. Đợt thanh toán đã thanh toán (status === 'PAID').
 * 3. Công nợ gắn liền đã thanh toán hoặc bị khóa (debtStatus === 'PAID' hoặc 'LOCKED').
 */
export function canModifyMilestone(
  milestone: MilestoneSecurityCheckParams,
  contractStatus?: string,
): boolean {
  if (['COMPLETED', 'CANCELLED'].includes(contractStatus || '')) {
    return false;
  }
  if (milestone.status === 'PAID') {
    return false;
  }
  if (milestone.debtStatus === 'PAID' || milestone.debtStatus === 'LOCKED') {
    return false;
  }
  return true;
}

/**
 * Kiểm tra xem có được phép tạo mới đợt thanh toán cho hợp đồng hay không.
 * Chặn thêm đợt khi hợp đồng đã hoàn tất hoặc đã hủy.
 */
export function canAddMilestone(contractStatus?: string): boolean {
  return !['COMPLETED', 'CANCELLED'].includes(contractStatus || '');
}
