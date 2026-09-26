import { apiService } from './api';

export enum CustomerType {
  DIRECT = 'DIRECT',
  REFERRAL = 'REFERRAL',
}

export enum OpportunityStatus {
  OPEN = 'OPEN',
  PENDING_OPP_APPROVAL = 'PENDING_OPP_APPROVAL',
  OPP_APPROVED = 'OPP_APPROVED',
  QUOTATION = 'QUOTATION',
  QUOTATION_DRAFTING = 'QUOTATION_DRAFTING',
  PENDING_QUOTE_APPROVAL = 'PENDING_QUOTE_APPROVAL',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  CONTRACT_CREATED = 'CONTRACT_CREATED',
  PROJECT_ASSIGNED = 'PROJECT_ASSIGNED',
  IMPLEMENTATION = 'IMPLEMENTATION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

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
  services?: Array<{ id: string; quantity: number }>;
  packages?: Array<{
    servicePackageId: string;
    name?: string;
    description?: string;
    quantity: number;
    services?: Array<{
      serviceId: string;
      quantity: number;
      sellingPrice?: number;
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
