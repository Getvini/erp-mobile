export const MODULE_EVENTS = {
  // QUOTATION
  QUOTATION_CREATED: 'quotation_created',
  QUOTATION_UPDATED: 'quotation_updated',
  QUOTATION_APPROVED: 'quotation_approved',
  QUOTATION_REJECTED: 'quotation_rejected',
  QUOTATION_DELETED: 'quotation_deleted',

  // OPPORTUNITY
  OPPORTUNITY_CREATED: 'opportunity_created',
  OPPORTUNITY_UPDATED: 'opportunity_updated',
  OPPORTUNITY_APPROVED: 'opportunity_approved',
  OPPORTUNITY_REJECTED: 'opportunity_rejected',
  OPPORTUNITY_DELETED: 'opportunity_deleted',

  // TASK
  TASK_CREATED: 'task_created',
  TASK_UPDATED: 'task_updated',
  TASK_STATUS_CHANGED: 'task_status_changed',
  TASK_DELETED: 'task_deleted',

  // TASK REVIEW & RESULT CHECK
  TASK_REVIEW_UPDATED: 'task_review_updated',
  TASK_RESULT_CHECK_UPDATED: 'task_result_check_updated',

  // CONTRACT
  CONTRACT_CREATED: 'contract_created',
  CONTRACT_UPDATED: 'contract_updated',
  CONTRACT_SIGNED: 'contract_signed',
  CONTRACT_REJECTED: 'contract_rejected',
  CONTRACT_DELETED: 'contract_deleted',

  // CONTRACT ADDENDUM
  CONTRACT_ADDENDUM_CREATED: 'contract_addendum_created',
  CONTRACT_ADDENDUM_UPDATED: 'contract_addendum_updated',
  CONTRACT_ADDENDUM_SIGNED: 'contract_addendum_signed',
  CONTRACT_ADDENDUM_REJECTED: 'contract_addendum_rejected',
  CONTRACT_ADDENDUM_APPROVED: 'contract_addendum_approved',

  // PROJECT
  PROJECT_CREATED: 'project_created',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_DELETED: 'project_deleted',

  // CUSTOMER
  CUSTOMER_CREATED: 'customer_created',
  CUSTOMER_UPDATED: 'customer_updated',
  CUSTOMER_DELETED: 'customer_deleted',

  // USER
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',

  // TEAM
  TEAM_CREATED: 'team_created',
  TEAM_UPDATED: 'team_updated',
  TEAM_DELETED: 'team_deleted',
  TEAM_MEMBER_ADDED: 'team_member_added',
  TEAM_MEMBER_UPDATED: 'team_member_updated',
  TEAM_MEMBER_REMOVED: 'team_member_removed',

  // ACCEPTANCE
  ACCEPTANCE_CREATED: 'acceptance_created',
  ACCEPTANCE_APPROVED: 'acceptance_approved',
  ACCEPTANCE_REJECTED: 'acceptance_rejected',
  ACCEPTANCE_PROCESSED: 'acceptance_processed',
} as const;

export type ModuleEventName = typeof MODULE_EVENTS[keyof typeof MODULE_EVENTS];

/**
 * Maps each Module Event to its Invalidation Tags.
 * Mirror 1:1 `erp-UI/src/hooks/useSSE.js:44-89` (delta Web 28-09-2026).
 */
export const EVENT_TO_TAGS_MAP: Record<string, string[]> = {
  [MODULE_EVENTS.OPPORTUNITY_CREATED]: ['Opportunities'],
  [MODULE_EVENTS.OPPORTUNITY_UPDATED]: ['Opportunities'],
  [MODULE_EVENTS.OPPORTUNITY_APPROVED]: ['Opportunities'],
  [MODULE_EVENTS.OPPORTUNITY_REJECTED]: ['Opportunities'],
  [MODULE_EVENTS.OPPORTUNITY_DELETED]: ['Opportunities'],

  [MODULE_EVENTS.QUOTATION_CREATED]: ['Quotations', 'Opportunities'],
  [MODULE_EVENTS.QUOTATION_UPDATED]: ['Quotations', 'Opportunities'],
  [MODULE_EVENTS.QUOTATION_APPROVED]: ['Quotations', 'Opportunities', 'Contracts'],
  [MODULE_EVENTS.QUOTATION_REJECTED]: ['Quotations', 'Opportunities'],
  [MODULE_EVENTS.QUOTATION_DELETED]: ['Quotations', 'Opportunities'],

  [MODULE_EVENTS.TASK_CREATED]: ['Tasks', 'Projects'],
  [MODULE_EVENTS.TASK_UPDATED]: ['Tasks', 'Projects'],
  [MODULE_EVENTS.TASK_STATUS_CHANGED]: ['Tasks', 'Projects', 'TaskReviews', 'Opportunities'],
  [MODULE_EVENTS.TASK_DELETED]: ['Tasks', 'Projects'],

  [MODULE_EVENTS.CONTRACT_CREATED]: ['Contracts', 'Opportunities'],
  [MODULE_EVENTS.CONTRACT_UPDATED]: ['Contracts'],
  [MODULE_EVENTS.CONTRACT_SIGNED]: ['Contracts', 'PaymentMilestones', 'Debts'],
  [MODULE_EVENTS.CONTRACT_REJECTED]: ['Contracts', 'Opportunities'],
  [MODULE_EVENTS.CONTRACT_DELETED]: ['Contracts'],

  [MODULE_EVENTS.CONTRACT_ADDENDUM_CREATED]: ['ContractAddendums', 'Contracts', 'Projects', 'Tasks'],
  [MODULE_EVENTS.CONTRACT_ADDENDUM_UPDATED]: ['ContractAddendums', 'Contracts', 'Projects', 'Tasks'],
  [MODULE_EVENTS.CONTRACT_ADDENDUM_SIGNED]: ['ContractAddendums', 'Contracts', 'Projects', 'Tasks'],
  [MODULE_EVENTS.CONTRACT_ADDENDUM_REJECTED]: ['ContractAddendums', 'Contracts', 'Projects', 'Tasks'],
  [MODULE_EVENTS.CONTRACT_ADDENDUM_APPROVED]: ['ContractAddendums', 'Contracts', 'Projects', 'Tasks'],

  [MODULE_EVENTS.PROJECT_CREATED]: ['Projects', 'Contracts'],
  [MODULE_EVENTS.PROJECT_UPDATED]: ['Projects', 'Tasks', 'PauseHistory', 'Debts'],
  [MODULE_EVENTS.PROJECT_DELETED]: ['Projects'],

  [MODULE_EVENTS.CUSTOMER_CREATED]: ['Customers'],
  [MODULE_EVENTS.CUSTOMER_UPDATED]: ['Customers', 'Opportunities'],
  [MODULE_EVENTS.CUSTOMER_DELETED]: ['Customers'],

  [MODULE_EVENTS.USER_CREATED]: ['Users'],
  [MODULE_EVENTS.USER_UPDATED]: ['Users', 'Teams', 'Projects', 'Tasks'],
  [MODULE_EVENTS.USER_DELETED]: ['Users', 'Teams', 'Projects', 'Tasks'],

  [MODULE_EVENTS.TEAM_CREATED]: ['Teams'],
  [MODULE_EVENTS.TEAM_UPDATED]: ['Teams', 'Projects', 'Tasks'],
  [MODULE_EVENTS.TEAM_DELETED]: ['Teams', 'Projects', 'Tasks'],
  [MODULE_EVENTS.TEAM_MEMBER_ADDED]: ['Teams', 'Projects', 'Tasks'],
  [MODULE_EVENTS.TEAM_MEMBER_UPDATED]: ['Teams', 'Projects', 'Tasks'],
  [MODULE_EVENTS.TEAM_MEMBER_REMOVED]: ['Teams', 'Projects', 'Tasks'],

  [MODULE_EVENTS.ACCEPTANCE_CREATED]: ['Acceptance', 'Services', 'Projects', 'Tasks', 'Contracts'],
  [MODULE_EVENTS.ACCEPTANCE_APPROVED]: ['Acceptance', 'Services', 'Projects', 'Tasks', 'Contracts'],
  [MODULE_EVENTS.ACCEPTANCE_REJECTED]: ['Acceptance', 'Services', 'Projects', 'Tasks', 'Contracts'],
  [MODULE_EVENTS.ACCEPTANCE_PROCESSED]: ['Acceptance', 'Services', 'Projects', 'Tasks', 'Contracts'],

  [MODULE_EVENTS.TASK_REVIEW_UPDATED]: ['TaskReviews', 'Tasks'],
  [MODULE_EVENTS.TASK_RESULT_CHECK_UPDATED]: ['TaskResultChecks'],
};

/**
 * Tiền tố sự kiện ⇒ loại entity dùng cho invalidation theo `id` (mirror useSSE.js:95-116).
 * `team_member_` xử lý riêng vì invalidate theo `teamId` chứ không theo `id`.
 */
export const EVENT_ID_TAG_MAP: { prefix: string; tag: string }[] = [
  { prefix: 'project_', tag: 'Projects' },
  { prefix: 'task_', tag: 'Tasks' },
  { prefix: 'contract_addendum_', tag: 'ContractAddendums' },
  { prefix: 'contract_', tag: 'Contracts' },
  { prefix: 'customer_', tag: 'Customers' },
  { prefix: 'user_', tag: 'Users' },
  { prefix: 'team_', tag: 'Teams' },
  { prefix: 'acceptance_', tag: 'Acceptance' },
];

/**
 * Sự kiện cần invalidate thêm theo `id` của entity (đặt sau các prefix cụ thể hơn).
 * `contract_addendum_` phải đứng TRƯỚC `contract_` để không bị khớp nhầm.
 */
export const getEntityTagForEvent = (eventName?: string): string | null => {
  if (!eventName) return null;
  if (eventName.startsWith('team_member_')) return null;
  const match = EVENT_ID_TAG_MAP.find((entry) => eventName.startsWith(entry.prefix));
  return match ? match.tag : null;
};

/** `team_member_*` invalidate theo `teamId` (payload.data.teamId hoặc payload.data.team.id). */
export const isTeamMemberEvent = (eventName?: string): boolean =>
  Boolean(eventName?.startsWith('team_member_'));

/** Sự kiện vòng đời dự án cần làm mới cả PauseHistory. */
export const isProjectLifecycleEvent = (eventName?: string): boolean =>
  Boolean(eventName?.startsWith('project_'));

/** Thông báo nghiệp vụ liên quan vòng đời dự án (pause/close) — mirror useSSE.js:167-182. */
export const isProjectLifecycleNotification = (notificationType?: string): boolean => {
  if (!notificationType) return false;
  return (
    notificationType.startsWith('PROJECT_') ||
    notificationType.includes('PAUSE') ||
    notificationType.includes('CLOSE')
  );
};

/** Thông báo yêu cầu thanh toán cần làm mới danh sách + tổng nợ — mirror useSSE.js:158-165. */
export const isPaymentRequestNotification = (notificationType?: string): boolean =>
  Boolean(notificationType?.startsWith('PAYMENT_REQUEST'));
