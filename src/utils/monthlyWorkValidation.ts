export interface MonthlyWorkValidationParams {
  monthKey: string;
  name: string;
  items: any[];
}

export interface MonthlyWorkValidationResult {
  isValid: boolean;
  errorMessage: string | null;
}

/**
 * Thẩm định kế hoạch công việc tháng:
 * 1. monthKey đúng định dạng YYYY-MM.
 * 2. Tên kế hoạch không được để trống.
 * 3. Bắt buộc có ít nhất 1 dịch vụ hoặc gói công việc.
 */
export function validateMonthlyWorkAddendum({
  monthKey,
  name,
  items,
}: MonthlyWorkValidationParams): MonthlyWorkValidationResult {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return {
      isValid: false,
      errorMessage: 'Định dạng tháng không hợp lệ (cần YYYY-MM).',
    };
  }

  if (!name || !name.trim()) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng nhập tên đợt kế hoạch công việc.',
    };
  }

  if (!items || items.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng chọn ít nhất một dịch vụ hoặc gói công việc cho tháng này.',
    };
  }

  return {
    isValid: true,
    errorMessage: null,
  };
}
