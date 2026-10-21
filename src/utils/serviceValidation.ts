export interface ServiceJobConfigInput {
  jobId: string;
  quantity: number;
  isOutput: boolean;
}

export interface ServiceFormData {
  name: string;
  code?: string;
  description?: string;
  unit: string;
  isAI: boolean;
  isBudget: boolean;
  jobConfigs: ServiceJobConfigInput[];
}

/**
 * Kiểm tra hợp lệ dữ liệu dịch vụ niêm yết (Service Catalog)
 * Đồng bộ với Zod schema trên Web: `serviceSchema` trong `CreateServiceModal.jsx` / `EditServiceModal.jsx`.
 *
 * @param form Dữ liệu form dịch vụ
 * @param isEditMode true nếu đang ở chế độ Sửa, false nếu Thêm mới
 * @returns Thông báo lỗi đầu tiên nếu vi phạm, hoặc null nếu hợp lệ
 */
export function validateServiceForm(
  form: ServiceFormData,
  isEditMode: boolean,
): string | null {
  if (!form.name || !form.name.trim()) {
    return 'Vui lòng nhập tên dịch vụ.';
  }

  if (isEditMode && (!form.code || !form.code.trim())) {
    return 'Vui lòng nhập mã dịch vụ.';
  }

  if (!form.unit || !form.unit.trim()) {
    return 'Vui lòng nhập đơn vị tính.';
  }

  if (form.jobConfigs && form.jobConfigs.length > 0) {
    const hasInvalidQuantity = form.jobConfigs.some(
      (cfg) => typeof cfg.quantity !== 'number' || cfg.quantity < 1 || Number.isNaN(cfg.quantity),
    );
    if (hasInvalidQuantity) {
      return 'Số lượng của mỗi hạng mục công việc phải từ 1 trở lên.';
    }
  }

  return null;
}
