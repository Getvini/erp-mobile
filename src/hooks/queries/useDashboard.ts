import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dashboardService,
  DashboardParams,
  DashboardResponse,
  TaskItem,
} from '@/services/dashboardService';
import {
  paymentDashboardService,
  PaymentDashboardParams,
  PaymentDashboardOverview,
  FinanceDocumentsResponse,
  CreateAcceptanceMinutePayload,
  CreateVatInvoicePayload,
} from '@/services/paymentDashboardService';
import { queryKeys } from '@/services/queryKeys';
import { normalizeTaskListResponse } from '@/services/responseAdapters';

export type { DashboardParams };

/**
 * Custom TanStack Query Hook lấy tổng hợp dữ liệu Bảng điều khiển kinh doanh & vận hành
 */
export function useDashboardQuery(params: DashboardParams = {}) {
  return useQuery<DashboardResponse>({
    queryKey: queryKeys.dashboard.summary(params),
    queryFn: async () => {
      const res = await dashboardService.getDashboardData(params);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || {};
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Hook lấy dữ liệu Bảng điều khiển tài chính & thanh toán (cho Admin / Kế toán / Ban Giám đốc)
 */
export function usePaymentDashboardQuery(params: PaymentDashboardParams = {}) {
  return useQuery<PaymentDashboardOverview>({
    queryKey: queryKeys.paymentDashboard.overview(params),
    queryFn: async () => {
      const res = await paymentDashboardService.getPaymentDashboard(params);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || {};
    },
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Hook lấy hồ sơ tài chính (Biên bản nghiệm thu & Hóa đơn VAT) theo Hợp đồng
 */
export function useFinanceDocumentsQuery(contractId?: string) {
  return useQuery<FinanceDocumentsResponse>({
    queryKey: queryKeys.financeDocuments.byContract(contractId || ''),
    queryFn: async () => {
      if (!contractId) return {};
      const res = await paymentDashboardService.getFinanceDocuments(contractId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || {};
    },
    enabled: !!contractId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Mutation lập biên bản nghiệm thu
 */
export function useCreateAcceptanceMinuteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAcceptanceMinutePayload) => {
      const res = await paymentDashboardService.createAcceptanceMinute(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.financeDocuments.byContract(variables.contractId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.paymentDashboard.all,
      });
    },
  });
}

/**
 * Mutation xuất hóa đơn VAT
 */
export function useCreateVatInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateVatInvoicePayload) => {
      const res = await paymentDashboardService.createVatInvoice(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.financeDocuments.byContract(variables.contractId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.paymentDashboard.all,
      });
    },
  });
}

/**
 * Hook lấy danh sách công việc cá nhân của người dùng hiện tại
 */
export function useMyTasksQuery() {
  return useQuery<unknown, Error, TaskItem[]>({
    queryKey: queryKeys.tasks.list({ type: 'my-tasks' }),
    queryFn: async () => {
      const res = await dashboardService.getMyTasks();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    select: normalizeTaskListResponse,
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Hook lấy danh sách công việc chờ duyệt (cho Lead / PM / Quản lý)
 */
export function useAwaitingReviewTasksQuery(enabled = true) {
  return useQuery<unknown, Error, TaskItem[]>({
    queryKey: queryKeys.tasks.list({ type: 'awaiting-review' }),
    queryFn: async () => {
      const res = await dashboardService.getAwaitingReviewTasks();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    select: normalizeTaskListResponse,
    enabled,
    staleTime: 1000 * 60 * 3,
  });
}
