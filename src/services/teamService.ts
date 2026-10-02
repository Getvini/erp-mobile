import { apiService } from './api';

export interface TeamMember {
  id: string;
  role: string;
  user?: {
    id: string;
    fullName: string;
    email?: string;
    phoneNumber?: string;
    role?: string;
  };
}

export interface CompanyUser {
  id: string;
  fullName: string;
  email?: string;
  role?: string;
  workload?: any;
  accounts?: any[];
}

export const TEAM_MEMBER_ROLE = {
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  ACCOUNT: 'ACCOUNT',
  CONTENT_CREATOR: 'CONTENT_CREATOR',
  EDITOR: 'EDITOR',
  DESIGNER: 'DESIGNER',
  CAMERAMAN: 'CAMERAMAN',
  VIDEO_EDITOR: 'VIDEO_EDITOR',
  SOCIAL_MEDIA_MANAGER: 'SOCIAL_MEDIA_MANAGER',
};

export const TEAM_MEMBER_ROLE_LABELS: Record<string, string> = {
  CONTENT_CREATOR: 'Nội dung',
  EDITOR: 'Biên tập',
  DESIGNER: 'Thiết kế',
  VIDEO_EDITOR: 'Dựng video',
  CAMERAMAN: 'Quay',
  PROJECT_MANAGER: 'PM',
  ACCOUNT: 'Account',
  SOCIAL_MEDIA_MANAGER: 'Quản lý MXH',
};

export const USER_ROLE: Record<string, string> = {
  ADMIN: 'Admin',
  BOD: 'BOD',
  ADMIN_SALE: 'ADMIN kinh doanh',
  BD: 'BD',
  PM: 'PM',
  CONTENT_A: 'Content A',
  CONTENT_B: 'Content B',
  CONTENT_C: 'Content C',
  CONTENT_D: 'Content Intern',
  EDITOR_A: 'Editor A',
  EDITOR_B: 'Editor B',
  EDITOR_C: 'Editor C',
  EDITOR_D: 'Editor Intern',
  DESIGNER_A: 'Designer A',
  DESIGNER_B: 'Designer B',
  DESIGNER_C: 'Designer C',
  DESIGNER_D: 'Designer Intern',
};

export const teamService = {
  async getTeams() {
    const res = await apiService.get('/teams');
    const data = res.data?.data || res.data || [];
    return { data: Array.isArray(data) ? (data as any[]) : [], error: res.error };
  },

  async getTeamMembers(teamId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    const res = await apiService.get(`/teams/${teamId}/members`, { month: m, year: y });
    const data = res.data || res.data?.data || [];
    return { data: Array.isArray(data) ? (data as TeamMember[]) : [], error: res.error };
  },

  async addTeamMember(teamId: string, userId: string, role?: string, roles?: string[]) {
    const roleList = roles && roles.length > 0 ? roles : (role ? [role] : []);
    const res = await apiService.post(`/teams/${teamId}/members`, {
      userId,
      role: roleList[0],
      roles: roleList,
    });
    return { data: res.data?.data || res.data, error: res.error };
  },

  async updateTeamMemberRoles(teamId: string, userId: string, roles: string[]) {
    const res = await apiService.put(`/teams/${teamId}/members/${userId}/roles`, { roles });
    return { data: res.data?.data || res.data, error: res.error };
  },

  async updateTeamMemberRole(teamId: string, memberId: string, role: string) {
    // Web ERP endpoint: PUT /teams/members/:memberId
    let res = await apiService.put(`/teams/members/${memberId}`, { teamId, role });
    if (res.error && res.status === 404) {
      res = await apiService.put(`/teams/${teamId}/members/${memberId}`, { role });
    }
    return { data: res.data?.data || res.data, error: res.error };
  },

  async removeTeamMember(teamId: string, memberId: string) {
    const res = await apiService.delete(`/teams/${teamId}/members/${memberId}`);
    return { data: res.data?.data || res.data, error: res.error };
  },

  async getAvailableUsers(month?: number, year?: number) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    const res = await apiService.get('/users', { limit: 100, month: m, year: y });
    const data = res.data?.data || res.data || [];
    return { data: Array.isArray(data) ? (data as CompanyUser[]) : [], error: res.error };
  },

  /** GET /teams/:id — chi tiết một đội (relations: teamLead, members.user). */
  async getTeam(id: string) {
    const res = await apiService.get(`/teams/${id}`);
    const data = res.data?.data || res.data;
    return { data: (data || undefined) as Team | undefined, error: res.error, status: res.status };
  },

  /** GET /teams/:id/members?month&year — mảng thô member (kèm `user.workload`). */
  async getTeamMembersByTeam({
    id,
    month,
    year,
  }: {
    id: string;
    month?: number;
    year?: number;
  }) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    const res = await apiService.get(`/teams/${id}/members`, { month: m, year: y });
    const data = res.data?.data || res.data || [];
    return {
      data: (Array.isArray(data) ? data : []) as TeamMemberEntry[],
      error: res.error,
      status: res.status,
    };
  },

  /**
   * POST /teams — body `{ name, teamLeadId }`.
   */
  async createTeam(payload: { name: string; teamLeadId: string }) {
    const res = await apiService.post('/teams', {
      name: payload.name,
      teamLeadId: payload.teamLeadId,
    });
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },

  /** PUT /teams/:id — chỉ gửi các field được cung cấp. */
  async updateTeam({
    id,
    name,
    teamLeadId,
  }: {
    id: string;
    name?: string;
    teamLeadId?: string;
  }) {
    const body: Record<string, unknown> = {};
    if (name !== undefined) body.name = name;
    if (teamLeadId !== undefined) body.teamLeadId = teamLeadId;
    const res = await apiService.put(`/teams/${id}`, body);
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },

  /** DELETE /teams/:id */
  async deleteTeam(id: string) {
    const res = await apiService.delete(`/teams/${id}`);
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },

  /**
   * PUT /teams/:id/lead — body `{ newLeadId }`.
   */
  async changeTeamLead({ id, newLeadId }: { id: string; newLeadId: string }) {
    const res = await apiService.put(`/teams/${id}/lead`, { newLeadId });
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },

  /**
   * POST /teams/:id/members — body `{ userId, roles }`.
   */
  async addTeamMembers({
    id,
    userId,
    roles,
  }: {
    id: string;
    userId: string;
    roles: string[];
  }) {
    const res = await apiService.post(`/teams/${id}/members`, {
      userId,
      roles: Array.isArray(roles) ? roles : [],
    });
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },

  /**
   * PUT /teams/:id/members/:userId/roles — body `{ roles: string[] }`.
   */
  async updateMemberRoles({
    id,
    userId,
    roles,
  }: {
    id: string;
    userId: string;
    roles: string[];
  }) {
    const res = await apiService.put(`/teams/${id}/members/${userId}/roles`, {
      roles: Array.isArray(roles) ? roles : [],
    });
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },

  /** PATCH /teams/members/:memberId — body `{ role }` (vai trò đơn, endpoint legacy). */
  async updateMemberLegacyRole({ memberId, role }: { memberId: string; role: string }) {
    const res = await apiService.patch(`/teams/members/${memberId}`, { role });
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },

  /** DELETE /teams/members/:memberId — endpoint legacy theo `memberId`. */
  async removeTeamMemberById(memberId: string) {
    const res = await apiService.delete(`/teams/members/${memberId}`);
    return { data: res.data?.data || res.data, error: res.error, status: res.status };
  },
};

export interface TeamMemberUser {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  account?: any;
  role?: string;
  workload?: any;
}

export interface TeamMemberEntry {
  id: string;
  teamId?: string;
  userId?: string;
  role?: string;
  roles?: (string | { role?: string })[];
  user?: TeamMemberUser;
}

export interface Team {
  id: string;
  name: string;
  teamLeadId?: string | null;
  teamLead?: TeamMemberUser | null;
  members?: TeamMemberEntry[];
  createdAt?: string;
  updatedAt?: string;
}
