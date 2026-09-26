import { apiService } from './api';

export enum PaymentRequestType {
  PROJECT = 'PROJECT',
  OTHER_WORK = 'OTHER_WORK',
}

export const PAYMENT_REQUEST_TYPE_LABELS: Record<string, string> = {
  PROJECT: 'Theo dự án',
  OTHER_WORK: 'Công việc khác',
};

export enum ApprovalStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEWER = 'PENDING_REVIEWER',
  NEED_MORE_DOCS = 'NEED_MORE_DOCS',
  PENDING_BOD = 'PENDING_BOD',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_REVIEWER: 'Chờ Admin Sale duyệt',
  NEED_MORE_DOCS: 'Yêu cầu bổ sung',
  PENDING_BOD: 'Chờ BOD xác nhận',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

export const APPROVAL_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  DRAFT: {
    text: 'Nháp',
    color: '#64748B',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  },
  PENDING_REVIEWER: {
    text: 'Chờ Admin Sale duyệt',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
  },
  NEED_MORE_DOCS: {
    text: 'Yêu cầu bổ sung',
    color: '#EA580C',
    bg: '#FFEDD5',
    border: '#FED7AA',
  },
  PENDING_BOD: {
    text: 'Chờ BOD xác nhận',
    color: '#B45309',
    bg: '#FEF9C3',
    border: '#FEF08A',
  },
  APPROVED: {
    text: 'Đã duyệt',
    color: '#16A34A',
    bg: '#DCFCE7',
    border: '#BBF7D0',
  },
  REJECTED: {
    text: 'Từ chối',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FECACA',
  },
  CANCELLED: {
    text: 'Đã hủy',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#CBD5E1',
  },
};

export enum PaymentStatus {
  WAITING = 'WAITING',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  WAITING: 'Chờ thanh toán',
  DUE_SOON: 'Sắp hết hạn',
  OVERDUE: 'Hết hạn',
  PAID: 'Đã thanh toán',
  NOT_APPLICABLE: 'Không áp dụng',
};

export const PAYMENT_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  WAITING: {
    text: 'Chờ thanh toán',
    color: '#64748B',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  },
  DUE_SOON: {
    text: 'Sắp hết hạn',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
  },
  OVERDUE: {
    text: 'Hết hạn',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FECACA',
  },
  PAID: {
    text: 'Đã thanh toán',
    color: '#16A34A',
    bg: '#DCFCE7',
    border: '#BBF7D0',
  },
  NOT_APPLICABLE: {
    text: 'Không áp dụng',
    color: '#94A3B8',
    bg: '#F8FAFC',
    border: '#E2E8F0',
  },
};

export interface PaymentRequest {
  id: string;
  code?: string;
  type: PaymentRequestType | string;
  title: string;
  amount: number;
  reason?: string;
  projectId?: string;
  project?: { id: string; name: string; code?: string };
  contractId?: string;
  contract?: { id: string; contractCode?: string };
  vendorId?: string;
  vendor?: { id: string; name: string };
  beneficiaryName?: string;
  beneficiaryAccount?: string;
  beneficiaryBank?: string;
  approvalStatus: ApprovalStatus | string;
  paymentStatus: PaymentStatus | string;
  requestedBy?: { id: string; fullName: string; role?: string; avatar?: string };
  createdById?: string;
  confirmedDueDate?: string;
  invoiceFiles?: Array<{ id?: string; url: string; name?: string }>;
  paymentProofs?: Array<{ id?: string; url: string; name?: string; paidAt?: string }>;
  history?: Array<{
    id?: string;
    action: string;
    note?: string;
    actor?: { id: string; fullName: string };
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentRequestsTotalDebt {
  totalPendingAmount: number;
  totalApprovedAmount: number;
  totalPaidAmount: number;
  totalRequestsCount: number;
}

export interface CreatePaymentRequestPayload {
  type: string;
  title: string;
  amount: number;
  reason?: string;
  projectId?: string;
  contractId?: string;
  vendorId?: string;
  beneficiaryName?: string;
  beneficiaryAccount?: string;
  beneficiaryBank?: string;
  invoiceFiles?: any[];
}

export interface UpdatePaymentRequestPayload {
  id: string;
  type?: string;
  title?: string;
  amount?: number;
  reason?: string;
  projectId?: string;
  contractId?: string;
  vendorId?: string;
  beneficiaryName?: string;
  beneficiaryAccount?: string;
  beneficiaryBank?: string;
  invoiceFiles?: any[];
}

export interface ReviewPaymentRequestPayload {
  id: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_DOCS' | string;
  note?: string;
}

export interface BodDecidePaymentRequestPayload {
  id: string;
  action: 'APPROVE' | 'REJECT' | string;
  reason?: string;
  confirmedDueDate?: string;
}

export interface PayPaymentRequestPayload {
  id: string;
  paidAmount?: number;
  paidDate?: string;
  paymentProofUrl?: string;
  note?: string;
}

class PaymentRequestService {
  /**
   * 1. GET /payment-requests
   * Lấy danh sách đề xuất thanh toán (hỗ trợ phân trang, lọc theo dự án, trạng thái)
   */
  async getPaymentRequests(params?: Record<string, any>) {
    return apiService.get<PaymentRequest[]>('/payment-requests', params);
  }

  /**
   * 2. GET /payment-requests/:id
   * Lấy chi tiết đề xuất thanh toán theo ID
   */
  async getPaymentRequest(id: string) {
    return apiService.get<PaymentRequest>(`/payment-requests/${id}`);
  }

  /**
   * 3. GET /payment-requests/total-debt
   * Lấy số liệu tổng nợ / tổng chi đề xuất thanh toán
   */
  async getPaymentRequestsTotalDebt(params?: Record<string, any>) {
    return apiService.get<PaymentRequestsTotalDebt>('/payment-requests/total-debt', params);
  }

  /**
   * 4. POST /payment-requests/upload-invoice
   * Upload hóa đơn / chứng từ đính kèm
   */
  async uploadPaymentRequestInvoiceFile(formData: FormData) {
    return apiService.postForm<{ url: string; name?: string }>(
      '/payment-requests/upload-invoice',
      formData
    );
  }

  /**
   * 5. POST /payment-requests
   * Tạo mới đề xuất thanh toán
   */
  async createPaymentRequest(data: CreatePaymentRequestPayload) {
    return apiService.post<PaymentRequest>('/payment-requests', data);
  }

  /**
   * 6. PATCH /payment-requests/:id
   * Cập nhật thông tin đề xuất thanh toán
   */
  async updatePaymentRequest({ id, ...data }: UpdatePaymentRequestPayload) {
    return apiService.patch<PaymentRequest>(`/payment-requests/${id}`, data);
  }

  /**
   * 7. POST /payment-requests/:id/submit
   * Gửi duyệt đề xuất thanh toán
   */
  async submitPaymentRequest(id: string) {
    return apiService.post<PaymentRequest>(`/payment-requests/${id}/submit`, {});
  }

  /**
   * 8. PATCH /payment-requests/:id/supplement
   * Bổ sung chứng từ theo yêu cầu người duyệt
   */
  async supplementPaymentRequest({ id, ...data }: { id: string; [key: string]: any }) {
    return apiService.patch<PaymentRequest>(`/payment-requests/${id}/supplement`, data);
  }

  /**
   * 9. DELETE /payment-requests/:id
   * Xóa đề xuất thanh toán (chỉ áp dụng khi ở trạng thái nháp)
   */
  async deletePaymentRequest(id: string) {
    return apiService.delete<{ success: boolean; message?: string }>(`/payment-requests/${id}`);
  }

  /**
   * 10. POST /payment-requests/:id/invoice-pdfs
   * Thêm tệp PDF hóa đơn vào đề xuất thanh toán
   */
  async addPaymentRequestInvoicePdf({ id, ...file }: { id: string; [key: string]: any }) {
    return apiService.post<any>(`/payment-requests/${id}/invoice-pdfs`, file);
  }

  /**
   * 11. POST /payment-requests/:id/review
   * Cấp Admin Sale duyệt hoặc yêu cầu bổ sung
   */
  async reviewPaymentRequest({ id, action, note }: ReviewPaymentRequestPayload) {
    return apiService.post<PaymentRequest>(`/payment-requests/${id}/review`, {
      action,
      note,
    });
  }

  /**
   * 12. POST /payment-requests/:id/bod-decision
   * Ban Giám đốc (BOD) phê duyệt hoặc từ chối và chốt hạn chi
   */
  async bodDecidePaymentRequest({
    id,
    action,
    reason,
    confirmedDueDate,
  }: BodDecidePaymentRequestPayload) {
    return apiService.post<PaymentRequest>(`/payment-requests/${id}/bod-decision`, {
      action,
      reason,
      confirmedDueDate,
    });
  }

  /**
   * 13. POST /payment-requests/:id/pay
   * Kế toán thực hiện chi tiền và cập nhật phiếu
   */
  async payPaymentRequest({ id, ...data }: PayPaymentRequestPayload) {
    return apiService.post<PaymentRequest>(`/payment-requests/${id}/pay`, data);
  }

  /**
   * 14. POST /payment-requests/:id/cancel
   * Hủy đề xuất thanh toán
   */
  async cancelPaymentRequest({ id, reason }: { id: string; reason?: string }) {
    return apiService.post<PaymentRequest>(`/payment-requests/${id}/cancel`, { reason });
  }

  /**
   * 15. POST /payment-requests/:id/payment-proofs
   * Tải lên ủy nhiệm chi / chứng từ thanh toán
   */
  async uploadPaymentRequestProof({ id, ...file }: { id: string; [key: string]: any }) {
    return apiService.post<any>(`/payment-requests/${id}/payment-proofs`, file);
  }
}

export const paymentRequestService = new PaymentRequestService();
