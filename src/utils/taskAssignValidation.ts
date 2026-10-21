export interface TaskAssignmentParams {
  assigneeId?: string;
  vendorId?: string;
  deadline?: string;
}

export interface TaskAssignmentValidationResult {
  isValid: boolean;
  errorMessage: string | null;
}

/**
 * Thẩm định thông tin giao việc:
 * 1. Bắt buộc có người thực hiện (nội bộ assigneeId hoặc đối tác vendorId).
 * 2. Bắt buộc có hạn chót (deadline).
 */
export function validateTaskAssignment({
  assigneeId,
  vendorId,
  deadline,
}: TaskAssignmentParams): TaskAssignmentValidationResult {
  if (!assigneeId && !vendorId) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng chọn người thực hiện hoặc đơn vị đối tác (Vendor).',
    };
  }

  if (!deadline || !deadline.trim()) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng thiết lập hạn chót hoàn thành công việc.',
    };
  }

  return {
    isValid: true,
    errorMessage: null,
  };
}
