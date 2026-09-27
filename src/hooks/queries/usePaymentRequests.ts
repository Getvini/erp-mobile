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
} from '@/services/paymentRequestService';
import { queryKeys } from '@/services/queryKeys';

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
          totalPendingAmount: 0,
          totalApprovedAmount: 0,
          totalPaidAmount: 0,
          totalRequestsCount: 0,
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
