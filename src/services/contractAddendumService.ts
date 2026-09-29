import { apiService } from './api';

/**
 * PHỤ LỤC HỢP ĐỒNG (CONTRACT ADDENDUM)
 *
 * ⚠️ ĐÃ ĐỐI CHIẾU BACKEND THẬT — `ERP/src/modules/contract-addendum/routes/ContractAddendum.Route.ts`
 * chỉ expose 9 route POST. `GET /contract-addendums` và `GET /contract-addendums/:id` mà
 * `erp-UI/src/api/contractAddendums.js` khai báo **KHÔNG tồn tại** (404).
 * ⇒ Danh sách/chi tiết phụ lục lấy từ quan hệ `contract.addendums` của `GET /contracts/:id`
 *   (Contract.Service.ts relations có `addendums`) — đúng như ContractDetailPage.jsx:233.
 */

export enum AddendumStatus {
  DRAFT = 'DRAFT',
  SIGNED = 'SIGNED',
  CANCELLED = 'CANCELLED',
  PENDING_SALE = 'PENDING_SALE',
  SALE_REJECTED = 'SALE_REJECTED',
  PENDING_BOD = 'PENDING_BOD',
  BOD_REJECTED = 'BOD_REJECTED',
  APPROVED = 'APPROVED',
}

export enum AddendumType {
  MANUAL = 'MANUAL',
  MONTHLY_TASKS = 'MONTHLY_TASKS',
  ADD_SERVICES = 'ADD_SERVICES',
}

export const ADDENDUM_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  SIGNED: 'Đã ký',
  CANCELLED: 'Đã hủy',
  PENDING_SALE: 'Chờ Sale duyệt',
  SALE_REJECTED: 'Sale từ chối',
  PENDING_BOD: 'Chờ BOD duyệt',
  BOD_REJECTED: 'BOD từ chối',
  APPROVED: 'Đã duyệt',
};

/** Bảng màu badge 1:1 với erp-UI/src/pages/Contracts/ContractAddendums.jsx:13-39. */
export const ADDENDUM_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  DRAFT: { text: 'Nháp', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  SIGNED: { text: 'Đã ký', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  CANCELLED: { text: 'Đã hủy', color: '#64748B', bg: '#F3F4F6', border: '#E5E7EB' },
  PENDING_SALE: { text: 'Chờ Sale duyệt', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  SALE_REJECTED: { text: 'Sale từ chối', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  PENDING_BOD: { text: 'Chờ BOD duyệt', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  BOD_REJECTED: { text: 'BOD từ chối', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  APPROVED: { text: 'Đã duyệt', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
};

export const ADDENDUM_TYPE_LABELS: Record<string, string> = {
  MANUAL: 'Thủ công',
  MONTHLY_TASKS: 'Công việc tháng mới',
  ADD_SERVICES: 'Bổ sung dịch vụ',
};

/** VAT danh nghĩa dùng để hiển thị thành tiền phụ lục (ContractAddendums.jsx:61-81). */
export const ADDENDUM_VAT_RATE = 0.08;

export interface AddendumServiceLine {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  /** Giá bán — CHỈ làm tròn giá bán (Math.round), KHÔNG làm tròn VAT/thành tiền. */
  sellingPrice: number;
  cost?: number;
  quantity?: number;
  packageKey?: string | null;
  packageName?: string | null;
  packageQuantity?: number;
  isPackageService?: boolean;
  description?: string;
  unit?: string;
  [key: string]: any;
}

export interface AddendumMilestoneLine {
  name: string;
  percentage: number;
  amount: number;
  dueDate?: string;
}

export interface ContractAddendum {
  id: string;
  name?: string;
  code?: string;
  description?: string;
  status: AddendumStatus | string;
  type?: AddendumType | string;
  monthKey?: string;
  sellingPrice?: number;
  cost?: number;
  vat?: number;
  totalWithVat?: number;
  signed_contract?: string;
  saleReviewNote?: string;
  bodReviewNote?: string;
  services?: AddendumServiceLine[];
  milestones?: AddendumMilestoneLine[];
  selectedItems?: AddendumServiceLine[];
  contract?: { id: string; contractCode?: string; name?: string };
  project?: { id: string; name?: string };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface CreateAddendumPayload {
  contractId: string;
  name: string;
  description?: string;
}

/** Chỉ `bod-approve` bọc kết quả trong `{ message, addendum, createdTasks }`. */
const unwrap = (result: any): ContractAddendum => result?.addendum || result;

class ContractAddendumService {
  /**
   * Danh sách phụ lục của một hợp đồng — đọc từ `contract.addendums`
   * (KHÔNG dùng GET /contract-addendums vì backend không có route này).
   */
  async getContractAddendums(contractId: string) {
    const res = await apiService.get<any>(`/contracts/${contractId}`);
    const contract = res.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data;
    const addendums: ContractAddendum[] = Array.isArray(contract?.addendums)
      ? contract.addendums
      : [];
    return { data: addendums, contract, error: res.error };
  }

  /** POST /contract-addendums — body `{ contractId, name, description? }`. */
  async createContractAddendum(payload: CreateAddendumPayload) {
    const res = await apiService.post<any>('/contract-addendums', payload);
    return { data: unwrap(res.data), error: res.error };
  }

  /**
   * POST /contract-addendums/:id/items
   * body `{ services: [{ serviceId, serviceName, sellingPrice }], milestones: [...] }`.
   */
  async addAddendumItems(payload: {
    id: string;
    services: AddendumServiceLine[];
    milestones?: AddendumMilestoneLine[];
  }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/items`, {
      services: payload.services,
      milestones: payload.milestones ?? [],
    });
    return { data: unwrap(res.data), error: res.error };
  }

  /** POST /contract-addendums/:id/upload-signed — `file` là metadata Cloudinary `{url,name,format}`. */
  async uploadSignedAddendum(payload: { id: string; file: any }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/upload-signed`, {
      file: payload.file,
    });
    return { data: unwrap(res.data), error: res.error };
  }

  /** POST /contract-addendums/:id/scale-down — body `{ cancelServiceIds, refundAmount }`. */
  async scaleDownAddendum(payload: {
    id: string;
    cancelServiceIds: string[];
    refundAmount: number;
  }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/scale-down`, {
      cancelServiceIds: payload.cancelServiceIds,
      refundAmount: payload.refundAmount,
    });
    return { data: unwrap(res.data), error: res.error };
  }

  /**
   * POST /contract-addendums/:id/sale-approve — BD/ADMIN, chỉ khi PENDING_SALE.
   * `selectedItems` PHẢI giữ nguyên độ dài và thứ tự serviceId so với DB.
   */
  async saleApproveAddendum(payload: {
    id: string;
    selectedItems: AddendumServiceLine[];
    note?: string;
  }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/sale-approve`, {
      note: payload.note,
      selectedItems: payload.selectedItems,
    });
    return { data: unwrap(res.data), error: res.error };
  }

  /** POST /contract-addendums/:id/sale-reject — BD/ADMIN, lý do bắt buộc ở UI. */
  async saleRejectAddendum(payload: { id: string; note: string }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/sale-reject`, {
      note: payload.note,
    });
    return { data: unwrap(res.data), error: res.error };
  }

  /**
   * POST /contract-addendums/:id/resubmit — PM/ADMIN, chỉ khi SALE_REJECTED | BOD_REJECTED.
   * Backend chỉ đọc `{ selectedItems, name, description }` — KHÔNG gửi `note`.
   */
  async resubmitAddendum(payload: {
    id: string;
    selectedItems?: AddendumServiceLine[];
    name?: string;
    description?: string;
  }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/resubmit`, {
      selectedItems: payload.selectedItems,
      name: payload.name,
      description: payload.description,
    });
    return { data: unwrap(res.data), error: res.error };
  }

  /** POST /contract-addendums/:id/bod-approve — BOD/ADMIN, chỉ khi PENDING_BOD. */
  async bodApproveAddendum(payload: { id: string; note?: string }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/bod-approve`, {
      note: payload.note,
    });
    return { data: unwrap(res.data), error: res.error };
  }

  /** POST /contract-addendums/:id/bod-reject — BOD/ADMIN, lý do bắt buộc ở UI. */
  async bodRejectAddendum(payload: { id: string; note: string }) {
    const res = await apiService.post<any>(`/contract-addendums/${payload.id}/bod-reject`, {
      note: payload.note,
    });
    return { data: unwrap(res.data), error: res.error };
  }
}

export const contractAddendumService = new ContractAddendumService();

// ---------------------------------------------------------------------------
// RBAC — mirror erp-UI/src/pages/Contracts/ContractAddendums.jsx:226-228, 385-389
// ---------------------------------------------------------------------------

export const isSaleReviewer = (role?: string): boolean =>
  role === 'BD' || role === 'ADMIN';

export const isBodReviewer = (role?: string): boolean =>
  role === 'BOD' || role === 'ADMIN';

export const isPmOrAdmin = (role?: string): boolean => role === 'PM' || role === 'ADMIN';

export const canSaleReviewAddendum = (role: string | undefined, status?: string): boolean =>
  isSaleReviewer(role) && status === AddendumStatus.PENDING_SALE;

export const canBodReviewAddendum = (role: string | undefined, status?: string): boolean =>
  isBodReviewer(role) && status === AddendumStatus.PENDING_BOD;

export const canResubmitAddendum = (role: string | undefined, status?: string): boolean =>
  isPmOrAdmin(role) &&
  (status === AddendumStatus.SALE_REJECTED || status === AddendumStatus.BOD_REJECTED);

/** Cho phép sửa đơn giá khi đang Sale duyệt hoặc gửi lại. */
export const canEditAddendumPrices = (role: string | undefined, status?: string): boolean =>
  canSaleReviewAddendum(role, status) || canResubmitAddendum(role, status);

/** Giá đề xuất = cost / 0.6 (lợi nhuận 40%) — ContractAddendums.jsx:779-822. */
export const getAddendumRecommendedPrice = (cost: number): number =>
  Math.round(Number(cost || 0) / 0.6);

/** Giá tối thiểu = cost / 0.8 (lợi nhuận 20%). */
export const getAddendumMinimumPrice = (cost: number): number =>
  Math.round(Number(cost || 0) / 0.8);

/** Làm tròn lên bội số 10.000đ — roundToTenThousands (ContractAddendums.jsx:49-56). */
export const roundToTenThousands = (value: number): number =>
  Math.ceil(Number(value || 0) / 10000) * 10000;

export interface AddendumLineTotals {
  lineSellingPrice: number;
  lineCost: number;
  /** VAT hiển thị = sellingPrice * qty * 8% — KHÔNG làm tròn. */
  lineVat: number;
  /** Thành tiền = sellingPrice * qty * 1.08 — KHÔNG làm tròn. */
  lineTotalWithVat: number;
}

export const computeAddendumLineTotals = (
  line: AddendumServiceLine,
): AddendumLineTotals => {
  const quantity = Number(line.quantity || 0);
  const sellingPrice = Number(line.sellingPrice || 0);
  const cost = Number(line.cost || 0);
  const lineSellingPrice = sellingPrice * quantity;
  return {
    lineSellingPrice,
    lineCost: cost * quantity,
    lineVat: lineSellingPrice * ADDENDUM_VAT_RATE,
    lineTotalWithVat: lineSellingPrice * (1 + ADDENDUM_VAT_RATE),
  };
};
