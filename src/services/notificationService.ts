import { apiService } from './api';

export type NotificationType =
  | 'TASK'
  | 'PROJECT'
  | 'CONTRACT'
  | 'ACCEPTANCE'
  | 'FINANCE'
  | 'CUSTOMER'
  | 'OPPORTUNITY'
  | 'SYSTEM';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  /** Loại gốc từ backend (VD `TASK_COMPLETED`) — dùng cho presenter/deep-link. */
  rawType?: string;
  isRead: boolean;
  targetId?: string;
  /** Loại entity liên quan từ backend (VD `TASK`, `ACCEPTANCEREQUEST`). */
  relatedEntityType?: string;
  /** Deep-link do backend trả sẵn (VD `/tasks/abc`). */
  link?: string;
  createdAt: string;
}

interface NotificationApiItem {
  id: string;
  title: string;
  content: string;
  type?: string;
  isRead: boolean;
  link?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  createdAt: string;
}

const getNotificationType = (notification: NotificationApiItem): NotificationType => {
  const entityType = notification.relatedEntityType?.toUpperCase() ?? '';
  const eventType = notification.type?.toUpperCase() ?? '';

  if (entityType === 'TASK' || eventType.startsWith('TASK_')) return 'TASK';
  if (entityType === 'PROJECT' || eventType.startsWith('PROJECT_')) return 'PROJECT';
  if (entityType === 'CONTRACTADDENDUM' || eventType.startsWith('CONTRACT_ADDENDUM_')) {
    return 'CONTRACT';
  }
  if (entityType === 'CONTRACT' || eventType.startsWith('CONTRACT_')) return 'CONTRACT';
  if (entityType === 'ACCEPTANCEREQUEST' || eventType.startsWith('ACCEPTANCE_')) {
    return 'ACCEPTANCE';
  }
  if (entityType === 'CUSTOMER' || eventType.startsWith('CUSTOMER_')) return 'CUSTOMER';
  if (entityType === 'OPPORTUNITY' || eventType.startsWith('OPPORTUNITY_')) return 'OPPORTUNITY';
  if (
    entityType === 'PAYMENTREQUEST' ||
    entityType === 'DEBT' ||
    entityType === 'FINANCEDOCUMENT' ||
    eventType.startsWith('FINANCE_') ||
    eventType.startsWith('PAYMENT_REQUEST') ||
    eventType.startsWith('PAYMENT_MILESTONE') ||
    eventType.startsWith('DEBT')
  ) {
    return 'FINANCE';
  }
  return 'SYSTEM';
};

/** Chuẩn hóa 1 item từ backend → model của Mobile. */
export const mapNotificationApiItem = (notification: NotificationApiItem): NotificationItem => ({
  id: notification.id,
  title: notification.title,
  message: notification.content,
  type: getNotificationType(notification),
  rawType: notification.type,
  isRead: notification.isRead,
  targetId: notification.relatedEntityId,
  relatedEntityType: notification.relatedEntityType,
  link: notification.link,
  createdAt: notification.createdAt,
});

class NotificationService {
  async getNotifications(): Promise<{ data?: NotificationItem[]; error?: string }> {
    const res = await apiService.get<NotificationApiItem[]>('/notifications/me');
    if (res.error) {
      return { error: res.error };
    }

    return { data: (res.data ?? []).map(mapNotificationApiItem) };
  }

  async markAsRead(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiService.put<NotificationApiItem>(`/notifications/${id}/read`, {});
    return { success: !res.error, error: res.error };
  }

  /**
   * Backend chỉ có `PUT /notifications/:id/read` (không có endpoint mark-all),
   * nên đánh dấu đã đọc tất cả bằng vòng lặp song song — giống Web.
   */
  async markAllAsRead(ids: string[]): Promise<{ success: boolean; error?: string }> {
    const results = await Promise.all(ids.map((id) => this.markAsRead(id)));
    const failedResult = results.find((result) => !result.success);
    return failedResult ?? { success: true };
  }
}

export const notificationService = new NotificationService();
