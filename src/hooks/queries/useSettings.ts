import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  settingService,
  QcSettingsResponse,
  UpdateQcSettingsPayload,
  WorkloadNormSettingsResponse,
  UpdateWorkloadNormsPayload,
} from '@/services/settingService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Hook lấy cấu hình QC kiểm tra sản phẩm AI
 */
export function useQcSettingsQuery() {
  return useQuery<QcSettingsResponse>({
    queryKey: queryKeys.settings.qc(),
    queryFn: async () => {
      const res = await settingService.getQcSettings();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || ({} as QcSettingsResponse);
    },
    staleTime: 1000 * 60 * 5, // 5 phút
  });
}

/**
 * Hook cập nhật cấu hình QC kiểm tra sản phẩm AI
 */
export function useUpdateQcSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateQcSettingsPayload) => {
      const res = await settingService.updateQcSettings(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.qc() });
    },
  });
}

/**
 * Hook lấy cấu hình định mức workload theo role
 */
export function useWorkloadNormsQuery() {
  return useQuery<WorkloadNormSettingsResponse>({
    queryKey: queryKeys.settings.workloadNorms(),
    queryFn: async () => {
      const res = await settingService.getWorkloadNorms();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || ({ norms: [] } as WorkloadNormSettingsResponse);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook cập nhật cấu hình định mức workload theo role
 */
export function useUpdateWorkloadNormsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateWorkloadNormsPayload) => {
      const res = await settingService.updateWorkloadNorms(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.workloadNorms() });
    },
  });
}

