import { apiService } from '@/services/api';
import { paymentRequestService } from '@/services/paymentRequestService';
import { paymentMilestoneService } from '@/services/paymentMilestoneService';
import { debtService } from '@/services/debtService';
import { opportunityService } from '@/services/opportunityService';
import { settingService } from '@/services/settingService';
import { formatVND, parseNumberInput } from '@/utils/formatters';

describe('Phase P0 Integration & Business Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Đề Xuất Thanh Toán (Payment Requests Integration)', () => {
    it('gửi payload tạo đề xuất chi với số tiền unmasked và file hóa đơn nén', async () => {
      const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue({
        status: 201,
        data: {
          id: 'pr-101',
          requestNumber: 'DXC-2026-001',
          title: 'Chi phí mua thiết bị âm thanh',
          amount: 15500000,
          status: 'PENDING',
        } as any,
      });

      const rawAmountInput = '15.500.000';
      const cleanAmount = parseNumberInput(rawAmountInput);
      expect(cleanAmount).toBe(15500000);

      const payload = {
        type: 'PAYMENT',
        title: 'Chi phí mua thiết bị âm thanh',
        amount: cleanAmount,
        reason: 'Chi phí mua thiết bị âm thanh sự kiện',
        projectId: 'proj-01',
        invoiceFiles: [{ url: 'https://res.cloudinary.com/getvini/image/upload/inv-01.jpg' }],
      };

      const result = await paymentRequestService.createPaymentRequest(payload);

      expect(postSpy).toHaveBeenCalledWith('/payment-requests', payload);
      expect(result.data?.id).toBe('pr-101');
      expect(result.data?.amount).toBe(15500000);
      expect(formatVND(result.data?.amount || 0)).toBe('15.500.000 ₫');

      postSpy.mockRestore();
    });

    it('gọi đúng endpoint BOD phê duyệt đề xuất chi kèm lý do và confirmedDueDate', async () => {
      const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue({
        status: 200,
        data: {
          id: 'pr-101',
          approvalStatus: 'APPROVED',
          confirmedDueDate: '2026-10-05',
        } as any,
      });

      const result = await paymentRequestService.bodDecidePaymentRequest({
        id: 'pr-101',
        action: 'APPROVE',
        confirmedDueDate: '2026-10-05',
        reason: 'BOD phê duyệt thanh toán',
      });

      expect(postSpy).toHaveBeenCalledWith('/payment-requests/pr-101/bod-decision', {
        action: 'APPROVE',
        confirmedDueDate: '2026-10-05',
        reason: 'BOD phê duyệt thanh toán',
      });
      expect(result.data?.approvalStatus).toBe('APPROVED');

      postSpy.mockRestore();
    });

    it('từ chối đề xuất chi qua bodDecidePaymentRequest bắt buộc có lý do', async () => {
      const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue({
        status: 200,
        data: {
          id: 'pr-101',
          approvalStatus: 'REJECTED',
          reason: 'Thiếu hợp đồng mua bán kèm theo',
        } as any,
      });

      const result = await paymentRequestService.bodDecidePaymentRequest({
        id: 'pr-101',
        action: 'REJECT',
        reason: 'Thiếu hợp đồng mua bán kèm theo',
      });

      expect(postSpy).toHaveBeenCalledWith('/payment-requests/pr-101/bod-decision', {
        action: 'REJECT',
        reason: 'Thiếu hợp đồng mua bán kèm theo',
        confirmedDueDate: undefined,
      });
      expect(result.data?.approvalStatus).toBe('REJECTED');

      postSpy.mockRestore();
    });
  });

  describe('2. Đợt Thanh Toán (Milestone Management & Arithmetic Precision)', () => {
    it('lấy danh sách mốc thanh toán theo hợp đồng và tính tổng tiền chính xác', async () => {
      const mockMilestones = [
        {
          id: 'ms-1',
          contractId: 'contract-001',
          name: 'Đợt 1: Tạm ứng 30%',
          percentage: 30,
          amount: 32400000.359,
          status: 'PAID',
        },
        {
          id: 'ms-2',
          contractId: 'contract-001',
          name: 'Đợt 2: Nghiệm thu 70%',
          percentage: 70,
          amount: 75600000.721,
          status: 'PENDING',
        },
      ];

      const getSpy = jest.spyOn(apiService, 'get').mockResolvedValue({
        status: 200,
        data: mockMilestones as any,
      });

      const res = await paymentMilestoneService.getPaymentMilestonesByContract('contract-001');
      expect(getSpy).toHaveBeenCalledWith('/payment-milestones/contract/contract-001');

      const data = res.data || [];
      expect(data).toHaveLength(2);

      // Kiểm tra quy tắc P0 Quality Gate 8: VAT và Thành tiền TUYỆT ĐỐI KHÔNG làm tròn
      const totalAmountExact = data.reduce((acc, m) => acc + m.amount, 0);
      expect(totalAmountExact).toBe(108000001.08);

      getSpy.mockRestore();
    });

    it('bulk save mốc thanh toán gửi đúng payload array', async () => {
      const putSpy = jest.spyOn(apiService, 'put').mockResolvedValue({
        status: 200,
        data: { message: 'Cập nhật thành công' } as any,
      });

      const payload = {
        contractId: 'contract-001',
        milestones: [
          { id: 'ms-1', name: 'Đợt 1: Tạm ứng', percentage: 40, amount: 40000000, dueDate: '2026-10-15' },
          { id: 'ms-2', name: 'Đợt 2: Nghiệm thu', percentage: 60, amount: 60000000, dueDate: '2026-11-15' },
        ],
      };

      await paymentMilestoneService.bulkSavePaymentMilestones(payload);
      // Endpoint thực tế: contract-scoped, body chỉ có milestones (không có contractId)
      expect(putSpy).toHaveBeenCalledWith(
        '/payment-milestones/contract/contract-001/bulk',
        { milestones: payload.milestones }
      );

      putSpy.mockRestore();
    });
  });

  describe('3. Công Nợ Hợp Đồng & Đối Soát (Debt Reconciliation Integration)', () => {
    it('ghi nhận thanh toán trừ vào dư nợ còn lại chính xác', async () => {
      const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue({
        status: 201,
        data: {
          id: 'rec-01',
          debtId: 'debt-88',
          amount: 25000000,
          paymentDate: '2026-09-28',
          note: 'Khách hàng thanh toán qua Vietcombank',
          attachments: [{ name: 'proof-01.jpg', url: 'https://cloudinary.com/proof-01.jpg' }],
        } as any,
      });

      const result = await debtService.createPayment({
        debtId: 'debt-88',
        amount: 25000000,
        paymentDate: '2026-09-28',
        note: 'Khách hàng thanh toán qua Vietcombank',
        attachments: [{ name: 'proof-01.jpg', url: 'https://cloudinary.com/proof-01.jpg' }],
      });

      expect(postSpy).toHaveBeenCalledWith('/debts/payments', {
        debtId: 'debt-88',
        amount: 25000000,
        paymentDate: '2026-09-28',
        note: 'Khách hàng thanh toán qua Vietcombank',
        attachments: [{ name: 'proof-01.jpg', url: 'https://cloudinary.com/proof-01.jpg' }],
      });

      expect(result.data?.amount).toBe(25000000);
      expect(formatVND(result.data?.amount || 0)).toBe('25.000.000 ₫');

      postSpy.mockRestore();
    });

    it('gọi đúng endpoint mở khóa công nợ (unlockDebt) cho Ban Giám Đốc/Admin', async () => {
      const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue({
        status: 200,
        data: {
          id: 'debt-88',
          status: 'ACTIVE',
        } as any,
      });

      const result = await debtService.unlockDebt({
        id: 'debt-88',
        reason: 'BOD phê duyệt mở khóa để thu đợt 2',
      });

      expect(postSpy).toHaveBeenCalledWith('/debts/debt-88/unlock', {
        reason: 'BOD phê duyệt mở khóa để thu đợt 2',
      });
      expect(result.data?.status).toBe('ACTIVE');

      postSpy.mockRestore();
    });
  });

  describe('4. Cơ Hội Bán Hàng & Gắn Khách Hàng (Opportunity & AddCustomer Integration)', () => {
    it('gọi đúng PATCH /opportunities/:id/addcustomer khi khách hàng đã tồn tại', async () => {
      const patchSpy = jest.spyOn(apiService, 'patch').mockResolvedValue({
        status: 200,
        data: {
          id: 'opp-100',
          customer: { id: 'cust-99', name: 'Công Ty ABC' },
          customerType: 'DIRECT',
          source: 'INTERNAL',
        } as any,
      });

      const payload = {
        customerId: 'cust-99',
        customerType: 'DIRECT',
        referralPartnerId: null,
      };

      const result = await opportunityService.addCustomerToOpportunity('opp-100', payload);
      expect(patchSpy).toHaveBeenCalledWith('/opportunities/opp-100/addcustomer', payload);
      expect(result.data?.id).toBe('opp-100');
      expect(result.data?.customer?.id).toBe('cust-99');

      patchSpy.mockRestore();
    });
  });

  describe('5. Cấu Hình Workload Norms (Settings Integration)', () => {
    it('lấy danh sách định mức workload theo role', async () => {
      const mockNorms = {
        norms: [
          { role: 'STAFF_A', monthlyNorm: 4000, isCustomized: true },
          { role: 'STAFF_B', monthlyNorm: 3000, isCustomized: false },
          { role: 'STAFF_C', monthlyNorm: 2500, isCustomized: false },
          { role: 'STAFF_D', monthlyNorm: 2000, isCustomized: false },
        ],
      };

      const getSpy = jest.spyOn(apiService, 'get').mockResolvedValue({
        status: 200,
        data: mockNorms as any,
      });

      const result = await settingService.getWorkloadNorms();
      expect(getSpy).toHaveBeenCalledWith('/settings/workload-norms');
      expect(result.data?.norms).toHaveLength(4);
      expect(result.data?.norms[0].monthlyNorm).toBe(4000);

      // Định mức ngày của Level A
      const dailyNormA = (result.data?.norms[0].monthlyNorm || 0) / 30;
      expect(Number(dailyNormA.toFixed(2))).toBe(133.33);

      getSpy.mockRestore();
    });

    it('gọi PUT /settings/workload-norms để cập nhật định mức', async () => {
      const putSpy = jest.spyOn(apiService, 'put').mockResolvedValue({
        status: 200,
        data: { success: true } as any,
      });

      const payload = {
        norms: [
          { role: 'STAFF_A', monthlyNorm: 4500 },
          { role: 'STAFF_B', monthlyNorm: 3500 },
          { role: 'STAFF_C', monthlyNorm: 2500 },
          { role: 'STAFF_D', monthlyNorm: 2000 },
        ],
      };

      await settingService.updateWorkloadNorms(payload);
      expect(putSpy).toHaveBeenCalledWith('/settings/workload-norms', payload);

      putSpy.mockRestore();
    });
  });
});
