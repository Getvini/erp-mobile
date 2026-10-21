export interface ProjectPauseValidationResult {
  isValid: boolean;
  errorMessage: string | null;
}

/**
 * Thẩm định lý do tạm dừng dự án:
 * Bắt buộc nhập lý do có độ dài tối thiểu 5 ký tự để BOD có cơ sở xét duyệt.
 */
export function validateProjectPause(reason: string): ProjectPauseValidationResult {
  const trimmed = reason.trim();
  if (!trimmed) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng nhập lý do tạm dừng',
    };
  }

  if (trimmed.length < 5) {
    return {
      isValid: false,
      errorMessage: 'Lý do quá ngắn — vui lòng ghi rõ hơn để BOD có căn cứ duyệt',
    };
  }

  return {
    isValid: true,
    errorMessage: null,
  };
}
