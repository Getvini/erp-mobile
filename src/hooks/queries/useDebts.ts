import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  debtService,
  Debt,
  CreatePaymentPayload,
} from '@/services/debtService';
import { queryKeys } from '@/services/queryKeys';

export function useDebtsByContractQuery(contractId?: string) {
  return useQuery({
    queryKey: ['debts', 'contract', contractId],
    queryFn: async (): Promise<Debt[]> => {
      if (!contractId) return [];
      const res = await debtService.getDebtsByContract(contractId);
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
    enabled: Boolean(contractId),
  });
}

const invalidateFinancials = (queryClient: any, contractId?: string) => {
  queryClient.invalidateQueries({ queryKey: ['debts'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
  if (contractId) {
    queryClient.invalidateQueries({ queryKey: ['debts', 'contract', contractId] });
    queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.byContract(contractId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
  }
};

export function useCreatePaymentMutation(contractId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePaymentPayload) => {
      const res = await debtService.createPayment(payload);
      if (res.error || !res.data) throw new Error(res.error || 'Không thể ghi nhận thanh toán');
      return res.data;
    },
    onSuccess: () => {
      invalidateFinancials(queryClient, contractId);
    },
  });
}

export function useDeletePaymentMutation(contractId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await debtService.deletePayment(paymentId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      invalidateFinancials(queryClient, contractId);
    },
  });
}

export function useActivateDebtMutation(contractId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const res = await debtService.activateDebt({ milestoneId, contractId });
      if (res.error || !res.data) throw new Error(res.error || 'Không thể kích hoạt công nợ');
      return res.data;
    },
    onSuccess: () => {
      invalidateFinancials(queryClient, contractId);
    },
  });
}
export function useDebtsQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['debts', params],
    queryFn: async (): Promise<Debt[]> => {
      const res = await debtService.getDebts(params);
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
  });
}

export function useDebtDetailQuery(debtId?: string) {
  return useQuery({
    queryKey: ['debts', 'detail', debtId],
    queryFn: async (): Promise<Debt | null> => {
      if (!debtId) return null;
      const res = await debtService.getDebt(debtId);
      if (res.error) throw new Error(res.error);
      return res.data || null;
    },
    enabled: Boolean(debtId),
  });
}

export function useDeleteDebtMutation(contractId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await debtService.deleteDebt(id);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      invalidateFinancials(queryClient, contractId);
    },
  });
}

export function useUnlockDebtMutation(contractId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; reason: string }) => {
      const res = await debtService.unlockDebt(payload);
      if (res.error || !res.data) throw new Error(res.error || 'Không thể mở khóa công nợ');
      return res.data;
    },
    onSuccess: () => {
      invalidateFinancials(queryClient, contractId);
    },
  });
}

export const useActivateDebtItemMutation = useActivateDebtMutation;
export const useCreateDebtPaymentMutation = useCreatePaymentMutation;
export const useDeleteDebtPaymentMutation = useDeletePaymentMutation;
