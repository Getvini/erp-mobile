export type JobLevel = 'A' | 'B' | 'C';
export const JOB_LEVEL_OPTIONS = ['A', 'B', 'C'] as const;
export const JOB_RESPONSIBLE_ROLE_LABELS = {
  CONTENT_CREATOR: 'Nội dung', EDITOR: 'Biên tập', DESIGNER: 'Thiết kế',
  CAMERAMAN: 'Quay', ACCOUNT: 'Account', VIDEO_EDITOR: 'Dựng video',
  SOCIAL_MEDIA_MANAGER: 'Quản lý MXH', PROJECT_MANAGER: 'PM',
} as const;
export type JobResponsibleRole = keyof typeof JOB_RESPONSIBLE_ROLE_LABELS;

export function validateJobMetadata(value: {
  level?: string; responsibleRole?: string | null; description?: string | null; sampleDocumentUrl?: string | null;
}): string | null {
  if (value.level !== undefined && !JOB_LEVEL_OPTIONS.includes(value.level as JobLevel)) return 'Vui lòng chọn cấp độ A, B hoặc C.';
  if (value.responsibleRole && !Object.prototype.hasOwnProperty.call(JOB_RESPONSIBLE_ROLE_LABELS, value.responsibleRole)) return 'Vai trò phụ trách không hợp lệ.';
  if ((value.description || '').length > 5000) return 'Mô tả công việc không được vượt quá 5000 ký tự.';
  const url = (value.sampleDocumentUrl || '').trim();
  if (url.length > 2048) return 'Link tài liệu mẫu không được vượt quá 2048 ký tự.';
  if (url) {
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || /\s/.test(url)) throw new Error(); }
    catch { return 'Link tài liệu mẫu phải là địa chỉ HTTP hoặc HTTPS hợp lệ.'; }
  }
  return null;
}
