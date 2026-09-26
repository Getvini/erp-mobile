import { apiService } from './api';

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export interface QuotationItem {
  id: string;
  version: number;
  status: QuotationStatus | string;
  type: string;
  totalAmount: number;
  note?: string;
  description?: string;
  validUntil?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    id: string;
    fullName?: string;
    username?: string;
  };
}

export interface QuotationDetailItem {
  id?: string;
  serviceId: string;
  servicePackageId?: string;
  packageName?: string;
  packageQuantity?: number;
  quantity: number;
  sellingPrice: number;
  costAtSale: number;
  name?: string;
  isPackageService?: boolean;
  service?: {
    id: string;
    name: string;
    unit?: string;
    costPrice?: number;
  };
}

export interface QuotationDetailResponse extends QuotationItem {
  opportunityId?: string;
  details: QuotationDetailItem[];
  opportunity?: {
    id: string;
    opportunityCode?: string;
    name: string;
    packages?: Array<{
      id: string;
      name: string;
      quantity: number;
      servicePackageId?: string;
      services?: Array<{
        id: string;
        serviceId: string;
        quantity: number;
        sellingPrice?: number;
        service?: {
          id: string;
          name: string;
          unit?: string;
          costPrice?: number;
        };
      }>;
    }>;
  };
}

export interface CreateQuotationDetailPayload {
  serviceId: string;
  quantity: number;
  sellingPrice: number;
  costAtSale: number;
  name?: string;
  packageQuantity?: number;
  packageName?: string;
  servicePackageId?: string;
  isPackageService?: boolean;
}

export interface CreateQuotationPayload {
  opportunityId: string;
  note?: string;
  details: CreateQuotationDetailPayload[];
}

export interface UpdateQuotationPayload {
  opportunityId?: string;
  note?: string;
  status?: string;
  description?: string;
  details?: CreateQuotationDetailPayload[];
}

export const quotationService = {
  async getQuotationsByOpportunity(opportunityId: string) {
    return apiService.get<QuotationItem[]>(`/quotations/opportunity/${opportunityId}`);
  },

  async getQuotation(id: string) {
    return apiService.get<QuotationDetailResponse>(`/quotations/${id}`);
  },

  async createQuotation(payload: CreateQuotationPayload) {
    return apiService.post<QuotationDetailResponse>('/quotations', payload);
  },

  async updateQuotation(id: string, payload: UpdateQuotationPayload) {
    return apiService.put<QuotationDetailResponse>(`/quotations/${id}`, payload);
  },

  async approveQuotation(id: string) {
    return apiService.post<{ message: string; quotation?: any }>(`/quotations/${id}/approve`);
  },

  async rejectQuotation(id: string, reason?: string) {
    return apiService.post<{ message: string }>(`/quotations/${id}/reject`, {
      description: reason,
      reason,
    });
  },

  async getQuotations(params?: Record<string, any>) {
    return apiService.get<any[]>('/quotations', params);
  },

  async deleteQuotation(id: string) {
    return apiService.delete<{ message: string }>(`/quotations/${id}`);
  },

  async createAddendumQuotation(data: any) {
    return apiService.post<any>('/quotations/addendum', data);
  },

  async getOpportunityServices(opportunityId: string) {
    return apiService.get<any[]>(`/opportunity-services/opportunity/${opportunityId}`);
  },

  async getAvailableServices() {
    return apiService.get<any>('/services');
  },

  async getServicePackages() {
    return apiService.get<any[]>('/service-packages');
  },
};
