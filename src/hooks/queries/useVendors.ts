import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import {
  CreateVendorPayload,
  UpdateVendorPayload,
  UpsertVendorJobPayload,
  VendorItem,
  VendorJobItem,
  VendorListFilters,
  vendorService,
} from '@/services/vendorService';

/**
 * ============================================================================
 * NHÀ CUNG CẤP (Vendors) — TanStack Query hooks
 * ----------------------------------------------------------------------------
 * Backend trả MẢNG THÔ và KHÔNG phân trang server-side ⇒ mọi filter (tìm kiếm
 * theo tên/SĐT/MST) được xử lý client-side ở màn hình. `filters` chỉ dùng để
 * tách khoá cache; màn hình danh sách cố tình KHÔNG truyền filter để tránh
 * refetch theo từng ký tự gõ vào ô tìm kiếm.
 * ============================================================================
 */

/** Danh sách nhà cung cấp (kèm `vendorJobs[]`). */
export function useVendorsQuery(filters?: VendorListFilters) {
  return useQuery({
    queryKey: queryKeys.vendors.list(filters),
    queryFn: async (): Promise<VendorItem[]> => {
      const res = await vendorService.getVendors();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
  });
}

/** Chi tiết một nhà cung cấp (kèm `vendorJobs[].job`). */
export function useVendorDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: async (): Promise<VendorItem | undefined> => {
      const res = await vendorService.getVendor(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** Nhà cung cấp đang phụ trách một hạng mục (Job). */
export function useVendorsByJobQuery(jobId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.vendors.byJob(jobId),
    queryFn: async (): Promise<VendorItem[]> => {
      const res = await vendorService.getVendorsByJob(jobId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(jobId) && enabled,
  });
}

/** Danh sách hạng mục (VendorJob) mà nhà cung cấp đang phụ trách. */
export function useVendorJobsQuery(vendorId: string) {
  return useQuery({
    queryKey: queryKeys.vendors.jobs(vendorId),
    queryFn: async (): Promise<VendorJobItem[]> => {
      const res = await vendorService.getVendorJobs(vendorId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(vendorId),
  });
}

/** Tạo nhà cung cấp mới. */
export function useCreateVendorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateVendorPayload): Promise<VendorItem | undefined> => {
      const res = await vendorService.createVendor(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
    },
  });
}

/** Cập nhật nhà cung cấp (service luôn gửi kèm `type` cùng `taxId`). */
export function useUpdateVendorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateVendorPayload): Promise<VendorItem | undefined> => {
      const res = await vendorService.updateVendor({ id, ...payload });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.jobs(variables.id) });
    },
  });
}

/** Xoá nhà cung cấp. */
export function useDeleteVendorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ message: string } | undefined> => {
      const res = await vendorService.deleteVendor(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.jobs(id) });
    },
  });
}

/**
 * Gán / cập nhật giá hạng mục cho nhà cung cấp.
 * Backend tự tính lại `job.costPrice = MIN(price các vendor)` và recalc giá vốn
 * của Service ⇒ phải làm mới cả `services` và `jobs`.
 */
export function useUpsertVendorJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, jobId, price, note }: UpsertVendorJobPayload): Promise<VendorJobItem | undefined> => {
      const res = await vendorService.upsertVendorJob({ id, jobId, price, note });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.jobs(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

/** Gỡ hạng mục khỏi nhà cung cấp. */
export function useRemoveVendorJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }): Promise<{ message: string } | undefined> => {
      const res = await vendorService.removeVendorJob({ id, jobId });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.jobs(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}
