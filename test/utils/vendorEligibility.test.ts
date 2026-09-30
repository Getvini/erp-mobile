import { getEligibleVendorsForJobs, getTaskJobId } from '@/utils/vendorEligibility';
import type { VendorItem } from '@/services/vendorService';

describe('vendorEligibility Utils', () => {
  describe('getTaskJobId', () => {
    it('trích xuất jobId trực tiếp từ task.jobId', () => {
      expect(getTaskJobId({ jobId: 'job-123' })).toBe('job-123');
    });

    it('trích xuất jobId từ task.job.id', () => {
      expect(getTaskJobId({ job: { id: 'job-456' } })).toBe('job-456');
    });

    it('trích xuất jobId từ contractService.jobId', () => {
      expect(getTaskJobId({ contractService: { jobId: 'job-789' } })).toBe('job-789');
    });

    it('trích xuất jobId từ contractService.job.id', () => {
      expect(getTaskJobId({ contractService: { job: { id: 'job-999' } } })).toBe('job-999');
    });

    it('trả về chuỗi rỗng khi không có job id', () => {
      expect(getTaskJobId({})).toBe('');
      expect(getTaskJobId(null)).toBe('');
      expect(getTaskJobId(undefined)).toBe('');
    });
  });

  describe('getEligibleVendorsForJobs (AND intersection logic)', () => {
    const mockVendorA = { id: 'v-1', name: 'Vendor 1' } as VendorItem;
    const mockVendorB = { id: 'v-2', name: 'Vendor 2' } as VendorItem;
    const mockVendorC = { id: 'v-3', name: 'Vendor 3' } as VendorItem;

    it('trả về mảng rỗng khi danh sách rỗng hoặc không hợp lệ', () => {
      expect(getEligibleVendorsForJobs([])).toEqual([]);
      expect(getEligibleVendorsForJobs(null as any)).toEqual([]);
    });

    it('trả về toàn bộ danh sách khi chỉ có 1 job', () => {
      const singleList = [mockVendorA, mockVendorB];
      expect(getEligibleVendorsForJobs([singleList])).toEqual(singleList);
    });

    it('lấy giao (AND) của các vendor đáp ứng tất cả các hạng mục', () => {
      // Job 1: Vendor A, Vendor B
      // Job 2: Vendor B, Vendor C
      // Giao (AND): Chỉ Vendor B
      const listJob1 = [mockVendorA, mockVendorB];
      const listJob2 = [mockVendorB, mockVendorC];

      const result = getEligibleVendorsForJobs([listJob1, listJob2]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v-2');
    });

    it('trả về rỗng khi không có vendor nào đáp ứng đồng thời cả 2 hạng mục', () => {
      // Job 1: Vendor A
      // Job 2: Vendor C
      // Giao: Rỗng
      const listJob1 = [mockVendorA];
      const listJob2 = [mockVendorC];

      const result = getEligibleVendorsForJobs([listJob1, listJob2]);
      expect(result).toEqual([]);
    });

    it('lấy giao khi có 3 hạng mục cùng lúc', () => {
      // Job 1: A, B, C
      // Job 2: B, C
      // Job 3: B
      // Giao (AND): Chỉ B
      const list1 = [mockVendorA, mockVendorB, mockVendorC];
      const list2 = [mockVendorB, mockVendorC];
      const list3 = [mockVendorB];

      const result = getEligibleVendorsForJobs([list1, list2, list3]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v-2');
    });
  });
});
