/**
 * Logic thuần cho TẠM DỪNG / LÀM TIẾP / ĐÓNG DỰ ÁN.
 * Mirror 1:1 `erp-UI/src/utils/projectPause.js` + `ERP/src/modules/project/services/ProjectPause.helper.ts`.
 */

/** Dự án tạm dừng tối đa 37 ngày trước khi hệ thống tự đóng. */
export const PAUSE_DURATION_DAYS = 37;
/** Cửa sổ nhắc nhở trước khi tự đóng. */
export const REMINDER_WINDOW_DAYS = 7;
/** Lý do hệ thống ghi nhận khi tự đóng dự án. */
export const FORCE_CLOSE_REASON = 'Tự động đóng sau 37 ngày tạm dừng';

/** Task được miễn chuyển sang ON_HOLD khi dự án tạm dừng. */
export const HOLD_EXEMPT_TASK_STATUSES = ['COMPLETED', 'INTERNAL_COMPLETED', 'ACCEPTED'];

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang thực hiện',
  PENDING_PAUSE_APPROVAL: 'Chờ duyệt tạm dừng',
  ON_HOLD: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const PAUSE_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  RESUMED: 'Đã làm tiếp',
  CLOSED: 'Đã đóng dự án',
};

export const PAUSE_MODE_LABELS: Record<string, string> = {
  REQUEST: 'Xin phép duyệt',
  DIRECT: 'Quyết định trực tiếp',
};

export const CLOSE_MODE_LABELS: Record<string, string> = {
  REQUEST: 'PM đề nghị, BOD duyệt',
  DIRECT: 'Đóng trực tiếp',
};

export const PROJECT_MANAGEMENT_ROLES = ['ADMIN', 'BOD', 'PM'];

export interface ProjectPauseRequest {
  id: string;
  status?: string;
  pauseMode?: string;
  closeMode?: string;
  reason?: string;
  feedback?: string;
  requesterRole?: string;
  requester?: { id: string; fullName?: string };
  approver?: { id: string; fullName?: string };
  closedBy?: { id: string; fullName?: string };
  closedByType?: string;
  requestedAt?: string;
  createdAt?: string;
  approvedAt?: string;
  resumedAt?: string;
  resumeReason?: string;
  autoAcceptAt?: string;
  acceptedTaskCount?: number;
  cancelledTaskCount?: number;
  [key: string]: any;
}

export const isManagement = (role?: string): boolean =>
  role === 'BOD' || role === 'ADMIN';

export interface ProjectPermissionContext {
  role?: string;
  /** Người dùng hiện tại là team lead của dự án. */
  isTeamLead?: boolean;
  /** Người dùng hiện tại có member role PROJECT_MANAGER. */
  isProjectManagerMember?: boolean;
  /** Người dùng hiện tại là người tạo hợp đồng / cơ hội / khách hàng (BD owner). */
  isBdOwner?: boolean;
}

export const isProjectPm = (ctx: ProjectPermissionContext): boolean =>
  Boolean(ctx.isTeamLead || ctx.isProjectManagerMember);

/** Xin tạm dừng: IN_PROGRESS && (BOD/ADMIN | PM của dự án | BD sở hữu). */
export const canRequestPause = (
  status: string | undefined,
  ctx: ProjectPermissionContext,
): boolean => {
  if (status !== 'IN_PROGRESS') return false;
  if (isManagement(ctx.role)) return true;
  if (ctx.role === 'PM' && isProjectPm(ctx)) return true;
  if (ctx.role === 'BD' && ctx.isBdOwner) return true;
  return false;
};

/** Tạm dừng ngay: IN_PROGRESS && BOD/ADMIN. */
export const canPauseDirect = (
  status: string | undefined,
  ctx: ProjectPermissionContext,
): boolean => status === 'IN_PROGRESS' && isManagement(ctx.role);

/** Duyệt / từ chối yêu cầu tạm dừng: BOD/ADMIN. */
export const canApprovePause = (ctx: ProjectPermissionContext): boolean =>
  isManagement(ctx.role);

/** Duyệt / từ chối yêu cầu đóng: BOD/ADMIN/ADMIN_SALE. */
export const canApproveClose = (ctx: ProjectPermissionContext): boolean =>
  ['BOD', 'ADMIN', 'ADMIN_SALE'].includes(ctx.role || '');

/** Làm tiếp: ON_HOLD && (BOD/ADMIN | PM dự án | BD sở hữu). */
export const canResume = (
  status: string | undefined,
  ctx: ProjectPermissionContext,
): boolean => {
  if (status !== 'ON_HOLD') return false;
  if (isManagement(ctx.role)) return true;
  if (ctx.role === 'PM' && isProjectPm(ctx)) return true;
  if (ctx.role === 'BD' && ctx.isBdOwner) return true;
  return false;
};

/** Đóng ngay: ON_HOLD && (BOD/ADMIN | BD sở hữu). */
export const canCloseDirect = (
  status: string | undefined,
  ctx: ProjectPermissionContext,
): boolean => {
  if (status !== 'ON_HOLD') return false;
  if (isManagement(ctx.role)) return true;
  return ctx.role === 'BD' && Boolean(ctx.isBdOwner);
};

/** Yêu cầu đóng dự án: ON_HOLD && (BOD/ADMIN | PM dự án). */
export const canRequestClose = (
  status: string | undefined,
  ctx: ProjectPermissionContext,
): boolean => {
  if (status !== 'ON_HOLD') return false;
  if (isManagement(ctx.role)) return true;
  return ctx.role === 'PM' && isProjectPm(ctx);
};

/** Số ngày còn lại trước khi hệ thống tự đóng dự án (null nếu không trong trạng thái hold). */
export const getDaysUntilAutoClose = (
  status?: string,
  autoAcceptAt?: string,
  now: Date = new Date(),
): number | null => {
  if (status !== 'ON_HOLD' || !autoAcceptAt) return null;
  const target = new Date(autoAcceptAt).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - now.getTime()) / 86400000));
};

/** Đang trong cửa sổ nhắc nhở 7 ngày trước khi tự đóng. */
export const isInReminderWindow = (
  status?: string,
  autoAcceptAt?: string,
  now: Date = new Date(),
): boolean => {
  const daysLeft = getDaysUntilAutoClose(status, autoAcceptAt, now);
  return daysLeft !== null && daysLeft <= REMINDER_WINDOW_DAYS;
};

/** Tab "Lịch sử tạm dừng" chỉ hiện khi dự án từng/đang liên quan tới tạm dừng hoặc user là quản lý. */
export const shouldShowPauseTab = (params: {
  status?: string;
  pausedAt?: string;
  role?: string;
}): boolean => {
  if (params.status === 'ON_HOLD' || params.status === 'PENDING_PAUSE_APPROVAL') return true;
  if (params.pausedAt) return true;
  return isManagement(params.role) || params.role === 'PM';
};

/** Nhãn lịch sử: hệ thống tự đóng được ghi nhận riêng. */
export const getPauseHistoryActorLabel = (request: ProjectPauseRequest): string => {
  if (request.closedByType === 'SYSTEM') return 'Hệ thống tự đóng (D+37)';
  return request.closedBy?.fullName || request.approver?.fullName || '—';
};
