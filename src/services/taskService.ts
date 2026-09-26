import { apiService } from './api';
import { TaskItem } from './dashboardService';

export const TASK_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Chưa thực hiện',
  PENDING: 'Chờ phân công',
  DOING: 'Đang thực hiện',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  AWAITING_PRICING: 'Chờ định giá',
  REJECTED: 'Yêu cầu làm lại',
  AWAITING_ACCEPTANCE: 'Đang chờ nghiệm thu',
  AWAITING_REVIEW: 'Đang chờ duyệt',
  OVERDUE: 'Quá hạn',
  AWAITING_SUPPORT: 'Đã nhờ hỗ trợ',
  SUPPORT_PENDING: 'Chờ xác nhận hỗ trợ',
  COMPLETED: 'Hoàn thành',
  REWORKING: 'Đang làm lại',
  INTERNAL_COMPLETED: 'Hoàn thành nội bộ',
  ACCEPTED: 'Đã nghiệm thu',
  SUPPORT_AWAITING_RETURN: 'Chờ xác nhận hoàn thành',
  ON_HOLD: 'Tạm dừng',
};

export const TASK_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string }
> = {
  NOT_STARTED: { text: 'Chưa thực hiện', color: '#64748B', bg: '#F1F5F9' },
  PENDING: { text: 'Chờ phân công', color: '#D97706', bg: '#FFFBEB' },
  DOING: { text: 'Đang thực hiện', color: '#2563EB', bg: '#EFF6FF' },
  DONE: { text: 'Hoàn thành', color: '#059669', bg: '#ECFDF5' },
  CANCELLED: { text: 'Đã hủy', color: '#E11D48', bg: '#FFF1F2' },
  AWAITING_PRICING: { text: 'Chờ định giá', color: '#EA580C', bg: '#FFF7ED' },
  REJECTED: { text: 'Yêu cầu làm lại', color: '#E11D48', bg: '#FFF1F2' },
  AWAITING_ACCEPTANCE: { text: 'Chờ nghiệm thu', color: '#D97706', bg: '#FFFBEB' },
  AWAITING_REVIEW: { text: 'Chờ duyệt', color: '#D97706', bg: '#FFFBEB' },
  OVERDUE: { text: 'Quá hạn', color: '#DC2626', bg: '#FEF2F2' },
  AWAITING_SUPPORT: { text: 'Đã nhờ hỗ trợ', color: '#E11D48', bg: '#FFF1F2' },
  SUPPORT_PENDING: { text: 'Chờ xác nhận hỗ trợ', color: '#EA580C', bg: '#FFF7ED' },
  COMPLETED: { text: 'Hoàn thành', color: '#059669', bg: '#ECFDF5' },
  REWORKING: { text: 'Đang làm lại', color: '#D97706', bg: '#FFFBEB' },
  INTERNAL_COMPLETED: { text: 'HT nội bộ', color: '#7C3AED', bg: '#F3E8FF' },
  ACCEPTED: { text: 'Đã nghiệm thu', color: '#059669', bg: '#ECFDF5' },
  SUPPORT_AWAITING_RETURN: { text: 'Chờ xác nhận hoàn thành', color: '#2563EB', bg: '#EFF6FF' },
  ON_HOLD: { text: 'Tạm dừng', color: '#B45309', bg: '#FFFBEB' },
};

export interface TaskDetail extends TaskItem {
  code?: string;
  nickname?: string;
  projectId?: string;
  jobId?: string;
  job?: {
    id: string;
    name?: string;
    criteria?: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
  };
  performerType?: string;
  isSupportRequested?: boolean;
  isSupportAccepted?: boolean;
  isSupportReturnRequested?: boolean;
  supportTeamId?: string;
  supportLeadId?: string;
  helperId?: string;
  assignerId?: string;
  description?: string;
  expectedResult?: string;
  isExtraTask?: boolean;
  progress?: number;
  assigneeId?: string;
  assignee?: {
    id: string;
    fullName?: string;
    name?: string;
  };
  lastSubmittedBy?: {
    id: string;
    fullName: string;
  };
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  plannedEndDate?: string;
  plannedStartDate?: string;
  links?: string[];
  attachments?: Array<{
    type?: string;
    name?: string;
    url: string;
    size?: number;
  }>;
  result?: {
    type?: string;
    name?: string;
    url?: string;
    note?: string;
    checklist?: Array<{ criteriaId?: string; label?: string; description?: string; item?: string; checked: boolean }>;
  };
  reviewNote?: string;
  reworkCount?: number;
  reworkReason?: string;
  iterations?: Array<{
    id: string;
    version: number;
    createdAt: string;
    deadlineAt?: string;
    submittedBy?: { fullName: string };
    leadFeedback?: string;
    feedbackAttachments?: Array<{ type?: string; name: string; url: string }>;
    submittedResult?: { type?: string; name: string; url?: string };
  }>;
  project?: {
    id: string;
    name: string;
    status?: string;
    team?: {
      id?: string;
      teamLead?: { id: string; fullName?: string };
    };
    contract?: {
      id?: string;
      customer?: {
        name: string;
        phoneNumber?: string;
      };
    };
  };
}

class TaskService {
  async getTasks(filters?: Record<string, any>): Promise<{ data?: TaskItem[]; total?: number; error?: string }> {
    const params = { page: 1, limit: 20, ...filters };
    const res = await apiService.get<any>('/tasks', params);
    const raw = res.data;
    const items = Array.isArray(raw)
      ? raw
      : raw?.data && Array.isArray(raw.data)
      ? raw.data
      : [];
    const total = raw?.total ?? raw?.pagination?.total ?? raw?.meta?.total ?? items.length;
    
    return { data: items, total, error: res.error };
  }

  async getTasksByProject(projectId: string): Promise<{ data?: TaskDetail[]; error?: string }> {
    const res = await apiService.get<any>('/tasks', { projectId, limit: 100 });
    const raw = res.data;
    const items = Array.isArray(raw)
      ? raw
      : raw?.data && Array.isArray(raw.data)
      ? raw.data
      : [];
    return { data: items, error: res.error };
  }


  async getTaskById(id: string): Promise<{ data?: TaskDetail; error?: string }> {
    const res = await apiService.get<any>(`/tasks/${id}`);
    const item = res.data?.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)
      ? res.data.data
      : res.data;
    return { data: item, error: res.error };
  }


  async updateTask(id: string, data: Partial<TaskDetail>): Promise<{ data?: TaskDetail; error?: string }> {
    const res = await apiService.put<TaskDetail>(`/tasks/${id}`, data);
    return { data: res.data, error: res.error };
  }

  async updateTaskStatus(id: string, status: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/tasks/${id}/status`, { status });
    return { data: res.data, error: res.error };
  }

  async createTask(payload: {
    projectId: string;
    name: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    isExtraTask?: boolean;
  }): Promise<{ data?: TaskDetail; error?: string }> {
    const res = await apiService.post<TaskDetail>('/tasks', payload);
    return { data: res.data, error: res.error };
  }

  async assignTask(
    id: string,
    payload:
      | string
      | {
          assigneeId?: string;
          performerType?: string;
          plannedEndDate?: string;
          plannedStartDate?: string;
          description?: string;
          attachments?: any[];
          projectId?: string;
        }
  ): Promise<{ data?: any; error?: string }> {
    const body = typeof payload === 'string' ? { assigneeId: payload } : payload;
    const res = await apiService.put(`/tasks/${id}/assign`, body);
    return { data: res.data, error: res.error };
  }

  async bulkAssignTasks(payload: {
    taskIds: string[];
    assigneeId?: string;
    performerType?: string;
    plannedEndDate?: string;
    plannedStartDate?: string;
    description?: string;
    attachments?: any[];
    projectId?: string;
  }): Promise<{ data?: any; error?: string }> {
    const res = await apiService.put('/tasks/bulk-assign', payload);
    return { data: res.data, error: res.error };
  }

  async requestSupport(
    id: string,
    note?: string,
    projectId?: string
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/tasks/${id}/request-support`, { note, projectId });
    return { data: res.data, error: res.error };
  }

  async assignSupportTeam(
    id: string,
    teamId: string,
    projectId?: string
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/tasks/${id}/assign-support-team`, { teamId, projectId });
    return { data: res.data, error: res.error };
  }

  async getVendorsByJob(jobId: string): Promise<{ data?: any[]; error?: string }> {
    const res = await apiService.get<any>(`/vendors/by-job/${jobId}`);
    const data = res.data?.data || res.data || [];
    return { data: Array.isArray(data) ? data : [], error: res.error };
  }

  async getVendors(): Promise<{ data?: any[]; error?: string }> {
    const res = await apiService.get<any>('/vendors');
    const data = res.data?.data || res.data || [];
    return { data: Array.isArray(data) ? data : [], error: res.error };
  }

  async submitTaskResult(
    id: string,
    payload: {
      link?: string;
      result?: any;
      projectId?: string;
      sheetNames?: string[];
      whitelist?: string[];
      checkFileUrl?: string;
      checkFileName?: string;
    }
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/tasks/${id}/submit-result`, payload);
    return { data: res.data, error: res.error };
  }

  async submitTaskResultFile(
    id: string,
    file: { uri: string; name: string; mimeType?: string },
    sheetNames?: string[],
    whitelist?: string[]
  ): Promise<{ data?: any; error?: string }> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as any);
    if (sheetNames && sheetNames.length > 0) {
      formData.append('sheetNames', sheetNames.join(','));
    }
    if (whitelist && whitelist.length > 0) {
      formData.append('whitelist', whitelist.join(','));
    }
    const res = await apiService.patchForm(`/tasks/${id}/submit-result-file`, formData);
    return { data: res.data, error: res.error };
  }

  async getTaskReviews(taskId: string): Promise<{ data?: any[]; error?: string }> {
    const res = await apiService.get<any>(`/task-reviews/task/${taskId}`);
    const data = res.data?.data || res.data || [];
    return { data: Array.isArray(data) ? data : [], error: res.error };
  }

  async finalizeTask(
    taskId: string,
    payload: { passedCriteriaIds: string[]; reviewNote?: string; projectId?: string }
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/task-reviews/task/${taskId}/finalize`, payload);
    return { data: res.data, error: res.error };
  }

  async rejectTask(
    taskId: string,
    payload: { passedCriteriaIds?: string[]; reviewNote: string; projectId?: string }
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/task-reviews/task/${taskId}/reject`, payload);
    return { data: res.data, error: res.error };
  }

  async requestRework(
    id: string,
    payload: { feedback: string; deadlineAt?: string; attachments?: any[]; projectId?: string }
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/tasks/${id}/rework`, payload);
    return { data: res.data, error: res.error };
  }

  async approveByCustomer(id: string, projectId?: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/tasks/${id}/customer-approve`, { projectId });
    return { data: res.data, error: res.error };
  }

  async respondToSupport(
    id: string,
    action: 'ACCEPT' | 'REJECT',
    projectId?: string
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/tasks/${id}/respond-support`, { action, projectId });
    return { data: res.data, error: res.error };
  }

  async returnSupport(id: string, projectId?: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/tasks/${id}/return-support`, { projectId });
    return { data: res.data, error: res.error };
  }

  async requestReturnSupport(
    id: string,
    note?: string,
    projectId?: string
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/tasks/${id}/request-return-support`, { note, projectId });
    return { data: res.data, error: res.error };
  }

  async sendTaskReminder(id: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/tasks/${id}/remind`, {});
    return { data: res.data, error: res.error };
  }
}

export const taskService = new TaskService();

