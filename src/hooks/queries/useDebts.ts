import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  debtService,
  Debt,
  DebtPayment,
  ActivateDebtPayload,
  CreatePaymentPayload,
  UnlockDebtPayload,
} from '@/services/debtService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Hook to get debts with filter params
 */
export function useDebtsQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.debts.list(params),
    queryFn: async (): Promise<Debt[]> => {
      const res = await debtService.getDebts(params);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Hook to get detail of a single debt
 */
export function useDebtDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.debts.detail(id || ''),
    queryFn: async (): Promise<Debt> => {
      if (!id) throw new Error('Thiếu ID công nợ');
      const res = await debtService.getDebt(id);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không tìm thấy công nợ');
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to get debts by contract ID
 */
export function useDebtsByContractQuery(contractId?: string) {
  return useQuery({
    queryKey: queryKeys.debts.byContract(contractId || ''),
    queryFn: async (): Promise<Debt[]> => {
      if (!contractId) return [];
      const res = await debtService.getDebtsByContract(contractId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(contractId),
  });
}

/**
 * Hook to activate debt for a milestone
 */
export function useActivateDebtItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ActivateDebtPayload) => {
      const res = await debtService.activateDebt(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể kích hoạt công nợ');
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (variables.contractId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.debts.byContract(variables.contractId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.contracts.detail(variables.contractId),
        });
      }
    },
  });
}

/**
 * Hook to record a payment for a debt (kèm chứng từ hóa đơn)
 */
export function useCreateDebtPaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentPayload) => {
      const res = await debtService.createPayment(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể ghi nhận thanh toán');
      }
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.detail(variables.debtId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

/**
 * Hook to delete a payment of a debt
 */
export function useDeleteDebtPaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, debtId }: { paymentId: string; debtId: string }) => {
      const res = await debtService.deletePayment(paymentId);
      if (res.error) {
        throw new Error(res.error || 'Không thể xóa khoản thanh toán');
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.detail(variables.debtId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

/**
 * Hook to delete a debt
 */
export function useDeleteDebtMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await debtService.deleteDebt(id);
      if (res.error) {
        throw new Error(res.error || 'Không thể xóa công nợ');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

/**
 * Hook to unlock a locked debt (BOD/Admin with required reason)
 */
export function useUnlockDebtMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UnlockDebtPayload) => {
      const res = await debtService.unlockDebt(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể mở khóa công nợ');
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.debts.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
  });
}

export { useActivateDebtItemMutation as useActivateDebtMutation };
