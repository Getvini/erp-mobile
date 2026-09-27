/**
 * Team member role helpers (mirrors erp-UI/src/utils/teamMember.js)
 * Backend stores roles in member.roles (TeamMemberRoles entity).
 * member.role column has select: false, so roles are always in member.roles.
 */

export const getTeamMemberRoles = (member: any): unknown[] => {
  if (!member) return [];
  if (Array.isArray(member.roles)) {
    return [
      ...new Set(
        member.roles
          .map((item: any) => (typeof item === 'string' ? item : item?.role))
          .filter(Boolean)
      ),
    ];
  }
  return member.role ? [member.role] : [];
};

export const hasTeamMemberRole = (member: any, role: string): boolean => {
  const roles = getTeamMemberRoles(member);
  if (role === 'PROJECT_MANAGER' || role === 'PM') {
    return roles.includes('PROJECT_MANAGER') || roles.includes('PM');
  }
  if (role === 'LEAD' || role === 'TEAM_LEAD') {
    return roles.includes('LEAD') || roles.includes('TEAM_LEAD') || roles.includes('ACCOUNT');
  }
  return roles.includes(role);
};

export const getUserAccountRole = (user: any): string | null => {
  if (!user) return null;
  return user.account?.role || user.accounts?.[0]?.role || user.role || null;
};
export const getProjectManagerUser = (project?: any, members?: any[]): { id: string; fullName: string; email?: string } | null => {
  if (project?.projectManager?.id) {
    return project.projectManager;
  }
  const effectiveMembers = (members && members.length > 0) ? members : (project?.team?.members || []);
  const pmMember = effectiveMembers.find((m: any) => hasTeamMemberRole(m, 'PROJECT_MANAGER'));
  return pmMember?.user || null;
};

export const ROLE_DISPLAY_ORDER = [
  'PROJECT_MANAGER',
  'ACCOUNT',
  'EDITOR',
  'GRAPHIC_DESIGNER',
  'CONTENT_CREATOR',
  'CAMERAMAN',
  'SCRIPTER',
  'SOCIAL_MEDIA_MANAGER',
  'SEO_SPECIALIST',
];

export const sortRoles = (roles: string[]): string[] =>
  [...roles].sort(
    (a, b) => ROLE_DISPLAY_ORDER.indexOf(a) - ROLE_DISPLAY_ORDER.indexOf(b)
  );

export const getUserRolesInTeam = (members: any[], userId: string): string[] => {
  if (!members || !userId) return [];
  const roles: string[] = [];
  members.forEach((m) => {
    if (m?.user?.id === userId) {
      roles.push(...(getTeamMemberRoles(m) as string[]));
    }
  });
  return [...new Set(roles)];
};

export interface GroupedMember {
  userId: string;
  user: any;
  memberships: any[];
  roles: string[];
}

export const groupTeamMembers = (members: any[], teamLeadId?: string): GroupedMember[] => {
  if (!members || members.length === 0) return [];
  const groups = new Map<string, GroupedMember>();

  members.forEach((member) => {
    const userId = member.user?.id;
    if (!userId) return;
    const existing = groups.get(userId);
    const group: GroupedMember = existing || {
      userId,
      user: member.user,
      memberships: [] as any[],
      roles: [] as string[],
    };
    group.memberships.push(member);
    const memberRoles = (getTeamMemberRoles(member) as string[]) || [];
    memberRoles.forEach((r) => {
      if (r && !group.roles.includes(r)) {
        group.roles.push(r);
      }
    });
    if (!group.user?.workload && member.user?.workload) {
      group.user = member.user;
    }
    groups.set(userId, group);
  });

  const getPriority = (group: GroupedMember) => {
    if (group.roles.includes('PROJECT_MANAGER')) return 0;
    if (group.userId === teamLeadId || group.roles.includes('ACCOUNT')) return 1;
    return 2;
  };

  return [...groups.values()]
    .map((group) => ({
      ...group,
      roles: sortRoles([...new Set(group.roles)]),
    }))
    .sort((a, b) => {
      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.user?.fullName || '').localeCompare(b.user?.fullName || '', 'vi');
    });
};

