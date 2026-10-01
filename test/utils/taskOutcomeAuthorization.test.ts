import { canDecideTaskOutcome } from '@/utils/taskOutcomeAuthorization';

const member = (userId: string, role: string) => ({
  user: { id: userId },
  roles: [{ role }],
});

const baseTask = (overrides: Record<string, unknown> = {}) => ({
  assignerId: 'account-a',
  assigneeId: 'staff-a',
  helperId: null,
  project: {
    team: {
      members: [
        member('account-a', 'ACCOUNT'),
        member('account-b', 'ACCOUNT'),
        member('pm-a', 'PROJECT_MANAGER'),
      ],
    },
  },
  ...overrides,
});

describe('canDecideTaskOutcome', () => {
  it('task giao cho người khác chỉ người phân công được duyệt hoặc từ chối', () => {
    const task = baseTask();
    expect(canDecideTaskOutcome(task, 'account-a')).toBe(true);
    expect(canDecideTaskOutcome(task, 'pm-a')).toBe(false);
  });

  it('task tự phân công được PM của chính dự án duyệt hoặc từ chối', () => {
    const task = baseTask({ assignerId: 'staff-a', assigneeId: 'staff-a' });
    expect(canDecideTaskOutcome(task, 'pm-a')).toBe(true);
  });

  it('người thực hiện và PM ngoài dự án không được tự duyệt', () => {
    const task = baseTask({ assignerId: 'staff-a', assigneeId: 'staff-a' });
    expect(canDecideTaskOutcome(task, 'staff-a')).toBe(false);
    expect(canDecideTaskOutcome(task, 'pm-other')).toBe(false);
  });
});
