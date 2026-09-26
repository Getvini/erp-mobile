import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  opportunityService,
  OpportunityListFilters,
  CreateOpportunityPayload,
} from '@/services/opportunityService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Hook to fetch opportunities list with TanStack Query caching & refetching
 */
export function useOpportunitiesQuery(filters: OpportunityListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.opportunities.list(filters),
    queryFn: async () => {
      const res = await opportunityService.getOpportunities(filters);
      return res.data;
    },
  });
}

/**
 * Hook to fetch opportunities list with Infinite Scroll pagination
 */
export function useInfiniteOpportunitiesQuery(filters: Omit<OpportunityListFilters, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.opportunities.lists(), 'infinite', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await opportunityService.getOpportunities({
        ...filters,
        page: pageParam,
        limit: filters.limit || 20,
      });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.meta) return undefined;
      const { page, totalPages } = lastPage.meta;
      return page < totalPages ? page + 1 : undefined;
    },
  });
}

/**
 * Hook to fetch detail of a single opportunity
 */
export function useOpportunityDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.opportunities.detail(id),
    queryFn: async () => {
      const res = await opportunityService.getOpportunity(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to create a new opportunity
 */
export function useCreateOpportunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateOpportunityPayload) => {
      const res = await opportunityService.createOpportunity(payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to update an existing opportunity
 */
export function useUpdateOpportunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CreateOpportunityPayload> }) => {
      const res = await opportunityService.updateOpportunity(id, payload);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(variables.id) });
    },
  });
}

/**
 * Hook to approve an opportunity
 */
export function useApproveOpportunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await opportunityService.approveOpportunity(id);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(id) });
    },
  });
}

/**
 * Hook to reject an opportunity (BOD action)
 */
export function useRejectOpportunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await opportunityService.rejectOpportunity(id, reason);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(variables.id) });
    },
  });
}

/**
 * Hook to update opportunity stage
 */
export function useUpdateOpportunityStageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await opportunityService.updateOpportunityStage(id, stage);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(variables.id) });
    },
  });
}

/**
 * Hook to delete an opportunity
 */
export function useDeleteOpportunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await opportunityService.deleteOpportunity(id);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to fetch available services for selection
 */
export function useAvailableServicesQuery() {
  return useQuery({
    queryKey: ['services', 'available'],
    queryFn: async () => {
      const res = await opportunityService.getAvailableServices();
      const raw = res?.data;
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray((raw as any).data)) return (raw as any).data;
      return [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook to fetch service packages
 */
export function useServicePackagesQuery() {
  return useQuery({
    queryKey: ['service-packages'],
    queryFn: async () => {
      const res = await opportunityService.getServicePackages();
      const raw = res?.data;
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray((raw as any).data)) return (raw as any).data;
      return [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook to fetch referral partners
 */
export function useReferralPartnersQuery() {
  return useQuery({
    queryKey: ['referral-partners'],
    queryFn: async () => {
      const res = await opportunityService.getReferralPartners();
      const raw = res?.data;
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray((raw as any).data)) return (raw as any).data;
      return [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook to fetch single referral partner detail
 */
export function useReferralPartnerDetailQuery(id: string) {
  return useQuery({
    queryKey: ['referral-partners', id],
    queryFn: async () => {
      const res = await opportunityService.getReferralPartner(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}
