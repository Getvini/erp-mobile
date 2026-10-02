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
    summary: (params?: Record<string, any>) => [...queryKeys.dashboard.all, 'summary', params || {}] as const,
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

  // Contract Addendums / Phụ lục hợp đồng
  contractAddendums: {
    all: ['contractAddendums'] as const,
    byContract: (contractId: string) =>
      [...queryKeys.contractAddendums.all, 'contract', contractId] as const,
  },

  // Projects / Dự án
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.projects.lists(), filters || {}] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    myProjects: () => [...queryKeys.projects.all, 'my-projects'] as const,
    productDescriptions: (projectId: string) => [...queryKeys.projects.detail(projectId), 'product-descriptions'] as const,
    pauseHistory: (projectId: string) => [...queryKeys.projects.detail(projectId), 'pause-history'] as const,
    holdSummary: (projectId: string) => [...queryKeys.projects.detail(projectId), 'hold-summary'] as const,
    serviceAddendums: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), 'service-addendums'] as const,
  },

  // Tasks / Công việc
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.tasks.lists(), filters || {}] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
    byProject: (projectId: string) => [...queryKeys.tasks.all, 'project', projectId] as const,
    byAssignee: (userId: string, filters?: Record<string, any>) =>
      [...queryKeys.tasks.all, 'assignee', userId, filters || {}] as const,
    byOpportunity: (opportunityId: string) =>
      [...queryKeys.tasks.all, 'opportunity', opportunityId] as const,
    dailyWorkload: (userId: string, startDate?: string, endDate?: string) =>
      [...queryKeys.tasks.all, 'daily-workload', userId, startDate || '', endDate || ''] as const,
    comments: (taskId: string) => [...queryKeys.tasks.detail(taskId), 'comments'] as const,
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
    list: (filters?: Record<string, any>) =>
      [...queryKeys.notifications.all, 'list', filters || {}] as const,
    unread: ['notifications', 'unread'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },

  // Finance / Tài chính & Công nợ
  finance: {
    all: ['finance'] as const,
    contractDebts: () => [...queryKeys.finance.all, 'contract-debts'] as const,
    paymentPeriods: () => [...queryKeys.finance.all, 'payment-periods'] as const,
    paymentPeriod: (id: string) => [...queryKeys.finance.paymentPeriods(), id] as const,
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

  // Payment Dashboard / Bảng điều khiển tài chính & dòng tiền
  paymentDashboard: {
    all: ['paymentDashboard'] as const,
    overview: (params?: Record<string, any>) => [...queryKeys.paymentDashboard.all, 'overview', params || {}] as const,
  },

  // Finance Documents / Biên bản nghiệm thu & Hóa đơn VAT
  financeDocuments: {
    all: ['financeDocuments'] as const,
    byContract: (contractId: string) => [...queryKeys.financeDocuments.all, 'contract', contractId] as const,
  },

  // Settings / Cài đặt hệ thống & QC
  settings: {
    all: ['settings'] as const,
    qc: () => [...queryKeys.settings.all, 'qc'] as const,
    workloadNorms: () => [...queryKeys.settings.all, 'workload-norms'] as const,
  },

  // ==========================================================================
  // PHASE P2 — Danh mục & Đối tác ngoài
  // ==========================================================================

  // Vendors / Nhà cung cấp
  vendors: {
    all: ['vendors'] as const,
    lists: () => [...queryKeys.vendors.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.vendors.lists(), filters || {}] as const,
    details: () => [...queryKeys.vendors.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.vendors.details(), id] as const,
    byJob: (jobId: string) => [...queryKeys.vendors.all, 'by-job', jobId] as const,
    jobs: (vendorId: string) => [...queryKeys.vendors.detail(vendorId), 'jobs'] as const,
  },

  // Referral Partners / Đối tác giới thiệu & hoa hồng CTV
  referralPartners: {
    all: ['referralPartners'] as const,
    lists: () => [...queryKeys.referralPartners.all, 'list'] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.referralPartners.lists(), filters || {}] as const,
    details: () => [...queryKeys.referralPartners.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.referralPartners.details(), id] as const,
    statistics: (id: string) => [...queryKeys.referralPartners.detail(id), 'statistics'] as const,
  },

  // Services / Dịch vụ niêm yết (catalog)
  services: {
    all: ['services'] as const,
    lists: () => [...queryKeys.services.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.services.lists(), filters || {}] as const,
    details: () => [...queryKeys.services.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.services.details(), id] as const,
  },

  // Service Packages / Gói dịch vụ niêm yết
  servicePackages: {
    all: ['servicePackages'] as const,
    lists: () => [...queryKeys.servicePackages.all, 'list'] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.servicePackages.lists(), filters || {}] as const,
    details: () => [...queryKeys.servicePackages.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.servicePackages.details(), id] as const,
  },

  // ==========================================================================
  // PHASE P3 — Quản trị hành chính & nội bộ
  // ==========================================================================

  // Users / Danh bạ nhân sự nội bộ
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.users.lists(), filters || {}] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    tasks: (userId: string) => [...queryKeys.users.detail(userId), 'tasks'] as const,
  },

  // Teams / Cơ cấu phòng ban & đội nhóm
  teams: {
    all: ['teams'] as const,
    lists: () => [...queryKeys.teams.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.teams.lists(), filters || {}] as const,
    details: () => [...queryKeys.teams.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.teams.details(), id] as const,
    members: (id: string) => [...queryKeys.teams.detail(id), 'members'] as const,
  },

  // Jobs / Công việc mẫu
  jobs: {
    all: ['jobs'] as const,
    lists: () => [...queryKeys.jobs.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.jobs.lists(), filters || {}] as const,
    details: () => [...queryKeys.jobs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobs.details(), id] as const,
    criteria: (jobId: string) => [...queryKeys.jobs.detail(jobId), 'criteria'] as const,
  },

  // Announcements / Bảng tin & thông báo công ty
  announcements: {
    all: ['announcements'] as const,
    lists: () => [...queryKeys.announcements.all, 'list'] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.announcements.lists(), filters || {}] as const,
    details: () => [...queryKeys.announcements.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.announcements.details(), id] as const,
    comments: (id: string) => [...queryKeys.announcements.detail(id), 'comments'] as const,
    unreadCount: () => [...queryKeys.announcements.all, 'unread-count'] as const,
  },

  // Document Library / Thư viện biểu mẫu & tài liệu
  documents: {
    all: ['documents'] as const,
    lists: () => [...queryKeys.documents.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.documents.lists(), filters || {}] as const,
    details: () => [...queryKeys.documents.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.documents.details(), id] as const,
    tags: () => [...queryKeys.documents.all, 'tags'] as const,
    versions: (id: string) => [...queryKeys.documents.detail(id), 'versions'] as const,
  },
};
