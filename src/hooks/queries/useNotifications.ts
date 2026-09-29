import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService, NotificationItem } from '@/services/notificationService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Danh sách thông báo của người dùng hiện tại.
 * `select` tùy chọn để lọc theo tab mà không phải fetch lại.
 */
export function useNotificationsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => {
      const res = await notificationService.getNotifications();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
    enabled: options?.enabled ?? true,
  });
}

/** Số thông báo chưa đọc — dùng cho badge trên BottomNavBar. */
export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const res = await notificationService.getNotifications();
      if (res.error) throw new Error(res.error);
      return (res.data || []).filter((item) => !item.isRead).length;
    },
    enabled,
  });
}

/** Đánh dấu 1 thông báo đã đọc (optimistic update). */
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await notificationService.markAsRead(id);
      if (!res.success) throw new Error(res.error || 'Không thể đánh dấu đã đọc');
      return id;
    },
    onMutate: async (id) => {
      const listKey = queryKeys.notifications.list();
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<NotificationItem[]>(listKey);
      if (previous) {
        queryClient.setQueryData<NotificationItem[]>(
          listKey,
          previous.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
        );
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/** Đánh dấu đã đọc tất cả (vòng lặp song song vì backend không có mark-all). */
export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await notificationService.markAllAsRead(ids);
      if (!res.success) throw new Error(res.error || 'Không thể đánh dấu đã đọc tất cả');
      return ids.length;
    },
    onMutate: async (ids) => {
      const listKey = queryKeys.notifications.list();
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<NotificationItem[]>(listKey);
      if (previous) {
        queryClient.setQueryData<NotificationItem[]>(
          listKey,
          previous.map((item) => (ids.includes(item.id) ? { ...item, isRead: true } : item)),
        );
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
