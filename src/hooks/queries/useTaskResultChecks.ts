import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  taskResultChecksService,
  ResultCheckKind,
  RerunResultCheckPayload,
  TaskResultCheckRecord,
} from '@/services/taskResultChecksService';
import { queryKeys } from '@/services/queryKeys';

const isActiveStatus = (status?: string) => status === 'PENDING' || status === 'RUNNING';
const rerunningTasks = new Set<string>();

export function isCheckRunning(record?: TaskResultCheckRecord | null): boolean {
  if (!record) return false;
  return isActiveStatus(record.spellStatus || record.status) || isActiveStatus(record.qcStatus || record.status);
}

export function useTaskResultCheckQuery(taskId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.taskResultChecks.detail(taskId),
    queryFn: async () => {
      const res = await taskResultChecksService.getByTask(taskId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data ?? null;
    },
    enabled: Boolean(taskId) && enabled,
    refetchInterval: (query) => {
      if (isCheckRunning(query.state.data)) return 4000;
      if (query.state.data == null && query.state.dataUpdateCount < 8) return 4000;
      return false;
    },
  });
}

export function useToggleResultCheckItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      kind,
      itemId,
      confirmed,
    }: {
      taskId: string;
      kind: ResultCheckKind;
      itemId: string;
      confirmed: boolean;
    }) => {
      const res = await taskResultChecksService.toggleItem(taskId, kind, itemId, confirmed);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskResultChecks.detail(variables.taskId) });
    },
  });
}

export function useToggleResultCheckItemsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      kind,
      itemIds,
      confirmed,
    }: {
      taskId: string;
      kind: ResultCheckKind;
      itemIds: string[];
      confirmed: boolean;
    }) => {
      const res = await taskResultChecksService.toggleItems(taskId, kind, itemIds, confirmed);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskResultChecks.detail(variables.taskId) });
    },
  });
}

export function useFinalizeResultCheckMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await taskResultChecksService.finalize(taskId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskResultChecks.detail(taskId) });
    },
  });
}

export function useRerunResultCheckMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, kind, whitelist, scope, reviewerNote, refresh }: RerunResultCheckPayload) => {
      if (rerunningTasks.has(taskId)) throw new Error('Đang gửi yêu cầu kiểm tra lại.');
      if (kind !== 'SPELL' && (reviewerNote?.length || 0) > 1000) throw new Error('Ghi chú cho AI tối đa 1.000 ký tự.');
      rerunningTasks.add(taskId);
      try {
        const current = await taskResultChecksService.getByTask(taskId);
        if (current.error) throw new Error(current.error);
        if (!current.data?.canReview || current.data.finalizedAt || isCheckRunning(current.data)) {
          throw new Error('Bạn không có quyền, kết quả đã chốt hoặc đang kiểm tra. Vui lòng tải lại.');
        }
        const res = await taskResultChecksService.rerun(taskId, kind, whitelist, scope, { reviewerNote, refresh });
        if (res.error || !res.data) throw new Error(res.error || 'Máy chủ chưa xác nhận yêu cầu kiểm tra lại.');
        return res.data;
      } finally { rerunningTasks.delete(taskId); }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskResultChecks.detail(variables.taskId) });
    },
  });
}
