import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService, TaskDetail } from '@/services/taskService';
import { teamService } from '@/services/teamService';
import { TaskItem } from '@/services/dashboardService';
import { queryKeys } from '@/services/queryKeys';

export interface TaskListFilters {
  search?: string;
  status?: string;
  projectId?: string;
  assigneeId?: string;
  page?: number;
  limit?: number;
}

/**
 * Hook to fetch list of tasks with filters
 */
export function useTasksQuery(filters: TaskListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: async () => {
      const res = await taskService.getTasks(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return {
        data: res.data || [],
        total: res.total ?? (res.data?.length || 0),
      };
    },
  });
}

/**
 * Hook to fetch tasks by project ID
 */
export function useTasksByProjectQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.list({ projectId }),
    queryFn: async () => {
      const res = await taskService.getTasksByProject(projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(projectId),
  });
}

/**
 * Hook to fetch single task detail
 */
export function useTaskDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: async () => {
      const res = await taskService.getTaskById(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to update task status (Optimistic update support)
 */
export function useUpdateTaskStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await taskService.updateTaskStatus(id, status);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

/**
 * Hook to update task payload details
 */
export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<TaskDetail> }) => {
      const res = await taskService.updateTask(id, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

/**
 * Hook to create a new task
 */
export function useCreateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      projectId: string;
      name: string;
      description?: string;
      assigneeId?: string;
      dueDate?: string;
      isExtraTask?: boolean;
    }) => {
      const res = await taskService.createTask(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.projectId) });
    },
  });
}

/**
 * Hook to assign a task to a performer
 */
export function useAssignTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload:
        | string
        | {
            assigneeId?: string;
            performerType?: string;
            plannedEndDate?: string;
            plannedStartDate?: string;
            description?: string;
            attachments?: any[];
            projectId?: string;
          };
    }) => {
      const res = await taskService.assignTask(id, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to bulk assign tasks
 */
export function useBulkAssignTasksMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      taskIds: string[];
      assigneeId?: string;
      performerType?: string;
      plannedEndDate?: string;
      plannedStartDate?: string;
      description?: string;
      attachments?: any[];
      projectId?: string;
    }) => {
      const res = await taskService.bulkAssignTasks(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to submit task result
 */
export function useSubmitTaskResultMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        link?: string;
        result?: any;
        projectId?: string;
        sheetNames?: string[];
        whitelist?: string[];
        checkFileUrl?: string;
        checkFileName?: string;
      };
    }) => {
      const res = await taskService.submitTaskResult(id, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useSubmitTaskResultFileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      file,
      sheetNames,
      whitelist,
    }: {
      id: string;
      file: { uri: string; name: string; mimeType?: string };
      sheetNames?: string[];
      whitelist?: string[];
    }) => {
      const res = await taskService.submitTaskResultFile(id, file, sheetNames, whitelist);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to finalize / approve task
 */
export function useFinalizeTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: { passedCriteriaIds: string[]; reviewNote?: string; projectId?: string };
    }) => {
      const res = await taskService.finalizeTask(taskId, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to reject task
 */
export function useRejectTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: { passedCriteriaIds?: string[]; reviewNote: string; projectId?: string };
    }) => {
      const res = await taskService.rejectTask(taskId, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to request rework
 */
export function useRequestReworkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { feedback: string; deadlineAt?: string; attachments?: any[]; projectId?: string };
    }) => {
      const res = await taskService.requestRework(id, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Phase P2/P3: `useVendorsByJobQuery` và `useTeamsQuery` đã được chuyển về
 * module chuyên trách (`@/hooks/queries/useVendors`, `@/hooks/queries/useTeams`)
 * để chỉ còn MỘT query key cho mỗi resource — tránh 2 cache song song.
 * Hãy import trực tiếp từ các module đó.
 */

/**
 * Hook to assign support team
 */
export function useAssignSupportTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      teamId,
      projectId,
    }: {
      taskId: string;
      teamId: string;
      projectId?: string;
    }) => {
      const res = await taskService.assignSupportTeam(taskId, teamId, projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to request support
 */
export function useRequestSupportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      reason,
      projectId,
    }: {
      taskId: string;
      reason: string;
      projectId?: string;
    }) => {
      const res = await taskService.requestSupport(taskId, reason, projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to fetch task reviews criteria/checklist
 */
export function useTaskReviewsQuery(taskId: string) {
  return useQuery({
    queryKey: ['tasks', 'reviews', taskId],
    queryFn: async () => {
      const res = await taskService.getTaskReviews(taskId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(taskId),
  });
}

/**
 * Hook to approve task by customer
 */
export function useApproveByCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, projectId }: { taskId: string; projectId?: string }) => {
      const res = await taskService.approveByCustomer(taskId, projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to respond to support request (ACCEPT / REJECT)
 */
export function useRespondToSupportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      action,
      projectId,
    }: {
      taskId: string;
      action: 'ACCEPT' | 'REJECT';
      projectId?: string;
    }) => {
      const res = await taskService.respondToSupport(taskId, action, projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to return support
 */
export function useReturnSupportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, projectId }: { taskId: string; projectId?: string }) => {
      const res = await taskService.returnSupport(taskId, projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to request return support
 */
export function useRequestReturnSupportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      reason,
      projectId,
    }: {
      taskId: string;
      reason: string;
      projectId?: string;
    }) => {
      const res = await taskService.requestReturnSupport(taskId, reason, projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/**
 * Hook to send task reminder
 */
export function useSendTaskReminderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await taskService.sendTaskReminder(taskId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
    },
  });
}

// ============================================================
// BỔ SUNG PARITY MODULE CÔNG VIỆC
// Đối chiếu ERP/src/modules/task/routes/Task.Route.ts + erp-UI/src/api/tasks.js
// ============================================================

/** Invalidate cache dùng chung cho các mutation công việc */
const invalidateTaskRelated = (
  queryClient: ReturnType<typeof useQueryClient>,
  options: { id?: string; projectId?: string } = {}
) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  if (options.id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(options.id) });
  }
  if (options.projectId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(options.projectId) });
  }
};

/**
 * Lịch tải công việc theo ngày của người thực hiện (GET /tasks/assignee/:userId/daily-workload).
 * Chỉ chạy khi có userId + khoảng ngày hợp lệ (và `enabled` bên ngoài cho phép).
 */
export function useTaskDailyWorkloadQuery(
  userId: string,
  startDate?: string,
  endDate?: string,
  enabled: boolean = true
) {
  const hasValidRange = Boolean(userId && startDate && endDate);
  return useQuery({
    queryKey: queryKeys.tasks.dailyWorkload(userId, startDate, endDate),
    queryFn: async () => {
      const res = await taskService.getAssigneeDailyWorkload({
        userId,
        startDate: String(startDate || ''),
        endDate: String(endDate || ''),
      });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: enabled && hasValidRange,
  });
}

/**
 * Danh sách công việc theo dự án qua route riêng GET /tasks/project/:projectId.
 * (Hook `useTasksByProjectQuery` phía trên giữ nguyên theo endpoint list filter cũ.)
 */
export function useTasksByProjectRouteQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.byProject(projectId),
    queryFn: async () => {
      const res = await taskService.getTasksByProjectRoute(projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(projectId),
  });
}

/** Đổi nickname công việc */
export function useUpdateTaskNicknameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      nickname,
    }: {
      id: string;
      nickname?: string | null;
      projectId?: string;
    }) => {
      const res = await taskService.updateTaskNickname({ id, nickname });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/** Bắt đầu công việc (PATCH /tasks/:id/start) */
export function useStartTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId?: string }) => {
      const res = await taskService.startTask(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      // Task detail + danh sách + chi tiết dự án
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/** Gửi kết quả để duyệt (PATCH /tasks/:id/submit-result-review) */
export function useSubmitResultForReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId?: string }) => {
      const res = await taskService.submitResultForReview(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/** Định giá công việc phát sinh (POST /tasks/:id/pricing) */
export function useAssessExtraTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      isBillable,
      sellingPrice,
      isRejected,
      serviceId,
    }: {
      id: string;
      isBillable: boolean;
      sellingPrice?: number;
      isRejected?: boolean;
      serviceId?: string;
      projectId?: string;
    }) => {
      const res = await taskService.assessExtraTask({
        id,
        isBillable,
        sellingPrice,
        isRejected,
        serviceId,
      });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/** Tạo công việc nội bộ (POST /tasks/internal) */
export function useCreateInternalTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Parameters<typeof taskService.createInternalTask>[0]) => {
      const res = await taskService.createInternalTask(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

/** Gửi yêu cầu điều phối nhân sự (POST /tasks/:id/request-staffing) */
export function useRequestTaskStaffingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string; projectId?: string }) => {
      const res = await taskService.requestTaskStaffing({ id, note });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/** Phản hồi yêu cầu điều phối nhân sự (PATCH /tasks/:id/respond-staffing) */
export function useRespondTaskStaffingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: 'RESOLVE' | 'REJECT';
      projectId?: string;
    }) => {
      const res = await taskService.respondTaskStaffing({ id, action });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/** Thêm công việc con (POST /tasks/:id/subtasks) — invalidate task cha để refresh danh sách subtask */
export function useAddSubtaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      assigneeId,
      allocationPercent,
      description,
    }: {
      id: string;
      name: string;
      assigneeId?: string;
      allocationPercent: number;
      description?: string;
      projectId?: string;
    }) => {
      const res = await taskService.addSubtask({ id, name, assigneeId, allocationPercent, description });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/**
 * Cập nhật công việc con (PATCH /tasks/:id/subtask — `id` là ID SUBTASK).
 * `taskId` (task cha) dùng để invalidate đúng cache chi tiết nếu có.
 */
export function useUpdateSubtaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      assigneeId,
      allocationPercent,
      description,
    }: {
      id: string;
      name: string;
      assigneeId?: string;
      allocationPercent: number;
      description?: string;
      taskId?: string;
      projectId?: string;
    }) => {
      const res = await taskService.updateSubtask({ id, name, assigneeId, allocationPercent, description });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, {
        id: variables.taskId || variables.id,
        projectId: variables.projectId,
      });
    },
  });
}

/** Bỏ phân công nhiều công việc (PATCH /tasks/bulk-unassign) */
export function useBulkUnassignTasksMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, taskIds }: { projectId: string; taskIds: string[] }) => {
      const res = await taskService.bulkUnassignTasks({ projectId, taskIds });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { projectId: variables.projectId });
    },
  });
}

/** Bắt đầu nhiều công việc (PATCH /tasks/bulk-start) */
export function useBulkStartTasksMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, taskIds }: { projectId: string; taskIds: string[] }) => {
      const res = await taskService.bulkStartTasks({ projectId, taskIds });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { projectId: variables.projectId });
    },
  });
}

/** Đánh dấu khách hàng không mua (PATCH /tasks/:id/customer-not-purchase) */
export function useCustomerNotPurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId?: string }) => {
      const res = await taskService.customerNotPurchase(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}

/** Xóa công việc (DELETE /tasks/:id) */
export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId?: string }) => {
      const res = await taskService.deleteTask(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      invalidateTaskRelated(queryClient, { id: variables.id, projectId: variables.projectId });
    },
  });
}
