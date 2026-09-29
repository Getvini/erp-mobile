import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contractAddendumService,
  AddendumMilestoneLine,
  AddendumServiceLine,
  CreateAddendumPayload,
} from '@/services/contractAddendumService';
import { queryKeys } from '@/services/queryKeys';

export type { CreateAddendumPayload };

/**
 * Danh sách phụ lục của hợp đồng — đọc từ `contract.addendums` của GET /contracts/:id.
 * (Backend KHÔNG có GET /contract-addendums.)
 */
export function useContractAddendumsQuery(contractId: string) {
  return useQuery({
    queryKey: [...queryKeys.contracts.detail(contractId), 'addendums'],
    queryFn: async () => {
      const res = await contractAddendumService.getContractAddendums(contractId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(contractId),
  });
}

/** Invalidation: phụ lục ảnh hưởng Hợp đồng / Dự án / Task / Công nợ / Milestone. */
const invalidateAddendumScope = (
  queryClient: ReturnType<typeof useQueryClient>,
  contractId?: string,
) => {
  if (contractId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
};

export function useCreateContractAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAddendumPayload) => {
      const res = await contractAddendumService.createContractAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useAddAddendumItemsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      contractId?: string;
      services: AddendumServiceLine[];
      milestones?: AddendumMilestoneLine[];
    }) => {
      const res = await contractAddendumService.addAddendumItems(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useUploadSignedAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; contractId?: string; file: any }) => {
      const res = await contractAddendumService.uploadSignedAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useScaleDownAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      contractId?: string;
      cancelServiceIds: string[];
      refundAmount: number;
    }) => {
      const res = await contractAddendumService.scaleDownAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useSaleApproveAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      contractId?: string;
      selectedItems: AddendumServiceLine[];
      note?: string;
    }) => {
      const res = await contractAddendumService.saleApproveAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useSaleRejectAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; contractId?: string; note: string }) => {
      const res = await contractAddendumService.saleRejectAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useResubmitAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      contractId?: string;
      selectedItems?: AddendumServiceLine[];
      name?: string;
      description?: string;
    }) => {
      const res = await contractAddendumService.resubmitAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useBodApproveAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; contractId?: string; note?: string }) => {
      const res = await contractAddendumService.bodApproveAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}

export function useBodRejectAddendumMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; contractId?: string; note: string }) => {
      const res = await contractAddendumService.bodRejectAddendum(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data, variables) =>
      invalidateAddendumScope(queryClient, data?.contract?.id || variables.contractId),
  });
}
