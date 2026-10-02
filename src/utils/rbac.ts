export enum UserRole {
  BOD = 'BOD',
  ADMIN = 'ADMIN',
  ADMIN_SALE = 'ADMIN_SALE',
  BD = 'BD',
  PM = 'PM',
  CONTENT_A = 'CONTENT_A',
  CONTENT_B = 'CONTENT_B',
  CONTENT_C = 'CONTENT_C',
  CONTENT_D = 'CONTENT_D',
  EDITOR_A = 'EDITOR_A',
  EDITOR_B = 'EDITOR_B',
  EDITOR_C = 'EDITOR_C',
  EDITOR_D = 'EDITOR_D',
  DESIGNER_A = 'DESIGNER_A',
  DESIGNER_B = 'DESIGNER_B',
  DESIGNER_C = 'DESIGNER_C',
  DESIGNER_D = 'DESIGNER_D',
}

export const SPECIALIZED_STAFF_ROLES = [
  UserRole.CONTENT_A,
  UserRole.CONTENT_B,
  UserRole.CONTENT_C,
  UserRole.CONTENT_D,
  UserRole.EDITOR_A,
  UserRole.EDITOR_B,
  UserRole.EDITOR_C,
  UserRole.EDITOR_D,
  UserRole.DESIGNER_A,
  UserRole.DESIGNER_B,
  UserRole.DESIGNER_C,
  UserRole.DESIGNER_D,
];

export const STAFF_ROLES = [...SPECIALIZED_STAFF_ROLES];

export const PROJECT_MEMBER_EXCLUDED_ACCOUNT_ROLES: string[] = [
  UserRole.ADMIN_SALE,
  UserRole.BOD,
  UserRole.BD,
];

export const USER_ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: '#FFF1F2', text: '#BE123C', border: '#FFE4E6' },
  BOD: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  BD: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  ADMIN_SALE: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  PM: { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' },
  CONTENT_A: { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  CONTENT_B: { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  CONTENT_C: { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  CONTENT_D: { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  EDITOR_A: { bg: '#EEF2FF', text: '#4338CA', border: '#E0E7FF' },
  EDITOR_B: { bg: '#EEF2FF', text: '#4338CA', border: '#E0E7FF' },
  EDITOR_C: { bg: '#EEF2FF', text: '#4338CA', border: '#E0E7FF' },
  EDITOR_D: { bg: '#EEF2FF', text: '#4338CA', border: '#E0E7FF' },
  DESIGNER_A: { bg: '#F0FDFA', text: '#0F766E', border: '#CCFBF1' },
  DESIGNER_B: { bg: '#F0FDFA', text: '#0F766E', border: '#CCFBF1' },
  DESIGNER_C: { bg: '#F0FDFA', text: '#0F766E', border: '#CCFBF1' },
  DESIGNER_D: { bg: '#F0FDFA', text: '#0F766E', border: '#CCFBF1' },
};

export const MANAGEMENT_ROLES = [UserRole.BOD, UserRole.ADMIN];

export const SALES_ROLES = [UserRole.BD, UserRole.ADMIN_SALE];

export const PROJECT_MANAGEMENT_ROLES = [UserRole.BOD, UserRole.ADMIN, UserRole.PM];

/**
 * Check if the user role can access CRM / Customers module.
 * Strictly mirrors: { path: '/customers', roles: ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'] } in erp-UI/Sidebar.jsx
 */
export const canAccessCustomers = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].includes(role);
};

/**
 * Destructive customer actions are restricted to roles with full tenant-wide
 * CRM visibility. BD users keep scoped read/update access to their own data.
 */
export const canDeleteCustomers = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'ADMIN_SALE'].includes(role);
};

/**
 * Check if the user role can access Contracts module.
 * Strictly mirrors: { path: '/contracts', roles: ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'] } in erp-UI/Sidebar.jsx
 */
export const canAccessContracts = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].includes(role);
};

/**
 * Check if the user role can access Opportunities module.
 */
export const canAccessOpportunities = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].includes(role);
};

/**
 * Check if the user role can access Finance / Payment Milestones module.
 */
export const canAccessFinance = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].includes(role);
};

/**
 * Check if the user role can access Acceptance module.
 * Strictly mirrors: { path: '/acceptance', roles: ['ADMIN', 'BOD', 'ADMIN_SALE', 'PM'] } in erp-UI/Sidebar.jsx
 */
export const canAccessAcceptance = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'ADMIN_SALE', 'PM'].includes(role);
};

/**
 * GỬI nghiệm thu (tạo yêu cầu) — mirrors erp-UI ContractInfo.jsx:357
 * `const canSendAcceptance = isAdminOrBOD || isProjectManager || user?.role === 'ADMIN_SALE';`
 * Account / Team Lead chỉ được XEM task, KHÔNG được gửi nghiệm thu.
 */
export const canSendAcceptance = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'PM', 'ADMIN_SALE'].includes(role);
};

/**
 * DUYỆT / TỪ CHỐI / XỬ LÝ nghiệm thu — mirrors ERP Acceptance.Route.ts:10
 * `const acceptanceRoles = ["BOD", "ADMIN", "ADMIN_SALE", "PM"];`
 */
export const canProcessAcceptance = (role?: string): boolean => {
  if (!role) return false;
  return ['BOD', 'ADMIN', 'ADMIN_SALE', 'PM'].includes(role);
};

/**
 * Role check helpers
 */
export const isManagementRole = (role?: string): boolean => {
  return role === 'ADMIN' || role === 'BOD';
};

export const isSalesRole = (role?: string): boolean => {
  return role === 'BD' || role === 'ADMIN_SALE';
};

export const isProjectManagerRole = (role?: string): boolean => {
  return role === 'PM';
};

export const isStaffRole = (role?: string): boolean => {
  return STAFF_ROLES.includes(role as UserRole);
};

// ============================================================================
// PHASE P2 — Danh mục & Đối tác ngoài
// ============================================================================

/** Vendors — Sidebar.jsx: roles ['ADMIN','BOD']; Vendor.Route.ts không roleMiddleware nên UI phải tự chặn. */
export const canAccessVendors = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD'].includes(role);
};

/** Tạo/sửa/xóa nhà cung cấp — cùng nhóm quyền truy cập module. */
export const canManageVendors = canAccessVendors;

/** Referral Partners — Sidebar.jsx: roles ['ADMIN','BOD','BD','ADMIN_SALE']. */
export const canAccessReferralPartners = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].includes(role);
};

export const canManageReferralPartners = canAccessReferralPartners;

/** Services + Service Packages — Sidebar.jsx: roles ['ADMIN','BOD','BD','ADMIN_SALE']. */
export const canAccessServiceCatalog = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].includes(role);
};

/** Xóa hàng loạt dịch vụ — Service.Route.ts: `roleMiddleware(["ADMIN","BOD"])`. */
export const canBulkDeleteServices = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD'].includes(role);
};

// ============================================================================
// PHASE P3 — Quản trị hành chính & nội bộ
// ============================================================================

/** Users — Sidebar.jsx: roles ['ADMIN','BOD']; User.Route.ts chặn BOD/ADMIN cho create/update/delete. */
export const canAccessUsers = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD'].includes(role);
};

export const canManageUsers = canAccessUsers;

/** Teams — Sidebar.jsx: roles ['ADMIN','BOD','BD','ADMIN_SALE','PM']. */
export const canAccessTeams = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE', 'PM'].includes(role);
};

export const canManageTeams = canAccessTeams;

/** Jobs & Job Criteria — Sidebar.jsx: roles ['ADMIN','BOD','BD','ADMIN_SALE','PM']. */
export const canAccessJobs = (role?: string): boolean => {
  if (!role) return false;
  return ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE', 'PM'].includes(role);
};

export const canManageJobs = canAccessJobs;

/** Announcements — không giới hạn ở Sidebar; Route chỉ chặn create/update/delete. */
export const canAccessAnnouncements = (role?: string): boolean => Boolean(role);

/** Announcement.Route.ts: `const MANAGE_ROLES = ["BOD","ADMIN","PM"]`. */
export const canManageAnnouncements = (role?: string): boolean => {
  if (!role) return false;
  return ['BOD', 'ADMIN', 'PM'].includes(role);
};

/** Document Library — không giới hạn ở Sidebar (mọi user đã đăng nhập đều xem). */
export const canAccessDocumentLibrary = (role?: string): boolean => Boolean(role);

/** DocumentLibrary.Route.ts: `const MANAGE_ROLES = ["BOD","ADMIN","ADMIN_SALE"]`. */
export const canManageDocumentLibrary = (role?: string): boolean => {
  if (!role) return false;
  return ['BOD', 'ADMIN', 'ADMIN_SALE'].includes(role);
};
