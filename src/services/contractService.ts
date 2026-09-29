import { apiService } from "./api";

export enum ContractStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  PROPOSAL_APPROVED = "PROPOSAL_APPROVED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  SIGNED = "SIGNED",
  PROPOSAL_UPLOADED = "PROPOSAL_UPLOADED",
  PROPOSAL_REJECTED = "PROPOSAL_REJECTED",
}

// 100% đồng bộ chuẩn Web ERP (erp-UI/src/utils/enums.js)
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Mới",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PROPOSAL_APPROVED: "Đã duyệt hợp đồng",
  ACTIVE: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  SIGNED: "Đã ký",
  PROPOSAL_UPLOADED: "Đã tải lên hợp đồng",
  PROPOSAL_REJECTED: "Bị từ chối hợp đồng",
};

export const CONTRACT_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  DRAFT: {
    text: "Mới",
    color: "#1E40AF",
    bg: "#DBEAFE",
    border: "#BFDBFE",
  },
  PENDING: {
    text: "Chờ duyệt",
    color: "#854D0E",
    bg: "#FEF9C3",
    border: "#FEF08A",
  },
  APPROVED: {
    text: "Đã duyệt",
    color: "#166534",
    bg: "#DCFCE7",
    border: "#BBF7D0",
  },
  PROPOSAL_APPROVED: {
    text: "Đã duyệt hợp đồng",
    color: "#166534",
    bg: "#DCFCE7",
    border: "#BBF7D0",
  },
  ACTIVE: {
    text: "Đang thực hiện",
    color: "#1E40AF",
    bg: "#DBEAFE",
    border: "#BFDBFE",
  },
  COMPLETED: {
    text: "Hoàn thành",
    color: "#6B21A8",
    bg: "#F3E8FF",
    border: "#E9D5FF",
  },
  CANCELLED: {
    text: "Đã hủy",
    color: "#991B1B",
    bg: "#FEE2E2",
    border: "#FECACA",
  },
  SIGNED: {
    text: "Đã ký",
    color: "#166534",
    bg: "#DCFCE7",
    border: "#BBF7D0",
  },
  PROPOSAL_UPLOADED: {
    text: "Đã tải lên hợp đồng",
    color: "#166534",
    bg: "#DCFCE7",
    border: "#BBF7D0",
  },
  PROPOSAL_REJECTED: {
    text: "Bị từ chối hợp đồng",
    color: "#991B1B",
    bg: "#FEE2E2",
    border: "#FECACA",
  },
};

export enum MilestoneStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

export enum ContractServiceStatus {
  ACTIVE = "ACTIVE",
  ACCEPTANCE_REJECTED = "ACCEPTANCE_REJECTED",
  CANCELLED = "CANCELLED",
  AWAITING_ACCEPTANCE = "AWAITING_ACCEPTANCE",
  COMPLETED = "COMPLETED",
}

// 100% đồng bộ erp-UI/src/utils/enums.js:29-35 (CONTRACT_SERVICE_STATUS_LABELS)
export const CONTRACT_SERVICE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang thực hiện',
  AWAITING_ACCEPTANCE: 'Sẵn sàng nghiệm thu',
  ACCEPTANCE_REJECTED: 'Từ chối nghiệm thu',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const CONTRACT_SERVICE_STATUS_CONFIG: Record<
  string,
  { text: string; color: string; bg: string; border: string }
> = {
  ACTIVE: { text: 'Đang thực hiện', color: '#C2410C', bg: '#FFF7ED', border: '#FFEDD5' },
  AWAITING_ACCEPTANCE: {
    text: 'Sẵn sàng nghiệm thu',
    color: '#854D0E',
    bg: '#FEFCE8',
    border: '#FEF08A',
  },
  ACCEPTANCE_REJECTED: { text: 'Từ chối nghiệm thu', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  COMPLETED: { text: 'Hoàn thành', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  CANCELLED: { text: 'Đã hủy', color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' },
};

export interface ContractCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
}

export interface ContractOpportunity {
  id: string;
  opportunityCode?: string;
  name: string;
}

export interface ContractMilestone {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  status: MilestoneStatus | string;
  description?: string;
  dueDate?: string;
  paidDate?: string;
}

export interface ContractServiceItem {
  id: string;
  name?: string;
  packageName?: string;
  isPackageService?: boolean;
  sellingPrice: number;
  status?: ContractServiceStatus | string;
  service?: {
    id: string;
    name: string;
    costPrice?: number;
    unit?: string;
  };
}

export interface ContractAttachment {
  type?: string;
  name: string;
  url: string;
  size?: number;
  publicId?: string;
}

export interface ContractItem {
  id: string;
  contractCode: string;
  name: string;
  description?: string;
  status: ContractStatus | string;
  cost: number;
  sellingPrice: number;
  totalWithVat: number;
  vatAmount: number;
  customer?: ContractCustomer;
  opportunity?: ContractOpportunity;
  proposal_contract?: string;
  quotation_link?: string;
  signed_contract?: string;
  rejectReason?: string;
  attachments?: ContractAttachment[];
  milestones?: ContractMilestone[];
  services?: ContractServiceItem[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    id: string;
    fullName?: string;
    username?: string;
  };
}

export interface CreateContractPayload {
  opportunityId?: string;
  name?: string;
  description?: string;
  customerId?: string;
  customerData?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxId?: string;
    customerType?: string;
    source?: string;
    referralPartnerId?: string;
    status?: string;
  };
  services?: {
    serviceId: string;
    quantity: number;
    sellingPrice?: number;
  }[];
  packages?: {
    servicePackageId: string;
    quantity: number;
    customPrices?: Record<string, number>;
  }[];
}

export const contractService = {
  /**
   * Tạo hợp đồng từ cơ hội kinh doanh (hoặc độc lập)
   */
  async createContract(payload: CreateContractPayload) {
    return apiService.post<ContractItem>("/contracts", payload);
  },

  /**
   * Lấy chi tiết hợp đồng theo ID
   */
  async getContract(id: string) {
    return apiService.get<ContractItem>(`/contracts/${id}`);
  },

  /**
   * Lấy danh sách hợp đồng có bộ lọc
   */
  async getContracts(params?: {
    search?: string;
    status?: string;
    customerId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "ASC" | "DESC";
  }) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.status && params.status !== "ALL")
      queryParams.append("status", params.status);
    if (params?.customerId) queryParams.append("customerId", params.customerId);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params?.sortDir) queryParams.append("sortDir", params.sortDir);

    const queryStr = queryParams.toString();
    const endpoint = `/contracts${queryStr ? `?${queryStr}` : ""}`;
    return apiService.get<{
      data: ContractItem[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(endpoint);
  },

  /**
   * Tải lên Proposal hợp đồng (file hoặc link, kèm link báo giá nếu có)
   */
  async uploadProposal(
    id: string,
    payload: {
      file?: any;
      contractLink?: string;
      quotationLink?: string;
    }
  ) {
    return apiService.post<ContractItem>(`/contracts/${id}/proposal`, payload);
  },

  /**
   * Tải lên Hợp đồng đã ký (.pdf)
   */
  async uploadSigned(id: string, file: any) {
    return apiService.post<ContractItem>(`/contracts/${id}/signed`, { file });
  },

  /**
   * Duyệt Proposal hợp đồng (BOD / Admin)
   */
  async approveProposal(id: string) {
    return apiService.post<{ message: string; contract?: ContractItem }>(
      `/contracts/${id}/approve-proposal`,
    );
  },

  /**
   * Từ chối Proposal hợp đồng (BOD / Admin)
   */
  async rejectProposal(id: string, reason: string) {
    return apiService.post<{ message: string; contract?: ContractItem }>(
      `/contracts/${id}/reject-proposal`,
      { reason },
    );
  },

  /**
   * Cập nhật hợp đồng — ⚠️ KHÔNG khả dụng: backend KHÔNG expose `PUT /contracts/:id`
   * (xem ERP/src/modules/contract/routes/Contract.Route.ts). Web khai báo nhưng không dùng.
   * Giữ chỗ để tài liệu hóa; mọi cập nhật hợp đồng đi qua luồng proposal/signed/milestone.
   */
  async updateContract(_id: string, _data: Record<string, any>) {
    return {
      data: undefined as ContractItem | undefined,
      error: 'Backend chưa expose PUT /contracts/:id',
    };
  },

  /**
   * Xóa hợp đồng (DELETE /contracts/:id) — route có thật ở backend.
   * Lưu ý: backend không guard role/status, nên UI phải tự khóa khi hợp đồng đã ký.
   */
  async deleteContract(id: string) {
    return apiService.delete<{ message?: string }>(`/contracts/${id}`);
  },

  /**
   * Cập nhật nickname dịch vụ trong hợp đồng (PATCH /contracts/services/:id/nickname)
   */
  async updateContractServiceNickname(payload: { id: string; nickname: string }) {
    return apiService.patch<{ message?: string }>(
      `/contracts/services/${payload.id}/nickname`,
      { nickname: payload.nickname },
    );
  },

  /**
   * Thêm mốc thanh toán cho hợp đồng (POST /contracts/:id/milestones)
   * Web gửi `title`; controller backend map sang `name`.
   */
  async addMilestone(payload: { id: string } & Record<string, any>) {
    const { id, ...data } = payload;
    return apiService.post<ContractItem>(`/contracts/${id}/milestones`, data);
  },

  /**
   * Cập nhật mốc thanh toán (PUT /contracts/milestones/:id)
   * Lưu ý: response KHÔNG có `contractId` top-level, chỉ có relation `contract`.
   */
  async updateMilestone(payload: { id: string } & Record<string, any>) {
    const { id, ...data } = payload;
    return apiService.put<ContractItem>(`/contracts/milestones/${id}`, data);
  },

  /**
   * Xóa mốc thanh toán (DELETE /contracts/milestones/:id)
   */
  async deleteMilestone(id: string) {
    return apiService.delete<{ message?: string }>(`/contracts/milestones/${id}`);
  },

  /**
   * Đổi trạng thái hợp đồng — ⚠️ KHÔNG khả dụng: backend KHÔNG expose
   * `PATCH /contracts/:id/status` (Contract.Route.ts). Web khai báo nhưng không dùng.
   */
  async updateContractStatus(_id: string, _status: string) {
    return {
      data: undefined as ContractItem | undefined,
      error: 'Backend chưa expose PATCH /contracts/:id/status',
    };
  },
};

/**
 * Quality Gate: hợp đồng đã ký duyệt (SIGNED / COMPLETED / CANCELLED) thì
 * khóa hoàn toàn thao tác chỉnh sửa & xóa — đồng bộ erp-UI ContractDetailPage.
 */
export const LOCKED_CONTRACT_STATUSES: string[] = [
  ContractStatus.SIGNED,
  ContractStatus.COMPLETED,
  ContractStatus.CANCELLED,
];

export const isContractLocked = (status?: string): boolean =>
  Boolean(status) && LOCKED_CONTRACT_STATUSES.includes(status as string);
