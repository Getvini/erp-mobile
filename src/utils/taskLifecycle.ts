/**
 * Vòng đời công việc (Tasks) — nhãn trạng thái + điều kiện hành động + tiện ích lịch.
 * Mirror Web erp-UI/src/utils/enums.js:147-164 và TaskAssignModal.jsx:59-91.
 */
import { formatDateToYYYYMMDD } from '@/utils/formatters';

/** Nhãn tiếng Việt của toàn bộ trạng thái công việc (mirror erp-UI enums.js) */
export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ phân công',
  NOT_STARTED: 'Chưa thực hiện',
  DOING: 'Đang thực hiện',
  CANCELLED: 'Đã hủy',
  AWAITING_PRICING: 'Chờ định giá',
  REJECTED: 'Yêu cầu làm lại',
  AWAITING_ACCEPTANCE: 'Đang chờ nghiệm thu',
  AWAITING_REVIEW: 'Đang chờ duyệt',
  OVERDUE: 'Quá hạn',
  AWAITING_SUPPORT: 'Đã nhờ hỗ trợ',
  SUPPORT_PENDING: 'Chờ xác nhận hỗ trợ',
  COMPLETED: 'Hoàn thành',
  REWORKING: 'Đang làm lại',
  INTERNAL_COMPLETED: 'Hoàn thành nội bộ',
  ACCEPTED: 'Đã được nghiệm thu',
  SUPPORT_AWAITING_RETURN: 'Chờ xác nhận hoàn thành',
  REJECTED_BILLABLE: 'Yêu cầu làm lại (có phí)',
  REJECTED_SUPPORT: 'Yêu cầu làm lại (hỗ trợ)',
  ON_HOLD: 'Tạm dừng',
};

/** Trạng thái cho phép bấm "Bắt đầu" */
export const STARTABLE: string[] = ['NOT_STARTED'];

/**
 * Các trạng thái "yêu cầu làm lại" — người làm được nộp lại kết quả.
 * - REJECTED / REWORKING: duyệt nội bộ không đạt / đang làm lại
 * - REJECTED_BILLABLE / REJECTED_SUPPORT: Account đã duyệt nhưng khách chưa duyệt
 *   → yêu cầu làm lại (có phí / hỗ trợ)
 */
export const REWORK_STATUSES: string[] = [
  'REJECTED',
  'REJECTED_BILLABLE',
  'REJECTED_SUPPORT',
  'REWORKING',
];

/** Trạng thái cho phép gửi kết quả để duyệt */
export const SUBMITTABLE: string[] = ['DOING', ...REWORK_STATUSES, 'OVERDUE'];

/** Trạng thái cho phép yêu cầu làm lại (dành cho người duyệt) */
export const REWORKABLE: string[] = ['AWAITING_REVIEW', 'INTERNAL_COMPLETED', 'COMPLETED'];

/** Trạng thái subtask được coi là đã xong */
export const SUBTASK_DONE_STATUSES: string[] = ['INTERNAL_COMPLETED', 'COMPLETED', 'ACCEPTED'];

/** Có thể bắt đầu task khi ở trạng thái cho phép VÀ người dùng là assignee */
export const canStartTask = (status: string, isAssignee: boolean = false): boolean =>
  STARTABLE.includes(String(status || '')) && Boolean(isAssignee);

/** Có thể gửi kết quả để duyệt */
export const canSubmitResult = (status: string): boolean =>
  SUBMITTABLE.includes(String(status || ''));

/** Có thể yêu cầu làm lại */
export const canRework = (status: string): boolean => REWORKABLE.includes(String(status || ''));

/** Subtask tối thiểu cần cho việc chặn task cha */
export interface SubtaskLike {
  id?: string;
  code?: string;
  name?: string;
  status?: string;
}

/** Task cha tối thiểu cần cho việc kiểm tra chặn bởi subtask */
export interface ParentTaskLike {
  parentTaskId?: string | null;
  subtasks?: SubtaskLike[] | null;
}

/** Các subtask CHƯA hoàn tất (đang chặn task cha) */
export const getBlockingSubtasks = <T extends { status?: string }>(
  subtasks?: T[] | null
): T[] => (subtasks || []).filter((subtask) => !SUBTASK_DONE_STATUSES.includes(String(subtask.status || '')));

/**
 * Task chính bị chặn khi còn subtask chưa hoàn tất.
 * Chỉ áp dụng cho task cha (không có `parentTaskId`).
 */
export const isParentBlockedBySubtasks = (task?: ParentTaskLike | null): boolean => {
  if (!task || task.parentTaskId) return false;
  return getBlockingSubtasks(task.subtasks).length > 0;
};

/** Thông báo chặn: "Không thể {action} task chính khi còn N subtask chưa hoàn tất: {codes}" */
export const getSubtaskBlockMessage = (action: string, subtasks?: SubtaskLike[] | null): string => {
  const blocking = getBlockingSubtasks(subtasks);
  const codes = blocking
    .map((subtask) => subtask.code || subtask.name || subtask.id || '')
    .filter(Boolean)
    .join(', ');
  return `Không thể ${action} task chính khi còn ${blocking.length} subtask chưa hoàn tất: ${codes}`;
};

export type WorkloadDayTone = 'danger' | 'warning' | 'info' | 'muted';

/** Màu ô lịch tải công việc (mirror TaskAssignModal.jsx:59-66) */
export const getWorkloadDayTone = (percent: number = 0, taskCount: number = 0): WorkloadDayTone => {
  const workloadPercent = Number(percent) || 0;
  const count = Number(taskCount) || 0;
  if (workloadPercent >= 100) return 'danger';
  if (workloadPercent >= 70) return 'warning';
  if (workloadPercent > 0 || count > 0) return 'info';
  return 'muted';
};

/** Khoảng ngày của tháng chứa `date` — YYYY-MM-01 → YYYY-MM-<ngày cuối tháng> */
export const getMonthRange = (date: Date): { startDate: string; endDate: string } => {
  const value = date && !Number.isNaN(date.getTime()) ? date : new Date();
  return {
    startDate: formatDateToYYYYMMDD(new Date(value.getFullYear(), value.getMonth(), 1)),
    endDate: formatDateToYYYYMMDD(new Date(value.getFullYear(), value.getMonth() + 1, 0)),
  };
};

/** Một ô trong lịch tháng (ô trống có `day = null`) */
export interface MonthCell {
  dateKey: string;
  day: number | null;
}

/**
 * Dựng lưới lịch tháng bắt đầu từ Thứ Hai (tuần đủ 7 ô, có padding đầu/cuối).
 * Mirror TaskAssignModal.jsx:68-83 nhưng trả kèm số ngày để render.
 */
export const buildMonthCells = (monthDate: Date): MonthCell[] => {
  const value = monthDate && !Number.isNaN(monthDate.getTime()) ? monthDate : new Date();
  const year = value.getFullYear();
  const month = value.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const cells: MonthCell[] = Array.from({ length: leadingBlanks }, () => ({
    dateKey: '',
    day: null,
  }));

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ dateKey: formatDateToYYYYMMDD(new Date(year, month, day)), day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: '', day: null });
  }
  return cells;
};

/** Giờ deadline mặc định khi gán công việc */
export const DEFAULT_DEADLINE_TIME = '17:30';

/** Ghép ngày (YYYY-MM-DD) với giờ deadline mặc định → "YYYY-MM-DDT17:30" */
export const combineDateWithDefaultTime = (dateKey?: string | null): string =>
  dateKey ? `${dateKey}T${DEFAULT_DEADLINE_TIME}` : '';
