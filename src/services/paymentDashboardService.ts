import { apiService } from './api';

export interface PaymentDashboardParams {
  month?: number | null;
  year?: number | null;
  search?: string;
  status?: string;
}

export interface PaymentDashboardOverview {
  totalRevenue?: number;
  totalPaid?: number;
  totalRemaining?: number;
  overdueAmount?: number;
  contracts?: Array<{
    id: string;
    contractCode: string;
    name: string;
    customerName?: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    acceptanceStatus?: string;
    vatInvoiceStatus?: string;
  }>;
}

export interface FinanceDocumentsResponse {
  acceptanceMinutes?: Array<{
    id: string;
    documentNumber?: string;
    signedDate?: string;
    attachmentUrl?: string;
    status?: string;
  }>;
  vatInvoices?: Array<{
    id: string;
    invoiceNumber?: string;
    issueDate?: string;
    amount?: number;
    vatRate?: number;
    vatAmount?: number;
    totalAmount?: number;
    attachmentUrl?: string;
    status?: string;
  }>;
}

export interface CreateAcceptanceMinutePayload {
  contractId: string;
  documentNumber?: string;
  signedDate?: string;
  attachmentUrl?: string;
  notes?: string;
}

export interface CreateVatInvoicePayload {
  contractId: string;
  invoiceNumber: string;
  issueDate: string;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  attachmentUrl?: string;
  notes?: string;
}

class PaymentDashboardService {
  /**
   * Lấy tổng quan tài chính thanh toán / hóa đơn
   */
  async getPaymentDashboard(params?: PaymentDashboardParams): Promise<{ data?: PaymentDashboardOverview; error?: string }> {
    const cleanParams: Record<string, any> = {};
    if (params?.month) cleanParams.month = params.month;
    if (params?.year) cleanParams.year = params.year;
    if (params?.search) cleanParams.search = params.search;
    if (params?.status) cleanParams.status = params.status;

    const res = await apiService.get<PaymentDashboardOverview>('/payment-dashboard', cleanParams);
    return { data: res.data, error: res.error };
  }

  /**
   * Lấy hồ sơ tài chính (Biên bản nghiệm thu & Hóa đơn VAT) theo Hợp đồng
   */
  async getFinanceDocuments(contractId: string): Promise<{ data?: FinanceDocumentsResponse; error?: string }> {
    const res = await apiService.get<FinanceDocumentsResponse>(`/finance-documents/contracts/${contractId}`);
    return { data: res.data, error: res.error };
  }

  /**
   * Lập biên bản nghiệm thu cho hợp đồng
   */
  async createAcceptanceMinute(payload: CreateAcceptanceMinutePayload): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post<any>('/finance-documents/acceptance-minutes', payload);
    return { data: res.data, error: res.error };
  }

  /**
   * Xuất hóa đơn VAT cho hợp đồng
   */
  async createVatInvoice(payload: CreateVatInvoicePayload): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post<any>('/finance-documents/vat-invoices', payload);
    return { data: res.data, error: res.error };
  }
}

export const paymentDashboardService = new PaymentDashboardService();
