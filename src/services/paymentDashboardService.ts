import { apiService } from './api';

export interface PaymentDashboardParams {
  year?: number | null;
  search?: string;
  contractStatus?: string;
  quotationStatus?: string;
  projectStatus?: string;
  paymentStatus?: string;
  confirmationStatus?: string;
  salesOwnerId?: string;
  customerId?: string;
  projectManagerId?: string;
  paymentMonth?: number | null;
  page?: number;
  limit?: number;
}

export interface FinanceDocument {
  id: string;
  name: string;
  fileUrl: string;
  createdAt?: string;
  createdBy?: { id: string; fullName?: string };
}

export interface PaymentDashboardRow {
  id: string;
  contractCode?: string;
  contractName?: string;
  contractStatus?: string;
  customerName?: string;
  customerId?: string;
  projectName?: string;
  quotationStatus?: string;
  projectStatus?: string;
  salesOwner?: { id: string; name: string } | null;
  projectManager?: string | null;
  projectManagerId?: string | null;
  account?: string | null;
  sellingPrice?: number;
  vatRate?: number;
  vatAmount?: number;
  totalWithVat?: number;
  paidAmount?: number;
  unpaidAmount?: number;
  paymentStatus?: string;
  isConfirmed?: boolean;
  collectionMonth?: string | null;
  latestPaymentDate?: string | null;
  acceptanceMinutes?: FinanceDocument[];
  vatInvoices?: FinanceDocument[];
}

export interface MonthlyReconciliation {
  month: number;
  planned: number;
  paid: number;
  unpaid: number;
  cashPaid?: number;
  breakdown?: {
    total?: number;
    onTime?: number;
    overdue?: number;
    prepaid?: number;
    details?: Record<string, any>[];
  };
}

export interface PaymentDashboardOverview {
  year?: number;
  summary?: {
    totalContractValue?: number;
    totalPaid?: number;
    totalUnpaid?: number;
    collectionRate?: number;
    trackingContracts?: number;
    totalContracts?: number;
    cancelledContracts?: number;
  };
  monthly?: MonthlyReconciliation[];
  tabCounts?: { all?: number; waiting?: number; paid?: number; unconfirmed?: number };
  rows?: PaymentDashboardRow[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
  filterOptions?: {
    salesOwners?: { id: string; name: string }[];
    customers?: { id: string; name: string }[];
    projectManagers?: { id: string; name: string }[];
  };
}

export interface FinanceDocumentsResponse {
  acceptanceMinutes?: FinanceDocument[];
  vatInvoices?: FinanceDocument[];
}

export interface CreateFinanceDocumentPayload {
  contractId: string;
  name: string;
  fileUrl: string;
}

export type CreateAcceptanceMinutePayload = CreateFinanceDocumentPayload;
export type CreateVatInvoicePayload = CreateFinanceDocumentPayload;

class PaymentDashboardService {
  async getPaymentDashboard(params?: PaymentDashboardParams): Promise<{ data?: PaymentDashboardOverview; error?: string }> {
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    const res = await apiService.get<PaymentDashboardOverview>('/payment-dashboard', cleanParams);
    return { data: res.data, error: res.error };
  }

  async getFinanceDocuments(contractId: string): Promise<{ data?: FinanceDocumentsResponse; error?: string }> {
    const res = await apiService.get<FinanceDocumentsResponse>(`/finance-documents/contracts/${contractId}`);
    return { data: res.data, error: res.error };
  }

  async createAcceptanceMinute(payload: CreateAcceptanceMinutePayload): Promise<{ data?: FinanceDocument; error?: string }> {
    const res = await apiService.post<FinanceDocument>('/finance-documents/acceptance-minutes', payload);
    return { data: res.data, error: res.error };
  }

  async createVatInvoice(payload: CreateVatInvoicePayload): Promise<{ data?: FinanceDocument; error?: string }> {
    const res = await apiService.post<FinanceDocument>('/finance-documents/vat-invoices', payload);
    return { data: res.data, error: res.error };
  }
}

export const paymentDashboardService = new PaymentDashboardService();
