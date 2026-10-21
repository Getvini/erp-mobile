export interface AcceptanceValidationParams {
  decisions: Record<string, { status: 'APPROVED' | 'REJECTED'; feedback?: string }>;
  isProjectClosed: boolean;
  isProjectOnHold: boolean;
  totalPendingResults: number;
}

export interface AcceptanceValidationResult {
  isValid: boolean;
  errorMessage: string | null;
}

/**
 * Thẩm định điều kiện phê duyệt nghiệm thu:
 * 1. Chặn nếu dự án đã đóng (COMPLETED, CANCELLED) hoặc đang tạm dừng (ON_HOLD / isOnHold).
 * 2. Chặn nếu không có hạng mục nào chờ duyệt (totalPendingResults === 0).
 * 3. Bắt buộc nhập lý do từ chối khi có bất kỳ hạng mục nào bị đánh dấu REJECTED.
 */
export function validateAcceptanceSubmission({
  decisions,
  isProjectClosed,
  isProjectOnHold,
  totalPendingResults,
}: AcceptanceValidationParams): AcceptanceValidationResult {
  if (isProjectClosed) {
    return {
      isValid: false,
      errorMessage: 'Dự án đã hoàn tất hoặc đã đóng, không thể duyệt nghiệm thu.',
    };
  }

  if (isProjectOnHold) {
    return {
      isValid: false,
      errorMessage: 'Dự án đang tạm dừng, không thể duyệt nghiệm thu.',
    };
  }

  if (totalPendingResults === 0) {
    return {
      isValid: false,
      errorMessage: 'Tất cả kết quả đã được duyệt, không cần xác nhận thêm.',
    };
  }

  for (const [_, data] of Object.entries(decisions)) {
    if (data.status === 'REJECTED' && !data.feedback?.trim()) {
      return {
        isValid: false,
        errorMessage: 'Vui lòng nhập lý do từ chối cho hạng mục đã chọn.',
      };
    }
  }

  return {
    isValid: true,
    errorMessage: null,
  };
}
