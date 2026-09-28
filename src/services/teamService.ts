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
}

export const TEAM_MEMBER_ROLE = {
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  ACCOUNT: 'ACCOUNT',
  CONTENT_CREATOR: 'CONTENT_CREATOR',
  EDITOR: 'EDITOR',
  GRAPHIC_DESIGNER: 'GRAPHIC_DESIGNER',
  CAMERAMAN: 'CAMERAMAN',
  SCRIPTER: 'SCRIPTER',
  SOCIAL_MEDIA_MANAGER: 'SOCIAL_MEDIA_MANAGER',
  SEO_SPECIALIST: 'SEO_SPECIALIST',
};

export const TEAM_MEMBER_ROLE_LABELS: Record<string, string> = {
  CONTENT_CREATOR: 'Nội dung',
  EDITOR: 'Editor',
  GRAPHIC_DESIGNER: 'Thiết kế đồ họa',
  CAMERAMAN: 'Quay phim',
  PROJECT_MANAGER: 'Quản lý dự án',
  // Chuẩn hóa nhãn theo Web 28-09-2026 (erp-UI/src/utils/enums.js:352):
  // ACCOUNT hiển thị "Account" thay cho "Lead dự án"/"Account dự án".
  // Enum gửi API vẫn giữ nguyên là `ACCOUNT`.
  ACCOUNT: 'Account',
  SCRIPTER: 'Biên kịch',
  SOCIAL_MEDIA_MANAGER: 'Quản lý MXH',
  SEO_SPECIALIST: 'Chuyên viên SEO',
};

export const USER_ROLE: Record<string, string> = {
  ADMIN: 'Admin',
  BOD: 'BOD',
  ADMIN_SALE: 'ADMIN kinh doanh',
  BD: 'BD',
  PM: 'PM',
  STAFF_A: 'Nhân sự Level A',
  STAFF_B: 'Nhân sự Level B',
  STAFF_C: 'Nhân sự Level C',
  STAFF_D: 'Nhân sự Level D',
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
};
