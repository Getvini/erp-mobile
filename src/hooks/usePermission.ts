import { useAuthStore } from '@/stores/useAuthStore';
import { UserProfile } from '@/services/api';
import { canUnlockDebt, canConfigureQc } from '../../test/utils/permissionTestHelpers';
export const ADMIN_ROLES = ['ADMIN', 'BOD', 'TONG_GIAM_DOC'];
export const MANAGEMENT_ROLES = ['ADMIN', 'BOD', 'TONG_GIAM_DOC', 'DIRECTOR', 'GIAM_DOC', 'MANAGER', 'TRUONG_PHONG'];
export const FINANCE_ROLES = ['ADMIN', 'BOD', 'TONG_GIAM_DOC', 'DIRECTOR', 'GIAM_DOC', 'ACCOUNTANT', 'KE_TOAN'];
export const QC_ROLES = ['ADMIN', 'BOD', 'TONG_GIAM_DOC', 'DIRECTOR', 'GIAM_DOC', 'MANAGER', 'TRUONG_PHONG', 'PM'];

/**
 * Kiểm tra người dùng có quyền duyệt Đề xuất thanh toán / tạm ứng
 */
export const canApprovePaymentRequest = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return [...MANAGEMENT_ROLES, 'ACCOUNTANT', 'KE_TOAN'].includes(role);
};

/**
 * Kiểm tra người dùng có quyền mở khóa công nợ hợp đồng
 */


/**
 * Kiểm tra người dùng có quyền xem báo cáo tài chính & dòng tiền tổng quan
 */
export const canViewFinancialReports = (user?: UserProfile | null): boolean => {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  return FINANCE_ROLES.includes(role);
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
  if (ADMIN_ROLES.includes(role)) return true;

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
    isAdmin: user ? ADMIN_ROLES.includes(user.role.toUpperCase()) : false,
    isManagement: user ? MANAGEMENT_ROLES.includes(user.role.toUpperCase()) : false,
    canApprovePayment: canApprovePaymentRequest(user),
    canUnlockDebt: canUnlockDebt(user),
    canConfigureQc: canConfigureQc(user),
    canViewFinance: canViewFinancialReports(user),
    canModifyContract: (status?: string | null) => canModifyContract(status, user),
  };
};
