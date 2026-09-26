import { apiService } from './api';

export enum PaymentMilestoneStatus {
  PENDING = 'PENDING',
  WAITING_PAYMENT = 'WAITING_PAYMENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export const PAYMENT_MILESTONE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ đến hạn',
  WAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Đã hủy',
};

export const PAYMENT_MILESTONE_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  PENDING: {
    text: 'Chờ đến hạn',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
  },
  WAITING_PAYMENT: {
    text: 'Chờ thanh toán',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  PAID: {
    text: 'Đã thanh toán',
    color: '#16A34A',
    bg: '#DCFCE7',
    border: '#BBF7D0',
  },
  OVERDUE: {
    text: 'Quá hạn',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FECACA',
  },
  CANCELLED: {
    text: 'Đã hủy',
    color: '#64748B',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  },
};

export interface PaymentMilestone {
  id: string;
  contractId: string;
  projectId?: string;
  name: string;
  description?: string;
  percentage: number;
  amount: number;
  dueDate?: string;
  paidDate?: string;
  status: PaymentMilestoneStatus | string;
  note?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePaymentMilestonePayload {
  contractId: string;
  projectId?: string;
  name: string;
  description?: string;
  percentage?: number;
  amount: number;
  dueDate?: string;
  status?: string;
  note?: string;
  order?: number;
}

export interface UpdatePaymentMilestonePayload {
  id: string;
  name?: string;
  description?: string;
  percentage?: number;
  amount?: number;
  dueDate?: string;
  status?: string;
  note?: string;
  order?: number;
}

export interface UpdatePaymentStatusPayload {
  id: string;
  status: string;
  paidDate?: string;
}

export interface BulkSaveMilestonesPayload {
  contractId: string;
  milestones: Array<{
    id?: string;
    name: string;
    description?: string;
    percentage?: number;
    amount: number;
    dueDate?: string;
    order?: number;
  }>;
}

class PaymentMilestoneService {
  /**
   * 1. GET /payment-milestones
   * Lấy danh sách đợt thanh toán theo bộ lọc
   */
  async getPaymentMilestones(params?: Record<string, any>) {
    return apiService.get<PaymentMilestone[]>('/payment-milestones', params);
  }

  /**
   * 2. GET /payment-milestones/:id
   * Lấy chi tiết một đợt thanh toán
   */
  async getPaymentMilestone(id: string) {
    return apiService.get<PaymentMilestone>(`/payment-milestones/${id}`);
  }

  /**
   * 3. GET /payment-milestones/contract/:contractId
   * Lấy danh sách đợt thanh toán theo Hợp đồng
   */
  async getPaymentMilestonesByContract(contractId: string) {
    return apiService.get<PaymentMilestone[]>(`/payment-milestones/contract/${contractId}`);
  }

  /**
   * 4. GET /payment-milestones/project/:projectId
   * Lấy danh sách đợt thanh toán theo Dự án
   */
  async getPaymentMilestonesByProject(projectId: string) {
    return apiService.get<PaymentMilestone[]>(`/payment-milestones/project/${projectId}`);
  }

  /**
   * 5. POST /payment-milestones
   * Tạo mới đợt thanh toán
   */
  async createPaymentMilestone(data: CreatePaymentMilestonePayload) {
    return apiService.post<PaymentMilestone>('/payment-milestones', data);
  }

  /**
   * 6. PUT /payment-milestones/:id
   * Cập nhật đợt thanh toán
   */
  async updatePaymentMilestone({ id, ...data }: UpdatePaymentMilestonePayload) {
    return apiService.put<PaymentMilestone>(`/payment-milestones/${id}`, data);
  }

  /**
   * 7. DELETE /payment-milestones/:id
   * Xóa đợt thanh toán
   */
  async deletePaymentMilestone(id: string) {
    return apiService.delete<{ success: boolean; message?: string }>(`/payment-milestones/${id}`);
  }

  /**
   * 8. PATCH /payment-milestones/:id/status
   * Cập nhật trạng thái thanh toán & ngày thực tế thu tiền
   */
  async updatePaymentStatus({ id, status, paidDate }: UpdatePaymentStatusPayload) {
    return apiService.patch<PaymentMilestone>(`/payment-milestones/${id}/status`, {
      status,
      paidDate,
    });
  }

  /**
   * 9. PUT /payment-milestones/contract/:contractId/bulk
   * Lưu hàng loạt các đợt thanh toán (Milestone roadmap)
   */
  async bulkSavePaymentMilestones({ contractId, milestones }: BulkSaveMilestonesPayload) {
    return apiService.put<PaymentMilestone[]>(
      `/payment-milestones/contract/${contractId}/bulk`,
      { milestones }
    );
  }
}

export const paymentMilestoneService = new PaymentMilestoneService();
