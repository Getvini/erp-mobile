/**
 * PHASE P3 — CƠ CẤU ĐỘI NHÓM (Teams)
 * Logic thuần (pure helpers) cho vai trò thành viên đội dự án.
 *
 * Đối chiếu backend thật:
 * - ERP/src/modules/project/routes/ProjectTeam.Route.ts (mount `/api/teams`)
 * - `member.roles` là MẢNG STRING (TeamMemberRoles entity); `member.role` legacy là string đơn.
 * - Endpoint member từ chối `PROJECT_MANAGER` (400) ⇒ không nằm trong ASSIGNABLE_MEMBER_ROLES.
 * - Endpoint cập nhật vai trò từ chối mảng rỗng (400) ⇒ validateMemberRoles chặn tại client.
 * - Endpoint gỡ thành viên từ chối khi đội không còn ai giữ ACCOUNT (400:
 *   "Đội dự án phải có ít nhất 1 nhân sự giữ vai trò Account") ⇒ canRemoveMember/canRemoveAccountRole.
 */

import { TEAM_MEMBER_ROLE_LABELS } from '@/services/teamService';
import { getTeamMemberRoles } from '@/utils/teamMember';

/**
 * Nhãn hiển thị vai trò — nguồn duy nhất là `teamService.ts` (không khai báo trùng).
 * ACCOUNT hiển thị "Account" (không dùng "Lead dự án"/"Account dự án").
 */
export { TEAM_MEMBER_ROLE_LABELS };

/** 8 giá trị vai trò hợp lệ theo backend & web (enum MemberRole). */
export const ALL_MEMBER_ROLES: string[] = [
  'CONTENT_CREATOR',
  'EDITOR',
  'DESIGNER',
  'VIDEO_EDITOR',
  'CAMERAMAN',
  'PROJECT_MANAGER',
  'ACCOUNT',
  'SOCIAL_MEDIA_MANAGER',
];

/**
 * Vai trò được phép gán qua endpoint member (POST /teams/:id/members,
 * PUT /teams/:id/members/:userId/roles) = 9 vai trò TRỪ `PROJECT_MANAGER`
 * (backend trả 400 nếu gán PROJECT_MANAGER qua endpoint này).
 */
export const ASSIGNABLE_MEMBER_ROLES: string[] = ALL_MEMBER_ROLES.filter(
  (role) => role !== 'PROJECT_MANAGER'
);

/**
 * Chuẩn hóa mọi dạng dữ liệu vai trò về mảng string không trùng.
 * Chấp nhận: mảng string, mảng object `{ role }`, hỗn hợp, string đơn, object `{ role }` đơn.
 */
export const normalizeRoles = (roles: unknown): string[] => {
  if (roles === null || roles === undefined) return [];

  const raw: unknown[] = Array.isArray(roles) ? roles : [roles];
  const result: string[] = [];

  raw.forEach((item) => {
    if (typeof item === 'string') {
      const value = item.trim();
      if (value && !result.includes(value)) result.push(value);
      return;
    }
    if (item && typeof item === 'object') {
      const value = (item as { role?: unknown }).role;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !result.includes(trimmed)) result.push(trimmed);
      }
    }
  });

  return result;
};

/** Lấy userId từ một membership (hỗ trợ cả `member.user.id` và `member.userId`). */
const getMembershipUserId = (member: any): string | undefined =>
  member?.user?.id || member?.userId || undefined;

/**
 * Gộp vai trò của một membership thành mảng string không trùng.
 * Dùng lại `getTeamMemberRoles` (util dùng chung của module Projects) làm nguồn chính,
 * bổ sung `member.roles` / `member.role` thô để chịu được mọi shape backend trả về.
 */
const getMemberRoles = (member: any): string[] => {
  const merged = normalizeRoles(getTeamMemberRoles(member));
  [...normalizeRoles(member?.roles), ...normalizeRoles(member?.role)].forEach((role) => {
    if (!merged.includes(role)) merged.push(role);
  });
  return merged;
};

/**
 * Đếm số thành viên đang giữ vai trò ACCOUNT (bỏ qua `excludeUserId`).
 * Dùng để mirror luật backend "đội phải có ít nhất 1 Account".
 */
export const countAccountMembers = (
  members: any[] | null | undefined,
  excludeUserId?: string
): number => {
  if (!Array.isArray(members)) return 0;
  return members.filter((member) => {
    if (!member) return false;
    if (excludeUserId && getMembershipUserId(member) === excludeUserId) return false;
    return getMemberRoles(member).includes('ACCOUNT');
  }).length;
};

/**
 * `false` khi thành viên đang giữ ACCOUNT và không còn ai khác giữ ACCOUNT
 * ⇒ UI phải chặn bỏ vai trò ACCOUNT (mirror backend 400).
 */
export const canRemoveAccountRole = (
  members: any[] | null | undefined,
  userId: string
): boolean => {
  if (!Array.isArray(members) || !userId) return true;
  const member = members.find((item) => getMembershipUserId(item) === userId);
  if (!member) return true;
  if (!getMemberRoles(member).includes('ACCOUNT')) return true;
  return countAccountMembers(members, userId) > 0;
};

/**
 * Quyết định có được gỡ một thành viên khỏi đội hay không.
 * Chặn khi: thành viên đang là Team Lead, HOẶC thành viên giữ ACCOUNT mà đội không còn Account khác.
 */
export const canRemoveMember = (
  members: any[] | null | undefined,
  member: any,
  teamLeadId?: string | null
): { allowed: boolean; message?: string } => {
  if (!member) {
    return { allowed: false, message: 'Không tìm thấy thành viên trong đội.' };
  }

  const userId = getMembershipUserId(member);

  if (teamLeadId && userId && userId === teamLeadId) {
    return {
      allowed: false,
      message: 'Không thể gỡ Team Lead khỏi đội. Vui lòng đổi Team Lead trước.',
    };
  }

  if (getMemberRoles(member).includes('ACCOUNT') && countAccountMembers(members, userId) === 0) {
    return {
      allowed: false,
      message: 'Đội dự án phải có ít nhất 1 nhân sự giữ vai trò Account',
    };
  }

  return { allowed: true };
};

/**
 * Validate danh sách vai trò trước khi gửi API.
 * `false` khi rỗng (backend 400) hoặc chứa vai trò ngoài 9 giá trị hợp lệ.
 */
export const validateMemberRoles = (roles: string[]): { valid: boolean; message?: string } => {
  const normalized = normalizeRoles(roles);

  if (normalized.length === 0) {
    return { valid: false, message: 'Nhân sự phải có ít nhất một vai trò' };
  }

  const invalidRole = normalized.find((role) => !ALL_MEMBER_ROLES.includes(role));
  if (invalidRole) {
    return { valid: false, message: 'Vai trò không hợp lệ' };
  }

  return { valid: true };
};
