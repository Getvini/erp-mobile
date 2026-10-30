import { assertCatalogWriteAccess } from '@/utils/catalogAccess';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  servicePackageService,
  ServicePackageCreatePayload,
  ServicePackageUpdatePayload,
} from '@/services/servicePackageService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Hooks cho Gói dịch vụ niêm yết (Phase P2).
 *
 * Invalidation: mọi mutation gói đều invalidate `servicePackages.all`; đồng thời
 * `services.all` vì danh mục dịch vụ hiển thị quan hệ gói/dịch vụ trong cùng phiên.
 */

export function useServicePackagesQuery() {
  return useQuery({
    queryKey: queryKeys.servicePackages.list(),
    queryFn: async () => {
      const res = await servicePackageService.getServicePackages();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
  });
}

export function useServicePackageDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.servicePackages.detail(id),
    queryFn: async () => {
      const res = await servicePackageService.getServicePackage(id);
      if (!res.error && !res.data?.id) throw new Error('Phản hồi gói dịch vụ không hợp lệ.');
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateServicePackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ServicePackageCreatePayload) => {
      assertCatalogWriteAccess();
      const res = await servicePackageService.createServicePackage(payload);
      if (!res.error && !res.data?.id) throw new Error('Máy chủ chưa xác nhận dữ liệu đã lưu.');
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servicePackages.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useUpdateServicePackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & ServicePackageUpdatePayload) => {
      assertCatalogWriteAccess();
      const res = await servicePackageService.updateServicePackage({ id, ...payload });
      if (!res.error && !res.data?.id) throw new Error('Máy chủ chưa xác nhận dữ liệu đã lưu.');
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servicePackages.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.servicePackages.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useDeleteServicePackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      assertCatalogWriteAccess();
      const res = await servicePackageService.deleteServicePackage(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.servicePackages.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.servicePackages.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}
