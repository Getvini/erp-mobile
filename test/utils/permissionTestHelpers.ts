import { UserProfile } from '@/services/api';
import { ADMIN_ROLES, QC_ROLES } from '@/hooks/usePermission';

/**
 * Kiểm tra người dùng có quyền mở khóa công nợ hợp đồng (test helper)
 */
export const canUnlockDebt = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return ADMIN_ROLES.includes(role);
};

/**
 * Kiểm tra người dùng có quyền cấu hình tham số AI QC (test helper)
 */
export const canConfigureQc = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return QC_ROLES.includes(role);
};
