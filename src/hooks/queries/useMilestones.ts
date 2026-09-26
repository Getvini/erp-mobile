import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  paymentMilestoneService,
  PaymentMilestone,
  CreatePaymentMilestonePayload,
  UpdatePaymentMilestonePayload,
  UpdatePaymentStatusPayload,
  BulkSaveMilestonesPayload,
} from '@/services/paymentMilestoneService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Hook to get payment milestones with filter params
 */
export function usePaymentMilestonesQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.paymentMilestones.list(params),
    queryFn: async (): Promise<PaymentMilestone[]> => {
      const res = await paymentMilestoneService.getPaymentMilestones(params);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Hook to get detail of a single payment milestone
 */
export function usePaymentMilestoneDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.paymentMilestones.detail(id || ''),
    queryFn: async (): Promise<PaymentMilestone> => {
      if (!id) throw new Error('Thiếu ID đợt thanh toán');
      const res = await paymentMilestoneService.getPaymentMilestone(id);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không tìm thấy đợt thanh toán');
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to get payment milestones for a contract
 */
export function usePaymentMilestonesByContractQuery(contractId?: string) {
  return useQuery({
    queryKey: queryKeys.paymentMilestones.byContract(contractId || ''),
    queryFn: async (): Promise<PaymentMilestone[]> => {
      if (!contractId) return [];
      const res = await paymentMilestoneService.getPaymentMilestonesByContract(contractId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(contractId),
  });
}

/**
 * Hook to get payment milestones for a project
 */
export function usePaymentMilestonesByProjectQuery(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.paymentMilestones.byProject(projectId || ''),
    queryFn: async (): Promise<PaymentMilestone[]> => {
      if (!projectId) return [];
      const res = await paymentMilestoneService.getPaymentMilestonesByProject(projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(projectId),
  });
}

/**
 * Hook to create a payment milestone
 */
export function useCreatePaymentMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentMilestonePayload) => {
      const res = await paymentMilestoneService.createPaymentMilestone(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể tạo đợt thanh toán');
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (variables.contractId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.paymentMilestones.byContract(variables.contractId),
        });
      }
    },
  });
}

/**
 * Hook to update a payment milestone
 */
export function useUpdatePaymentMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdatePaymentMilestonePayload) => {
      const res = await paymentMilestoneService.updatePaymentMilestone(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể cập nhật đợt thanh toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (data?.contractId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.paymentMilestones.byContract(data.contractId),
        });
      }
    },
  });
}

/**
 * Hook to delete a payment milestone
 */
export function useDeletePaymentMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contractId }: { id: string; contractId?: string }) => {
      const res = await paymentMilestoneService.deletePaymentMilestone(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return { id, contractId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (variables.contractId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.paymentMilestones.byContract(variables.contractId),
        });
      }
    },
  });
}

/**
 * Hook to update payment status and actual payment date
 */
export function useUpdatePaymentStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdatePaymentStatusPayload) => {
      const res = await paymentMilestoneService.updatePaymentStatus(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể cập nhật trạng thái đợt thanh toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (data?.contractId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.paymentMilestones.byContract(data.contractId),
        });
      }
    },
  });
}

/**
 * Hook to bulk save payment milestones for a contract
 */
export function useBulkSavePaymentMilestonesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkSaveMilestonesPayload) => {
      const res = await paymentMilestoneService.bulkSavePaymentMilestones(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể lưu danh sách đợt thanh toán');
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.paymentMilestones.byContract(variables.contractId),
      });
    },
  });
}
