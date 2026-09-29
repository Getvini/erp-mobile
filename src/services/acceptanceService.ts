import { apiService } from './api';

export const ACCEPTANCE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  PROCESSED: 'Đã xử lý',
  CANCELLED: 'Đã hủy',
};

export const ACCEPTANCE_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string }
> = {
  PENDING: { text: 'Chờ duyệt', color: '#D97706', bg: '#FFFBEB' },
  APPROVED: { text: 'Đã duyệt', color: '#059669', bg: '#ECFDF5' },
  REJECTED: { text: 'Từ chối', color: '#DC2626', bg: '#FEF2F2' },
  PROCESSED: { text: 'Đã xử lý', color: '#2563EB', bg: '#EFF6FF' },
  CANCELLED: { text: 'Đã hủy', color: '#64748B', bg: '#F1F5F9' },
};

export interface AcceptanceItem {
  id: string;
  name?: string;
  acceptanceCode?: string;
  projectId: string;
  status: string;
  amount?: number;
  note?: string;
  feedback?: string;
  createdAt?: string;
  services?: AcceptanceServiceItem[];
  creator?: {
    id: string;
    fullName: string;
  };
  requester?: {
    id: string;
    fullName?: string;
    username?: string;
  };
  approver?: {
    id: string;
    fullName?: string;
    username?: string;
  } | null;
  project?: {
    id: string;
    name: string;
    status?: string;
    isOnHold?: boolean;
  };
}

export interface AcceptanceResult {
  id?: string;
  taskId: string;
  taskCode?: string;
  name?: string;
  url?: string;
  type?: string;
  status?: string;
  feedback?: string;
  checklist?: { label: string; checked?: boolean }[];
  task?: { id: string; code?: string };
}

export interface AcceptanceServiceItem {
  id: string;
  code?: string;
  serviceCode?: string;
  name?: string;
  status?: string;
  results?: AcceptanceResult[];
  service?: { id: string; name?: string; code?: string };
  tasks?: any[];
  [key: string]: any;
}

export interface AcceptanceDecision {
  serviceId: string;
  status: 'APPROVED' | 'REJECTED';
  feedback?: string;
  resultDecisions?: {
    taskId: string;
    status: 'APPROVED' | 'REJECTED';
    feedback?: string;
  }[];
}

export interface AcceptanceListFilters {
  projectId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const normalizeList = (raw: any): AcceptanceItem[] =>
  Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];

class AcceptanceService {
  async getAcceptanceRequests(
    filters?: string | AcceptanceListFilters,
  ): Promise<{ data?: AcceptanceItem[]; meta?: any; error?: string }> {
    const params =
      typeof filters === 'string' ? { projectId: filters } : filters ?? undefined;
    const res = await apiService.get<any>('/acceptance', params);
    return { data: normalizeList(res.data), meta: res.data?.meta, error: res.error };
  }

  async getAcceptanceById(id: string): Promise<{ data?: AcceptanceItem; error?: string }> {
    const res = await apiService.get<any>(`/acceptance/${id}`);
    const item = res.data?.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)
      ? res.data.data
      : res.data;
    return { data: item, error: res.error };
  }


  /**
   * POST /acceptance/request — payload ĐÚNG bằng Web (CreateAcceptanceModal.jsx:55-59):
   * chỉ gửi `{ projectId, note, serviceIds }`, backend tự sinh `name` (NT-{contractCode}-{DD/MM/YYYY}).
   */
  async createAcceptanceRequest(payload: {
    projectId: string;
    note?: string;
    serviceIds?: string[];
  }): Promise<{ data?: AcceptanceItem; error?: string }> {
    const res = await apiService.post<AcceptanceItem>('/acceptance/request', {
      projectId: payload.projectId,
      note: payload.note,
      serviceIds: payload.serviceIds ?? [],
    });
    return { data: res.data, error: res.error };
  }

  async processAcceptanceRequest(
    id: string,
    decisions: AcceptanceDecision[],
  ): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/acceptance/${id}/process`, { decisions });
    return { data: res.data, error: res.error };
  }

  /** POST /acceptance/:id/approve — BOD/Admin/PM duyệt toàn bộ yêu cầu nghiệm thu. */
  async approveAcceptanceRequest(id: string): Promise<{ data?: AcceptanceItem; error?: string }> {
    const res = await apiService.post<AcceptanceItem>(`/acceptance/${id}/approve`);
    return { data: res.data, error: res.error };
  }

  /** POST /acceptance/:id/reject — Từ chối yêu cầu nghiệm thu kèm phản hồi bắt buộc. */
  async rejectAcceptanceRequest(
    id: string,
    feedback: string,
  ): Promise<{ data?: AcceptanceItem; error?: string }> {
    const res = await apiService.post<AcceptanceItem>(`/acceptance/${id}/reject`, { feedback });
    return { data: res.data, error: res.error };
  }
}

export const acceptanceService = new AcceptanceService();
