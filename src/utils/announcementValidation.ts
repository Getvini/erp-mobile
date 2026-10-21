export interface AnnouncementFormData {
  title: string;
  content: string;
  category?: string;
  scopeType: 'ALL' | 'ROLE' | 'TEAM' | 'USER' | string;
  priority?: string;
  targetRoles?: string[];
  targetTeamIds?: string[];
  targetUserIds?: string[];
  eventStartAt?: string;
  eventEndAt?: string;
}

/**
 * Kiểm tra hợp lệ dữ liệu soạn thảo thông báo nội bộ
 * Đồng bộ với Web `AnnouncementComposeModal.jsx`.
 *
 * @param form Dữ liệu form thông báo
 * @returns Thông báo lỗi nếu vi phạm, hoặc null nếu hợp lệ
 */
export function validateAnnouncementForm(form: AnnouncementFormData): string | null {
  if (!form.title || !form.title.trim()) {
    return 'Vui lòng nhập tiêu đề thông báo.';
  }

  if (!form.content || !form.content.trim()) {
    return 'Vui lòng nhập nội dung thông báo.';
  }

  if (form.scopeType === 'ROLE' && (!form.targetRoles || form.targetRoles.length === 0)) {
    return 'Vui lòng chọn ít nhất một vai trò nhận thông báo.';
  }

  if (form.scopeType === 'TEAM' && (!form.targetTeamIds || form.targetTeamIds.length === 0)) {
    return 'Vui lòng chọn ít nhất một đội dự án nhận thông báo.';
  }

  if (form.scopeType === 'USER' && (!form.targetUserIds || form.targetUserIds.length === 0)) {
    return 'Vui lòng chọn ít nhất một người nhận thông báo.';
  }

  if (form.eventStartAt && form.eventEndAt && form.eventEndAt < form.eventStartAt) {
    return 'Ngày kết thúc không được trước ngày bắt đầu.';
  }

  return null;
}
