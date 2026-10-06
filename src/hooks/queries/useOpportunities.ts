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
 * Hook to add an existing customer to an opportunity (PATCH /opportunities/:id/addcustomer)
 */
export function useAddCustomerToOpportunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      customerId: string;
      referralPartnerId?: string | null;
      customerType?: string;
    }) => {
      const res = await opportunityService.addCustomerToOpportunity(id, data);
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

/** Gửi lại cơ hội đã bị từ chối để BOD duyệt lại. */
export function useResubmitOpportunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await opportunityService.resubmitOpportunity(id);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.detail(id) });
    },
  });
}

/** Cập nhật giá vốn các hạng mục thuộc dịch vụ của cơ hội. */
export function useUpdateOpportunityServiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      opportunityId,
      jobs,
    }: {
      id: string;
      opportunityId: string;
      jobs: { id: string; costAtSale: number }[];
    }) => {
      const res = await opportunityService.updateOpportunityService(id, { jobs });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities.detail(variables.opportunityId),
      });
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
 * Phase P2: `useServicePackagesQuery`, `useReferralPartnersQuery` và
 * `useReferralPartnerDetailQuery` đã được chuyển về module chuyên trách
 * (`@/hooks/queries/useServicePackages`, `@/hooks/queries/useReferralPartners`)
 * để chỉ còn MỘT query key cho mỗi resource — tránh 2 cache song song.
 * Hãy import trực tiếp từ các module đó.
 */
