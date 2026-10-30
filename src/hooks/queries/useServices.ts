import { assertCatalogWriteAccess } from '@/utils/catalogAccess';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  catalogService,
  ServiceCreatePayload,
  ServiceItem,
  ServiceListFilters,
  ServiceUpdatePayload,
} from '@/services/catalogService';
import { queryKeys } from '@/services/queryKeys';
import { serviceDetailQueryOptions } from '@/services/catalogQueries';

/**
 * Hooks cho Dịch vụ niêm yết (Phase P2).
 *
 * Invalidation: mọi mutation dịch vụ đều invalidate `services.all` + `servicePackages.all`
 * (giá gói phụ thuộc giá vốn dịch vụ). Thêm/gỡ hạng mục còn invalidate `queryKeys.jobs.all`.
 */

function invalidateServiceDependents(
  queryClient: ReturnType<typeof useQueryClient>,
  options: { jobs?: boolean } = {},
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.servicePackages.all });
  if (options.jobs !== false) {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  }
}

export function useServicesQuery(
  filters: ServiceListFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.services.list(filters),
    queryFn: async () => {
      const res = await catalogService.getServices(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: options.enabled,
  });
}

export function useServiceDetailQuery(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...serviceDetailQueryOptions(id),
    enabled: Boolean(id) && options.enabled !== false,
  });
}

export function useCreateServiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ServiceCreatePayload) => {
      assertCatalogWriteAccess();
      const res = await catalogService.createService(payload);
      if (!res.error && !res.data?.id) throw new Error('Máy chủ chưa xác nhận dữ liệu đã lưu.');
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSettled: () => {
      invalidateServiceDependents(queryClient);
    },
  });
}

export function useUpdateServiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & ServiceUpdatePayload) => {
      assertCatalogWriteAccess();
      const res = await catalogService.updateService({ id, ...payload });
      if (!res.error && !res.data?.id) throw new Error('Máy chủ chưa xác nhận dữ liệu đã lưu.');
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateServiceDependents(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(variables.id) });
    },
  });
}

export function useDeleteServiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      assertCatalogWriteAccess();
      const res = await catalogService.deleteService(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.services.detail(id) });
      invalidateServiceDependents(queryClient);
    },
  });
}

export function useBulkDeleteServicesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      assertCatalogWriteAccess();
      const res = await catalogService.bulkDeleteServices(ids);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, ids) => {
      ids.forEach((id) => queryClient.removeQueries({ queryKey: queryKeys.services.detail(id) }));
      invalidateServiceDependents(queryClient);
    },
  });
}

export function useAddServiceJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      assertCatalogWriteAccess();
      const res = await catalogService.addServiceJob({ id, jobId });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateServiceDependents(queryClient, { jobs: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(variables.id) });
    },
  });
}

export function useRemoveServiceJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      assertCatalogWriteAccess();
      const res = await catalogService.removeServiceJob({ id, jobId });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateServiceDependents(queryClient, { jobs: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(variables.id) });
    },
  });
}

export function useDuplicateServiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    /** Preserve source quantities; the server generates the new code. */
    mutationFn: async ({
      service,
    }: {
      service: ServiceItem;
    }) => {
      assertCatalogWriteAccess();
      const res = await catalogService.duplicateService(service);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSettled: () => {
      invalidateServiceDependents(queryClient);
    },
  });
}
