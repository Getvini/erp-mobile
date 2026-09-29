import { apiService } from './api';

/**
 * Dịch vụ niêm yết (catalog service).
 *
 * ⚠️ ĐÃ ĐỐI CHIẾU BACKEND THẬT (`ERP/src/modules/service`):
 * - `GET /services` trả ENVELOPE phân trang `{ data: Service[], meta: { total, page, limit, totalPages } }`
 *   (limit mặc định 1000). Query hỗ trợ: `name`, `page`, `limit`.
 * - `GET /service-packages` trả MẢNG THÔ (xem `servicePackageService.ts`).
 * - Field entity CHÍNH XÁC: `id, code, name, description, unit, costPrice, overheadCost, isAI, serviceJobs`.
 *   KHÔNG có `sellingPrice`, `category`, `type`, `isActive`.
 * - `costPrice` do SERVER tự tính = Σ(job.costPrice × quantity) ⇒ KHÔNG gửi lên khi create/update.
 */

export interface JobReference {
  id: string;
  name?: string | null;
  code?: string | null;
  costPrice?: number | string | null;
  unit?: string | null;
}

export interface ServiceJobItem {
  id?: string;
  serviceId?: string;
  jobId: string;
  quantity?: number | string | null;
  isOutput?: boolean;
  job?: JobReference | null;
}

export interface ServiceItem {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  unit?: string | null;
  /** Server-computed — chỉ đọc. */
  costPrice?: number | string | null;
  overheadCost?: number | string | null;
  isAI?: boolean;
  serviceJobs?: ServiceJobItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceListFilters {
  name?: string;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ServiceListResult {
  data: ServiceItem[];
  meta: PaginationMeta;
  error?: string;
}

/** Body POST /services — KHÔNG có costPrice/overheadCost (server tự tính & ghi đè). */
export interface ServiceCreatePayload {
  name: string;
  code?: string;
  description?: string;
  unit?: string;
  isAI?: boolean;
  jobIds: string[];
  outputJobIds: string[];
}

/** Nhánh PATCH thông tin cơ bản. */
export interface ServiceBasicInfoPayload {
  name?: string;
  code?: string;
  description?: string;
  unit?: string;
  isAI?: boolean;
}

/** Nhánh PATCH cấu hình hạng mục (full-replace toàn bộ serviceJobs). */
export interface ServiceJobConfig {
  jobId: string;
  quantity: number;
  isOutput: boolean;
}

export interface ServiceUpdatePayload extends ServiceBasicInfoPayload {
  jobConfigs?: ServiceJobConfig[];
}

const DEFAULT_PAGE_LIMIT = 1000;

function buildPaginationMeta(
  rawMeta: unknown,
  dataLength: number,
  filters: ServiceListFilters,
): PaginationMeta {
  const page = Number(filters.page) || 1;
  const meta = (rawMeta && typeof rawMeta === 'object' ? rawMeta : {}) as Record<string, unknown>;
  const total = Number(meta.total);
  const limit = Number(meta.limit) || Number(filters.limit) || DEFAULT_PAGE_LIMIT;
  const totalPages = Number(meta.totalPages);

  const safeTotal = Number.isFinite(total) ? total : dataLength;
  return {
    total: safeTotal,
    page: Number(meta.page) || page,
    limit,
    totalPages: Number.isFinite(totalPages) ? totalPages : Math.max(1, Math.ceil(safeTotal / limit)),
  };
}

/**
 * Chuẩn hóa `GET /services` — phòng thủ CẢ 2 dạng:
 * 1. Envelope phân trang thật: `{ data: Service[], meta: {...} }`
 * 2. Mảng thô legacy (hoặc response bị bọc `{ data: [...] }` không meta).
 */
export function normalizeServiceListResponse(
  response: unknown,
  filters: ServiceListFilters = {},
): { data: ServiceItem[]; meta: PaginationMeta } {
  if (Array.isArray(response)) {
    return {
      data: response as ServiceItem[],
      meta: buildPaginationMeta(undefined, response.length, filters),
    };
  }

  if (response && typeof response === 'object') {
    const body = response as { data?: unknown; meta?: unknown };
    if (Array.isArray(body.data)) {
      return {
        data: body.data as ServiceItem[],
        meta: buildPaginationMeta(body.meta, body.data.length, filters),
      };
    }
  }

  return {
    data: [],
    meta: buildPaginationMeta(undefined, 0, filters),
  };
}

/** Phòng thủ: một số endpoint có thể bọc entity trong `{ data: entity }`. */
export function unwrapServiceEntity(response: unknown): ServiceItem | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const body = response as { data?: unknown; id?: unknown };
  if (body.id) return response as ServiceItem;
  if (body.data && typeof body.data === 'object') return body.data as ServiceItem;
  return undefined;
}

class CatalogService {
  async getServices(
    filters: ServiceListFilters = {},
  ): Promise<{ data: ServiceItem[]; meta: PaginationMeta; error?: string }> {
    const params: Record<string, string | number> = {};
    if (filters.name) params.name = filters.name;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    const res = await apiService.get<unknown>(
      '/services',
      Object.keys(params).length > 0 ? params : undefined,
    );

    if (res.error) {
      return { data: [], meta: buildPaginationMeta(undefined, 0, filters), error: res.error };
    }

    return normalizeServiceListResponse(res.data, filters);
  }

  async getService(id: string): Promise<{ data?: ServiceItem; error?: string }> {
    const res = await apiService.get<unknown>(`/services/${id}`);
    if (res.error) return { error: res.error };
    return { data: unwrapServiceEntity(res.data) };
  }

  async createService(
    payload: ServiceCreatePayload,
  ): Promise<{ data?: ServiceItem; error?: string }> {
    const res = await apiService.post<unknown>('/services', payload);
    if (res.error) return { error: res.error };
    return { data: unwrapServiceEntity(res.data) };
  }

  /**
   * PATCH `/services/${id}` — gửi nhánh thông tin cơ bản HOẶC nhánh `jobConfigs`
   * (jobConfigs là full-replace: backend xóa hết ServiceJob cũ rồi tạo lại).
   */
  async updateService({
    id,
    ...payload
  }: { id: string } & ServiceUpdatePayload): Promise<{ data?: ServiceItem; error?: string }> {
    const res = await apiService.patch<unknown>(`/services/${id}`, payload);
    if (res.error) return { error: res.error };
    return { data: unwrapServiceEntity(res.data) };
  }

  /**
   * Xóa hàng loạt — DELETE kèm BODY `{ ids }` (ADMIN/BOD).
   * `apiService.delete` không hỗ trợ body nên gọi thẳng `request`.
   */
  async bulkDeleteServices(ids: string[]): Promise<{ data?: unknown; error?: string }> {
    const res = await apiService.request<unknown>('/services/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
    if (res.error) return { error: res.error };
    return { data: res.data };
  }

  async deleteService(id: string): Promise<{ data?: unknown; error?: string }> {
    const res = await apiService.delete<unknown>(`/services/${id}`);
    if (res.error) return { error: res.error };
    return { data: res.data };
  }

  /** POST `/services/${id}/jobs/${jobId}` — KHÔNG body; trả FULL Service. */
  async addServiceJob({
    id,
    jobId,
  }: {
    id: string;
    jobId: string;
  }): Promise<{ data?: ServiceItem; error?: string }> {
    const res = await apiService.post<unknown>(`/services/${id}/jobs/${jobId}`);
    if (res.error) return { error: res.error };
    return { data: unwrapServiceEntity(res.data) };
  }

  /** DELETE `/services/${id}/jobs/${jobId}` — trả FULL Service. */
  async removeServiceJob({
    id,
    jobId,
  }: {
    id: string;
    jobId: string;
  }): Promise<{ data?: ServiceItem; error?: string }> {
    const res = await apiService.delete<unknown>(`/services/${id}/jobs/${jobId}`);
    if (res.error) return { error: res.error };
    return { data: unwrapServiceEntity(res.data) };
  }

  /**
   * Nhân bản dịch vụ: POST `/services` với toàn bộ field + jobIds + outputJobIds.
   *
   * ⚠️ Backend chặn trùng `code` (không phân biệt hoa/thường). Web giữ nguyên `code` gốc nên
   * luôn nhận lỗi "Mã dịch vụ đã tồn tại" — Mobile sinh mã duy nhất (`-COPY`, `-COPY2`, ...)
   * để nút Nhân bản dùng được ngay, đồng thời không ghi đè dịch vụ đang có.
   *
   * @param existingCodes danh sách `code` hiện có (thường lấy từ `useServicesQuery().data`)
   *   để tránh trùng khi đã có bản sao trước đó.
   */
  async duplicateService(
    service: ServiceItem,
    existingCodes: Array<string | null | undefined> = [],
  ): Promise<{ data?: ServiceItem; error?: string }> {
    const serviceJobs = Array.isArray(service.serviceJobs) ? service.serviceJobs : [];
    const jobIds = serviceJobs.map((serviceJob) => serviceJob.jobId).filter(Boolean);
    const outputJobIds = serviceJobs
      .filter((serviceJob) => serviceJob.isOutput)
      .map((serviceJob) => serviceJob.jobId)
      .filter(Boolean);

    return this.createService({
      name: `${service.name} (Copy)`,
      code: buildUniqueServiceCode(service.code, existingCodes),
      description: service.description ?? undefined,
      unit: service.unit ?? undefined,
      isAI: Boolean(service.isAI),
      jobIds,
      outputJobIds,
    });
  }
}

/**
 * Sinh `code` duy nhất cho bản sao dịch vụ: `<code>-COPY`, `<code>-COPY2`, `<code>-COPY3`, ...
 * So khớp KHÔNG phân biệt hoa/thường và đã trim (đúng như backend `LOWER(TRIM(code))`).
 * Trả `undefined` khi dịch vụ gốc không có `code` (để backend tự xử lý).
 */
export function buildUniqueServiceCode(
  baseCode: string | null | undefined,
  existingCodes: Array<string | null | undefined> = [],
): string | undefined {
  const base = (baseCode ?? '').trim();
  if (!base) return undefined;

  const taken = new Set(
    (existingCodes ?? [])
      .map((code) => (code ?? '').trim().toLowerCase())
      .filter(Boolean),
  );

  let candidate = `${base}-COPY`;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}-COPY${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export const catalogService = new CatalogService();
