import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  financeService,
  ContractDebtGroup,
  PaymentPeriod,
} from '@/services/financeService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Hook to fetch contract debts and milestones with TanStack Query
 */
export function useContractDebtsQuery() {
  return useQuery({
    queryKey: queryKeys.finance.contractDebts(),
    queryFn: async (): Promise<ContractDebtGroup[]> => {
      const res = await financeService.getContractDebtsAndMilestones();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

export function usePaymentPeriodDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.finance.paymentPeriod(id || ''),
    queryFn: async (): Promise<PaymentPeriod> => {
      if (!id) throw new Error('Thiếu ID đợt thanh toán');
      const res = await financeService.getPaymentPeriodById(id);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không tìm thấy đợt thanh toán');
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useApprovePaymentPeriodMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await financeService.approvePaymentPeriod(id);
      if (!res.success) throw new Error(res.error || 'Không thể phê duyệt đợt thanh toán');
      return res;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.paymentPeriod(id) });
    },
  });
}

export function useRejectPaymentPeriodMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await financeService.rejectPaymentPeriod(id, reason);
      if (!res.success) throw new Error(res.error || 'Không thể từ chối đợt thanh toán');
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.paymentPeriod(variables.id) });
    },
  });
}

/**
 * Hook to activate debt for a milestone
 */
export function useActivateDebtMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const res = await financeService.activateDebt(milestoneId);
      if (!res.success) {
        throw new Error(res.error || 'Không thể kích hoạt công nợ');
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

/**
 * Hook to record payment
 */
export function useCreatePaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      debtId: string;
      amount: number;
      paymentDate: string;
      note?: string;
      proofLink?: string;
      proofFile?: { name: string; size?: number; uri: string; mimeType?: string };
    }) => {
      const res = await financeService.createPayment(payload);
      if (!res.success) {
        throw new Error(res.error || 'Không thể ghi nhận thanh toán');
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

/**
 * Hook to delete payment record
 */
export function useDeletePaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await financeService.deletePayment(paymentId);
      if (!res.success) {
        throw new Error(res.error || 'Không thể xóa ghi nhận thanh toán');
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

/**
 * Hook to bulk save milestone roadmap for a contract
 */
export function useBulkSaveMilestonesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      milestones,
    }: {
      contractId: string;
      milestones: Array<{
        id?: string;
        name: string;
        percentage?: number;
        amount: number;
        dueDate?: string;
      }>;
    }) => {
      const res = await financeService.bulkSaveMilestones(contractId, milestones);
      if (!res.success) {
        throw new Error(res.error || 'Không thể lưu kế hoạch thanh toán');
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}
