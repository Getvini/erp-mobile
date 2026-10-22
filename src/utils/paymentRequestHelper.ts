export type PaymentDocType =
  | 'LABOR_CONTRACT'
  | 'ACCEPTANCE_MINUTE'
  | 'ADDENDUM'
  | 'VAT_INVOICE'
  | 'PAYMENT_REQUEST_DOC'
  | 'OTHER_INVOICE';

export interface DocTypeOption {
  type: PaymentDocType;
  title: string;
  docCode: string;
  hint: string;
}

export const PAYMENT_DOC_TYPES: Record<PaymentDocType, DocTypeOption> = {
  LABOR_CONTRACT: {
    type: 'LABOR_CONTRACT',
    title: 'Hợp đồng khoán việc',
    docCode: 'HDKV-GETVINI',
    hint: 'Mẫu: ngày tháng năm/dự án/năm/HDKV-GETVINI (.docx, .pdf, ảnh)',
  },
  ACCEPTANCE_MINUTE: {
    type: 'ACCEPTANCE_MINUTE',
    title: 'Biên bản nghiệm thu',
    docCode: 'BBNT-GETVINI',
    hint: 'Mẫu: ngày tháng năm/dự án/năm/BBNT-GETVINI (.docx, .pdf, ảnh)',
  },
  ADDENDUM: {
    type: 'ADDENDUM',
    title: 'Phụ lục phát sinh',
    docCode: 'PLHDPhatSinh-GETVINI',
    hint: 'Mẫu: ngày tháng năm/dự án/năm/PLHDPhatSinh-GETVINI (.docx, .pdf, ảnh)',
  },
  VAT_INVOICE: {
    type: 'VAT_INVOICE',
    title: 'Hóa đơn VAT',
    docCode: 'HDVAT-GETVINI',
    hint: 'Mẫu: ngày tháng năm/dự án/năm/HDVAT-GETVINI (PDF hoặc ảnh scan)',
  },
  PAYMENT_REQUEST_DOC: {
    type: 'PAYMENT_REQUEST_DOC',
    title: 'Giấy đề nghị thanh toán',
    docCode: 'DNTT-GETVINI',
    hint: 'Mẫu: ngày tháng năm/dự án/năm/DNTT-GETVINI (.docx, .pdf)',
  },
  OTHER_INVOICE: {
    type: 'OTHER_INVOICE',
    title: 'Các hóa đơn khác',
    docCode: 'HDKHAC-GETVINI',
    hint: 'Mẫu: ngày tháng năm/dự án/năm/HDKHAC-GETVINI (vé, bill, biên lai...)',
  },
};

/**
 * Kiểm tra dự án có đang hoạt động (không bị đóng hoặc tạm dừng)
 */
export function isProjectActive(project: any): boolean {
  if (!project) return false;
  if (['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(project.status)) {
    return false;
  }
  if (Boolean(project.isOnHold)) {
    return false;
  }
  return true;
}

/**
 * Suy ra chức vụ từ vai trò hệ thống
 */
export function getPositionByRole(role?: string): string {
  if (!role) return 'Nhân viên';
  const upper = String(role).toUpperCase().trim();
  if (['BD', 'BOD', 'PM'].includes(upper)) {
    return 'Quản lý';
  }
  return 'Nhân viên';
}

/**
 * Suy ra phòng ban từ vai trò hệ thống
 */
export function getDepartmentByRole(role?: string): string {
  if (!role) return '';
  const upper = String(role).toUpperCase().trim();
  if (upper === 'BD') return 'Phòng kinh doanh';
  if (upper === 'ADMIN_SALE' || upper === 'ADMIN_SALES') return 'Phòng hành chính nhân sự';
  if (['EDITOR', 'CONTENT', 'DESIGN', 'PM'].includes(upper)) return 'Phòng dự án';
  return '';
}

/**
 * Kiểm tra công việc có thuộc dịch vụ được quản lý ngân sách (isBudget === true)
 */
export function isTaskBudgetService(task: any): boolean {
  if (!task) return false;
  return Boolean(
    task.contractService?.service?.isBudget === true ||
    task.contractService?.isBudget === true ||
    task.opportunityServiceJob?.opportunityService?.service?.isBudget === true ||
    task.mappedService?.isBudget === true ||
    task.isBudget === true
  );
}

/**
 * Xóa dấu tiếng Việt và chuẩn hóa tên dự án cho file upload
 */
export function getNormalizedProjectName(projectName?: string, requestType = 'PROJECT'): string {
  const raw = (projectName || '').trim();
  if (
    requestType === 'OTHER_WORK' ||
    !raw ||
    raw === 'Công việc khác' ||
    raw === 'CongViecKhac' ||
    raw === 'Cong_viec_khac'
  ) {
    return 'CongViecKhac';
  }
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'GETVINI';
}

/**
 * Tạo tên file chuẩn hóa Getvini: ddMMyy_TenDuAn_yyyy_DocCode.ext
 */
export function formatDocFileName({
  fileName,
  docType,
  projectName,
  requestType = 'PROJECT',
  date = new Date(),
}: {
  fileName: string;
  docType: PaymentDocType;
  projectName?: string;
  requestType?: string;
  date?: Date;
}): { standardName: string; safeUploadName: string; docCode: string } {
  const rawExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
  const safeExt = rawExt || '.jpg';

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const fullYear = String(date.getFullYear());

  const cleanProject = getNormalizedProjectName(projectName, requestType);
  const docConfig = PAYMENT_DOC_TYPES[docType] || PAYMENT_DOC_TYPES.OTHER_INVOICE;
  const docCode = docConfig.docCode;

  const baseStandard = `${dd}${mm}${yy}/${cleanProject}/${fullYear}/${docCode}`;
  const baseSafeUpload = `${dd}${mm}${yy}_${cleanProject}_${fullYear}_${docCode}`;

  return {
    standardName: `${baseStandard}${safeExt}`,
    safeUploadName: `${baseSafeUpload}${safeExt}`,
    docCode,
  };
}

export interface ValidatePaymentRequestInputParams {
  type: 'PROJECT' | 'OTHER_WORK' | 'ADVANCE';
  title: string;
  amount: number;
  dueDate: string;
  projectId?: string;
  taskId?: string;
  isOverBudget?: boolean;
  overBudgetReason?: string;
  settlementDueDate?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Kiểm tra toàn diện tính hợp lệ của dữ liệu form đề xuất thanh toán / tạm ứng
 */
export function validatePaymentRequestInput(params: ValidatePaymentRequestInputParams): ValidationResult {
  const {
    type,
    title,
    amount,
    dueDate,
    projectId,
    taskId,
    isOverBudget,
    overBudgetReason,
    settlementDueDate,
  } = params;

  if (!title || !title.trim()) {
    return { isValid: false, error: 'Vui lòng nhập nội dung yêu cầu thanh toán' };
  }

  if (!amount || amount <= 0) {
    return { isValid: false, error: 'Vui lòng nhập số tiền thanh toán hợp lệ (lớn hơn 0 VNĐ)' };
  }

  if (!dueDate || !dueDate.trim()) {
    return { isValid: false, error: 'Vui lòng chọn thời hạn thanh toán' };
  }

  if (type === 'PROJECT') {
    if (!projectId) {
      return { isValid: false, error: 'Vui lòng chọn dự án' };
    }
    if (!taskId) {
      return { isValid: false, error: 'Vui lòng chọn công việc của bạn trong dự án' };
    }
  }

  if (type === 'ADVANCE') {
    if (!settlementDueDate || !settlementDueDate.trim()) {
      return { isValid: false, error: 'Vui lòng chọn hạn hoàn ứng dự kiến cho phiếu tạm ứng' };
    }
    // Lỗi nghiêm trọng của bản cũ: Nếu chọn dự án thì bắt buộc phải có task
    if (projectId && !taskId) {
      return { isValid: false, error: 'Phiếu tạm ứng theo dự án bắt buộc phải chọn công việc liên quan' };
    }
  }

  if (isOverBudget && (!overBudgetReason || !overBudgetReason.trim())) {
    return {
      isValid: false,
      error: 'Yêu cầu thanh toán vượt ngân sách dịch vụ dự án. Vui lòng nhập lý do giải trình.',
    };
  }

  return { isValid: true, error: null };
}
