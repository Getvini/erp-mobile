import { apiService } from './api';

/**
 * HẠNG MỤC CÔNG VIỆC (JOBS) + TIÊU CHÍ ĐÁNH GIÁ (JOB CRITERIA)
 */

// ============================================================================
// ENUM + NHÃN
// ============================================================================

export type JobCategory =
  | 'QUAY_PHIM'
  | 'DUNG_PHIM'
  | 'THIET_KE'
  | 'AI_CONTENT'
  | 'MARKETING'
  | 'BIEN_KICH'
  | 'KHAC';

export type JobPerformerType = 'INTERNAL' | 'VENDOR';

export const JOB_CATEGORY_LABELS: Record<string, string> = {
  QUAY_PHIM: 'Quay phim',
  DUNG_PHIM: 'Dựng phim',
  THIET_KE: 'Thiết kế',
  AI_CONTENT: 'AI Content',
  MARKETING: 'Marketing',
  BIEN_KICH: 'Biên kịch',
  KHAC: 'Khác',
};

export const JOB_CATEGORY_VALUES: JobCategory[] = [
  'QUAY_PHIM',
  'DUNG_PHIM',
  'THIET_KE',
  'AI_CONTENT',
  'MARKETING',
  'BIEN_KICH',
  'KHAC',
];

export const JOB_CATEGORY_OPTIONS: Array<{ value: JobCategory; label: string }> =
  JOB_CATEGORY_VALUES.map((value) => ({ value, label: JOB_CATEGORY_LABELS[value] }));

export const JOB_CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  QUAY_PHIM: { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  DUNG_PHIM: { color: '#7E22CE', bg: '#FAF5FF', border: '#E9D5FF' },
  THIET_KE: { color: '#BE185D', bg: '#FDF2F8', border: '#FBCFE8' },
  AI_CONTENT: { color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  MARKETING: { color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  BIEN_KICH: { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  KHAC: { color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
};

export const JOB_PERFORMER_TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Nội bộ',
  VENDOR: 'Vendor',
};

export const JOB_PERFORMER_TYPE_OPTIONS: Array<{ value: JobPerformerType; label: string }> = [
  { value: 'INTERNAL', label: JOB_PERFORMER_TYPE_LABELS.INTERNAL },
  { value: 'VENDOR', label: JOB_PERFORMER_TYPE_LABELS.VENDOR },
];

export const JOB_DUPLICATE_CODE_MESSAGE =
  'Mã hạng mục đã tồn tại, đã dùng hạng mục có sẵn';

// ============================================================================
// ENTITY
// ============================================================================

export interface JobCriteria {
  id: string;
  name: string;
  description?: string | null;
}

export interface JobCriteriaInput {
  id?: string;
  name: string;
  description?: string | null;
}

export interface JobServiceSummary {
  id: string;
  name?: string;
  code?: string | null;
  costPrice?: number | string | null;
  sellingPrice?: number | string | null;
  unit?: string | null;
  [key: string]: any;
}

export interface JobServiceLink {
  id?: string;
  serviceId?: string;
  quantity?: number | string;
  isOutput?: boolean;
  service?: JobServiceSummary | null;
  [key: string]: any;
}

export interface JobVendorSummary {
  id: string;
  name?: string;
  type?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: any;
}

export interface JobVendorLink {
  id?: string;
  price?: number | string | null;
  note?: string | null;
  updatedAt?: string;
  vendor?: JobVendorSummary | null;
  [key: string]: any;
}

export interface Job {
  id: string;
  name: string;
  code?: string | null;
  nickname?: string | null;
  costPrice?: number | string | null;
  vinicoin?: number | string | null;
  timeToComplete?: number | string | null;
  unit?: string | null;
  categories?: string[] | null;
  isBriefVideo?: boolean;
  isQuotationItem?: boolean;
  defaultPerformerType?: JobPerformerType | string | null;
  criteria?: JobCriteria[];
  serviceJobs?: JobServiceLink[];
  vendorJobs?: JobVendorLink[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface JobListFilters {
  name?: string;
  category?: string;
}

export interface CreateJobPayload {
  name: string;
  code: string;
  nickname?: string | null;
  costPrice?: number;
  vinicoin?: number | null;
  timeToComplete?: number | null;
  unit?: string | null;
  categories?: string[];
  isBriefVideo?: boolean;
  isQuotationItem?: boolean;
  defaultPerformerType?: JobPerformerType;
  criteria?: JobCriteriaInput[];
  serviceIds?: string[];
}

export type UpdateJobPayload = Partial<Omit<CreateJobPayload, 'criteria' | 'serviceIds'>> & {
  id: string;
};

// ============================================================================
// UNWRAP HELPERS — response mảng thô / object thô
// ============================================================================

const unwrapArray = <T>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload?.criteria)) return payload.criteria as T[];
  return [];
};

const unwrapObject = <T>(payload: any): T | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data as T;
  }
  return payload as T;
};

export const normalizeJobCode = (code?: string | null): string =>
  String(code ?? '')
    .trim()
    .toLowerCase();

export const findJobByCode = (jobs: Job[] | undefined, code?: string | null): Job | undefined => {
  const normalized = normalizeJobCode(code);
  if (!normalized) return undefined;
  return (jobs || []).find((job) => normalizeJobCode(job?.code) === normalized);
};

const toNullableText = (value?: string | null): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

export const toJobNumber = (value?: number | string | null): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildCriteriaBody = (criteria: JobCriteriaInput[] = [], keepIds = true): JobCriteriaInput[] =>
  criteria
    .map((item) => {
      const body: JobCriteriaInput = {
        name: String(item?.name ?? '').trim(),
        description: toNullableText(item?.description),
      };
      if (keepIds && item?.id) body.id = item.id;
      return body;
    })
    .filter((item) => item.name.length > 0);

const buildJobBody = (payload: Partial<CreateJobPayload>) => ({
  name: String(payload.name ?? '').trim(),
  code: toNullableText(payload.code),
  nickname: toNullableText(payload.nickname),
  costPrice: toJobNumber(payload.costPrice),
  vinicoin: payload.vinicoin === null || payload.vinicoin === undefined ? null : toJobNumber(payload.vinicoin),
  timeToComplete:
    payload.timeToComplete === null || payload.timeToComplete === undefined
      ? null
      : toJobNumber(payload.timeToComplete),
  unit: toNullableText(payload.unit),
  categories: Array.isArray(payload.categories) ? payload.categories : [],
  isBriefVideo: Boolean(payload.isBriefVideo),
  // Server ép false khi isBriefVideo = true ⇒ đồng bộ ngay ở client.
  isQuotationItem: payload.isBriefVideo ? false : payload.isQuotationItem !== false,
  defaultPerformerType: (payload.defaultPerformerType || 'INTERNAL') as JobPerformerType,
});

// ============================================================================
// SERVICE
// ============================================================================

class JobService {
  /** GET /jobs?name=&category= → MẢNG THÔ (relations: vendorJobs(.vendor), serviceJobs(.service), criteria). */
  async getJobs(filters: JobListFilters = {}) {
    const res = await apiService.get<any>('/jobs', {
      name: filters.name?.trim() || undefined,
      category: filters.category || undefined,
    });
    return { data: unwrapArray<Job>(res.data), error: res.error };
  }

  /** GET /jobs/:id → object + `criteria[]` + `serviceJobs[]`. */
  async getJob(id: string) {
    const res = await apiService.get<any>(`/jobs/${id}`);
    return { data: unwrapObject<Job>(res.data), error: res.error };
  }

  /**
   * POST /jobs — body Job + `criteria[]` + `serviceIds?`.
   */
  async createJob(payload: CreateJobPayload) {
    const body: Record<string, any> = buildJobBody(payload);
    body.criteria = buildCriteriaBody(payload.criteria || [], false);
    if (Array.isArray(payload.serviceIds) && payload.serviceIds.length > 0) {
      body.serviceIds = payload.serviceIds;
    }
    const res = await apiService.post<any>('/jobs', body);
    return { data: unwrapObject<Job>(res.data), error: res.error };
  }

  /** PATCH /jobs/:id — partial, KHÔNG nhận `criteria`. */
  async updateJob(id: string, payload: Partial<CreateJobPayload>) {
    const res = await apiService.patch<any>(`/jobs/${id}`, buildJobBody(payload));
    return { data: unwrapObject<Job>(res.data), error: res.error };
  }

  /** DELETE /jobs/:id */
  async deleteJob(id: string) {
    const res = await apiService.delete<any>(`/jobs/${id}`);
    return { data: res.data, error: res.error };
  }

  /** GET /job-criteria/job/:jobId → MẢNG THÔ. */
  async getJobCriterias(jobId: string) {
    const res = await apiService.get<any>(`/job-criteria/job/${jobId}`);
    return { data: unwrapArray<JobCriteria>(res.data), error: res.error };
  }

  /**
   * PUT /job-criteria/job/:jobId — body là **MẢNG TRẦN** `[{ id?, name, description }]`.
   */
  async syncJobCriterias(payload: { jobId: string; criteria: JobCriteriaInput[] }) {
    const body = buildCriteriaBody(payload.criteria, true);
    const res = await apiService.put<any>(`/job-criteria/job/${payload.jobId}`, body);
    return { data: unwrapArray<JobCriteria>(res.data), error: res.error };
  }
}

export const jobService = new JobService();

/** So sánh 2 danh sách tiêu chí để biết có cần gọi sync hay không. */
export const isJobCriteriaChanged = (
  original: JobCriteria[] | undefined,
  next: JobCriteriaInput[]
): boolean => {
  const before = (original || []).map((item) => ({
    id: item.id || '',
    name: String(item.name ?? '').trim(),
    description: String(item.description ?? '').trim(),
  }));
  const after = (next || []).map((item) => ({
    id: item.id || '',
    name: String(item.name ?? '').trim(),
    description: String(item.description ?? '').trim(),
  }));
  if (before.length !== after.length) return true;
  return before.some((item, index) => {
    const other = after[index];
    return item.id !== other.id || item.name !== other.name || item.description !== other.description;
  });
};
