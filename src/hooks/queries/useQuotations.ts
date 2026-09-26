import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { quotationService } from '@/services/quotationService';
import { queryKeys } from '@/services/queryKeys';

export interface QuotationFilters {
  search?: string;
  status?: string;
  opportunityId?: string;
  page?: number;
  limit?: number;
}

export interface CreateQuotationDto {
  opportunityId: string;
  title: string;
  totalAmount: number;
  vatRate?: number;
  discountAmount?: number;
  items: Array<{
    serviceId?: string;
    servicePackageId?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * Hook to fetch list of quotations
 */
export function useQuotationsQuery(filters: QuotationFilters = {}) {
  return useQuery({
    queryKey: queryKeys.quotations.list(filters),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.search) searchParams.append('search', filters.search);
      if (filters.status) searchParams.append('status', filters.status);
      if (filters.opportunityId) searchParams.append('opportunityId', filters.opportunityId);
      if (filters.page) searchParams.append('page', String(filters.page));
      if (filters.limit) searchParams.append('limit', String(filters.limit));

      const queryString = searchParams.toString();
      const endpoint = `/quotations${queryString ? `?${queryString}` : ''}`;
      
      const res = await apiService.get<any>(endpoint);
      return res.data;
    },
  });
}

/**
 * Hook to fetch detail of a quotation
 */
export function useQuotationDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.quotations.detail(id),
    queryFn: async () => {
      const res = await quotationService.getQuotation(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to create a new quotation
 */
export function useCreateQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await quotationService.createQuotation(payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to update an existing quotation
 */
export function useUpdateQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await quotationService.updateQuotation(id, payload);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to fetch opportunity services for quotation creation
 */
export function useOpportunityServicesQuery(opportunityId: string) {
  return useQuery({
    queryKey: ['opportunityServices', opportunityId],
    queryFn: async () => {
      const res = await quotationService.getOpportunityServices(opportunityId);
      return res.data || [];
    },
    enabled: Boolean(opportunityId),
  });
}

/**
 * Hook to fetch quotations for a specific opportunity
 */
export function useOpportunityQuotationsQuery(opportunityId: string) {
  return useQuery({
    queryKey: queryKeys.quotations.list({ opportunityId }),
    queryFn: async () => {
      const res = await quotationService.getQuotationsByOpportunity(opportunityId);
      return res.data || [];
    },
    enabled: Boolean(opportunityId),
  });
}

/**
 * Hook to approve a quotation (BOD action)
 */
export function useApproveQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await quotationService.approveQuotation(id);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to reject a quotation (BOD action)
 */
export function useRejectQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await quotationService.rejectQuotation(id, reason);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to delete a quotation
 */
export function useDeleteQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await quotationService.deleteQuotation(id);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to create an addendum quotation
 */
export function useCreateAddendumQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await quotationService.createAddendumQuotation(payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

