import { apiService } from './api';
import { USER_ROLE } from './teamService';
import type { WorkloadInfo } from '../utils/workload';

/**
 * SERVICE — DANH BẠ NHÂN SỰ (Users) — Phase P3
 *
 * Đối chiếu backend thật: `ERP/src/modules/user/`
 *  - GET    /users                     → mảng thô (KHÔNG có { data, meta }); query CHỈ hỗ trợ `role`, `month`, `year`
 *  - GET    /users/:id                 → object cùng shape (KHÔNG có `workload`)
 *  - POST   /users                     → tạo User + Account
 *  - PUT    /users/:id                 → sửa User + Account (đổi role cũng dùng endpoint NÀY)
 *  - PATCH  /users/:id/labor-contracts → ghi đè mảng hợp đồng lao động
 *  - DELETE /users/:id                 → xóa
 *
 * ⚠️ KHÔNG tồn tại `PATCH /users/:id/role` (404) nên không được implement.
 * ⚠️ Tìm kiếm / lọc theo team / phân trang phải xử lý CLIENT-SIDE vì backend không hỗ trợ.
 * ⚠️ Entity `Users` chỉ có fullName / phoneNumber / isLocked / laborContract.
 *    Thông tin đăng nhập nằm ở `Accounts`: username, email, role, isActive, vinicoin...
 *    KHÔNG có address / dob / citizenId / CCCD / bankAccount và KHÔNG có enum USER_STATUS.
 *    Trạng thái chỉ gồm 2 cờ boolean: `user.isLocked` và `account.isActive`.
 * ⚠️ Backend `getAll/getOne` lọc cứng `isLocked: false` ⇒ user bị khóa không bao giờ trả về.
 */

// ============================================================================
// ENUM + NHÃN (9 role — khớp Account.entity.ts `UserRole`)
// ============================================================================

/**
 * Bảng nhãn role dùng chung. `teamService.USER_ROLE` đã có map tương đương và
 * khớp 100% với 9 role của backend nên được tái sử dụng (không sửa file đó).
 */
export const USER_ROLE_LABELS: Record<string, string> = USER_ROLE;

/** Role mặc định của backend khi payload không truyền `role`. */
export const DEFAULT_USER_ROLE = 'CONTENT_D';

export const SPECIALIZED_STAFF_ROLES = [
  'CONTENT_A',
  'CONTENT_B',
  'CONTENT_C',
  'CONTENT_D',
  'EDITOR_A',
  'EDITOR_B',
  'EDITOR_C',
  'EDITOR_D',
  'DESIGNER_A',
  'DESIGNER_B',
  'DESIGNER_C',
  'DESIGNER_D',
];

export const STAFF_ROLES = [...SPECIALIZED_STAFF_ROLES];

/** Thứ tự hiển thị option theo chuẩn Web Getvini: ADMIN, BOD, BD, ADMIN_SALE, PM, 12 Specialized Roles */
export const USER_ROLE_OPTIONS: { value: string; label: string }[] = [
  'ADMIN',
  'BOD',
  'BD',
  'ADMIN_SALE',
  'PM',
  ...STAFF_ROLES,
].map((value) => ({ value, label: USER_ROLE_LABELS[value] || value }));

/** Danh sách mã role theo đúng thứ tự option (tiện cho filter chips). */
export const USER_ROLE_VALUES: string[] = USER_ROLE_OPTIONS.map((option) => option.value);

export const getUserRoleLabel = (role?: string | null): string => {
  if (!role) return 'Chưa xác định';
  return USER_ROLE_LABELS[role] || role;
};

// ============================================================================
// TYPES
// ============================================================================

export interface UserAccountInfo {
  id: string;
  username: string;
  email?: string | null;
  role?: string;
  isActive?: boolean;
  vinicoin?: number;
  vinicoinTotal?: number;
  vinicoinWithdrawn?: number;
}

export interface UserTaskSummary {
  id: string;
  code?: string;
  name?: string;
  status?: string;
}

/** Metadata file Cloudinary lưu trong `Users.laborContract` (simple-json array). */
export interface LaborContractFile {
  type?: string;
  name: string;
  url: string;
  publicId?: string;
  size?: number;
  format?: string;
  resource_type?: string;
  uploadedAt?: string;
}

export interface UserItem {
  id: string;
  fullName: string;
  phoneNumber?: string | null;
  isLocked?: boolean;
  laborContract?: LaborContractFile[] | null;
  accounts?: UserAccountInfo[];
  account?: UserAccountInfo | null;
  tasks?: UserTaskSummary[];
  workload?: WorkloadInfo | null;
}

/** Chỉ 3 query param này được backend hỗ trợ — mọi filter khác làm client-side. */
export interface UserListFilters {
  role?: string;
  month?: number;
  year?: number;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  fullName: string;
  role?: string;
  phoneNumber?: string;
  email?: string;
  isLocked?: boolean;
}

export interface UpdateUserPayload {
  id: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  isActive?: boolean;
  isLocked?: boolean;
}

export interface UpdateLaborContractsPayload {
  id: string;
  /** Mảng metadata Cloudinary. Gửi `[]` hoặc `null` để xóa sạch hợp đồng. */
  laborContract: LaborContractFile[] | null;
}

export interface UserListResult {
  data?: UserItem[];
  error?: string;
}

export interface UserDetailResult {
  data?: UserItem;
  error?: string;
}

export interface UserMutationResult {
  data?: unknown;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * `GET /users` trả mảng thô. Hàm này chỉ chấp nhận dạng mảng (hoặc bọc `data`
 * nếu backend đổi shape sau này) để tránh crash khi `.map` trên object.
 */
const normalizeUserList = (raw: unknown): UserItem[] => {
  if (Array.isArray(raw)) return raw as UserItem[];
  const wrapped = (raw as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(wrapped) ? (wrapped as UserItem[]) : [];
};

/** Lấy thông tin account đăng nhập từ item (backend trả cả `accounts[]` và `account`). */
export const getUserAccount = (user?: UserItem | null): UserAccountInfo | null => {
  if (!user) return null;
  if (user.account) return user.account;
  if (Array.isArray(user.accounts) && user.accounts.length > 0) return user.accounts[0];
  return null;
};

/** Trạng thái hiển thị: chỉ dựa vào 2 cờ boolean isLocked / isActive. */
export const getUserStatusLabel = (user?: UserItem | null): string => {
  if (!user) return 'Không xác định';
  if (user.isLocked) return 'Đã khóa';
  const account = getUserAccount(user);
  if (account && account.isActive === false) return 'Ngừng hoạt động';
  return 'Đang hoạt động';
};

// ============================================================================
// SERVICE
// ============================================================================

class UserService {
  /** GET /users — mảng thô, chỉ nhận `role`, `month`, `year`. */
  async getUsers(filters: UserListFilters = {}): Promise<UserListResult> {
    const params: Record<string, string | number> = {};
    if (filters.role) params.role = filters.role;
    if (filters.month) params.month = filters.month;
    if (filters.year) params.year = filters.year;

    const res = await apiService.get<unknown>('/users', params);
    if (res.error) return { error: res.error };
    return { data: normalizeUserList(res.data) };
  }

  /** GET /users/:id — object cùng shape nhưng KHÔNG có `workload`. */
  async getUser(id: string): Promise<UserDetailResult> {
    const res = await apiService.get<UserItem>(`/users/${id}`);
    return { data: res.data, error: res.error };
  }

  /** POST /users — tạo mới User + Account (bắt buộc username/password/fullName). */
  async createUser(payload: CreateUserPayload): Promise<UserMutationResult> {
    const res = await apiService.post<unknown>('/users', {
      username: payload.username,
      password: payload.password,
      fullName: payload.fullName,
      role: payload.role || DEFAULT_USER_ROLE,
      ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.isLocked !== undefined ? { isLocked: payload.isLocked } : {}),
    });
    return { data: res.data, error: res.error };
  }

  /** PUT /users/:id — sửa User + Account; đổi role cũng dùng endpoint này. */
  async updateUser({ id, ...payload }: UpdateUserPayload): Promise<UserMutationResult> {
    const body: Record<string, unknown> = {};
    if (payload.fullName !== undefined) body.fullName = payload.fullName;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.phoneNumber !== undefined) body.phoneNumber = payload.phoneNumber;
    if (payload.role !== undefined) body.role = payload.role;
    if (payload.isActive !== undefined) body.isActive = payload.isActive;
    if (payload.isLocked !== undefined) body.isLocked = payload.isLocked;

    const res = await apiService.put<unknown>(`/users/${id}`, body);
    return { data: res.data, error: res.error };
  }

  /**
   * PATCH /users/:id/labor-contracts — ghi đè TOÀN BỘ mảng hợp đồng.
   * Luồng chuẩn: upload Cloudinary trước → truyền mảng metadata vào đây.
   * ⚠️ KHÔNG dùng multipart (Web cũng không dùng).
   */
  async updateUserLaborContracts({
    id,
    laborContract,
  }: UpdateLaborContractsPayload): Promise<UserMutationResult> {
    const res = await apiService.patch<unknown>(`/users/${id}/labor-contracts`, {
      laborContract: laborContract ?? [],
    });
    return { data: res.data, error: res.error };
  }

  /** DELETE /users/:id */
  async deleteUser(id: string): Promise<UserMutationResult> {
    const res = await apiService.delete<unknown>(`/users/${id}`);
    return { data: res.data, error: res.error };
  }
}

export const userService = new UserService();
