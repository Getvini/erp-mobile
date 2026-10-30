import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '@/services/taskService';
import { quotationService } from '@/services/quotationService';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { getTaskActionState } from '@/utils/taskPolicy';

/** Same two-step flow as web AddendumQuotationModal. Keep the form available if step two fails. */
export function useExtraTaskQuotationMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    retry: false,
    mutationFn: async ({ taskId, opportunityId, sellingPrice, note, project }: {
      taskId: string; opportunityId: string; sellingPrice: number; note?: string; project?: any;
    }) => {
      if (!opportunityId) throw new Error('Hợp đồng chưa có cơ hội để tạo báo giá phụ lục.');
      const latest = await taskService.getTaskById(taskId);
      if (latest.error || !latest.data) throw new Error(latest.error || 'Không tải được công việc.');
      const existingQuotation = (latest.data as any).quotation;
      if (existingQuotation?.id) return existingQuotation;
      const state = getTaskActionState(latest.data, user, 'assessExtraTask', { project: latest.data.project || project });
      if (!state.enabled) throw new Error(state.reason || 'Bạn không có quyền định giá công việc này.');
      const assessed = await taskService.assessExtraTask({ id: taskId, isBillable: true, sellingPrice, isRejected: false });
      if (assessed.error) throw new Error(assessed.error);
      const result = await quotationService.createAddendumQuotation({ opportunityId, taskIds: [taskId], note });
      if (result.error || !result.data) throw new Error(result.error || 'Chưa tạo được báo giá. Vui lòng thử lại.');
      return result.data;
    },
    onSuccess: () => {
      for (const key of [queryKeys.tasks.all, queryKeys.projects.all, queryKeys.contracts.all, queryKeys.quotations.all, queryKeys.opportunities.all]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
