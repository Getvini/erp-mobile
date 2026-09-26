import { apiService } from './api';

export interface DashboardParams {
  userId?: string | null;
  month?: number | null;
  year?: number | null;
  projectId?: string | null;
  mode?: 'personal' | 'management' | string;
}

export interface AdminMetrics {
  totalRevenue?: number;
  totalCustomers?: number;
  newCustomers?: number;
  activeProjects?: number;
  totalDebt?: number;
  pendingApprovalCount?: number;
  currentProjects?: Array<{
    id: string;
    name: string;
    status: string;
    customerName?: string;
    serviceCount: number;
    completedServiceCount: number;
    progress: number;
  }>;
  upcomingDebts?: Array<{
    id: string;
    name: string;
    amount: number;
    remaining: number;
    dueDate: string;
    customerName?: string;
  }>;
  revenueChart?: Array<{
    month: string;
    revenue: number;
    cost?: number;
  }>;
}

export interface SalesMetrics {
  totalRevenue?: number;
  personalRevenue?: number;
  targetRevenue?: number;
  totalOpportunities?: number;
  opportunityCount?: number;
  totalCustomers?: number;
  newCustomersCount?: number;
  totalDebt?: number;
  winRate?: number;
  projects?: Array<{
    id: string;
    name: string;
    status: string;
    customerName?: string;
    serviceCount?: number;
    completedServiceCount?: number;
    progress?: number;
  }>;
  pipelineStages?: Array<{
    stage: string;
    count: number;
    value: number;
  }>;
  recentOpportunities?: Array<{
    id: string;
    name: string;
    expectedRevenue: number;
    status: string;
    customerName?: string;
  }>;
}

export interface TeamLeadProject {
  id: string;
  name: string;
  status: string;
  serviceCount: number;
  completedServiceCount: number;
  progress: number;
}

export interface MemberMetrics {
  totalTasks?: number;
  completedTasks?: number;
  inProgressTasks?: number;
  pendingTasks?: number;
  doingCount?: number;
  completedCount?: number;
  reworkCount?: number;
  violationCount?: number;
  vinicoin?: number;
  todayTasks?: Array<{
    id: string;
    title: string;
    code?: string;
    start?: string;
    end?: string;
    status: string;
    project?: { id: string; name: string };
  }>;
  participatingProjects?: Array<{
    id: string;
    name: string;
    status: string;
    clientName?: string;
    serviceCount: number;
    completedServiceCount: number;
    progress: number;
  }>;
}

export interface DashboardScope {
  type?: 'MANAGEMENT' | 'PERSONAL';
  canSelectMembers?: boolean;
  isAccountViewer?: boolean;
  isAccountViewingMember?: boolean;
  availableMembers?: Array<{
    id: string;
    fullName?: string;
    username?: string;
    role?: string;
  }>;
  availableProjects?: Array<{
    id: string;
    name: string;
  }>;
}

export interface DashboardResponse {
  admin?: AdminMetrics;
  sale?: SalesMetrics;
  teamLead?: TeamLeadProject[];
  member?: MemberMetrics;
  scope?: DashboardScope;
  staffWorkloads?: any[];
}

export interface TaskItem {
  id: string;
  name: string;
  code?: string;
  nickname?: string;
  status: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualEndDate?: string;
  project?: {
    id: string;
    name: string;
    contract?: {
      customer?: {
        name: string;
      };
    };
  };
  assignee?: {
    id: string;
    fullName?: string;
    username?: string;
  };
}

class DashboardService {
  /**
   * Lấy dữ liệu bảng điều khiển tổng hợp theo bộ lọc
   */
  async getDashboardData(params?: DashboardParams): Promise<{ data?: DashboardResponse; error?: string }> {
    const cleanParams: Record<string, any> = {};
    if (params?.userId) cleanParams.userId = params.userId;
    if (params?.month) cleanParams.month = params.month;
    if (params?.year) cleanParams.year = params.year;
    if (params?.projectId) cleanParams.projectId = params.projectId;
    if (params?.mode) cleanParams.mode = params.mode;

    const res = await apiService.get<DashboardResponse>('/dashboard', cleanParams);
    return { data: res.data, error: res.error };
  }

  /**
   * Danh sách công việc chờ duyệt dành cho Lead / Quản lý
   */
  async getAwaitingReviewTasks(): Promise<{ data?: TaskItem[]; error?: string }> {
    const res = await apiService.get<TaskItem[]>('/tasks', {
      status: 'AWAITING_REVIEW',
    });
    return { data: res.data, error: res.error };
  }

  /**
   * Danh sách công việc cá nhân của người dùng hiện tại
   */
  async getMyTasks(): Promise<{ data?: TaskItem[]; error?: string }> {
    const res = await apiService.get<TaskItem[]>('/tasks');
    return { data: res.data, error: res.error };
  }
}

export const dashboardService = new DashboardService();
