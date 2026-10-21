export interface ProjectCloseValidationParams {
  isDirect: boolean;
  reason?: string;
}

export interface ProjectCloseValidationResult {
  isValid: boolean;
  errorMessage: string | null;
}

/**
 * Thẩm định lý do đóng dự án:
 * - isDirect = true (BOD/ADMIN đóng trực tiếp): Bắt buộc nhập lý do có độ dài tối thiểu 5 ký tự.
 * - isDirect = false (PM gửi đề nghị chờ duyệt): Lý do là tùy chọn (optional).
 */
export function validateProjectClose({
  isDirect,
  reason = '',
}: ProjectCloseValidationParams): ProjectCloseValidationResult {
  const trimmed = reason.trim();

  if (isDirect) {
    if (trimmed.length < 5) {
      return {
        isValid: false,
        errorMessage: 'Vui lòng nhập lý do đóng dự án (tối thiểu 5 ký tự).',
      };
    }
  }

  return {
    isValid: true,
    errorMessage: null,
  };
}
