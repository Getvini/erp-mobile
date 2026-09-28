export enum UserRole {
  BOD = 'BOD',
  ADMIN = 'ADMIN',
  ADMIN_SALE = 'ADMIN_SALE',
  BD = 'BD',
  PM = 'PM',
  STAFF_A = 'STAFF_A',
  STAFF_B = 'STAFF_B',
  STAFF_C = 'STAFF_C',
  STAFF_D = 'STAFF_D',
}

export const STAFF_ROLES = [
  UserRole.STAFF_A,
  UserRole.STAFF_B,
  UserRole.STAFF_C,
  UserRole.STAFF_D,
];

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
