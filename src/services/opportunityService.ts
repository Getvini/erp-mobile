import { apiService } from './api';

export enum CustomerType {
  DIRECT = 'DIRECT',
  REFERRAL = 'REFERRAL',
}

export enum OpportunityStatus {
  OPEN = 'OPEN',
  PENDING_OPP_APPROVAL = 'PENDING_OPP_APPROVAL',
  OPP_REJECTED = 'OPP_REJECTED',
  OPP_APPROVED = 'OPP_APPROVED',
  QUOTATION = 'QUOTATION',
  QUOTATION_DRAFTING = 'QUOTATION_DRAFTING',
  PENDING_QUOTE_APPROVAL = 'PENDING_QUOTE_APPROVAL',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  CONTRACT_CREATED = 'CONTRACT_CREATED',
  CONTRACT_APPROVED = 'CONTRACT_APPROVED',
  PROJECT_ASSIGNED = 'PROJECT_ASSIGNED',
  IMPLEMENTATION = 'IMPLEMENTATION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Mới',
  PENDING_OPP_APPROVAL: 'Đang chờ duyệt',
  OPP_REJECTED: 'Không duyệt',
  OPP_APPROVED: 'Đã duyệt',
  QUOTATION: 'Báo giá',
  QUOTATION_DRAFTING: 'Đang làm báo giá',
  PENDING_QUOTE_APPROVAL: 'Chờ duyệt báo giá',
  QUOTE_APPROVED: 'Đã duyệt báo giá',
  CONTRACT_CREATED: 'Đang làm hợp đồng',
  CONTRACT_APPROVED: 'Đã tạo hợp đồng',
  PROJECT_ASSIGNED: 'Đã giao dự án',
  IMPLEMENTATION: 'Đã triển khai',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const OPPORTUNITY_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  OPEN: { label: 'Mới', color: '#C2410C', bg: '#FFF7ED' },
  PENDING_OPP_APPROVAL: { label: 'Đang chờ duyệt', color: '#D97706', bg: '#FEF3C7' },
  OPP_REJECTED: { label: 'Không duyệt', color: '#DC2626', bg: '#FEE2E2' },
  OPP_APPROVED: { label: 'Đã duyệt', color: '#059669', bg: '#D1FAE5' },
  QUOTATION: { label: 'Báo giá', color: '#4F46E5', bg: '#EEF2FF' },
  QUOTATION_DRAFTING: { label: 'Đang làm báo giá', color: '#7C3AED', bg: '#F3E8FF' },
  PENDING_QUOTE_APPROVAL: { label: 'Chờ duyệt báo giá', color: '#D97706', bg: '#FEF3C7' },
  QUOTE_APPROVED: { label: 'Đã duyệt báo giá', color: '#059669', bg: '#ECFDF5' },
  CONTRACT_CREATED: { label: 'Đang làm hợp đồng', color: '#0891B2', bg: '#ECFEFF' },
  CONTRACT_APPROVED: { label: 'Đã tạo hợp đồng', color: '#16A34A', bg: '#DCFCE7' },
  PROJECT_ASSIGNED: { label: 'Đã giao dự án', color: '#4338CA', bg: '#EEF2FF' },
  IMPLEMENTATION: { label: 'Đã triển khai', color: '#0D9488', bg: '#F0FDFA' },
  COMPLETED: { label: 'Hoàn thành', color: '#16A34A', bg: '#DCFCE7' },
  CANCELLED: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' },
};

export interface OpportunityServiceItem {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  expectedRevenue?: number;
  description?: string;
}

export interface OpportunityItem {
  id: string;
  opportunityCode: string;
  name: string;
  description?: string;
  field?: string;
  expectedRevenue?: number;
  budget?: number;
  startDate?: string;
  endDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  successChance?: number;
  region?: string[] | string;
  durationMonths?: number;
  status: OpportunityStatus | string;
  customerType?: CustomerType | string;
  source?: 'INTERNAL' | 'REFERRAL_PARTNER' | string;
  customerId?: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  leadAddress?: string;
  leadTaxId?: string;
  customerRequirements?: string;
  customer?: {
    id: string;
    name: string;
    phone?: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
    taxId?: string;
  };
  referralPartnerId?: string;
  referralPartner?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    taxId?: string;
  };
  packages?: Array<{
    id: string;
    name: string;
    quantity: number;
    description?: string;
    services?: Array<{
      id: string;
      serviceId: string;
      service?: {
        name: string;
        unit?: string;
        costPrice?: number;
      };
      quantity: number;
      sellingPrice: number;
      unit?: string;
    }>;
  }>;
  services?: Array<{
    id?: string;
    serviceId?: string;
    serviceName?: string;
    service?: {
      name: string;
      unit?: string;
    };
    quantity?: number;
    sellingPrice?: number;
    expectedRevenue?: number;
    description?: string;
    opportunityPackageId?: string | null;
    unit?: string;
  }>;
  attachments?: Array<{
    id?: string;
    name: string;
    url: string;
    type: 'FILE' | 'LINK' | string;
    size?: number;
  }>;
  quotations?: any[];
  contracts?: Array<{
    id: string;
    contractCode: string;
    name?: string;
    status?: string;
    sellingPrice?: number;
    totalWithVat?: number;
  }>;
  creator?: {
    id: string;
    fullName?: string;
    username?: string;
  };
  createdBy?: {
    id: string;
    fullName?: string;
    username?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface OpportunityListFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface OpportunityListResponse {
  data: OpportunityItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateOpportunityPayload {
  name: string;
  customerType?: CustomerType | string;
  source?: 'INTERNAL' | 'REFERRAL_PARTNER' | string;
  field?: string;
  priority?: string;
  customerId?: string | null;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  leadAddress?: string;
  leadTaxId?: string;
  referralPartnerId?: string | null;
  description?: string;
  expectedRevenue?: number;
  budget?: number;
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  successChance?: number;
  region?: string[];
  customerRequirements?: string;
  links?: string[];
  services?: Array<{
    id: string;
    quantity: number;
    jobs?: Array<{
      jobId: string;
      name?: string;
      isBriefVideo?: boolean;
      included: boolean;
      briefVideo?: string;
    }>;
  }>;
  packages?: Array<{
    servicePackageId: string;
    name?: string;
    description?: string;
    quantity: number;
    services?: Array<{
      serviceId: string;
      quantity: number;
      sellingPrice?: number;
      jobs?: Array<{
        jobId: string;
        name?: string;
        isBriefVideo?: boolean;
        included: boolean;
        briefVideo?: string;
      }>;
    }>;
  }>;
  attachments?: Array<{ type: string; name: string; url: string }>;
}

export const opportunityService = {
  async getOpportunities(filters: OpportunityListFilters = {}) {
    return apiService.get<OpportunityListResponse>('/opportunities', filters);
  },

  async getOpportunity(id: string) {
    return apiService.get<OpportunityItem>(`/opportunities/${id}`);
  },

  async createOpportunity(payload: CreateOpportunityPayload) {
    return apiService.post<OpportunityItem>('/opportunities', payload);
  },

  async updateOpportunity(id: string, payload: Partial<CreateOpportunityPayload>) {
    return apiService.patch<OpportunityItem>(`/opportunities/${id}`, payload);
  },

  async addCustomerToOpportunity(
    id: string,
    data: {
      customerId: string;
      referralPartnerId?: string | null;
      customerType?: string;
    }
  ) {
    return apiService.patch<OpportunityItem>(`/opportunities/${id}/addcustomer`, data);
  },

  async approveOpportunity(id: string) {
    return apiService.patch<{ message: string }>(`/opportunities/${id}/approve`);
  },

  async rejectOpportunity(id: string, reason?: string) {
    return apiService.patch<{ message: string }>(`/opportunities/${id}/reject`, { reason });
  },

  async updateOpportunityStage(id: string, stage: string) {
    return apiService.patch<{ message: string }>(`/opportunities/${id}/stage`, { stage });
  },

  async deleteOpportunity(id: string) {
    return apiService.delete<{ message: string }>(`/opportunities/${id}`);
  },

  async getOpportunityServices(opportunityId: string) {
    return apiService.get<any[]>(`/opportunity-services/opportunity/${opportunityId}`);
  },

  async getOpportunityService(id: string) {
    return apiService.get<any>(`/opportunity-services/${id}`);
  },

  async createOpportunityService(data: any) {
    return apiService.post<any>('/opportunity-services', data);
  },

  async updateOpportunityService(id: string, data: any) {
    return apiService.patch<any>(`/opportunity-services/${id}`, data);
  },

  async deleteOpportunityService(id: string) {
    return apiService.delete<{ message: string }>(`/opportunity-services/${id}`);
  },

  async getAvailableServices() {
    return apiService.get<any>('/services');
  },

  async getServicePackages() {
    return apiService.get<any[]>('/service-packages');
  },

  async getReferralPartners() {
    return apiService.get<Array<{ id: string; name: string; phone?: string; email?: string }>>('/referral-partners');
  },

  async getReferralPartner(id: string) {
    return apiService.get<{
      id: string;
      name: string;
      taxId?: string;
      phone?: string;
      email?: string;
      customers?: Array<{
        id: string;
        name: string;
        taxId?: string;
        phoneNumber?: string;
        phone?: string;
        email?: string;
        address?: string;
      }>;
    }>(`/referral-partners/${id}`);
  },
};
