import { apiService } from './api';
import { ServiceCreationOperation } from '@/utils/serviceCreation';

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
  isBudget?: boolean;
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
  isBudget?: boolean;
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
  isBudget?: boolean;
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
  private duplicateRunning = new Set<string>();
  private duplicateOperations = new Map<string, { operation: ServiceCreationOperation; payload: ServiceCreatePayload; configs: ServiceJobConfig[] }>();
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

    if (!Array.isArray(res.data) && !(res.data && typeof res.data === 'object' && Array.isArray((res.data as { data?: unknown }).data))) {
      return { data: [], meta: buildPaginationMeta(undefined, 0, filters), error: 'Phản hồi danh sách dịch vụ không hợp lệ.' };
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

  /** Server generates the code. Retain a successful POST across configuration retries. */
  async duplicateService(service: ServiceItem): Promise<{ data?: ServiceItem; error?: string }> {
    if (this.duplicateRunning.has(service.id)) {
      return { error: 'Đang nhân bản dịch vụ, vui lòng chờ.' };
    }
    this.duplicateRunning.add(service.id);
    try {
      let pending = this.duplicateOperations.get(service.id);
      if (!pending) {
        const detail = await this.getService(service.id);
        if (detail.error || !detail.data || !Array.isArray(detail.data.serviceJobs)) {
          return { error: detail.error || 'Không tải được đầy đủ dịch vụ gốc.' };
        }
        const source = detail.data;
        const configs = (source.serviceJobs || []).map((item) => ({
          jobId: item.jobId,
          quantity: Number(item.quantity ?? 1),
          isOutput: Boolean(item.isOutput),
        }));
        pending = {
          operation: new ServiceCreationOperation(),
          configs,
          payload: {
            name: source.name + ' (Copy)',
            description: source.description ?? '',
            unit: source.unit ?? '',
            isAI: Boolean(source.isAI),
            isBudget: Boolean(source.isBudget),
            jobIds: configs.map((item) => item.jobId),
            outputJobIds: configs.filter((item) => item.isOutput).map((item) => item.jobId),
          },
        };
        this.duplicateOperations.set(service.id, pending);
      }
      const data = await pending.operation.save({
        create: async (payload) => {
          const result = await this.createService(payload);
          if (result.error) throw new Error(result.error);
          return result.data;
        },
        update: async (payload) => {
          const result = await this.updateService(payload);
          if (result.error) throw new Error(result.error);
          return result.data;
        },
      }, pending.payload, pending.configs);
      this.duplicateOperations.delete(service.id);
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Không thể nhân bản dịch vụ.' };
    } finally {
      this.duplicateRunning.delete(service.id);
    }
  }

}

export const catalogService = new CatalogService();
