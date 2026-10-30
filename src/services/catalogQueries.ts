import { catalogService } from './catalogService';
import { queryKeys } from './queryKeys';

/** Shared by detail screens and lazy package rows, including error and retry behavior. */
export function serviceDetailQueryOptions(id: string) {
  return {
    queryKey: queryKeys.services.detail(id),
    queryFn: async () => {
      const response = await catalogService.getService(id);
      if (response.error) throw new Error(response.error);
      if (!response.data?.id || !Array.isArray(response.data.serviceJobs)) {
        throw new Error('Phản hồi chi tiết dịch vụ không đầy đủ.');
      }
      return response.data;
    },
  };
}
