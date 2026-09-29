import {
  PAUSE_DURATION_DAYS,
  REMINDER_WINDOW_DAYS,
  canApproveClose,
  canApprovePause,
  canCloseDirect,
  canPauseDirect,
  canRequestClose,
  canRequestPause,
  canResume,
  getDaysUntilAutoClose,
  getPauseHistoryActorLabel,
  isInReminderWindow,
  shouldShowPauseTab,
  type ProjectPermissionContext,
} from '@/utils/projectPause';

const ctx = (overrides: Partial<ProjectPermissionContext> = {}): ProjectPermissionContext => ({
  role: 'STAFF_A',
  isTeamLead: false,
  isProjectManagerMember: false,
  isBdOwner: false,
  ...overrides,
});

describe('P1.11 Project Pause/Close — hằng số nghiệp vụ', () => {
  it('thời gian tạm dừng tối đa 37 ngày và cửa sổ nhắc nhở 7 ngày', () => {
    expect(PAUSE_DURATION_DAYS).toBe(37);
    expect(REMINDER_WINDOW_DAYS).toBe(7);
  });
});

describe('P1.11 RBAC tạm dừng / làm tiếp / đóng dự án', () => {
  it('xin tạm dừng chỉ khi dự án IN_PROGRESS và đúng vai trò', () => {
    expect(canRequestPause('IN_PROGRESS', ctx({ role: 'ADMIN' }))).toBe(true);
    expect(canRequestPause('IN_PROGRESS', ctx({ role: 'BOD' }))).toBe(true);
    expect(
      canRequestPause('IN_PROGRESS', ctx({ role: 'PM', isProjectManagerMember: true })),
    ).toBe(true);
    expect(
      canRequestPause('IN_PROGRESS', ctx({ role: 'BD', isBdOwner: true })),
    ).toBe(true);

    // PM không thuộc dự án, BD không sở hữu, Account/Team Lead đều bị chặn.
    expect(canRequestPause('IN_PROGRESS', ctx({ role: 'PM' }))).toBe(false);
    expect(canRequestPause('IN_PROGRESS', ctx({ role: 'BD' }))).toBe(false);
    expect(canRequestPause('IN_PROGRESS', ctx({ role: 'ADMIN_SALE' }))).toBe(false);
    expect(canRequestPause('IN_PROGRESS', ctx({ role: 'STAFF_A', isTeamLead: true }))).toBe(false);

    // Sai trạng thái dự án.
    expect(canRequestPause('ON_HOLD', ctx({ role: 'ADMIN' }))).toBe(false);
    expect(canRequestPause(undefined, ctx({ role: 'ADMIN' }))).toBe(false);
  });

  it('tạm dừng ngay chỉ dành cho BOD/ADMIN', () => {
    expect(canPauseDirect('IN_PROGRESS', ctx({ role: 'BOD' }))).toBe(true);
    expect(canPauseDirect('IN_PROGRESS', ctx({ role: 'ADMIN' }))).toBe(true);
    expect(canPauseDirect('IN_PROGRESS', ctx({ role: 'PM', isProjectManagerMember: true }))).toBe(
      false,
    );
    expect(canPauseDirect('ON_HOLD', ctx({ role: 'ADMIN' }))).toBe(false);
  });

  it('duyệt yêu cầu tạm dừng là BOD/ADMIN', () => {
    expect(canApprovePause(ctx({ role: 'BOD' }))).toBe(true);
    expect(canApprovePause(ctx({ role: 'ADMIN' }))).toBe(true);
    expect(canApprovePause(ctx({ role: 'ADMIN_SALE' }))).toBe(false);
    expect(canApprovePause(ctx({ role: 'PM' }))).toBe(false);
  });

  it('duyệt yêu cầu đóng dự án gồm cả ADMIN_SALE', () => {
    expect(canApproveClose(ctx({ role: 'BOD' }))).toBe(true);
    expect(canApproveClose(ctx({ role: 'ADMIN' }))).toBe(true);
    expect(canApproveClose(ctx({ role: 'ADMIN_SALE' }))).toBe(true);
    expect(canApproveClose(ctx({ role: 'PM' }))).toBe(false);
    expect(canApproveClose(ctx({ role: 'BD' }))).toBe(false);
  });

  it('làm tiếp chỉ khi ON_HOLD và đúng vai trò', () => {
    expect(canResume('ON_HOLD', ctx({ role: 'ADMIN' }))).toBe(true);
    expect(canResume('ON_HOLD', ctx({ role: 'PM', isProjectManagerMember: true }))).toBe(true);
    expect(canResume('ON_HOLD', ctx({ role: 'BD', isBdOwner: true }))).toBe(true);
    expect(canResume('ON_HOLD', ctx({ role: 'PM' }))).toBe(false);
    expect(canResume('ON_HOLD', ctx({ role: 'BD' }))).toBe(false);
    expect(canResume('IN_PROGRESS', ctx({ role: 'ADMIN' }))).toBe(false);
  });

  it('đóng ngay chỉ khi ON_HOLD và là BOD/ADMIN hoặc BD sở hữu', () => {
    expect(canCloseDirect('ON_HOLD', ctx({ role: 'ADMIN' }))).toBe(true);
    expect(canCloseDirect('ON_HOLD', ctx({ role: 'BOD' }))).toBe(true);
    expect(canCloseDirect('ON_HOLD', ctx({ role: 'BD', isBdOwner: true }))).toBe(true);
    // PM thuộc dự án KHÔNG được đóng ngay, chỉ được đề nghị đóng.
    expect(canCloseDirect('ON_HOLD', ctx({ role: 'PM', isProjectManagerMember: true }))).toBe(
      false,
    );
    expect(canCloseDirect('IN_PROGRESS', ctx({ role: 'ADMIN' }))).toBe(false);
  });

  it('đề nghị đóng dự án khi ON_HOLD bởi BOD/ADMIN hoặc PM dự án', () => {
    expect(canRequestClose('ON_HOLD', ctx({ role: 'ADMIN' }))).toBe(true);
    expect(canRequestClose('ON_HOLD', ctx({ role: 'PM', isProjectManagerMember: true }))).toBe(
      true,
    );
    expect(canRequestClose('ON_HOLD', ctx({ role: 'PM' }))).toBe(false);
    expect(canRequestClose('IN_PROGRESS', ctx({ role: 'ADMIN' }))).toBe(false);
  });
});

describe('P1.11 Banner tự động đóng D+37', () => {
  const pausedAt = new Date('2026-01-01T00:00:00.000Z');
  const autoAcceptAt = new Date('2026-02-07T00:00:00.000Z').toISOString(); // 37 ngày sau

  it('autoAcceptAt đúng bằng pausedAt + 37 ngày', () => {
    const expected = new Date(pausedAt.getTime() + PAUSE_DURATION_DAYS * 86400000).toISOString();
    expect(autoAcceptAt).toBe(expected);
  });

  it('tính số ngày còn lại và làm tròn lên', () => {
    const now = new Date('2026-01-31T00:00:00.000Z'); // còn 7 ngày
    expect(getDaysUntilAutoClose('ON_HOLD', autoAcceptAt, now)).toBe(7);

    const oneHourBefore = new Date('2026-02-06T23:00:00.000Z');
    expect(getDaysUntilAutoClose('ON_HOLD', autoAcceptAt, oneHourBefore)).toBe(1);

    const after = new Date('2026-02-10T00:00:00.000Z');
    expect(getDaysUntilAutoClose('ON_HOLD', autoAcceptAt, after)).toBe(0);
  });

  it('không tính khi dự án không ở trạng thái ON_HOLD hoặc thiếu autoAcceptAt', () => {
    expect(getDaysUntilAutoClose('IN_PROGRESS', autoAcceptAt)).toBeNull();
    expect(getDaysUntilAutoClose('ON_HOLD', undefined)).toBeNull();
    expect(getDaysUntilAutoClose('ON_HOLD', 'không-phải-ngày')).toBeNull();
  });

  it('cửa sổ nhắc nhở khi còn <= 7 ngày', () => {
    expect(
      isInReminderWindow('ON_HOLD', autoAcceptAt, new Date('2026-01-31T00:00:00.000Z')),
    ).toBe(true);
    expect(
      isInReminderWindow('ON_HOLD', autoAcceptAt, new Date('2026-01-20T00:00:00.000Z')),
    ).toBe(false);
    expect(
      isInReminderWindow('IN_PROGRESS', autoAcceptAt, new Date('2026-01-31T00:00:00.000Z')),
    ).toBe(false);
  });
});

describe('P1.11 Hiển thị tab & lịch sử', () => {
  it('tab Lịch sử tạm dừng hiện đúng điều kiện', () => {
    expect(shouldShowPauseTab({ status: 'ON_HOLD' })).toBe(true);
    expect(shouldShowPauseTab({ status: 'PENDING_PAUSE_APPROVAL' })).toBe(true);
    expect(shouldShowPauseTab({ status: 'IN_PROGRESS', pausedAt: '2026-01-01' })).toBe(true);
    expect(shouldShowPauseTab({ status: 'IN_PROGRESS', role: 'ADMIN' })).toBe(true);
    expect(shouldShowPauseTab({ status: 'IN_PROGRESS', role: 'BOD' })).toBe(true);
    expect(shouldShowPauseTab({ status: 'IN_PROGRESS', role: 'PM' })).toBe(true);
    expect(shouldShowPauseTab({ status: 'IN_PROGRESS', role: 'STAFF_A' })).toBe(false);
  });

  it('người thực hiện trong lịch sử: hệ thống tự đóng được ghi nhãn riêng', () => {
    expect(
      getPauseHistoryActorLabel({ id: '1', closedByType: 'SYSTEM', closedBy: { id: 'u', fullName: 'A' } }),
    ).toBe('Hệ thống tự đóng (D+37)');
    expect(
      getPauseHistoryActorLabel({ id: '1', approver: { id: 'u', fullName: 'Nguyễn Văn BOD' } }),
    ).toBe('Nguyễn Văn BOD');
    expect(getPauseHistoryActorLabel({ id: '1' })).toBe('—');
  });
});
