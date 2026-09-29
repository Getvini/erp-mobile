export * from './useOpportunities';
export * from './useQuotations';
export * from './useProjects';
export * from './useAuthQuery';
export * from './useDashboard';
export * from './useFinance';
export * from './useMilestones';
export * from './usePaymentRequests';
export * from './useContracts';
export * from './useContractAddendums';
export * from './useCustomers';
export * from './useTasks';
export * from './useAcceptances';
export * from './useNotifications';
export * from './useTaskResultChecks';
export * from './useQcSpellCheck';
export * from './useSettings';
export {
  useDebtsQuery,
  useDebtDetailQuery,
  useDebtsByContractQuery,
  useActivateDebtItemMutation,
  useCreateDebtPaymentMutation,
  useDeleteDebtPaymentMutation,
  useDeleteDebtMutation,
  useUnlockDebtMutation,
} from './useDebts';

// ---------------------------------------------------------------------------
// Phase P2 — Danh mục & Đối tác ngoài
// ---------------------------------------------------------------------------
export * from './useVendors';
export * from './useReferralPartners';
export * from './useServices';
export * from './useServicePackages';

// ---------------------------------------------------------------------------
// Phase P3 — Quản trị hành chính & nội bộ
// ---------------------------------------------------------------------------
export * from './useUsers';
export * from './useJobs';
export * from './useAnnouncements';
export * from './useDocumentLibrary';

/**
 * `useTeams` KHÔNG dùng `export *` vì 3 hook quản lý thành viên đội
 * (`useAddTeamMemberMutation`, `useUpdateTeamMemberRolesMutation`,
 * `useRemoveTeamMemberMutation`) trùng tên với `useProjects.ts` (bản dùng cho
 * module Dự án). Chỉ re-export các hook đặc thù của module Đội nhóm.
 */
export {
  useTeamsQuery,
  useTeamDetailQuery,
  useTeamMembersByTeamQuery,
  useTeamUserDirectoryQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useChangeTeamLeadMutation,
} from './useTeams';

