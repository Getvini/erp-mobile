import { apiService } from '@/services/api';
import { customerService } from '@/services/customerService';
import { canDeleteCustomers } from '@/utils/rbac';
import { EMAIL_REGEX, PHONE_REGEX, TAX_ID_REGEX } from '@/utils/validators';

describe('P1.8 Customer CRM Integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('giữ nguyên query params của Web khi lọc danh sách khách hàng', async () => {
    const getSpy = jest.spyOn(apiService, 'get').mockResolvedValue({
      status: 200,
      data: [{ id: 'customer-1', name: 'Công ty Getvini' }],
    });

    const result = await customerService.getCustomers({
      search: 'Getvini',
      source: 'INTERNAL',
      page: 2,
      limit: 20,
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/customers?search=Getvini&source=INTERNAL&page=2&limit=20',
    );
    expect(result.data).toHaveLength(1);
  });

  it('gọi đúng DELETE /customers/:id', async () => {
    const deleteSpy = jest.spyOn(apiService, 'delete').mockResolvedValue({
      status: 200,
      data: { message: 'Xóa khách hàng thành công' },
    });

    const result = await customerService.deleteCustomer('customer-1');

    expect(deleteSpy).toHaveBeenCalledWith('/customers/customer-1');
    expect(result.data?.message).toBe('Xóa khách hàng thành công');
  });

  it('chỉ cho vai trò có quyền CRM toàn tenant thấy thao tác xóa', () => {
    expect(canDeleteCustomers('ADMIN')).toBe(true);
    expect(canDeleteCustomers('BOD')).toBe(true);
    expect(canDeleteCustomers('ADMIN_SALE')).toBe(true);
    expect(canDeleteCustomers('BD')).toBe(false);
    expect(canDeleteCustomers('STAFF')).toBe(false);
  });

  it('áp dụng đúng quality gate regex cho hồ sơ khách hàng', () => {
    expect(PHONE_REGEX.test('0912345678')).toBe(true);
    expect(PHONE_REGEX.test('0123456789')).toBe(false);
    expect(EMAIL_REGEX.test('contact@getvini.vn')).toBe(true);
    expect(EMAIL_REGEX.test('contact@getvini')).toBe(false);
    expect(TAX_ID_REGEX.test('0101234567')).toBe(true);
    expect(TAX_ID_REGEX.test('0101234567-001')).toBe(true);
    expect(TAX_ID_REGEX.test('0101234567001')).toBe(false);
  });
});
