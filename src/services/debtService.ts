import { apiService } from './api';

export enum DebtStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  LOCKED = 'LOCKED',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
}

export const DEBT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang thu',
  COMPLETED: 'Đã hoàn tất',
  LOCKED: 'Đã khóa',
  PENDING: 'Chờ kích hoạt',
  OVERDUE: 'Quá hạn',
};

export const DEBT_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  ACTIVE: {
    text: 'Đang thu',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  COMPLETED: {
    text: 'Đã hoàn tất',
    color: '#16A34A',
    bg: '#DCFCE7',
    border: '#BBF7D0',
  },
  LOCKED: {
    text: 'Đã khóa',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
  },
  PENDING: {
    text: 'Chờ kích hoạt',
    color: '#64748B',
    bg: '#F1F5F9',
    border: '#CBD5E1',
  },
  OVERDUE: {
    text: 'Quá hạn',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FECACA',
  },
};

export interface DebtAttachment {
  name: string;
  url: string;
  type?: 'IMAGE' | 'PDF' | string;
  size?: number;
  publicId?: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  paymentDate: string;
  note?: string;
  attachments?: DebtAttachment[];
  createdBy?: {
    id: string;
    fullName?: string;
    username?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface DebtMilestoneInfo {
  id: string;
  name: string;
  amount: number;
  percentage?: number;
  dueDate?: string;
  status?: string;
}

export interface DebtContractInfo {
  id: string;
  contractCode?: string;
  name: string;
  sellingPrice?: number;
  totalAmount?: number;
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
}

export interface Debt {
  id: string;
  contractId: string;
  milestoneId?: string;
  amount: number;
  status: DebtStatus | string;
  milestone?: DebtMilestoneInfo;
  contract?: DebtContractInfo;
  payments?: DebtPayment[];
  lockReason?: string;
  lockedAt?: string;
  lockedBy?: {
    id: string;
    fullName?: string;
    username?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivateDebtPayload {
  milestoneId: string;
  contractId?: string;
}

export interface CreatePaymentPayload {
  debtId: string;
  amount: number;
  paymentDate: string;
  note?: string;
  attachments?: DebtAttachment[];
}

export interface UnlockDebtPayload {
  id: string;
  reason: string;
}

class DebtService {
  /**
   * 1. GET /debts
   * Lấy danh sách công nợ với bộ lọc
   */
  async getDebts(params?: Record<string, any>) {
    return apiService.get<Debt[]>('/debts', params);
  }

  /**
   * 2. GET /debts/:id
   * Lấy chi tiết một khoản công nợ
   */
  async getDebt(id: string) {
    return apiService.get<Debt>(`/debts/${id}`);
  }

  /**
   * 3. GET /debts/contract/:contractId
   * Lấy danh sách công nợ theo hợp đồng
   */
  async getDebtsByContract(contractId: string) {
    return apiService.get<Debt[]>(`/debts/contract/${contractId}`);
  }

  /**
   * 4. POST /debts/activate
   * Kích hoạt công nợ cho mốc thanh toán milestone
   */
  async activateDebt(payload: ActivateDebtPayload) {
    return apiService.post<Debt>('/debts/activate', payload);
  }

  /**
   * 5. POST /debts/payments
   * Ghi nhận thanh toán cho khoản nợ (kèm hóa đơn chứng từ)
   */
  async createPayment(payload: CreatePaymentPayload) {
    return apiService.post<DebtPayment>('/debts/payments', payload);
  }

  /**
   * 6. DELETE /debts/payments/:id
   * Xóa một khoản thanh toán đã ghi nhận
   */
  async deletePayment(id: string) {
    return apiService.delete<{ success: boolean; message?: string }>(`/debts/payments/${id}`);
  }

  /**
   * 7. DELETE /debts/:id
   * Xóa khoản công nợ
   */
  async deleteDebt(id: string) {
    return apiService.delete<{ success: boolean; message?: string }>(`/debts/${id}`);
  }

  /**
   * 8. POST /debts/:id/unlock
   * Mở khóa công nợ (chỉ BOD/ADMIN, bắt buộc lý do)
   */
  async unlockDebt(payload: UnlockDebtPayload) {
    const { id, reason } = payload;
    return apiService.post<Debt>(`/debts/${id}/unlock`, { reason });
  }
}

export const debtService = new DebtService();
