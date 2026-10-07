import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { sseEventBus } from '@/services/sseEventBus';
import { queryKeys } from '@/services/queryKeys';
import { isPaymentRequestNotification, isProjectLifecycleNotification } from '@/constants/events';

/**
 * Ánh xạ tag SSE (giống RTK Query `providesTags` của Web) sang query key gốc của TanStack Query.
 * Dùng hàm thay vì object để tránh truy cập `queryKeys` ngoài scope module.
 */
export const getQueryKeyForSseTag = (tag: string): readonly unknown[] | null => {
  switch (tag) {
    case 'Opportunities':
      return queryKeys.opportunities.all;
    case 'Quotations':
      return queryKeys.quotations.all;
    case 'Customers':
      return queryKeys.customers.all;
    case 'Contracts':
      return queryKeys.contracts.all;
    case 'ContractAddendums':
      // Backend không có GET /contract-addendums ⇒ phụ lục nằm trong chi tiết hợp đồng.
      return queryKeys.contracts.all;
    case 'Projects':
      return queryKeys.projects.all;
    case 'PauseHistory':
      // Lịch sử tạm dừng là query con của project detail.
      return queryKeys.projects.all;
    case 'Tasks':
      return queryKeys.tasks.all;
    case 'TaskReviews':
      return queryKeys.tasks.all;
    case 'TaskResultChecks':
      return queryKeys.taskResultChecks.all;
    case 'Acceptance':
      return queryKeys.acceptances.all;
    case 'Services':
      // Dịch vụ hợp đồng hiển thị trong chi tiết hợp đồng & dự án.
      return queryKeys.contracts.all;
    case 'PaymentMilestones':
      return queryKeys.paymentMilestones.all;
    case 'Debts':
      return queryKeys.debts.all;
    case 'PaymentRequests':
      return queryKeys.paymentRequests.all;
    case 'Notifications':
      return queryKeys.notifications.all;
    case 'Vendors':
      return queryKeys.vendors.all;
    case 'Teams':
    case 'Users':
      // Module Nhân sự / Đội nhóm thuộc Phase P3 — dữ liệu team hiện nằm trong project detail.
      return queryKeys.projects.all;
    default:
      return null;
  }
};

/** Invalidate cache cho một tag SSE. Trả về true nếu tag được xử lý. */
export const invalidateSseTag = (queryClient: QueryClient, tag: string): boolean => {
  const key = getQueryKeyForSseTag(tag);
  if (!key) return false;
  queryClient.invalidateQueries({ queryKey: key });
  return true;
};

/**
 * Hook to bridge SSE EventBus with TanStack Query Cache.
 * Khi SSE realtime đẩy sự kiện về, tự động invalidate cache tương ứng.
 */
export function useSSEQueryBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Buffer debounce để gom nhiều SSE invalidation liên tiếp trong 300ms
    const pendingTags = new Set<string>();
    let tagDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const flushTags = () => {
      if (pendingTags.size === 0) return;
      pendingTags.forEach((tag) => {
        invalidateSseTag(queryClient, tag);
      });
      pendingTags.clear();
    };

    const scheduleInvalidateTag = (tag: string) => {
      pendingTags.add(tag);
      if (tagDebounceTimer) clearTimeout(tagDebounceTimer);
      tagDebounceTimer = setTimeout(flushTags, 300);
    };

    // Danh sách tag cần lắng nghe — hợp nhất EVENT_TO_TAGS_MAP (đã bao trùm P1).
    const bridgeTags = [
      'Opportunities',
      'Quotations',
      'Customers',
      'Contracts',
      'ContractAddendums',
      'Projects',
      'PauseHistory',
      'Tasks',
      'TaskReviews',
      'TaskResultChecks',
      'Acceptance',
      'Services',
      'PaymentMilestones',
      'Debts',
      'Notifications',
      'Users',
      'Teams',
    ];

    const unsubscribers = bridgeTags.map((tag) =>
      sseEventBus.on(`invalidate_${tag}`, () => {
        scheduleInvalidateTag(tag);
      }),
    );

    // Thông báo nghiệp vụ (không phải module event) — mirror erp-UI useSSE.js:150-182
    let notificationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubNotification = sseEventBus.on('notification', (payload: any) => {
      if (notificationDebounceTimer) clearTimeout(notificationDebounceTimer);
      notificationDebounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

        if (payload?.type === 'TASK_COMPLETED') {
          queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
        }

        if (isPaymentRequestNotification(payload?.type)) {
          queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.all });
        }

        if (isProjectLifecycleNotification(payload?.type)) {
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
        }
      }, 300);
    });

    return () => {
      if (tagDebounceTimer) clearTimeout(tagDebounceTimer);
      if (notificationDebounceTimer) clearTimeout(notificationDebounceTimer);
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
      if (typeof unsubNotification === 'function') unsubNotification();
    };
  }, [queryClient]);
}
