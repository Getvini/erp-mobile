/**
 * Logic thuần cho module NGHIỆM THU (Acceptance) — tách khỏi UI để unit-test.
 * Mirror 1:1 AcceptanceReviewModal.jsx (erp-UI) và backend ERP/src/modules/acceptance.
 */
import type {
  AcceptanceDecision,
  AcceptanceResult,
  AcceptanceServiceItem,
} from '@/services/acceptanceService';

/** Dự án đã hoàn tất / đã đóng — không thể duyệt nghiệm thu. */
export const isProjectClosed = (status?: string): boolean =>
  status === 'COMPLETED' || status === 'CANCELLED';

/** Dự án đang tạm dừng — không thể duyệt nghiệm thu. */
export const isProjectOnHold = (status?: string, isOnHold?: boolean): boolean =>
  status === 'ON_HOLD' || Boolean(isOnHold);

/**
 * Biên bản chỉ được phép tương tác khi đang PENDING và dự án chưa đóng/chưa tạm dừng.
 * Mirror AcceptanceReviewModal.jsx:15.
 */
export const isAcceptanceReadOnly = (params: {
  status?: string;
  projectStatus?: string;
  projectIsOnHold?: boolean;
}): boolean => {
  if (params.status !== 'PENDING') return true;
  if (isProjectClosed(params.projectStatus)) return true;
  if (isProjectOnHold(params.projectStatus, params.projectIsOnHold)) return true;
  return false;
};

/** Lý do read-only hiển thị ở footer — mirror AcceptanceReviewModal.jsx:515-533. */
export const getAcceptanceReadOnlyReason = (params: {
  status?: string;
  projectStatus?: string;
  projectIsOnHold?: boolean;
}): string => {
  if (isProjectClosed(params.projectStatus)) return 'Dự án đã hoàn tất hoặc đã đóng';
  if (isProjectOnHold(params.projectStatus, params.projectIsOnHold)) return 'Dự án đang tạm dừng';
  if (params.status !== 'PENDING') return 'Biên bản đã được xử lý xong';
  return '';
};

/**
 * Kết quả task đã được duyệt/từ chối thì không còn "chờ duyệt".
 * Mirror AcceptanceReviewModal.jsx:40-43.
 */
export const isResultPending = (status?: string): boolean =>
  status !== 'APPROVED' && status !== 'REJECTED';

/**
 * Gộp kết quả theo `taskId`, chỉ giữ bản ghi MỚI NHẤT (phần tử cuối mảng gốc).
 * Mirror AcceptanceReviewModal.jsx:26-35.
 */
export const dedupeResultsByTask = (results: AcceptanceResult[] = []): AcceptanceResult[] => {
  const seen = new Set<string>();
  const output: AcceptanceResult[] = [];
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const item = results[index];
    const key = item?.taskId;
    if (!key) {
      output.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
};

/** Danh sách kết quả còn chờ duyệt của một hạng mục dịch vụ. */
export const getPendingResults = (service?: AcceptanceServiceItem): AcceptanceResult[] => {
  if (!service) return [];
  const status = service.status;
  if (status === 'ACCEPTANCE_REJECTED' || status === 'COMPLETED') return [];
  return dedupeResultsByTask(service.results || []).filter((result) =>
    isResultPending(result.status),
  );
};

/** Tổng số kết quả còn chờ duyệt trên toàn biên bản. */
export const countPendingResults = (services: AcceptanceServiceItem[] = []): number =>
  services.reduce((total, service) => total + getPendingResults(service).length, 0);

/** Tổng số kết quả bị từ chối (dùng để hiển thị badge hạng mục). */
export const countRejectedResults = (service?: AcceptanceServiceItem): number =>
  dedupeResultsByTask(service?.results || []).filter((result) => result.status === 'REJECTED')
    .length;

/** Trạng thái hiển thị động của biên bản PROCESSED — mirror Modal:195-203. */
export const getAcceptanceDisplayStatus = (
  status?: string,
  services: AcceptanceServiceItem[] = [],
): string => {
  if (status !== 'PROCESSED') return status || '';
  const hasRejected = services.some((service) => countRejectedResults(service) > 0);
  return hasRejected ? 'Từ chối nghiệm thu' : 'Đã nghiệm thu';
};

/** Mọi hạng mục còn chờ duyệt đều bị từ chối ⇒ nút xác nhận chuyển sang màu đỏ. */
export const isAllRejected = (decisions: Record<string, AcceptanceDecision> = {}): boolean => {
  const values = Object.values(decisions);
  if (values.length === 0) return false;
  return values.every((decision) => decision.status === 'REJECTED');
};

/**
 * Kiểm tra hợp lệ trước khi gửi: mọi hạng mục bị từ chối phải có lý do.
 * Trả về tên hạng mục vi phạm đầu tiên hoặc null nếu hợp lệ.
 * Mirror AcceptanceReviewModal.jsx:157-164.
 */
export const findRejectedServiceMissingFeedback = (
  decisions: Record<string, AcceptanceDecision> = {},
  serviceNameById: Record<string, string> = {},
): string | null => {
  for (const [serviceId, decision] of Object.entries(decisions)) {
    if (decision.status === 'REJECTED' && !decision.feedback?.trim()) {
      return serviceNameById[serviceId] || 'Hạng mục dịch vụ';
    }
  }
  return null;
};

/**
 * Hạng mục đủ điều kiện gửi nghiệm thu — mirror backend
 * (task chặn = status ∉ {COMPLETED, INTERNAL_COMPLETED, ACCEPTED, ON_HOLD, CANCELLED}).
 */
export const isServiceEligibleForAcceptance = (service?: AcceptanceServiceItem): boolean => {
  if (!service) return false;
  if (service.status !== 'ACTIVE' && service.status !== 'ACCEPTANCE_REJECTED') return false;
  if (getPendingResults(service).length === 0) return false;
  const blockingTasks = (service.tasks || []).filter(
    (task: any) =>
      !['COMPLETED', 'INTERNAL_COMPLETED', 'ACCEPTED', 'ON_HOLD', 'CANCELLED'].includes(
        task?.status,
      ),
  );
  return blockingTasks.length === 0;
};

export interface AcceptanceDateValidation {
  valid: boolean;
  message?: string;
}

const toDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Kiểm tra ngày nghiệm thu phải nằm trong khoảng thời gian hợp đồng.
 * Ngày không hợp lệ (không parse được) cũng bị coi là không hợp lệ.
 */
export const validateAcceptanceDate = (
  acceptanceDate: string | Date | null | undefined,
  contractStartDate?: string | Date | null,
  contractEndDate?: string | Date | null,
): AcceptanceDateValidation => {
  const acceptance = toDate(acceptanceDate);
  if (!acceptance) {
    return { valid: false, message: 'Ngày nghiệm thu không hợp lệ.' };
  }

  const start = toDate(contractStartDate);
  const end = toDate(contractEndDate);

  if (start && acceptance.getTime() < start.getTime()) {
    return {
      valid: false,
      message: 'Ngày nghiệm thu không được trước ngày bắt đầu hợp đồng.',
    };
  }

  if (end && acceptance.getTime() > end.getTime()) {
    return {
      valid: false,
      message: 'Ngày nghiệm thu không được sau ngày kết thúc hợp đồng.',
    };
  }

  return { valid: true };
};
