import { isProjectAccountUser, resolveEffectiveTeamMembers } from '@/utils/teamMember';

describe('resolveEffectiveTeamMembers', () => {
  const pmSnapshot = [
    { id: 'member-pm', roles: [{ role: 'PROJECT_MANAGER' }], user: { id: 'pm-1' } },
  ];
  const freshMembers = [
    ...pmSnapshot,
    { id: 'member-editor', roles: [{ role: 'EDITOR' }], user: { id: 'editor-1' } },
  ];

  it('ưu tiên danh sách mới từ endpoint team members thay vì snapshot chỉ có PM', () => {
    expect(resolveEffectiveTeamMembers(freshMembers, pmSnapshot)).toEqual(freshMembers);
  });

  it('fallback về thành viên trong project detail khi endpoint chưa có dữ liệu', () => {
    expect(resolveEffectiveTeamMembers([], pmSnapshot)).toEqual(pmSnapshot);
    expect(resolveEffectiveTeamMembers(undefined, pmSnapshot)).toEqual(pmSnapshot);
  });
});

describe('isProjectAccountUser', () => {
  const members = [
    { id: 'member-account', roles: [{ role: 'ACCOUNT' }], user: { id: 'account-1' } },
    { id: 'member-editor', roles: [{ role: 'EDITOR' }], user: { id: 'editor-1' } },
  ];

  it('cho phép thành viên có vai trò ACCOUNT phân công công việc', () => {
    expect(isProjectAccountUser('account-1', undefined, members)).toBe(true);
  });

  it('giữ tương thích team lead cũ và từ chối thành viên thường', () => {
    expect(isProjectAccountUser('legacy-lead', 'legacy-lead', members)).toBe(true);
    expect(isProjectAccountUser('editor-1', undefined, members)).toBe(false);
  });
});
