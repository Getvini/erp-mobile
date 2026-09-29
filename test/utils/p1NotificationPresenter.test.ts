import {
  countNotificationsByCategory,
  filterNotifications,
  getNotificationCategory,
  getNotificationPreview,
  getNotificationToastMessage,
  isInternalNotificationLink,
  resolveNotificationDeepLink,
} from '@/utils/notificationPresenter';

describe('P1.13 Notification presenter — phân loại tab', () => {
  it('phân loại theo type nghiệp vụ', () => {
    expect(getNotificationCategory('TASK_COMPLETED')).toBe('WORK');
    expect(getNotificationCategory('PROJECT_PAUSED')).toBe('WORK');
    expect(getNotificationCategory('ACCEPTANCE_CREATED')).toBe('WORK');
    expect(getNotificationCategory('CONTRACT_ADDENDUM_APPROVED')).toBe('WORK');
    expect(getNotificationCategory('PAYMENT_REQUEST_APPROVED')).toBe('FINANCE');
    expect(getNotificationCategory('DEBT_OVERDUE')).toBe('FINANCE');
    expect(getNotificationCategory('PAYMENT_MILESTONE_DUE')).toBe('FINANCE');
    expect(getNotificationCategory('SOMETHING_ELSE')).toBe('NEWS');
  });

  it('phân loại dự phòng theo relatedEntityType', () => {
    expect(getNotificationCategory('', 'ACCEPTANCEREQUEST')).toBe('WORK');
    expect(getNotificationCategory(undefined, 'PAYMENTREQUEST')).toBe('FINANCE');
    expect(getNotificationCategory(undefined, 'ANNOUNCEMENT')).toBe('NEWS');
    expect(getNotificationCategory(undefined, undefined)).toBe('NEWS');
  });

  it('thống kê số lượng & chưa đọc theo từng tab', () => {
    const stats = countNotificationsByCategory([
      { type: 'TASK_COMPLETED', isRead: false },
      { type: 'TASK_CREATED', isRead: true },
      { type: 'PAYMENT_REQUEST_CREATED', isRead: false },
      { type: 'COMPANY_NEWS', isRead: true },
    ] as any);

    expect(stats.find((entry) => entry.category === 'WORK')).toEqual({
      category: 'WORK',
      total: 2,
      unread: 1,
    });
    expect(stats.find((entry) => entry.category === 'FINANCE')).toEqual({
      category: 'FINANCE',
      total: 1,
      unread: 1,
    });
    expect(stats.find((entry) => entry.category === 'NEWS')).toEqual({
      category: 'NEWS',
      total: 1,
      unread: 0,
    });
  });

  it('lọc theo tab', () => {
    const list = [
      { type: 'TASK_COMPLETED' },
      { type: 'PAYMENT_REQUEST_CREATED' },
    ] as any;
    expect(filterNotifications(list, 'all')).toHaveLength(2);
    expect(filterNotifications(list, 'WORK')).toHaveLength(1);
    expect(filterNotifications(list, 'FINANCE')).toHaveLength(1);
    expect(filterNotifications(list, 'NEWS')).toHaveLength(0);
  });
});

describe('P1.13 Deep link điều hướng thông báo', () => {
  it('chỉ chấp nhận link nội bộ hợp lệ', () => {
    expect(isInternalNotificationLink('/tasks/abc')).toBe(true);
    expect(isInternalNotificationLink('/payment-requests?status=PENDING')).toBe(true);
    expect(isInternalNotificationLink('https://evil.example.com')).toBe(false);
    expect(isInternalNotificationLink('//evil.example.com')).toBe(false);
    expect(isInternalNotificationLink('/unknown-route')).toBe(false);
    expect(isInternalNotificationLink(undefined)).toBe(false);
  });

  it('ưu tiên link backend và bỏ query string', () => {
    expect(
      resolveNotificationDeepLink({ link: '/contracts/c-1?tab=addendums', type: 'TASK_UPDATED' }),
    ).toBe('/contracts/c-1');
  });

  it('suy ra deep link khi link không hợp lệ', () => {
    expect(
      resolveNotificationDeepLink({ link: 'https://evil.example.com', type: 'TASK_COMPLETED', targetId: 't-9' }),
    ).toBe('/tasks/t-9');
    expect(
      resolveNotificationDeepLink({ type: 'PROJECT_PAUSED', relatedEntityType: 'PROJECT', targetId: 'p-1' }),
    ).toBe('/projects/p-1');
    expect(resolveNotificationDeepLink({ type: 'ACCEPTANCE_APPROVED' })).toBe('/acceptances');
    expect(
      resolveNotificationDeepLink({ type: 'PAYMENT_REQUEST_APPROVED', targetId: 'pr-3' }),
    ).toBe('/payment-requests/pr-3');
    expect(resolveNotificationDeepLink({ type: 'FINANCE_INVOICE_CREATED' })).toBe('/finance');
    expect(resolveNotificationDeepLink({ type: 'SOMETHING_ELSE' })).toBeNull();
  });

  it('task không có targetId thì về danh sách', () => {
    expect(resolveNotificationDeepLink({ type: 'TASK_COMPLETED' })).toBe('/tasks');
  });
});

describe('P1.13 Nội dung rút gọn cho toast/push', () => {
  it('lấy dòng đầu và cắt tối đa 100 ký tự', () => {
    expect(getNotificationPreview('Dòng 1\nDòng 2')).toBe('Dòng 1');
    const long = 'x'.repeat(150);
    expect(getNotificationPreview(long)).toHaveLength(103);
    expect(getNotificationPreview(long).endsWith('...')).toBe(true);
  });

  it('ghép tiêu đề với nội dung', () => {
    expect(getNotificationToastMessage({ title: 'Task mới', message: 'Nội dung\nphụ' })).toBe(
      'Task mới: Nội dung',
    );
    expect(getNotificationToastMessage({ message: '' })).toBe('Thông báo mới');
  });
});
