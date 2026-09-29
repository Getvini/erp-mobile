import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import {
  teamService,
  type Team,
  type TeamMemberEntry,
  type TeamMemberUser,
} from '@/services/teamService';
import { queryKeys } from '@/services/queryKeys';

/**
 * PHASE P3 — CƠ CẤU ĐỘI NHÓM (Teams)
 *
 * ⚠️ LƯU Ý QUAN TRỌNG VỀ TÊN HOOK:
 * Một số hook dưới đây TRÙNG TÊN với hook đã có trong `src/hooks/queries/useProjects.ts`
 * (`useAddTeamMemberMutation`, `useUpdateTeamMemberRolesMutation`, `useRemoveTeamMemberMutation`)
 * và hook danh sách thành viên đã được đổi tên thành `useTeamMembersByTeamQuery`
 * (thay cho `useTeamMembersQuery` của useProjects).
 *
 * ⇒ TUYỆT ĐỐI KHÔNG thêm `export * from './useTeams'` vào `src/hooks/queries/index.ts`
 *   (sẽ gây lỗi TypeScript "already exported a member"). Hãy import TRỰC TIẾP:
 *   `import { useTeamsQuery } from '@/hooks/queries/useTeams';`
 */

export interface TeamListFilters {
  search?: string;
}

/**
 * Invalidation dùng chung cho mọi thao tác Teams:
 * teams.all + detail(id) + members(id) + projects.all (team nằm trong project detail).
 */
const invalidateTeamScope = (queryClient: QueryClient, teamId?: string) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
  if (teamId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(teamId) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
};

/** GET /teams — mảng thô, không phân trang (Web phân trang client-side). */
export function useTeamsQuery(filters: TeamListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.teams.list(filters),
    queryFn: async (): Promise<Team[]> => {
      const res = await teamService.getTeams();
      if (res.error) {
        throw new Error(res.error);
      }
      return (res.data || []) as Team[];
    },
  });
}

/** GET /teams/:id — chi tiết đội (relations teamLead, members.user). */
export function useTeamDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.teams.detail(id),
    queryFn: async (): Promise<Team | undefined> => {
      const res = await teamService.getTeam(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * GET /teams/:id/members?month&year — danh sách thành viên kèm `user.workload`.
 * Tên khác `useTeamMembersQuery` của useProjects để tránh trùng khi barrel export.
 */
export function useTeamMembersByTeamQuery(
  teamId: string,
  params: { month?: number; year?: number } = {}
) {
  const { month, year } = params;
  return useQuery({
    queryKey: [...queryKeys.teams.members(teamId), month ?? null, year ?? null],
    queryFn: async (): Promise<TeamMemberEntry[]> => {
      const res = await teamService.getTeamMembersByTeam({ id: teamId, month, year });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(teamId),
  });
}

/**
 * Danh bạ nhân sự cho các selector của module Teams.
 *
 * TODO(P3-Users): module Users chưa có `src/hooks/queries/useUsers.ts` (chưa tồn tại
 * `useUsersQuery`) và chưa có `src/components/users/UserSelectorModal.tsx`.
 * Khi các file đó được bổ sung, thay hook fallback này bằng `useUsersQuery` chính thức
 * (key `queryKeys.users.list(filters)`) và thay selector bằng `UserSelectorModal`.
 */
export function useTeamUserDirectoryQuery() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async (): Promise<TeamMemberUser[]> => {
      const res = await apiService.get('/users', { limit: 100 });
      if (res.error) {
        throw new Error(res.error);
      }
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? (data as TeamMemberUser[]) : [];
    },
    staleTime: 60_000,
  });
}

/** POST /teams — `teamLeadId` BẮT BUỘC. */
export function useCreateTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; teamLeadId: string }) => {
      const res = await teamService.createTeam(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => invalidateTeamScope(queryClient),
  });
}

/** PUT /teams/:id */
export function useUpdateTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      teamLeadId,
    }: {
      id: string;
      name?: string;
      teamLeadId?: string;
    }) => {
      const res = await teamService.updateTeam({ id, name, teamLeadId });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateTeamScope(queryClient, variables.id),
  });
}

/** DELETE /teams/:id */
export function useDeleteTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await teamService.deleteTeam(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => invalidateTeamScope(queryClient, id),
  });
}

/** PUT /teams/:id/lead — chỉ ADMIN/BOD (PM nhận 403). */
export function useChangeTeamLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newLeadId }: { id: string; newLeadId: string }) => {
      const res = await teamService.changeTeamLead({ id, newLeadId });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateTeamScope(queryClient, variables.id),
  });
}

/** POST /teams/:id/members — luôn gửi `roles` dạng mảng. */
export function useAddTeamMemberMutation() {
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
      const res = await teamService.addTeamMembers({ id: teamId, userId, roles });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateTeamScope(queryClient, variables.teamId),
  });
}

/** PUT /teams/:id/members/:userId/roles — mảng rỗng sẽ bị backend từ chối (400). */
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
      const res = await teamService.updateMemberRoles({ id: teamId, userId, roles });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateTeamScope(queryClient, variables.teamId),
  });
}

/** DELETE /teams/members/:memberId — cần `teamId` để invalidate cache đúng đội. */
export function useRemoveTeamMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId }: { teamId: string; memberId: string }) => {
      const res = await teamService.removeTeamMemberById(memberId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => invalidateTeamScope(queryClient, variables.teamId),
  });
}
