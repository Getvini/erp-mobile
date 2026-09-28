import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jobService,
  CreateJobPayload,
  Job,
  JobCriteria,
  JobCriteriaInput,
  JobListFilters,
  UpdateJobPayload,
} from '@/services/jobService';
import { queryKeys } from '@/services/queryKeys';

export type {
  CreateJobPayload,
  Job,
  JobCriteria,
  JobCriteriaInput,
  JobListFilters,
  UpdateJobPayload,
};

/**
 * Invalidate dùng chung cho module Hạng mục công việc.
 *
 * ⚠️ Đổi `costPrice` của job ⇒ backend `ServiceService.recalculateCost()` tính lại giá vốn
 * của mọi dịch vụ/gói dịch vụ đang dùng hạng mục đó (Job.Service.ts:96-124), và giá vendor
 * tham chiếu job ⇒ phải invalidate thêm services / servicePackages / vendors.
 */
const invalidateJobScope = (
  queryClient: ReturnType<typeof useQueryClient>,
  options: { id?: string; jobId?: string } = {}
) => {
  const jobId = options.jobId || options.id;

  queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  if (options.id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(options.id) });
  }
  if (jobId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.criteria(jobId) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.servicePackages.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
};

/** GET /jobs → mảng thô (đã kèm vendorJobs, serviceJobs, criteria). */
export function useJobsQuery(filters: JobListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.jobs.list(filters),
    queryFn: async () => {
      const res = await jobService.getJobs(filters);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
  });
}

/** GET /jobs/:id → chi tiết hạng mục. */
export function useJobDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: async () => {
      const res = await jobService.getJob(id);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** GET /job-criteria/job/:jobId → mảng thô tiêu chí đánh giá. */
export function useJobCriteriasQuery(jobId: string) {
  return useQuery({
    queryKey: queryKeys.jobs.criteria(jobId),
    queryFn: async () => {
      const res = await jobService.getJobCriterias(jobId);
      if (res.error) throw new Error(res.error);
      return res.data as JobCriteria[];
    },
    enabled: Boolean(jobId),
  });
}

/**
 * POST /jobs — ⚠️ DEDUPE theo `code`: nếu `code` đã tồn tại, backend trả về job CŨ.
 * Caller (form) tự so `code` với `useJobsQuery()` để thông báo "upsert" cho người dùng.
 */
export function useCreateJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateJobPayload) => {
      const res = await jobService.createJob(payload);
      if (res.error) throw new Error(res.error);
      return res.data as Job | null;
    },
    onSuccess: (data) => invalidateJobScope(queryClient, { id: data?.id, jobId: data?.id }),
  });
}

/** PATCH /jobs/:id — partial, KHÔNG gửi `criteria` (dùng useSyncJobCriteriasMutation). */
export function useUpdateJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateJobPayload) => {
      const res = await jobService.updateJob(id, payload);
      if (res.error) throw new Error(res.error);
      return res.data as Job | null;
    },
    onSuccess: (data, variables) => invalidateJobScope(queryClient, { id: variables.id, jobId: variables.id }),
  });
}

/** DELETE /jobs/:id */
export function useDeleteJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await jobService.deleteJob(id);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_data, variables) => invalidateJobScope(queryClient, { id: variables.id }),
  });
}

/**
 * PUT /job-criteria/job/:jobId — mảng trần `[{ id?, name, description }]`, replace-toàn-bộ.
 * Caller PHẢI giữ `id` của tiêu chí đã tồn tại.
 */
export function useSyncJobCriteriasMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { jobId: string; criteria: JobCriteriaInput[] }) => {
      const res = await jobService.syncJobCriterias(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_data, variables) =>
      invalidateJobScope(queryClient, { id: variables.jobId, jobId: variables.jobId }),
  });
}
