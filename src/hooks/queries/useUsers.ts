import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  userService,
  UserItem,
  UserListFilters,
  CreateUserPayload,
  UpdateUserPayload,
  UpdateLaborContractsPayload,
} from '@/services/userService';
import { queryKeys } from '@/services/queryKeys';

/**
 * HOOKS — DANH BẠ NHÂN SỰ (Users) — Phase P3
 *
 * `GET /users` trả mảng thô và CHỈ hỗ trợ `role`, `month`, `year`.
 * Mọi tìm kiếm / lọc khác / phân trang đều phải xử lý ở tầng UI (client-side).
 */

/** Danh sách nhân sự (kèm `workload` khi truyền month/year). */
export function useUsersQuery(filters: UserListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: async () => {
      const res = await userService.getUsers(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled,
  });
}

/** Chi tiết một nhân sự (KHÔNG có `workload` — backend không trả ở getOne). */
export function useUserDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: async () => {
      const res = await userService.getUser(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const res = await userService.createUser(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateUserPayload) => {
      const res = await userService.updateUser(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(variables.id) });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await userService.deleteUser(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.removeQueries({ queryKey: queryKeys.users.detail(id) });
    },
  });
}

/** Ghi đè mảng hợp đồng lao động (metadata Cloudinary đã upload trước đó). */
export function useUpdateUserLaborContractsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateLaborContractsPayload) => {
      const res = await userService.updateUserLaborContracts(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(variables.id) });
    },
  });
}

export type { UserItem };
