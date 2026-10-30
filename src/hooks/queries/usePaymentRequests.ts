import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  paymentRequestService,
  PaymentRequest,
  PaymentRequestsTotalDebt,
  CreatePaymentRequestPayload,
  UpdatePaymentRequestPayload,
  ReviewPaymentRequestPayload,
  BodDecidePaymentRequestPayload,
  PayPaymentRequestPayload,
  RecordPaymentPayload,
  SubmitSettlementPayload,
  ApproveSettlementPayload,
  RejectSettlementPayload,
  ServiceBudgetInfo,
} from '@/services/paymentRequestService';
import { queryKeys } from '@/services/queryKeys';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  canDisbursePayment, canReviewPaymentSettlement, isPaymentAccountant,
  isPaymentBod, remainingPaymentAmount,
} from '@/utils/paymentRequestPermissions';

async function assertPaymentWriteAction(id: string, action: 'disburse' | 'settlement' | 'bod', amount?: number) {
  const user = useAuthStore.getState().user;
  if (action === 'bod' ? !isPaymentBod(user?.role) : !isPaymentAccountant(user?.role)) {
    throw new Error('Bạn không có quyền thực hiện thao tác thanh toán này.');
  }
  const response = await paymentRequestService.getPaymentRequest(id);
  if (response.error || !response.data?.id) throw new Error(response.error || 'Không tải được phiếu thanh toán.');
  const currentUser = useAuthStore.getState().user;
  const currentActor = { id: currentUser?.id, role: currentUser?.role };
  const request = response.data;
  if (action === 'bod' && (!isPaymentBod(currentActor.role) || request.approvalStatus !== 'PENDING_BOD')) {
    throw new Error('Phiếu không ở trạng thái chờ BOD hoặc bạn không có quyền duyệt BOD.');
  }
  if (action === 'disburse' && !canDisbursePayment(request, currentActor)) {
    throw new Error('Phiếu chưa được duyệt, đã chi đủ hoặc bạn không có quyền giải ngân.');
  }
  if (action === 'disburse' && amount !== undefined &&
    (!Number.isFinite(amount) || amount <= 0 || amount > remainingPaymentAmount(request))) {
    throw new Error('Số tiền phải lớn hơn 0 và không vượt số còn lại.');
  }
  if (action === 'settlement' && !canReviewPaymentSettlement(request, currentActor)) {
    throw new Error('Không được tự duyệt quyết toán hoặc phiếu chưa đủ điều kiện duyệt.');
  }
}

export interface PaymentRequestFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  approvalStatus?: string;
  paymentStatus?: string;
  projectId?: string;
  contractId?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Hook to get list of payment requests with filters
 */
export function usePaymentRequestsQuery(filters: PaymentRequestFilters = {}) {
  return useQuery({
    queryKey: queryKeys.paymentRequests.list(filters),
    queryFn: async (): Promise<PaymentRequest[]> => {
      const res = await paymentRequestService.getPaymentRequests(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Hook to get infinite scrolling list of payment requests
 */
export function useInfinitePaymentRequestsQuery(filters: PaymentRequestFilters = {}) {
  const limit = filters.limit || 20;

  return useInfiniteQuery({
    queryKey: [...queryKeys.paymentRequests.lists(), 'infinite', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await paymentRequestService.getPaymentRequests({
        ...filters,
        page: pageParam,
        limit,
      });
      if (res.error) {
        throw new Error(res.error);
      }
      return {
        data: (res.data as PaymentRequest[]) || [],
        page: pageParam,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.data || lastPage.data.length < limit) {
        return undefined;
      }
      return lastPage.page + 1;
    },
  });
}

/**
 * Hook to get single payment request detail by ID
 */
export function usePaymentRequestDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.paymentRequests.detail(id || ''),
    queryFn: async (): Promise<PaymentRequest> => {
      if (!id) throw new Error('Thiếu ID đề xuất thanh toán');
      const res = await paymentRequestService.getPaymentRequest(id);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không tìm thấy đề xuất thanh toán');
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to get total debt / payment summary stats
 */
export function usePaymentRequestsTotalDebtQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.paymentRequests.totalDebt(params),
    queryFn: async (): Promise<PaymentRequestsTotalDebt> => {
      const res = await paymentRequestService.getPaymentRequestsTotalDebt(params);
      if (res.error || !res.data) {
        return {
          totalDebt: 0,
          projectDebt: 0,
          otherWorkDebt: 0,
        };
      }
      return res.data;
    },
  });
}

/**
 * Hook to create a new payment request
 */
export function useCreatePaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentRequestPayload) => {
      const res = await paymentRequestService.createPaymentRequest(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể tạo đề xuất thanh toán');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
    },
  });
}

/**
 * Hook to update a payment request
 */
export function useUpdatePaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdatePaymentRequestPayload) => {
      const res = await paymentRequestService.updatePaymentRequest(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể cập nhật đề xuất thanh toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to submit payment request for review
 */
export function useSubmitPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await paymentRequestService.submitPaymentRequest(id);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể gửi duyệt đề xuất thanh toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to supplement payment request with additional info/docs
 */
export function useSupplementPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string; [key: string]: any }) => {
      const res = await paymentRequestService.supplementPaymentRequest(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể bổ sung chứng từ đề xuất thanh toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to delete a draft payment request
 */
export function useDeletePaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await paymentRequestService.deletePaymentRequest(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      queryClient.removeQueries({ queryKey: queryKeys.paymentRequests.detail(id) });
    },
  });
}

/**
 * Hook to review (approve / reject / request docs) by Reviewer / Admin Sale
 */
export function useReviewPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReviewPaymentRequestPayload) => {
      const res = await paymentRequestService.reviewPaymentRequest(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể phê duyệt đề xuất thanh toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook for BOD decision (approve / reject + confirm due date)
 */
export function useBodDecidePaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BodDecidePaymentRequestPayload) => {
      await assertPaymentWriteAction(payload.id, 'bod');
      const res = await paymentRequestService.bodDecidePaymentRequest(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể xử lý quyết định BOD');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook for Accountant payment execution
 */
export function usePayPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PayPaymentRequestPayload) => {
      await assertPaymentWriteAction(payload.id, 'disburse', payload.paidAmount);
      const res = await paymentRequestService.payPaymentRequest(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể thực hiện chi tiền');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to cancel payment request
 */
export function useCancelPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await paymentRequestService.cancelPaymentRequest({ id, reason });
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể hủy đề xuất thanh toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to get 2-tier service budget comparison
 */
export function useServiceBudgetQuery(params: {
  projectId?: string;
  taskId?: string;
  excludeRequestId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.paymentRequests.serviceBudget(params),
    queryFn: async (): Promise<ServiceBudgetInfo | null> => {
      if (!params.projectId) return null;
      const res = await paymentRequestService.getServiceBudget(params);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || null;
    },
    enabled: Boolean(params.projectId),
  });
}

/**
 * Hook to get project budget summary
 */
export function useProjectBudgetSummaryQuery(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.paymentRequests.projectBudgetSummary(projectId || ''),
    queryFn: async () => {
      if (!projectId) return null;
      const res = await paymentRequestService.getProjectBudgetSummary(projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || null;
    },
    enabled: Boolean(projectId),
  });
}

/**
 * Hook for Accountant installment disbursement (chi tiền từng đợt)
 */
export function useRecordPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RecordPaymentPayload) => {
      await assertPaymentWriteAction(payload.id, 'disburse', payload.amount);
      const res = await paymentRequestService.recordPayment(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể ghi nhận đợt giải ngân');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to submit settlement documents (nhân sự nộp hoàn ứng)
 */
export function useSubmitSettlementPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitSettlementPayload) => {
      const res = await paymentRequestService.submitSettlement(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể nộp chứng từ quyết toán hoàn ứng');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to approve settlement (Kế toán duyệt hoàn ứng)
 */
export function useApproveSettlementPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ApproveSettlementPayload) => {
      await assertPaymentWriteAction(payload.id, 'settlement');
      const res = await paymentRequestService.approveSettlement(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể phê duyệt quyết toán hoàn ứng');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to reject settlement (Kế toán từ chối hoàn ứng)
 */
export function useRejectSettlementPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RejectSettlementPayload) => {
      await assertPaymentWriteAction(payload.id, 'settlement');
      const res = await paymentRequestService.rejectSettlement(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể từ chối quyết toán');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to add additional settlement files
 */
export function useAddSettlementFilesPaymentRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string; files: any[] }) => {
      const res = await paymentRequestService.addSettlementFiles(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể bổ sung chứng từ quyết toán');
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.detail(variables.id) });
      }
    },
  });
}

