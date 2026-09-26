/**
 * TanStack Query Key Factory - Complete ERP Mobile Coverage
 * Hierarchical query keys for cache management, fetching & real-time invalidation.
 */
export const queryKeys = {
  // Auth & Profile
  auth: {
    user: ['auth', 'user'] as const,
    permissions: ['auth', 'permissions'] as const,
  },

  // Dashboard & Home Metrics
  dashboard: {
    all: ['dashboard'] as const,
    summary: (params?: { month?: number; year?: number }) => [...queryKeys.dashboard.all, params || {}] as const,
  },

  // Opportunities / Cơ hội kinh doanh
  opportunities: {
    all: ['opportunities'] as const,
    lists: () => [...queryKeys.opportunities.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.opportunities.lists(), filters || {}] as const,
    details: () => [...queryKeys.opportunities.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.opportunities.details(), id] as const,
  },

  // Quotations / Báo giá
  quotations: {
    all: ['quotations'] as const,
    lists: () => [...queryKeys.quotations.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.quotations.lists(), filters || {}] as const,
    details: () => [...queryKeys.quotations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.quotations.details(), id] as const,
  },

  // Customers / Khách hàng
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.customers.lists(), filters || {}] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
  },

  // Contracts / Hợp đồng
  contracts: {
    all: ['contracts'] as const,
    lists: () => [...queryKeys.contracts.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.contracts.lists(), filters || {}] as const,
    details: () => [...queryKeys.contracts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.contracts.details(), id] as const,
  },

  // Projects / Dự án
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.projects.lists(), filters || {}] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    productDescriptions: (projectId: string) => [...queryKeys.projects.detail(projectId), 'product-descriptions'] as const,
  },

  // Tasks / Công việc
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.tasks.lists(), filters || {}] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },

  // Acceptances / Nghiệm thu
  acceptances: {
    all: ['acceptances'] as const,
    lists: () => [...queryKeys.acceptances.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.acceptances.lists(), filters || {}] as const,
    details: () => [...queryKeys.acceptances.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.acceptances.details(), id] as const,
  },

  // Task Result Checks / Kiểm tra chính tả & QC
  taskResultChecks: {
    all: ['taskResultChecks'] as const,
    detail: (taskId: string) => [...queryKeys.taskResultChecks.all, taskId] as const,
  },

  qc: {
    all: ['qc'] as const,
    productInfo: (projectId: string) => [...queryKeys.qc.all, 'product-info', projectId] as const,
  },

  spellingCheck: {
    all: ['spellingCheck'] as const,
    sheetsFromUrl: (fileUrl?: string, fileName?: string) =>
      [...queryKeys.spellingCheck.all, 'sheets-from-url', fileUrl || '', fileName || ''] as const,
    sheetsFromFile: (fileUri?: string, fileName?: string) =>
      [...queryKeys.spellingCheck.all, 'sheets-from-file', fileUri || '', fileName || ''] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    unread: ['notifications', 'unread'] as const,
  },

  // Finance / Tài chính & Công nợ
  finance: {
    all: ['finance'] as const,
    contractDebts: () => [...queryKeys.finance.all, 'contract-debts'] as const,
  },

  // Payment Milestones / Đợt thanh toán
  paymentMilestones: {
    all: ['paymentMilestones'] as const,
    lists: () => [...queryKeys.paymentMilestones.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.paymentMilestones.lists(), params || {}] as const,
    byContract: (contractId: string) => [...queryKeys.paymentMilestones.all, 'contract', contractId] as const,
    byProject: (projectId: string) => [...queryKeys.paymentMilestones.all, 'project', projectId] as const,
    details: () => [...queryKeys.paymentMilestones.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.paymentMilestones.details(), id] as const,
  },

  // Payment Requests / Đề xuất thanh toán & tạm ứng
  paymentRequests: {
    all: ['paymentRequests'] as const,
    lists: () => [...queryKeys.paymentRequests.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.paymentRequests.lists(), params || {}] as const,
    details: () => [...queryKeys.paymentRequests.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.paymentRequests.details(), id] as const,
    totalDebt: (params?: Record<string, any>) => [...queryKeys.paymentRequests.all, 'total-debt', params || {}] as const,
  },

  // Debts / Công nợ hợp đồng & đối soát
  debts: {
    all: ['debts'] as const,
    lists: () => [...queryKeys.debts.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.debts.lists(), params || {}] as const,
    byContract: (contractId: string) => [...queryKeys.debts.all, 'contract', contractId] as const,
    details: () => [...queryKeys.debts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.debts.details(), id] as const,
  },
};
