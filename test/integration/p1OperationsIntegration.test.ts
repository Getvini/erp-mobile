import { apiService } from '@/services/api';
import { contractService, isContractLocked } from '@/services/contractService';
import {
  canBodReviewAddendum,
  canEditAddendumPrices,
  canResubmitAddendum,
  canSaleReviewAddendum,
  computeAddendumLineTotals,
  contractAddendumService,
  getAddendumMinimumPrice,
  getAddendumRecommendedPrice,
  roundToTenThousands,
} from '@/services/contractAddendumService';
import { acceptanceService } from '@/services/acceptanceService';
import { projectService } from '@/services/projectService';
import { mapNotificationApiItem } from '@/services/notificationService';
import { getQueryKeyForSseTag, invalidateSseTag } from '@/hooks/useSSEQueryBridge';
import { getEntityTagForEvent, isTeamMemberEvent } from '@/constants/events';
import { canProcessAcceptance, canSendAcceptance } from '@/utils/rbac';

describe('P1.9 Contract & Contract Addendum — endpoint parity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('xóa hợp đồng dùng đúng DELETE /contracts/:id', async () => {
    const spy = jest.spyOn(apiService, 'delete').mockResolvedValue({
      status: 200,
      data: { message: 'Xóa hợp đồng thành công' },
    });

    const res = await contractService.deleteContract('c-1');

    expect(spy).toHaveBeenCalledWith('/contracts/c-1');
    expect(res.data?.message).toBe('Xóa hợp đồng thành công');
  });

  it('đổi nickname dịch vụ dùng PATCH /contracts/services/:id/nickname', async () => {
    const spy = jest
      .spyOn(apiService, 'patch')
      .mockResolvedValue({ status: 200, data: { id: 'cs-1' } });

    await contractService.updateContractServiceNickname({ id: 'cs-1', nickname: 'Logo chính' });

    expect(spy).toHaveBeenCalledWith('/contracts/services/cs-1/nickname', {
      nickname: 'Logo chính',
    });
  });

  it('thêm mốc thanh toán gửi title theo đúng Web', async () => {
    const spy = jest
      .spyOn(apiService, 'post')
      .mockResolvedValue({ status: 201, data: { id: 'ms-1' } });

    await contractService.addMilestone({
      id: 'c-1',
      title: 'Tạm ứng 30%',
      dueDate: '2026-02-01',
      amount: 30_000_000,
    });

    expect(spy).toHaveBeenCalledWith('/contracts/c-1/milestones', {
      title: 'Tạm ứng 30%',
      dueDate: '2026-02-01',
      amount: 30_000_000,
    });
  });

  it('khóa chỉnh sửa hợp đồng khi đã ký / hoàn thành / hủy', () => {
    expect(isContractLocked('SIGNED')).toBe(true);
    expect(isContractLocked('COMPLETED')).toBe(true);
    expect(isContractLocked('CANCELLED')).toBe(true);
    expect(isContractLocked('PROPOSAL_UPLOADED')).toBe(false);
    expect(isContractLocked(undefined)).toBe(false);
  });

  it('danh sách phụ lục đọc từ GET /contracts/:id (backend không có GET /contract-addendums)', async () => {
    const spy = jest.spyOn(apiService, 'get').mockResolvedValue({
      status: 200,
      data: { id: 'c-1', addendums: [{ id: 'a-1', status: 'PENDING_SALE' }] },
    });

    const res = await contractAddendumService.getContractAddendums('c-1');

    expect(spy).toHaveBeenCalledWith('/contracts/c-1');
    expect(res.data).toHaveLength(1);
    expect(res.data[0].id).toBe('a-1');
  });

  it('sale-approve gửi selectedItems giữ nguyên thứ tự', async () => {
    const spy = jest
      .spyOn(apiService, 'post')
      .mockResolvedValue({ status: 200, data: { id: 'a-1', status: 'PENDING_BOD' } });

    const selectedItems = [
      { serviceId: 'sv-1', sellingPrice: 10_000_000, quantity: 1 },
      { serviceId: 'sv-2', sellingPrice: 20_000_000, quantity: 2 },
    ];

    const res = await contractAddendumService.saleApproveAddendum({
      id: 'a-1',
      note: 'Đồng ý',
      selectedItems,
    });

    expect(spy).toHaveBeenCalledWith('/contract-addendums/a-1/sale-approve', {
      note: 'Đồng ý',
      selectedItems,
    });
    expect(res.data.status).toBe('PENDING_BOD');
  });

  it('bod-approve bóc wrapper { addendum }', async () => {
    jest.spyOn(apiService, 'post').mockResolvedValue({
      status: 200,
      data: { message: 'Đã duyệt', addendum: { id: 'a-1', status: 'APPROVED' }, createdTasks: 3 },
    });

    const res = await contractAddendumService.bodApproveAddendum({ id: 'a-1', note: 'OK' });

    expect(res.data.id).toBe('a-1');
    expect(res.data.status).toBe('APPROVED');
  });

  it('resubmit KHÔNG gửi note (backend bỏ qua field này)', async () => {
    const spy = jest
      .spyOn(apiService, 'post')
      .mockResolvedValue({ status: 200, data: { id: 'a-1', status: 'PENDING_SALE' } });

    await contractAddendumService.resubmitAddendum({
      id: 'a-1',
      selectedItems: [{ serviceId: 'sv-1', sellingPrice: 5_000_000 }],
      name: 'Phụ lục 01',
    });

    expect(spy).toHaveBeenCalledWith('/contract-addendums/a-1/resubmit', {
      selectedItems: [{ serviceId: 'sv-1', sellingPrice: 5_000_000 }],
      name: 'Phụ lục 01',
      description: undefined,
    });
    expect(spy.mock.calls[0][1]).not.toHaveProperty('note');
  });

  it('scale-down gửi cancelServiceIds và refundAmount', async () => {
    const spy = jest
      .spyOn(apiService, 'post')
      .mockResolvedValue({ status: 200, data: { id: 'a-1', sellingPrice: -5_000_000 } });

    await contractAddendumService.scaleDownAddendum({
      id: 'a-1',
      cancelServiceIds: ['sv-9'],
      refundAmount: 5_000_000,
    });

    expect(spy).toHaveBeenCalledWith('/contract-addendums/a-1/scale-down', {
      cancelServiceIds: ['sv-9'],
      refundAmount: 5_000_000,
    });
  });

  it('add items gửi đúng shape { services, milestones }', async () => {
    const spy = jest
      .spyOn(apiService, 'post')
      .mockResolvedValue({ status: 200, data: { id: 'a-1' } });

    await contractAddendumService.addAddendumItems({
      id: 'a-1',
      services: [{ serviceId: 'sv-1', serviceName: 'Logo', sellingPrice: 1_000_000 }],
      milestones: [{ name: 'Đợt 1', percentage: 50, amount: 500_000 }],
    });

    expect(spy).toHaveBeenCalledWith('/contract-addendums/a-1/items', {
      services: [{ serviceId: 'sv-1', serviceName: 'Logo', sellingPrice: 1_000_000 }],
      milestones: [{ name: 'Đợt 1', percentage: 50, amount: 500_000 }],
    });
  });
});

describe('P1.9 Addendum RBAC & số học giá', () => {
  it('quyền Sale/BOD/resubmit theo trạng thái', () => {
    expect(canSaleReviewAddendum('BD', 'PENDING_SALE')).toBe(true);
    expect(canSaleReviewAddendum('ADMIN', 'PENDING_SALE')).toBe(true);
    expect(canSaleReviewAddendum('BD', 'PENDING_BOD')).toBe(false);
    expect(canSaleReviewAddendum('PM', 'PENDING_SALE')).toBe(false);

    expect(canBodReviewAddendum('BOD', 'PENDING_BOD')).toBe(true);
    expect(canBodReviewAddendum('ADMIN', 'PENDING_BOD')).toBe(true);
    expect(canBodReviewAddendum('BOD', 'PENDING_SALE')).toBe(false);

    expect(canResubmitAddendum('PM', 'SALE_REJECTED')).toBe(true);
    expect(canResubmitAddendum('ADMIN', 'BOD_REJECTED')).toBe(true);
    expect(canResubmitAddendum('PM', 'PENDING_SALE')).toBe(false);

    expect(canEditAddendumPrices('BD', 'PENDING_SALE')).toBe(true);
    expect(canEditAddendumPrices('PM', 'BOD_REJECTED')).toBe(true);
    expect(canEditAddendumPrices('BD', 'APPROVED')).toBe(false);
  });

  it('giá đề xuất = cost/0.6, giá tối thiểu = cost/0.8, làm tròn lên 10.000đ', () => {
    expect(getAddendumRecommendedPrice(6_000_000)).toBe(10_000_000);
    expect(getAddendumMinimumPrice(8_000_000)).toBe(10_000_000);
    expect(roundToTenThousands(10_000_001)).toBe(10_010_000);
    expect(roundToTenThousands(10_000_000)).toBe(10_000_000);
  });

  it('VAT 8% và thành tiền TUYỆT ĐỐI không làm tròn', () => {
    const totals = computeAddendumLineTotals({ sellingPrice: 1_000_001, quantity: 3, cost: 500_000 });
    expect(totals.lineSellingPrice).toBe(3_000_003);
    expect(totals.lineCost).toBe(1_500_000);
    expect(totals.lineVat).toBeCloseTo(240_000.24, 5);
    expect(totals.lineTotalWithVat).toBeCloseTo(3_240_003.24, 5);
    // Không được là số nguyên đã làm tròn.
    expect(Number.isInteger(totals.lineVat)).toBe(false);
  });
});

describe('P1.10 Acceptance — endpoint parity & RBAC', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('approve dùng POST /acceptance/:id/approve', async () => {
    const spy = jest
      .spyOn(apiService, 'post')
      .mockResolvedValue({ status: 200, data: { id: 'acc-1', status: 'APPROVED' } });

    const res = await acceptanceService.approveAcceptanceRequest('acc-1');

    expect(spy).toHaveBeenCalledWith('/acceptance/acc-1/approve');
    expect(res.data?.status).toBe('APPROVED');
  });

  it('reject dùng POST /acceptance/:id/reject kèm feedback bắt buộc', async () => {
    const spy = jest
      .spyOn(apiService, 'post')
      .mockResolvedValue({ status: 200, data: { id: 'acc-1', status: 'REJECTED' } });

    await acceptanceService.rejectAcceptanceRequest('acc-1', 'Sai tiêu chí');

    expect(spy).toHaveBeenCalledWith('/acceptance/acc-1/reject', { feedback: 'Sai tiêu chí' });
  });

  it('process gửi mảng decisions', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({ status: 200, data: {} });

    await acceptanceService.processAcceptanceRequest('acc-1', [
      { serviceId: 'sv-1', status: 'APPROVED', feedback: '', resultDecisions: [] },
    ]);

    expect(spy).toHaveBeenCalledWith('/acceptance/acc-1/process', {
      decisions: [{ serviceId: 'sv-1', status: 'APPROVED', feedback: '', resultDecisions: [] }],
    });
  });

  it('tạo nghiệm thu chỉ gửi { projectId, note, serviceIds }', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({ status: 201, data: { id: 'acc-1' } });

    await acceptanceService.createAcceptanceRequest({
      projectId: 'p-1',
      note: 'Ghi chú',
      serviceIds: ['sv-1'],
    });

    expect(spy).toHaveBeenCalledWith('/acceptance/request', {
      projectId: 'p-1',
      note: 'Ghi chú',
      serviceIds: ['sv-1'],
    });
  });

  it('danh sách chuẩn hóa cả dạng mảng và { data }', async () => {
    jest
      .spyOn(apiService, 'get')
      .mockResolvedValueOnce({ status: 200, data: [{ id: 'a' }] })
      .mockResolvedValueOnce({ status: 200, data: { data: [{ id: 'b' }], meta: { total: 1 } } });

    const first = await acceptanceService.getAcceptanceRequests({ projectId: 'p-1' });
    const second = await acceptanceService.getAcceptanceRequests({ search: 'x' });

    expect(first.data).toHaveLength(1);
    expect(second.data).toHaveLength(1);
    expect(second.meta).toEqual({ total: 1 });
  });

  it('RBAC gửi nghiệm thu: Account/Team Lead bị chặn, PM/ADMIN_SALE được phép', () => {
    expect(canSendAcceptance('ADMIN')).toBe(true);
    expect(canSendAcceptance('BOD')).toBe(true);
    expect(canSendAcceptance('PM')).toBe(true);
    expect(canSendAcceptance('ADMIN_SALE')).toBe(true);
    expect(canSendAcceptance('BD')).toBe(false);
    expect(canSendAcceptance('STAFF_A')).toBe(false);
    expect(canSendAcceptance(undefined)).toBe(false);
  });

  it('RBAC duyệt nghiệm thu đúng 4 vai trò backend', () => {
    expect(canProcessAcceptance('BOD')).toBe(true);
    expect(canProcessAcceptance('ADMIN')).toBe(true);
    expect(canProcessAcceptance('ADMIN_SALE')).toBe(true);
    expect(canProcessAcceptance('PM')).toBe(true);
    expect(canProcessAcceptance('BD')).toBe(false);
    expect(canProcessAcceptance('STAFF_C')).toBe(false);
  });
});

describe('P1.11 Project — endpoint pause/close parity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('yêu cầu tạm dừng dùng POST /projects/:id/pause', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({ status: 201, data: { id: 'r-1' } });

    await projectService.requestPauseProject('p-1', 'Hết ngân sách');

    expect(spy).toHaveBeenCalledWith('/projects/p-1/pause', { reason: 'Hết ngân sách' });
  });

  it('tạm dừng ngay dùng POST /projects/:id/pause/direct', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({ status: 201, data: { id: 'r-1' } });

    await projectService.pauseProjectDirect('p-1', 'Dừng khẩn');

    expect(spy).toHaveBeenCalledWith('/projects/p-1/pause/direct', { reason: 'Dừng khẩn' });
  });

  it('duyệt/từ chối yêu cầu tạm dừng đúng URL', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({ status: 200, data: {} });

    await projectService.approvePauseRequest('r-1');
    await projectService.rejectPauseRequest('r-2', 'Chưa hợp lý');

    expect(spy).toHaveBeenNthCalledWith(1, '/projects/pause-requests/r-1/approve');
    expect(spy).toHaveBeenNthCalledWith(2, '/projects/pause-requests/r-2/reject', {
      feedback: 'Chưa hợp lý',
    });
  });

  it('làm tiếp dùng POST /projects/:id/resume', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({ status: 200, data: {} });

    await projectService.resumeProject('p-1', 'Đã có ngân sách');

    expect(spy).toHaveBeenCalledWith('/projects/p-1/resume', { resumeReason: 'Đã có ngân sách' });
  });

  it('đóng ngay / đề nghị đóng / duyệt / từ chối đúng URL', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({ status: 200, data: {} });

    await projectService.closeProjectDirect('p-1', 'Kết thúc');
    await projectService.requestCloseProject('p-1');
    await projectService.approveCloseRequest('r-3');
    await projectService.rejectCloseRequest('r-4', 'Còn hạng mục');

    expect(spy).toHaveBeenNthCalledWith(1, '/projects/p-1/close/direct', { reason: 'Kết thúc' });
    expect(spy).toHaveBeenNthCalledWith(2, '/projects/p-1/close', {
      reason: 'Đề nghị đóng dự án',
    });
    expect(spy).toHaveBeenNthCalledWith(3, '/projects/close-requests/r-3/approve');
    expect(spy).toHaveBeenNthCalledWith(4, '/projects/close-requests/r-4/reject', {
      feedback: 'Còn hạng mục',
    });
  });

  it('lấy hold-summary, pause-history, my-projects đúng URL', async () => {
    const spy = jest
      .spyOn(apiService, 'get')
      .mockResolvedValue({ status: 200, data: { acceptedCount: 2 } });

    await projectService.getHoldSummary('p-1');
    await projectService.getPauseHistory('p-1');
    await projectService.getMyProjects();

    expect(spy).toHaveBeenNthCalledWith(1, '/projects/p-1/hold-summary');
    expect(spy).toHaveBeenNthCalledWith(2, '/projects/p-1/pause-history');
    expect(spy).toHaveBeenNthCalledWith(3, '/projects/my-projects');
  });
});

describe('P1.13 Notification service & SSE bridge', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('giữ nguyên link, relatedEntityType và chuẩn hóa type', () => {
    const item = mapNotificationApiItem({
      id: 'n-1',
      title: 'Task mới',
      content: 'Bạn được giao task ABC',
      type: 'TASK_ASSIGNED',
      isRead: false,
      link: '/tasks/t-1',
      relatedEntityId: 't-1',
      relatedEntityType: 'TASK',
      createdAt: '2026-02-01T10:00:00.000Z',
    });

    expect(item.type).toBe('TASK');
    expect(item.link).toBe('/tasks/t-1');
    expect(item.rawType).toBe('TASK_ASSIGNED');
    expect(item.targetId).toBe('t-1');
  });

  it('phân loại thông báo tài chính và nghiệm thu', () => {
    expect(mapNotificationApiItem({ id: '1', title: '', content: '', type: 'PAYMENT_REQUEST_APPROVED', isRead: false, createdAt: '' }).type).toBe('FINANCE');
    expect(mapNotificationApiItem({ id: '2', title: '', content: '', type: 'ACCEPTANCE_CREATED', isRead: false, createdAt: '' }).type).toBe('ACCEPTANCE');
    expect(mapNotificationApiItem({ id: '3', title: '', content: '', relatedEntityType: 'CONTRACTADDENDUM', isRead: false, createdAt: '' }).type).toBe('CONTRACT');
    expect(mapNotificationApiItem({ id: '4', title: '', content: '', type: 'SOMETHING', isRead: false, createdAt: '' }).type).toBe('SYSTEM');
  });

  it('map tag SSE đầy đủ cho delta 28-09-2026', () => {
    expect(getQueryKeyForSseTag('ContractAddendums')).toEqual(['contracts']);
    expect(getQueryKeyForSseTag('Acceptance')).toEqual(['acceptances']);
    expect(getQueryKeyForSseTag('PauseHistory')).toEqual(['projects']);
    expect(getQueryKeyForSseTag('TaskResultChecks')).toEqual(['taskResultChecks']);
    expect(getQueryKeyForSseTag('Users')).toEqual(['projects']);
    expect(getQueryKeyForSseTag('Teams')).toEqual(['projects']);
    expect(getQueryKeyForSseTag('Unknown')).toBeNull();
  });

  it('invalidateSseTag gọi invalidateQueries cho tag hợp lệ', () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries } as any;

    expect(invalidateSseTag(queryClient, 'Tasks')).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks'] });

    expect(invalidateSseTag(queryClient, 'Không tồn tại')).toBe(false);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('suy ra tag entity theo id và nhận diện team_member', () => {
    expect(getEntityTagForEvent('contract_addendum_approved')).toBe('ContractAddendums');
    expect(getEntityTagForEvent('contract_signed')).toBe('Contracts');
    expect(getEntityTagForEvent('acceptance_processed')).toBe('Acceptance');
    expect(getEntityTagForEvent('team_member_added')).toBeNull();
    expect(isTeamMemberEvent('team_member_added')).toBe(true);
    expect(isTeamMemberEvent('team_updated')).toBe(false);
  });
});
