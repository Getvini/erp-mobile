import {
  ALLOCATION_PERCENT_REGEX,
  computeParentRemainingReward,
  computeSubtaskRewards,
  isTotalAllocationComplete,
  validateAllocationPercent,
  validateSubtaskAllocationTotal,
} from '@/utils/subtaskReward';
import {
  DEFAULT_DEADLINE_TIME,
  SUBTASK_DONE_STATUSES,
  TASK_STATUS_LABELS,
  buildMonthCells,
  canRework,
  canStartTask,
  canSubmitResult,
  combineDateWithDefaultTime,
  getBlockingSubtasks,
  getMonthRange,
  getSubtaskBlockMessage,
  getWorkloadDayTone,
  isParentBlockedBySubtasks,
} from '@/utils/taskLifecycle';

describe('P1.12 % thưởng subtask — thuật toán chia quỹ', () => {
  it('chia quỹ theo đúng tỷ lệ khi tổng = 100%', () => {
    const rewards = computeSubtaskRewards(100, [
      { id: 'a', allocationPercent: 30 },
      { id: 'b', allocationPercent: 30 },
      { id: 'c', allocationPercent: 40 },
    ]);

    expect(rewards).toEqual([
      { id: 'a', basisPoints: 3000, reward: 30 },
      { id: 'b', basisPoints: 3000, reward: 30 },
      { id: 'c', basisPoints: 4000, reward: 40 },
    ]);
    expect(computeParentRemainingReward(100, [
      { id: 'a', allocationPercent: 30 },
      { id: 'b', allocationPercent: 30 },
      { id: 'c', allocationPercent: 40 },
    ])).toBe(0);
  });

  it('sàn dư theo largest remainder, tổng luôn khớp phần chia theo %', () => {
    // Quỹ 1 Vinicoin = 1000 milli; 33,33 / 33,33 / 33,34
    const rewards = computeSubtaskRewards(1, [
      { id: 'a', allocationPercent: 33.33 },
      { id: 'b', allocationPercent: 33.33 },
      { id: 'c', allocationPercent: 33.34 },
    ]);

    const total = rewards.reduce((sum, item) => sum + item.reward, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(rewards.find((item) => item.id === 'c')?.reward).toBeCloseTo(0.334, 10);
    expect(rewards.find((item) => item.id === 'a')?.reward).toBeCloseTo(0.333, 10);
  });

  it('kết quả tất định theo id dù đầu vào đảo thứ tự', () => {
    const first = computeSubtaskRewards(7, [
      { id: 'b', allocationPercent: 10 },
      { id: 'a', allocationPercent: 15 },
    ]);
    const second = computeSubtaskRewards(7, [
      { id: 'a', allocationPercent: 15 },
      { id: 'b', allocationPercent: 10 },
    ]);
    expect(first).toEqual(second);
    expect(first.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('tổng tỷ lệ vượt 100% thì ném RangeError', () => {
    expect(() =>
      computeSubtaskRewards(100, [
        { id: 'a', allocationPercent: 60 },
        { id: 'b', allocationPercent: 60 },
      ]),
    ).toThrow(RangeError);
    expect(() =>
      computeSubtaskRewards(100, [
        { id: 'a', allocationPercent: 60 },
        { id: 'b', allocationPercent: 60 },
      ]),
    ).toThrow('Tổng tỷ lệ công việc con không được vượt quá 100%');
  });

  it('thưởng không âm và bằng 0 khi chưa phân bổ', () => {
    expect(computeSubtaskRewards(0, [{ id: 'a', allocationPercent: 50 }])[0].reward).toBe(0);
    expect(computeSubtaskRewards(-5, [{ id: 'a', allocationPercent: 50 }])[0].reward).toBe(0);
    expect(computeSubtaskRewards(10, [])).toEqual([]);
  });

  it('thưởng còn lại của task cha = quỹ - phần đã chia', () => {
    expect(
      computeParentRemainingReward(100, [
        { id: 'a', allocationPercent: 50 },
        { id: 'b', allocationPercent: 30 },
      ]),
    ).toBe(20);
    expect(computeParentRemainingReward(100, [{ id: 'a', allocationPercent: 100 }])).toBe(0);
  });

  it('làm tròn % về 2 chữ số thập phân (basis points)', () => {
    const rewards = computeSubtaskRewards(100, [{ id: 'a', allocationPercent: 12.345 }]);
    expect(rewards[0].basisPoints).toBe(1235);
  });
});

describe('P1.12 % thưởng subtask — validation', () => {
  it('tổng ≤ 100% hợp lệ, > 100% không hợp lệ', () => {
    expect(validateSubtaskAllocationTotal([
      { id: 'a', allocationPercent: 60 },
      { id: 'b', allocationPercent: 40 },
    ])).toEqual({ totalBasisPoints: 10000, valid: true });

    const invalid = validateSubtaskAllocationTotal([
      { id: 'a', allocationPercent: 60 },
      { id: 'b', allocationPercent: 60 },
    ]);
    expect(invalid.valid).toBe(false);
    expect(invalid.totalBasisPoints).toBe(12000);
    expect(invalid.message).toContain('không được vượt quá 100%');
  });

  it('trước khi gửi duyệt phương án, tổng phải ĐÚNG 100%', () => {
    expect(isTotalAllocationComplete([
      { id: 'a', allocationPercent: 50 },
      { id: 'b', allocationPercent: 50 },
    ])).toBe(true);
    expect(isTotalAllocationComplete([
      { id: 'a', allocationPercent: 50 },
      { id: 'b', allocationPercent: 40 },
    ])).toBe(false);
  });

  it('validate ô nhập %: >0, ≤100 và ≤ phần còn lại', () => {
    expect(validateAllocationPercent(12.5, 100)).toBeNull();
    expect(validateAllocationPercent('12,5', 100)).toBeNull();
    expect(validateAllocationPercent(0, 100)).toBe('Tỷ lệ phân bổ phải lớn hơn 0');
    expect(validateAllocationPercent(-1, 100)).toBe('Tỷ lệ phân bổ phải lớn hơn 0');
    expect(validateAllocationPercent(101, 100)).toBe('Tỷ lệ phân bổ không được vượt quá 100%');
    expect(validateAllocationPercent(25, 20)).toContain('không được vượt quá 20%');
    expect(validateAllocationPercent('abc', 100)).toBe('Tỷ lệ phân bổ phải lớn hơn 0');
  });

  it('regex % tỷ lệ đúng quality gate', () => {
    expect(ALLOCATION_PERCENT_REGEX.test('100')).toBe(true);
    expect(ALLOCATION_PERCENT_REGEX.test('99.99')).toBe(true);
    expect(ALLOCATION_PERCENT_REGEX.test('0')).toBe(true);
    expect(ALLOCATION_PERCENT_REGEX.test('100.01')).toBe(false);
    expect(ALLOCATION_PERCENT_REGEX.test('123')).toBe(false);
  });
});

describe('P1.12 Task lifecycle — trạng thái & điều kiện hành động', () => {
  it('nhãn trạng thái đúng chuẩn Web', () => {
    expect(TASK_STATUS_LABELS.PENDING).toBe('Chờ phân công');
    expect(TASK_STATUS_LABELS.DOING).toBe('Đang thực hiện');
    expect(TASK_STATUS_LABELS.AWAITING_REVIEW).toBe('Đang chờ duyệt');
    expect(TASK_STATUS_LABELS.INTERNAL_COMPLETED).toBe('Hoàn thành nội bộ');
    expect(TASK_STATUS_LABELS.ACCEPTED).toBe('Đã được nghiệm thu');
    expect(TASK_STATUS_LABELS.ON_HOLD).toBe('Tạm dừng');
  });

  it('chỉ bắt đầu được task NOT_STARTED', () => {
    expect(canStartTask('NOT_STARTED', true)).toBe(true);
    expect(canStartTask('NOT_STARTED', false)).toBe(false);
    expect(canStartTask('DOING', true)).toBe(false);
  });

  it('chỉ nộp kết quả ở các trạng thái cho phép', () => {
    [
      'DOING',
      'REJECTED',
      'REJECTED_BILLABLE', // Account đã duyệt, khách chưa duyệt → làm lại (có phí)
      'REJECTED_SUPPORT', // Account đã duyệt, khách chưa duyệt → làm lại (hỗ trợ)
      'REWORKING',
      'OVERDUE',
    ].forEach((status) => {
      expect(canSubmitResult(status)).toBe(true);
    });
    expect(canSubmitResult('NOT_STARTED')).toBe(false);
    expect(canSubmitResult('AWAITING_REVIEW')).toBe(false);
  });

  it('chỉ làm lại khi đã nộp / hoàn thành', () => {
    expect(canRework('AWAITING_REVIEW')).toBe(true);
    expect(canRework('INTERNAL_COMPLETED')).toBe(true);
    expect(canRework('DOING')).toBe(false);
  });

  it('task cha bị chặn khi còn subtask chưa hoàn tất', () => {
    const parent = {
      id: 'p',
      parentTaskId: null,
      subtasks: [
        { id: 's1', code: 'ST-1', status: 'COMPLETED' },
        { id: 's2', code: 'ST-2', status: 'INTERNAL_COMPLETED' },
        { id: 's3', code: 'ST-3', status: 'ACCEPTED' },
      ],
    };
    expect(getBlockingSubtasks(parent.subtasks)).toHaveLength(0);
    expect(isParentBlockedBySubtasks(parent)).toBe(false);

    const blocked = {
      ...parent,
      subtasks: [...parent.subtasks, { id: 's4', code: 'ST-4', status: 'DOING' }],
    };
    expect(getBlockingSubtasks(blocked.subtasks)).toHaveLength(1);
    expect(isParentBlockedBySubtasks(blocked)).toBe(true);

    const message = getSubtaskBlockMessage('nộp kết quả', blocked.subtasks);
    expect(message).toContain('1 subtask');
    expect(message).toContain('ST-4');
  });

  it('task con không bị áp dụng kiểm tra subtask', () => {
    expect(
      isParentBlockedBySubtasks({
        parentTaskId: 'p',
        subtasks: [{ id: 's', status: 'DOING' }],
      }),
    ).toBe(false);
  });

  it('danh sách trạng thái subtask được coi là xong', () => {
    expect(SUBTASK_DONE_STATUSES).toEqual(['INTERNAL_COMPLETED', 'COMPLETED', 'ACCEPTED']);
  });
});

describe('P1.12 Lịch tải nhân sự & chọn ngày phân công', () => {
  it('ngưỡng màu tải: >=100 đỏ, >=70 vàng, >0 xanh, còn lại xám', () => {
    expect(getWorkloadDayTone(120, 3)).toBe('danger');
    expect(getWorkloadDayTone(100, 1)).toBe('danger');
    expect(getWorkloadDayTone(70, 1)).toBe('warning');
    expect(getWorkloadDayTone(45, 0)).toBe('info');
    expect(getWorkloadDayTone(0, 2)).toBe('info');
    expect(getWorkloadDayTone(0, 0)).toBe('muted');
  });

  it('khoảng ngày của tháng đúng ngày cuối tháng', () => {
    expect(getMonthRange(new Date(2026, 1, 15))).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    expect(getMonthRange(new Date(2026, 11, 5))).toEqual({
      startDate: '2026-12-01',
      endDate: '2026-12-31',
    });
  });

  it('lịch tháng bắt đầu từ Thứ Hai và pad đủ tuần', () => {
    // 01-02-2026 là Chủ nhật ⇒ có 6 ô trống đầu tuần.
    const cells = buildMonthCells(new Date(2026, 1, 1));
    expect(cells).toHaveLength(35);
    expect(cells.filter((cell) => cell.day === null)).toHaveLength(7); // 6 đầu + 1 cuối
    expect(cells[6]).toEqual({ dateKey: '2026-02-01', day: 1 });
    expect(cells).toHaveLength(Math.ceil(cells.length / 7) * 7);
  });

  it('chọn ngày giữ giờ deadline mặc định 17:30', () => {
    expect(DEFAULT_DEADLINE_TIME).toBe('17:30');
    expect(combineDateWithDefaultTime('2026-02-10')).toBe('2026-02-10T17:30');
    expect(combineDateWithDefaultTime(null)).toBe('');
    expect(combineDateWithDefaultTime(undefined)).toBe('');
  });
});
