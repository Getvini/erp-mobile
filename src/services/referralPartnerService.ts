import { apiService } from './api';

/**
 * Referral Partner (Đối tác giới thiệu / CTV)
 */

export type ReferralPartnerType = 'BUSINESS' | 'INDIVIDUAL';

export interface ReferralPartnerOpportunity {
  id: string;
  name: string;
  opportunityCode?: string | null;
  status?: string | null;
  expectedRevenue?: number | string | null;
  createdAt?: string | null;
}

export interface ReferralPartnerCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  taxId?: string | null;
  address?: string | null;
}

export interface ReferralPartnerContract {
  id: string;
  contractCode?: string | null;
  name?: string | null;
  sellingPrice?: number | string | null;
  totalWithVat?: number | string | null;
  signedDate?: string | null;
  status?: string | null;
  partnerCommission?: number | string | null;
  partnerCommissionRate?: number | string | null;
  partnerCommissionStatus?: string | null;
  partnerCommissionPaidAt?: string | null;
}

export interface ReferralPartnerItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  type?: ReferralPartnerType | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  customers?: ReferralPartnerCustomer[] | null;
  opportunities?: ReferralPartnerOpportunity[] | null;
  contracts?: ReferralPartnerContract[] | null;
}

/** Body POST/PUT — backend validate đúng 6 field này. */
export interface ReferralPartnerPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  type: ReferralPartnerType;
}

export interface ReferralPartnerUpdateInput extends ReferralPartnerPayload {
  id: string;
}

/** Object CHÍNH XÁC 8 field từ GET /referral-partners/:id/statistics. */
export interface ReferralPartnerStatistics {
  partnerId: string;
  partnerName: string;
  totalCustomers: number;
  totalOpportunities: number;
  totalContracts: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
}

export interface ReferralPartnerListFilters {
  search?: string;
  type?: string;
}

/**
 * Backend trả mảng thô, nhưng vẫn phòng thủ trường hợp bọc `{ data: [...] }`
 * để không vỡ UI nếu tầng response thay đổi.
 */
function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const nested = (payload as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(nested) ? (nested as T[]) : [];
}

/**
 * Backend dùng cột NOT NULL cho name/phone/address/email → gửi chuỗi rỗng
 * thay vì null/undefined để tránh lỗi 500 khi tạo/cập nhật.
 */
function toRequestBody(payload: ReferralPartnerPayload) {
  return {
    name: payload.name.trim(),
    email: payload.email?.trim() ?? '',
    phone: payload.phone?.trim() ?? '',
    address: payload.address?.trim() ?? '',
    taxId: payload.taxId?.trim() ?? '',
    type: payload.type,
  };
}

class ReferralPartnerService {
  /** GET /referral-partners — mảng thô kèm relations, order createdAt DESC. */
  async getReferralPartners(): Promise<{ data?: ReferralPartnerItem[]; error?: string }> {
    const res = await apiService.get<ReferralPartnerItem[] | { data?: ReferralPartnerItem[] }>(
      '/referral-partners',
    );
    if (res.error) return { error: res.error };
    return { data: normalizeList<ReferralPartnerItem>(res.data) };
  }

  /** GET /referral-partners/:id — object + 3 relations (customers/opportunities/contracts). */
  async getReferralPartner(id: string): Promise<{ data?: ReferralPartnerItem; error?: string }> {
    const res = await apiService.get<ReferralPartnerItem>(`/referral-partners/${id}`);
    if (res.error) return { error: res.error };
    return { data: res.data };
  }

  /** GET /referral-partners/:id/statistics — object 8 field. */
  async getReferralPartnerStatistics(
    id: string,
  ): Promise<{ data?: ReferralPartnerStatistics; error?: string }> {
    const res = await apiService.get<ReferralPartnerStatistics>(
      `/referral-partners/${id}/statistics`,
    );
    if (res.error) return { error: res.error };
    return { data: res.data };
  }

  /** POST /referral-partners — name bắt buộc, type = BUSINESS | INDIVIDUAL. */
  async createReferralPartner(
    payload: ReferralPartnerPayload,
  ): Promise<{ data?: ReferralPartnerItem; error?: string }> {
    const res = await apiService.post<ReferralPartnerItem>('/referral-partners', toRequestBody(payload));
    if (res.error) return { error: res.error };
    return { data: res.data };
  }

  /** PUT /referral-partners/:id — body ĐỦ 6 field (backend validate toàn bộ). */
  async updateReferralPartner(
    input: ReferralPartnerUpdateInput,
  ): Promise<{ data?: ReferralPartnerItem; error?: string }> {
    const { id, ...payload } = input;
    const res = await apiService.put<ReferralPartnerItem>(
      `/referral-partners/${id}`,
      toRequestBody(payload),
    );
    if (res.error) return { error: res.error };
    return { data: res.data };
  }

  /** DELETE /referral-partners/:id — trả 500 nếu còn dữ liệu liên quan. */
  async deleteReferralPartner(
    id: string,
  ): Promise<{ data?: { message?: string }; error?: string }> {
    const res = await apiService.delete<{ message?: string }>(`/referral-partners/${id}`);
    if (res.error) return { error: res.error };
    return { data: res.data };
  }
}

export const referralPartnerService = new ReferralPartnerService();
