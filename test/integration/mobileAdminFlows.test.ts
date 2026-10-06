import { apiService } from '@/services/api';
import { taskService } from '@/services/taskService';
import {
  canAccessAcceptance,
  canAccessContracts,
  canAccessReferralPartners,
  canAccessServiceCatalog,
  canAccessSettings,
  canAccessVendors,
  canBulkDeleteServices,
  canCreateServices,
  canManageVendors,
} from '@/utils/rbac';

describe('Sidebar Web parity — mobile RBAC', () => {
  it('PM xem đúng các phân hệ dự án nhưng không được quản trị vendor', () => {
    expect(canAccessContracts('PM')).toBe(true);
    expect(canAccessServiceCatalog('PM')).toBe(true);
    expect(canAccessVendors('PM')).toBe(true);
    expect(canAccessReferralPartners('PM')).toBe(true);
    expect(canAccessAcceptance('PM')).toBe(true);
    expect(canManageVendors('PM')).toBe(false);
  });

  it('quyền tạo dịch vụ tách biệt với quyền xóa hàng loạt', () => {
    expect(canCreateServices('ADMIN')).toBe(true);
    expect(canCreateServices('BOD')).toBe(true);
    expect(canCreateServices('BD')).toBe(true);
    expect(canCreateServices('ADMIN_SALE')).toBe(false);
    expect(canCreateServices('PM')).toBe(false);

    expect(canBulkDeleteServices('ADMIN')).toBe(true);
    expect(canBulkDeleteServices('BOD')).toBe(true);
    expect(canBulkDeleteServices('BD')).toBe(false);
  });

  it('nghiệm thu và cài đặt giữ đúng ma trận Sidebar', () => {
    expect(canAccessAcceptance('ADMIN')).toBe(true);
    expect(canAccessAcceptance('BOD')).toBe(true);
    expect(canAccessAcceptance('ADMIN_SALE')).toBe(true);
    expect(canAccessAcceptance('PM')).toBe(true);
    expect(canAccessAcceptance('BD')).toBe(false);
    expect(canAccessSettings('ADMIN')).toBe(true);
    expect(canAccessSettings('BOD')).toBe(false);
  });
});

describe('Tạo công việc nội bộ — API contract', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gửi nguyên payload form tới POST /tasks/internal', async () => {
    const payload = {
      name: 'Chuẩn bị tài liệu nội bộ',
      assigneeId: 'user-1',
      supervisorId: 'lead-1',
      description: 'Tổng hợp dữ liệu',
      plannedStartDate: '2026-10-06T00:00:00.000Z',
      plannedEndDate: '2026-10-10T23:59:59.000Z',
      attachments: [
        { type: 'LINK', name: 'https://example.com', url: 'https://example.com' },
      ],
    };
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue({
      status: 201,
      data: { id: 'task-1', ...payload },
    });

    const result = await taskService.createInternalTask(payload);

    expect(spy).toHaveBeenCalledWith('/tasks/internal', payload);
    expect(result.data?.id).toBe('task-1');
  });
});
