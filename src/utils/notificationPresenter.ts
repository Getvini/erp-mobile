/**
 * Trình bày & điều hướng thông báo (Notification presenter + deep-link).
 * Mirror logic `erp-UI/src/hooks/useSSE.js` (toast + navigate) và phân loại tab của Mobile.
 */
import type { NotificationItem } from '@/services/notificationService';

export type NotificationCategory = 'WORK' | 'FINANCE' | 'NEWS';

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  WORK: 'Công việc',
  FINANCE: 'Tài chính',
  NEWS: 'Bảng tin',
};

export const NOTIFICATION_CATEGORY_ORDER: NotificationCategory[] = ['WORK', 'FINANCE', 'NEWS'];

/** Độ dài tối đa phần nội dung khi hiển thị toast/push — mirror useSSE.js:135. */
export const NOTIFICATION_PREVIEW_MAX_LENGTH = 100;

/** Tiền tố type nghiệp vụ tài chính. */
const FINANCE_TYPE_PREFIXES = [
  'PAYMENT_REQUEST',
  'PAYMENT_MILESTONE',
  'DEBT',
  'INVOICE',
  'FINANCE',
];

/** Tiền tố type nghiệp vụ công việc. */
const WORK_TYPE_PREFIXES = [
  'TASK',
  'PROJECT',
  'ACCEPTANCE',
  'CONTRACT',
  'QUOTATION',
  'OPPORTUNITY',
  'CUSTOMER',
  'STAFFING',
  'PAUSE',
  'CLOSE',
];

/**
 * Phân loại thông báo vào 3 tab: Công việc / Tài chính / Bảng tin.
 * Ưu tiên `type`; nếu không khớp thì dùng `relatedEntityType`; cuối cùng mặc định NEWS.
 */
export const getNotificationCategory = (
  type?: string,
  relatedEntityType?: string,
): NotificationCategory => {
  const normalizedType = (type || '').toUpperCase();
  if (FINANCE_TYPE_PREFIXES.some((prefix) => normalizedType.startsWith(prefix))) {
    return 'FINANCE';
  }
  if (WORK_TYPE_PREFIXES.some((prefix) => normalizedType.startsWith(prefix))) {
    return 'WORK';
  }

  const normalizedEntity = (relatedEntityType || '').toUpperCase();
  if (['PAYMENTREQUEST', 'PAYMENTMILESTONE', 'DEBT', 'INVOICE', 'FINANCEDOCUMENT'].includes(normalizedEntity)) {
    return 'FINANCE';
  }
  if (
    ['TASK', 'PROJECT', 'ACCEPTANCEREQUEST', 'CONTRACT', 'CONTRACTADDENDUM', 'QUOTATION', 'OPPORTUNITY', 'CUSTOMER'].includes(
      normalizedEntity,
    )
  ) {
    return 'WORK';
  }
  if (normalizedEntity === 'ANNOUNCEMENT') return 'NEWS';

  return 'NEWS';
};

export const getNotificationCategoryIcon = (
  category: NotificationCategory,
): { name: string; color: string; bg: string } => {
  switch (category) {
    case 'WORK':
      return { name: 'check-square', color: '#3B82F6', bg: 'bg-blue-50' };
    case 'FINANCE':
      return { name: 'dollar-sign', color: '#F59E0B', bg: 'bg-amber-50' };
    default:
      return { name: 'bell', color: '#64748B', bg: 'bg-slate-100' };
  }
};

/**
 * Các tiền tố route nội bộ Mobile chấp nhận cho deep-link từ `notification.link`.
 * Link của Web dùng cùng cấu trúc `/tasks/:id`, `/contracts/:id`, ...
 */
export const INTERNAL_ROUTE_PREFIXES = [
  '/tasks',
  '/projects',
  '/contracts',
  '/customers',
  '/opportunities',
  '/payment-requests',
  '/acceptances',
  '/finance',
  '/notifications',
  '/profile',
  '/settings',
];

/** Chỉ chấp nhận deep-link nội bộ dạng đường dẫn tuyệt đối. */
export const isInternalNotificationLink = (link?: string): boolean => {
  if (!link) return false;
  if (!link.startsWith('/')) return false;
  if (link.startsWith('//')) return false;
  return INTERNAL_ROUTE_PREFIXES.some(
    (prefix) => link === prefix || link.startsWith(`${prefix}/`) || link.startsWith(`${prefix}?`),
  );
};

/**
 * Suy ra deep-link từ loại thông báo khi backend không trả `link`.
 */
export const getFallbackDeepLink = (notification: {
  type?: string;
  relatedEntityType?: string;
  targetId?: string;
}): string | null => {
  const entity = (notification.relatedEntityType || '').toUpperCase();
  const type = (notification.type || '').toUpperCase();
  const id = notification.targetId;

  if (entity === 'TASK' || type.startsWith('TASK_')) {
    return id ? `/tasks/${id}` : '/tasks';
  }
  if (entity === 'PROJECT' || type.startsWith('PROJECT_')) {
    return id ? `/projects/${id}` : '/projects';
  }
  if (entity === 'CONTRACTADDENDUM' || type.startsWith('CONTRACT_ADDENDUM_')) {
    return id ? `/contracts/${id}` : '/contracts';
  }
  if (entity === 'CONTRACT' || type.startsWith('CONTRACT_')) {
    return id ? `/contracts/${id}` : '/contracts';
  }
  if (entity === 'ACCEPTANCEREQUEST' || type.startsWith('ACCEPTANCE_')) {
    return '/acceptances';
  }
  if (entity === 'CUSTOMER' || type.startsWith('CUSTOMER_')) {
    return id ? `/customers/${id}` : '/customers';
  }
  if (entity === 'OPPORTUNITY' || type.startsWith('OPPORTUNITY_')) {
    return id ? `/opportunities/${id}` : '/opportunities';
  }
  if (type.startsWith('PAYMENT_REQUEST') || entity === 'PAYMENTREQUEST') {
    return id ? `/payment-requests/${id}` : '/payment-requests';
  }
  if (FINANCE_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    return '/finance';
  }
  return null;
};

/**
 * Deep-link cuối cùng cho một thông báo: ưu tiên `link` nội bộ của backend,
 * nếu không có/không hợp lệ thì suy ra từ loại + targetId.
 */
export const resolveNotificationDeepLink = (notification: {
  link?: string;
  type?: string;
  relatedEntityType?: string;
  targetId?: string;
}): string | null => {
  if (isInternalNotificationLink(notification.link)) {
    // Bỏ query string để Expo Router push an toàn.
    return (notification.link as string).split('?')[0];
  }
  return getFallbackDeepLink(notification);
};

/** Nội dung rút gọn cho toast/push — mirror useSSE.js:134-139. */
export const getNotificationPreview = (
  content?: string,
  maxLength = NOTIFICATION_PREVIEW_MAX_LENGTH,
): string => {
  const firstLine = (content || '').split('\n')[0];
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength)}...`;
};

/** Thông điệp toast/push hoàn chỉnh: `{title}: {preview}`. */
export const getNotificationToastMessage = (notification: {
  title?: string;
  message?: string;
}): string => {
  const title = notification.title || 'Thông báo mới';
  const preview = getNotificationPreview(notification.message);
  return preview ? `${title}: ${preview}` : title;
};

export interface NotificationGroupCount {
  category: NotificationCategory;
  total: number;
  unread: number;
}

/** Thống kê số lượng & chưa đọc theo từng tab. */
export const countNotificationsByCategory = (
  notifications: Pick<NotificationItem, 'type' | 'relatedEntityType' | 'isRead'>[],
): NotificationGroupCount[] =>
  NOTIFICATION_CATEGORY_ORDER.map((category) => {
    const items = notifications.filter(
      (item) => getNotificationCategory(item.type, item.relatedEntityType) === category,
    );
    return {
      category,
      total: items.length,
      unread: items.filter((item) => !item.isRead).length,
    };
  });

/** Lọc theo tab; tab 'all' trả về toàn bộ. */
export const filterNotifications = <T extends Pick<NotificationItem, 'type' | 'relatedEntityType'>>(
  notifications: T[],
  filter: 'all' | NotificationCategory,
): T[] => {
  if (filter === 'all') return notifications;
  return notifications.filter(
    (item) => getNotificationCategory(item.type, item.relatedEntityType) === filter,
  );
};
