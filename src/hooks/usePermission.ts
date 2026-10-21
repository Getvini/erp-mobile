import { useAuthStore } from '@/stores/useAuthStore';
import { UserProfile } from '@/services/api';
import {
  UserRole,
  MANAGEMENT_ROLES as RBAC_MANAGEMENT_ROLES,
  PROJECT_MANAGEMENT_ROLES,
} from '@/utils/rbac';

export const ADMIN_ROLES: string[] = [UserRole.ADMIN, UserRole.BOD];
export const MANAGEMENT_ROLES: string[] = [...RBAC_MANAGEMENT_ROLES];
export const FINANCE_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.BOD,
  UserRole.ADMIN_SALE,
  UserRole.BD,
];

/**
 * Kiểm tra quyền duyệt yêu cầu thanh toán (BOD, ADMIN, ADMIN_SALE)
 */
export const canApprovePaymentRequest = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return [UserRole.ADMIN, UserRole.BOD, UserRole.ADMIN_SALE].map(r => r.toUpperCase()).includes(role);
};

/**
 * Kiểm tra quyền xem báo cáo / mô-đun tài chính (SALES_AND_LEADERSHIP: ADMIN, BOD, BD, ADMIN_SALE)
 */
export const canViewFinancialReports = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return FINANCE_ROLES.map(r => r.toUpperCase()).includes(role);
};

/**
 * Kiểm tra người dùng có quyền mở khóa công nợ (chỉ ADMIN / BOD)
 */
export const canUnlockDebt = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return ADMIN_ROLES.map(r => r.toUpperCase()).includes(role);
};

/**
 * Kiểm tra người dùng có quyền cấu hình tiêu chí QC / nghiệm thu (BOD, ADMIN, PM)
 */
export const canConfigureQc = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return PROJECT_MANAGEMENT_ROLES.map(r => r.toUpperCase()).includes(role);
};

/**
 * Kiểm tra hợp đồng có bị khóa chỉnh sửa không dựa trên trạng thái và role
 */
export const canModifyContract = (
  contractStatus?: string | null,
  user?: UserProfile | null
): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  if (ADMIN_ROLES.map(r => r.toUpperCase()).includes(role)) return true;

  const lockedStatuses = ['SIGNED', 'DA_KY', 'ACTIVE', 'COMPLETED', 'HOAN_THANH'];
  if (contractStatus && lockedStatuses.includes(contractStatus.toUpperCase())) {
    return false;
  }
  return true;
};

/**
 * React Hook usePermission tích hợp với Auth Store
 */
export const usePermission = () => {
  const user = useAuthStore((state) => state.user);

  return {
    user,
    role: user?.role || '',
    isAdmin: user ? ADMIN_ROLES.map(r => r.toUpperCase()).includes(user.role.toUpperCase()) : false,
    isManagement: user ? MANAGEMENT_ROLES.map(r => r.toUpperCase()).includes(user.role.toUpperCase()) : false,
    canApprovePayment: canApprovePaymentRequest(user),
    canUnlockDebt: canUnlockDebt(user),
    canConfigureQc: canConfigureQc(user),
    canViewFinance: canViewFinancialReports(user),
    canModifyContract: (status?: string | null) => canModifyContract(status, user),
  };
};
