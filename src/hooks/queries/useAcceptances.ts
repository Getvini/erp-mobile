import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acceptanceService,
  AcceptanceDecision,
  AcceptanceItem,
  AcceptanceListFilters,
} from '@/services/acceptanceService';
import { queryKeys } from '@/services/queryKeys';

export type { AcceptanceListFilters };

/** Invalidation liên phân hệ giống Web acceptances.js (Services/Projects/Tasks/Contracts). */
const invalidateAcceptanceScope = (
  queryClient: ReturnType<typeof useQueryClient>,
  id?: string,
) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.acceptances.all });
  if (id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.acceptances.detail(id) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
};

/**
 * Hook to fetch list of acceptances with caching & filters
 */
export function useAcceptancesQuery(filters: AcceptanceListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.acceptances.list(filters),
    queryFn: async () => {
      const res = await acceptanceService.getAcceptanceRequests(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Hook to fetch single acceptance detail
 */
export function useAcceptanceDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.acceptances.detail(id),
    queryFn: async () => {
      const res = await acceptanceService.getAcceptanceById(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to create an acceptance request — payload parity với Web.
 */
export function useCreateAcceptanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { projectId: string; note?: string; serviceIds?: string[] }) => {
      const res = await acceptanceService.createAcceptanceRequest(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateAcceptanceScope(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.projectId) });
    },
  });
}

/**
 * Hook to process/approve/reject acceptance request (luồng duyệt chính của Web).
 */
export function useProcessAcceptanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, decisions }: { id: string; decisions: AcceptanceDecision[] }) => {
      const res = await acceptanceService.processAcceptanceRequest(id, decisions);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateAcceptanceScope(queryClient, variables.id),
  });
}

/**
 * POST /acceptance/:id/approve — duyệt nhanh toàn bộ biên bản (BOD/ADMIN/ADMIN_SALE/PM).
 */
export function useApproveAcceptanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await acceptanceService.approveAcceptanceRequest(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => invalidateAcceptanceScope(queryClient, id),
  });
}

/**
 * POST /acceptance/:id/reject — từ chối biên bản kèm phản hồi bắt buộc.
 */
export function useRejectAcceptanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      const res = await acceptanceService.rejectAcceptanceRequest(id, feedback);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateAcceptanceScope(queryClient, variables.id),
  });
}

export type { AcceptanceItem };
