import { apiService } from './api';
import type { ServiceItem } from './catalogService';

/**
 * Gói dịch vụ niêm yết (service package).
*/

export interface ServicePackageItem {
  id: string;
  serviceId: string;
  defaultQuantity: number | string;
  service?: ServiceItem | null;
}

export interface ServicePackage {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  /** Server-computed — chỉ đọc. */
  price?: number | string | null;
  items?: ServicePackageItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ServicePackageItemPayload {
  serviceId: string;
  defaultQuantity: number;
}

export interface ServicePackageCreatePayload {
  name: string;
  description?: string;
  items: ServicePackageItemPayload[];
}

export interface ServicePackageUpdatePayload {
  name?: string;
  description?: string;
  isActive?: boolean;
  items?: ServicePackageItemPayload[];
}

/** Phòng thủ: chấp nhận cả mảng thô lẫn `{ data: [...] }`. */
export function normalizeServicePackageList(response: unknown): ServicePackage[] {
  if (Array.isArray(response)) return response as ServicePackage[];

  if (response && typeof response === 'object') {
    const body = response as { data?: unknown };
    if (Array.isArray(body.data)) return body.data as ServicePackage[];
  }

  return [];
}

export function unwrapServicePackageEntity(response: unknown): ServicePackage | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const body = response as { data?: unknown; id?: unknown };
  if (body.id) return response as ServicePackage;
  if (body.data && typeof body.data === 'object') return body.data as ServicePackage;
  return undefined;
}

class ServicePackageService {
  async getServicePackages(): Promise<{ data: ServicePackage[]; error?: string }> {
    const res = await apiService.get<unknown>('/service-packages');
    if (res.error) return { data: [], error: res.error };
    return { data: normalizeServicePackageList(res.data) };
  }

  async getServicePackage(id: string): Promise<{ data?: ServicePackage; error?: string }> {
    const res = await apiService.get<unknown>(`/service-packages/${id}`);
    if (res.error) return { error: res.error };
    return { data: unwrapServicePackageEntity(res.data) };
  }

  async createServicePackage(
    payload: ServicePackageCreatePayload,
  ): Promise<{ data?: ServicePackage; error?: string }> {
    const res = await apiService.post<unknown>('/service-packages', payload);
    if (res.error) return { error: res.error };
    return { data: unwrapServicePackageEntity(res.data) };
  }

  /** PUT (KHÔNG phải PATCH) — full replace items. */
  async updateServicePackage({
    id,
    ...payload
  }: { id: string } & ServicePackageUpdatePayload): Promise<{
    data?: ServicePackage;
    error?: string;
  }> {
    const res = await apiService.put<unknown>(`/service-packages/${id}`, payload);
    if (res.error) return { error: res.error };
    return { data: unwrapServicePackageEntity(res.data) };
  }

  /** Soft delete — backend set `isActive = false`. */
  async deleteServicePackage(id: string): Promise<{ data?: unknown; error?: string }> {
    const res = await apiService.delete<unknown>(`/service-packages/${id}`);
    if (res.error) return { error: res.error };
    return { data: res.data };
  }
}

export const servicePackageService = new ServicePackageService();
