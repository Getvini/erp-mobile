import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectService,
  ProjectItem,
  ProjectDetailItem,
  UserPMItem,
} from '@/services/projectService';
import {
  productDescriptionService,
  ProductDescriptionSubmission,
} from '@/services/productDescriptionService';
import { teamService } from '@/services/teamService';
import { queryKeys } from '@/services/queryKeys';

export interface ProjectListFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Hook to fetch list of projects with caching & filters
 */
export function useProjectsQuery(filters: ProjectListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: async () => {
      const res = await projectService.getProjects(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Hook to fetch detail of a single project
 */
export function useProjectDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: async () => {
      const res = await projectService.getProjectById(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to fetch project by contract ID
 */
export function useProjectByContractQuery(contractId: string) {
  return useQuery({
    queryKey: [...queryKeys.projects.all, 'by-contract', contractId],
    queryFn: async () => {
      const res = await projectService.getProjectByContract(contractId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(contractId),
  });
}

/**
 * Hook to fetch list of Project Managers
 */
export function usePmUsersQuery() {
  return useQuery({
    queryKey: [...queryKeys.projects.all, 'pm-users'],
    queryFn: async () => {
      const res = await projectService.getPmUsers();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Hook to assign PM to project / contract
 */
export function useAssignProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, pmId }: { contractId: string; pmId: string | null }) => {
      const res = await projectService.assignProject(contractId, pmId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}

/**
 * Hook to update project status
 */
export function useUpdateProjectStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await projectService.updateProjectStatus(id, status);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.id) });
    },
  });
}

/**
 * Hook to update project progress
 */
export function useUpdateProjectProgressMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const res = await projectService.updateProjectProgress(id, progress);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.id) });
    },
  });
}

/**
 * Hook to confirm project initialization
 */
export function useConfirmProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await projectService.confirmProject(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
    },
  });
}

// ==========================================
// PRODUCT DESCRIPTIONS (MÔ TẢ SẢN PHẨM)
// ==========================================

/**
 * Hook to fetch product description submissions for a project
 */
export function useProductDescriptionsQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.productDescriptions(projectId),
    queryFn: async () => {
      const res = await productDescriptionService.getSubmissions(projectId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(projectId),
  });
}

/**
 * Hook to create a draft product description submission
 */
export function useCreateProductDescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, payload }: { projectId: string; payload: { items: any[] } }) => {
      const res = await productDescriptionService.createSubmission(projectId, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.productDescriptions(variables.projectId),
      });
    },
  });
}

/**
 * Hook to update a draft product description submission
 */
export function useUpdateProductDescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      submissionId,
      payload,
    }: {
      projectId: string;
      submissionId: string;
      payload: { items: any[] };
    }) => {
      const res = await productDescriptionService.updateSubmission(projectId, submissionId, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.productDescriptions(variables.projectId),
      });
    },
  });
}


/**
 * Hook to submit product description for approval
 */
export function useSubmitProductDescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, submissionId }: { projectId: string; submissionId: string }) => {
      const res = await productDescriptionService.submitSubmission(projectId, submissionId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.productDescriptions(variables.projectId),
      });
    },
  });
}

/**
 * Hook to approve product description submission
 */
export function useApproveProductDescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, submissionId }: { projectId: string; submissionId: string }) => {
      const res = await productDescriptionService.approveSubmission(projectId, submissionId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.productDescriptions(variables.projectId),
      });
    },
  });
}

/**
 * Hook to reject product description submission
 */
export function useRejectProductDescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      submissionId,
      reviewNote,
    }: {
      projectId: string;
      submissionId: string;
      reviewNote?: string;
    }) => {
      const res = await productDescriptionService.rejectSubmission(
        projectId,
        submissionId,
        reviewNote
      );
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.productDescriptions(variables.projectId),
      });
    },
  });
}

/**
 * Hook to fetch team members for a team
 */
export function useTeamMembersQuery(teamId?: string) {
  return useQuery({
    queryKey: ['teams', 'members', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const res = await teamService.getTeamMembers(teamId, month, year);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(teamId),
  });
}

/**
 * Hook to update team member role
 */
export function useUpdateTeamMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      memberId,
      role,
    }: {
      teamId: string;
      memberId: string;
      role: string;
    }) => {
      const res = await teamService.updateTeamMemberRole(teamId, memberId, role);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: ['teams', 'members', variables.teamId] });
    },
  });
}

/**
 * Hook to fetch available company users for project team with workload
 */
export function useAvailableUsersQuery() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return useQuery({
    queryKey: ['users', 'available', month, year],
    queryFn: async () => {
      const res = await teamService.getAvailableUsers(month, year);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Hook to add member to team
 */
export function useAddTeamMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      userId,
      role,
      roles,
    }: {
      teamId: string;
      userId: string;
      role?: string;
      roles?: string[];
    }) => {
      const res = await teamService.addTeamMember(teamId, userId, role, roles);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: ['teams', 'members', variables.teamId] });
    },
  });
}

/**
 * Hook to update team member roles (multi-role)
 */
export function useUpdateTeamMemberRolesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      userId,
      roles,
    }: {
      teamId: string;
      userId: string;
      roles: string[];
    }) => {
      const res = await teamService.updateTeamMemberRoles(teamId, userId, roles);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: ['teams', 'members', variables.teamId] });
    },
  });
}

/**
 * Hook to remove member from team
 */
export function useRemoveTeamMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      const res = await teamService.removeTeamMember(teamId, memberId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: ['teams', 'members', variables.teamId] });
    },
  });
}

// ==========================================
// MONTHLY WORK ADDENDUMS (CÔNG VIỆC THÁNG MỚI)
// ==========================================

export function useMonthlyWorkTemplateQuery(projectId: string, month: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.projects.detail(projectId), 'monthly-work-template', month],
    queryFn: async () => {
      const res = await projectService.getMonthlyWorkTemplate(projectId, month);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(projectId) && Boolean(month) && enabled,
  });
}

export function useCreateMonthlyWorkAddendumMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      payload,
    }: {
      projectId: string;
      payload: { monthKey: string; name?: string; description?: string; items: any[] };
    }) => {
      const res = await projectService.createMonthlyWorkAddendum(projectId, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}

