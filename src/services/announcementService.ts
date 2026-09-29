import { apiService } from './api';

/**
 * SERVICE — BẢNG TIN CÔNG TY (Announcements) — Phase P3
 *
 * Đối chiếu backend thật: `ERP/src/modules/announcement/`
 *  - GET    /announcements                 → `{ data, total, page, limit, totalPages }`
 *                                            (KHÔNG phải `{ data, meta }`); mỗi item có thêm `isRead`.
 *  - GET    /announcements/:id             → manager (BOD|ADMIN) hoặc người tạo nhận thêm
 *                                            `recipients`, `totalRecipients`, `readCount`,
 *                                            `unreadCount`, `readRate`; non-manager nhận
 *                                            `{ ...announcement, isRead }`, 403 nếu không phải recipient.
 *  - POST   /announcements                 → tạo mới (MANAGE_ROLES = BOD|ADMIN|PM).
 *  - PUT    /announcements/:id             → ⚠️ 400 "Không thể chỉnh sửa thông báo đã gửi" khi `status === 'SENT'`.
 *  - DELETE /announcements/:id             → `SENT` ⇒ set `status = CANCELLED` và trả entity;
 *                                            ngược lại hard delete trả `{ success: true }`.
 *  - PUT    /announcements/:id/read        → ⚠️ có thể trả body rỗng `null` (viewer không phải người nhận,
 *                                            ví dụ người tạo/quản lý xem lại) ⇒ KHÔNG giả định có dữ liệu trả về.
 *  - GET    /announcements/:id/comments    → mảng thô `[{ id, content, createdAt, author }]` (ASC).
 *  - POST   /announcements/:id/comments    → body `{ content }` (bắt buộc).
 *  - DELETE /announcements/:id/comments/:commentId
 *
 * ⚠️ KHÔNG có field `type`, `isPinned`, `publishAt`, `expireAt` trong entity/DTO.
 * ⚠️ Backend KHÔNG có endpoint đếm thông báo chưa đọc ⇒ `useUnreadAnnouncementsCountQuery`
 *    đếm client-side trên list `{ page: 1, limit: 10, status: 'SENT' }` (Web Header cũng làm vậy).
 */

// ============================================================================
// ENUM + NHÃN
// ============================================================================

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'Chung',
  HR: 'Nhân sự',
  POLICY: 'Chính sách',
  EVENT: 'Sự kiện',
  URGENT: 'Khẩn',
  FINANCE: 'Tài chính',
  SYSTEM: 'Hệ thống',
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  SCHEDULED: 'Đã lên lịch',
  SENT: 'Đã gửi',
  CANCELLED: 'Đã huỷ',
};

export const ANNOUNCEMENT_SCOPE_LABELS: Record<string, string> = {
  ALL: 'Toàn công ty',
  ROLE: 'Theo vai trò',
  TEAM: 'Theo đội dự án',
  USER: 'Chọn riêng người dùng',
};

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

/** Thứ tự hiển thị option/chip theo đúng thứ tự enum backend. */
export const ANNOUNCEMENT_CATEGORY_VALUES = Object.keys(ANNOUNCEMENT_CATEGORY_LABELS);
export const ANNOUNCEMENT_PRIORITY_VALUES = Object.keys(ANNOUNCEMENT_PRIORITY_LABELS);
export const ANNOUNCEMENT_SCOPE_VALUES = Object.keys(ANNOUNCEMENT_SCOPE_LABELS);
export const ANNOUNCEMENT_STATUS_VALUES = Object.keys(ANNOUNCEMENT_STATUS_LABELS);

/** Theme màu badge danh mục (chuẩn Getvini — nền nhạt, chữ đậm). */
export const ANNOUNCEMENT_CATEGORY_THEMES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  GENERAL: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  HR: { bg: '#EFF6FF', text: '#2563EB', border: '#DBEAFE' },
  POLICY: { bg: '#F5F3FF', text: '#7C3AED', border: '#EDE9FE' },
  EVENT: { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  URGENT: { bg: '#FEF2F2', text: '#DC2626', border: '#FEE2E2' },
  FINANCE: { bg: '#FFFBEB', text: '#D97706', border: '#FEF3C7' },
  SYSTEM: { bg: '#F8FAFC', text: '#0F172A', border: '#E2E8F0' },
};

/** Theme màu badge ưu tiên (màu theo mức). */
export const ANNOUNCEMENT_PRIORITY_THEMES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  LOW: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  NORMAL: { bg: '#EFF6FF', text: '#2563EB', border: '#DBEAFE' },
  HIGH: { bg: '#FFF7ED', text: '#EA580C', border: '#FFEDD5' },
  URGENT: { bg: '#FEF2F2', text: '#DC2626', border: '#FEE2E2' },
};

export const ANNOUNCEMENT_STATUS_THEMES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  DRAFT: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  SCHEDULED: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  SENT: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  CANCELLED: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
};

export const getAnnouncementCategoryLabel = (category?: string | null): string =>
  category ? ANNOUNCEMENT_CATEGORY_LABELS[category] || category : 'Chung';

export const getAnnouncementStatusLabel = (status?: string | null): string =>
  status ? ANNOUNCEMENT_STATUS_LABELS[status] || status : '';

export const getAnnouncementScopeLabel = (scopeType?: string | null): string =>
  scopeType ? ANNOUNCEMENT_SCOPE_LABELS[scopeType] || scopeType : '';

export const getAnnouncementPriorityLabel = (priority?: string | null): string =>
  priority ? ANNOUNCEMENT_PRIORITY_LABELS[priority] || priority : 'Bình thường';

// ============================================================================
// TYPES
// ============================================================================

export type AnnouncementCategory =
  | 'GENERAL'
  | 'HR'
  | 'POLICY'
  | 'EVENT'
  | 'URGENT'
  | 'FINANCE'
  | 'SYSTEM';

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type AnnouncementScopeType = 'ALL' | 'ROLE' | 'TEAM' | 'USER';

export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED';

export interface AnnouncementMedia {
  url: string;
  type: 'image' | 'video';
  name?: string;
}

export interface AnnouncementAuthor {
  id: string;
  fullName: string;
  email?: string;
  role?: string;
}

/** Một dòng trong danh sách người nhận (chỉ manager/người tạo mới nhận được). */
export interface AnnouncementRecipient {
  id: string;
  isRead: boolean;
  readAt?: string | null;
  lastViewedAt?: string | null;
  recipient?: {
    id: string;
    fullName: string;
  } | null;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  /** RICH TEXT HTML. */
  content: string;
  category: AnnouncementCategory | string;
  priority?: AnnouncementPriority | string;
  status: AnnouncementStatus | string;
  scopeType: AnnouncementScopeType | string;

  targetRoles?: string[] | null;
  targetTeamIds?: string[] | null;
  targetUserIds?: string[] | null;
  ccUserIds?: string[] | null;

  eventStartAt?: string | null;
  eventEndAt?: string | null;
  eventLocation?: string | null;
  scheduledAt?: string | null;

  link?: string | null;
  attachmentUrl?: string | null;
  mediaUrls?: AnnouncementMedia[] | null;

  recipientCount?: number;
  createdBy?: AnnouncementAuthor | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  /** Backend gắn thêm ở list & detail cho CHÍNH người đang xem. */
  isRead?: boolean;

  // Chỉ có với manager (BOD|ADMIN) hoặc người tạo thông báo (GET /announcements/:id)
  recipients?: AnnouncementRecipient[];
  totalRecipients?: number;
  readCount?: number;
  unreadCount?: number;
  /** % đã đọc, backend đã làm tròn. */
  readRate?: number;
}

export interface AnnouncementComment {
  id: string;
  content: string;
  createdAt?: string | null;
  author?: AnnouncementAuthor | null;
}

export interface AnnouncementFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  priority?: string;
  status?: string;
  scopeType?: string;
  createdById?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AnnouncementListResult {
  data: AnnouncementItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateAnnouncementPayload {
  title: string;
  /** RICH TEXT HTML. */
  content: string;
  category: string;
  scopeType: string;
  priority?: string;
  targetRoles?: string[];
  targetTeamIds?: string[];
  targetUserIds?: string[];
  ccUserIds?: string[];
  eventStartAt?: string;
  eventEndAt?: string;
  eventLocation?: string;
  attachmentUrl?: string;
  mediaUrls?: AnnouncementMedia[];
  status?: 'DRAFT' | 'SENT';
}

export interface UpdateAnnouncementPayload extends Partial<CreateAnnouncementPayload> {
  id: string;
}

/**
 * Kết quả DELETE: `SENT` ⇒ backend huỷ mềm và trả entity (status CANCELLED);
 * ngược lại hard delete trả `{ success: true }`.
 */
export type AnnouncementDeleteResult =
  | { kind: 'cancelled'; announcement: AnnouncementItem }
  | { kind: 'deleted'; success: true };

export const getAnnouncementDeleteMessage = (result: AnnouncementDeleteResult): string =>
  result.kind === 'cancelled'
    ? 'Thông báo đã gửi không thể xoá vĩnh viễn. Hệ thống đã chuyển sang trạng thái "Đã huỷ".'
    : 'Đã xoá thông báo nháp vĩnh viễn.';

/** Chuẩn hoá response list về đúng shape phân trang của backend. */
const normalizeListResult = (raw: any, params?: AnnouncementFilters): AnnouncementListResult => {
  const source = raw?.data ?? raw;
  const data: AnnouncementItem[] = Array.isArray(source) ? source : [];

  const limit = Number(raw?.limit) || Number(params?.limit) || data.length || 10;
  const page = Number(raw?.page) || Number(params?.page) || 1;
  const total = Number(raw?.total);
  const safeTotal = Number.isFinite(total) ? total : data.length;
  const totalPages = Number(raw?.totalPages) || (limit > 0 ? Math.ceil(safeTotal / limit) : 1);

  return { data, total: safeTotal, page, limit, totalPages: Math.max(totalPages, 1) };
};

export const announcementService = {
  async getAnnouncements(params?: AnnouncementFilters) {
    const res = await apiService.get('/announcements', params as Record<string, any> | undefined);
    return {
      data: res.error || !res.data ? null : normalizeListResult(res.data, params),
      error: res.error,
    };
  },

  async getAnnouncement(id: string) {
    const res = await apiService.get(`/announcements/${id}`);
    return {
      data: (res.data ?? null) as AnnouncementItem | null,
      error: res.error,
    };
  },

  async createAnnouncement(payload: CreateAnnouncementPayload) {
    const res = await apiService.post('/announcements', payload);
    return { data: (res.data ?? null) as AnnouncementItem | null, error: res.error };
  },

  async updateAnnouncement({ id, ...payload }: UpdateAnnouncementPayload) {
    const res = await apiService.put(`/announcements/${id}`, payload);
    return { data: (res.data ?? null) as AnnouncementItem | null, error: res.error };
  },

  async deleteAnnouncement(id: string) {
    const res = await apiService.delete(`/announcements/${id}`);
    if (res.error) {
      return { data: null as AnnouncementDeleteResult | null, error: res.error };
    }

    const body: any = res.data;

    // `status === 'SENT'` ⇒ backend huỷ mềm và trả entity (có `id` + `status`).
    if (body && typeof body === 'object' && body.id) {
      return {
        data: { kind: 'cancelled', announcement: body as AnnouncementItem } as AnnouncementDeleteResult,
        error: undefined,
      };
    }

    return { data: { kind: 'deleted', success: true } as AnnouncementDeleteResult, error: undefined };
  },

  /**
   * ⚠️ Backend trả `null` (body rỗng) khi viewer không phải người nhận ⇒ coi như thành công,
   * KHÔNG được truy cập thuộc tính của dữ liệu trả về.
   */
  async markAnnouncementAsRead(id: string) {
    const res = await apiService.put(`/announcements/${id}/read`);
    return { data: (res.data ?? null) as AnnouncementRecipient | null, error: res.error };
  },

  async getAnnouncementComments(id: string) {
    const res = await apiService.get(`/announcements/${id}/comments`);
    const source = res.data?.data ?? res.data;
    return {
      data: (Array.isArray(source) ? source : []) as AnnouncementComment[],
      error: res.error,
    };
  },

  async addAnnouncementComment({ id, content }: { id: string; content: string }) {
    const res = await apiService.post(`/announcements/${id}/comments`, { content });
    return { data: (res.data ?? null) as AnnouncementComment | null, error: res.error };
  },

  async deleteAnnouncementComment({ id, commentId }: { id: string; commentId: string }) {
    const res = await apiService.delete(`/announcements/${id}/comments/${commentId}`);
    return { data: (res.data ?? null) as { success?: boolean } | null, error: res.error };
  },
};
