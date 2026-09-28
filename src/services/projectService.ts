import { apiService } from './api';

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang thực hiện',
  PENDING_PAUSE_APPROVAL: 'Chờ duyệt tạm dừng',
  ON_HOLD: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const PROJECT_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  PENDING_CONFIRMATION: {
    text: 'Chờ xác nhận',
    color: '#C2410C',
    bg: '#FFF7ED',
    border: '#FFEDD5',
  },
  CONFIRMED: {
    text: 'Đã xác nhận',
    color: '#1D4ED8',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  IN_PROGRESS: {
    text: 'Đang thực hiện',
    color: '#047857',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  PENDING_PAUSE_APPROVAL: {
    text: 'Chờ duyệt tạm dừng',
    color: '#B45309',
    bg: '#FEF9C3',
    border: '#FEF08A',
  },
  ON_HOLD: {
    text: 'Tạm dừng',
    color: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  COMPLETED: {
    text: 'Hoàn thành',
    color: '#7E22CE',
    bg: '#F3E8FF',
    border: '#E9D5FF',
  },
  CANCELLED: {
    text: 'Đã hủy',
    color: '#BE123C',
    bg: '#FFE4E6',
    border: '#FECDD3',
  },
};

export interface ProjectItem {
  id: string;
  name: string;
  status: string;
  code?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  budget?: number;
  progress?: number;
  contract?: {
    id: string;
    contractCode?: string;
    name?: string;
    description?: string;
    sellingPrice?: number;
    createdById?: string;
    attachments?: {
      name: string;
      url: string;
      type?: string;
      size?: number;
    }[];
    customer?: {
      id: string;
      name: string;
      phoneNumber?: string;
      email?: string;
    };
  };
  team?: {
    id: string;
    name: string;
    teamLead?: {
      id: string;
      fullName: string;
    };
    members?: {
      id: string;
      role: string;
      user?: {
        id: string;
        fullName: string;
        email?: string;
      };
    }[];
  };
}

export interface UserPMItem {
  id: string;
  fullName: string;
  email?: string;
  role?: string;
}

export interface WorkingFileItem {
  id: string;
  name: string;
  url: string;
  type: 'LINK' | 'FILE';
  size?: number;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
}

export interface ProjectDetailItem extends ProjectItem {
  projectManager?: {
    id: string;
    fullName: string;
    email?: string;
  };
  jobs?: any[];
  tasks?: any[];
  workingFiles?: WorkingFileItem[];
  /** Vòng đời tạm dừng (P1.11) — dùng cho banner tự động đóng D+37. */
  isOnHold?: boolean;
  pausedAt?: string;
  /** Thời điểm hệ thống tự động đóng dự án (pausedAt + 37 ngày). */
  autoAcceptAt?: string;
  pausedBy?: { id: string; fullName?: string };
  contract?: ProjectItem['contract'] & {
    contractCode?: string;
    signingDate?: string;
    sellingPrice?: number;
    totalCost?: number;
    vatAmount?: number;
    paidAmount?: number;
    remainingAmount?: number;
    services?: ContractServiceSummary[];
    addendums?: any[];
  };
}

/** Dịch vụ trong hợp đồng hiển thị ở tab SERVICES của dự án. */
export interface ContractServiceSummary {
  id: string;
  name?: string;
  nickname?: string;
  code?: string;
  quantity?: number;
  sellingPrice?: number;
  cost?: number;
  status?: string;
  service?: { id: string; name?: string; code?: string };
}

class ProjectService {
  async getProjects(filters?: Record<string, any>): Promise<{ data?: ProjectItem[]; error?: string }> {
    const params = { limit: 100, ...filters };
    const res = await apiService.get<any>('/projects', params);
    const raw = res.data;
    const items = Array.isArray(raw)
      ? raw
      : raw?.data && Array.isArray(raw.data)
      ? raw.data
      : [];
    return { data: items, error: res.error };
  }

  async getProjectById(id: string): Promise<{ data?: ProjectDetailItem; error?: string }> {
    const res = await apiService.get<any>(`/projects/${id}`);
    const item = res.data?.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)
      ? res.data.data
      : res.data;
    return { data: item, error: res.error };
  }

  async getProjectByContract(contractId: string): Promise<{ data?: ProjectItem; error?: string }> {
    const res = await apiService.get<any>(`/projects/contract/${contractId}`);
    const item = res.data?.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)
      ? res.data.data
      : res.data;
    return { data: item, error: res.error };
  }


  async assignProject(contractId: string, pmId: string | null): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post('/projects/assign', { contractId, pmId });
    return { data: res.data, error: res.error };
  }

  async assignPm(contractId: string, pmId: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post('/projects/assign', { contractId, pmId });
    return { data: res.data, error: res.error };
  }


  async updateProject(id: string, payload: {
    plannedStartDate?: string | null;
    plannedEndDate?: string | null;
    [key: string]: any;
  }): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/projects/${id}`, payload);
    return { data: res.data, error: res.error };
  }

  async updateProjectStatus(id: string, status: string): Promise<{ data?: any; error?: string }> {

    const res = await apiService.patch(`/projects/${id}/status`, { status });
    return { data: res.data, error: res.error };
  }

  async updateProjectProgress(id: string, progress: number): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/projects/${id}/progress`, { progress });
    return { data: res.data, error: res.error };
  }

  async confirmProject(id: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/confirm`, {});
    return { data: res.data, error: res.error };
  }

  async getMonthlyWorkTemplate(projectId: string, month: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.get<any>(`/projects/${projectId}/monthly-work-template`, { month });
    const item = res.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data;
    return { data: item, error: res.error };
  }

  async createMonthlyWorkAddendum(
    projectId: string,
    payload: { monthKey: string; name?: string; description?: string; items: any[] }
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post<any>(`/projects/${projectId}/monthly-work-addendums`, payload);
    return { data: res.data, error: res.error };
  }

  async getServices(): Promise<{ data?: any[]; error?: string }> {
    const res = await apiService.get<any>('/services');
    const items = Array.isArray(res.data) ? res.data : res.data?.data && Array.isArray(res.data.data) ? res.data.data : [];
    return { data: items, error: res.error };
  }

  async getServicePackages(): Promise<{ data?: any[]; error?: string }> {
    const res = await apiService.get<any>('/service-packages');
    const items = Array.isArray(res.data) ? res.data : res.data?.data && Array.isArray(res.data.data) ? res.data.data : [];
    return { data: items, error: res.error };
  }

  async updateWorkingFiles(id: string, workingFiles: WorkingFileItem[]): Promise<{ data?: any; error?: string }> {
    const res = await apiService.patch(`/projects/${id}/working-files`, { workingFiles });
    return { data: res.data, error: res.error };
  }

  async getPmUsers(): Promise<{ data?: UserPMItem[]; error?: string }> {
    const res = await apiService.get<UserPMItem[]>('/users', { role: 'PM' });
    return { data: res.data, error: res.error };
  }

  // ---------------------------------------------------------------------------
  // P1.11 — Tạm dừng / Làm tiếp / Đóng dự án (copy endpoint erp-UI/src/api/projects.js)
  // ---------------------------------------------------------------------------

  /** POST /projects/:id/pause — yêu cầu tạm dừng (chờ BOD duyệt). */
  async requestPauseProject(id: string, reason: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/pause`, { reason });
    return { data: res.data, error: res.error };
  }

  /** POST /projects/:id/pause/direct — tạm dừng ngay (BOD/ADMIN). */
  async pauseProjectDirect(id: string, reason: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/pause/direct`, { reason });
    return { data: res.data, error: res.error };
  }

  /** POST /projects/pause-requests/:requestId/approve */
  async approvePauseRequest(requestId: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/pause-requests/${requestId}/approve`);
    return { data: res.data, error: res.error };
  }

  /** POST /projects/pause-requests/:requestId/reject — feedback bắt buộc. */
  async rejectPauseRequest(
    requestId: string,
    feedback: string,
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/pause-requests/${requestId}/reject`, { feedback });
    return { data: res.data, error: res.error };
  }

  /** POST /projects/:id/resume — làm tiếp dự án đang tạm dừng. */
  async resumeProject(id: string, resumeReason?: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/resume`, { resumeReason });
    return { data: res.data, error: res.error };
  }

  /** GET /projects/:id/hold-summary — thống kê trước khi đóng dự án. */
  async getHoldSummary(id: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.get<any>(`/projects/${id}/hold-summary`);
    const item = res.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data;
    return { data: item, error: res.error };
  }

  /** POST /projects/:id/close/direct — đóng ngay (BD/BOD/ADMIN), reason bắt buộc. */
  async closeProjectDirect(id: string, reason: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/close/direct`, { reason });
    return { data: res.data, error: res.error };
  }

  /** POST /projects/:id/close — đề nghị đóng dự án (chờ duyệt). */
  async requestCloseProject(id: string, reason?: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/close`, {
      reason: reason ?? 'Đề nghị đóng dự án',
    });
    return { data: res.data, error: res.error };
  }

  /** POST /projects/close-requests/:requestId/approve */
  async approveCloseRequest(requestId: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/close-requests/${requestId}/approve`);
    return { data: res.data, error: res.error };
  }

  /** POST /projects/close-requests/:requestId/reject — feedback bắt buộc. */
  async rejectCloseRequest(
    requestId: string,
    feedback: string,
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/close-requests/${requestId}/reject`, { feedback });
    return { data: res.data, error: res.error };
  }

  /** GET /projects/:id/pause-history — lịch sử tạm dừng/đóng (mới nhất trước). */
  async getPauseHistory(id: string): Promise<{ data?: any[]; error?: string }> {
    const res = await apiService.get<any>(`/projects/${id}/pause-history`);
    const items = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
    return { data: items, error: res.error };
  }

  /** GET /projects/my-projects — dự án đang thực hiện của tôi. */
  async getMyProjects(): Promise<{ data?: ProjectItem[]; error?: string }> {
    const res = await apiService.get<any>('/projects/my-projects');
    const items = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
    return { data: items, error: res.error };
  }

  /** POST /projects/:id/request-staffing */
  async requestStaffing(id: string, note: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/request-staffing`, { note });
    return { data: res.data, error: res.error };
  }

  /** POST /projects — tạo dự án mới. */
  async createProject(payload: {
    name: string;
    contractId: string;
    teamId: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
  }): Promise<{ data?: ProjectItem; error?: string }> {
    const res = await apiService.post<ProjectItem>('/projects', payload);
    return { data: res.data, error: res.error };
  }

  /** DELETE /projects/:id */
  async deleteProject(id: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.delete(`/projects/${id}`);
    return { data: res.data, error: res.error };
  }

  /** POST /projects/:id/sync-service-jobs (ADMIN/PM). */
  async syncServiceJobs(id: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${id}/sync-service-jobs`);
    return { data: res.data, error: res.error };
  }

  /** POST /projects/:projectId/service-addendums — phụ lục dịch vụ dự án. */
  async createProjectServiceAddendum(
    projectId: string,
    payload: {
      name?: string;
      description?: string;
      items: {
        serviceId: string;
        serviceName?: string;
        quantity: number;
        packageKey?: string;
        packageName?: string;
        packageQuantity?: number;
        isPackageService?: boolean;
        sellingPrice: number;
        cost: number;
      }[];
    },
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${projectId}/service-addendums`, payload);
    return { data: res.data, error: res.error };
  }
}

export const projectService = new ProjectService();

