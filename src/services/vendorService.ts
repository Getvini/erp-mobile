import { apiService } from './api';

/**
 * ============================================================================
 * NHÀ CUNG CẤP (Vendors) — P2
 * ----------------------------------------------------------------------------
 * Đối chiếu backend thật: ERP/src/modules/vendor/routes/Vendor.Route.ts
 *   GET    /vendors                      → MẢNG THÔ (không `{data, meta}`, không phân trang)
 *   GET    /vendors/by-job/:jobId        → MẢNG THÔ vendor unique
 *   GET    /vendors/:id                  → object + vendorJobs[].job (404 khi không thấy)
 *   POST   /vendors                      → tạo mới
 *   PATCH  /vendors/:id                  → cập nhật
 *   DELETE /vendors/:id                  → xoá
 *   GET    /vendors/:id/jobs             → MẢNG THÔ VendorJob + relation `job`
 *   POST   /vendors/:id/jobs/:jobId      → upsert phân công hạng mục
 *   PATCH  /vendors/:id/jobs/:jobId      → backend map CÙNG handler ⇒ cũng upsert
 *   DELETE /vendors/:id/jobs/:jobId      → gỡ phân công
 *
 * ⚠️ `GET /vendors/:id/statistics` KHÔNG tồn tại ở backend ⇒ không implement.
 * ⚠️ Mọi response danh sách là mảng thô của Express ⇒ luôn phòng thủ bằng
 *    `Array.isArray(d) ? d : (d?.data || [])`.
 * ============================================================================
 */

/** Giá trị `type` hợp lệ gửi lên API (mirror `PartnerType` trong Vendor.entity.ts). */
export type VendorType = 'BUSINESS' | 'INDIVIDUAL' | 'KOL' | 'KOC';

export const VENDOR_TYPES: VendorType[] = ['BUSINESS', 'INDIVIDUAL', 'KOL', 'KOC'];

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  BUSINESS: 'Doanh nghiệp',
  INDIVIDUAL: 'Cá nhân',
  KOL: 'KOL',
  KOC: 'KOC',
};

/** Nhóm loại nhà cung cấp dùng CCCD (9 hoặc 12 số) thay cho MST doanh nghiệp. */
export const ID_CARD_VENDOR_TYPES: VendorType[] = ['INDIVIDUAL', 'KOL', 'KOC'];

/** Thư mục Cloudinary chuẩn cho ảnh CCCD nhà cung cấp. */
export const VENDOR_UPLOAD_FOLDER = 'GETVINI/ERP/vendor';

/** SĐT: mirror `phoneRegex` trong ERP/.../vendor/validations/Partner.Validation.ts */
export const VENDOR_PHONE_REGEX = /^\+?[0-9]{10,15}$/;

/** CCCD/CMND: 9 hoặc 12 chữ số. */
export const ID_CARD_REGEX = /^(\d{9}|\d{12})$/;

/** MST doanh nghiệp: 10 chữ số HOẶC 13 ký tự dạng XXXXXXXXXX-XXX. */
export const VENDOR_TAX_ID_REGEX = /^\d{10}(\s?-\s?\d{3})?$/;

/** Loại NCC có dùng CCCD hay không. */
export const requiresIdCard = (type?: string): boolean =>
  ID_CARD_VENDOR_TYPES.includes(type as VendorType);

/**
 * Kiểm tra MST/CCCD theo đúng nhánh mà backend dùng (`validatePartnerData`).
 * Trường để trống được coi là hợp lệ vì MST/CCCD là tuỳ chọn.
 */
export const isValidVendorIdentifier = (value?: string | null, type?: string): boolean => {
  const taxId = (value ?? '').trim();
  if (!taxId) return true;
  return requiresIdCard(type) ? ID_CARD_REGEX.test(taxId) : VENDOR_TAX_ID_REGEX.test(taxId);
};

/** Thông báo lỗi MST/CCCD tương ứng từng loại nhà cung cấp. */
export const getVendorIdentifierError = (type?: string): string =>
  requiresIdCard(type)
    ? 'CCCD/CMND phải gồm 9 hoặc 12 chữ số.'
    : 'Mã số thuế phải gồm 10 chữ số hoặc dạng 0101234567-001.';

export interface VendorJobRelation {
  id: string;
  code?: string | null;
  name?: string | null;
  nickname?: string | null;
  unit?: string | null;
  costPrice?: number | string | null;
}

export interface VendorJobItem {
  id: string;
  vendorId?: string;
  jobId?: string;
  price?: number | string | null;
  note?: string | null;
  job?: VendorJobRelation | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  type?: VendorType | string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  idCardFront?: string | null;
  idCardBack?: string | null;
  createdAt?: string;
  updatedAt?: string;
  vendorJobs?: VendorJobItem[] | null;
}

/**
 * Payload ghi nhà cung cấp. `name/phone/address/email` là NOT NULL ở backend
 * ⇒ luôn được service chuẩn hoá thành chuỗi (dùng `''` thay vì bỏ field).
 */
export interface VendorWritePayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  type?: VendorType;
  bankName?: string;
  bankAccount?: string;
  idCardFront?: string;
  idCardBack?: string;
}

export interface CreateVendorPayload extends VendorWritePayload {
  name: string;
}

export interface UpdateVendorPayload extends VendorWritePayload {
  id: string;
}

export interface VendorJobPayload {
  price: number;
  note?: string;
}

export interface UpsertVendorJobPayload extends VendorJobPayload {
  id: string;
  jobId: string;
}

export interface VendorListFilters {
  /** ⚠️ Backend BỎ QUA query param ⇒ lọc client-side; chỉ dùng làm khoá cache. */
  search?: string;
}

type ApiResult<T> = { data?: T; error?: string };

/** Phòng thủ response mảng thô: `d` | `d.data` | `[]`. */
export const normalizeVendorList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
};

/** 4 trường NOT NULL của entity Vendors ⇒ luôn gửi chuỗi. */
const toRequiredString = (value?: string | null): string => (value ?? '').toString();

/** Các trường nullable nhưng vẫn gửi chuỗi rỗng để payload luôn có đủ 10 khoá. */
const toOptionalString = (value?: string | null): string => (value ?? '').toString();

class VendorService {
  /** GET /vendors → mảng thô kèm `vendorJobs[]`. */
  async getVendors(): Promise<{ data: VendorItem[]; error?: string }> {
    const res = await apiService.get<VendorItem[]>('/vendors');
    return { data: normalizeVendorList<VendorItem>(res.data), error: res.error };
  }

  /** GET /vendors/by-job/:jobId → mảng thô vendor unique. */
  async getVendorsByJob(jobId: string): Promise<{ data: VendorItem[]; error?: string }> {
    const res = await apiService.get<VendorItem[]>(`/vendors/by-job/${jobId}`);
    return { data: normalizeVendorList<VendorItem>(res.data), error: res.error };
  }

  /** GET /vendors/:id → object + `vendorJobs[].job` (backend trả 404 nếu không thấy). */
  async getVendor(id: string): Promise<{ data?: VendorItem; error?: string }> {
    const res = await apiService.get<VendorItem>(`/vendors/${id}`);
    return { data: res.data, error: res.error };
  }

  /**
   * POST /vendors — luôn gửi đủ 10 khoá dạng chuỗi.
   * `name/phone/address/email` NOT NULL ⇒ gửi `''` thay vì bỏ field (tránh 400).
   */
  async createVendor(payload: CreateVendorPayload): Promise<ApiResult<VendorItem>> {
    const body = {
      name: toRequiredString(payload.name),
      email: toRequiredString(payload.email),
      phone: toRequiredString(payload.phone),
      address: toRequiredString(payload.address),
      taxId: toOptionalString(payload.taxId),
      type: payload.type ?? 'BUSINESS',
      bankName: toOptionalString(payload.bankName),
      bankAccount: toOptionalString(payload.bankAccount),
      idCardFront: toOptionalString(payload.idCardFront),
      idCardBack: toOptionalString(payload.idCardBack),
    };
    const res = await apiService.post<VendorItem>('/vendors', body);
    return { data: res.data, error: res.error };
  }

  /**
   * PATCH /vendors/:id.
   * ⚠️ BẮT BUỘC gửi kèm `type` mỗi khi gửi `taxId` — nếu thiếu, backend xử như
   * BUSINESS và MST/CCCD sẽ bị 400. Vì vậy `type` luôn được chèn vào body.
   */
  async updateVendor({ id, ...payload }: UpdateVendorPayload): Promise<ApiResult<VendorItem>> {
    const body: Record<string, unknown> = {
      ...payload,
      type: payload.type ?? 'BUSINESS',
    };
    const res = await apiService.patch<VendorItem>(`/vendors/${id}`, body);
    return { data: res.data, error: res.error };
  }

  /** DELETE /vendors/:id */
  async deleteVendor(id: string): Promise<{ data?: { message: string }; error?: string }> {
    const res = await apiService.delete<{ message: string }>(`/vendors/${id}`);
    return { data: res.data, error: res.error };
  }

  /** GET /vendors/:id/jobs → mảng thô VendorJob + relation `job`. */
  async getVendorJobs(id: string): Promise<{ data: VendorJobItem[]; error?: string }> {
    const res = await apiService.get<VendorJobItem[]>(`/vendors/${id}/jobs`);
    return { data: normalizeVendorList<VendorJobItem>(res.data), error: res.error };
  }

  /** POST /vendors/:id/jobs/:jobId — upsert phân công hạng mục. */
  async upsertVendorJob({ id, jobId, price, note }: UpsertVendorJobPayload): Promise<ApiResult<VendorJobItem>> {
    const res = await apiService.post<VendorJobItem>(`/vendors/${id}/jobs/${jobId}`, buildJobBody(price, note));
    return { data: res.data, error: res.error };
  }

  /**
   * PATCH /vendors/:id/jobs/:jobId — backend map CÙNG handler với POST nên cũng upsert.
   * Giữ lại để tương thích API Web (`VendorService.updateVendorJob`).
   */
  async updateVendorJob({ id, jobId, price, note }: UpsertVendorJobPayload): Promise<ApiResult<VendorJobItem>> {
    const res = await apiService.patch<VendorJobItem>(`/vendors/${id}/jobs/${jobId}`, buildJobBody(price, note));
    return { data: res.data, error: res.error };
  }

  /** DELETE /vendors/:id/jobs/:jobId */
  async removeVendorJob({
    id,
    jobId,
  }: {
    id: string;
    jobId: string;
  }): Promise<{ data?: { message: string }; error?: string }> {
    const res = await apiService.delete<{ message: string }>(`/vendors/${id}/jobs/${jobId}`);
    return { data: res.data, error: res.error };
  }
}

/** Body upsert: `{ price: number, note?: string }` — chỉ gửi `note` khi được cung cấp. */
const buildJobBody = (price: number, note?: string): { price: number; note?: string } => {
  const body: { price: number; note?: string } = { price: Number(price) || 0 };
  if (note !== undefined) body.note = note;
  return body;
};

export const vendorService = new VendorService();

export default vendorService;
