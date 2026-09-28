import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractService, CreateContractPayload } from '@/services/contractService';
import { queryKeys } from '@/services/queryKeys';

export interface ContractListFilters {
  search?: string;
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

/**
 * Hook to fetch list of contracts with filtering & caching
 */
export function useContractsQuery(filters: ContractListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.contracts.list(filters),
    queryFn: async () => {
      const res = await contractService.getContracts(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
  });
}

/**
 * Hook to fetch detail of a single contract
 */
export function useContractDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: async () => {
      const res = await contractService.getContract(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to create a new contract
 */
export function useCreateContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateContractPayload) => {
      const res = await contractService.createContract(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

/**
 * Hook to upload contract proposal
 */
export function useUploadProposalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { file?: any; contractLink?: string; quotationLink?: string };
    }) => {
      const res = await contractService.uploadProposal(id, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(variables.id) });
    },
  });
}

/**
 * Hook to upload signed contract
 */
export function useUploadSignedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: any }) => {
      const res = await contractService.uploadSigned(id, file);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(variables.id) });
    },
  });
}

/**
 * Hook to approve contract proposal (BOD/Admin action)
 */
export function useApproveProposalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await contractService.approveProposal(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(id) });
    },
  });
}

/**
 * Hook to reject contract proposal (BOD/Admin action)
 */
export function useRejectProposalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await contractService.rejectProposal(id, reason);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(variables.id) });
    },
  });
}

/** Invalidate toàn bộ phạm vi hợp đồng (detail + list + công nợ + milestone). */
const invalidateContractScope = (
  queryClient: ReturnType<typeof useQueryClient>,
  id?: string,
) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
  if (id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(id) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.paymentMilestones.all });
};

/**
 * Xóa hợp đồng — BỊ CHẶN trên UI khi hợp đồng đã ký duyệt (Quality Gate).
 * ⚠️ `useUpdateContractMutation` / `useUpdateContractStatusMutation` KHÔNG được cung cấp
 * vì backend không expose `PUT /contracts/:id` và `PATCH /contracts/:id/status`.
 */
export function useDeleteContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await contractService.deleteContract(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => invalidateContractScope(queryClient, id),
  });
}

/** Cập nhật nickname dịch vụ trong hợp đồng. */
export function useUpdateContractServiceNicknameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string; nickname: string }) => {
      const res = await contractService.updateContractServiceNickname(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/** Thêm mốc thanh toán vào hợp đồng. */
export function useAddContractMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string } & Record<string, any>) => {
      const res = await contractService.addMilestone(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateContractScope(queryClient, variables.id),
  });
}

/** Cập nhật mốc thanh toán của hợp đồng. */
export function useUpdateContractMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string } & Record<string, any>) => {
      const res = await contractService.updateMilestone(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => invalidateContractScope(queryClient),
  });
}

/** Xóa mốc thanh toán của hợp đồng. */
export function useDeleteContractMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await contractService.deleteMilestone(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => invalidateContractScope(queryClient),
  });
}
