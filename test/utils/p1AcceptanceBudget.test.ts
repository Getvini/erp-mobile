import {
  countPendingResults,
  countRejectedResults,
  dedupeResultsByTask,
  findRejectedServiceMissingFeedback,
  getAcceptanceDisplayStatus,
  getAcceptanceReadOnlyReason,
  getPendingResults,
  isAcceptanceReadOnly,
  isAllRejected,
  isProjectClosed,
  isProjectOnHold,
  isServiceEligibleForAcceptance,
  validateAcceptanceDate,
} from '@/utils/acceptance';
import { computeBudgetVariance, getRemainingBudget } from '@/utils/projectBudget';

describe('P1.10 Acceptance — guard trạng thái dự án & biên bản', () => {
  it('nhận diện dự án đã đóng / tạm dừng', () => {
    expect(isProjectClosed('COMPLETED')).toBe(true);
    expect(isProjectClosed('CANCELLED')).toBe(true);
    expect(isProjectClosed('IN_PROGRESS')).toBe(false);
    expect(isProjectOnHold('ON_HOLD')).toBe(true);
    expect(isProjectOnHold('IN_PROGRESS', true)).toBe(true);
    expect(isProjectOnHold('IN_PROGRESS', false)).toBe(false);
  });

  it('read-only khi biên bản đã xử lý hoặc dự án đóng/tạm dừng', () => {
    expect(isAcceptanceReadOnly({ status: 'PENDING' })).toBe(false);
    expect(isAcceptanceReadOnly({ status: 'PROCESSED' })).toBe(true);
    expect(isAcceptanceReadOnly({ status: 'APPROVED' })).toBe(true);
    expect(isAcceptanceReadOnly({ status: 'PENDING', projectStatus: 'COMPLETED' })).toBe(true);
    expect(isAcceptanceReadOnly({ status: 'PENDING', projectStatus: 'CANCELLED' })).toBe(true);
    expect(isAcceptanceReadOnly({ status: 'PENDING', projectStatus: 'ON_HOLD' })).toBe(true);
    expect(isAcceptanceReadOnly({ status: 'PENDING', projectIsOnHold: true })).toBe(true);
  });

  it('lý do read-only hiển thị đúng thứ tự ưu tiên', () => {
    expect(getAcceptanceReadOnlyReason({ status: 'PENDING', projectStatus: 'COMPLETED' })).toBe(
      'Dự án đã hoàn tất hoặc đã đóng',
    );
    expect(getAcceptanceReadOnlyReason({ status: 'PENDING', projectStatus: 'ON_HOLD' })).toBe(
      'Dự án đang tạm dừng',
    );
    expect(getAcceptanceReadOnlyReason({ status: 'APPROVED' })).toBe(
      'Biên bản đã được xử lý xong',
    );
    expect(getAcceptanceReadOnlyReason({ status: 'PENDING' })).toBe('');
  });
});

describe('P1.10 Acceptance — tổng hợp kết quả', () => {
  it('gộp kết quả theo taskId và giữ bản ghi mới nhất', () => {
    const deduped = dedupeResultsByTask([
      { taskId: 't1', status: 'PENDING', name: 'cũ' },
      { taskId: 't1', status: 'APPROVED', name: 'mới' },
      { taskId: 't2', status: 'PENDING' },
    ] as any);
    expect(deduped).toHaveLength(2);
    expect(deduped.find((item) => item.taskId === 't1')?.status).toBe('APPROVED');
  });

  it('đếm kết quả chờ duyệt theo hạng mục và toàn biên bản', () => {
    const services = [
      { id: 's1', status: 'ACTIVE', results: [{ taskId: 't1', status: 'PENDING' }] },
      { id: 's2', status: 'ACTIVE', results: [{ taskId: 't2', status: 'APPROVED' }] },
    ] as any;
    expect(getPendingResults(services[0])).toHaveLength(1);
    expect(getPendingResults(services[1])).toHaveLength(0);
    expect(countPendingResults(services)).toBe(1);
  });

  it('hạng mục ACCEPTANCE_REJECTED/COMPLETED không còn kết quả chờ duyệt', () => {
    expect(
      getPendingResults({ id: 's', status: 'ACCEPTANCE_REJECTED', results: [{ taskId: 't', status: 'PENDING' }] } as any),
    ).toHaveLength(0);
    expect(
      getPendingResults({ id: 's', status: 'COMPLETED', results: [{ taskId: 't', status: 'PENDING' }] } as any),
    ).toHaveLength(0);
  });

  it('đếm kết quả bị từ chối', () => {
    expect(
      countRejectedResults({
        id: 's',
        results: [
          { taskId: 't1', status: 'REJECTED' },
          { taskId: 't2', status: 'APPROVED' },
        ],
      } as any),
    ).toBe(1);
  });

  it('trạng thái PROCESSED hiển thị động theo kết quả bị từ chối', () => {
    expect(getAcceptanceDisplayStatus('PROCESSED', [{ id: 's', results: [] }] as any)).toBe(
      'Đã nghiệm thu',
    );
    expect(
      getAcceptanceDisplayStatus('PROCESSED', [
        { id: 's', results: [{ taskId: 't', status: 'REJECTED' }] },
      ] as any),
    ).toBe('Từ chối nghiệm thu');
    expect(getAcceptanceDisplayStatus('PENDING', [])).toBe('PENDING');
  });

  it('nút xác nhận chuyển đỏ khi mọi hạng mục đều bị từ chối', () => {
    expect(isAllRejected({})).toBe(false);
    expect(
      isAllRejected({
        s1: { serviceId: 's1', status: 'REJECTED' },
        s2: { serviceId: 's2', status: 'REJECTED' },
      }),
    ).toBe(true);
    expect(
      isAllRejected({
        s1: { serviceId: 's1', status: 'REJECTED' },
        s2: { serviceId: 's2', status: 'APPROVED' },
      }),
    ).toBe(false);
  });
});

describe('P1.10 Acceptance — validation bắt buộc', () => {
  it('hạng mục bị từ chối phải có lý do', () => {
    expect(
      findRejectedServiceMissingFeedback(
        { s1: { serviceId: 's1', status: 'REJECTED', feedback: '   ' } },
        { s1: 'Thiết kế logo' },
      ),
    ).toBe('Thiết kế logo');

    expect(
      findRejectedServiceMissingFeedback(
        { s1: { serviceId: 's1', status: 'REJECTED', feedback: 'Sai màu' } },
        { s1: 'Thiết kế logo' },
      ),
    ).toBeNull();

    expect(
      findRejectedServiceMissingFeedback(
        { s1: { serviceId: 's1', status: 'APPROVED', feedback: '' } },
        { s1: 'Thiết kế logo' },
      ),
    ).toBeNull();
  });

  it('hạng mục đủ điều kiện gửi nghiệm thu theo logic backend', () => {
    expect(
      isServiceEligibleForAcceptance({
        id: 's1',
        status: 'ACTIVE',
        results: [{ taskId: 't1', status: 'PENDING' }],
        tasks: [{ status: 'COMPLETED' }, { status: 'INTERNAL_COMPLETED' }, { status: 'ON_HOLD' }],
      } as any),
    ).toBe(true);

    // Còn task đang làm ⇒ chặn.
    expect(
      isServiceEligibleForAcceptance({
        id: 's1',
        status: 'ACTIVE',
        results: [{ taskId: 't1', status: 'PENDING' }],
        tasks: [{ status: 'DOING' }],
      } as any),
    ).toBe(false);

    // Không còn kết quả chờ duyệt ⇒ chặn.
    expect(
      isServiceEligibleForAcceptance({
        id: 's1',
        status: 'ACTIVE',
        results: [{ taskId: 't1', status: 'APPROVED' }],
        tasks: [{ status: 'COMPLETED' }],
      } as any),
    ).toBe(false);
  });
});

describe('P1.10 Acceptance — validation ngày nghiệm thu', () => {
  const start = '2026-01-01';
  const end = '2026-06-30';

  it('hợp lệ khi nằm trong khoảng hợp đồng', () => {
    expect(validateAcceptanceDate('2026-03-15', start, end)).toEqual({ valid: true });
    expect(validateAcceptanceDate('2026-01-01', start, end)).toEqual({ valid: true });
    expect(validateAcceptanceDate('2026-06-30', start, end)).toEqual({ valid: true });
  });

  it('chặn ngày trước khi hợp đồng bắt đầu', () => {
    const result = validateAcceptanceDate('2025-12-31', start, end);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('trước ngày bắt đầu');
  });

  it('chặn ngày sau khi hợp đồng kết thúc', () => {
    const result = validateAcceptanceDate('2026-07-01', start, end);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('sau ngày kết thúc');
  });

  it('chặn ngày không hợp lệ', () => {
    expect(validateAcceptanceDate(undefined, start, end).valid).toBe(false);
    expect(validateAcceptanceDate('không-phải-ngày', start, end).valid).toBe(false);
  });

  it('bỏ qua ràng buộc khi hợp đồng thiếu ngày', () => {
    expect(validateAcceptanceDate('2026-03-15').valid).toBe(true);
  });
});

describe('P1.11 Đối soát ngân sách dự án', () => {
  it('tính chênh lệch ngân sách dự toán vs chi phí thực tế', () => {
    const result = computeBudgetVariance(100_000_000, [30_000_000, { amount: 20_000_000 }]);
    expect(result.planned).toBe(100_000_000);
    expect(result.actual).toBe(50_000_000);
    expect(result.variance).toBe(-50_000_000);
    expect(result.variancePercent).toBe(-50);
    expect(result.isOverBudget).toBe(false);
    expect(getRemainingBudget(100_000_000, [30_000_000, 20_000_000])).toBe(50_000_000);
  });

  it('phát hiện vượt ngân sách', () => {
    const result = computeBudgetVariance(100_000_000, [120_000_000]);
    expect(result.variance).toBe(20_000_000);
    expect(result.variancePercent).toBe(20);
    expect(result.isOverBudget).toBe(true);
    expect(getRemainingBudget(100_000_000, [120_000_000])).toBe(0);
  });

  it('giữ nguyên số lẻ, không làm tròn tiền', () => {
    const result = computeBudgetVariance(1_000_000, [333_333.33, 666_666.67]);
    expect(result.actual).toBeCloseTo(1_000_000, 2);
    expect(result.isOverBudget).toBe(false);
  });

  it('an toàn khi ngân sách bằng 0 hoặc dữ liệu rỗng', () => {
    expect(computeBudgetVariance(0, [])).toEqual({
      planned: 0,
      actual: 0,
      variance: 0,
      variancePercent: 0,
      isOverBudget: false,
    });
    expect(computeBudgetVariance(null, [null as any, undefined as any]).actual).toBe(0);
  });
});
